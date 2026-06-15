/* ===== Gomoku 五子棋 ===== */

const BOARD_SIZE = 15;

const $ = GameUtils.$;
const storage = new GameStorage('game_gomoku');
const statsMgr = new GameStats(storage, 'stats_v1', { version: 1, started: 0, sessions: [] });
const timer = new GameTimer(ms => {
  $('stat-time').textContent = GameUtils.formatTime(Math.floor(ms / 1000));
});

/* ---------- 状态 ---------- */
let board = [];
let currentPlayer = 1; // 1=黑, 2=白
let mode = 'pvp';
let gameOver = false;
let winner = null;     // 1 / 2 / null
let moves = 0;
let history = [];
let lastMove = null;
let aiDepth = 2;
let isThinking = false;

/* ---------- 初始化 ---------- */
function init() {
  GameOverlay.bindEscToClose('win-overlay', 'help-overlay', 'confirm-overlay');

  $('btn-new').addEventListener('click', askNewGame);
  $('btn-undo').addEventListener('click', undo);
  $('btn-help').addEventListener('click', showHelp);
  $('help-close').addEventListener('click', hideHelp);
  $('win-new').addEventListener('click', () => { hideWin(); newGame(); });

  $('mode-select').addEventListener('change', () => {
    if (gameOver || moves === 0) {
      newGame($('mode-select').value);
    } else {
      GameOverlay.showConfirm('切换模式将开始新游戏，当前进度将丢失。').then(ok => {
        if (ok) newGame($('mode-select').value);
        else { $('mode-select').value = mode; syncDropdown($('mode-select')); }
      });
    }
  });

  $('ai-level').addEventListener('change', () => {
    const level = $('ai-level').value;
    aiDepth = level === 'easy' ? 2 : level === 'hard' ? 4 : 3;
  });

  document.addEventListener('keydown', onKeyDown);

  if (!loadGame()) {
    newGame();
  }

  if (typeof window.buildCustomDropdown === 'function') {
    window.buildCustomDropdown($('mode-select'));
    window.buildCustomDropdown($('ai-level'));
  }
}

function syncDropdown(sel) {
  if (sel._updateCustomDropdown) sel._updateCustomDropdown();
}

/* ---------- 新游戏 ---------- */
function newGame(newMode, newLevel) {
  if (newMode) mode = newMode;
  if (newLevel) {
    aiDepth = newLevel === 'easy' ? 2 : newLevel === 'hard' ? 4 : 3;
    $('ai-level').value = newLevel;
  } else {
    const level = $('ai-level').value;
    aiDepth = level === 'easy' ? 2 : level === 'hard' ? 4 : 3;
  }

  board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  currentPlayer = 1;
  gameOver = false;
  winner = null;
  moves = 0;
  history = [];
  lastMove = null;
  isThinking = false;

  timer.reset();
  timer.start();
  render();
  updateStatsDisplay();
  safeSaveGame();
}

function askNewGame() {
  if (gameOver || moves === 0) {
    newGame();
  } else {
    GameOverlay.showConfirm('当前对局尚未结束，确定要重新开始吗？').then(ok => {
      if (ok) newGame();
    });
  }
}

/* ---------- 渲染 ---------- */
function render() {
  $('stat-turn').textContent = currentPlayer === 1 ? '黑棋' : '白棋';
  $('stat-moves').textContent = moves;
  $('stat-mode').textContent = mode === 'pvp' ? '双人' : '人机';

  const boardEl = $('board');
  boardEl.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'gomoku-board';

  const stars = new Set(['3,3', '3,11', '7,7', '11,3', '11,11']);

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'gomoku-cell';
      if (stars.has(r + ',' + c)) cell.classList.add('star');
      if (board[r][c] !== 0) cell.classList.add('has-stone');
      if (lastMove && lastMove.r === r && lastMove.c === c) cell.classList.add('last-move');

      if (board[r][c] !== 0) {
        const stone = document.createElement('div');
        stone.className = 'gomoku-stone ' + (board[r][c] === 1 ? 'black' : 'white');
        cell.appendChild(stone);
      }

      if (!gameOver && !isThinking) {
        cell.addEventListener('click', () => onCellClick(r, c));
      }

      grid.appendChild(cell);
    }
  }

  boardEl.appendChild(grid);
  $('btn-undo').disabled = history.length === 0 || isThinking;
}

