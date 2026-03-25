/**
 * Six Little Ducks - HLS 媒体加载器 v2
 * 
 * 核心策略：预加载时用 fetch() 完整下载所有媒体文件到浏览器缓存，
 * 确保用户进入练习/表演模式前所有数据已在本地，播放零卡顿。
 * 
 * HLS 使用 single_file 模式（一个 ts + byte-range m3u8），
 * 所以只需下载 3 个 ts 文件 + 3 个 m3u8 文件。
 * 
 * iOS 兼容方案：
 * - iOS Safari 原生支持 HLS m3u8，预下载 ts 后浏览器会命中缓存
 * - 非 iOS 浏览器使用 hls.js polyfill，同样命中预下载的缓存
 * - 首次用户触摸/点击时解锁音视频播放权限
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
  //  HLS 源配置（single_file 模式：每种媒体 1 个 ts + 1 个 m3u8）
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

  /**
   * 动态加载 hls.js CDN
   */
  function loadHlsJs() {
    return new Promise((resolve) => {
      if (hlsJsLoaded) { resolve(); return; }
      hlsJsCallbacks.push(resolve);
      if (hlsJsLoading) return;
      hlsJsLoading = true;

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
      script.onload = function () {
        hlsJsLoaded = true;
        hlsJsLoading = false;
        console.log('[HLS] hls.js loaded successfully');
        hlsJsCallbacks.forEach(cb => cb());
        hlsJsCallbacks.length = 0;
      };
      script.onerror = function () {
        hlsJsLoading = false;
        console.warn('[HLS] Failed to load hls.js');
        hlsJsCallbacks.forEach(cb => cb());
        hlsJsCallbacks.length = 0;
      };
      document.head.appendChild(script);
    });
  }

  /**
   * 用 fetch 下载一个文件，返回进度回调
   * @param {string} url - 文件 URL
   * @param {Function} onProgress - 进度回调 (loaded, total)
   * @returns {Promise<Response>}
   */
  function fetchWithProgress(url, onProgress) {
    return fetch(url).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      
      const contentLength = response.headers.get('Content-Length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      if (!total || !response.body) {
        // Content-Length 不可用或不支持 ReadableStream，直接返回
        return response.blob().then(blob => {
          if (onProgress) onProgress(blob.size, blob.size);
          return blob;
        });
      }

      // 用 ReadableStream 跟踪下载进度
      const reader = response.body.getReader();
      let loaded = 0;
      const chunks = [];

      return new Promise((resolve, reject) => {
        function pump() {
          reader.read().then(({ done, value }) => {
            if (done) {
              const blob = new Blob(chunks);
              resolve(blob);
              return;
            }
            chunks.push(value);
            loaded += value.length;
            if (onProgress) onProgress(loaded, total);
            pump();
          }).catch(reject);
        }
        pump();
      });
    });
  }

  /**
   * 为一个 media 元素配置 HLS 源
   * 前提：ts 文件已经被预下载到浏览器缓存
   */
  function setupHLS(elementId, onReady, onError) {
    const config = HLS_SOURCES[elementId];
    if (!config) {
      console.warn('[HLS] Unknown element:', elementId);
      if (onError) onError();
      return;
    }

    const el = document.getElementById(elementId);
    if (!el) {
      console.warn('[HLS] Element not found:', elementId);
      if (onError) onError();
      return;
    }

    // iOS Safari 原生支持 HLS
    if (isIOSSafari || el.canPlayType('application/vnd.apple.mpegurl')) {
      console.log(`[HLS] ${elementId}: Using native HLS support`);
      el.src = config.hls;

      const onLoaded = function () {
        el.removeEventListener('loadedmetadata', onLoaded);
        el.removeEventListener('error', onErr);
        console.log(`[HLS] ${elementId}: Ready (native HLS)`);
        if (onReady) onReady();
      };
      const onErr = function () {
        el.removeEventListener('loadedmetadata', onLoaded);
        el.removeEventListener('error', onErr);
        console.warn(`[HLS] ${elementId}: Native HLS failed, using fallback`);
        el.src = config.fallback;
        el.load();
        if (onReady) onReady();
      };

      el.addEventListener('loadedmetadata', onLoaded);
      el.addEventListener('error', onErr);
      el.load();
      return;
    }

    // 非 iOS：使用 hls.js
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      console.log(`[HLS] ${elementId}: Using hls.js polyfill`);

      if (hlsInstances[elementId]) {
        hlsInstances[elementId].destroy();
      }

      const hls = new Hls({
        maxBufferLength: 120,      // 尽可能多地缓冲
        maxMaxBufferLength: 300,   // 允许缓冲整个文件
        maxBufferSize: 200 * 1024 * 1024,  // 200MB 缓冲区
        startPosition: 0,
        debug: false
      });

      hls.loadSource(config.hls);
      hls.attachMedia(el);

      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        console.log(`[HLS] ${elementId}: Manifest parsed (hls.js)`);
        if (onReady) onReady();
      });

      hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          console.warn(`[HLS] ${elementId}: Fatal hls.js error, using fallback`);
          hls.destroy();
          delete hlsInstances[elementId];
          el.src = config.fallback;
          el.load();
          if (onReady) onReady();
        }
      });

      hlsInstances[elementId] = hls;
    } else {
      // 极端降级：直接用原始文件
      console.log(`[HLS] ${elementId}: No HLS support, using fallback`);
      el.src = config.fallback;
      el.load();
      if (onReady) onReady();
    }
  }

  // ==========================================
  //  iOS 媒体解锁
  // ==========================================
  let mediaUnlocked = false;

  function unlockMediaOnInteraction() {
    if (mediaUnlocked) return;

    const unlock = function () {
      if (mediaUnlocked) return;
      mediaUnlocked = true;
      console.log('[HLS] User interaction detected, unlocking media');

      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('touchend', unlock, true);
      document.removeEventListener('click', unlock, true);

      const mediaElements = document.querySelectorAll('audio, video');
      mediaElements.forEach(el => {
        const playPromise = el.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            el.pause();
            el.currentTime = 0;
            console.log(`[HLS] Unlocked: ${el.id || el.tagName}`);
          }).catch(() => {});
        }
      });
    };

    document.addEventListener('touchstart', unlock, { capture: true, passive: true });
    document.addEventListener('touchend', unlock, { capture: true, passive: true });
    document.addEventListener('click', unlock, { capture: true, passive: true });
  }

  // ==========================================
  //  预加载系统 v2：完整下载所有文件后才放行
  // ==========================================

  /**
   * 预加载所有媒体资源 — 确保所有 ts+m3u8 文件完整下载后才允许进入
   * 
   * 流程：
   * 1. 先下载 hls.js（非 iOS）
   * 2. 并行 fetch 下载所有 ts 文件（有进度条）
   * 3. 同时下载所有 m3u8 文件
   * 4. 全部下载完成后，配置各媒体元素的 HLS 源
   * 5. 等待所有媒体元素 ready 后，解除加载遮罩
   */
  function preloadAllResourcesHLS() {
    const progressFill = document.querySelector('#loading-progress-fill');
    const progressText = document.querySelector('#loading-progress-text');
    const statusText = document.querySelector('#loading-status');
    const modeCards = document.querySelectorAll('.mode-card');

    // 禁用模式卡片
    modeCards.forEach(c => c.style.pointerEvents = 'none');

    // 开始 iOS 媒体解锁监听
    unlockMediaOnInteraction();

    const resourceIds = Object.keys(HLS_SOURCES);

    // 收集所有需要下载的文件
    const downloads = [];
    resourceIds.forEach(id => {
      const config = HLS_SOURCES[id];
      downloads.push({ id: id, url: config.ts, type: 'ts', name: config.name });
      downloads.push({ id: id, url: config.hls, type: 'm3u8', name: config.name });
    });

    // 进度跟踪
    const progressMap = {};  // url -> { loaded, total }
    let totalBytes = 0;
    let loadedBytes = 0;
    let filesCompleted = 0;
    const totalFiles = downloads.length;

    function updateProgressUI() {
      // 按文件数计算百分比（更可靠，因为 Content-Length 可能不可用）
      const pct = Math.round((filesCompleted / totalFiles) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressText) {
        progressText.textContent = `${filesCompleted}/${totalFiles} 文件已下载 (${pct}%)`;
      }
    }

    function updateDetailProgress(url, loaded, total) {
      progressMap[url] = { loaded, total };
      // 计算总字节进度
      let tl = 0, tt = 0;
      Object.values(progressMap).forEach(p => {
        tl += p.loaded;
        tt += p.total;
      });
      loadedBytes = tl;
      totalBytes = tt;

      if (totalBytes > 0 && statusText) {
        const mbLoaded = (loadedBytes / 1024 / 1024).toFixed(1);
        const mbTotal = (totalBytes / 1024 / 1024).toFixed(1);
        statusText.textContent = `⏳ 正在下载媒体文件 ${mbLoaded}/${mbTotal} MB...`;
      }
    }

    // 超时保护（90 秒 — 需要下载约 160MB）
    let allReady = false;
    const forceTimer = setTimeout(() => {
      if (!allReady) {
        console.warn('[HLS] Download timeout (90s), forcing entry');
        finishLoading('⚠️ 部分资源可能仍在加载，播放时可能短暂缓冲...');
      }
    }, 90000);

    function finishLoading(message) {
      if (allReady) return;
      allReady = true;
      clearTimeout(forceTimer);

      if (statusText) statusText.textContent = message || '✅ 所有资源下载完成！';
      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = `${totalFiles}/${totalFiles} 文件已下载 (100%)`;

      modeCards.forEach(c => c.style.pointerEvents = '');
      setTimeout(() => {
        const overlay = document.querySelector('#loading');
        if (overlay) {
          overlay.classList.add('hidden');
          setTimeout(() => overlay.style.display = 'none', 600);
        }
      }, 600);
    }

    if (statusText) statusText.textContent = '⏳ 正在下载媒体文件...';
    updateProgressUI();

    // 第 1 步：非 iOS 先加载 hls.js
    const hlsJsReady = isIOSSafari ? Promise.resolve() : loadHlsJs();

    // 第 2 步：并行下载所有文件（ts + m3u8）
    const downloadPromises = downloads.map(dl => {
      return fetchWithProgress(dl.url, (loaded, total) => {
        updateDetailProgress(dl.url, loaded, total);
      }).then(blob => {
        filesCompleted++;
        console.log(`[HLS] Downloaded: ${dl.url} (${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
        updateProgressUI();
        return { ...dl, blob };
      }).catch(err => {
        filesCompleted++;
        console.warn(`[HLS] Download failed: ${dl.url}`, err);
        updateProgressUI();
        return { ...dl, error: err };
      });
    });

    // 第 3 步：等待所有下载 + hls.js 加载完成
    Promise.all([hlsJsReady, ...downloadPromises]).then(results => {
      if (allReady) return;  // 已超时跳过

      const downloadResults = results.slice(1);
      const failedCount = downloadResults.filter(r => r.error).length;

      if (failedCount > 0) {
        console.warn(`[HLS] ${failedCount}/${totalFiles} downloads failed`);
      }

      if (statusText) statusText.textContent = '⏳ 正在初始化播放器...';

      // 第 4 步：配置各媒体元素的 HLS 源
      let setupCompleted = 0;
      const totalSetups = resourceIds.length;

      resourceIds.forEach(id => {
        setupHLS(id,
          function onReady() {
            setupCompleted++;
            console.log(`[HLS] ${id}: Player ready (${setupCompleted}/${totalSetups})`);
            if (setupCompleted >= totalSetups) {
              finishLoading('✅ 所有资源下载完成！可以开始了');
            }
          },
          function onError() {
            setupCompleted++;
            console.warn(`[HLS] ${id}: Setup failed`);
            if (setupCompleted >= totalSetups) {
              finishLoading('⚠️ 部分资源加载失败，但可以尝试播放');
            }
          }
        );
      });

      // 播放器初始化超时（10 秒）
      setTimeout(() => {
        if (!allReady) {
          console.warn('[HLS] Player init timeout, forcing entry');
          finishLoading('✅ 资源已下载，播放器准备就绪');
        }
      }, 10000);
    });
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
    Object.keys(hlsInstances).forEach(id => {
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
