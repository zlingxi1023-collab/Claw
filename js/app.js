/**
 * Six Little Ducks - 应用主控制器
 * SVG 动画鸭子角色 + 精确歌词同步 + 动作编排可视化
 */
(function () {
  'use strict';

  let currentMode = null;
  let selectedRole = null;
  let perfEngine = null;
  let pracEngine = null;

  // 播放倍速选项
  const SPEED_OPTIONS = [0.5, 0.75, 0.8, 1];
  let currentSpeedIndex = 3; // 默认1x（索引3）

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const modeSelector = $('#mode-selector');
  const performanceMode = $('#performance-mode');
  const practiceMode = $('#practice-mode');
  const loadingOverlay = $('#loading');

  // ==========================================
  //  初始化
  // ==========================================
  function init() {
    generateTitleDucks();
    generateRoleButtons();
    generatePerfDuckStage();
    generatePracDuckStrip();
    generateToolbarRolePicker();
    generatePerfToolbarRolePicker();
    generateBgBubbles();

    bindModeCardEvents();
    bindPerformanceEvents();
    bindPracticeEvents();
    bindABLoopEvents();

    renderPerformanceLyrics();
    renderPracticeLyrics();
    initFormationStage();
    initPerfFormationStage();

    perfEngine = new LyricEngine();
    pracEngine = new LyricEngine();

    // 预加载所有媒体资源（使用 HLS 加载器）
    if (window.HLSLoader) {
      window.HLSLoader.preloadAllResourcesHLS();
    } else {
      preloadAllResources();
    }

    // URL 参数直接进入指定模式
    // 支持: ?mode=perform / ?mode=performance → 表演模式
    //        ?mode=practice → 练习模式
    //        ?role=duck1 ~ duck6 → 预选角色
    handleURLParams();
  }

  // ==========================================
  //  URL 参数路由
  //  ?mode=perform|performance → 直接进入表演模式
  //  ?mode=practice           → 直接进入练习模式
  //  ?role=duck1~duck6        → 预选角色
  // ==========================================
  function handleURLParams() {
    const params = new URLSearchParams(window.location.search);
    const modeParam = (params.get('mode') || '').toLowerCase();
    const roleParam = (params.get('role') || '').toLowerCase();

    // 预选角色
    if (roleParam && DUCK_ROLES[roleParam]) {
      selectRole(roleParam);
    }

    // 直接进入对应模式（等加载完成后切换）
    if (modeParam === 'perform' || modeParam === 'performance') {
      waitForLoadingThen(() => switchMode('performance'));
    } else if (modeParam === 'practice') {
      waitForLoadingThen(() => switchMode('practice'));
    }
  }

  function waitForLoadingThen(callback) {
    // 如果加载已完成（loading overlay 已隐藏），立即执行
    if (loadingOverlay.classList.contains('hidden') || loadingOverlay.style.display === 'none') {
      callback();
      return;
    }
    // 否则用 MutationObserver 监听加载完成
    const observer = new MutationObserver(() => {
      if (loadingOverlay.classList.contains('hidden') || loadingOverlay.style.display === 'none') {
        observer.disconnect();
        callback();
      }
    });
    observer.observe(loadingOverlay, { attributes: true, attributeFilter: ['class', 'style'] });

    // 安全兜底：最多等 15 秒，强制切换
    setTimeout(() => {
      observer.disconnect();
      if (!currentMode) callback();
    }, 15000);
  }

  // ==========================================
  //  资源预加载系统 (Fallback - 仅在 HLS 加载器不可用时使用)
  //  即使 fallback 模式也必须等待媒体文件可用后才放行
  // ==========================================
  function preloadAllResources() {
    const progressFill = $('#loading-progress-fill');
    const progressText = $('#loading-progress-text');
    const statusText = $('#loading-status');
    const modeCards = $$('.mode-card');

    // 禁用模式卡片点击
    modeCards.forEach(c => c.style.pointerEvents = 'none');

    if (statusText) statusText.textContent = '⏳ 正在加载媒体文件...';

    // 即使没有 HLS 加载器，也要确保 fallback 媒体文件可以加载
    const mediaSources = [
      'media/six-little-ducks-video-muted.mp4',
      'media/six-little-ducks-video.mp4',
      'media/six-little-ducks-instrumental-extracted.mp3'
    ];

    let loadedCount = 0;
    const totalCount = mediaSources.length;

    function checkAllLoaded() {
      loadedCount++;
      const pct = Math.round((loadedCount / totalCount) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressText) progressText.textContent = loadedCount + '/' + totalCount + ' (' + pct + '%)';

      if (loadedCount >= totalCount) {
        if (statusText) statusText.textContent = '✅ 加载完成！';
        modeCards.forEach(c => c.style.pointerEvents = '');
        setTimeout(() => {
          loadingOverlay.classList.add('hidden');
          setTimeout(() => loadingOverlay.style.display = 'none', 600);
        }, 500);
      }
    }

    // 用 HEAD 请求验证每个文件可访问
    mediaSources.forEach(url => {
      fetch(url, { method: 'HEAD' })
        .then(resp => {
          if (resp.ok) {
            console.log('[Fallback] ✓ Accessible: ' + url);
          } else {
            console.warn('[Fallback] ✗ Not accessible: ' + url + ' (HTTP ' + resp.status + ')');
          }
          checkAllLoaded();
        })
        .catch(err => {
          console.warn('[Fallback] ✗ Error checking: ' + url, err);
          checkAllLoaded();
        });
    });
  }

  // ==========================================
  //  标题页6只鸭子
  // ==========================================
  function generateTitleDucks() {
    const container = $('#title-ducks');
    Object.entries(DUCK_ROLES).forEach(([key, role]) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'title-duck-wrapper';
      wrapper.innerHTML = createDuckSVG(key, 50);
      container.appendChild(wrapper);
    });
  }

  // ==========================================
  //  角色选择按钮 (SVG 鸭子)
  // ==========================================
  function generateRoleButtons() {
    const container = $('#role-buttons');
    Object.entries(DUCK_ROLES).forEach(([key, role]) => {
      const btn = document.createElement('button');
      btn.className = 'role-btn';
      btn.dataset.role = key;
      btn.style.setProperty('--btn-color', role.color);
      btn.innerHTML = `
        <div class="duck-avatar">${createDuckSVG(key, 42)}</div>
        <span class="role-label">${role.name}</span>
      `;
      btn.addEventListener('click', () => selectRole(key));
      container.appendChild(btn);
    });
  }

  // ==========================================
  //  表演模式 - 鸭子条（与练习模式相同样式）
  // ==========================================
  function generatePerfDuckStage() {
    const strip = $('#perf-duck-stage');
    Object.entries(DUCK_ROLES).forEach(([key, role]) => {
      const mini = document.createElement('div');
      mini.className = 'prac-duck-mini';
      mini.dataset.role = key;
      mini.style.setProperty('--mini-color', role.color);
      mini.innerHTML = createDuckSVG(key, 32);
      strip.appendChild(mini);
    });
  }

  // ==========================================
  //  练习模式 - 鸭子条
  // ==========================================
  function generatePracDuckStrip() {
    const strip = $('#prac-duck-strip');
    Object.entries(DUCK_ROLES).forEach(([key, role]) => {
      const mini = document.createElement('div');
      mini.className = 'prac-duck-mini';
      mini.dataset.role = key;
      mini.style.setProperty('--mini-color', role.color);
      mini.innerHTML = createDuckSVG(key, 32);
      strip.appendChild(mini);
    });
  }

  // ==========================================
  //  工具栏角色选择 (小圆点)
  // ==========================================
  function generateToolbarRolePicker() {
    const picker = $('#toolbar-role-picker');
    // "全部"按钮
    const allDot = document.createElement('div');
    allDot.className = 'toolbar-role-dot active';
    allDot.style.color = '#888';
    allDot.style.background = 'rgba(255,255,255,0.1)';
    allDot.textContent = '全';
    allDot.style.fontSize = '9px';
    allDot.style.fontWeight = '700';
    allDot.dataset.role = '';
    allDot.addEventListener('click', () => selectRole(null));
    picker.appendChild(allDot);

    Object.entries(DUCK_ROLES).forEach(([key, role]) => {
      const dot = document.createElement('div');
      dot.className = 'toolbar-role-dot';
      dot.dataset.role = key;
      dot.style.color = role.color;
      dot.style.background = `color-mix(in srgb, ${role.color} 20%, transparent)`;
      dot.innerHTML = createDuckSVG(key, 18);
      dot.addEventListener('click', () => selectRole(key));
      picker.appendChild(dot);
    });
  }

  // ==========================================
  //  表演模式 - 工具栏角色选择 (小圆点)
  // ==========================================
  function generatePerfToolbarRolePicker() {
    const picker = $('#perf-toolbar-role-picker');
    if (!picker) return;
    // "全部"按钮
    const allDot = document.createElement('div');
    allDot.className = 'toolbar-role-dot active';
    allDot.style.color = '#888';
    allDot.style.background = 'rgba(255,255,255,0.1)';
    allDot.textContent = '全';
    allDot.style.fontSize = '9px';
    allDot.style.fontWeight = '700';
    allDot.dataset.role = '';
    allDot.addEventListener('click', () => selectRole(null));
    picker.appendChild(allDot);

    Object.entries(DUCK_ROLES).forEach(([key, role]) => {
      const dot = document.createElement('div');
      dot.className = 'toolbar-role-dot';
      dot.dataset.role = key;
      dot.style.color = role.color;
      dot.style.background = `color-mix(in srgb, ${role.color} 20%, transparent)`;
      dot.innerHTML = createDuckSVG(key, 18);
      dot.addEventListener('click', () => selectRole(key));
      picker.appendChild(dot);
    });
  }

  // ==========================================
  //  背景装饰
  // ==========================================
  function generateBgBubbles() {
    const container = $('#selector-bubbles');
    if (!container) return;
    const colors = Object.values(DUCK_ROLES).map(r => r.color);
    // 更大更饱满的气泡
    for (let i = 0; i < 18; i++) {
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      const size = 50 + Math.random() * 160;
      bubble.style.width = size + 'px';
      bubble.style.height = size + 'px';
      bubble.style.left = Math.random() * 100 + '%';
      bubble.style.top = Math.random() * 100 + '%';
      bubble.style.background = colors[Math.floor(Math.random() * colors.length)];
      bubble.style.opacity = (0.08 + Math.random() * 0.18).toFixed(2);
      bubble.style.setProperty('--duration', (5 + Math.random() * 8) + 's');
      bubble.style.setProperty('--delay', Math.random() * 5 + 's');
      bubble.style.setProperty('--float-y', (-15 - Math.random() * 35) + 'px');
      bubble.style.filter = 'blur(' + (1 + Math.random() * 2).toFixed(1) + 'px)';
      container.appendChild(bubble);
    }

    // 可爱装饰元素（星星、爱心、音符）
    const modeSelector = $('#mode-selector');
    if (!modeSelector) return;
    const cuteEmojis = ['⭐', '💛', '🌟', '💕', '🎵', '✨', '🌸', '🎀', '💫', '🦋'];
    for (let i = 0; i < 12; i++) {
      const deco = document.createElement('div');
      deco.className = 'cute-decoration';
      deco.textContent = cuteEmojis[Math.floor(Math.random() * cuteEmojis.length)];
      deco.style.left = (5 + Math.random() * 90) + '%';
      deco.style.top = (5 + Math.random() * 85) + '%';
      deco.style.fontSize = (0.8 + Math.random() * 1.0) + 'rem';
      deco.style.animationDelay = (Math.random() * 3) + 's';
      deco.style.animationDuration = (1.5 + Math.random() * 2) + 's';
      modeSelector.appendChild(deco);
    }
  }

  // ==========================================
  //  角色选择
  // ==========================================
  function selectRole(role) {
    selectedRole = role || null;

    // 更新模式选择页的按钮
    $$('.role-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.role === selectedRole);
    });

    // 更新所有工具栏圆点（两个模式共用 toolbar-role-dot 类）
    $$('.toolbar-role-dot').forEach(d => {
      d.classList.toggle('active', d.dataset.role === (selectedRole || ''));
    });

    if (perfEngine) perfEngine.setRole(selectedRole);
    if (pracEngine) pracEngine.setRole(selectedRole);
    updatePracticeLyricsHighlight();
    updatePerfLyricsHighlight();
  }

  // ==========================================
  //  模式切换
  // ==========================================
  function bindModeCardEvents() {
    $('#btn-performance').addEventListener('click', () => switchMode('performance'));
    $('#btn-practice').addEventListener('click', () => switchMode('practice'));
  }

  let perfEngineInited = false;
  let pracEngineInited = false;

  function switchMode(mode) {
    if (perfEngine && perfEngine.mediaElement) perfEngine.mediaElement.pause();
    if (pracEngine && pracEngine.mediaElement) pracEngine.mediaElement.pause();

    currentMode = mode;
    modeSelector.style.display = 'none';

    if (mode === 'performance') {
      performanceMode.classList.add('active');
      practiceMode.classList.remove('active');
      const audio = $('#perf-audio');
      const video = $('#perf-video');

      if (!perfEngineInited) {
        perfEngine.init(audio, 'performance');
        setupPlayPauseIcons('#perf-play-btn', audio);
        syncPerfVideo(audio, video);
        perfEngineInited = true;
        // 应用当前倍速
        const rate = SPEED_OPTIONS[currentSpeedIndex];
        if (rate !== 1) {
          perfEngine.setPlaybackRate(rate);
          video.playbackRate = rate;
        }
      }

      perfEngine.setRole(selectedRole);
      perfEngine.onLyricChange = onPerfLyricChange;
      perfEngine.onTimeUpdate = onPerfTimeUpdate;
      perfEngine.onActionChange = onPerfActionChange;
      perfEngine.onFormationChange = onPerfFormationChange;
      updatePerfLyricsHighlight();

    } else {
      practiceMode.classList.add('active');
      performanceMode.classList.remove('active');
      const video = $('#prac-video');

      if (!pracEngineInited) {
        pracEngine.init(video, 'practice');
        setupPlayPauseIcons('#prac-play-btn', video);
        pracEngineInited = true;
        // 应用当前倍速
        const rate = SPEED_OPTIONS[currentSpeedIndex];
        if (rate !== 1) {
          pracEngine.setPlaybackRate(rate);
        }
      }

      pracEngine.setRole(selectedRole);
      pracEngine.onLyricChange = onPracLyricChange;
      pracEngine.onTimeUpdate = onPracTimeUpdate;
      pracEngine.onActionChange = onPracActionChange;
      pracEngine.onFormationChange = onPracFormationChange;
      pracEngine.onLoopChange = onPracLoopChange;
    }
  }

  // ==========================================
  //  表演模式 - 视频与伴奏同步
  // ==========================================
  let perfVideoSyncBound = false;

  function syncPerfVideo(audio, video) {
    if (perfVideoSyncBound) return;
    perfVideoSyncBound = true;

    // 伴奏播放时同步启动视频
    audio.addEventListener('play', () => {
      video.currentTime = audio.currentTime;
      video.playbackRate = audio.playbackRate; // 同步倍速
      video.play().catch(() => {});
    });

    // 伴奏暂停时同步暂停视频
    audio.addEventListener('pause', () => {
      video.pause();
    });

    // 伴奏跳转时同步视频位置
    audio.addEventListener('seeked', () => {
      video.currentTime = audio.currentTime;
    });

    // 定期校正视频时间（防止漂移）
    let syncInterval = null;
    audio.addEventListener('play', () => {
      syncInterval = setInterval(() => {
        if (Math.abs(video.currentTime - audio.currentTime) > 0.3) {
          video.currentTime = audio.currentTime;
        }
      }, 2000);
    });
    audio.addEventListener('pause', () => {
      if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
    });
    audio.addEventListener('ended', () => {
      if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
      video.pause();
    });
  }

  // ==========================================
  //  播放倍速切换
  // ==========================================
  function cyclePlaybackSpeed(mode) {
    currentSpeedIndex = (currentSpeedIndex + 1) % SPEED_OPTIONS.length;
    const rate = SPEED_OPTIONS[currentSpeedIndex];

    // 更新两个引擎的播放倍速（保持同步）
    if (perfEngine) {
      perfEngine.setPlaybackRate(rate);
      // 表演模式：视频也需要同步倍速
      const perfVideo = $('#perf-video');
      if (perfVideo) perfVideo.playbackRate = rate;
    }
    if (pracEngine) {
      pracEngine.setPlaybackRate(rate);
    }

    // 更新所有倍速按钮的显示
    updateSpeedButtonLabels(rate);
  }

  function updateSpeedButtonLabels(rate) {
    const label = rate === 1 ? '1x' : rate + 'x';
    const perfLabel = $('#perf-speed-btn .speed-label');
    const pracLabel = $('#prac-speed-btn .speed-label');
    if (perfLabel) perfLabel.textContent = label;
    if (pracLabel) pracLabel.textContent = label;

    // 非1x时高亮按钮
    const perfBtn = $('#perf-speed-btn');
    const pracBtn = $('#prac-speed-btn');
    if (perfBtn) perfBtn.classList.toggle('speed-active', rate !== 1);
    if (pracBtn) pracBtn.classList.toggle('speed-active', rate !== 1);
  }

  function setupPlayPauseIcons(btnSelector, media) {
    const btn = $(btnSelector);
    const iconPlay = btn.querySelector('.icon-play');
    const iconPause = btn.querySelector('.icon-pause');
    media.addEventListener('play', () => {
      iconPlay.style.display = 'none';
      iconPause.style.display = '';
    });
    media.addEventListener('pause', () => {
      iconPlay.style.display = '';
      iconPause.style.display = 'none';
    });
  }

  function goBack() {
    if (currentMode === 'performance') {
      if (perfEngine.mediaElement) perfEngine.mediaElement.pause();
      const perfVideo = $('#perf-video');
      if (perfVideo) perfVideo.pause();
    }
    if (currentMode === 'practice' && pracEngine.mediaElement) pracEngine.mediaElement.pause();
    if (isFullscreen()) {
      (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen).call(document);
    }

    currentMode = null;
    performanceMode.classList.remove('active');
    practiceMode.classList.remove('active');
    modeSelector.style.display = '';
  }

  // ==========================================
  //  表演模式 - 歌词渲染（列表样式，与练习模式一致）
  // ==========================================
  function renderPerformanceLyrics() {
    const container = $('#perf-lyrics-area');
    container.innerHTML = '';

    LYRICS_DATA.forEach((line, index) => {
      const div = document.createElement('div');
      div.className = 'practice-lyric-line perf-lyric-item';
      div.dataset.index = index;

      // 角色指示器
      const indicator = document.createElement('div');
      indicator.className = 'lyric-role-indicator';
      const isAll = line.singers.length === ALL_DUCKS.length || line.type === 'bridge' || line.type === 'chorus';
      if (isAll) {
        indicator.style.background = 'var(--all-ducks)';
        indicator.textContent = '🎵';
        indicator.style.setProperty('--indicator-color', 'rgba(255,215,0,0.3)');
      } else if (line.singers.length > 0) {
        const color = DUCK_ROLES[line.singers[0]].color;
        indicator.style.background = `color-mix(in srgb, ${color} 25%, transparent)`;
        indicator.style.setProperty('--indicator-color', color);
        indicator.innerHTML = createDuckSVG(line.singers[0], 20);
      } else {
        indicator.style.background = 'rgba(255,255,255,0.05)';
        indicator.textContent = '♪';
        indicator.style.fontSize = '12px';
        indicator.style.color = 'var(--text-muted)';
      }

      // 歌词文字
      const text = document.createElement('span');
      text.className = 'lyric-text';
      text.textContent = line.text;

      // 角色标签
      const tags = document.createElement('div');
      tags.className = 'singer-tags';
      if (isAll) {
        const tag = document.createElement('span');
        tag.className = 'singer-tag';
        tag.textContent = 'ALL';
        tag.style.color = '#FFD700';
        tags.appendChild(tag);
      } else {
        line.singers.forEach(singer => {
          const tag = document.createElement('span');
          tag.className = 'singer-tag';
          tag.textContent = DUCK_ROLES[singer].label;
          tag.style.color = DUCK_ROLES[singer].color;
          tags.appendChild(tag);
        });
      }

      div.appendChild(indicator);
      div.appendChild(text);
      div.appendChild(tags);

      div.addEventListener('click', () => {
        if (perfEngine) {
          perfEngine.seekToLine(index);
          if (!perfEngine.getIsPlaying()) perfEngine.togglePlay();
        }
      });
      container.appendChild(div);
    });
  }

  function updatePerfLyricsHighlight() {
    // 作用域限定在表演模式容器内
    const container = document.querySelector('#perf-lyrics-area');
    if (!container) return;
    container.querySelectorAll('.perf-lyric-item').forEach((el) => {
      const i = parseInt(el.dataset.index, 10);
      const line = LYRICS_DATA[i];
      if (!line) return;
      el.classList.remove('my-role');
      el.style.setProperty('--my-role-color', '');

      if (selectedRole && line.singers.includes(selectedRole)) {
        el.classList.add('my-role');
        el.style.setProperty('--my-role-color', DUCK_ROLES[selectedRole].color);
      }
    });
  }

  function onPerfLyricChange(index, lyricLine) {
    // 只更新表演模式容器内的歌词行
    const container = document.querySelector('#perf-lyrics-area');
    if (!container) return;

    container.querySelectorAll('.perf-lyric-item').forEach((el) => {
      const i = parseInt(el.dataset.index, 10);
      el.classList.remove('active', 'past');
      if (i === index) el.classList.add('active');
      else if (i < index) el.classList.add('past');
    });

    // 滚动居中
    if (index >= 0) {
      const activeEl = container.querySelector(`.perf-lyric-item[data-index="${index}"]`);
      if (activeEl) {
        const cRect = container.getBoundingClientRect();
        const eRect = activeEl.getBoundingClientRect();
        const offset = eRect.top - cRect.top - cRect.height / 2 + eRect.height / 2;
        container.scrollBy({ top: offset, behavior: 'smooth' });
      }
    }

    // 段落标签
    if (lyricLine) {
      const tag = $('#perf-section');
      if (tag) tag.textContent = lyricLine.section || '';
    }

    // 鸭子动画 - 使用和练习模式一样的prac-duck-mini选择器
    updatePerfDuckAnimation(lyricLine);

    // 同步队形演唱者高亮
    updatePerfFormationSingers(lyricLine);
  }

  function updatePerfDuckAnimation(lyricLine) {
    // 表演模式的鸭子条在 #perf-duck-stage 内，使用 prac-duck-mini 类
    const ducks = document.querySelectorAll('#perf-duck-stage .prac-duck-mini');
    ducks.forEach(el => el.classList.remove('singing'));
    if (lyricLine && lyricLine.singers.length > 0) {
      lyricLine.singers.forEach(singer => {
        const el = document.querySelector(`#perf-duck-stage .prac-duck-mini[data-role="${singer}"]`);
        if (el) el.classList.add('singing');
      });
    }
  }

  // ==========================================
  //  表演模式 - 动作提示（面板式，与练习模式一致）
  // ==========================================
  function onPerfActionChange(actionText, lyricLine) {
    updatePerfActionCard(actionText);

    // 同步编排面板段落标签
    const tag = $('#perf-choreo-section-tag');
    if (tag && lyricLine) tag.textContent = lyricLine.section || '';
  }

  function updatePerfActionCard(actionText) {
    const card = $('#perf-current-action-card');
    const text = $('#perf-action-text');
    if (text) text.textContent = actionText || '等待播放...';
    if (card) {
      card.classList.remove('action-pulse');
      void card.offsetWidth;
      card.classList.add('action-pulse');
    }
  }

  // ==========================================
  //  表演模式 - 队形可视化（面板式，与练习模式一致）
  // ==========================================
  function initPerfFormationStage() {
    const stage = $('#perf-formation-stage');
    if (!stage) return;
    // 清除旧的鸭子
    stage.querySelectorAll('.formation-duck-svg').forEach(el => el.remove());

    Object.entries(DUCK_ROLES).forEach(([key, role]) => {
      const duck = document.createElement('div');
      duck.className = 'formation-duck-svg perf-formation-duck-item';
      duck.dataset.role = key;
      duck.style.color = role.color;
      duck.innerHTML = `<div class="duck-svg-wrap">${createDuckSVG(key, 40)}</div>
        <span class="duck-label">${role.label}</span>`;
      stage.appendChild(duck);
    });

    // 初始队形
    updatePerfFormation('initial', FORMATIONS.initial);
  }

  function onPerfFormationChange(formationKey, formationData) {
    updatePerfFormation(formationKey, formationData);
  }

  function updatePerfFormation(formationKey, formationData) {
    if (!formationData) return;
    const stage = $('#perf-formation-stage');
    if (!stage) return;

    const titleEl = $('#perf-formation-title');
    const descEl = $('#perf-formation-desc');
    if (titleEl) titleEl.textContent = '📍 ' + formationData.name;
    if (descEl) descEl.textContent = formationData.desc;

    stage.querySelectorAll('.perf-formation-duck-item').forEach(el => {
      const role = el.dataset.role;
      const pos = formationData.positions[role];
      if (pos) {
        el.style.left = `calc(${pos.x}% - 24px)`;
        el.style.top = `calc(${pos.y}% - 24px)`;
      }

      el.classList.remove('singing', 'my-duck');
      if (perfEngine && perfEngine.currentIndex >= 0) {
        const line = LYRICS_DATA[perfEngine.currentIndex];
        if (line && line.singers.includes(role)) {
          el.classList.add('singing');
        }
      }
      if (selectedRole === role) {
        el.classList.add('my-duck');
      }
    });
  }

  function updatePerfFormationSingers(lyricLine) {
    const stage = $('#perf-formation-stage');
    if (!stage) return;
    stage.querySelectorAll('.perf-formation-duck-item').forEach(el => {
      const role = el.dataset.role;
      el.classList.remove('singing');
      if (lyricLine && lyricLine.singers.includes(role)) {
        el.classList.add('singing');
      }
    });
  }

  function onPerfTimeUpdate(currentTime, duration) {
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    $('#perf-progress-fill').style.width = progress + '%';
    // 移动进度条thumb
    const thumb = $('#perf-progress-thumb');
    if (thumb) thumb.style.left = progress + '%';
    $('#perf-time').textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  }

  function bindPerformanceEvents() {
    $('#perf-play-btn').addEventListener('click', () => { if (perfEngine) perfEngine.togglePlay(); });
    $('#perf-restart-btn').addEventListener('click', () => { if (perfEngine) perfEngine.restart(); });
    $('#perf-back-btn').addEventListener('click', goBack);

    $('#perf-fullscreen-btn').addEventListener('click', () => {
      toggleFullscreen(performanceMode);
    });

    // 倍速按钮
    $('#perf-speed-btn').addEventListener('click', () => {
      cyclePlaybackSpeed('performance');
    });

    // 切换到练习模式
    const switchBtn = $('#perf-switch-mode');
    if (switchBtn) {
      switchBtn.addEventListener('click', () => {
        goBack();
        setTimeout(() => switchMode('practice'), 150);
      });
    }

    // 进度条交互
    bindProgressBar('#perf-progress-bar', () => perfEngine);
  }

  // ==========================================
  //  通用鸭子动画更新
  // ==========================================
  function updateDuckAnimation(selector, lyricLine) {
    document.querySelectorAll(selector).forEach(el => el.classList.remove('singing'));
    if (lyricLine && lyricLine.singers.length > 0) {
      lyricLine.singers.forEach(singer => {
        // 在选择器中查找对应角色
        document.querySelectorAll(selector).forEach(el => {
          if (el.dataset.role === singer) el.classList.add('singing');
        });
      });
    }
  }

  // ==========================================
  //  练习模式 - 歌词渲染
  // ==========================================
  function renderPracticeLyrics() {
    const container = $('#prac-lyrics-container');
    container.innerHTML = '';

    LYRICS_DATA.forEach((line, index) => {
      const div = document.createElement('div');
      div.className = 'practice-lyric-line';
      div.dataset.index = index;

      // 角色指示器 - 小鸭子图标或彩色圆点
      const indicator = document.createElement('div');
      indicator.className = 'lyric-role-indicator';
      const isAll = line.singers.length === ALL_DUCKS.length || line.type === 'bridge' || line.type === 'chorus';
      if (isAll) {
        indicator.style.background = 'var(--all-ducks)';
        indicator.textContent = '🎵';
        indicator.style.setProperty('--indicator-color', 'rgba(255,215,0,0.3)');
      } else if (line.singers.length > 0) {
        const color = DUCK_ROLES[line.singers[0]].color;
        indicator.style.background = `color-mix(in srgb, ${color} 25%, transparent)`;
        indicator.style.setProperty('--indicator-color', color);
        indicator.innerHTML = createDuckSVG(line.singers[0], 20);
      } else {
        indicator.style.background = 'rgba(255,255,255,0.05)';
        indicator.textContent = '♪';
        indicator.style.fontSize = '12px';
        indicator.style.color = 'var(--text-muted)';
      }

      // 歌词文字
      const text = document.createElement('span');
      text.className = 'lyric-text';
      text.textContent = line.text;

      // 角色标签
      const tags = document.createElement('div');
      tags.className = 'singer-tags';
      if (isAll) {
        const tag = document.createElement('span');
        tag.className = 'singer-tag';
        tag.textContent = 'ALL';
        tag.style.color = '#FFD700';
        tags.appendChild(tag);
      } else {
        line.singers.forEach(singer => {
          const tag = document.createElement('span');
          tag.className = 'singer-tag';
          tag.textContent = DUCK_ROLES[singer].label;
          tag.style.color = DUCK_ROLES[singer].color;
          tags.appendChild(tag);
        });
      }

      div.appendChild(indicator);
      div.appendChild(text);
      div.appendChild(tags);

      div.addEventListener('click', () => {
        if (pracEngine) {
          pracEngine.seekToLine(index);
          if (!pracEngine.getIsPlaying()) pracEngine.togglePlay();
        }
      });
      container.appendChild(div);
    });
  }

  function updatePracticeLyricsHighlight() {
    // 作用域限定在练习模式容器内
    const container = document.querySelector('#prac-lyrics-container');
    if (!container) return;
    container.querySelectorAll('.practice-lyric-line').forEach((el) => {
      const i = parseInt(el.dataset.index, 10);
      const line = LYRICS_DATA[i];
      if (!line) return;
      el.classList.remove('my-role');
      el.style.setProperty('--my-role-color', '');

      if (selectedRole && line.singers.includes(selectedRole)) {
        el.classList.add('my-role');
        el.style.setProperty('--my-role-color', DUCK_ROLES[selectedRole].color);
      }
    });
  }

  function onPracLyricChange(index, lyricLine) {
    // 只更新练习模式容器内的歌词行
    const container = document.querySelector('#prac-lyrics-container');
    if (!container) return;

    container.querySelectorAll('.practice-lyric-line').forEach((el) => {
      const i = parseInt(el.dataset.index, 10);
      el.classList.remove('active', 'past');
      if (i === index) el.classList.add('active');
      else if (i < index) el.classList.add('past');
    });

    // 滚动居中
    if (index >= 0) {
      const activeEl = container.querySelector(`.practice-lyric-line[data-index="${index}"]`);
      if (activeEl) {
        const cRect = container.getBoundingClientRect();
        const eRect = activeEl.getBoundingClientRect();
        const offset = eRect.top - cRect.top - cRect.height / 2 + eRect.height / 2;
        container.scrollBy({ top: offset, behavior: 'smooth' });
      }
    }

    // 段落标签
    if (lyricLine) {
      const tag = $('#prac-section-tag');
      if (tag) tag.textContent = lyricLine.section || '';
    }

    // 鸭子动画 - 只更新练习模式的鸭子条
    updateDuckAnimation('#prac-duck-strip .prac-duck-mini', lyricLine);

    // 同步队形演唱者高亮
    updateFormationSingers(lyricLine);
  }

  function onPracTimeUpdate(currentTime, duration) {
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    $('#prac-progress-fill').style.width = progress + '%';
    const thumb = $('#prac-progress-thumb');
    if (thumb) thumb.style.left = progress + '%';
    $('#prac-time').textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  }

  function bindPracticeEvents() {
    $('#prac-play-btn').addEventListener('click', () => { if (pracEngine) pracEngine.togglePlay(); });
    $('#prac-restart-btn').addEventListener('click', () => { if (pracEngine) pracEngine.restart(); });
    $('#prac-back-btn').addEventListener('click', goBack);
    $('#prac-switch-mode').addEventListener('click', () => {
      goBack();
      setTimeout(() => switchMode('performance'), 150);
    });

    // 倍速按钮
    $('#prac-speed-btn').addEventListener('click', () => {
      cyclePlaybackSpeed('practice');
    });

    bindProgressBar('#prac-progress-bar', () => pracEngine);
  }

  // ==========================================
  //  AB段循环
  // ==========================================
  function bindABLoopEvents() {
    const setABtn = $('#prac-set-a-btn');
    const setBBtn = $('#prac-set-b-btn');
    const clearBtn = $('#prac-clear-ab-btn');

    if (setABtn) {
      setABtn.addEventListener('click', () => {
        if (pracEngine) {
          pracEngine.setLoopA();
          setABtn.classList.add('active-point');
        }
      });
    }
    if (setBBtn) {
      setBBtn.addEventListener('click', () => {
        if (pracEngine) {
          pracEngine.setLoopB();
          setBBtn.classList.add('active-point');
        }
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (pracEngine) {
          pracEngine.clearLoop();
          if (setABtn) setABtn.classList.remove('active-point');
          if (setBBtn) setBBtn.classList.remove('active-point');
        }
      });
    }
  }

  function onPracLoopChange(a, b) {
    const range = $('#ab-loop-range');
    const clearBtn = $('#prac-clear-ab-btn');
    if (!range) return;

    if (a !== null && b !== null && pracEngine) {
      const duration = pracEngine.getDuration();
      if (duration > 0) {
        const left = (a / duration) * 100;
        const width = ((b - a) / duration) * 100;
        range.style.left = left + '%';
        range.style.width = width + '%';
        range.classList.add('visible');
        if (clearBtn) clearBtn.style.display = '';
      }
    } else {
      range.classList.remove('visible');
      if (clearBtn) clearBtn.style.display = 'none';
    }
  }

  // ==========================================
  //  动作编排面板 - 动作提示
  // ==========================================
  function onPracActionChange(actionText, lyricLine) {
    updateActionCard(actionText);
    updateActionTimelineHighlight(pracEngine ? pracEngine.currentIndex : -1);

    // 同步编排面板段落标签
    const tag = $('#choreo-section-tag');
    if (tag && lyricLine) tag.textContent = lyricLine.section || '';
  }

  function updateActionCard(actionText) {
    const card = $('#current-action-card');
    const text = $('#current-action-text');
    if (text) text.textContent = actionText || '等待播放...';
    if (card) {
      card.classList.remove('action-pulse');
      void card.offsetWidth; // 强制重排
      card.classList.add('action-pulse');
    }
  }

  // ==========================================
  //  动作编排面板 - 动作时间轴
  // ==========================================
  function renderActionTimeline() {
    const container = $('#action-timeline');
    if (!container) return;
    container.innerHTML = '';

    LYRICS_DATA.forEach((line, index) => {
      const item = document.createElement('div');
      item.className = 'action-timeline-item';
      item.dataset.index = index;

      // 时间标
      const timeBadge = document.createElement('div');
      timeBadge.className = 'action-time-badge';
      timeBadge.textContent = formatTime(line.startTime);

      // 内容区
      const content = document.createElement('div');
      content.className = 'action-item-content';

      const lyricText = document.createElement('div');
      lyricText.className = 'action-item-lyric';
      lyricText.textContent = line.text;

      const actionText = document.createElement('div');
      actionText.className = 'action-item-action';
      actionText.textContent = line.action || '—';

      content.appendChild(lyricText);
      content.appendChild(actionText);

      if (line.formation && FORMATIONS[line.formation]) {
        const formTag = document.createElement('span');
        formTag.className = 'action-item-formation';
        formTag.textContent = '📍 ' + FORMATIONS[line.formation].name;
        content.appendChild(formTag);
      }

      item.appendChild(timeBadge);
      item.appendChild(content);

      item.addEventListener('click', () => {
        if (pracEngine) {
          pracEngine.seekToLine(index);
          if (!pracEngine.getIsPlaying()) pracEngine.togglePlay();
        }
      });

      container.appendChild(item);
    });
  }

  function updateActionTimelineHighlight(currentIndex) {
    $$('.action-timeline-item').forEach((el, i) => {
      el.classList.remove('active', 'past');
      if (i === currentIndex) el.classList.add('active');
      else if (i < currentIndex) el.classList.add('past');
    });

    // 自动滚动
    if (currentIndex >= 0) {
      const activeEl = $(`.action-timeline-item[data-index="${currentIndex}"]`);
      if (activeEl) {
        const container = $('#action-timeline');
        if (container) {
          const cRect = container.getBoundingClientRect();
          const eRect = activeEl.getBoundingClientRect();
          const offset = eRect.top - cRect.top - cRect.height / 3 + eRect.height / 2;
          container.scrollBy({ top: offset, behavior: 'smooth' });
        }
      }
    }
  }

  // ==========================================
  //  动作编排面板 - 队形可视化
  // ==========================================
  function initFormationStage() {
    const stage = $('#formation-stage');
    if (!stage) return;

    // 创建6只鸭子的DOM节点（SVG鸭子图像）
    Object.entries(DUCK_ROLES).forEach(([key, role]) => {
      const duck = document.createElement('div');
      duck.className = 'formation-duck-svg';
      duck.dataset.role = key;
      duck.style.color = role.color;
      duck.innerHTML = `<div class="duck-svg-wrap">${createDuckSVG(key, 36)}</div>
        <span class="duck-label">${role.label}</span>`;
      stage.appendChild(duck);
    });

    // 初始队形
    updateFormation('initial', FORMATIONS.initial);
  }

  function onPracFormationChange(formationKey, formationData) {
    updateFormation(formationKey, formationData);
  }

  function updateFormation(formationKey, formationData) {
    if (!formationData) return;
    const stage = $('#formation-stage');
    if (!stage) return;

    const titleEl = $('#formation-title');
    const descEl = $('#formation-desc');
    if (titleEl) titleEl.textContent = '📍 ' + formationData.name;
    if (descEl) descEl.textContent = formationData.desc;

    // 只更新练习模式队形面板中的鸭子
    stage.querySelectorAll('.formation-duck-svg').forEach(el => {
      const role = el.dataset.role;
      const pos = formationData.positions[role];
      if (pos) {
        el.style.left = `calc(${pos.x}% - 20px)`;
        el.style.top = `calc(${pos.y}% - 20px)`;
      }

      el.classList.remove('singing', 'my-duck');
      if (pracEngine && pracEngine.currentIndex >= 0) {
        const line = LYRICS_DATA[pracEngine.currentIndex];
        if (line && line.singers.includes(role)) {
          el.classList.add('singing');
        }
      }
      if (selectedRole === role) {
        el.classList.add('my-duck');
      }
    });
  }

  // 更新队形中的演唱高亮（只更新练习模式）
  function updateFormationSingers(lyricLine) {
    const stage = $('#formation-stage');
    if (!stage) return;
    stage.querySelectorAll('.formation-duck-svg').forEach(el => {
      const role = el.dataset.role;
      el.classList.remove('singing');
      if (lyricLine && lyricLine.singers.includes(role)) {
        el.classList.add('singing');
      }
    });
  }

  // ==========================================
  //  通用进度条交互（鼠标+触摸）
  // ==========================================
  function bindProgressBar(barSelector, getEngine) {
    const bar = $(barSelector);
    if (!bar) return;
    let isDragging = false;

    function seekFromClientX(clientX) {
      const engine = getEngine();
      if (!engine) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      engine.seek(ratio * engine.getDuration());
    }

    // Mouse events
    bar.addEventListener('mousedown', (e) => { isDragging = true; seekFromClientX(e.clientX); });
    document.addEventListener('mousemove', (e) => { if (isDragging) seekFromClientX(e.clientX); });
    document.addEventListener('mouseup', () => { isDragging = false; });

    // Touch events (mobile/iPad)
    bar.addEventListener('touchstart', (e) => {
      isDragging = true;
      if (e.touches.length > 0) seekFromClientX(e.touches[0].clientX);
      e.preventDefault();
    }, { passive: false });
    bar.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length > 0) seekFromClientX(e.touches[0].clientX);
      e.preventDefault();
    }, { passive: false });
    bar.addEventListener('touchend', () => { isDragging = false; });
    bar.addEventListener('touchcancel', () => { isDragging = false; });

    bar.addEventListener('click', (e) => seekFromClientX(e.clientX));
  }

  // ==========================================
  //  跨浏览器全屏 API
  // ==========================================
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
  }

  function toggleFullscreen(el) {
    if (isFullscreen()) {
      (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen).call(document);
    } else {
      const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (rfs) rfs.call(el).catch(() => {});
    }
  }

  // ==========================================
  //  键盘快捷键
  // ==========================================
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      const engine = currentMode === 'performance' ? perfEngine : pracEngine;
      if (engine) engine.togglePlay();
    }
    if (e.code === 'Escape') {
      if (isFullscreen()) {
        (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen).call(document);
      } else if (currentMode) goBack();
    }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
      const delta = e.code === 'ArrowLeft' ? -5 : 5;
      const engine = currentMode === 'performance' ? perfEngine : pracEngine;
      if (engine) engine.seek(Math.max(0, engine.getCurrentTime() + delta));
    }
    if (e.code === 'KeyF' && currentMode === 'performance') {
      toggleFullscreen(performanceMode);
    }
  });

  // ==========================================
  //  启动
  // ==========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
