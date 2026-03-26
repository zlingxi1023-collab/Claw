/**
 * Six Little Ducks - HLS 媒体加载器 v5
 * 
 * 核心原则：所有媒体文件就绪后才允许进入，但兼容 iOS 设备内存限制
 * 
 * v5 变更：
 * - iOS 设备不再预下载大文件，改用 MP4 流式播放（避免 160MB+ 内存占用）
 * - 非 iOS 设备保留预下载机制（桌面端内存充足）
 * - iOS 仅验证 MP4 文件可访问（HEAD 请求），然后直接设置 src 让浏览器流式加载
 * - 移除 iOS 上的 Cache API 缓存（避免大文件占用设备存储）
 * - 添加更友好的下载进度显示和错误提示
 * 
 * 非 iOS 模式：
 * - 预下载所有媒体文件（带 Cache API 持久缓存）
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
      ts: 'media/hls/video-muted/seg.ts',
      fallback: 'media/six-little-ducks-video-muted.mp4',
      type: 'video',
      name: '表演视频'
    },
    'prac-video': {
      hls: 'media/hls/video/index.m3u8',
      ts: 'media/hls/video/seg.ts',
      fallback: 'media/six-little-ducks-video.mp4',
      type: 'video',
      name: '练习视频'
    },
    'perf-audio': {
      hls: 'media/hls/audio/index.m3u8',
      ts: 'media/hls/audio/seg.ts',
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

    // iOS Safari：使用 MP4 fallback 而非原生 HLS
    // 原因：Safari 原生 HLS（single_file byterange 模式）对 seek 操作支持有缺陷
    //       未缓冲区域的 seek 会静默失败，导致歌词点击跳转和 AB 循环不工作
    //       MP4 有完整的 moov atom，Safari 对 MP4 的 seek 支持非常好
    if (isIOSSafari) {
      console.log('[HLS] ' + elementId + ': iOS detected, using MP4 streaming (no preload download)');
      el.src = config.fallback;
      el.preload = 'metadata'; // 仅加载元数据，不预下载整个文件

      var iosReady = false;
      function iosDone() {
        if (iosReady) return;
        iosReady = true;
        el.removeEventListener('loadedmetadata', iosOnMeta);
        el.removeEventListener('canplay', iosOnCanPlay);
        el.removeEventListener('error', iosOnErr);
        console.log('[HLS] ' + elementId + ': Ready (iOS MP4 streaming)');
        if (onReady) onReady();
      }

      var iosOnMeta = function () { iosDone(); };
      var iosOnCanPlay = function () { iosDone(); };
      var iosOnErr = function () {
        console.warn('[HLS] ' + elementId + ': iOS MP4 load error (will retry on play)');
        iosDone(); // 即使出错也放行 — play 时浏览器会自动重试
      };

      el.addEventListener('loadedmetadata', iosOnMeta);
      el.addEventListener('canplay', iosOnCanPlay);
      el.addEventListener('error', iosOnErr);
      el.load();

      // 超时保护：8 秒后放行（MP4 metadata 加载应该很快）
      setTimeout(function () {
        if (!iosReady) {
          console.warn('[HLS] ' + elementId + ': iOS MP4 metadata timeout, proceeding');
          iosDone();
        }
      }, 8000);
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
        maxBufferLength: 120,
        maxMaxBufferLength: 300,
        maxBufferSize: 200 * 1024 * 1024,
        startPosition: 0,
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
  //  预加载系统 v5：iOS 流式 + 非 iOS 预下载
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
    // iOS 只需验证 MP4 fallback 文件可访问
    var fallbackFiles = resourceIds.map(function (id) {
      return { id: id, url: HLS_SOURCES[id].fallback, name: HLS_SOURCES[id].name };
    });

    var totalFiles = fallbackFiles.length;
    var checkedCount = 0;
    var failedFiles = [];

    if (statusText) statusText.textContent = '⏳ iOS 设备，正在检查媒体文件...';
    if (progressText) progressText.textContent = '准备中...';
    updateProgressUI_iOS(progressFill, progressText, 0, totalFiles);
    hideRetryButton();

    fallbackFiles.forEach(function (file) {
      // 使用 HEAD 请求验证文件存在且可访问
      fetch(file.url, { method: 'HEAD' })
        .then(function (resp) {
          if (resp.ok) {
            console.log('[HLS iOS] ✓ Accessible: ' + file.url + ' (' + resp.headers.get('Content-Length') + ' bytes)');
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
            if (failedFiles.length === fallbackFiles.length) {
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
    if (loadingComplete) return;
    loadingComplete = true;

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

    // iOS 超时保护：10秒
    setTimeout(function () {
      if (!loadingComplete) {
        console.warn('[HLS iOS] Player init timeout, forcing entry');
        loadingComplete = true;
        finishLoadingCommon(progressFill, progressText, statusText, loadingOverlay, modeCards, setupCompleted, totalSetups);
      }
    }, 10000);
  }

  // ==========================================
  //  非 iOS 预加载：完整下载所有文件
  // ==========================================
  function preloadForDesktop(progressFill, progressText, statusText, loadingOverlay, modeCards) {
    console.log('[HLS] Desktop detected — using full download mode');

    var resourceIds = Object.keys(HLS_SOURCES);

    // 收集所有需要下载的文件
    var downloads = [];
    resourceIds.forEach(function (id) {
      var config = HLS_SOURCES[id];
      downloads.push({ id: id, url: config.ts, type: 'ts', name: config.name });
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
