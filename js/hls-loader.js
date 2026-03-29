/**
 * Six Little Ducks - HLS 媒体加载器 v9
 * 
 * 核心原则：所有媒体文件就绪后才允许进入，但兼容 iOS 设备内存限制
 * 
 * v9 变更：
 * - 音频 HLS 从 byte-range 单文件模式改为独立分片模式（修复 CF Pages 不支持 Range 的问题）
 * - 视频 HLS 重新编码为均匀 2 秒分片（消除大分片导致的 12 秒卡顿）
 * - hls.js 配置优化：更激进的预缓冲 + 低延迟分片加载策略
 * - iOS Safari：使用原生 HLS 播放 m3u8（所有分片已改为独立模式，无需 Range 请求）
 * - 新增 Cloudflare Pages _headers 配置支持
 * 
 * v8 变更（保留）：
 * - 适配 Cloudflare Pages 部署（单文件 25MB 限制）
 * - MP4 视频压缩至 25MB 以内（CRF 28，H.264 Main profile）
 * 
 * v7 变更（保留）：
 * - 后台缓存改用隐藏 <video>/<audio> 原生预加载
 * 
 * v6 变更（保留）：
 * - 修复 iOS 路径 loadingComplete 双重设置导致永远卡在"初始化播放器"的 bug
 * 
 * 非 iOS 模式：
 * - 预下载 m3u8 播放列表（HLS 分片由 hls.js 按需加载）
 * - 下载失败自动重试（最多3次），仍失败则降级到 fallback 源
 * - Loading 遮罩在所有文件就绪前绝不消失
 */

