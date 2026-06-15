const SIZE = 4;
const TARGET = 2048;
const HISTORY_LIMIT = 100;
const MOVE_ANIMATION_MS = 110;
const RECENT_RESULTS_LIMIT = 100;
const SESSION_HISTORY_LIMIT = 120;
const SAVE_KEY = "game_2048_save_v1";
const BEST_KEY = "game_2048_best_v1";
const STATS_KEY = "game_2048_stats_v1";

const state = {
  grid: [],
  score: 0,
  best: 0,
  moves: 0,
  won: false,
  over: false,
  keepPlaying: false,
  history: [],
  lastSpawnKeys: [],
  lastMergeKeys: [],
  animating: false,
  animationTimer: null,
  motionLayer: null,
  sessionId: "",
  startedAt: 0,
  sessionRecorded: false,
  touchStart: null,
};

const $ = (id) => document.getElementById(id);
const boardEl = $("board");
const boardGridEl = $("board-grid");
const tileLayerEl = $("tile-layer");
const scoreEl = $("score");
const bestEl = $("best");
const movesEl = $("moves");
const statusTextEl = $("status-text");
const goalChipEl = $("goal-chip");
const overlayEl = $("overlay");
const overlayTitleEl = $("overlay-title");
const overlayScorelineEl = $("overlay-scoreline");
const overlayUndoEl = $("overlay-undo");
const overlayContinueEl = $("overlay-continue");
const overlayHomeEl = $("overlay-home");
const overlayNewEl = $("overlay-new");
const undoEl = $("btn-undo");
const newEl = $("btn-new");
const helpBtnEl = $("btn-help");
const helpOverlayEl = $("help-overlay");
const helpCloseEl = $("help-close");
const statsStartedEl = $("stats-started");
const statsWonEl = $("stats-won");
const statsWinRateEl = $("stats-win-rate");
const statsBestScoreEl = $("stats-best-score");
const statsBestTileEl = $("stats-best-tile");
const statsBestTimeEl = $("stats-best-time");
const recentListEl = $("recent-list");
const summaryPanelEl = document.querySelector(
  ".stats-section .stats-panel:not(.recent-panel)"
);
const recentPanelEl = document.querySelector(".recent-panel");

function createEmptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

function createSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function snapshot() {
  return {
    grid: cloneGrid(state.grid),
    score: state.score,
    moves: state.moves,
    won: state.won,
    over: state.over,
    keepPlaying: state.keepPlaying,
  };
}

function pushHistory() {
  state.history.push(snapshot());
  if (state.history.length > HISTORY_LIMIT) {
    state.history.shift();
  }
}

function getBestScore() {
  try {
    return Math.max(0, Number(localStorage.getItem(BEST_KEY)) || 0);
  } catch {
    return 0;
  }
}

function saveBestScore() {
  try {
    localStorage.setItem(BEST_KEY, String(state.best));
  } catch {}
}

function saveGame() {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        grid: state.grid,
        score: state.score,
        moves: state.moves,
        won: state.won,
        over: state.over,
        keepPlaying: state.keepPlaying,
        sessionId: state.sessionId,
        startedAt: state.startedAt,
        sessionRecorded: state.sessionRecorded,
      })
    );
  } catch {}
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
}

function isValidGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== SIZE) return false;
  return grid.every((row) => {
    if (!Array.isArray(row) || row.length !== SIZE) return false;
    return row.every((cell) => Number.isInteger(cell) && cell >= 0);
  });
}

function defaultStats() {
  return { version: 2, started: 0, won: 0, sessions: [] };
}

function normalizeStatsData(raw) {
  const sessions = Array.isArray(raw?.sessions)
    ? raw.sessions.filter(
        (item) =>
          item &&
          typeof item.sessionId === "string" &&
          Number.isFinite(item.score) &&
          Number.isFinite(item.moves) &&
          Number.isFinite(item.maxTile) &&
          Number.isFinite(item.timeMs) &&
          Number.isFinite(item.completedAt)
      )
    : [];
  const started = Number.isFinite(raw?.started) ? Math.max(0, raw.started) : 0;
  let won = Number.isFinite(raw?.won) ? Math.max(0, raw.won) : 0;
  if (!Number.isFinite(raw?.version)) {
    won = sessions.filter((s) => s.won).length;
  }
  return { version: 2, started, won, sessions };
}

