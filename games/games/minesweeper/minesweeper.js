const DIFFICULTIES = {
  beginner: { cols: 9, rows: 9, mines: 10 },
  intermediate: { cols: 16, rows: 16, mines: 40 },
  expert: { cols: 30, rows: 16, mines: 99 },
};

const CUSTOM_KEY = "game_minesweeper_custom_v1";

const SAVE_KEY = "game_minesweeper_save_v1";
const BEST_KEY = "game_minesweeper_best_v1";
const STATS_KEY = "game_minesweeper_stats_v1";
const HISTORY_LIMIT = 100;

const $ = (id) => document.getElementById(id);
const boardEl = $("board");
const statMinesEl = $("stat-mines");
const statMovesEl = $("stat-moves");
const statTimeEl = $("stat-time");
const difficultyEl = $("difficulty");
const newBtnEl = $("btn-new");
const undoBtnEl = $("btn-undo");
const hintBtnEl = $("btn-hint");
const keyboardBtnEl = $("btn-keyboard");
const overlayEl = $("overlay");
const overlayTitleEl = $("overlay-title");
const overlayScorelineEl = $("overlay-scoreline");
const overlayUndoEl = $("overlay-undo");
const overlayNewEl = $("overlay-new");
const confirmOverlayEl = $("confirm-overlay");
const confirmOkEl = $("confirm-ok");
const confirmCancelEl = $("confirm-cancel");
const customOverlayEl = $("custom-overlay");
const customColsEl = $("custom-cols");
const customRowsEl = $("custom-rows");
const customMinesEl = $("custom-mines");
const customOkEl = $("custom-ok");
const customCancelEl = $("custom-cancel");
const helpOverlayEl = $("help-overlay");
const helpCloseEl = $("help-close");
const helpBtnEl = $("btn-help");
const customHintEl = $("custom-hint");
const statsStartedEl = $("stats-started");
const statsWonEl = $("stats-won");
const statsWinRateEl = $("stats-win-rate");
const statsBestBeginnerEl = $("stats-best-beginner");
const statsBestIntermediateEl = $("stats-best-intermediate");
const statsBestExpertEl = $("stats-best-expert");
const recentListEl = $("recent-list");
const summaryPanelEl = document.querySelector(".stats-section .stats-panel:not(.recent-panel)");
const recentPanelEl = document.querySelector(".recent-panel");

const state = {
  difficulty: "beginner",
  cols: 9,
  rows: 9,
  totalMines: 10,
  grid: [],
  started: false,
  over: false,
  won: false,
  timer: 0,
  timerInterval: null,
  firstClick: true,
  moves: 0,
  history: [],
  resultRecorded: false,
  hintCell: null,
  hintTimer: null,
  confirmResolve: null,
  focusPos: { r: 0, c: 0 },
  keyboardMode: false,
  safePulsePos: null,
};

// --- Grid helpers ---

function cloneGrid(grid) {
  return grid.map(row => row.map(cell => ({ ...cell })));
}

function createEmptyGrid(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false, revealed: false, flagged: false, questioned: false, count: 0,
    }))
  );
}

function placeMines(grid, rows, cols, totalMines, safeRow, safeCol) {
  const excluded = new Set();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const er = safeRow + dr, ec = safeCol + dc;
      if (er >= 0 && er < rows && ec >= 0 && ec < cols) {
        excluded.add(`${er},${ec}`);
      }
    }
  }
  const available = rows * cols - excluded.size;
  if (totalMines > available) totalMines = available;
  let placed = 0;
  while (placed < totalMines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (grid[r][c].mine || excluded.has(`${r},${c}`)) continue;
    grid[r][c].mine = true;
    placed++;
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].mine) count++;
        }
      }
      grid[r][c].count = count;
    }
  }
}

function revealCell(r, c) {
  if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) return;
  const cell = state.grid[r][c];
  if (cell.revealed || cell.flagged) return;
  cell.revealed = true;
  cell.questioned = false;
  if (cell.count === 0 && !cell.mine) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        revealCell(r + dr, c + dc);
      }
    }
  }
}

function checkWin() {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (!state.grid[r][c].mine && !state.grid[r][c].revealed) return false;
    }
  }
  return true;
}

