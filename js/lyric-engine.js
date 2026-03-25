/**
 * Six Little Ducks - 歌词同步引擎
 * 基于 requestAnimationFrame 的高精度歌词同步
 * 支持：动作提示、队形变更、AB段循环
 */

class LyricEngine {
  constructor() {
    this.mediaElement = null;
    this.mode = null;
    this.currentIndex = -1;
    this.currentFormation = null;
    this.isPlaying = false;
    this.rafId = null;
    this.selectedRole = null;
    this.onLyricChange = null;
    this.onTimeUpdate = null;
    this.onActionChange = null;
    this.onFormationChange = null;

    // AB段循环
    this.loopA = null;
    this.loopB = null;
    this.onLoopChange = null;
  }

  init(mediaElement, mode) {
    // 防止重复绑定事件
    if (this._inited && this.mediaElement === mediaElement) return;

    this.mediaElement = mediaElement;
    this.mode = mode;
    this.currentIndex = -1;
    this.currentFormation = null;
    this.isPlaying = false;
    this._inited = true;

    // 绑定事件前先移除旧的（防止重复绑定）
    this._onPlay = () => { this.isPlaying = true; this._startSync(); };
    this._onPause = () => { this.isPlaying = false; this._stopSync(); };
    this._onEnded = () => { this.isPlaying = false; this._stopSync(); };
    this._onSeeked = () => { this._updateCurrentLine(); };

    this.mediaElement.addEventListener('play', this._onPlay);
    this.mediaElement.addEventListener('pause', this._onPause);
    this.mediaElement.addEventListener('ended', this._onEnded);
    this.mediaElement.addEventListener('seeked', this._onSeeked);
  }

  togglePlay() {
    if (!this.mediaElement) return;
    if (this.mediaElement.paused) {
      this.mediaElement.play().catch(e => console.warn('Play error:', e));
    } else {
      this.mediaElement.pause();
    }
  }

  seek(time) {
    if (!this.mediaElement) return;
    var targetTime = Math.max(0, Math.min(time, this.getDuration()));
    this.mediaElement.currentTime = targetTime;

    // iOS Safari 有时 seek 会静默失败，添加验证重试
    var self = this;
    var el = this.mediaElement;
    setTimeout(function () {
      if (Math.abs(el.currentTime - targetTime) > 1) {
        console.warn('[LyricEngine] Seek verify failed, retrying. target=' + targetTime + ' actual=' + el.currentTime);
        el.currentTime = targetTime;
      }
    }, 300);
  }

  seekToLine(index) {
    if (index >= 0 && index < LYRICS_DATA.length) {
      this.seek(LYRICS_DATA[index].startTime);
      // 立即更新歌词 UI，不等 seeked 事件（iOS 可能延迟触发）
      this.currentIndex = -1; // 强制触发变更
      var self = this;
      setTimeout(function () { self._updateCurrentLine(); }, 100);
    }
  }

  restart() {
    this.seek(0);
    if (!this.isPlaying) this.togglePlay();
  }

  setRole(role) { this.selectedRole = role; }
  getCurrentTime() { return this.mediaElement ? this.mediaElement.currentTime : 0; }
  getDuration() { return this.mediaElement ? this.mediaElement.duration || 0 : 0; }
  getIsPlaying() { return this.isPlaying; }

  // === AB段循环 ===
  setLoopA(time) {
    this.loopA = time != null ? time : this.getCurrentTime();
    if (this.onLoopChange) this.onLoopChange(this.loopA, this.loopB);
  }

  setLoopB(time) {
    this.loopB = time != null ? time : this.getCurrentTime();
    // 确保 A < B
    if (this.loopA !== null && this.loopB < this.loopA) {
      [this.loopA, this.loopB] = [this.loopB, this.loopA];
    }
    if (this.onLoopChange) this.onLoopChange(this.loopA, this.loopB);
  }

  clearLoop() {
    this.loopA = null;
    this.loopB = null;
    if (this.onLoopChange) this.onLoopChange(null, null);
  }

  hasLoop() {
    return this.loopA !== null && this.loopB !== null;
  }

  _startSync() {
    if (this.rafId) return;
    const sync = () => {
      this._updateCurrentLine();
      this._checkLoop();
      if (this.onTimeUpdate) {
        this.onTimeUpdate(this.getCurrentTime(), this.getDuration());
      }
      if (this.isPlaying) {
        this.rafId = requestAnimationFrame(sync);
      }
    };
    this.rafId = requestAnimationFrame(sync);
  }

  _stopSync() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  _checkLoop() {
    if (this.hasLoop()) {
      var t = this.getCurrentTime();
      if (t >= this.loopB) {
        this.seek(this.loopA);
        // 强制更新歌词行到循环起点
        this.currentIndex = -1;
        var self = this;
        setTimeout(function () { self._updateCurrentLine(); }, 100);
      }
    }
  }

  _updateCurrentLine() {
    const t = this.getCurrentTime();
    let newIndex = -1;

    for (let i = 0; i < LYRICS_DATA.length; i++) {
      const line = LYRICS_DATA[i];
      if (t >= line.startTime && t < line.endTime) {
        newIndex = i;
        break;
      }
    }

    // 处理歌词行之间的间隙 - 归属到下一行
    if (newIndex === -1 && t > 0) {
      for (let i = 0; i < LYRICS_DATA.length - 1; i++) {
        if (t >= LYRICS_DATA[i].endTime && t < LYRICS_DATA[i + 1].startTime) {
          // 间隙小于1秒归到上一行，否则归到下一行
          const gap = LYRICS_DATA[i + 1].startTime - LYRICS_DATA[i].endTime;
          newIndex = gap < 1 ? i : (t - LYRICS_DATA[i].endTime < gap / 2 ? i : i + 1);
          break;
        }
      }
      // 超过最后一行
      if (newIndex === -1) {
        const last = LYRICS_DATA[LYRICS_DATA.length - 1];
        if (t >= last.endTime) newIndex = LYRICS_DATA.length - 1;
      }
    }

    if (newIndex !== this.currentIndex) {
      this.currentIndex = newIndex;
      const lyricLine = newIndex >= 0 ? LYRICS_DATA[newIndex] : null;

      if (this.onLyricChange) {
        this.onLyricChange(newIndex, lyricLine);
      }

      // 动作变更回调
      if (this.onActionChange && lyricLine) {
        this.onActionChange(lyricLine.action || '', lyricLine);
      }

      // 队形变更回调
      if (lyricLine && lyricLine.formation && lyricLine.formation !== this.currentFormation) {
        this.currentFormation = lyricLine.formation;
        if (this.onFormationChange) {
          this.onFormationChange(lyricLine.formation, FORMATIONS[lyricLine.formation]);
        }
      }
    }
  }

  destroy() {
    this._stopSync();
    if (this.mediaElement && this._onPlay) {
      this.mediaElement.removeEventListener('play', this._onPlay);
      this.mediaElement.removeEventListener('pause', this._onPause);
      this.mediaElement.removeEventListener('ended', this._onEnded);
      this.mediaElement.removeEventListener('seeked', this._onSeeked);
    }
    this.mediaElement = null;
    this.onLyricChange = null;
    this.onTimeUpdate = null;
    this.onActionChange = null;
    this.onFormationChange = null;
    this.onLoopChange = null;
    this._inited = false;
  }
}

function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
