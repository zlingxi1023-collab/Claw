/**
 * Six Little Ducks - HLS 媒体加载器 v3
 * 
 * 核心原则：所有媒体文件完全下载完成后才允许进入！
 * 
 * - 预加载时用 fetch() 完整下载所有媒体文件
 * - 下载失败自动重试（最多3次），仍失败则降级到 fallback 源
 * - 没有超时强制跳过机制 — 必须下载完才能进入
 * - 提供手动重试按钮，用户可随时触发重新下载
 * - Loading 遮罩在所有文件就绪前绝不消失
 */

(function () {
  'use strict';

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
  //  带进度的 fetch 下载（含重试逻辑）
  // ==========================================

  /**
   * 下载单个文件，失败自动重试
   * @param {string} url
   * @param {Function} onProgress - (loaded, total) 回调
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<Blob>}
   */
  function fetchWithRetry(url, onProgress, maxRetries) {
    maxRetries = maxRetries || 3;
    let attempt = 0;

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
          // 等待后重试，指数退避
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

    // iOS Safari 原生支持 HLS
    if (isIOSSafari || el.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('[HLS] ' + elementId + ': Using native HLS');
      el.src = config.hls;

      var onLoaded = function () {
        el.removeEventListener('loadedmetadata', onLoaded);
        el.removeEventListener('error', onErr);
        console.log('[HLS] ' + elementId + ': Ready (native)');
        if (onReady) onReady();
      };
      var onErr = function () {
        el.removeEventListener('loadedmetadata', onLoaded);
        el.removeEventListener('error', onErr);
        console.warn('[HLS] ' + elementId + ': Native failed, using fallback');
        el.src = config.fallback;
        el.load();
        // 等 fallback 加载完再报 ready
        el.addEventListener('loadedmetadata', function onFallbackReady() {
          el.removeEventListener('loadedmetadata', onFallbackReady);
          if (onReady) onReady();
        });
        el.addEventListener('error', function onFallbackErr() {
          el.removeEventListener('error', onFallbackErr);
          if (onReady) onReady(); // 即使失败也要推进流程
        });
      };

      el.addEventListener('loadedmetadata', onLoaded);
      el.addEventListener('error', onErr);
      el.load();
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
  //  预加载系统 v3：严格模式 — 全部下载完才放行
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

    // 第 1 步：非 iOS 先加载 hls.js
    var hlsJsReady = isIOSSafari ? Promise.resolve() : loadHlsJs();

    // 第 2 步：并行下载所有文件（每个文件有3次重试机会）
    var downloadPromises = downloads.map(function (dl) {
      return fetchWithRetry(dl.url, function (loaded, total) {
        updateDetailProgress(dl.url, loaded, total);
      }, 3).then(function (blob) {
        successCount++;
        console.log('[HLS] ✓ Downloaded: ' + dl.url + ' (' + (blob.size / 1024 / 1024).toFixed(1) + ' MB)');
        updateProgressUI();
        return { id: dl.id, url: dl.url, type: dl.type, name: dl.name, blob: blob, success: true };
      }).catch(function (err) {
        console.error('[HLS] ✗ Failed after retries: ' + dl.url, err.message);
        failedDownloads.push(dl);
        return { id: dl.id, url: dl.url, type: dl.type, name: dl.name, error: err, success: false };
      });
    });

    // 第 3 步：等所有下载完成
    Promise.all([hlsJsReady].concat(downloadPromises)).then(function (results) {
      if (loadingComplete) return;

      var downloadResults = results.slice(1);
      var allSuccess = failedDownloads.length === 0;

      if (!allSuccess) {
        // 有文件下载失败 — 不进入，显示错误和重试按钮
        var failedNames = failedDownloads.map(function (d) { return d.name + '(' + d.type + ')'; });
        if (statusText) {
          statusText.textContent = '❌ ' + failedDownloads.length + ' 个文件下载失败: ' + failedNames.join(', ');
        }
        if (progressText) {
          progressText.textContent = successCount + '/' + totalFiles + ' 文件已下载';
        }
        showRetryButton();
        console.error('[HLS] ' + failedDownloads.length + ' files failed. NOT entering app.');
        return; // 不进入！等用户点重试
      }

      // 所有文件下载成功！进入播放器初始化
      if (statusText) statusText.textContent = '⏳ 正在初始化播放器...';

      var setupCompleted = 0;
      var totalSetups = resourceIds.length;

      resourceIds.forEach(function (id) {
        setupHLS(id,
          function onReady() {
            setupCompleted++;
            console.log('[HLS] ' + id + ': Player ready (' + setupCompleted + '/' + totalSetups + ')');
            if (setupCompleted >= totalSetups) {
              finishLoading();
            }
          },
          function onError() {
            setupCompleted++;
            console.warn('[HLS] ' + id + ': Setup failed, but file downloaded');
            if (setupCompleted >= totalSetups) {
              finishLoading();
            }
          }
        );
      });

      // 播放器初始化保护（30秒） — 如果 hls.js 解析很慢
      setTimeout(function () {
        if (!loadingComplete && setupCompleted >= totalSetups - 1) {
          // 大部分已就绪，可以进入
          console.warn('[HLS] Player init slow, but most ready. Entering.');
          finishLoading();
        }
      }, 30000);
    });

    function finishLoading() {
      if (loadingComplete) return;
      loadingComplete = true;

      console.log('[HLS] ✅ All resources downloaded and players ready. Entering app!');

      if (statusText) statusText.textContent = '✅ 所有资源下载完成！';
      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = totalFiles + '/' + totalFiles + ' 文件已下载 (100%)';
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
