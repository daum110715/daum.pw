/* ===== Othello 黑白棋 ===== */

const BOARD_SIZE = 8;

const $ = GameUtils.$;
const storage = new GameStorage('game_othello');
const statsMgr = new GameStats(storage, 'stats_v1', { version: 1, started: 0, sessions: [] });
const timer = new GameTimer(ms => {
  $('stat-time').textContent = GameUtils.formatTime(Math.floor(ms / 1000));
});

/* ---------- 状态 ---------- */
let board = [];
let currentPlayer = 1; // 1=黑, 2=白
let mode = 'pvp';
let gameOver = false;
let moves = 0;
let history = [];
let lastMove = null;
let aiDifficulty = 'medium';
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
    aiDifficulty = $('ai-level').value;
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
function newGame(newMode) {
  if (newMode) mode = newMode;
  aiDifficulty = $('ai-level').value;

  board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  // 中心 2x2 开局
  board[3][3] = 2; board[3][4] = 1;
  board[4][3] = 1; board[4][4] = 2;

  currentPlayer = 1;
  gameOver = false;
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

/* ---------- 规则引擎 ---------- */
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],          [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

function getFlippedDiscs(b, r, c, player) {
  if (b[r][c] !== 0) return [];
  const opponent = player === 1 ? 2 : 1;
  const flipped = [];

  for (const [dr, dc] of DIRECTIONS) {
    let nr = r + dr, nc = c + dc;
    const line = [];
    while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && b[nr][nc] === opponent) {
      line.push({ r: nr, c: nc });
      nr += dr; nc += dc;
    }
    if (line.length > 0 && nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && b[nr][nc] === player) {
      flipped.push(...line);
    }
  }
  return flipped;
}

function getValidMoves(b, player) {
  const moves = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (getFlippedDiscs(b, r, c, player).length > 0) {
        moves.push({ r, c });
      }
    }
  }
  return moves;
}

function hasValidMove(b, player) {
  return getValidMoves(b, player).length > 0;
}

function getCounts(b) {
  let black = 0, white = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (b[r][c] === 1) black++;
      else if (b[r][c] === 2) white++;
    }
  }
  return { black, white };
}

function placeDisc(r, c) {
  const flipped = getFlippedDiscs(board, r, c, currentPlayer);
  if (flipped.length === 0) return false;

  // 保存历史
  history.push({
    board: board.map(row => [...row]),
    currentPlayer,
    moves,
    lastMove: lastMove ? { ...lastMove } : null
  });
  if (history.length > 100) history.shift();

  board[r][c] = currentPlayer;
  for (const { r: fr, c: fc } of flipped) {
    board[fr][fc] = currentPlayer;
  }
  lastMove = { r, c };
  moves++;

  const nextPlayer = currentPlayer === 1 ? 2 : 1;

  // 检查下家是否有合法步
  if (hasValidMove(board, nextPlayer)) {
    currentPlayer = nextPlayer;
    render();
    safeSaveGame();
    triggerAiIfNeeded();
    return true;
  }

  // 下家无步，检查当前玩家是否还有步
  if (hasValidMove(board, currentPlayer)) {
    // 下家跳过，当前玩家继续
    render();
    safeSaveGame();
    triggerAiIfNeeded();
    return true;
  }

  // 双方都无步，终局
  endGame();
  return true;
}

function triggerAiIfNeeded() {
  if (!gameOver && mode === 'ai' && currentPlayer === 2) {
    isThinking = true;
    render();
    setTimeout(() => {
      const depth = aiDifficulty === 'easy' ? 2 : aiDifficulty === 'hard' ? 5 : 3;
      const move = findBestMove(board, 2, depth);
      if (move) {
        placeDisc(move.r, move.c);
      } else {
        // AI 无步，尝试跳过
        if (!hasValidMove(board, 1)) {
          endGame();
        } else {
          currentPlayer = 1;
          render();
          safeSaveGame();
        }
      }
      isThinking = false;
      render();
    }, 100);
  }
}

function endGame() {
  gameOver = true;
  timer.stop();
  updateStats();
  clearSave();
  render();
  setTimeout(() => {
    showWin();
    fireConfetti();
  }, 300);
}