function getStats() {
  try {
    return normalizeStatsData(JSON.parse(localStorage.getItem(STATS_KEY)));
  } catch {
    return defaultStats();
  }
}

function saveStatsData(stats) {
  try {
    stats.won = stats.sessions.filter((s) => s.won).length;
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {}
}

function recordStart() {
  const stats = getStats();
  stats.started += 1;
  saveStatsData(stats);
}

function loadGame() {
  state.best = getBestScore();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!isValidGrid(data.grid)) return false;

    state.grid = cloneGrid(data.grid);
    state.score = Math.max(0, Number(data.score) || 0);
    state.moves = Math.max(0, Number(data.moves) || 0);
    state.won = Boolean(data.won);
    state.over = Boolean(data.over);
    state.keepPlaying = Boolean(data.keepPlaying);
    state.history = Array.isArray(data.history) ? data.history : [];
    state.lastSpawnKeys = [];
    state.lastMergeKeys = [];
    state.animating = false;
    state.animationTimer = null;
    state.motionLayer = null;
    state.sessionId =
      typeof data.sessionId === "string" && data.sessionId
        ? data.sessionId
        : createSessionId();
    state.startedAt =
      Number.isFinite(data.startedAt) && data.startedAt > 0
        ? data.startedAt
        : Date.now();
    state.sessionRecorded = Boolean(data.sessionRecorded);
    state.best = Math.max(state.best, state.score);
    saveBestScore();
    if (state.over && !state.sessionRecorded) {
      upsertCurrentSessionResult();
    }
    return true;
  } catch {
    return false;
  }
}

function buildGridCells() {
  boardGridEl.innerHTML = "";
  for (let i = 0; i < SIZE * SIZE; i++) {
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    boardGridEl.appendChild(cell);
  }
}

function getEmptyCells(grid) {
  const cells = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (grid[row][col] === 0) {
        cells.push({ row, col });
      }
    }
  }
  return cells;
}

function getElapsedMs() {
  if (!state.startedAt) return 0;
  return Math.max(0, Date.now() - state.startedAt);
}

function addRandomTile(grid) {
  const emptyCells = getEmptyCells(grid);
  if (emptyCells.length === 0) return null;

  const pick = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  grid[pick.row][pick.col] = value;
  return { ...pick, value, key: cellKey(pick.row, pick.col) };
}

function cellKey(row, col) {
  return row + "-" + col;
}

function setTilePosition(tile, row, col) {
  tile.style.top =
    "calc(" + row + " * (((100% - var(--grid-gap) * 3) / 4) + var(--grid-gap)))";
  tile.style.left =
    "calc(" + col + " * (((100% - var(--grid-gap) * 3) / 4) + var(--grid-gap)))";
}

function createTileElement(value, row, col) {
  const tile = document.createElement("div");
  tile.className = "tile " + getTileClass(value);
  setTilePosition(tile, row, col);
  tile.dataset.digits = String(value).length;
  tile.textContent = String(value);
  return tile;
}

function getLanePositions(direction, lane) {
  const positions = [];
  for (let index = 0; index < SIZE; index++) {
    if (direction === "left") positions.push([lane, index]);
    if (direction === "right") positions.push([lane, SIZE - 1 - index]);
    if (direction === "up") positions.push([index, lane]);
    if (direction === "down") positions.push([SIZE - 1 - index, lane]);
  }
  return positions;
}