(function () {
  'use strict';

  // ==========================================
  //  缓存配置
  // ==========================================
  var CACHE_NAME = 'six-little-ducks-media-v1';
  var cacheAvailable = 'caches' in window;

  // ==========================================
  //  平台检测
  // ==========================================
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isIOSSafari = isIOS;

  // ==========================================
  //  HLS 源配置
  // ==========================================
  const HLS_SOURCES = {
    'perf-video': {
      hls: 'media/hls/video-muted/index.m3u8',
      fallback: 'media/six-little-ducks-video-muted.mp4',
      type: 'video',
      name: '表演视频'
    },
    'prac-video': {
      hls: 'media/hls/video/index.m3u8',
      fallback: 'media/six-little-ducks-video.mp4',
      type: 'video',
      name: '练习视频'
    },
    'perf-audio': {
      hls: 'media/hls/audio/index.m3u8',
      fallback: 'media/six-little-ducks-instrumental-extracted.mp3',
      type: 'audio',
      name: '伴奏音频'
    }
  };

  // ==========================================
  //  HLS 实例管理
  // ==========================================
  const hlsInstances = {};
  let hlsJsLoaded = false;
  let hlsJsLoading = false;
  const hlsJsCallbacks = [];

  function loadHlsJs() {
    return new Promise((resolve, reject) => {
      if (hlsJsLoaded) { resolve(); return; }
      hlsJsCallbacks.push({ resolve, reject });
      if (hlsJsLoading) return;
      hlsJsLoading = true;

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
      script.onload = function () {
        hlsJsLoaded = true;
        hlsJsLoading = false;
        console.log('[HLS] hls.js loaded successfully');
        hlsJsCallbacks.forEach(cb => cb.resolve());
        hlsJsCallbacks.length = 0;
      };
      script.onerror = function () {
        hlsJsLoading = false;
        console.warn('[HLS] Failed to load hls.js from CDN');
        // hls.js 加载失败不是致命错误，会降级到 fallback
        hlsJsCallbacks.forEach(cb => cb.resolve());
        hlsJsCallbacks.length = 0;
      };
      document.head.appendChild(script);
    });
  }

  // ==========================================
  //  缓存辅助函数
  // ==========================================

  /**
   * 将 URL 转为完整绝对路径（用于 Cache API 的 key）
   */
  function toAbsoluteURL(relativeUrl) {
    var a = document.createElement('a');
    a.href = relativeUrl;
    return a.href;
  }

  /**
   * 尝试从 Cache API 读取文件
   * @returns {Promise<Response|null>}
   */
  function getFromCache(url) {
    if (!cacheAvailable) return Promise.resolve(null);
    var absUrl = toAbsoluteURL(url);
    return caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(absUrl);
    }).catch(function () {
      return null;
    });
  }

  /**
   * 将 Response 存入 Cache API（克隆后存储）
   */
  function putToCache(url, response) {
    if (!cacheAvailable) return Promise.resolve();
    var absUrl = toAbsoluteURL(url);
    return caches.open(CACHE_NAME).then(function (cache) {
      return cache.put(absUrl, response);
    }).catch(function (err) {
      console.warn('[HLS Cache] Failed to cache ' + url + ':', err.message);
    });
  }

  // ==========================================
  //  带进度的 fetch 下载（含重试逻辑 + 缓存优先）
  // ==========================================

  /**
   * 下载单个文件：优先从缓存读取，未命中则网络下载后存入缓存
   * @param {string} url
   * @param {Function} onProgress - (loaded, total) 回调
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<{blob: Blob, fromCache: boolean}>}
   */
  function fetchWithRetry(url, onProgress, maxRetries) {
    maxRetries = maxRetries || 3;

    // 第一步：检查缓存
    return getFromCache(url).then(function (cachedResponse) {
      if (cachedResponse) {
        // 🎯 缓存命中！直接使用，无需网络请求
        console.log('[HLS Cache] ✓ HIT: ' + url);
        return cachedResponse.blob().then(function (blob) {
          if (onProgress) onProgress(blob.size, blob.size);
          return { blob: blob, fromCache: true };
        });
      }

      // 缓存未命中，走网络下载
      console.log('[HLS Cache] ✗ MISS: ' + url + ' → downloading from network');
      return fetchFromNetwork(url, onProgress, maxRetries).then(function (blob) {
        // 下载成功后存入缓存（异步，不阻塞主流程）
        var responseToCache = new Response(blob.slice(0), {
          status: 200,
          headers: { 'Content-Type': guessContentType(url), 'Content-Length': String(blob.size) }
        });
        putToCache(url, responseToCache);
        return { blob: blob, fromCache: false };
      });
    });
  }

  /**
   * 根据 URL 扩展名猜测 Content-Type
   */
  function guessContentType(url) {
    if (url.indexOf('.mp4') !== -1) return 'video/mp4';
    if (url.indexOf('.mp3') !== -1) return 'audio/mpeg';
    if (url.indexOf('.ts') !== -1) return 'video/mp2t';
    if (url.indexOf('.m3u8') !== -1) return 'application/vnd.apple.mpegurl';
    if (url.indexOf('.ogg') !== -1) return 'audio/ogg';
    return 'application/octet-stream';
  }

  /**
   * 从网络下载文件，失败自动重试
   * @returns {Promise<Blob>}
   */
  function fetchFromNetwork(url, onProgress, maxRetries) {
    var attempt = 0;

    function tryFetch() {
      attempt++;
      return fetch(url).then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);

        var contentLength = response.headers.get('Content-Length');
        var total = contentLength ? parseInt(contentLength, 10) : 0;

        if (!total || !response.body) {
          return response.blob().then(function (blob) {
            if (onProgress) onProgress(blob.size, blob.size);
            return blob;
          });
        }

        var reader = response.body.getReader();
        var loaded = 0;
        var chunks = [];

        return new Promise(function (resolve, reject) {
          function pump() {
            reader.read().then(function (result) {
              if (result.done) {
                resolve(new Blob(chunks));
                return;
              }
              chunks.push(result.value);
              loaded += result.value.length;
              if (onProgress) onProgress(loaded, total);
              pump();
            }).catch(reject);
          }
          pump();
        });
      }).catch(function (err) {
        if (attempt < maxRetries) {
          console.warn('[HLS] Retry ' + attempt + '/' + maxRetries + ' for ' + url + ': ' + err.message);
          return new Promise(function (resolve) {
            setTimeout(resolve, 1000 * attempt);
          }).then(tryFetch);
        }
        throw err;
      });
    }

    return tryFetch();
  }

  // ==========================================
  //  为媒体元素配置 HLS 源
  // ==========================================
  function setupHLS(elementId, onReady, onError) {
    var config = HLS_SOURCES[elementId];
    if (!config) {
      console.warn('[HLS] Unknown element:', elementId);
      if (onError) onError();
      return;
    }

    var el = document.getElementById(elementId);
    if (!el) {
      console.warn('[HLS] Element not found:', elementId);
      if (onError) onError();
      return;
    }

    // iOS Safari：优先使用原生 HLS 播放 m3u8
    // v9：所有 HLS 分片已改为独立文件模式（不再使用 byte-range），Safari 原生 HLS 可以正常工作
    // 如果原生 HLS 失败（如网络问题），降级到 MP4 fallback
    if (isIOSSafari) {
      console.log('[HLS] ' + elementId + ': iOS detected, trying native HLS first (independent segments)');
      el.src = config.hls;
      el.preload = 'auto'; // iOS 原生 HLS 可以 auto 预加载

      var iosReady = false;
      function iosDone() {
        if (iosReady) return;
        iosReady = true;
        el.removeEventListener('loadedmetadata', iosOnMeta);
        el.removeEventListener('canplay', iosOnCanPlay);
        el.removeEventListener('error', iosOnErr);
        console.log('[HLS] ' + elementId + ': Ready (iOS native HLS)');
        if (onReady) onReady();
      }

      var iosOnMeta = function () { iosDone(); };
      var iosOnCanPlay = function () { iosDone(); };
      var iosOnErr = function () {
        console.warn('[HLS] ' + elementId + ': iOS native HLS failed, falling back to MP4');
        el.removeEventListener('loadedmetadata', iosOnMeta);
        el.removeEventListener('canplay', iosOnCanPlay);
        el.removeEventListener('error', iosOnErr);
        // 降级到 MP4
        el.src = config.fallback;
        el.preload = 'metadata';
        el.addEventListener('loadedmetadata', function onFallback() {
          el.removeEventListener('loadedmetadata', onFallback);
          iosDone();
        });
        el.addEventListener('error', function onFallbackErr() {
          el.removeEventListener('error', onFallbackErr);
          console.warn('[HLS] ' + elementId + ': iOS MP4 also failed (will retry on play)');
          iosDone(); // 即使出错也放行 — play 时浏览器会自动重试
        });
        el.load();
      };

      el.addEventListener('loadedmetadata', iosOnMeta);
      el.addEventListener('canplay', iosOnCanPlay);
      el.addEventListener('error', iosOnErr);
      el.load();

      // 超时保护：10 秒后放行
      setTimeout(function () {
        if (!iosReady) {
          console.warn('[HLS] ' + elementId + ': iOS HLS timeout, proceeding');
          iosDone();
        }
      }, 10000);
      return;
    }

    // 非 iOS 但支持原生 HLS（macOS Safari 等）
    if (el.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('[HLS] ' + elementId + ': Using native HLS');
      el.src = config.hls;

      var nativeReady = false;
      function nativeDone() {
        if (nativeReady) return;
        nativeReady = true;
        el.removeEventListener('loadedmetadata', onLoaded);
        el.removeEventListener('canplay', onCanPlay);
        el.removeEventListener('error', onErr);
        console.log('[HLS] ' + elementId + ': Ready (native HLS)');
        if (onReady) onReady();
      }

      var onLoaded = function () { nativeDone(); };
      var onCanPlay = function () { nativeDone(); };

      var onErr = function () {
        el.removeEventListener('loadedmetadata', onLoaded);
        el.removeEventListener('canplay', onCanPlay);
        el.removeEventListener('error', onErr);
        console.warn('[HLS] ' + elementId + ': Native HLS failed, using fallback');
        el.src = config.fallback;
        el.load();
        el.addEventListener('loadedmetadata', function onFallbackReady() {
          el.removeEventListener('loadedmetadata', onFallbackReady);
          nativeDone();
        });
        el.addEventListener('error', function onFallbackErr() {
          el.removeEventListener('error', onFallbackErr);
          nativeDone();
        });
      };

      el.addEventListener('loadedmetadata', onLoaded);
      el.addEventListener('canplay', onCanPlay);
      el.addEventListener('error', onErr);
      el.load();

      setTimeout(function () {
        if (!nativeReady) {
          console.warn('[HLS] ' + elementId + ': Native init timeout, proceeding anyway');
          nativeDone();
        }
      }, 20000);
      return;
    }

    // 非 iOS：使用 hls.js
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      console.log('[HLS] ' + elementId + ': Using hls.js');

      if (hlsInstances[elementId]) {
        hlsInstances[elementId].destroy();
      }

      var hls = new Hls({
        // === 缓冲策略优化 ===
        maxBufferLength: 30,          // 前方最大缓冲 30 秒（默认 30）
        maxMaxBufferLength: 120,      // 允许最多缓冲 120 秒
        maxBufferSize: 60 * 1024 * 1024,  // 最大缓冲 60MB
        maxBufferHole: 0.5,           // 允许 0.5s 的缓冲空洞
        // === 预加载策略 ===
        startPosition: 0,
        backBufferLength: 30,         // 保留 30 秒的回退缓冲
        // === 分片加载优化 ===
        maxFragLookUpTolerance: 0.25, // 分片查找容差
        startFragPrefetch: true,      // 启动时预取分片
        // === 错误恢复 ===
        fragLoadingMaxRetry: 4,       // 分片加载失败最多重试 4 次
        fragLoadingRetryDelay: 500,   // 重试延迟 500ms
        fragLoadingMaxRetryTimeout: 8000, // 最大重试超时 8 秒
        // === 低延迟 ===
        lowLatencyMode: false,        // VOD 不需要低延迟模式
        debug: false
      });

      hls.loadSource(config.hls);
      hls.attachMedia(el);

      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        console.log('[HLS] ' + elementId + ': Manifest parsed');
        if (onReady) onReady();
      });

      hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          console.warn('[HLS] ' + elementId + ': Fatal error, using fallback');
          hls.destroy();
          delete hlsInstances[elementId];
          el.src = config.fallback;
          el.load();
          if (onReady) onReady();
        }
      });

      hlsInstances[elementId] = hls;
    } else {
      // 极端降级
      console.log('[HLS] ' + elementId + ': No HLS support, using fallback');
      el.src = config.fallback;
      el.load();
      if (onReady) onReady();
    }
  }

  // ==========================================
  //  iOS 媒体解锁
  // ==========================================
  var mediaUnlocked = false;

  function unlockMediaOnInteraction() {
    if (mediaUnlocked) return;

    var unlock = function () {
      if (mediaUnlocked) return;
      mediaUnlocked = true;
      console.log('[HLS] User interaction detected, unlocking media');

      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('touchend', unlock, true);
      document.removeEventListener('click', unlock, true);

      var mediaElements = document.querySelectorAll('audio, video');
      mediaElements.forEach(function (el) {
        var playPromise = el.play();
        if (playPromise !== undefined) {
          playPromise.then(function () {
            el.pause();
            el.currentTime = 0;
          }).catch(function () {});
        }
      });
    };

    document.addEventListener('touchstart', unlock, { capture: true, passive: true });
    document.addEventListener('touchend', unlock, { capture: true, passive: true });
    document.addEventListener('click', unlock, { capture: true, passive: true });
  }

  // ==========================================
  //  预加载系统 v9：iOS 原生 HLS + 非 iOS hls.js + 后台缓存
  // ==========================================

  // 全局状态
  var loadingComplete = false;
  var isRetrying = false;

  function preloadAllResourcesHLS() {
    var progressFill = document.querySelector('#loading-progress-fill');
    var progressText = document.querySelector('#loading-progress-text');
    var statusText = document.querySelector('#loading-status');
    var loadingOverlay = document.querySelector('#loading');
    var modeCards = document.querySelectorAll('.mode-card');

    // 确保 loading 遮罩可见且阻止交互
    if (loadingOverlay) {
      loadingOverlay.style.display = '';
      loadingOverlay.classList.remove('hidden');
    }
    modeCards.forEach(function (c) { c.style.pointerEvents = 'none'; });

    // 开始 iOS 媒体解锁监听
    unlockMediaOnInteraction();

    // 注入重试按钮（只注入一次）
    ensureRetryButton();

    if (isIOSSafari) {
      // ========================================
      //  iOS 路径：流式加载 MP4，不预下载大文件
      // ========================================
      preloadForIOS(progressFill, progressText, statusText, loadingOverlay, modeCards);
    } else {
      // ========================================
      //  非 iOS 路径：预下载所有媒体文件
      // ========================================
      preloadForDesktop(progressFill, progressText, statusText, loadingOverlay, modeCards);
    }
  }

  // ==========================================
  //  iOS 预加载：验证文件可访问 + 流式加载
  // ==========================================
  function preloadForIOS(progressFill, progressText, statusText, loadingOverlay, modeCards) {
    console.log('[HLS] iOS detected — using streaming mode (no full download)');

    var resourceIds = Object.keys(HLS_SOURCES);
    // iOS v9：验证 HLS m3u8 播放列表（所有分片已改为独立模式，Safari 原生 HLS 可正常工作）
    // 同时验证 MP4 fallback 作为备用
    var checkFiles = resourceIds.map(function (id) {
      return { id: id, url: HLS_SOURCES[id].hls, fallbackUrl: HLS_SOURCES[id].fallback, name: HLS_SOURCES[id].name };
    });

    var totalFiles = checkFiles.length;
    var checkedCount = 0;
    var failedFiles = [];

    if (statusText) statusText.textContent = '⏳ iOS 设备，正在检查媒体文件...';
    if (progressText) progressText.textContent = '准备中...';
    updateProgressUI_iOS(progressFill, progressText, 0, totalFiles);
    hideRetryButton();

    checkFiles.forEach(function (file) {
      // 验证 HLS m3u8 播放列表可访问
      fetch(file.url, { method: 'HEAD' })
        .then(function (resp) {
          if (resp.ok) {
            console.log('[HLS iOS] ✓ Accessible: ' + file.url);
          } else {
            console.warn('[HLS iOS] ✗ HTTP ' + resp.status + ': ' + file.url);
            failedFiles.push(file);
          }
          checkedCount++;
          updateProgressUI_iOS(progressFill, progressText, checkedCount, totalFiles);

          if (checkedCount >= totalFiles) {
            if (failedFiles.length === 0) {
              finishIOSLoading(progressFill, progressText, statusText, loadingOverlay, modeCards, resourceIds);
            } else {
              // 有文件不可访问，显示错误
              var failedNames = failedFiles.map(function (f) { return f.name; });
              if (statusText) statusText.textContent = '❌ ' + failedFiles.length + ' 个文件不可访问: ' + failedNames.join(', ');
              showRetryButton();
            }
          }
        })
        .catch(function (err) {
          console.error('[HLS iOS] ✗ Network error for ' + file.url + ':', err.message);
          failedFiles.push(file);
          checkedCount++;
          updateProgressUI_iOS(progressFill, progressText, checkedCount, totalFiles);

          if (checkedCount >= totalFiles) {
            if (failedFiles.length === checkFiles.length) {
              // 所有文件都失败
              if (statusText) statusText.textContent = '❌ 网络连接失败，请检查网络后重试';
              showRetryButton();
            } else {
              // 部分失败，仍然尝试继续
              console.warn('[HLS iOS] Some files failed, proceeding anyway');
              finishIOSLoading(progressFill, progressText, statusText, loadingOverlay, modeCards, resourceIds);
            }
          }
        });
    });

    // 超时保护：15秒后强制进入（iOS 可能网络慢）
    setTimeout(function () {
      if (!loadingComplete && checkedCount >= totalFiles - 1) {
        console.warn('[HLS iOS] Check timeout, entering anyway');
        finishIOSLoading(progressFill, progressText, statusText, loadingOverlay, modeCards, resourceIds);
      }
    }, 15000);
  }

  function updateProgressUI_iOS(progressFill, progressText, current, total) {
    var pct = Math.round((current / total) * 100);
    if (progressFill) progressFill.style.width = pct + '%';
    if (progressText) progressText.textContent = current + '/' + total + ' 文件就绪 (' + pct + '%)';
  }

  function finishIOSLoading(progressFill, progressText, statusText, loadingOverlay, modeCards, resourceIds) {
    // 注意：这里不设 loadingComplete = true，留给 finishLoadingCommon 统一设置
    // 之前的 bug：这里设了 true 导致 finishLoadingCommon 检查 if(loadingComplete) return 直接退出

    console.log('[HLS iOS] ✅ Files verified, setting up streaming players...');

    if (statusText) statusText.textContent = '⏳ 正在初始化播放器...';
    if (progressFill) progressFill.style.width = '90%';
    hideRetryButton();

    // 为每个媒体元素设置 MP4 源（流式加载）
    var setupCompleted = 0;
    var totalSetups = resourceIds.length;

    resourceIds.forEach(function (id) {
      setupHLS(id,
        function onReady() {
          setupCompleted++;
          console.log('[HLS iOS] ' + id + ': Player ready (' + setupCompleted + '/' + totalSetups + ')');
          if (setupCompleted >= totalSetups) {
            finishLoadingCommon(progressFill, progressText, statusText, loadingOverlay, modeCards, totalSetups, totalSetups);
          }
        },
        function onError() {
          setupCompleted++;
          console.warn('[HLS iOS] ' + id + ': Setup had issues, continuing');
          if (setupCompleted >= totalSetups) {
            finishLoadingCommon(progressFill, progressText, statusText, loadingOverlay, modeCards, totalSetups, totalSetups);
          }
        }
      );
    });

    // iOS 超时保护：8秒（MP4 metadata 加载 + loadedmetadata 事件应该很快）
    setTimeout(function () {
      if (!loadingComplete) {
        console.warn('[HLS iOS] Player init timeout, forcing entry');
        finishLoadingCommon(progressFill, progressText, statusText, loadingOverlay, modeCards, setupCompleted, totalSetups);
      }
    }, 8000);
  }

  // ==========================================
  //  非 iOS 预加载：完整下载所有文件
  // ==========================================
  function preloadForDesktop(progressFill, progressText, statusText, loadingOverlay, modeCards) {
    console.log('[HLS] Desktop detected — using full download mode');

    var resourceIds = Object.keys(HLS_SOURCES);

    // 收集所有需要下载的文件（仅 m3u8 播放列表，HLS 分片由 hls.js 按需加载）
    var downloads = [];
    resourceIds.forEach(function (id) {
      var config = HLS_SOURCES[id];
      downloads.push({ id: id, url: config.hls, type: 'm3u8', name: config.name });
    });

    var totalFiles = downloads.length;
    var successCount = 0;
    var failedDownloads = [];
    var progressMap = {};

    function updateProgressUI() {
      var pct = Math.round((successCount / totalFiles) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressText) {
        progressText.textContent = successCount + '/' + totalFiles + ' 文件已下载 (' + pct + '%)';
      }
    }

    function updateDetailProgress(url, loaded, total) {
      progressMap[url] = { loaded: loaded, total: total };
      var tl = 0, tt = 0;
      var keys = Object.keys(progressMap);
      for (var i = 0; i < keys.length; i++) {
        tl += progressMap[keys[i]].loaded;
        tt += progressMap[keys[i]].total;
      }
      if (tt > 0 && statusText) {
        var mbLoaded = (tl / 1024 / 1024).toFixed(1);
        var mbTotal = (tt / 1024 / 1024).toFixed(1);
        statusText.textContent = '⏳ 正在下载媒体文件 ' + mbLoaded + '/' + mbTotal + ' MB...';
      }
    }

    if (statusText) statusText.textContent = '⏳ 正在下载媒体文件...';
    updateProgressUI();
    hideRetryButton();

    // 第 1 步：加载 hls.js
    var hlsJsReady = loadHlsJs();

    // 第 2 步：并行下载所有文件
    var cacheHitCount = 0;
    var downloadPromises = downloads.map(function (dl) {
      return fetchWithRetry(dl.url, function (loaded, total) {
        updateDetailProgress(dl.url, loaded, total);
      }, 3).then(function (result) {
        successCount++;
        if (result.fromCache) {
          cacheHitCount++;
          console.log('[HLS] ✓ From cache: ' + dl.url + ' (' + (result.blob.size / 1024 / 1024).toFixed(1) + ' MB)');
        } else {
          console.log('[HLS] ✓ Downloaded: ' + dl.url + ' (' + (result.blob.size / 1024 / 1024).toFixed(1) + ' MB)');
        }
        updateProgressUI();
        if (cacheHitCount > 0 && statusText) {
          statusText.textContent = '⚡ ' + cacheHitCount + ' 个文件从缓存加载，' + (successCount - cacheHitCount) + ' 个正在下载...';
        }
        return { id: dl.id, url: dl.url, type: dl.type, name: dl.name, blob: result.blob, success: true, fromCache: result.fromCache };
      }).catch(function (err) {
        console.error('[HLS] ✗ Failed after retries: ' + dl.url, err.message);
        failedDownloads.push(dl);
        return { id: dl.id, url: dl.url, type: dl.type, name: dl.name, error: err, success: false };
      });
    });

    // 第 3 步：等所有下载完成
    Promise.all([hlsJsReady].concat(downloadPromises)).then(function (results) {
      if (loadingComplete) return;

      if (failedDownloads.length > 0) {
        var failedNames = failedDownloads.map(function (d) { return d.name + '(' + d.type + ')'; });
        if (statusText) {
          statusText.textContent = '❌ ' + failedDownloads.length + ' 个文件下载失败: ' + failedNames.join(', ');
        }
        if (progressText) {
          progressText.textContent = successCount + '/' + totalFiles + ' 文件已下载';
        }
        showRetryButton();
        return;
      }

      // 所有文件下载成功！进入播放器初始化
      if (statusText) statusText.textContent = '⏳ 正在初始化播放器...';

      var setupCompleted = 0;
      var totalSetups = resourceIds.length;

      resourceIds.forEach(function (id) {
        setupHLS(id,
          function onReady() {
            setupCompleted++;
            if (setupCompleted >= totalSetups) {
              finishLoadingCommon(progressFill, progressText, statusText, loadingOverlay, modeCards, totalFiles, totalFiles);
            }
          },
          function onError() {
            setupCompleted++;
            if (setupCompleted >= totalSetups) {
              finishLoadingCommon(progressFill, progressText, statusText, loadingOverlay, modeCards, totalFiles, totalFiles);
            }
          }
        );
      });

      // 桌面超时保护：30秒
      setTimeout(function () {
        if (!loadingComplete && setupCompleted >= resourceIds.length - 1) {
          finishLoadingCommon(progressFill, progressText, statusText, loadingOverlay, modeCards, successCount, totalFiles);
        }
      }, 30000);
    });
  }

  // ==========================================
  //  iOS 后台静默预加载（进入应用后触发）
  //  使用隐藏 <video>/<audio> 元素让浏览器原生缓存，避免 Cache API 206 兼容问题
  // ==========================================
  var backgroundCacheStarted = false;

  function startBackgroundCache() {
    if (!isIOSSafari || backgroundCacheStarted) return;
    backgroundCacheStarted = true;

    console.log('[HLS iOS] Starting background native preload...');

    var resourceIds = Object.keys(HLS_SOURCES);
    resourceIds.forEach(function (id) {
      var source = HLS_SOURCES[id];
      // v9: 使用 HLS m3u8 进行后台预加载（独立分片模式）
      var url = source.hls;
      var tag = source.type === 'video' ? 'video' : 'audio';
      var el = document.createElement(tag);
      el.preload = 'auto';
      el.muted = true; // 静音避免自动播放策略拦截
      el.playsInline = true;
      el.src = url;
      el.style.display = 'none';
      el.load();
      document.body.appendChild(el);
      console.log('[HLS iOS] Background preload started: ' + url);
    });
  }

  // ==========================================
  //  通用完成处理
  // ==========================================
  function finishLoadingCommon(progressFill, progressText, statusText, loadingOverlay, modeCards, loadedCount, totalCount) {
    if (loadingComplete) return;
    loadingComplete = true;

    console.log('[HLS] ✅ All resources ready. Entering app!');

    if (statusText) statusText.textContent = '✅ 所有资源加载完成！';
    if (progressFill) progressFill.style.width = '100%';
    if (progressText) progressText.textContent = totalCount + '/' + totalCount + ' 文件就绪 (100%)';
    hideRetryButton();

    // 恢复模式卡片交互
    modeCards.forEach(function (c) { c.style.pointerEvents = ''; });

    // 延迟淡出 loading 遮罩
    setTimeout(function () {
      if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
        setTimeout(function () {
          loadingOverlay.style.display = 'none';
        }, 600);
      }
    }, 500);

    // iOS：进入后启动后台静默预缓存
    if (isIOSSafari) {
      startBackgroundCache();
    }
  }

  // ==========================================
  //  重试按钮管理
  // ==========================================
  function ensureRetryButton() {
    if (document.querySelector('#loading-retry-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'loading-retry-btn';
    btn.textContent = '🔄 重新下载';
    btn.style.cssText = 'display:none; margin-top:16px; padding:10px 28px; font-size:1rem; font-weight:700; color:#fff; background:linear-gradient(135deg,#FF6B6B,#4ECDC4); border:none; border-radius:30px; cursor:pointer; transition:transform 0.2s,box-shadow 0.2s; box-shadow:0 4px 15px rgba(78,205,196,0.3);';
    btn.addEventListener('mouseenter', function () { btn.style.transform = 'scale(1.05)'; });
    btn.addEventListener('mouseleave', function () { btn.style.transform = 'scale(1)'; });
    btn.addEventListener('click', function () {
      if (isRetrying) return;
      isRetrying = true;
      loadingComplete = false;
      // 重新开始完整预加载流程
      preloadAllResourcesHLS();
      isRetrying = false;
    });

    var container = document.querySelector('#loading');
    if (container) container.appendChild(btn);
  }

  function showRetryButton() {
    var btn = document.querySelector('#loading-retry-btn');
    if (btn) btn.style.display = '';
  }

  function hideRetryButton() {
    var btn = document.querySelector('#loading-retry-btn');
    if (btn) btn.style.display = 'none';
  }

  // ==========================================
  //  销毁
  // ==========================================
  function destroyHLS(elementId) {
    if (hlsInstances[elementId]) {
      hlsInstances[elementId].destroy();
      delete hlsInstances[elementId];
    }
  }

  function destroyAllHLS() {
    Object.keys(hlsInstances).forEach(function (id) {
      hlsInstances[id].destroy();
      delete hlsInstances[id];
    });
  }

  // ==========================================
  //  导出
  // ==========================================
  window.HLSLoader = {
    isIOS: isIOS,
    isSafari: isSafari,
    isIOSSafari: isIOSSafari,
    setupHLS: setupHLS,
    preloadAllResourcesHLS: preloadAllResourcesHLS,
    destroyHLS: destroyHLS,
    destroyAllHLS: destroyAllHLS,
    unlockMediaOnInteraction: unlockMediaOnInteraction,
    HLS_SOURCES: HLS_SOURCES
  };

})();