/* ---------- 渲染 ---------- */
function render() {
  const counts = getCounts(board);
  $('stat-black').textContent = counts.black;
  $('stat-white').textContent = counts.white;
  $('stat-turn').textContent = currentPlayer === 1 ? '黑棋' : '白棋';
  $('stat-moves').textContent = moves;
  $('stat-mode').textContent = mode === 'pvp' ? '双人' : '人机';

  const boardEl = $('board');
  boardEl.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'othello-board';

  const validMoves = gameOver || isThinking ? [] : getValidMoves(board, currentPlayer);
  const validSet = new Set(validMoves.map(m => m.r + ',' + m.c));

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'othello-cell';
      if (board[r][c] !== 0) cell.classList.add('has-disc');
      if (validSet.has(r + ',' + c)) cell.classList.add('valid-move');
      if (lastMove && lastMove.r === r && lastMove.c === c) cell.classList.add('last-move');

      if (board[r][c] !== 0) {
        const disc = document.createElement('div');
        disc.className = 'othello-disc ' + (board[r][c] === 1 ? 'black' : 'white');
        cell.appendChild(disc);
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

function onCellClick(r, c) {
  if (gameOver || isThinking || board[r][c] !== 0) return;
  placeDisc(r, c);
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
  render();
  safeSaveGame();
}

/* ---------- 胜利 ---------- */
function showWin() {
  const counts = getCounts(board);
  const isDraw = counts.black === counts.white;
  $('win-title').textContent = isDraw ? '和棋' : (counts.black > counts.white ? '黑棋获胜' : '白棋获胜');
  $('win-black').textContent = counts.black;
  $('win-white').textContent = counts.white;
  $('win-moves').textContent = moves;
  $('win-time').textContent = GameUtils.formatTime(Math.floor(timer.getElapsedMs() / 1000));
  const winStats = $('win-stats');
  if (winStats) winStats.innerHTML = generateStatsHTML();
  GameOverlay.show('win-overlay');
}
function hideWin() { GameOverlay.hide('win-overlay'); }

/* ---------- 统计 ---------- */
function updateStats() {
  const counts = getCounts(board);
  const stats = statsMgr.get();
  stats.started++;
  let winner = null;
  if (counts.black > counts.white) winner = 1;
  else if (counts.white > counts.black) winner = 2;
  else winner = 0;

  const session = {
    mode,
    aiLevel: aiDifficulty,
    winner,
    blackCount: counts.black,
    whiteCount: counts.white,
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
  const draws = sessions.filter(x => x.winner === 0).length;
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
    '<div>和局 <strong>' + (sessions.filter(x => x.winner === 0).length || 0) + '</strong></div>';
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
      '<span>' + result + ' · ' + s.moves + '步</span>' +
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
    moves,
    lastMove,
    aiDifficulty,
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
    moves = data.moves || 0;
    lastMove = data.lastMove || null;
    aiDifficulty = data.aiDifficulty || 'medium';
    history = [];
    const elapsed = data.elapsedMs || 0;
    timer.setElapsedMs(elapsed);

    $('mode-select').value = mode;
    syncDropdown($('mode-select'));
    $('ai-level').value = aiDifficulty;
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
  const WEIGHTS = [
    [100, -20,  10,   5,   5,  10, -20, 100],
    [-20, -30,   1,   1,   1,   1, -30, -20],
    [ 10,   1,   5,   2,   2,   5,   1,  10],
    [  5,   1,   2,   1,   1,   2,   1,   5],
    [  5,   1,   2,   1,   1,   2,   1,   5],
    [ 10,   1,   5,   2,   2,   5,   1,  10],
    [-20, -30,   1,   1,   1,   1, -30, -20],
    [100, -20,  10,   5,   5,  10, -20, 100]
  ];

  function evaluateBoard(b) {
    let score = 0, black = 0, white = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (b[r][c] === 1) { score += WEIGHTS[r][c]; black++; }
        else if (b[r][c] === 2) { score -= WEIGHTS[r][c]; white++; }
      }
    }
    const blackMoves = getValidMoves(b, 1).length;
    const whiteMoves = getValidMoves(b, 2).length;
    score += (blackMoves - whiteMoves) * 5;
    const total = black + white;
    if (total > 50) score += (black - white) * 2;
    return score;
  }

  function minimax(b, depth, alpha, beta, maximizing, player) {
    const validMoves = getValidMoves(b, player);
    if (validMoves.length === 0) {
      const nextPlayer = player === 1 ? 2 : 1;
      const nextMoves = getValidMoves(b, nextPlayer);
      if (nextMoves.length === 0) {
        // 终局
        const counts = getCounts(b);
        if (counts.black > counts.white) return maximizing ? 100000 : -100000;
        if (counts.white > counts.black) return maximizing ? -100000 : 100000;
        return 0;
      }
      // 跳过回合
      return minimax(b, depth, alpha, beta, !maximizing, nextPlayer);
    }

    if (depth === 0) return evaluateBoard(b);

    const nextPlayer = player === 1 ? 2 : 1;
    const limit = maximizing ? 10 : 8;

    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of validMoves.slice(0, limit)) {
        const flipped = getFlippedDiscs(b, move.r, move.c, player);
        b[move.r][move.c] = player;
        for (const { r: fr, c: fc } of flipped) b[fr][fc] = player;
        const evalScore = minimax(b, depth - 1, alpha, beta, false, nextPlayer);
        b[move.r][move.c] = 0;
        for (const { r: fr, c: fc } of flipped) b[fr][fc] = player === 1 ? 2 : 1;
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of validMoves.slice(0, limit)) {
        const flipped = getFlippedDiscs(b, move.r, move.c, player);
        b[move.r][move.c] = player;
        for (const { r: fr, c: fc } of flipped) b[fr][fc] = player;
        const evalScore = minimax(b, depth - 1, alpha, beta, true, nextPlayer);
        b[move.r][move.c] = 0;
        for (const { r: fr, c: fc } of flipped) b[fr][fc] = player === 1 ? 2 : 1;
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  window.findBestMove = function(b, player, depth) {
    const validMoves = getValidMoves(b, player);
    if (validMoves.length === 0) return null;
    if (validMoves.length === 1) return validMoves[0];

    let bestMove = null;
    let bestScore = -Infinity;
    const nextPlayer = player === 1 ? 2 : 1;

    for (const move of validMoves.slice(0, 12)) {
      const flipped = getFlippedDiscs(b, move.r, move.c, player);
      b[move.r][move.c] = player;
      for (const { r: fr, c: fc } of flipped) b[fr][fc] = player;
      let score = minimax(b, depth - 1, -Infinity, Infinity, false, nextPlayer);
      b[move.r][move.c] = 0;
      for (const { r: fr, c: fc } of flipped) b[fr][fc] = player === 1 ? 2 : 1;
      score += WEIGHTS[move.r][move.c] * 0.1;

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