/* ---------- 交互 ---------- */
function onCellClick(r, c) {
  if (gameOver || isThinking || board[r][c] !== 0) return;

  placeStone(r, c);

  if (!gameOver && mode === 'ai' && currentPlayer === 2) {
    isThinking = true;
    render();
    setTimeout(() => {
      const move = findBestMove(board, aiDepth, 2);
      if (move) {
        placeStone(move.r, move.c);
      }
      isThinking = false;
      render();
    }, 100);
  }
}

function placeStone(r, c) {
  history.push({
    board: board.map(row => [...row]),
    currentPlayer,
    moves,
    lastMove: lastMove ? { ...lastMove } : null
  });
  if (history.length > 100) history.shift();

  board[r][c] = currentPlayer;
  lastMove = { r, c };
  moves++;

  const winCells = checkWin(r, c, currentPlayer);
  if (winCells) {
    gameOver = true;
    winner = currentPlayer;
    timer.stop();
    updateStats();
    clearSave();
    render();
    markWinLine(winCells);
    setTimeout(() => {
      showWin();
      fireConfetti();
    }, 400);
    return;
  }

  if (moves >= BOARD_SIZE * BOARD_SIZE) {
    gameOver = true;
    winner = null;
    timer.stop();
    updateStats();
    clearSave();
    render();
    setTimeout(() => {
      showWin();
    }, 300);
    return;
  }

  currentPlayer = currentPlayer === 1 ? 2 : 1;
  render();
  safeSaveGame();
}

function markWinLine(cells) {
  const boardEl = document.querySelector('.gomoku-board');
  if (!boardEl) return;
  const cellEls = boardEl.querySelectorAll('.gomoku-cell');
  cells.forEach(({ r, c }) => {
    const idx = r * BOARD_SIZE + c;
    if (cellEls[idx]) cellEls[idx].classList.add('win-line');
  });
}

/* ---------- 胜负判定 ---------- */
function checkWin(r, c, player) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];

  for (const [dr, dc] of directions) {
    const cells = [{ r, c }];
    for (let i = 1; i < 5; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE || board[nr][nc] !== player) break;
      cells.push({ r: nr, c: nc });
    }
    for (let i = 1; i < 5; i++) {
      const nr = r - dr * i, nc = c - dc * i;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE || board[nr][nc] !== player) break;
      cells.push({ r: nr, c: nc });
    }
    if (cells.length >= 5) return cells;
  }
  return null;
}

/* ---------- 撤销 ---------- */
function undo() {
  if (gameOver || history.length === 0 || isThinking) return;

  const steps = (mode === 'ai' && history.length >= 2) ? 2 : 1;

  for (let i = 0; i < steps && history.length > 0; i++) {
    const s = history.pop();
    board = s.board;
    currentPlayer = s.currentPlayer;
    moves = s.moves;
    lastMove = s.lastMove;
  }

  gameOver = false;
  winner = null;
  render();
  safeSaveGame();
}

/* ---------- 胜利 ---------- */
function showWin() {
  const isDraw = winner === null;
  $('win-title').textContent = isDraw ? '和棋' : (winner === 1 ? '黑棋获胜' : '白棋获胜');
  $('win-mode').textContent = mode === 'pvp' ? '双人' : '人机';
  $('win-moves').textContent = moves;
  $('win-time').textContent = GameUtils.formatTime(Math.floor(timer.getElapsedMs() / 1000));
  const winStats = $('win-stats');
  if (winStats) winStats.innerHTML = generateStatsHTML();
  GameOverlay.show('win-overlay');
}
function hideWin() { GameOverlay.hide('win-overlay'); }

/* ---------- 统计 ---------- */
function updateStats() {
  const stats = statsMgr.get();
  stats.started++;
  const session = {
    mode,
    aiLevel: $('ai-level').value,
    winner: winner,
    moves,
    timeMs: timer.getElapsedMs(),
    completedAt: Date.now()
  };
  stats.sessions.unshift(session);
  if (stats.sessions.length > 50) stats.sessions.pop();
  statsMgr.set(stats);
  updateStatsDisplay();
}

