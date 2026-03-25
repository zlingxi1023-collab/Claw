/**
 * Six Little Ducks - HLS 媒体加载器
 * 
 * 解决 iOS/iPad 上 preload="auto" 不生效的问题：
 * - iOS Safari 原生支持 HLS (m3u8)，直接使用 <source type="application/vnd.apple.mpegurl">
 * - 非 iOS 浏览器使用 hls.js 库 polyfill
 * - 用户首次触摸/点击时主动触发加载，绕过 iOS 自动播放限制
 * - 预加载采用 "元数据优先 + 用户交互后全量" 策略
 */

(function () {
  'use strict';

  // ==========================================
  //  平台检测
  // ==========================================
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isIOSSafari = isIOS; // iOS 上所有浏览器都是 WebKit

  // ==========================================
  //  HLS 源配置
  // ==========================================
  const HLS_SOURCES = {
    'perf-video': {
      hls: 'media/hls/video-muted/index.m3u8',
      fallback: 'media/six-little-ducks-video-muted.mp4',
      type: 'video'
    },
    'prac-video': {
      hls: 'media/hls/video/index.m3u8',
      fallback: 'media/six-little-ducks-video.mp4',
      type: 'video'
    },
    'perf-audio': {
      hls: 'media/hls/audio/index.m3u8',
      fallback: 'media/six-little-ducks-instrumental-extracted.mp3',
      type: 'audio'
    }
  };

  // ==========================================
  //  HLS 实例管理
  // ==========================================
  const hlsInstances = {};  // id -> Hls instance
  let hlsJsLoaded = false;
  let hlsJsLoading = false;
  const hlsJsCallbacks = [];

  /**
   * 动态加载 hls.js CDN
   */
  function loadHlsJs(callback) {
    if (hlsJsLoaded) { callback(); return; }
    hlsJsCallbacks.push(callback);
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
      console.warn('[HLS] Failed to load hls.js, will use fallback sources');
      hlsJsCallbacks.forEach(cb => cb());
      hlsJsCallbacks.length = 0;
    };
    document.head.appendChild(script);
  }

  /**
   * 为一个 media 元素配置 HLS 源
   * @param {string} elementId - 元素 ID（如 'perf-video'）
   * @param {Function} onReady - 加载就绪回调
   * @param {Function} onError - 加载失败回调
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

      // iOS 上不能依赖 canplaythrough，用 loadedmetadata 作为就绪信号
      const onMetadata = function () {
        el.removeEventListener('loadedmetadata', onMetadata);
        el.removeEventListener('error', onErr);
        console.log(`[HLS] ${elementId}: Metadata loaded (native)`);
        if (onReady) onReady();
      };
      const onErr = function (e) {
        el.removeEventListener('loadedmetadata', onMetadata);
        el.removeEventListener('error', onErr);
        console.warn(`[HLS] ${elementId}: Native HLS error, falling back to direct file`);
        el.src = config.fallback;
        el.load();
        if (onReady) onReady(); // 降级后也算就绪
      };

      el.addEventListener('loadedmetadata', onMetadata);
      el.addEventListener('error', onErr);
      el.load();
      return;
    }

    // 非 iOS：使用 hls.js
    loadHlsJs(function () {
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        console.log(`[HLS] ${elementId}: Using hls.js polyfill`);
        
        // 销毁旧实例
        if (hlsInstances[elementId]) {
          hlsInstances[elementId].destroy();
        }

        const hls = new Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
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
            console.warn(`[HLS] ${elementId}: Fatal hls.js error, falling back`);
            hls.destroy();
            delete hlsInstances[elementId];
            // 降级到直接播放
            el.src = config.fallback;
            el.load();
            if (onReady) onReady();
          }
        });

        hlsInstances[elementId] = hls;
      } else {
        // hls.js 不支持（极少见），直接用 fallback
        console.log(`[HLS] ${elementId}: hls.js not supported, using fallback`);
        el.src = config.fallback;
        el.load();

        const onCanPlay = function () {
          el.removeEventListener('canplaythrough', onCanPlay);
          if (onReady) onReady();
        };
        el.addEventListener('canplaythrough', onCanPlay);
        if (onReady) setTimeout(onReady, 3000); // 超时保底
      }
    });
  }

  /**
   * iOS 上需要用户交互才能播放音视频。
   * 此函数在首次用户交互时对所有 media 元素执行一次 play+pause "解锁"。
   */
  let mediaUnlocked = false;

  function unlockMediaOnInteraction() {
    if (mediaUnlocked) return;

    const unlock = function () {
      if (mediaUnlocked) return;
      mediaUnlocked = true;
      console.log('[HLS] User interaction detected, unlocking media elements');

      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('touchend', unlock, true);
      document.removeEventListener('click', unlock, true);

      // 对所有 audio/video 元素执行 play+pause 解锁
      const mediaElements = document.querySelectorAll('audio, video');
      mediaElements.forEach(el => {
        // 创建一个静默的播放解锁
        const playPromise = el.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            el.pause();
            el.currentTime = 0;
            console.log(`[HLS] Unlocked: ${el.id || el.tagName}`);
          }).catch(() => {
            // 可能还不够条件播放，忽略
          });
        }
      });
    };

    // 监听多种交互事件确保覆盖
    document.addEventListener('touchstart', unlock, { capture: true, once: false, passive: true });
    document.addEventListener('touchend', unlock, { capture: true, once: false, passive: true });
    document.addEventListener('click', unlock, { capture: true, once: false, passive: true });
  }

  // ==========================================
  //  预加载系统（替换原有的 preloadAllResources）
  // ==========================================

  /**
   * 预加载所有媒体资源（HLS 版本）
   * - 非 iOS：加载 hls.js 然后初始化所有 HLS 流
   * - iOS：仅加载元数据，等待用户交互后再全量加载
   */
  function preloadAllResourcesHLS() {
    const progressFill = document.querySelector('#loading-progress-fill');
    const progressText = document.querySelector('#loading-progress-text');
    const statusText = document.querySelector('#loading-status');
    const modeCards = document.querySelectorAll('.mode-card');

    // 禁用模式卡片点击
    modeCards.forEach(c => c.style.pointerEvents = 'none');

    const resourceIds = Object.keys(HLS_SOURCES);
    let loaded = 0;
    const total = resourceIds.length;
    let allReady = false;

    function updateProgress() {
      const pct = Math.round((loaded / total) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressText) progressText.textContent = `${loaded}/${total} 资源已加载 (${pct}%)`;
    }

    function checkAllLoaded() {
      if (allReady) return;
      if (loaded >= total) {
        allReady = true;
        if (statusText) statusText.textContent = '✅ 资源加载完成！';
        if (progressFill) progressFill.style.width = '100%';
        modeCards.forEach(c => c.style.pointerEvents = '');
        setTimeout(() => {
          const overlay = document.querySelector('#loading');
          if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => overlay.style.display = 'none', 600);
          }
        }, 500);
      }
    }

    // 超时保护 - iOS 上缩短到 8 秒（因为只加载元数据很快）
    const timeout = isIOS ? 8000 : 20000;
    const forceTimer = setTimeout(() => {
      if (!allReady) {
        console.warn('[HLS] Preload timeout, forcing entry.');
        allReady = true;
        loaded = total;
        updateProgress();
        if (statusText) statusText.textContent = isIOS
          ? '✅ 准备就绪（资源将在播放时加载）'
          : '⚠️ 部分资源仍在加载...';
        modeCards.forEach(c => c.style.pointerEvents = '');
        setTimeout(() => {
          const overlay = document.querySelector('#loading');
          if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => overlay.style.display = 'none', 600);
          }
        }, 500);
      }
    }, timeout);

    // 开始解锁 iOS 媒体播放
    unlockMediaOnInteraction();

    // 初始化每个 HLS 源
    resourceIds.forEach(id => {
      const config = HLS_SOURCES[id];
      if (statusText && !allReady) {
        statusText.textContent = `⏳ 正在加载 ${config.type === 'audio' ? '伴奏音频' : '视频'}...`;
      }

      setupHLS(id,
        function onReady() {
          loaded++;
          const name = config.type === 'audio' ? '伴奏音频'
            : id.includes('muted') ? '表演视频' : '练习视频';
          if (statusText && !allReady) statusText.textContent = `✓ ${name} 加载完成`;
          updateProgress();
          checkAllLoaded();
        },
        function onError() {
          loaded++;
          console.warn(`[HLS] Failed to load: ${id}`);
          updateProgress();
          checkAllLoaded();
        }
      );
    });

    updateProgress();
  }

  /**
   * 销毁指定元素的 HLS 实例（页面卸载时调用）
   */
  function destroyHLS(elementId) {
    if (hlsInstances[elementId]) {
      hlsInstances[elementId].destroy();
      delete hlsInstances[elementId];
    }
  }

  function destroyAllHLS() {
    Object.keys(hlsInstances).forEach(id => {
      hlsInstances[id].destroy();
    });
    Object.keys(hlsInstances).forEach(id => delete hlsInstances[id]);
  }

  // ==========================================
  //  导出到全局作用域
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
