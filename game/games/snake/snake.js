/* ===== Snake 贪吃蛇 ===== */

(function() {
  'use strict';

  const SAVE_KEY = 'game_snake_save_v1';
  const STATS_KEY = 'game_snake_stats_v1';

  let state = {
    snake: [],
    dir: { x: 0, y: -1 },
    nextDir: { x: 0, y: -1 },
    food: { x: 0, y: 0 },
    score: 0,
    highScore: 0,
    speed: 150,
    isPaused: false,
    isOver: false,
    mode: 'classic',
    cellCount: 20,
    cellSize: 24,
    startTime: 0,
    elapsed: 0,
    interval: null
  };

  let cells = []; // [y][x] -> DOM element
  let touchStart = null;
  let isDying = false;
  let isStarted = false;

  const boardEl = document.getElementById('board');
  const scoreEl = document.getElementById('stat-score');
  const highEl = document.getElementById('stat-high');
  const lengthEl = document.getElementById('stat-length');
  const modeEl = document.getElementById('stat-mode');
  const goOverlay = document.getElementById('gameover-overlay');
  const pauseOverlay = document.getElementById('pause-overlay');
  const helpOverlay = document.getElementById('help-overlay');
  const confirmOverlay = document.getElementById('confirm-overlay');
  const modeSelect = document.getElementById('mode-select');
  const startOverlay = document.getElementById('start-overlay');
  const summaryPanelEl = document.querySelector('.stats-section .stats-panel:not(.recent-panel)');
  const recentPanelEl = document.querySelector('.recent-panel');

  /* ---------- Board sizing ---------- */

  function calculateBoardSize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Available space for the board (leave room for topbar + stats + padding)
    const maxPx = Math.min(vw - 32, vh - 220, 560);
    if (vw <= 600) {
      state.cellCount = 16;
    } else {
      state.cellCount = 20;
    }
    state.cellSize = Math.max(14, Math.floor((maxPx - 8) / state.cellCount));
  }

  function buildBoard() {
    calculateBoardSize();
    boardEl.style.gridTemplateColumns = `repeat(${state.cellCount}, ${state.cellSize}px)`;
    boardEl.style.gridTemplateRows = `repeat(${state.cellCount}, ${state.cellSize}px)`;

    cells = [];
    const fragment = document.createDocumentFragment();
    for (let y = 0; y < state.cellCount; y++) {
      const row = [];
      for (let x = 0; x < state.cellCount; x++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.x = x;
        cell.dataset.y = y;
        fragment.appendChild(cell);
        row.push(cell);
      }
      cells.push(row);
    }
    boardEl.innerHTML = '';
    boardEl.appendChild(fragment);
  }

  /* ---------- Core game ---------- */

  function newGame() {
    clearInterval(state.interval);
    state.interval = null;
    isDying = false;
    isStarted = false;

    const mid = Math.floor(state.cellCount / 2);
    state.snake = [
      { x: mid, y: mid + 2 },
      { x: mid, y: mid + 3 },
      { x: mid, y: mid + 4 }
    ];
    state.dir = { x: 0, y: -1 };
    state.nextDir = { x: 0, y: -1 };
    state.score = 0;
    state.speed = 150;
    state.isPaused = false;
    state.isOver = false;
    state.startTime = 0;
    state.elapsed = 0;

    goOverlay.hidden = true;
    pauseOverlay.hidden = true;
    confirmOverlay.hidden = true;
    if (startOverlay) startOverlay.hidden = false;

    spawnFood();
    render();
    updateStats();
    saveGame();
    renderStatsPanel();
  }

  function spawnFood() {
    const free = [];
    const snakeSet = new Set(state.snake.map(s => `${s.x},${s.y}`));
    for (let y = 0; y < state.cellCount; y++) {
      for (let x = 0; x < state.cellCount; x++) {
        if (!snakeSet.has(`${x},${y}`)) {
          free.push({ x, y });
        }
      }
    }
    if (free.length === 0) {
      // Board full = win
      gameOver(true);
      return;
    }
    const idx = Math.floor(Math.random() * free.length);
    state.food = free[idx];
  }

  function move() {
    if (!isStarted || state.isPaused || state.isOver || isDying) return;

    state.dir = { ...state.nextDir };
    let head = {
      x: state.snake[0].x + state.dir.x,
      y: state.snake[0].y + state.dir.y
    };

    // Wrap mode
    if (state.mode === 'wrap') {
      if (head.x < 0) head.x = state.cellCount - 1;
      else if (head.x >= state.cellCount) head.x = 0;
      if (head.y < 0) head.y = state.cellCount - 1;
      else if (head.y >= state.cellCount) head.y = 0;
    }

    // Wall collision (classic)
    if (state.mode === 'classic') {
      if (head.x < 0 || head.x >= state.cellCount || head.y < 0 || head.y >= state.cellCount) {
        gameOver();
        return;
      }
    }

    // Self collision
    if (onSnake(head)) {
      gameOver();
      return;
    }

    state.snake.unshift(head);

    if (head.x === state.food.x && head.y === state.food.y) {
      state.score++;
      if (state.score > state.highScore) state.highScore = state.score;
      state.speed = Math.max(60, 150 - state.score * 3);
      spawnFood();
      updateStats();
      restartLoop();
      showEatEffect(head.x, head.y);
    } else {
      state.snake.pop();
    }

    render();
    saveGame();
  }

  function onSnake(p) {
    // Skip head (index 0) because we haven't added it yet
    for (let i = 1; i < state.snake.length; i++) {
      if (state.snake[i].x === p.x && state.snake[i].y === p.y) return true;
    }
    return false;
  }

  function render() {
    // Clear all
    for (let y = 0; y < state.cellCount; y++) {
      for (let x = 0; x < state.cellCount; x++) {
        cells[y][x].className = 'cell';
      }
    }
    // Food
    if (state.food.x >= 0 && state.food.x < state.cellCount &&
        state.food.y >= 0 && state.food.y < state.cellCount) {
      cells[state.food.y][state.food.x].className = 'cell food';
    }
    // Snake
    for (let i = 0; i < state.snake.length; i++) {
      const seg = state.snake[i];
      if (seg.x >= 0 && seg.x < state.cellCount && seg.y >= 0 && seg.y < state.cellCount) {
        const cls = i === 0 ? 'cell snake head' : 'cell snake';
        cells[seg.y][seg.x].className = cls;
      }
    }
  }

  function startGame() {
    if (isStarted) return;
    isStarted = true;
    if (startOverlay) startOverlay.hidden = true;
    state.isPaused = false;
    state.startTime = Date.now();
    startLoop();
  }

  function startLoop() {
    state.interval = setInterval(move, state.speed);
  }

  function restartLoop() {
    clearInterval(state.interval);
    state.interval = setInterval(move, state.speed);
  }

  /* ---------- Animation & effects ---------- */

  function showEatEffect(x, y) {
    const cell = cells[y][x];
    const el = document.createElement('div');
    el.className = 'eat-float';
    el.textContent = '+1';
    const rect = cell.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();
    el.style.left = (rect.left - boardRect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top - boardRect.top) + 'px';
    boardEl.appendChild(el);
    setTimeout(() => el.remove(), 600);
  }

  async function gameOver(won) {
    if (isDying) return;
    isDying = true;
    state.isOver = true;
    clearInterval(state.interval);
    state.interval = null;

    // Death flash animation
    for (let f = 0; f < 3; f++) {
      for (let i = 0; i < state.snake.length; i++) {
        const seg = state.snake[i];
        if (seg.x >= 0 && seg.x < state.cellCount && seg.y >= 0 && seg.y < state.cellCount) {
          cells[seg.y][seg.x].classList.toggle('dead');
        }
      }
      await new Promise(r => setTimeout(r, 150));
    }

    saveStats();
    localStorage.removeItem(SAVE_KEY);

    const finalTitle = won ? '完美通关！' : '游戏结束';
    document.getElementById('final-title').textContent = finalTitle;
    document.getElementById('final-score').textContent = state.score;
    document.getElementById('final-length').textContent = state.snake.length;
    document.getElementById('final-mode').textContent = state.mode === 'wrap' ? '穿墙模式' : '经典模式';
    goOverlay.hidden = false;

    if (typeof launchConfetti === 'function' && (won || state.score >= 15)) {
      launchConfetti();
    }
    renderStatsPanel();
  }

  /* ---------- Pause / overlays ---------- */

  function togglePause() {
    if (state.isOver) return;
    if (!isStarted) {
      startGame();
      return;
    }
    state.isPaused = !state.isPaused;
    if (pauseOverlay) pauseOverlay.hidden = !state.isPaused;
    if (state.isPaused) {
      state.elapsed += Date.now() - state.startTime;
    } else {
      state.startTime = Date.now();
    }
  }

  function showHelp() {
    helpOverlay.hidden = false;
    if (!state.isPaused && !state.isOver) togglePause();
  }

  function hideHelp() {
    helpOverlay.hidden = true;
    if (state.isPaused && !state.isOver && goOverlay.hidden) {
      togglePause();
    }
  }

  function confirmNewGame() {
    if (!state.isOver && state.snake.length > 3) {
      confirmOverlay.hidden = false;
      if (!state.isPaused) togglePause();
    } else {
      newGame();
    }
  }

  function cancelConfirm() {
    confirmOverlay.hidden = true;
    if (state.isPaused && !state.isOver) togglePause();
  }

  /* ---------- Stats ---------- */

  function updateStats() {
    scoreEl.textContent = state.score;
    highEl.textContent = state.highScore;
    lengthEl.textContent = state.snake.length;
    modeEl.textContent = state.mode === 'wrap' ? '穿墙' : '经典';
  }

  function saveStats() {
    const raw = localStorage.getItem(STATS_KEY);
    const data = raw ? JSON.parse(raw) : { started: 0, sessions: [] };
    data.started = (data.started || 0) + 1;
    const won = state.score >= 15 || (state.snake.length >= state.cellCount * state.cellCount);
    const duration = state.elapsed + (Date.now() - state.startTime);
    data.sessions.unshift({
      score: state.score,
      length: state.snake.length,
      won: won,
      mode: state.mode,
      duration: duration,
      completedAt: Date.now()
    });
    if (data.sessions.length > 50) data.sessions.pop();
    localStorage.setItem(STATS_KEY, JSON.stringify(data));
  }

  function loadHighScore() {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        const sessions = Array.isArray(data.sessions) ? data.sessions : [];
        state.highScore = sessions.reduce((m, s) => Math.max(m, s.score || 0), 0);
      } catch (e) {}
    }
  }

  function renderStatsPanel() {
    const raw = localStorage.getItem(STATS_KEY);
    const data = raw ? JSON.parse(raw) : { started: 0, sessions: [] };
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];

    document.getElementById('stats-started').textContent = data.started || 0;
    const wonCount = sessions.filter(s => s.won).length;
    document.getElementById('stats-won').textContent = wonCount;
    const rate = sessions.length ? Math.round((wonCount / sessions.length) * 100) : 0;
    document.getElementById('stats-win-rate').textContent = rate + '%';
    document.getElementById('stats-best-score').textContent = state.highScore;

    const totalTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    document.getElementById('stats-total-time').textContent = formatDuration(totalTime);

    const avgScore = sessions.length
      ? Math.round(sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length)
      : 0;
    document.getElementById('stats-avg-score').textContent = avgScore;

    const list = document.getElementById('recent-list');
    if (sessions.length === 0) {
      list.innerHTML = '<div class="recent-empty">暂无记录</div>';
      return;
    }
    list.innerHTML = sessions.slice(0, 50).map(s => {
      const date = new Date(s.completedAt);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      const cls = s.won ? 'is-win' : 'is-loss';
      const modeLabel = s.mode === 'wrap' ? '穿墙' : '经典';
      return `
        <div class="recent-item ${cls}">
          <div class="recent-main">
            <span class="recent-result">${s.won ? '胜利' : '失败'}</span>
            <span class="recent-date">${dateStr}</span>
          </div>
          <div class="recent-meta">
            <span>得分 <strong>${s.score}</strong></span>
            <span>长度 <strong>${s.length}</strong></span>
            <span>模式 <strong>${modeLabel}</strong></span>
          </div>
        </div>
      `;
    }).join('');
  }
  syncRecentPanelHeight();

  function syncRecentPanelHeight() {
    if (!summaryPanelEl || !recentPanelEl) return;
    if (window.innerWidth <= 760) {
      recentPanelEl.style.height = '320px';
      return;
    }
    recentPanelEl.style.height = '';
    const h = Math.ceil(summaryPanelEl.getBoundingClientRect().height);
    if (h > 0) recentPanelEl.style.height = `${h}px`;
  }

  function formatDuration(ms) {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return sec + 's';
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    if (min < 60) return `${min}m ${s}s`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
  }

  /* ---------- Save / Load ---------- */

  function saveGame() {
    if (state.isOver) {
      localStorage.removeItem(SAVE_KEY);
      return;
    }
    const data = {
      snake: state.snake,
      dir: state.dir,
      nextDir: state.nextDir,
      food: state.food,
      score: state.score,
      speed: state.speed,
      isPaused: true,
      mode: state.mode,
      cellCount: state.cellCount,
      elapsed: state.isPaused ? state.elapsed : state.elapsed + (Date.now() - state.startTime),
      version: 1
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  function tryLoadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      if (!data.snake || !Array.isArray(data.snake)) return false;
      if (data.cellCount && data.cellCount !== state.cellCount) {
        localStorage.removeItem(SAVE_KEY);
        return false;
      }
      state.snake = data.snake;
      state.dir = data.dir || { x: 0, y: -1 };
      state.nextDir = data.nextDir || { x: 0, y: -1 };
      state.food = data.food || { x: 0, y: 0 };
      state.score = data.score || 0;
      state.speed = data.speed || 150;
      state.isPaused = true;
      state.mode = data.mode || 'classic';
      state.elapsed = data.elapsed || 0;
      state.startTime = Date.now();
      if (modeSelect) modeSelect.value = state.mode;
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- Controls ---------- */

  function setDirection(x, y) {
    if (isDying) return;
    if (!isStarted) {
      startGame();
    }
    if (state.dir.x !== -x || state.dir.y !== -y) {
      state.nextDir = { x, y };
    }
  }

  function setupControls() {
    document.addEventListener('keydown', e => {
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': setDirection(0, -1); break;
        case 'ArrowDown': case 's': case 'S': setDirection(0, 1); break;
        case 'ArrowLeft': case 'a': case 'A': setDirection(-1, 0); break;
        case 'ArrowRight': case 'd': case 'D': setDirection(1, 0); break;
        case ' ':
          e.preventDefault();
          if (!isStarted) startGame();
          else togglePause();
          break;
        case 'r': case 'R': confirmNewGame(); break;
        case '?': showHelp(); break;
        case 'Escape':
          if (!helpOverlay.hidden) hideHelp();
          else if (!confirmOverlay.hidden) cancelConfirm();
          else if (!goOverlay.hidden) { /* ESC on gameover does nothing */ }
          else if (isStarted) togglePause();
          break;
      }
    });

    boardEl.addEventListener('touchstart', e => {
      if (!isStarted) {
        startGame();
      }
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });

    boardEl.addEventListener('touchend', e => {
      if (!isStarted) return;
      if (!touchStart) return;
      const dx = e.changedTouches[0].clientX - touchStart.x;
      const dy = e.changedTouches[0].clientY - touchStart.y;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (Math.max(adx, ady) < 24) return;
      if (adx > ady) {
        setDirection(dx > 0 ? 1 : -1, 0);
      } else {
        setDirection(0, dy > 0 ? 1 : -1);
      }
      touchStart = null;
    }, { passive: true });
  }

  function setupUI() {
    document.getElementById('btn-new').addEventListener('click', confirmNewGame);
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    document.getElementById('btn-help').addEventListener('click', showHelp);
    document.getElementById('overlay-new').addEventListener('click', newGame);
    document.getElementById('pause-resume').addEventListener('click', togglePause);
    document.getElementById('help-close').addEventListener('click', hideHelp);
    document.getElementById('confirm-cancel').addEventListener('click', cancelConfirm);
    document.getElementById('confirm-ok').addEventListener('click', () => {
      confirmOverlay.hidden = true;
      newGame();
    });

    if (startOverlay) {
      startOverlay.addEventListener('click', e => {
        if (e.target.id !== 'start-btn') startGame();
      });
    }
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', startGame);
    }

    if (modeSelect) {
      modeSelect.addEventListener('change', e => {
        state.mode = e.target.value;
        updateStats();
        if (!state.isOver) confirmNewGame();
      });
      if (typeof window.buildCustomDropdown === 'function') {
        window.buildCustomDropdown(modeSelect);
      }
    }
  }

  /* ---------- Init ---------- */

  function init() {
    loadHighScore();
    buildBoard();
    setupControls();
    setupUI();

    if (tryLoadGame()) {
      render();
      updateStats();
      isStarted = false;
      if (startOverlay) startOverlay.hidden = false;
      renderStatsPanel();
    } else {
      newGame();
    }

    // Handle resize: if cellCount changes, start a new game
    let lastCellCount = state.cellCount;
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      const prevCount = state.cellCount;
      calculateBoardSize();
      if (state.cellCount !== prevCount) {
        buildBoard();
        newGame();
      } else if (state.cellCount !== lastCellCount) {
        // CSS variable update only
        boardEl.style.gridTemplateColumns = `repeat(${state.cellCount}, ${state.cellSize}px)`;
        boardEl.style.gridTemplateRows = `repeat(${state.cellCount}, ${state.cellSize}px)`;
      }
      lastCellCount = state.cellCount;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(syncRecentPanelHeight, 80);
    });
  }

  init();
})();
