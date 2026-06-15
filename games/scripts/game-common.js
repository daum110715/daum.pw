/* ===== game-common.js ===== */
(function (window) {
  'use strict';

  /* ---------- GameUtils ---------- */
  const GameUtils = {
    $(id) { return document.getElementById(id); },

    addClass(el, c) { if (el) el.classList.add(c); },
    removeClass(el, c) { if (el) el.classList.remove(c); },
    toggleClass(el, c, force) { if (el) el.classList.toggle(c, force); },

    formatTime(totalSeconds) {
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      return m + ':' + String(s).padStart(2, '0');
    },

    formatDuration(ms) {
      return GameUtils.formatTime(Math.floor(ms / 1000));
    },

    formatDate(ts) {
      const d = new Date(ts);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    deepClone(obj) {
      try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
    }
  };

  /* ---------- GameOverlay ---------- */
  const GameOverlay = {
    show(el) {
      if (typeof el === 'string') el = GameUtils.$(el);
      if (el) el.hidden = false;
    },

    hide(el) {
      if (typeof el === 'string') el = GameUtils.$(el);
      if (el) el.hidden = true;
    },

    toggle(el) {
      if (typeof el === 'string') el = GameUtils.$(el);
      if (el) el.hidden = !el.hidden;
    },

    showConfirm(message, options) {
      options = options || {};
      const msgId = options.messageId || 'confirm-message';
      const overlayId = options.overlayId || 'confirm-overlay';
      const okId = options.okId || 'confirm-ok';
      const cancelId = options.cancelId || 'confirm-cancel';

      const msgEl = GameUtils.$(msgId);
      const overlayEl = GameUtils.$(overlayId);
      const okBtn = GameUtils.$(okId);
      const cancelBtn = GameUtils.$(cancelId);

      if (msgEl) msgEl.textContent = message;
      if (overlayEl) overlayEl.hidden = false;

      return new Promise(resolve => {
        const onOk = () => {
          if (overlayEl) overlayEl.hidden = true;
          resolve(true);
        };
        const onCancel = () => {
          if (overlayEl) overlayEl.hidden = true;
          resolve(false);
        };
        if (okBtn) okBtn.onclick = onOk;
        if (cancelBtn) cancelBtn.onclick = onCancel;
      });
    },

    bindEscToClose(...overlays) {
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          overlays.forEach(id => {
            const el = typeof id === 'string' ? GameUtils.$(id) : id;
            if (el) el.hidden = true;
          });
        }
      });
    }
  };

  /* ---------- GameTimer ---------- */
  function GameTimer(onTick) {
    this.onTick = onTick;
    this._interval = null;
    this._startTime = 0;
    this._elapsedMs = 0;
    this.running = false;
  }

  GameTimer.prototype.start = function () {
    if (this.running) return;
    this._startTime = Date.now() - this._elapsedMs;
    this.running = true;
    this._interval = setInterval(() => {
      this._elapsedMs = Date.now() - this._startTime;
      if (this.onTick) this.onTick(this._elapsedMs);
    }, 1000);
  };

  GameTimer.prototype.stop = function () {
    if (!this.running) return;
    clearInterval(this._interval);
    this._interval = null;
    this.running = false;
  };

  GameTimer.prototype.reset = function () {
    this.stop();
    this._elapsedMs = 0;
    this._startTime = 0;
  };

  GameTimer.prototype.getElapsedMs = function () {
    if (this.running) this._elapsedMs = Date.now() - this._startTime;
    return this._elapsedMs;
  };

  GameTimer.prototype.setElapsedMs = function (ms) {
    this._elapsedMs = ms;
    if (this.running) this._startTime = Date.now() - ms;
  };

  /* ---------- GameStorage ---------- */
  function GameStorage(prefix) {
    this.prefix = prefix;
  }

  GameStorage.prototype._key = function (name) {
    return this.prefix + '_' + name;
  };

  GameStorage.prototype.save = function (name, data) {
    localStorage.setItem(this._key(name), JSON.stringify(data));
  };

  GameStorage.prototype.load = function (name) {
    try {
      const raw = localStorage.getItem(this._key(name));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  GameStorage.prototype.remove = function (name) {
    localStorage.removeItem(this._key(name));
  };

  /* ---------- GameStats ---------- */
  function GameStats(storage, key, defaults) {
    this.storage = storage;
    this.key = key;
    this.defaults = defaults;
  }

  GameStats.prototype.get = function () {
    try {
      const raw = this.storage.load(this.key);
      if (raw && raw.version === this.defaults.version) {
        const merged = Object.assign({}, this.defaults);
        for (const k in raw) merged[k] = raw[k];
        return merged;
      }
    } catch {}
    return Object.assign({}, this.defaults);
  };

  GameStats.prototype.set = function (data) {
    this.storage.save(this.key, data);
  };

  GameStats.prototype.recordSession = function (session, maxSessions) {
    maxSessions = maxSessions || 50;
    const data = this.get();
    data.started = (data.started || 0) + 1;
    if (session && session.won) {
      data.won = (data.won || 0) + 1;
      data.sessions = data.sessions || [];
      data.sessions.unshift(session);
      if (data.sessions.length > maxSessions) data.sessions.pop();
    }
    this.set(data);
    return data;
  };

  /* ---------- expose ---------- */
  window.GameUtils = GameUtils;
  window.GameOverlay = GameOverlay;
  window.GameTimer = GameTimer;
  window.GameStorage = GameStorage;
  window.GameStats = GameStats;
})(window);
