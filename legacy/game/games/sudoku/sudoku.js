/* ===== 数独 Sudoku ===== */

const DIFFICULTIES = {
  easy:   { name: '简单', holes: 36 },
  medium: { name: '中等', holes: 46 },
  hard:   { name: '困难', holes: 56 }
};

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- 数独算法 ---------- */
function isValid(board, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num) return false;
    if (board[i][col] === num) return false;
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      if (board[r][c] === num) return false;
    }
  }
  return true;
}

function fillBoard(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const n of nums) {
          if (isValid(board, r, c, n)) {
            board[r][c] = n;
            if (fillBoard(board)) return true;
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function countSolutions(board, limit) {
  limit = limit || 2;
  let count = 0;
  function solve() {
    if (count >= limit) return;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) {
          for (let n = 1; n <= 9; n++) {
            if (isValid(board, r, c, n)) {
              board[r][c] = n;
              solve();
              board[r][c] = 0;
            }
          }
          return;
        }
      }
    }
    count++;
  }
  solve();
  return count;
}

function removeCells(board, count) {
  const cells = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      cells.push([r, c]);
    }
  }
  shuffle(cells);
  let removed = 0;
  for (const [r, c] of cells) {
    if (removed >= count) break;
    const backup = board[r][c];
    board[r][c] = 0;
    if (countSolutions(board, 2) === 1) {
      removed++;
    } else {
      board[r][c] = backup;
    }
  }
}

function generateSudoku(difficulty) {
  const full = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillBoard(full);
  const solution = full.map(row => [...row]);
  const puzzle = full.map(row => [...row]);
  removeCells(puzzle, DIFFICULTIES[difficulty].holes);
  return { puzzle, solution };
}

/* ---------- 状态 ---------- */
let grid = [];
let solution = [];
let fixed = [];
let notes = [];
let selected = null;
let noteMode = false;
let moves = 0;
let gameWon = false;
let difficulty = 'medium';
let history = [];
let conflicts = new Set();
let isGenerating = false;

const $ = GameUtils.$;
const storage = new GameStorage('game_sudoku');
const statsMgr = new GameStats(storage, 'stats_v1', { version: 2, started: 0, won: 0, sessions: [] });
const timer = new GameTimer(ms => {
  $('stat-time').textContent = GameUtils.formatTime(Math.floor(ms / 1000));
});

function createEmptyGrid() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}
function createEmptyNotes() {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => Array(10).fill(0))
  );
}
function createEmptyFixed() {
  return Array.from({ length: 9 }, () => Array(9).fill(false));
}

/* ---------- 新游戏 ---------- */
function newGame(diff) {
  if (isGenerating) return;
  if (moves > 0 && !gameWon) {
    updateStats(false);
  }

  isGenerating = true;
  GameOverlay.show('loading-overlay');
  timer.stop();

  setTimeout(() => {
    difficulty = diff || difficulty;
    gameWon = false;
    moves = 0;
    history = [];
    conflicts = new Set();
    selected = null;
    noteMode = false;

    const result = generateSudoku(difficulty);
    grid = result.puzzle;
    solution = result.solution;
    fixed = createEmptyFixed();
    notes = createEmptyNotes();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] !== 0) fixed[r][c] = true;
      }
    }

    timer.reset();
    timer.start();
    render();
    safeSaveGame();

    isGenerating = false;
    GameOverlay.hide('loading-overlay');
  }, 10);
}

/* ---------- 渲染 ---------- */
function render() {
  $('stat-moves').textContent = moves;
  $('stat-time').textContent = GameUtils.formatTime(Math.floor(timer.getElapsedMs() / 1000));
  $('stat-difficulty').textContent = DIFFICULTIES[difficulty].name;
  $('btn-undo').disabled = history.length === 0;
  $('btn-note').classList.toggle('active', noteMode);

  const boardEl = $('board');
  boardEl.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;

      if (fixed[r][c]) {
        GameUtils.addClass(cell, 'fixed');
        cell.textContent = grid[r][c];
      } else if (grid[r][c] !== 0) {
        cell.textContent = grid[r][c];
      } else {
        const hasNotes = notes[r][c].some((v, i) => i > 0 && v);
        if (hasNotes) {
          const noteEl = document.createElement('div');
          noteEl.className = 'note-grid';
          for (let n = 1; n <= 9; n++) {
            const span = document.createElement('span');
            if (notes[r][c][n]) span.textContent = n;
            noteEl.appendChild(span);
          }
          cell.appendChild(noteEl);
        }
      }

      if (selected && selected.r === r && selected.c === c) {
        GameUtils.addClass(cell, 'selected');
      }
      if (conflicts.has(r + ',' + c)) {
        GameUtils.addClass(cell, 'conflict');
      }
      if (selected) {
        const sr = selected.r, sc = selected.c;
        const sameRow = sr === r;
        const sameCol = sc === c;
        const sameBox = Math.floor(sr / 3) === Math.floor(r / 3) && Math.floor(sc / 3) === Math.floor(c / 3);
        const sameNum = grid[sr][sc] !== 0 && grid[r][c] === grid[sr][sc];
        if ((sameRow || sameCol || sameBox || sameNum) && !(sr === r && sc === c)) {
          GameUtils.addClass(cell, 'highlight');
        }
      }

      cell.addEventListener('click', () => onCellClick(r, c));
      boardEl.appendChild(cell);
    }
  }
}