function updateStatsDisplay() {
  const s = statsMgr.get();
  $('stats-started').textContent = s.started || 0;

  const sessions = s.sessions || [];
  const blackWins = sessions.filter(x => x.winner === 1).length;
  const whiteWins = sessions.filter(x => x.winner === 2).length;
  const draws = sessions.filter(x => x.winner === null).length;
  const total = sessions.length;

  $('stats-black-wins').textContent = blackWins;
  $('stats-white-wins').textContent = whiteWins;
  $('stats-draws').textContent = draws;
  $('stats-black-rate').textContent = total ? Math.round((blackWins / total) * 100) + '%' : '0%';
  $('stats-white-rate').textContent = total ? Math.round((whiteWins / total) * 100) + '%' : '0%';

  renderRecentList(sessions);
}

function generateStatsHTML() {
  const s = statsMgr.get();
  const sessions = s.sessions || [];
  const blackWins = sessions.filter(x => x.winner === 1).length;
  const total = sessions.length;
  return '<div>胜率(黑) <strong>' + (total ? Math.round((blackWins / total) * 100) : 0) + '%</strong></div>' +
    '<div>和局 <strong>' + (sessions.filter(x => x.winner === null).length || 0) + '</strong></div>';
}

function renderRecentList(sessions) {
  const list = $('recent-list');
  if (!sessions.length) {
    list.innerHTML = '<div class="recent-empty">暂无记录</div>';
    return;
  }
  list.innerHTML = sessions.slice(0, 10).map(s => {
    const modeName = s.mode === 'pvp' ? '双人' : '人机(' + ({ easy: '简单', medium: '中等', hard: '困难' }[s.aiLevel] || s.aiLevel) + ')';
    const result = s.winner === 1 ? '黑胜' : s.winner === 2 ? '白胜' : '和棋';
    return '<div class="recent-item">' +
      '<span>' + modeName + '</span>' +
      '<span>' + result + ' · ' + s.moves + ' 步</span>' +
      '<span>' + GameUtils.formatTime(Math.floor(s.timeMs / 1000)) + '</span>' +
      '</div>';
  }).join('');
}

/* ---------- 保存/加载 ---------- */
function saveGame() {
  const data = {
    board,
    currentPlayer,
    mode,
    gameOver,
    winner,
    moves,
    lastMove,
    aiDepth,
    elapsedMs: timer.getElapsedMs()
  };
  storage.save('save_v1', data);
}