function buildMovePlan(direction) {
  const nextGrid = createEmptyGrid();
  const mergeKeys = [];
  const transitions = [];
  let moved = false;
  let scoreGain = 0;

  for (let lane = 0; lane < SIZE; lane++) {
    const positions = getLanePositions(direction, lane);
    const tiles = positions
      .map(([row, col]) => ({ row, col, value: state.grid[row][col] }))
      .filter((tile) => tile.value);

    let writeIndex = 0;
    for (let i = 0; i < tiles.length; i++) {
      const current = tiles[i];
      const [targetRow, targetCol] = positions[writeIndex];

      if (i + 1 < tiles.length && current.value === tiles[i + 1].value) {
        const next = tiles[i + 1];
        const mergedValue = current.value * 2;

        nextGrid[targetRow][targetCol] = mergedValue;
        scoreGain += mergedValue;
        mergeKeys.push(cellKey(targetRow, targetCol));
        transitions.push({
          value: current.value,
          fromRow: current.row,
          fromCol: current.col,
          toRow: targetRow,
          toCol: targetCol,
        });
        transitions.push({
          value: next.value,
          fromRow: next.row,
          fromCol: next.col,
          toRow: targetRow,
          toCol: targetCol,
        });

        if (
          current.row !== targetRow ||
          current.col !== targetCol ||
          next.row !== targetRow ||
          next.col !== targetCol
        ) {
          moved = true;
        }

        writeIndex++;
        i++;
      } else {
        nextGrid[targetRow][targetCol] = current.value;
        transitions.push({
          value: current.value,
          fromRow: current.row,
          fromCol: current.col,
          toRow: targetRow,
          toCol: targetCol,
        });

        if (current.row !== targetRow || current.col !== targetCol) {
          moved = true;
        }

        writeIndex++;
      }
    }
  }

  return {
    nextGrid,
    mergeKeys,
    transitions,
    moved,
    scoreGain,
  };
}

function clearMotionLayer() {
  if (state.animationTimer) {
    clearTimeout(state.animationTimer);
    state.animationTimer = null;
  }
  if (state.motionLayer) {
    state.motionLayer.remove();
    state.motionLayer = null;
  }
  state.animating = false;
}

function playMoveAnimation(transitions) {
  clearMotionLayer();
  state.animating = true;
  tileLayerEl.innerHTML = "";

  const layer = document.createElement("div");
  layer.className = "motion-layer";
  const items = transitions.map((transition) => {
    const tile = createTileElement(
      transition.value,
      transition.fromRow,
      transition.fromCol
    );
    layer.appendChild(tile);
    return {
      el: tile,
      toRow: transition.toRow,
      toCol: transition.toCol,
    };
  });

  boardEl.appendChild(layer);
  state.motionLayer = layer;

  void layer.offsetWidth;
  requestAnimationFrame(() => {
    items.forEach((item) => {
      setTilePosition(item.el, item.toRow, item.toCol);
    });
  });

  state.animationTimer = setTimeout(() => {
    if (state.motionLayer === layer) {
      layer.remove();
      state.motionLayer = null;
    }
    state.animationTimer = null;
    state.animating = false;
    render();
  }, MOVE_ANIMATION_MS + 10);
}

function move(direction) {
  if (state.animating || state.over || (state.won && !state.keepPlaying)) return;

  const plan = buildMovePlan(direction);
  if (!plan.moved) {
    shakeBoard();
    return;
  }

  pushHistory();
  state.grid = plan.nextGrid;
  state.score += plan.scoreGain;
  state.moves += 1;
  state.lastMergeKeys = plan.mergeKeys;

  const spawned = addRandomTile(state.grid);
  state.lastSpawnKeys = spawned ? [spawned.key] : [];

  state.best = Math.max(state.best, state.score);
  saveBestScore();

  if (!state.won && hasTargetTile(state.grid)) {
    state.won = true;
  }

  state.over = !canMove(state.grid);
  if (state.over) {
    upsertCurrentSessionResult();
  }
  saveGame();
  playMoveAnimation(plan.transitions);
}

function hasTargetTile(grid) {
  return grid.some((row) => row.some((cell) => cell >= TARGET));
}

function getMaxTile(grid) {
  let maxTile = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell > maxTile) maxTile = cell;
    }
  }
  return maxTile;
}

function buildCurrentSessionResult() {
  return {
    sessionId: state.sessionId,
    won: Boolean(state.won),
    score: state.score,
    moves: state.moves,
    maxTile: getMaxTile(state.grid),
    timeMs: getElapsedMs(),
    completedAt: Date.now(),
  };
}