// --- localStorage ---

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      difficulty: state.difficulty,
      grid: state.grid,
      started: state.started,
      over: state.over,
      won: state.won,
      timer: state.timer,
      firstClick: state.firstClick,
      moves: state.moves,
      resultRecorded: state.resultRecorded,
      cols: state.cols,
      rows: state.rows,
      totalMines: state.totalMines,
    }));
  } catch {}
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.grid)) return false;
    let cfg;
    if (data.difficulty === "custom") {
      cfg = { cols: data.cols || 16, rows: data.rows || 16, mines: data.totalMines || 40 };
    } else {
      if (!DIFFICULTIES[data.difficulty]) return false;
      cfg = DIFFICULTIES[data.difficulty];
    }
    if (data.grid.length !== cfg.rows) return false;
    for (const row of data.grid) {
      if (!Array.isArray(row) || row.length !== cfg.cols) return false;
    }
    state.difficulty = data.difficulty;
    state.cols = cfg.cols;
    state.rows = cfg.rows;
    state.totalMines = cfg.mines;
    state.grid = data.grid;
    state.started = data.started;
    state.over = data.over;
    state.won = data.won;
    state.timer = data.timer;
    state.firstClick = data.firstClick;
    state.moves = data.moves || 0;
    state.resultRecorded = data.resultRecorded !== undefined ? !!data.resultRecorded : !!data.over;
    state.history = Array.isArray(data.history) ? data.history : [];
    return true;
  } catch {
    return false;
  }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
}

function getBestTimes() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch { return {}; }
}

function saveBestTime(difficulty, time) {
  const best = getBestTimes();
  if (!best[difficulty] || time < best[difficulty]) {
    best[difficulty] = time;
    try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch {}
  }
}

function defaultStats() {
  return { version: 2, started: 0, won: 0, sessions: [] };
}

function getStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATS_KEY));
    if (raw && typeof raw.started === "number" && Array.isArray(raw.sessions)) {
      const deduped = [];
      for (const s of raw.sessions) {
        const last = deduped[deduped.length - 1];
        if (
          last &&
          last.difficulty === s.difficulty &&
          last.won === s.won &&
          last.time === s.time &&
          last.moves === s.moves &&
          Math.abs((last.completedAt || 0) - (s.completedAt || 0)) < 2000
        ) {
          continue;
        }
        deduped.push(s);
      }
      let needsSave = false;
      if (deduped.length !== raw.sessions.length) {
        raw.sessions = deduped;
        needsSave = true;
      }
      if (!Number.isFinite(raw.version)) {
        raw.version = 2;
        raw.won = raw.sessions.filter((s) => s.won).length;
        needsSave = true;
      }
      if (needsSave) {
        try { localStorage.setItem(STATS_KEY, JSON.stringify(raw)); } catch {}
      }
      return raw;
    }
  } catch {}
  return defaultStats();
}