/* ---------- 交互 ---------- */
function onCellClick(r, c) {
  if (gameWon || isGenerating) return;
  selected = { r, c };
  render();
}

function inputNumber(num) {
  if (!selected || gameWon || isGenerating) return;
  const { r, c } = selected;
  if (fixed[r][c]) return;

  pushHistory();

  if (noteMode) {
    if (grid[r][c] !== 0) {
      grid[r][c] = 0;
      notes[r][c] = Array(10).fill(0);
      notes[r][c][num] = 1;
    } else {
      notes[r][c][num] = notes[r][c][num] ? 0 : 1;
    }
  } else {
    grid[r][c] = num;
    notes[r][c] = Array(10).fill(0);
    moves++;
  }

  updateConflicts();
  render();
  safeSaveGame();
  checkWin();
}

function clearCell() {
  if (!selected || gameWon || isGenerating) return;
  const { r, c } = selected;
  if (fixed[r][c]) return;
  if (grid[r][c] === 0 && !notes[r][c].some((v, i) => i > 0 && v)) return;

  pushHistory();
  grid[r][c] = 0;
  notes[r][c] = Array(10).fill(0);
  updateConflicts();
  render();
  safeSaveGame();
}

function updateConflicts() {
  conflicts = new Set();
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const num = grid[r][c];
      if (num === 0) continue;
      for (let i = 0; i < 9; i++) {
        if (i !== c && grid[r][i] === num) {
          conflicts.add(r + ',' + c);
          conflicts.add(r + ',' + i);
        }
        if (i !== r && grid[i][c] === num) {
          conflicts.add(r + ',' + c);
          conflicts.add(i + ',' + c);
        }
      }
      const br = Math.floor(r / 3) * 3;
      const bc = Math.floor(c / 3) * 3;
      for (let rr = br; rr < br + 3; rr++) {
        for (let cc = bc; cc < bc + 3; cc++) {
          if ((rr !== r || cc !== c) && grid[rr][cc] === num) {
            conflicts.add(r + ',' + c);
            conflicts.add(rr + ',' + cc);
          }
        }
      }
    }
  }
}

/* ---------- 撤销 ---------- */
function pushHistory() {
  history.push({
    grid: grid.map(row => [...row]),
    notes: notes.map(row => row.map(n => [...n])),
    moves
  });
  if (history.length > 200) history.shift();
}

function undo() {
  if (gameWon || !history.length || isGenerating) return;
  const s = history.pop();
  grid = s.grid;
  notes = s.notes;
  moves = s.moves;
  updateConflicts();
  render();
  safeSaveGame();
}

/* ---------- 提示 ---------- */
function showHint() {
  if (gameWon || !selected || isGenerating) return;
  const { r, c } = selected;
  if (fixed[r][c]) return;
  if (grid[r][c] === solution[r][c]) return;

  pushHistory();
  grid[r][c] = solution[r][c];
  notes[r][c] = Array(10).fill(0);
  moves++;
  updateConflicts();
  render();
  safeSaveGame();
  checkWin();
}

/* ---------- 胜利 ---------- */
function checkWin() {
  if (gameWon) return;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== solution[r][c]) return;
    }
  }
  if (conflicts.size > 0) return;
  gameWon = true;
  timer.stop();
  updateStats(true);
  clearSave();
  setTimeout(() => {
    showWin();
    fireConfetti();
  }, 300);
}

function showWin() {
  $('win-time').textContent = GameUtils.formatTime(Math.floor(timer.getElapsedMs() / 1000));
  $('win-moves').textContent = moves;
  $('win-difficulty').textContent = DIFFICULTIES[difficulty].name;
  const winStats = $('win-stats');
  if (winStats) winStats.innerHTML = generateStatsHTML();
  GameOverlay.show('win-overlay');
}
function hideWin() { GameOverlay.hide('win-overlay'); }

/* ---------- 统计 ---------- */
function updateStats(won) {
  const stats = statsMgr.get();
  stats.started++;
  if (won) {
    stats.won++;
    stats.sessions.unshift({
      difficulty,
      won: true,
      timeMs: timer.getElapsedMs(),
      completedAt: Date.now()
    });
    if (stats.sessions.length > 50) stats.sessions.pop();
  }
  statsMgr.set(stats);
}

function generateStatsHTML() {
  const s = statsMgr.get();
  const winRate = s.started ? Math.round((s.won / s.started) * 100) : 0;
  const best = s.sessions.filter(x => x.won).sort((a, b) => a.timeMs - b.timeMs)[0];
  return (
    '<div>胜率 <strong>' + winRate + '%</strong></div>' +
    '<div>最佳时间 <strong>' + (best ? GameUtils.formatTime(Math.floor(best.timeMs / 1000)) : '-') + '</strong></div>'
  );
}