function upsertCurrentSessionResult() {
  if (!state.sessionId || state.moves === 0) return;
  const stats = getStats();
  const result = buildCurrentSessionResult();
  stats.sessions = [
    result,
    ...stats.sessions.filter((item) => item.sessionId !== result.sessionId),
  ]
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, SESSION_HISTORY_LIMIT);
  saveStatsData(stats);
  state.sessionRecorded = true;
  saveGame();
}

function removeCurrentSessionRecord() {
  if (!state.sessionId || !state.sessionRecorded) return;
  const stats = getStats();
  const nextSessions = stats.sessions.filter(
    (item) => item.sessionId !== state.sessionId
  );
  if (nextSessions.length !== stats.sessions.length) {
    stats.sessions = nextSessions;
    saveStatsData(stats);
  }
  state.sessionRecorded = false;
  saveGame();
}

function canMove(grid) {
  if (getEmptyCells(grid).length > 0) return true;
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const value = grid[row][col];
      if (row + 1 < SIZE && grid[row + 1][col] === value) return true;
      if (col + 1 < SIZE && grid[row][col + 1] === value) return true;
    }
  }
  return false;
}

function startNewGame() {
  if (state.moves > 0 && (state.over || state.won)) {
    upsertCurrentSessionResult();
  }

  clearMotionLayer();
  clearSave();
  state.grid = createEmptyGrid();
  state.score = 0;
  state.moves = 0;
  state.won = false;
  state.over = false;
  state.keepPlaying = false;
  state.history = [];
  state.lastMergeKeys = [];
  state.lastSpawnKeys = [];
  state.sessionId = createSessionId();
  state.startedAt = Date.now();
  state.sessionRecorded = false;
  state.best = getBestScore();
  recordStart();
  addRandomTile(state.grid);
  addRandomTile(state.grid);
  render();
  saveGame();
}

