/* ===== Tetris 俄罗斯方块 ===== */

(function() {
  'use strict';

  const SAVE_KEY = 'game_tetris_save_v2';
  const STATS_KEY = 'game_tetris_stats_v2';

  const COLS = 10;
  const ROWS = 20;
  const PREVIEW_COUNT = 3;
  const LOCK_DELAY = 500;
  const MAX_LOCK_RESETS = 15;

  const SHAPES = {
    I: {
      blocks: [
        [[0,1],[1,1],[2,1],[3,1]],
        [[2,0],[2,1],[2,2],[2,3]],
        [[0,2],[1,2],[2,2],[3,2]],
        [[1,0],[1,1],[1,2],[1,3]]
      ],
      color: 'piece-I'
    },
    O: {
      blocks: [
        [[1,0],[2,0],[1,1],[2,1]],
        [[1,0],[2,0],[1,1],[2,1]],
        [[1,0],[2,0],[1,1],[2,1]],
        [[1,0],[2,0],[1,1],[2,1]]
      ],
      color: 'piece-O'
    },
    T: {
      blocks: [
        [[1,0],[0,1],[1,1],[2,1]],
        [[1,0],[1,1],[2,1],[1,2]],
        [[0,1],[1,1],[2,1],[1,2]],
        [[1,0],[0,1],[1,1],[1,2]]
      ],
      color: 'piece-T'
    },
    S: {
      blocks: [
        [[1,0],[2,0],[0,1],[1,1]],
        [[1,0],[1,1],[2,1],[2,2]],
        [[1,1],[2,1],[0,2],[1,2]],
        [[0,0],[0,1],[1,1],[1,2]]
      ],
      color: 'piece-S'
    },
    Z: {
      blocks: [
        [[0,0],[1,0],[1,1],[2,1]],
        [[2,0],[1,1],[2,1],[1,2]],
        [[0,1],[1,1],[1,2],[2,2]],
        [[1,0],[0,1],[1,1],[0,2]]
      ],
      color: 'piece-Z'
    },
    J: {
      blocks: [
        [[0,0],[0,1],[1,1],[2,1]],
        [[1,0],[2,0],[1,1],[1,2]],
        [[0,1],[1,1],[2,1],[2,2]],
        [[1,0],[1,1],[0,2],[1,2]]
      ],
      color: 'piece-J'
    },
    L: {
      blocks: [
        [[2,0],[0,1],[1,1],[2,1]],
        [[1,0],[1,1],[1,2],[2,2]],
        [[0,1],[1,1],[2,1],[0,2]],
        [[0,0],[1,0],[1,1],[1,2]]
      ],
      color: 'piece-L'
    }
  };

  // SRS wall kicks: JLSTZ
  const WALL_KICKS_JLSTZ = {
    '0_1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '1_0': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '1_2': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '2_1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '2_3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '3_2': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '3_0': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '0_3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]]
  };

  // SRS wall kicks: I
  const WALL_KICKS_I = {
    '0_1': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '1_0': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '1_2': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    '2_1': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '2_3': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '3_2': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '3_0': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '0_3': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]]
  };

  const PIECE_KEYS = ['I','O','T','S','Z','J','L'];

  let state = {
    board: [],
    current: null,
    hold: '',
    canHold: true,
    bag: [],
    next: [],
    score: 0,
    highScore: 0,
    lines: 0,
    level: 1,
    isPaused: false,
    isOver: false,
    isStarted: false,
    startTime: 0,
    elapsed: 0,
    lockTimer: null,
    lockResets: 0,
    interval: null,
    isDying: false
  };

  let cells = [];
  let holdCells = [];
  let nextCellsList = [];
  let touchStart = null;

  const boardEl = document.getElementById('board');
  const holdBoardEl = document.getElementById('hold-board');
  const nextListEl = document.getElementById('next-list');
  const scoreEl = document.getElementById('stat-score');
  const linesEl = document.getElementById('stat-lines');
  const levelEl = document.getElementById('stat-level');
  const highEl = document.getElementById('stat-high');
  const goOverlay = document.getElementById('gameover-overlay');
  const pauseOverlay = document.getElementById('pause-overlay');
  const helpOverlay = document.getElementById('help-overlay');
  const startOverlay = document.getElementById('start-overlay');
  const summaryPanelEl = document.querySelector('.stats-section .stats-panel:not(.recent-panel)');
  const recentPanelEl = document.querySelector('.recent-panel');

  /* ---------- Board builders ---------- */

  function buildBoard() {
    cells = [];
    const frag = document.createDocumentFragment();
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      for (let x = 0; x < COLS; x++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        frag.appendChild(cell);
        row.push(cell);
      }
      cells.push(row);
    }
    boardEl.innerHTML = '';
    boardEl.appendChild(frag);
  }

  function buildHold() {
    holdCells = [];
    const frag = document.createDocumentFragment();
    for (let y = 0; y < 4; y++) {
      const row = [];
      for (let x = 0; x < 4; x++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        frag.appendChild(cell);
        row.push(cell);
      }
      holdCells.push(row);
    }
    holdBoardEl.innerHTML = '';
    holdBoardEl.appendChild(frag);
  }

  function buildNext() {
    nextCellsList = [];
    nextListEl.innerHTML = '';
    for (let i = 0; i < PREVIEW_COUNT; i++) {
      const mini = document.createElement('div');
      mini.className = 'next-mini';
      const cells = [];
      const frag = document.createDocumentFragment();
      for (let y = 0; y < 4; y++) {
        const row = [];
        for (let x = 0; x < 4; x++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          frag.appendChild(cell);
          row.push(cell);
        }
        cells.push(row);
      }
      mini.appendChild(frag);
      nextListEl.appendChild(mini);
      nextCellsList.push(cells);
    }
  }

  /* ---------- Core game logic ---------- */

  function createEmptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(''));
  }

  function refillBag() {
    const bag = [...PIECE_KEYS];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  function popBag() {
    if (state.bag.length === 0) state.bag = refillBag();
    return state.bag.pop();
  }

  function ensureNext() {
    while (state.next.length < PREVIEW_COUNT) {
      state.next.push(popBag());
    }
  }

  function getBlocks(key, rot) {
    return SHAPES[key].blocks[rot];
  }

  function isValidPosition(key, x, y, rot) {
    const blocks = getBlocks(key, rot);
    for (const [bx, by] of blocks) {
      const px = x + bx;
      const py = y + by;
      if (px < 0 || px >= COLS || py >= ROWS) return false;
      if (py >= 0 && state.board[py][px]) return false;
    }
    return true;
  }

  function spawnPiece() {
    ensureNext();
    const key = state.next.shift();
    ensureNext();

    const piece = {
      key: key,
      x: 0,
      y: 0,
      rot: 0
    };
    const blocks = getBlocks(key, 0);
    const minX = Math.min(...blocks.map(b => b[0]));
    const maxX = Math.max(...blocks.map(b => b[0]));
    const width = maxX - minX + 1;
    piece.x = Math.floor((COLS - width) / 2) - minX;
    piece.y = 0;

    if (!isValidPosition(key, piece.x, piece.y, piece.rot)) {
      gameOver();
      return false;
    }
    state.current = piece;
    state.canHold = true;
    state.lockResets = 0;
    clearLockTimer();
    return true;
  }

  function tryRotate(dir) {
    if (!state.current || state.isOver || !state.isStarted) return false;
    const piece = state.current;
    const newRot = (piece.rot + dir + 4) % 4;
    const kicks = piece.key === 'I'
      ? WALL_KICKS_I[`${piece.rot}_${newRot}`]
      : (piece.key === 'O' ? [[0,0]] : WALL_KICKS_JLSTZ[`${piece.rot}_${newRot}`]);

    for (const [kx, ky] of kicks) {
      if (isValidPosition(piece.key, piece.x + kx, piece.y + ky, newRot)) {
        piece.x += kx;
        piece.y += ky;
        piece.rot = newRot;
        // Reset lock delay if piece is on ground and we have resets left
        if (!isValidPosition(piece.key, piece.x, piece.y + 1, piece.rot) && state.lockResets < MAX_LOCK_RESETS) {
          state.lockResets++;
          clearLockTimer();
        }
        render();
        saveGame();
        return true;
      }
    }
    return false;
  }

  function lockPiece() {
    if (!state.current) return;
    const piece = state.current;
    const blocks = getBlocks(piece.key, piece.rot);
    for (const [bx, by] of blocks) {
      const px = piece.x + bx;
      const py = piece.y + by;
      if (py >= 0) state.board[py][px] = piece.key;
    }
    clearLockTimer();
    clearLines();
    spawnPiece();
    render();
    saveGame();
  }

  function clearLines() {
    let clearedRows = [];
    for (let y = ROWS - 1; y >= 0; y--) {
      if (state.board[y].every(cell => cell !== '')) {
        clearedRows.push(y);
      }
    }
    if (clearedRows.length === 0) return;

    // Animate
    for (const y of clearedRows) {
      for (let x = 0; x < COLS; x++) {
        cells[y][x].classList.add('clearing');
      }
    }

    // Delay actual clear for animation
    setTimeout(() => {
      for (const y of clearedRows) {
        state.board.splice(y, 1);
        state.board.unshift(Array(COLS).fill(''));
      }
      state.lines += clearedRows.length;
      const pts = [0, 100, 300, 500, 800];
      state.score += (pts[clearedRows.length] || 0) * state.level;
      if (state.score > state.highScore) state.highScore = state.score;
      const newLevel = Math.floor(state.lines / 10) + 1;
      if (newLevel > state.level) {
        state.level = newLevel;
        restartLoop();
      }
      updateStats();
      render();
      saveGame();
    }, 260);
  }

  function getGhostY() {
    if (!state.current) return state.current ? state.current.y : 0;
    let gy = state.current.y;
    while (isValidPosition(state.current.key, state.current.x, gy + 1, state.current.rot)) {
      gy++;
    }
    return gy;
  }

  function clearLockTimer() {
    if (state.lockTimer) {
      clearTimeout(state.lockTimer);
      state.lockTimer = null;
    }
  }

  function startLockTimer() {
    clearLockTimer();
    state.lockTimer = setTimeout(() => {
      lockPiece();
    }, LOCK_DELAY);
  }

  function drop() {
    if (state.isPaused || state.isOver || !state.isStarted || !state.current) return;
    if (isValidPosition(state.current.key, state.current.x, state.current.y + 1, state.current.rot)) {
      state.current.y++;
      state.score += 1;
      if (state.score > state.highScore) state.highScore = state.score;
      clearLockTimer();
      updateStats();
      render();
      saveGame();
    } else {
      if (!state.lockTimer) {
        startLockTimer();
      }
    }
  }

  function hardDrop() {
    if (state.isPaused || state.isOver || !state.isStarted || !state.current) return;
    let dist = 0;
    while (isValidPosition(state.current.key, state.current.x, state.current.y + 1, state.current.rot)) {
      state.current.y++;
      dist++;
    }
    state.score += dist * 2;
    if (state.score > state.highScore) state.highScore = state.score;
    clearLockTimer();
    lockPiece();
    updateStats();
  }

  function move(dx) {
    if (state.isPaused || state.isOver || !state.isStarted || !state.current) return;
    if (isValidPosition(state.current.key, state.current.x + dx, state.current.y, state.current.rot)) {
      state.current.x += dx;
      // Reset lock delay if on ground
      if (!isValidPosition(state.current.key, state.current.x, state.current.y + 1, state.current.rot) && state.lockResets < MAX_LOCK_RESETS) {
        state.lockResets++;
        clearLockTimer();
      }
      render();
      saveGame();
    }
  }

  function doHold() {
    if (state.isPaused || state.isOver || !state.isStarted || !state.canHold) return;
    const currentKey = state.current.key;
    clearLockTimer();
    if (state.hold) {
      state.current = { key: state.hold, x: 0, y: 0, rot: 0 };
      const blocks = getBlocks(state.hold, 0);
      const minX = Math.min(...blocks.map(b => b[0]));
      const maxX = Math.max(...blocks.map(b => b[0]));
      const width = maxX - minX + 1;
      state.current.x = Math.floor((COLS - width) / 2) - minX;
      if (!isValidPosition(state.current.key, state.current.x, state.current.y, state.current.rot)) {
        gameOver();
        return;
      }
    } else {
      spawnPiece();
    }
    state.hold = currentKey;
    state.canHold = false;
    state.lockResets = 0;
    render();
    saveGame();
  }

  function getSpeed() {
    return Math.max(100, 1000 - (state.level - 1) * 80);
  }

  /* ---------- Rendering ---------- */

  function render() {
    // Clear board
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = cells[y][x];
        cell.className = 'cell';
        cell.style.background = '';
        cell.style.boxShadow = '';
      }
    }

    // Draw locked blocks
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const key = state.board[y][x];
        if (key) {
          cells[y][x].className = `cell ${SHAPES[key].color}`;
        }
      }
    }

    // Draw ghost
    if (state.current && !state.isOver) {
      const ghostY = getGhostY();
      const blocks = getBlocks(state.current.key, state.current.rot);
      for (const [bx, by] of blocks) {
        const px = state.current.x + bx;
        const py = ghostY + by;
        if (py >= 0 && px >= 0 && px < COLS && py < ROWS && !state.board[py][px]) {
          cells[py][px].classList.add('ghost');
        }
      }
    }

    // Draw current piece
    if (state.current && !state.isOver) {
      const blocks = getBlocks(state.current.key, state.current.rot);
      for (const [bx, by] of blocks) {
        const px = state.current.x + bx;
        const py = state.current.y + by;
        if (py >= 0 && px >= 0 && px < COLS && py < ROWS) {
          cells[py][px].className = `cell ${SHAPES[state.current.key].color}`;
        }
      }
    }

    // Hold
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        holdCells[y][x].className = 'cell';
      }
    }
    if (state.hold) {
      const blocks = getBlocks(state.hold, 0);
      for (const [bx, by] of blocks) {
        if (by >= 0 && by < 4 && bx >= 0 && bx < 4) {
          holdCells[by][bx].className = `cell ${SHAPES[state.hold].color}`;
        }
      }
    }

    // Next previews
    for (let i = 0; i < PREVIEW_COUNT; i++) {
      const miniCells = nextCellsList[i];
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          miniCells[y][x].className = 'cell';
        }
      }
      if (state.next[i]) {
        const blocks = getBlocks(state.next[i], 0);
        for (const [bx, by] of blocks) {
          if (by >= 0 && by < 4 && bx >= 0 && bx < 4) {
            miniCells[by][bx].className = `cell ${SHAPES[state.next[i]].color}`;
          }
        }
      }
    }
  }

  /* ---------- Game flow ---------- */

  function newGame() {
    clearInterval(state.interval);
    state.interval = null;
    clearLockTimer();
    state.isDying = false;
    state.isStarted = false;
    state.board = createEmptyBoard();
    state.current = null;
    state.hold = '';
    state.canHold = true;
    state.bag = [];
    state.next = [];
    state.score = 0;
    state.lines = 0;
    state.level = 1;
    state.isPaused = false;
    state.isOver = false;
    state.startTime = 0;
    state.elapsed = 0;
    state.lockResets = 0;

    goOverlay.hidden = true;
    if (pauseOverlay) pauseOverlay.hidden = true;
    if (startOverlay) startOverlay.hidden = false;

    spawnPiece();
    render();
    updateStats();
    saveGame();
    renderStatsPanel();
  }

  function startGame() {
    if (state.isStarted) return;
    state.isStarted = true;
    if (startOverlay) startOverlay.hidden = true;
    state.isPaused = false;
    state.startTime = Date.now();
    startLoop();
  }

  function startLoop() {
    clearInterval(state.interval);
    state.interval = setInterval(drop, getSpeed());
  }

  function restartLoop() {
    clearInterval(state.interval);
    startLoop();
  }

  function gameOver() {
    if (state.isDying) return;
    state.isDying = true;
    state.isOver = true;
    clearInterval(state.interval);
    state.interval = null;
    clearLockTimer();

    saveStats();
    localStorage.removeItem(SAVE_KEY);

    document.getElementById('final-score').textContent = state.score;
    document.getElementById('final-lines').textContent = state.lines;
    document.getElementById('final-level').textContent = state.level;
    goOverlay.hidden = false;

    if (typeof launchConfetti === 'function' && state.score >= 1000) {
      launchConfetti();
    }
    renderStatsPanel();
  }

  /* ---------- Pause / overlays ---------- */

  function togglePause() {
    if (state.isOver) return;
    if (!state.isStarted) {
      startGame();
      return;
    }
    state.isPaused = !state.isPaused;
    if (pauseOverlay) pauseOverlay.hidden = !state.isPaused;
    if (state.isPaused) {
      state.elapsed += Date.now() - state.startTime;
      clearInterval(state.interval);
      state.interval = null;
      clearLockTimer();
    } else {
      state.startTime = Date.now();
      startLoop();
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
    if (!state.isOver && state.isStarted) {
      if (!state.isPaused) togglePause();
      goOverlay.hidden = true;
      newGame();
    } else {
      newGame();
    }
  }

  /* ---------- Stats ---------- */

  function updateStats() {
    scoreEl.textContent = state.score;
    linesEl.textContent = state.lines;
    levelEl.textContent = state.level;
    highEl.textContent = state.highScore;
  }

  function saveStats() {
    const raw = localStorage.getItem(STATS_KEY);
    const data = raw ? JSON.parse(raw) : { started: 0, sessions: [] };
    data.started = (data.started || 0) + 1;
    const duration = state.elapsed + (Date.now() - state.startTime);
    data.sessions.unshift({
      score: state.score,
      lines: state.lines,
      level: state.level,
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
    document.getElementById('stats-best-score').textContent = state.highScore;
    document.getElementById('stats-best-level').textContent = sessions.reduce((m, s) => Math.max(m, s.level || 0), 0);
    document.getElementById('stats-total-lines').textContent = sessions.reduce((sum, s) => sum + (s.lines || 0), 0);

    const avgScore = sessions.length
      ? Math.round(sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length)
      : 0;
    document.getElementById('stats-avg-score').textContent = avgScore;

    const longest = sessions.length
      ? Math.max(...sessions.map(s => s.duration || 0))
      : 0;
    document.getElementById('stats-longest').textContent = formatDuration(longest);

    const list = document.getElementById('recent-list');
    if (sessions.length === 0) {
      list.innerHTML = '<div class="recent-empty">暂无记录</div>';
    } else {
      list.innerHTML = sessions.slice(0, 10).map(s => {
        const date = new Date(s.completedAt);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        return `
          <div class="recent-item">
            <div class="recent-main">
              <span class="recent-result">得分 ${s.score}</span>
              <span class="recent-date">${dateStr}</span>
            </div>
            <div class="recent-meta">
              <span>行数 <strong>${s.lines}</strong></span>
              <span>等级 <strong>${s.level}</strong></span>
              <span>时长 <strong>${formatDuration(s.duration || 0)}</strong></span>
            </div>
          </div>
        `;
      }).join('');
    }
    syncRecentPanelHeight();
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

  /* ---------- Save / Load ---------- */

  function saveGame() {
    if (state.isOver) {
      localStorage.removeItem(SAVE_KEY);
      return;
    }
    const data = {
      board: state.board,
      current: state.current,
      hold: state.hold,
      canHold: state.canHold,
      bag: state.bag,
      next: state.next,
      score: state.score,
      lines: state.lines,
      level: state.level,
      isPaused: true,
      elapsed: state.isPaused
        ? state.elapsed
        : state.elapsed + (Date.now() - state.startTime),
      version: 2
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  function tryLoadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      if (!data.board || !Array.isArray(data.board)) return false;
      state.board = data.board;
      state.current = data.current || null;
      state.hold = data.hold || '';
      state.canHold = data.canHold !== false;
      state.bag = Array.isArray(data.bag) ? data.bag : [];
      state.next = Array.isArray(data.next) ? data.next : [];
      state.score = data.score || 0;
      state.lines = data.lines || 0;
      state.level = data.level || 1;
      state.isPaused = true;
      state.elapsed = data.elapsed || 0;
      state.startTime = Date.now();
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- Controls ---------- */

  function setupControls() {
    document.addEventListener('keydown', e => {
      if (e.repeat) {
        // Allow soft drop repeat, block rotation/move repeat
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          if (!state.isStarted) startGame();
          drop();
        }
        return;
      }
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A':
          if (!state.isStarted) startGame();
          move(-1); break;
        case 'ArrowRight': case 'd': case 'D':
          if (!state.isStarted) startGame();
          move(1); break;
        case 'ArrowUp': case 'w': case 'W':
          if (!state.isStarted) startGame();
          tryRotate(1); break;
        case 'ArrowDown': case 's': case 'S':
          if (!state.isStarted) startGame();
          drop(); break;
        case ' ':
          e.preventDefault();
          if (!state.isStarted) startGame();
          else hardDrop();
          break;
        case 'h': case 'H': case 'c': case 'C':
          if (!state.isStarted) startGame();
          doHold(); break;
        case 'z': case 'Z':
          if (!state.isStarted) startGame();
          tryRotate(-1); break;
        case 'p': case 'P':
          togglePause(); break;
        case 'r': case 'R':
          confirmNewGame(); break;
        case '?':
          showHelp(); break;
        case 'Escape':
          if (!helpOverlay.hidden) hideHelp();
          else togglePause();
          break;
      }
    });

    boardEl.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        if (!state.isStarted) startGame();
        doHold();
        return;
      }
      if (!state.isStarted) {
        startGame();
      }
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: false });

    boardEl.addEventListener('touchend', e => {
      if (!touchStart) return;
      const dx = e.changedTouches[0].clientX - touchStart.x;
      const dy = e.changedTouches[0].clientY - touchStart.y;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (Math.max(adx, ady) < 24) {
        // Tap = rotate
        if (state.isStarted && !state.isPaused && !state.isOver) {
          tryRotate(1);
        }
        touchStart = null;
        return;
      }
      if (adx > ady) {
        move(dx > 0 ? 1 : -1);
      } else {
        if (dy > 40) hardDrop();
        else if (dy > 0) drop();
        else tryRotate(1);
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

    if (startOverlay) {
      startOverlay.addEventListener('click', e => {
        if (e.target.id !== 'start-btn') startGame();
      });
    }
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', startGame);
  }

  /* ---------- Init ---------- */

  function init() {
    loadHighScore();
    buildBoard();
    buildHold();
    buildNext();
    setupControls();
    setupUI();

    if (tryLoadGame()) {
      render();
      updateStats();
      state.isStarted = false;
      if (startOverlay) startOverlay.hidden = false;
      renderStatsPanel();
    } else {
      newGame();
    }

    window.addEventListener('resize', () => {
      syncRecentPanelHeight();
    });
  }

  init();
})();