/* ---------- 保存/加载 ---------- */
function saveGame() {
  const data = {
    grid, solution, fixed,
    notes: notes.map(row => row.map(n => [...n])),
    difficulty, moves,
    elapsedMs: timer.getElapsedMs(),
    gameWon
  };
  storage.save('save_v1', data);
}

function loadGame() {
  try {
    const data = storage.load('save_v1');
    if (!data || !Array.isArray(data.grid) || !Array.isArray(data.solution)) return false;
    grid = data.grid;
    solution = data.solution;
    fixed = Array.isArray(data.fixed) ? data.fixed : createEmptyFixed();
    notes = Array.isArray(data.notes) ? data.notes : createEmptyNotes();
    difficulty = data.difficulty || 'medium';
    moves = data.moves || 0;
    gameWon = data.gameWon || false;
    const elapsed = data.elapsedMs || 0;
    timer.setElapsedMs(elapsed);
    updateConflicts();
    render();
    if (!gameWon) timer.start();
    return true;
  } catch { return false; }
}

function safeSaveGame() {
  try { saveGame(); } catch {}
}

function clearSave() {
  storage.remove('save_v1');
}

/* ---------- 弹窗 ---------- */
function showHelp() { GameOverlay.show('help-overlay'); }
function hideHelp() { GameOverlay.hide('help-overlay'); }

/* ---------- 键盘 ---------- */
function onKeyDown(e) {
  if (e.key === '?') { showHelp(); return; }
  if (isGenerating) return;
  if (gameWon) return;

  const key = e.key.toLowerCase();
  if (key === 'r') {
    e.preventDefault();
    if (moves > 0 && !gameWon) {
      GameOverlay.showConfirm('当前对局尚未结束，确定要重新开始吗？').then(ok => { if (ok) newGame(); });
    } else {
      newGame();
    }
  } else if (key === 'u' || (e.ctrlKey && key === 'z')) {
    e.preventDefault(); undo();
  } else if (key === 'h') {
    e.preventDefault(); showHint();
  } else if (key === 'n') {
    e.preventDefault();
    noteMode = !noteMode;
    render();
  } else if (key >= '1' && key <= '9') {
    e.preventDefault();
    inputNumber(parseInt(key, 10));
  } else if (key === 'backspace' || key === 'delete') {
    e.preventDefault();
    clearCell();
  } else if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
    e.preventDefault();
    if (!selected) { selected = { r: 4, c: 4 }; }
    else {
      if (key === 'arrowup') selected.r = Math.max(0, selected.r - 1);
      if (key === 'arrowdown') selected.r = Math.min(8, selected.r + 1);
      if (key === 'arrowleft') selected.c = Math.max(0, selected.c - 1);
      if (key === 'arrowright') selected.c = Math.min(8, selected.c + 1);
    }
    render();
  }
}

/* ---------- 初始化 ---------- */
function init() {
  GameOverlay.bindEscToClose('win-overlay', 'help-overlay', 'confirm-overlay');

  const diffEl = $('difficulty');
  diffEl.addEventListener('change', () => {
    if (isGenerating) { diffEl.value = difficulty; if (diffEl._updateCustomDropdown) diffEl._updateCustomDropdown(); return; }
    GameOverlay.showConfirm('切换难度将开始新游戏，当前进度将丢失。').then(ok => {
      if (ok) newGame(diffEl.value);
      else { diffEl.value = difficulty; if (diffEl._updateCustomDropdown) diffEl._updateCustomDropdown(); }
    });
  });

  $('btn-new').addEventListener('click', () => {
    if (isGenerating) return;
    if (moves > 0 && !gameWon) {
      GameOverlay.showConfirm('当前对局尚未结束，确定要重新开始吗？').then(ok => { if (ok) newGame(); });
    } else {
      newGame();
    }
  });
  $('btn-undo').addEventListener('click', undo);
  $('btn-hint').addEventListener('click', showHint);
  $('btn-note').addEventListener('click', () => { if (isGenerating) return; noteMode = !noteMode; render(); });
  $('btn-help').addEventListener('click', showHelp);
  $('help-close').addEventListener('click', hideHelp);
  $('win-new').addEventListener('click', () => { if (isGenerating) return; hideWin(); newGame(); });

  for (let n = 1; n <= 9; n++) {
    $('num-' + n).addEventListener('click', () => inputNumber(n));
  }
  $('num-clear').addEventListener('click', clearCell);

  document.addEventListener('keydown', onKeyDown);

  if (!loadGame()) {
    newGame();
  } else {
    diffEl.value = difficulty;
    if (diffEl._updateCustomDropdown) diffEl._updateCustomDropdown();
  }

  if (typeof window.buildCustomDropdown === 'function') window.buildCustomDropdown(diffEl);
}

init();