function undo() {
  if (state.animating || state.history.length === 0) return;

  const shouldRemoveRecord = state.sessionRecorded;
  const previous = state.history.pop();
  state.grid = cloneGrid(previous.grid);
  state.score = previous.score;
  state.moves = previous.moves;
  state.won = previous.won;
  state.over = previous.over;
  state.keepPlaying = previous.keepPlaying;
  state.lastMergeKeys = [];
  state.lastSpawnKeys = [];
  if (shouldRemoveRecord) {
    removeCurrentSessionRecord();
  }
  render();
  saveGame();
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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

function buildStatsSummary(stats) {
  let won = 0;
  let bestScore = null;
  let bestTile = null;
  let bestTimeMs = null;

  for (const session of stats.sessions) {
    if (bestScore == null || session.score > bestScore) {
      bestScore = session.score;
    }
    if (bestTile == null || session.maxTile > bestTile) {
      bestTile = session.maxTile;
    }
    if (session.won) {
      won += 1;
      if (bestTimeMs == null || session.timeMs < bestTimeMs) {
        bestTimeMs = session.timeMs;
      }
    }
  }

  return {
    started: stats.started,
    won,
    winRate: stats.started > 0 ? Math.round((won / stats.started) * 100) : 0,
    bestScore,
    bestTile,
    bestTimeMs,
    recent: stats.sessions.slice(0, RECENT_RESULTS_LIMIT),
  };
}

function renderStatsPanel() {
  const summary = buildStatsSummary(getStats());
  statsStartedEl.textContent = String(summary.started);
  statsWonEl.textContent = String(summary.won);
  statsWinRateEl.textContent = `${summary.winRate}%`;
  statsBestScoreEl.textContent =
    summary.bestScore == null ? "-" : String(summary.bestScore);
  statsBestTileEl.textContent =
    summary.bestTile == null ? "-" : String(summary.bestTile);
  statsBestTimeEl.textContent =
    summary.bestTimeMs == null ? "-" : formatDuration(summary.bestTimeMs);

  if (summary.recent.length === 0) {
    recentListEl.innerHTML =
      '<div class="recent-empty">还没有已结束的对局记录。</div>';
    syncRecentPanelHeight();
    return;
  }

  recentListEl.innerHTML = summary.recent
    .map((item) => {
      const resultText = item.won ? "达成 2048" : "死局";
      const resultClass = item.won ? "is-win" : "is-loss";
      return (
        `<article class="recent-item ${resultClass}">` +
        '<div class="recent-main">' +
        `<strong class="recent-result">${resultText}</strong>` +
        `<span class="recent-date">${formatResultDate(item.completedAt)}</span>` +
        "</div>" +
        '<div class="recent-meta">' +
        `<span>最高块 <strong>${item.maxTile}</strong></span>` +
        `<span>分数 <strong>${item.score}</strong></span>` +
        `<span>步数 <strong>${item.moves}</strong></span>` +
        `<span>用时 <strong>${formatDuration(item.timeMs)}</strong></span>` +
        "</div>" +
        "</article>"
      );
    })
    .join("");

  syncRecentPanelHeight();
}

function syncRecentPanelHeight() {
  if (!summaryPanelEl || !recentPanelEl) return;

  if (window.innerWidth <= 760) {
    recentPanelEl.style.height = "320px";
    return;
  }

  recentPanelEl.style.height = "";
  const summaryHeight = Math.ceil(
    summaryPanelEl.getBoundingClientRect().height
  );
  if (summaryHeight > 0) {
    recentPanelEl.style.height = `${summaryHeight}px`;
  }
}

function bindPanelSizing() {
  syncRecentPanelHeight();
  window.addEventListener("resize", syncRecentPanelHeight);

  if ("ResizeObserver" in window && summaryPanelEl) {
    const observer = new ResizeObserver(() => {
      syncRecentPanelHeight();
    });
    observer.observe(summaryPanelEl);
  }
}

function getStatusText() {
  if (state.over) return "已结束";
  if (state.won && !state.keepPlaying) return "已达成 2048";
  if (state.keepPlaying) return "继续挑战";
  return "进行中";
}

/* confetti shared: scripts/confetti.js */

function updateOverlay() {
  if (state.over) {
    overlayTitleEl.textContent = "没有可走的步了";
    overlayScorelineEl.innerHTML =
      '<div class="overlay-summary">' +
      `<span class="overlay-badge">最高块 <strong>${getMaxTile(state.grid)}</strong></span>` +
      `<span class="overlay-badge">分数 <strong>${state.score}</strong></span>` +
      `<span class="overlay-badge">步数 <strong>${state.moves}</strong></span>` +
      "</div>" +
      '<div class="overlay-hint">撤销一步还能继续尝试，或者直接开始下一局。</div>';
    overlayUndoEl.hidden = state.history.length === 0;
    overlayContinueEl.hidden = true;
    overlayEl.hidden = false;
    return;
  }

  if (state.won && !state.keepPlaying) {
    overlayTitleEl.textContent = "2048";
    overlayScorelineEl.innerHTML =
      '<div class="overlay-summary">' +
      `<span class="overlay-badge">最高块 <strong>${getMaxTile(state.grid)}</strong></span>` +
      `<span class="overlay-badge">分数 <strong>${state.score}</strong></span>` +
      `<span class="overlay-badge">步数 <strong>${state.moves}</strong></span>` +
      "</div>" +
      '<div class="overlay-hint">你已经合成 2048，还可以继续往上冲分。</div>';
    overlayUndoEl.hidden = true;
    overlayContinueEl.hidden = false;
    if (overlayEl.hidden) launchConfetti();
    overlayEl.hidden = false;
    return;
  }

  overlayUndoEl.hidden = true;
  overlayContinueEl.hidden = true;
  overlayEl.hidden = true;
}

function render() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(state.best);
  movesEl.textContent = String(state.moves);
  statusTextEl.textContent = getStatusText();
  goalChipEl.textContent = state.keepPlaying
    ? "继续冲高"
    : state.won
      ? "已达成 2048"
      : "目标 2048";
  undoEl.disabled = state.history.length === 0 || state.animating;
  newEl.disabled = state.animating;

  tileLayerEl.innerHTML = "";
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const value = state.grid[row][col];
      if (!value) continue;
      const tile = createTileElement(value, row, col);
      if (state.lastSpawnKeys.includes(cellKey(row, col))) {
        tile.classList.add("tile-pop");
      }
      if (state.lastMergeKeys.includes(cellKey(row, col))) {
        tile.classList.add("tile-merge");
      }
      tileLayerEl.appendChild(tile);
    }
  }

  renderStatsPanel();
  updateOverlay();
}

