/**
 * Six Little Ducks - HLS 媒体加载器 v11
 * 
 * 核心架构：先下载后播放（Download-then-Play）
 * 
 * v11 变更：
 * - Cache API 持久化：下载的文件存入 Cache Storage，关闭/刷新浏览器不丢失
 * - 启动时缓存完整性检查：所有文件已缓存 → 秒开，跳过下载
 * - 断点续传：下载中断后，下次从已下载位置继续（部分数据暂存 + 合并）
 * - 每个媒体流使用单个完整 TS 文件（不分片）
 * - 下载完成后创建 Blob URL，本地播放
 * - Chrome/桌面：hls.js 自定义 loader 从 Blob 读取
 * - iOS Safari/iPad：直接用 Blob URL（Safari 原生支持 TS）
 * 
 * 保持 window.HLSLoader.preloadAllResourcesHLS() 接口不变
 */

(function () {
  'use strict';

  // ==========================================
  //  缓存配置
  // ==========================================
  var CACHE_NAME = 'six-little-ducks-media-v3';
  var PARTIAL_CACHE_NAME = 'six-little-ducks-partial-v1'; // 断点续传的部分数据
  var cacheAvailable = 'caches' in window;

  // ==========================================
  //  平台检测
  // ==========================================
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isIOSSafari = isIOS;

  // ==========================================
  //  HLS 源配置 — 单文件 TS + m3u8
  // ==========================================
  const HLS_SOURCES = {
    'perf-video': {
      hls: 'media/hls/video-muted/index.m3u8',
      ts: 'media/hls/video-muted/video-muted.ts',
      fallback: 'media/six-little-ducks-video-muted.mp4',
      type: 'video',
      name: '表演视频',
      sizeMB: 23 // 近似大小，用于 UI 预估
    },
    'prac-video': {
      hls: 'media/hls/video/index.m3u8',
      ts: 'media/hls/video/video.ts',
      fallback: 'media/six-little-ducks-video.mp4',
      type: 'video',
      name: '练习视频',
      sizeMB: 25
    },
    'perf-audio': {
      hls: 'media/hls/audio/index.m3u8',
      ts: 'media/hls/audio/audio.ts',
      fallback: 'media/six-little-ducks-instrumental-extracted.mp3',
      type: 'audio',
      name: '伴奏音频',
      sizeMB: 2
    }
  };

  // ==========================================
  //  下载后的 Blob 存储
  // ==========================================
  const blobStore = {}; // { resourceId: { tsBlob, tsBlobUrl, m3u8Blob, m3u8BlobUrl } }

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
        console.log('[HLS v11] hls.js loaded successfully');
        hlsJsCallbacks.forEach(cb => cb.resolve());
        hlsJsCallbacks.length = 0;
      };
      script.onerror = function () {
        hlsJsLoading = false;
        console.warn('[HLS v11] Failed to load hls.js from CDN');
        hlsJsCallbacks.forEach(cb => cb.resolve());
        hlsJsCallbacks.length = 0;
      };
      document.head.appendChild(script);
    });
  }

  // ==========================================
  //  缓存辅助函数
  // ==========================================
  function toAbsoluteURL(relativeUrl) {
    var a = document.createElement('a');
    a.href = relativeUrl;
    return a.href;
  }

  function getFromCache(url) {
    if (!cacheAvailable) return Promise.resolve(null);
    var absUrl = toAbsoluteURL(url);
    return caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(absUrl);
    }).catch(function () {
      return null;
    });
  }

  function putToCache(url, response) {
    if (!cacheAvailable) return Promise.resolve();
    var absUrl = toAbsoluteURL(url);
    return caches.open(CACHE_NAME).then(function (cache) {
      return cache.put(absUrl, response);
    }).catch(function (err) {
      console.warn('[HLS v11 Cache] Failed to cache ' + url + ':', err.message);
    });
  }

  // ==========================================
  //  断点续传：部分数据暂存（用 Cache API 存储已下载的 chunk）
  // ==========================================
  function getPartialKey(url) {
    return toAbsoluteURL(url) + '::partial';
  }

  function savePartialData(url, blob) {
    if (!cacheAvailable) return Promise.resolve();
    var key = getPartialKey(url);
    var resp = new Response(blob, {
      status: 200,
      headers: { 'X-Partial-Size': String(blob.size) }
    });
    return caches.open(PARTIAL_CACHE_NAME).then(function (cache) {
      return cache.put(key, resp);
    }).catch(function () {});
  }

  function getPartialData(url) {
    if (!cacheAvailable) return Promise.resolve(null);
    var key = getPartialKey(url);
    return caches.open(PARTIAL_CACHE_NAME).then(function (cache) {
      return cache.match(key);
    }).then(function (resp) {
      if (!resp) return null;
      return resp.blob().then(function (blob) {
        return blob.size > 0 ? blob : null;
      });
    }).catch(function () {
      return null;
    });
  }

  function clearPartialData(url) {
    if (!cacheAvailable) return Promise.resolve();
    var key = getPartialKey(url);
    return caches.open(PARTIAL_CACHE_NAME).then(function (cache) {
      return cache.delete(key);
    }).catch(function () {});
  }

  // ==========================================
  //  缓存完整性检查：启动时检测所有文件是否已完整缓存
  // ==========================================
  function checkAllCached() {
    if (!cacheAvailable) return Promise.resolve({ allCached: false, results: {} });

    var resourceIds = Object.keys(HLS_SOURCES);
    var checks = [];
    var results = {};

    resourceIds.forEach(function (id) {
      var config = HLS_SOURCES[id];

      // 检查 TS 文件
      checks.push(
        getFromCache(config.ts).then(function (resp) {
          if (resp) {
            return resp.clone().blob().then(function (blob) {
              // 文件大于 100KB 认为有效（排除错误页面等）
              results[id] = { cached: blob.size > 102400, tsBlob: blob, tsSize: blob.size };
              return null;
            });
          }
          results[id] = { cached: false, tsBlob: null, tsSize: 0 };
        })
      );

      // 检查 m3u8 文件
      checks.push(
        getFromCache(config.hls).then(function (resp) {
          if (resp) {
            return resp.clone().blob().then(function (blob) {
              return blob.text().then(function (text) {
                if (!results[id]) results[id] = {};
                results[id].m3u8Cached = text.length > 10;
                results[id].m3u8Text = text;
              });
            });
          }
          if (!results[id]) results[id] = {};
          results[id].m3u8Cached = false;
        })
      );
    });

    return Promise.all(checks).then(function () {
      var allCached = true;
      resourceIds.forEach(function (id) {
        if (!results[id] || !results[id].cached || !results[id].m3u8Cached) {
          allCached = false;
        }
      });
      return { allCached: allCached, results: results };
    });
  }

  // ==========================================
  //  带进度的 fetch 下载（含断点续传 + 缓存）
  // ==========================================
  function fetchWithProgress(url, onProgress, maxRetries) {
    maxRetries = maxRetries || 3;

    // 第 1 步：检查完整缓存
    return getFromCache(url).then(function (cachedResponse) {
      if (cachedResponse) {
        console.log('[HLS v11 Cache] ✓ HIT: ' + url);
        return cachedResponse.blob().then(function (blob) {
          if (blob.size > 102400 || url.indexOf('.m3u8') !== -1) {
            if (onProgress) onProgress(blob.size, blob.size);
            return { blob: blob, fromCache: true };
          }
          // 缓存文件太小，可能是错误响应，重新下载
          console.warn('[HLS v11 Cache] Cached file too small (' + blob.size + 'B), re-downloading');
          return doDownloadWithResume(url, onProgress, maxRetries);
        });
      }

      console.log('[HLS v11 Cache] ✗ MISS: ' + url + ' → checking partial data');
      return doDownloadWithResume(url, onProgress, maxRetries);
    });
  }

  // 带断点续传的下载
  function doDownloadWithResume(url, onProgress, maxRetries) {
    // 第 2 步：检查是否有部分下载的数据
    return getPartialData(url).then(function (partialBlob) {
      var resumeOffset = partialBlob ? partialBlob.size : 0;

      if (resumeOffset > 0) {
        console.log('[HLS v11 Resume] Found partial data for ' + url + ': ' + (resumeOffset / 1024 / 1024).toFixed(1) + ' MB, resuming...');
      }

      return fetchFromNetworkResumable(url, resumeOffset, partialBlob, onProgress, maxRetries).then(function (blob) {
        // 下载完成，存入完整缓存
        var responseToCache = new Response(blob.slice(0), {
          status: 200,
          headers: { 'Content-Type': guessContentType(url), 'Content-Length': String(blob.size) }
        });
        putToCache(url, responseToCache);
        // 清除部分数据缓存
        clearPartialData(url);
        return { blob: blob, fromCache: false };
      });
    });
  }

  function guessContentType(url) {
    if (url.indexOf('.mp4') !== -1) return 'video/mp4';
    if (url.indexOf('.mp3') !== -1) return 'audio/mpeg';
    if (url.indexOf('.ts') !== -1) return 'video/mp2t';
    if (url.indexOf('.m3u8') !== -1) return 'application/vnd.apple.mpegurl';
    return 'application/octet-stream';
  }

  function fetchFromNetworkResumable(url, resumeOffset, existingBlob, onProgress, maxRetries) {
    var attempt = 0;

    function tryFetch() {
      attempt++;

      var headers = {};
      // 断点续传：从已下载位置继续
      if (resumeOffset > 0) {
        headers['Range'] = 'bytes=' + resumeOffset + '-';
      }

      return fetch(url, { headers: headers }).then(function (response) {
        // 如果服务器不支持 Range（返回 200 而非 206），则从头下载
        var isPartial = response.status === 206;
        if (resumeOffset > 0 && !isPartial) {
          console.log('[HLS v11 Resume] Server returned ' + response.status + ' (no Range support), downloading from start');
          resumeOffset = 0;
          existingBlob = null;
        }

        if (!response.ok && response.status !== 206) {
          throw new Error('HTTP ' + response.status + ' for ' + url);
        }

        var contentLength = response.headers.get('Content-Length');
        var remainingSize = contentLength ? parseInt(contentLength, 10) : 0;
        var totalSize = resumeOffset + remainingSize;

        // 报告已有的进度
        if (resumeOffset > 0 && onProgress) {
          onProgress(resumeOffset, totalSize);
        }

        if (!response.body) {
          return response.blob().then(function (newBlob) {
            var finalBlob;
            if (existingBlob && isPartial) {
              finalBlob = new Blob([existingBlob, newBlob]);
            } else {
              finalBlob = newBlob;
            }
            if (onProgress) onProgress(finalBlob.size, finalBlob.size);
            return finalBlob;
          });
        }

        var reader = response.body.getReader();
        var loaded = resumeOffset;
        var chunks = [];
        var lastSaveTime = Date.now();

        return new Promise(function (resolve, reject) {
          function pump() {
            reader.read().then(function (result) {
              if (result.done) {
                // 下载完成，合并所有数据
                var newBlob = new Blob(chunks);
                var finalBlob;
                if (existingBlob && isPartial) {
                  finalBlob = new Blob([existingBlob, newBlob]);
                } else {
                  finalBlob = newBlob;
                }
                resolve(finalBlob);
                return;
              }
              chunks.push(result.value);
              loaded += result.value.length;
              if (onProgress) onProgress(loaded, totalSize || loaded);

              // 每 5 秒保存一次部分数据（断点续传保护）
              var now = Date.now();
              if (now - lastSaveTime > 5000 && url.indexOf('.ts') !== -1) {
                lastSaveTime = now;
                var partialChunks = new Blob(chunks);
                var partialFull;
                if (existingBlob && isPartial) {
                  partialFull = new Blob([existingBlob, partialChunks]);
                } else {
                  partialFull = partialChunks;
                }
                savePartialData(url, partialFull);
                console.log('[HLS v11 Resume] Saved partial: ' + (partialFull.size / 1024 / 1024).toFixed(1) + ' MB');
              }

              pump();
            }).catch(function (err) {
              // 下载中断，保存已下载的部分数据
              console.warn('[HLS v11 Resume] Download interrupted: ' + err.message);
              if (chunks.length > 0 && url.indexOf('.ts') !== -1) {
                var partialChunks = new Blob(chunks);
                var partialFull;
                if (existingBlob && isPartial) {
                  partialFull = new Blob([existingBlob, partialChunks]);
                } else {
                  partialFull = partialChunks;
                }
                savePartialData(url, partialFull).then(function () {
                  console.log('[HLS v11 Resume] Saved ' + (partialFull.size / 1024 / 1024).toFixed(1) + ' MB for next resume');
                });
                // 更新 resumeOffset，以便重试时继续
                resumeOffset = partialFull.size;
                existingBlob = partialFull;
              }
              reject(err);
            });
          }
          pump();
        });
      }).catch(function (err) {
        if (attempt < maxRetries) {
          console.warn('[HLS v11] Retry ' + attempt + '/' + maxRetries + ' for ' + url + ': ' + err.message);
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
  //  为媒体元素配置播放源（从本地 Blob）
  // ==========================================
  function setupPlayerFromBlob(elementId, onReady, onError) {
    var config = HLS_SOURCES[elementId];
    if (!config) {
      console.warn('[HLS v11] Unknown element:', elementId);
      if (onError) onError();
      return;
    }

    var el = document.getElementById(elementId);
    if (!el) {
      console.warn('[HLS v11] Element not found:', elementId);
      if (onError) onError();
      return;
    }

    var store = blobStore[elementId];

    // ======================================
    //  策略 1: iOS Safari — 直接用 Blob URL
    //  Safari 原生支持 TS 格式播放
    // ======================================
    if (isIOSSafari) {
      console.log('[HLS v11] ' + elementId + ': iOS mode — using Blob URL directly');

      if (store && store.tsBlobUrl) {
        // 优先用 TS Blob URL
        el.src = store.tsBlobUrl;
      } else if (config.fallback) {
        // 降级用原始 fallback URL
        el.src = config.fallback;
      }
      el.preload = 'auto';

      var iosReady = false;
      function iosDone() {
        if (iosReady) return;
        iosReady = true;
        el.removeEventListener('loadedmetadata', iosOnMeta);
        el.removeEventListener('canplay', iosOnCanPlay);
        el.removeEventListener('error', iosOnErr);
        console.log('[HLS v11] ' + elementId + ': Ready (iOS Blob)');
        if (onReady) onReady();
      }

      var iosOnMeta = function () { iosDone(); };
      var iosOnCanPlay = function () { iosDone(); };
      var iosOnErr = function () {
        console.warn('[HLS v11] ' + elementId + ': iOS Blob URL failed, trying fallback MP4');
        el.removeEventListener('loadedmetadata', iosOnMeta);
        el.removeEventListener('canplay', iosOnCanPlay);
        el.removeEventListener('error', iosOnErr);

        // 降级到 MP4 fallback
        el.src = config.fallback;
        el.preload = 'metadata';
        el.addEventListener('loadedmetadata', function onFB() {
          el.removeEventListener('loadedmetadata', onFB);
          iosDone();
        });
        el.addEventListener('error', function onFBErr() {
          el.removeEventListener('error', onFBErr);
          console.warn('[HLS v11] ' + elementId + ': iOS fallback also failed');
          iosDone();
        });
        el.load();
      };

      el.addEventListener('loadedmetadata', iosOnMeta);
      el.addEventListener('canplay', iosOnCanPlay);
      el.addEventListener('error', iosOnErr);
      el.load();

      // 超时保护
      setTimeout(function () { if (!iosReady) { console.warn('[HLS v11] ' + elementId + ': iOS timeout'); iosDone(); } }, 10000);
      return;
    }

    // ======================================
    //  策略 2: macOS Safari — 原生 HLS 支持
    //  用 Blob URL 的 m3u8（需要改写路径指向 TS Blob）
    //  或者直接用 TS Blob URL
    // ======================================
    if (el.canPlayType('application/vnd.apple.mpegurl') && !hlsJsLoaded) {
      console.log('[HLS v11] ' + elementId + ': Native HLS (Safari) — using TS Blob URL');

      if (store && store.tsBlobUrl) {
        el.src = store.tsBlobUrl;
      } else {
        el.src = config.fallback;
      }

      var nativeReady = false;
      function nativeDone() {
        if (nativeReady) return;
        nativeReady = true;
        console.log('[HLS v11] ' + elementId + ': Ready (Native)');
        if (onReady) onReady();
      }

      el.addEventListener('loadedmetadata', function onMeta() {
        el.removeEventListener('loadedmetadata', onMeta);
        nativeDone();
      });
      el.addEventListener('error', function onErr() {
        el.removeEventListener('error', onErr);
        console.warn('[HLS v11] ' + elementId + ': Native playback failed, trying fallback');
        el.src = config.fallback;
        el.load();
        el.addEventListener('loadedmetadata', function onFB() {
          el.removeEventListener('loadedmetadata', onFB);
          nativeDone();
        });
      });
      el.load();

      setTimeout(function () { if (!nativeReady) { console.warn('[HLS v11] ' + elementId + ': Native timeout'); nativeDone(); } }, 15000);
      return;
    }

    // ======================================
    //  策略 3: Chrome 等 — hls.js + 自定义 Blob Loader
    // ======================================
    if (typeof Hls !== 'undefined' && Hls.isSupported() && store && store.tsBlob && store.m3u8Text) {
      console.log('[HLS v11] ' + elementId + ': Using hls.js with local Blob loader');

      if (hlsInstances[elementId]) {
        hlsInstances[elementId].destroy();
      }

      // 创建自定义 loader，让 hls.js 从内存 Blob 读取
      var localStore = store;
      var CustomLoader = createBlobLoader(localStore);

      var hls = new Hls({
        maxBufferLength: 60,
        maxMaxBufferLength: 600,
        maxBufferSize: 120 * 1024 * 1024,
        maxBufferHole: 0.5,
        startPosition: 0,
        backBufferLength: 60,
        startFragPrefetch: true,
        fragLoadingMaxRetry: 2,
        lowLatencyMode: false,
        debug: false,
        loader: CustomLoader
      });

      hls.loadSource(config.hls); // hls.js 会请求 m3u8 → 被 CustomLoader 拦截
      hls.attachMedia(el);

      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        console.log('[HLS v11] ' + elementId + ': Manifest parsed (from Blob)');
        if (onReady) onReady();
      });

      hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          console.warn('[HLS v11] ' + elementId + ': hls.js fatal error, using TS Blob URL directly');
          hls.destroy();
          delete hlsInstances[elementId];
          // 降级：直接用 TS Blob URL
          if (store.tsBlobUrl) {
            el.src = store.tsBlobUrl;
          } else {
            el.src = config.fallback;
          }
          el.load();
          if (onReady) onReady();
        }
      });

      hlsInstances[elementId] = hls;
    } else if (store && store.tsBlobUrl) {
      // hls.js 不可用但有 Blob：直接设 src
      console.log('[HLS v11] ' + elementId + ': No hls.js, using TS Blob URL');
      el.src = store.tsBlobUrl;
      el.load();
      el.addEventListener('loadedmetadata', function onMeta() {
        el.removeEventListener('loadedmetadata', onMeta);
        if (onReady) onReady();
      });
      el.addEventListener('error', function onErr() {
        el.removeEventListener('error', onErr);
        el.src = config.fallback;
        el.load();
        if (onReady) onReady();
      });
    } else {
      // 极端降级
      console.log('[HLS v11] ' + elementId + ': Full fallback mode');
      el.src = config.fallback;
      el.load();
      if (onReady) onReady();
    }
  }

  // ==========================================
  //  自定义 hls.js Blob Loader
  //  拦截 m3u8 和 TS 文件的请求，从内存 Blob 返回
  // ==========================================
  function createBlobLoader(store) {
    return function (config) {
      var loader = new Hls.DefaultConfig.loader(config);
      var originalLoad = loader.load.bind(loader);

      loader.load = function (context, loaderConfig, callbacks) {
        var url = context.url;

        // 拦截 m3u8 请求
        if (url.indexOf('.m3u8') !== -1 && store.m3u8Text) {
          console.log('[HLS v11 BlobLoader] Serving m3u8 from memory');
          // 改写 m3u8 内容中的 TS 文件名为 Blob URL
          var rewrittenM3u8 = store.m3u8Text;
          if (store.tsBlobUrl && store.tsFileName) {
            rewrittenM3u8 = rewrittenM3u8.replace(store.tsFileName, store.tsBlobUrl);
          }
          var response = {
            url: url,
            data: rewrittenM3u8
          };
          var stats = {
            trequest: performance.now(),
            tfirst: performance.now(),
            tload: performance.now(),
            loaded: rewrittenM3u8.length,
            total: rewrittenM3u8.length
          };
          callbacks.onSuccess(response, stats, context, null);
          return;
        }

        // 拦截 TS 请求 — 如果 URL 是 Blob URL 或匹配 TS 文件名
        if ((url.indexOf('.ts') !== -1 || url.indexOf('blob:') === 0) && store.tsBlob) {
          console.log('[HLS v11 BlobLoader] Serving TS from Blob (' + (store.tsBlob.size / 1024 / 1024).toFixed(1) + ' MB)');
          
          // 处理 byte-range 请求
          var rangeStart = 0;
          var rangeEnd = store.tsBlob.size;
          if (context.rangeStart !== undefined && context.rangeEnd !== undefined) {
            rangeStart = context.rangeStart;
            rangeEnd = context.rangeEnd;
          }

          var slice = store.tsBlob.slice(rangeStart, rangeEnd);
          var reader = new FileReader();
          reader.onload = function () {
            var response = {
              url: url,
              data: reader.result
            };
            var stats = {
              trequest: performance.now(),
              tfirst: performance.now(),
              tload: performance.now(),
              loaded: slice.size,
              total: slice.size
            };
            callbacks.onSuccess(response, stats, context, null);
          };
          reader.onerror = function () {
            callbacks.onError({ code: 0, text: 'Blob read error' }, context, null, stats);
          };

          if (context.responseType === 'arraybuffer') {
            reader.readAsArrayBuffer(slice);
          } else {
            reader.readAsArrayBuffer(slice);
          }
          return;
        }

        // 其他请求走默认 loader
        originalLoad(context, loaderConfig, callbacks);
      };

      return loader;
    };
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
      console.log('[HLS v11] User interaction detected, unlocking media');

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
  //  主预加载系统 v11：缓存优先 + 断点续传
  // ==========================================
  var loadingComplete = false;
  var isRetrying = false;

  function preloadAllResourcesHLS() {
    var progressFill = document.querySelector('#loading-progress-fill');
    var progressText = document.querySelector('#loading-progress-text');
    var statusText = document.querySelector('#loading-status');
    var loadingOverlay = document.querySelector('#loading');
    var modeCards = document.querySelectorAll('.mode-card');

    // 确保 loading 遮罩可见
    if (loadingOverlay) {
      loadingOverlay.style.display = '';
      loadingOverlay.classList.remove('hidden');
    }
    modeCards.forEach(function (c) { c.style.pointerEvents = 'none'; });

    // iOS 媒体解锁
    unlockMediaOnInteraction();

    // 注入重试按钮
    ensureRetryButton();

    if (statusText) statusText.textContent = '🔍 检查缓存...';
    if (progressText) progressText.textContent = '正在检查本地缓存';
    hideRetryButton();

    // ========================================
    //  第 0 步：缓存完整性检查 — 全部命中则秒开
    // ========================================
    checkAllCached().then(function (cacheCheck) {
      if (cacheCheck.allCached) {
        console.log('[HLS v11] ✅ All files found in Cache API! Loading from cache...');
        if (statusText) statusText.textContent = '⚡ 从本地缓存加载中...';
        if (progressFill) progressFill.style.width = '80%';
        updateDownloadListUI('cached');

        // 从缓存恢复 blobStore
        var resourceIds = Object.keys(HLS_SOURCES);
        resourceIds.forEach(function (id) {
          var r = cacheCheck.results[id];
          blobStore[id] = {
            tsBlob: r.tsBlob,
            tsBlobUrl: URL.createObjectURL(r.tsBlob),
            tsFileName: HLS_SOURCES[id].ts.split('/').pop(),
            m3u8Text: r.m3u8Text
          };
        });

        // 直接初始化播放器
        return initPlayersAfterDownload(resourceIds, progressFill, progressText, statusText, loadingOverlay, modeCards, resourceIds.length * 2); // 全部缓存命中
      }

      // 部分命中或全不命中 → 正常下载流程（带断点续传）
      var cachedIds = [];
      var uncachedIds = [];
      var resourceIds = Object.keys(HLS_SOURCES);
      resourceIds.forEach(function (id) {
        var r = cacheCheck.results[id];
        if (r && r.cached && r.m3u8Cached) {
          cachedIds.push(id);
          // 预填 blobStore
          blobStore[id] = {
            tsBlob: r.tsBlob,
            tsBlobUrl: URL.createObjectURL(r.tsBlob),
            tsFileName: HLS_SOURCES[id].ts.split('/').pop(),
            m3u8Text: r.m3u8Text
          };
        } else {
          uncachedIds.push(id);
        }
      });

      if (cachedIds.length > 0) {
        console.log('[HLS v11] Partial cache hit: ' + cachedIds.join(', ') + ' from cache; downloading: ' + uncachedIds.join(', '));
      }

      return startDownloadFlow(resourceIds, cachedIds, progressFill, progressText, statusText, loadingOverlay, modeCards);
    });
  }

  // ==========================================
  //  下载流程（只下载未缓存的文件）
  // ==========================================
  function startDownloadFlow(resourceIds, cachedIds, progressFill, progressText, statusText, loadingOverlay, modeCards) {
    // 更新下载文件列表 UI
    updateDownloadListUI('preparing');

    console.log('[HLS v11] Starting download (with resume support)');

    // 收集需要下载的文件
    var downloads = [];
    resourceIds.forEach(function (id) {
      var config = HLS_SOURCES[id];
      if (cachedIds.indexOf(id) !== -1) return; // 已缓存，跳过
      downloads.push({ id: id, url: config.ts, type: 'ts', name: config.name, sizeMB: config.sizeMB });
      downloads.push({ id: id, url: config.hls, type: 'm3u8', name: config.name + ' 列表', sizeMB: 0 });
    });

    var totalEstimatedMB = 0;
    resourceIds.forEach(function (id) {
      if (cachedIds.indexOf(id) === -1) totalEstimatedMB += HLS_SOURCES[id].sizeMB;
    });

    var failedDownloads = [];
    var progressMap = {};
    var downloadedCount = 0;
    var totalDownloads = downloads.length;

    // 已缓存的文件计入进度
    var cachedMB = 0;
    cachedIds.forEach(function (id) {
      if (blobStore[id] && blobStore[id].tsBlob) {
        cachedMB += blobStore[id].tsBlob.size / 1024 / 1024;
      }
    });

    function updateProgressUI() {
      var totalLoaded = 0;
      var totalSize = 0;
      var keys = Object.keys(progressMap);
      for (var i = 0; i < keys.length; i++) {
        totalLoaded += progressMap[keys[i]].loaded;
        totalSize += progressMap[keys[i]].total;
      }

      var pct;
      if (totalSize > 0) {
        pct = Math.min(95, Math.round((totalLoaded / totalSize) * 95));
      } else {
        pct = Math.round((downloadedCount / Math.max(totalDownloads, 1)) * 80);
      }

      if (progressFill) progressFill.style.width = pct + '%';

      if (totalSize > 0) {
        var mbLoaded = (totalLoaded / 1024 / 1024).toFixed(1);
        var mbTotal = (totalSize / 1024 / 1024).toFixed(1);
        var cacheNote = cachedIds.length > 0 ? ' (+' + cachedMB.toFixed(0) + 'MB 缓存)' : '';
        if (progressText) progressText.textContent = mbLoaded + ' / ' + mbTotal + ' MB (' + pct + '%)' + cacheNote;
        if (statusText) statusText.textContent = '📥 正在下载媒体文件...';
      } else if (totalDownloads === 0) {
        if (progressText) progressText.textContent = '全部从缓存加载';
      } else {
        if (progressText) progressText.textContent = downloadedCount + '/' + totalDownloads + ' 文件 (' + pct + '%)';
        if (statusText) statusText.textContent = '📥 正在下载媒体文件...';
      }

      updateDownloadListUI('downloading');
    }

    if (totalDownloads === 0) {
      if (statusText) statusText.textContent = '⚡ 全部从缓存加载！';
      if (progressFill) progressFill.style.width = '90%';
    } else {
      if (statusText) statusText.textContent = '📥 准备下载 (~' + totalEstimatedMB + ' MB)...';
      if (progressText) progressText.textContent = '0 / ~' + totalEstimatedMB + ' MB';
    }
    hideRetryButton();
    updateProgressUI();

    // 加载 hls.js（并行）
    var hlsJsReady = loadHlsJs();

    // 并行下载所有未缓存的文件
    var cacheHitCount = cachedIds.length * 2; // 每个缓存命中的资源有 ts + m3u8
    var downloadPromises = downloads.map(function (dl) {
      return fetchWithProgress(dl.url, function (loaded, total) {
        progressMap[dl.url] = { loaded: loaded, total: total };
        updateProgressUI();
      }, 3).then(function (result) {
        downloadedCount++;
        if (result.fromCache) cacheHitCount++;

        if (!blobStore[dl.id]) blobStore[dl.id] = {};
        if (dl.type === 'ts') {
          blobStore[dl.id].tsBlob = result.blob;
          blobStore[dl.id].tsBlobUrl = URL.createObjectURL(result.blob);
          var parts = dl.url.split('/');
          blobStore[dl.id].tsFileName = parts[parts.length - 1];
          console.log('[HLS v11] ✓ TS ready: ' + dl.url + ' (' + (result.blob.size / 1024 / 1024).toFixed(1) + ' MB' + (result.fromCache ? ', cached' : '') + ')');
        } else if (dl.type === 'm3u8') {
          blobStore[dl.id].m3u8Blob = result.blob;
          return result.blob.text().then(function (text) {
            blobStore[dl.id].m3u8Text = text;
            console.log('[HLS v11] ✓ m3u8 ready: ' + dl.url);
          });
        }

        updateProgressUI();
        return { success: true };
      }).catch(function (err) {
        console.error('[HLS v11] ✗ Failed: ' + dl.url, err.message);
        failedDownloads.push(dl);
        return { success: false, error: err };
      });
    });

    // 等待所有下载完成
    Promise.all([hlsJsReady].concat(downloadPromises)).then(function () {
      if (loadingComplete) return;

      var criticalFailed = failedDownloads.filter(function (d) { return d.type === 'ts'; });

      if (criticalFailed.length > 0) {
        var failedNames = criticalFailed.map(function (d) { return d.name; });
        if (statusText) statusText.textContent = '❌ ' + criticalFailed.length + ' 个文件下载失败: ' + failedNames.join(', ');
        if (progressText) progressText.textContent = '下载失败，请重试（已下载部分已保存，重试可断点续传）';
        showRetryButton();
        updateDownloadListUI('error');
        return;
      }

      console.log('[HLS v11] ✅ All files ready! Initializing players...');
      initPlayersAfterDownload(resourceIds, progressFill, progressText, statusText, loadingOverlay, modeCards, cacheHitCount);
    });
  }

  // ==========================================
  //  播放器初始化（下载完成后统一调用）
  // ==========================================
  function initPlayersAfterDownload(resourceIds, progressFill, progressText, statusText, loadingOverlay, modeCards, cacheHitCount) {
    if (statusText) statusText.textContent = '⏳ 正在初始化播放器...';
    if (progressFill) progressFill.style.width = '96%';
    updateDownloadListUI('initializing');

    // 确保 hls.js 已加载
    loadHlsJs().then(function () {
      var setupCompleted = 0;
      var totalSetups = resourceIds.length;

      resourceIds.forEach(function (id) {
        setupPlayerFromBlob(id,
          function onReady() {
            setupCompleted++;
            console.log('[HLS v11] Player ready: ' + id + ' (' + setupCompleted + '/' + totalSetups + ')');
            if (setupCompleted >= totalSetups) {
              finishLoading(progressFill, progressText, statusText, loadingOverlay, modeCards, cacheHitCount);
            }
          },
          function onError() {
            setupCompleted++;
            console.warn('[HLS v11] Player setup had issues: ' + id);
            if (setupCompleted >= totalSetups) {
              finishLoading(progressFill, progressText, statusText, loadingOverlay, modeCards, cacheHitCount);
            }
          }
        );
      });

      // 超时保护
      setTimeout(function () {
        if (!loadingComplete) {
          console.warn('[HLS v11] Player init timeout, forcing entry');
          finishLoading(progressFill, progressText, statusText, loadingOverlay, modeCards, cacheHitCount);
        }
      }, 15000);
    });
  }

  // ==========================================
  //  下载文件列表 UI（增强版 — 含缓存状态）
  // ==========================================
  function updateDownloadListUI(phase) {
    var listContainer = document.querySelector('#download-file-list');
    if (!listContainer) return;

    var resourceIds = Object.keys(HLS_SOURCES);
    listContainer.innerHTML = '';

    resourceIds.forEach(function (id) {
      var config = HLS_SOURCES[id];
      var store = blobStore[id];
      var item = document.createElement('div');
      item.className = 'download-file-item';

      var icon = '📦';
      var status = '等待中';
      var statusClass = 'pending';

      if (phase === 'cached' && store && store.tsBlob) {
        icon = '⚡';
        status = (store.tsBlob.size / 1024 / 1024).toFixed(1) + ' MB 缓存';
        statusClass = 'done';
      } else if (phase === 'error' && (!store || !store.tsBlob)) {
        icon = '❌';
        status = '失败';
        statusClass = 'error';
      } else if (store && store.tsBlob) {
        icon = '✅';
        status = (store.tsBlob.size / 1024 / 1024).toFixed(1) + ' MB';
        statusClass = 'done';
      } else if (phase === 'downloading') {
        icon = '⏳';
        status = '下载中...';
        statusClass = 'downloading';
      } else if (phase === 'initializing') {
        icon = '⚙️';
        status = '初始化...';
        statusClass = 'init';
      }

      item.innerHTML = '<span class="dl-icon">' + icon + '</span>' +
        '<span class="dl-name">' + config.name + '</span>' +
        '<span class="dl-status ' + statusClass + '">' + status + '</span>';
      listContainer.appendChild(item);
    });
  }

  // ==========================================
  //  完成加载
  // ==========================================
  function finishLoading(progressFill, progressText, statusText, loadingOverlay, modeCards, cacheHitCount) {
    if (loadingComplete) return;
    loadingComplete = true;

    console.log('[HLS v11] ✅ All resources ready. Entering app!');

    var totalMB = 0;
    Object.keys(blobStore).forEach(function (id) {
      if (blobStore[id].tsBlob) totalMB += blobStore[id].tsBlob.size / 1024 / 1024;
    });

    var totalFiles = Object.keys(HLS_SOURCES).length * 2; // ts + m3u8 per resource

    if (statusText) {
      if (cacheHitCount >= totalFiles) {
        statusText.textContent = '⚡ 秒开！全部从缓存加载 (' + totalMB.toFixed(1) + ' MB)';
      } else if (cacheHitCount > 0) {
        statusText.textContent = '✅ 加载完成！(' + totalMB.toFixed(1) + ' MB, ' + Math.floor(cacheHitCount / 2) + ' 个从缓存)';
      } else {
        statusText.textContent = '✅ 下载完成！(' + totalMB.toFixed(1) + ' MB, 已缓存供下次秒开)';
      }
    }
    if (progressFill) progressFill.style.width = '100%';
    if (progressText) progressText.textContent = totalMB.toFixed(1) + ' MB 已就绪 (100%)';
    hideRetryButton();
    updateDownloadListUI('done');

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
    }, 800);
  }

  // ==========================================
  //  重试按钮管理
  // ==========================================
  function ensureRetryButton() {
    if (document.querySelector('#loading-retry-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'loading-retry-btn';
    btn.textContent = '🔄 断点续传';
    btn.style.cssText = 'display:none; margin-top:16px; padding:10px 28px; font-size:1rem; font-weight:700; color:#fff; background:linear-gradient(135deg,#FF6B6B,#4ECDC4); border:none; border-radius:30px; cursor:pointer; transition:transform 0.2s,box-shadow 0.2s; box-shadow:0 4px 15px rgba(78,205,196,0.3);';
    btn.addEventListener('mouseenter', function () { btn.style.transform = 'scale(1.05)'; });
    btn.addEventListener('mouseleave', function () { btn.style.transform = 'scale(1)'; });
    btn.addEventListener('click', function () {
      if (isRetrying) return;
      isRetrying = true;
      loadingComplete = false;
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
  //  兼容旧接口 setupHLS（app.js 不使用，但保持向后兼容）
  // ==========================================
  function setupHLS(elementId, onReady, onError) {
    setupPlayerFromBlob(elementId, onReady, onError);
  }

  // ==========================================
  //  销毁
  // ==========================================
  function destroyHLS(elementId) {
    if (hlsInstances[elementId]) {
      hlsInstances[elementId].destroy();
      delete hlsInstances[elementId];
    }
    // 释放 Blob URL
    if (blobStore[elementId] && blobStore[elementId].tsBlobUrl) {
      URL.revokeObjectURL(blobStore[elementId].tsBlobUrl);
    }
  }

  function destroyAllHLS() {
    Object.keys(hlsInstances).forEach(function (id) {
      hlsInstances[id].destroy();
      delete hlsInstances[id];
    });
    Object.keys(blobStore).forEach(function (id) {
      if (blobStore[id].tsBlobUrl) URL.revokeObjectURL(blobStore[id].tsBlobUrl);
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
    HLS_SOURCES: HLS_SOURCES,
    blobStore: blobStore
  };

})();