function saveStats(stats) {
  try {
    stats.won = stats.sessions.filter((s) => s.won).length;
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {}
}

function recordStart() {
  const stats = getStats();
  stats.started += 1;
  saveStats(stats);
}

function recordResult() {
  if (state.firstClick || state.resultRecorded || state.grid.length === 0) return;
  const now = Date.now();
  const stats = getStats();
  const last = stats.sessions[0];
  if (
    last &&
    last.difficulty === state.difficulty &&
    last.won === state.won &&
    last.time === state.timer &&
    last.moves === state.moves &&
    Math.abs((last.completedAt || 0) - now) < 2000
  ) {
    state.resultRecorded = true;
    return;
  }
  state.resultRecorded = true;
  stats.sessions.unshift({
    difficulty: state.difficulty,
    won: state.won,
    time: state.timer,
    moves: state.moves,
    completedAt: now,
  });
  if (stats.sessions.length > HISTORY_LIMIT) stats.sessions.length = HISTORY_LIMIT;
  saveStats(stats);
  if (state.won) saveBestTime(state.difficulty, state.timer);
}

// --- Timer ---

function startTimer() {
  if (state.timerInterval) return;
  state.timerInterval = setInterval(() => {
    state.timer += 1;
    updateTimerDisplay();
    if (state.timer % 5 === 0) saveGame();
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimerDisplay() {
  const m = Math.floor(state.timer / 60);
  const s = state.timer % 60;
  statTimeEl.textContent = `${m}:${String(s).padStart(2, "0")}`;
}

function updateMinesDisplay() {
  const flagged = state.grid.flat().filter(c => c.flagged).length;
  statMinesEl.textContent = String(state.totalMines - flagged);
}

function updateMovesDisplay() {
  statMovesEl.textContent = String(state.moves);
}

// --- Undo ---

function pushHistory() {
  state.history.push({
    grid: cloneGrid(state.grid),
    moves: state.moves,
    over: state.over,
    won: state.won,
    resultRecorded: state.resultRecorded,
  });
  if (state.history.length > 500) state.history.shift();
}

function undo() {
  if (state.history.length === 0) return;
  const prev = state.history.pop();
  state.grid = prev.grid;
  state.moves = prev.moves;
  state.over = prev.over;
  state.won = prev.won;
  state.resultRecorded = prev.resultRecorded;
  stopTimer();
  if (!state.over) startTimer();
  overlayEl.classList.remove('is-visible');
  setTimeout(() => { overlayEl.hidden = true; }, 250);
  saveGame();
}

// --- Hint ---

function findSafeCell() {
  const candidates = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.grid[r][c];
      if (!cell.revealed && !cell.mine && !cell.flagged) {
        candidates.push({ r, c });
      }
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function showHint() {
  if (state.over || state.firstClick) return;
  clearHint();
  const safe = findSafeCell();
  if (!safe) return;
  state.hintCell = safe;
  const idx = safe.r * state.cols + safe.c;
  const el = boardEl.children[idx];
  if (el) el.classList.add("hint");
  state.hintTimer = setTimeout(clearHint, 2000);
}

function clearHint() {
  if (state.hintTimer) {
    clearTimeout(state.hintTimer);
    state.hintTimer = null;
  }
  if (state.hintCell) {
    const idx = state.hintCell.r * state.cols + state.hintCell.c;
    const el = boardEl.children[idx];
    if (el) el.classList.remove("hint");
    state.hintCell = null;
  }
}

// --- Confirm ---

function showConfirm() {
  return new Promise(resolve => {
    state.confirmResolve = resolve;
    confirmOverlayEl.hidden = false;
    requestAnimationFrame(() => confirmOverlayEl.classList.add('is-visible'));
  });
}

function hideConfirm(result) {
  confirmOverlayEl.classList.remove('is-visible');
  setTimeout(() => { confirmOverlayEl.hidden = true; }, 250);
  if (state.confirmResolve) {
    state.confirmResolve(result);
    state.confirmResolve = null;
  }
}

// --- Stats panel ---

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  const m = Math.floor(ms / 1000 / 60);
  const s = Math.floor(ms / 1000) % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatResultDate(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "-";
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}

const DIFFICULTY_LABELS = { beginner: "初级", intermediate: "中级", expert: "高级", custom: "自定义" };

function renderStatsPanel() {
  const stats = getStats();
  const best = getBestTimes();
  let won = 0;
  for (const s of stats.sessions) {
    if (s.won) won++;
  }

  statsStartedEl.textContent = String(stats.started);
  statsWonEl.textContent = String(won);
  statsWinRateEl.textContent = stats.started > 0 ? `${Math.round((won / stats.started) * 100)}%` : "0%";
  statsBestBeginnerEl.textContent = formatTime(best.beginner);
  statsBestIntermediateEl.textContent = formatTime(best.intermediate);
  statsBestExpertEl.textContent = formatTime(best.expert);

  if (stats.sessions.length === 0) {
    recentListEl.innerHTML = '<div class="recent-empty">还没有已结束的对局记录。</div>';
    syncRecentPanelHeight();
    return;
  }

  recentListEl.innerHTML = stats.sessions.slice(0, 50).map(item => {
    const resultText = item.won ? "扫雷成功" : "踩雷";
    const resultClass = item.won ? "is-win" : "is-loss";
    const diffLabel = DIFFICULTY_LABELS[item.difficulty] || item.difficulty;
    return (
      `<article class="recent-item ${resultClass}">` +
      '<div class="recent-main">' +
      `<strong class="recent-result">${resultText}</strong>` +
      `<span class="recent-date">${formatResultDate(item.completedAt)}</span>` +
      '</div>' +
      '<div class="recent-meta">' +
      `<span>难度 <strong>${diffLabel}</strong></span>` +
      `<span>用时 <strong>${formatTime(item.time)}</strong></span>` +
      `<span>步数 <strong>${item.moves || 0}</strong></span>` +
      '</div>' +
      '</article>'
    );
  }).join('');

  syncRecentPanelHeight();
}

function syncRecentPanelHeight() {
  if (!summaryPanelEl || !recentPanelEl) return;
  if (window.innerWidth <= 760) {
    recentPanelEl.style.height = "320px";
    return;
  }
  recentPanelEl.style.height = "";
  const h = Math.ceil(summaryPanelEl.getBoundingClientRect().height);
  if (h > 0) recentPanelEl.style.height = `${h}px`;
}

// --- Keyboard focus ---

function moveFocus(dr, dc) {
  if (state.grid.length === 0) return;
  let nr = state.focusPos.r + dr;
  let nc = state.focusPos.c + dc;
  nr = Math.max(0, Math.min(state.rows - 1, nr));
  nc = Math.max(0, Math.min(state.cols - 1, nc));
  state.focusPos = { r: nr, c: nc };
  render();
}

function handleFocusClick() {
  if (state.grid.length === 0) return;
  handleClick(state.focusPos.r, state.focusPos.c);
}

function handleFocusFlag() {
  if (state.grid.length === 0) return;
  handleRightClick(state.focusPos.r, state.focusPos.c);
}

// --- Rendering ---

function animateReveal(cells, centerR, centerC) {
  if (cells.length === 0) return;
  cells.sort((a, b) => {
    const da = Math.hypot(a.r - centerR, a.c - centerC);
    const db = Math.hypot(b.r - centerR, b.c - centerC);
    return da - db;
  });

  cells.forEach(({ r, c }) => {
    const idx = r * state.cols + c;
    const el = boardEl.children[idx];
    if (el) {
      el.style.transition = 'none';
      el.style.transform = 'scale(0.3)';
      el.style.opacity = '0';
    }
  });

  void boardEl.offsetHeight;

  const delayPerCell = 20;
  const colsSnapshot = state.cols;
  cells.forEach(({ r, c }, i) => {
    setTimeout(() => {
      const idx = r * colsSnapshot + c;
      const el = boardEl.children[idx];
      if (el) {
        el.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease';
        el.style.transform = 'scale(1)';
        el.style.opacity = '1';
      }
    }, i * delayPerCell);
  });

  setTimeout(() => {
    cells.forEach(({ r, c }) => {
      const idx = r * colsSnapshot + c;
      const el = boardEl.children[idx];
      if (el) {
        el.style.transition = '';
        el.style.transform = '';
        el.style.opacity = '';
      }
    });
  }, cells.length * delayPerCell + 400);
}

function celebrateReveal(cells, centerR, centerC) {
  if (cells.length === 0) return;
  cells.sort((a, b) => {
    const da = Math.hypot(a.r - centerR, a.c - centerC);
    const db = Math.hypot(b.r - centerR, b.c - centerC);
    return da - db;
  });

  cells.forEach(({ r, c }) => {
    const idx = r * state.cols + c;
    const el = boardEl.children[idx];
    if (el) {
      el.style.transition = 'none';
      el.style.transform = 'scale(0.85)';
    }
  });

  void boardEl.offsetHeight;

  const delayPerCell = 15;
  const colsSnapshot = state.cols;
  cells.forEach(({ r, c }, i) => {
    setTimeout(() => {
      const idx = r * colsSnapshot + c;
      const el = boardEl.children[idx];
      if (el) {
        el.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';
        el.style.transform = 'scale(1)';
      }
    }, i * delayPerCell);
  });

  setTimeout(() => {
    cells.forEach(({ r, c }) => {
      const idx = r * colsSnapshot + c;
      const el = boardEl.children[idx];
      if (el) {
        el.style.transition = '';
        el.style.transform = '';
      }
    });
  }, cells.length * delayPerCell + 400);
}

function render() {
  if (!state.grid || state.grid.length === 0) return;
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${state.cols}, var(--cell-size))`;

  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.grid[r][c];
      const el = document.createElement("div");
      el.className = "cell";
      el.dataset.row = r;
      el.dataset.col = c;

      if (cell.revealed) {
        el.classList.add("revealed");
        if (cell.mine) {
          el.classList.add("mine");
        } else if (cell.count > 0) {
          el.dataset.count = cell.count;
          el.textContent = cell.count;
        }
      } else if (cell.flagged) {
        el.classList.add("flagged");
      } else if (cell.questioned) {
        el.classList.add("questioned");
      }

      if (state.over && !state.won && cell.mine && !cell.flagged && !cell.revealed) {
        el.classList.add("mine-show");
      }

      if (state.keyboardMode && r === state.focusPos.r && c === state.focusPos.c) {
        el.classList.add("focused");
        el.setAttribute("tabindex", "0");
      } else {
        el.setAttribute("tabindex", "-1");
      }

      boardEl.appendChild(el);
    }
  }

  const focusedEl = boardEl.querySelector(".cell.focused");
  if (focusedEl) focusedEl.focus({ preventScroll: true });

  // Safe-zone pulse on first click
  if (state.safePulsePos) {
    if (Date.now() < state.safePulsePos.until) {
      const sr = state.safePulsePos.r, sc = state.safePulsePos.c;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r2 = sr + dr, c2 = sc + dc;
          if (r2 >= 0 && r2 < state.rows && c2 >= 0 && c2 < state.cols) {
            const idx = r2 * state.cols + c2;
            const el = boardEl.children[idx];
            if (el) el.classList.add('safe-pulse');
          }
        }
      }
    } else {
      state.safePulsePos = null;
    }
  }

  updateMinesDisplay();
  updateMovesDisplay();
  updateTimerDisplay();
  undoBtnEl.disabled = state.history.length === 0;
  renderStatsPanel();
}

function markHitCell(r, c) {
  const idx = r * state.cols + c;
  const el = boardEl.children[idx];
  if (el) {
    el.classList.add("mine-hit");
    el.classList.remove("mine-show");
  }
}

// --- Overlay ---

/* confetti shared: scripts/confetti.js */

function showOverlay(won) {
  const cfg = DIFFICULTIES[state.difficulty] || { cols: state.cols, rows: state.rows, mines: state.totalMines };
  if (won) {
    overlayTitleEl.textContent = "扫雷成功！";
    const m = Math.floor(state.timer / 60);
    const s = state.timer % 60;
    overlayScorelineEl.textContent = `用时 ${m}:${String(s).padStart(2, "0")} · ${cfg.cols}×${cfg.rows} · ${state.totalMines} 雷 · ${state.moves} 步`;
    overlayUndoEl.hidden = true;
    launchConfetti();
  } else {
    overlayTitleEl.textContent = "踩雷了！";
    overlayScorelineEl.textContent = "撤销一步还能继续尝试，或者直接开始下一局。";
    overlayUndoEl.hidden = state.history.length === 0;
  }
  overlayEl.hidden = false;
  requestAnimationFrame(() => overlayEl.classList.add('is-visible'));
}

// --- Game actions ---

function getDifficultyConfig(difficulty) {
  if (difficulty === "custom") {
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      if (raw) {
        const c = JSON.parse(raw);
        return { cols: c.cols || 16, rows: c.rows || 16, mines: c.mines || 40 };
      }
    } catch {}
    return { cols: 16, rows: 16, mines: 40 };
  }
  return DIFFICULTIES[difficulty];
}

function startNewGame(difficulty) {
  stopTimer();
  clearHint();
  if (state.over) {
    recordResult();
  }

  state.difficulty = difficulty || state.difficulty;
  const cfg = getDifficultyConfig(state.difficulty);
  state.cols = cfg.cols;
  state.rows = cfg.rows;
  state.totalMines = cfg.mines;
  state.grid = createEmptyGrid(cfg.rows, cfg.cols);
  state.started = false;
  state.over = false;
  state.won = false;
  state.timer = 0;
  state.firstClick = true;
  state.moves = 0;
  state.history = [];
  state.resultRecorded = false;
  state.focusPos = { r: Math.floor(state.rows / 2), c: Math.floor(state.cols / 2) };

  clearSave();
  recordStart();
  difficultyEl.value = state.difficulty;
  overlayEl.classList.remove('is-visible');
  setTimeout(() => { overlayEl.hidden = true; }, 250);
  render();
  saveGame();
}

async function requestNewGame(difficulty) {
  if (difficulty === "custom") {
    if (!state.firstClick && !state.over) {
      const ok = await showConfirm();
      if (!ok) return;
    }
    showCustomOverlay();
    return;
  }
  if (!state.firstClick && !state.over) {
    const ok = await showConfirm();
    if (!ok) return;
  }
  startNewGame(difficulty);
}

function showCustomOverlay() {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      customColsEl.value = c.cols || 16;
      customRowsEl.value = c.rows || 16;
      customMinesEl.value = c.mines || 40;
    } else {
      customColsEl.value = 16;
      customRowsEl.value = 16;
      customMinesEl.value = 40;
    }
  } catch {
    customColsEl.value = 16;
    customRowsEl.value = 16;
    customMinesEl.value = 40;
  }
  customHintEl.textContent = "宽 5~50 · 高 5~30 · 雷数不超过格数减 1";
  customHintEl.style.color = "var(--muted)";
  customOverlayEl.hidden = false;
  requestAnimationFrame(() => customOverlayEl.classList.add('is-visible'));
}

function hideCustomOverlay() {
  customOverlayEl.classList.remove('is-visible');
  setTimeout(() => { customOverlayEl.hidden = true; }, 250);
}

function showHelpOverlay() {
  helpOverlayEl.hidden = false;
  requestAnimationFrame(() => helpOverlayEl.classList.add('is-visible'));
}

function hideHelpOverlay() {
  helpOverlayEl.classList.remove('is-visible');
  setTimeout(() => { helpOverlayEl.hidden = true; }, 250);
}

function validateCustom() {
  const cols = Math.floor(Number(customColsEl.value));
  const rows = Math.floor(Number(customRowsEl.value));
  const mines = Math.floor(Number(customMinesEl.value));

  if (isNaN(cols) || cols < 5 || cols > 50) {
    customHintEl.textContent = "宽度需要在 5~50 之间";
    customHintEl.style.color = "var(--danger)";
    return null;
  }
  if (isNaN(rows) || rows < 5 || rows > 30) {
    customHintEl.textContent = "高度需要在 5~30 之间";
    customHintEl.style.color = "var(--danger)";
    return null;
  }
  const maxCells = cols * rows;
  if (isNaN(mines) || mines < 1 || mines > maxCells - 1) {
    customHintEl.textContent = `雷数需要在 1~${maxCells - 1} 之间`;
    customHintEl.style.color = "var(--danger)";
    return null;
  }
  return { cols, rows, mines };
}

function startCustomGame() {
  const cfg = validateCustom();
  if (!cfg) return;
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(cfg)); } catch {}
  hideCustomOverlay();
  startNewGame("custom");
}

function handleClick(r, c) {
  if (state.over) return;
  const cell = state.grid[r][c];
  if (cell.revealed || cell.flagged) return;
  clearHint();

  if (state.firstClick) {
    state.firstClick = false;
    state.started = true;
    placeMines(state.grid, state.rows, state.cols, state.totalMines, r, c);
    startTimer();
    state.safePulsePos = { r, c, until: Date.now() + 500 };
  }

  pushHistory();

  if (cell.mine) {
    state.over = true;
    state.won = false;
    state.moves += 1;
    stopTimer();
    cell.revealed = true;
    const unrevealedMines = [];
    for (let r2 = 0; r2 < state.rows; r2++) {
      for (let c2 = 0; c2 < state.cols; c2++) {
        const other = state.grid[r2][c2];
        if (other.mine && !other.revealed && !other.flagged) {
          unrevealedMines.push({ r: r2, c: c2 });
        }
      }
    }
    render();
    markHitCell(r, c);
    animateReveal(unrevealedMines, r, c);
    recordResult();
    showOverlay(false);
    saveGame();
    return;
  }

  revealCell(r, c);
  state.moves += 1;

  if (checkWin()) {
    state.over = true;
    state.won = true;
    stopTimer();
    const celebrateCells = [];
    for (let r2 = 0; r2 < state.rows; r2++) {
      for (let c2 = 0; c2 < state.cols; c2++) {
        const cell2 = state.grid[r2][c2];
        if (!cell2.mine && cell2.revealed) {
          celebrateCells.push({ r: r2, c: c2 });
        }
        if (cell2.mine) cell2.flagged = true;
      }
    }
    render();
    celebrateReveal(celebrateCells, Math.floor(state.rows / 2), Math.floor(state.cols / 2));
    recordResult();
    showOverlay(true);
    saveGame();
    return;
  }

  render();
  saveGame();
}

function handleRightClick(r, c) {
  if (state.over) return;
  const cell = state.grid[r][c];
  if (cell.revealed) return;
  clearHint();
  pushHistory();

  if (!cell.flagged && !cell.questioned) {
    cell.flagged = true;
  } else if (cell.flagged) {
    cell.flagged = false;
    cell.questioned = true;
  } else if (cell.questioned) {
    cell.questioned = false;
  }

  render();
  saveGame();
}

function handleChord(r, c) {
  if (state.over) return;
  const cell = state.grid[r][c];
  if (!cell.revealed || cell.count === 0) return;

  let flagCount = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols) {
        if (state.grid[nr][nc].flagged) flagCount++;
      }
    }
  }
  if (flagCount !== cell.count) return;

  clearHint();
  pushHistory();

  const hitCells = [];
  let hitMine = false;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= state.rows || nc < 0 || nc >= state.cols) continue;
      const neighbor = state.grid[nr][nc];
      if (neighbor.revealed || neighbor.flagged) continue;
      if (neighbor.mine) {
        hitMine = true;
        neighbor.revealed = true;
        neighbor.questioned = false;
        state.over = true;
        state.won = false;
        stopTimer();
        hitCells.push({ r: nr, c: nc });
      } else {
        revealCell(nr, nc);
      }
    }
  }

  state.moves += 1;

  if (hitMine) {
    recordResult();
    showOverlay(false);
    const unrevealedMines = [];
    for (let r2 = 0; r2 < state.rows; r2++) {
      for (let c2 = 0; c2 < state.cols; c2++) {
        const other = state.grid[r2][c2];
        if (other.mine && !other.revealed && !other.flagged) {
          unrevealedMines.push({ r: r2, c: c2 });
        }
      }
    }
    render();
    hitCells.forEach(({ r: hr, c: hc }) => markHitCell(hr, hc));
    animateReveal(unrevealedMines, r, c);
  } else if (checkWin()) {
    state.over = true;
    state.won = true;
    stopTimer();
    const celebrateCells = [];
    for (let r2 = 0; r2 < state.rows; r2++) {
      for (let c2 = 0; c2 < state.cols; c2++) {
        const cell2 = state.grid[r2][c2];
        if (!cell2.mine && cell2.revealed) {
          celebrateCells.push({ r: r2, c: c2 });
        }
        if (cell2.mine) cell2.flagged = true;
      }
    }
    render();
    celebrateReveal(celebrateCells, Math.floor(state.rows / 2), Math.floor(state.cols / 2));
    recordResult();
    showOverlay(true);
  }

  if (!state.over) {
    render();
  }
  saveGame();
}

// --- Events ---

// --- Mouse input with left+right chord (classic Minesweeper) ---
let mouseDownLeft = false;
let mouseDownRight = false;
let chordSuppressClick = false;

boardEl.addEventListener("mousedown", (e) => {
  const cell = e.target.closest(".cell");
  if (!cell) return;

  if (e.button === 0) mouseDownLeft = true;
  if (e.button === 2) mouseDownRight = true;

  // If both left and right are down on a revealed number cell, perform chord
  if (mouseDownLeft && mouseDownRight) {
    const r = Number(cell.dataset.row);
    const c = Number(cell.dataset.col);
    const targetCell = state.grid[r][c];
    if (targetCell && targetCell.revealed && targetCell.count > 0) {
      chordSuppressClick = true;
      handleChord(r, c);
    }
  }
});

document.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseDownLeft = false;
  if (e.button === 2) mouseDownRight = false;
});

boardEl.addEventListener("click", (e) => {
  if (chordSuppressClick) {
    chordSuppressClick = false;
    return;
  }
  const cell = e.target.closest(".cell");
  if (!cell) return;
  handleClick(Number(cell.dataset.row), Number(cell.dataset.col));
});

boardEl.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (chordSuppressClick) {
    chordSuppressClick = false;
    return;
  }
  const cell = e.target.closest(".cell");
  if (!cell) return;
  handleRightClick(Number(cell.dataset.row), Number(cell.dataset.col));
});

boardEl.addEventListener("dblclick", (e) => {
  const cell = e.target.closest(".cell");
  if (!cell) return;
  handleChord(Number(cell.dataset.row), Number(cell.dataset.col));
});

// --- Touch: long-press to flag & pinch to zoom ---

let touchStartTime = 0;
let touchStartPos = { x: 0, y: 0 };
let longPressTimer = null;
let longPressTarget = null;
let suppressClick = false;
let initialPinchDistance = 0;
let initialCellSize = 32;

boardEl.addEventListener("touchstart", (e) => {
  if (e.touches.length === 2) {
    initialPinchDistance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const style = getComputedStyle(document.documentElement);
    initialCellSize = parseFloat(style.getPropertyValue('--cell-size')) || 32;
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    return;
  }

  if (e.touches.length !== 1) return;
  const cell = e.target.closest(".cell");
  if (!cell) return;

  const touch = e.touches[0];
  touchStartTime = Date.now();
  touchStartPos = { x: touch.clientX, y: touch.clientY };
  longPressTarget = cell;
  suppressClick = false;

  longPressTimer = setTimeout(() => {
    suppressClick = true;
    handleRightClick(Number(longPressTarget.dataset.row), Number(longPressTarget.dataset.col));
    longPressTimer = null;
  }, 500);
}, { passive: true });

boardEl.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2) {
    e.preventDefault();
    const distance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const scale = distance / initialPinchDistance;
    const newSize = Math.max(20, Math.min(64, Math.round(initialCellSize * scale)));
    document.documentElement.style.setProperty('--cell-size', newSize + 'px');
    return;
  }

  if (e.touches.length !== 1 || !longPressTimer) return;
  const touch = e.touches[0];
  const dx = touch.clientX - touchStartPos.x;
  const dy = touch.clientY - touchStartPos.y;
  if (Math.hypot(dx, dy) > 12) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}, { passive: false });

boardEl.addEventListener("touchend", (e) => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  if (suppressClick) {
    setTimeout(() => { suppressClick = false; }, 80);
  }
});



document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!helpOverlayEl.hidden) {
      hideHelpOverlay();
      return;
    }
    if (!customOverlayEl.hidden) {
      hideCustomOverlay();
      return;
    }
    if (!confirmOverlayEl.hidden) {
      hideConfirm(false);
      return;
    }
    if (!overlayEl.hidden) {
      overlayEl.classList.remove('is-visible');
      setTimeout(() => { overlayEl.hidden = true; }, 250);
      return;
    }
  }

  const modalsOpen = !overlayEl.hidden || !confirmOverlayEl.hidden || !customOverlayEl.hidden || !helpOverlayEl.hidden;
  if (modalsOpen) return;

  if (state.keyboardMode) {
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        e.preventDefault();
        moveFocus(-1, 0);
        return;
      case "ArrowDown":
      case "s":
      case "S":
        e.preventDefault();
        moveFocus(1, 0);
        return;
      case "ArrowLeft":
      case "a":
      case "A":
        e.preventDefault();
        moveFocus(0, -1);
        return;
      case "ArrowRight":
      case "d":
      case "D":
        e.preventDefault();
        moveFocus(0, 1);
        return;
      case " ":
        e.preventDefault();
        handleFocusClick();
        return;
      case "Enter":
        e.preventDefault();
        handleChord(state.focusPos.r, state.focusPos.c);
        return;
      case "f":
      case "F":
        e.preventDefault();
        handleFocusFlag();
        return;
    }
  }

  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    return;
  }
  if (e.key.toLowerCase() === "h") { e.preventDefault(); showHint(); }
  if (e.key.toLowerCase() === "u") { e.preventDefault(); undo(); }
  if (e.key.toLowerCase() === "k") { e.preventDefault(); setKeyboardMode(!state.keyboardMode); }
  if (e.key === "?") { e.preventDefault(); showHelpOverlay(); }
});

newBtnEl.addEventListener("click", () => requestNewGame(difficultyEl.value));
difficultyEl.addEventListener("change", () => requestNewGame(difficultyEl.value));
undoBtnEl.addEventListener("click", undo);
hintBtnEl.addEventListener("click", showHint);
overlayNewEl.addEventListener("click", () => startNewGame(difficultyEl.value));

overlayEl.addEventListener("click", (e) => {
  if (e.target === overlayEl) {
    overlayEl.classList.remove('is-visible');
    setTimeout(() => { overlayEl.hidden = true; }, 250);
  }
});

confirmOverlayEl.addEventListener("click", (e) => {
  if (e.target === confirmOverlayEl) {
    hideConfirm(false);
  }
});

customOverlayEl.addEventListener("click", (e) => {
  if (e.target === customOverlayEl) {
    hideCustomOverlay();
  }
});

overlayUndoEl.addEventListener("click", undo);
confirmOkEl.addEventListener("click", () => hideConfirm(true));
confirmCancelEl.addEventListener("click", () => hideConfirm(false));
customOkEl.addEventListener("click", startCustomGame);
customCancelEl.addEventListener("click", hideCustomOverlay);
helpBtnEl.addEventListener("click", showHelpOverlay);
helpCloseEl.addEventListener("click", hideHelpOverlay);
helpOverlayEl.addEventListener("click", (e) => {
  if (e.target === helpOverlayEl) hideHelpOverlay();
});

// --- Keyboard mode toggle ---
const KEYBOARD_MODE_KEY = "game_minesweeper_keyboard_mode";

function setKeyboardMode(enabled) {
  state.keyboardMode = enabled;
  keyboardBtnEl.classList.toggle("active", enabled);
  keyboardBtnEl.textContent = enabled ? "按键模式：开" : "按键模式";
  try {
    localStorage.setItem(KEYBOARD_MODE_KEY, enabled ? "1" : "0");
  } catch {}
  render();
}

function loadKeyboardMode() {
  try {
    const v = localStorage.getItem(KEYBOARD_MODE_KEY);
    if (v !== null) return v === "1";
  } catch {}
  return false;
}

keyboardBtnEl.addEventListener("click", () => {
  setKeyboardMode(!state.keyboardMode);
});

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(syncRecentPanelHeight, 80);
});

window.addEventListener("beforeunload", () => {
  if (state.over) recordResult();
  saveGame();
});

// --- Init ---

undoBtnEl.disabled = true;
if (typeof window.buildCustomDropdown === "function") window.buildCustomDropdown(difficultyEl);
if (!loadGame()) {
  startNewGame("beginner");
} else {
  if (state.started && !state.over) startTimer();
  render();
}
setKeyboardMode(loadKeyboardMode());
difficultyEl.value = state.difficulty;
if (typeof difficultyEl._updateCustomDropdown === 'function') difficultyEl._updateCustomDropdown();