function getTileClass(value) {
  if (value <= TARGET) {
    return "tile-value-" + value;
  }
  return "tile-high";
}

function shakeBoard() {
  boardEl.classList.remove("shake");
  void boardEl.offsetWidth;
  boardEl.classList.add("shake");
}

function requestNewGame() {
  if (state.animating) return;
  if (state.moves > 0 && !state.over && !state.won) {
    if (!window.confirm('当前游戏正在进行，确定要重新开始吗？')) return;
  }
  startNewGame();
}

function handleKeydown(event) {
  if (event.ctrlKey || event.metaKey) {
    if (event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    }
    return;
  }

  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a" || key === "h") {
    event.preventDefault();
    move("left");
  } else if (key === "arrowright" || key === "d" || key === "l") {
    event.preventDefault();
    move("right");
  } else if (key === "arrowup" || key === "w" || key === "k") {
    event.preventDefault();
    move("up");
  } else if (key === "arrowdown" || key === "s" || key === "j") {
    event.preventDefault();
    move("down");
  } else if (key === "r") {
    event.preventDefault();
    requestNewGame();
  } else if (key === "u") {
    event.preventDefault();
    undo();
  } else if (key === "?") {
    event.preventDefault();
    if (helpOverlayEl.hidden) showHelpOverlay();
    else hideHelpOverlay();
  } else if (event.key === "Escape") {
    if (!helpOverlayEl.hidden) {
      hideHelpOverlay();
    }
  }
}

function onPointerDown(event) {
  if (state.animating) return;
  if (event.button !== undefined && event.button !== 0) return;
  if (event.isPrimary === false) return;
  if (boardEl.setPointerCapture) {
    try {
      boardEl.setPointerCapture(event.pointerId);
    } catch {}
  }
  state.touchStart = {
    x: event.clientX,
    y: event.clientY,
  };
}

function onPointerUp(event) {
  if (state.animating) return;
  if (!state.touchStart) return;

  const dx = event.clientX - state.touchStart.x;
  const dy = event.clientY - state.touchStart.y;
  state.touchStart = null;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (Math.max(absX, absY) < 24) return;

  if (absX > absY) {
    move(dx > 0 ? "right" : "left");
  } else {
    move(dy > 0 ? "down" : "up");
  }
}

function showHelpOverlay() {
  helpOverlayEl.hidden = false;
  requestAnimationFrame(() => helpOverlayEl.classList.add('is-visible'));
}

function hideHelpOverlay() {
  helpOverlayEl.classList.remove('is-visible');
  setTimeout(() => { helpOverlayEl.hidden = true; }, 250);
}

function bindEvents() {
  newEl.addEventListener("click", requestNewGame);
  undoEl.addEventListener("click", undo);
  helpBtnEl.addEventListener("click", showHelpOverlay);
  helpCloseEl.addEventListener("click", hideHelpOverlay);
  helpOverlayEl.addEventListener("click", (e) => {
    if (e.target === helpOverlayEl) hideHelpOverlay();
  });
  overlayUndoEl.addEventListener("click", undo);
  overlayNewEl.addEventListener("click", requestNewGame);
  overlayHomeEl.addEventListener("click", () => {
    if (state.over || state.won) {
      upsertCurrentSessionResult();
    }
  });
  overlayContinueEl.addEventListener("click", () => {
    if (state.animating) return;
    state.keepPlaying = true;
    render();
    saveGame();
  });
  document.addEventListener("keydown", handleKeydown);
  boardEl.addEventListener("pointerdown", onPointerDown);
  boardEl.addEventListener("pointerup", onPointerUp);
  boardEl.addEventListener("pointercancel", () => {
    state.touchStart = null;
  });
  window.addEventListener("beforeunload", () => {
    if (state.over || state.won) {
      upsertCurrentSessionResult();
    }
    saveGame();
  });
}

buildGridCells();
bindEvents();
bindPanelSizing();

if (!loadGame()) {
  startNewGame();
} else {
  render();
}