function loadGame() {
  try {
    const data = storage.load('save_v1');
    if (!data || !Array.isArray(data.board)) return false;
    if (data.gameOver) { clearSave(); return false; }
    board = data.board;
    currentPlayer = data.currentPlayer || 1;
    mode = data.mode || 'pvp';
    gameOver = data.gameOver || false;
    winner = data.winner || null;
    moves = data.moves || 0;
    lastMove = data.lastMove || null;
    aiDepth = data.aiDepth || 3;
    history = [];
    const elapsed = data.elapsedMs || 0;
    timer.setElapsedMs(elapsed);

    $('mode-select').value = mode;
    syncDropdown($('mode-select'));
    const level = aiDepth === 2 ? 'easy' : aiDepth === 4 ? 'hard' : 'medium';
    $('ai-level').value = level;
    syncDropdown($('ai-level'));

    updateStatsDisplay();
    render();
    if (!gameOver) timer.start();
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
  if (isThinking) return;
  const key = e.key.toLowerCase();
  if (key === 'r') {
    e.preventDefault();
    askNewGame();
  } else if (key === 'u' || (e.ctrlKey && key === 'z')) {
    e.preventDefault(); undo();
  }
}

/* ---------- AI ---------- */
(function() {
  const center = Math.floor(BOARD_SIZE / 2);
  const positionWeights = (() => {
    const w = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        w[r][c] = center - Math.max(Math.abs(r - center), Math.abs(c - center));
      }
    }
    return w;
  })();

  function getValidMoves(b) {
    const moves = [];
    const hasStone = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (b[r][c] !== 0) hasStone.push({ r, c });
      }
    }
    if (hasStone.length === 0) {
      return [{ r: center, c: center }];
    }

    const seen = new Set();
    for (const { r, c } of hasStone) {
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
          if (b[nr][nc] !== 0) continue;
          const key = nr + ',' + nc;
          if (seen.has(key)) continue;
          seen.add(key);
          moves.push({ r: nr, c: nc, score: positionWeights[nr][nc] });
        }
      }
    }
    moves.sort((a, b2) => b2.score - a.score);
    return moves;
  }

  function evaluateBoard(b) {
    let score = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (b[r][c] === 0) continue;
        const player = b[r][c];
        const sign = player === 2 ? 1 : -1;
        for (const [dr, dc] of directions) {
          // 只处理一个方向避免重复（比如横线只从左边第一个开始算）
          const pr = r - dr, pc = c - dc;
          if (pr >= 0 && pr < BOARD_SIZE && pc >= 0 && pc < BOARD_SIZE && b[pr][pc] === player) continue;
          const line = getLine(b, r, c, dr, dc, player);
          const val = evaluateLine(line);
          score += sign * val;
        }
      }
    }
    return score;
  }

  function getLine(b, r, c, dr, dc, player) {
    let count = 0;
    let openEnds = 0;
    let nr = r, nc = c;
    while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && b[nr][nc] === player) {
      count++;
      nr += dr;
      nc += dc;
    }
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && b[nr][nc] === 0) openEnds++;
    nr = r - dr; nc = c - dc;
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && b[nr][nc] === 0) openEnds++;
    return { count, openEnds };
  }

  function evaluateLine({ count, openEnds }) {
    if (count >= 5) return 100000;
    if (count === 4 && openEnds === 2) return 10000;
    if (count === 4 && openEnds === 1) return 1000;
    if (count === 3 && openEnds === 2) return 1000;
    if (count === 3 && openEnds === 1) return 100;
    if (count === 2 && openEnds === 2) return 100;
    if (count === 2 && openEnds === 1) return 10;
    return 0;
  }

  function checkWinFast(b, r, c, player) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of directions) {
      let count = 1;
      for (let i = 1; i < 5; i++) {
        const nr = r + dr * i, nc = c + dc * i;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE || b[nr][nc] !== player) break;
        count++;
      }
      for (let i = 1; i < 5; i++) {
        const nr = r - dr * i, nc = c - dc * i;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE || b[nr][nc] !== player) break;
        count++;
      }
      if (count >= 5) return true;
    }
    return false;
  }

  function minimax(b, depth, alpha, beta, maximizing, player) {
    const validMoves = getValidMoves(b);
    if (validMoves.length === 0) return 0;

    // 检查当前玩家是否有立即获胜的走法
    for (const move of validMoves) {
      b[move.r][move.c] = player;
      const won = checkWinFast(b, move.r, move.c, player);
      b[move.r][move.c] = 0;
      if (won) return maximizing ? 1000000 : -1000000;
    }

    if (depth === 0) return evaluateBoard(b);

    const nextPlayer = player === 1 ? 2 : 1;
    const limit = maximizing ? 12 : 10;

    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of validMoves.slice(0, limit)) {
        b[move.r][move.c] = player;
        const evalScore = minimax(b, depth - 1, alpha, beta, false, nextPlayer);
        b[move.r][move.c] = 0;
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of validMoves.slice(0, limit)) {
        b[move.r][move.c] = player;
        const evalScore = minimax(b, depth - 1, alpha, beta, true, nextPlayer);
        b[move.r][move.c] = 0;
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  window.findBestMove = function(b, depth, player) {
    const validMoves = getValidMoves(b);
    if (validMoves.length === 0) return null;

    if (validMoves.length === 1) return validMoves[0];

    let bestMove = null;
    let bestScore = -Infinity;
    const nextPlayer = player === 1 ? 2 : 1;

    for (const move of validMoves.slice(0, 18)) {
      b[move.r][move.c] = player;
      let score;
      if (checkWinFast(b, move.r, move.c, player)) {
        score = 1000000;
      } else {
        score = minimax(b, depth - 1, -Infinity, Infinity, false, nextPlayer);
      }
      b[move.r][move.c] = 0;
      score += positionWeights[move.r][move.c] * 0.1;

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    return bestMove;
  };
})();

/* ---------- 启动 ---------- */
init();
