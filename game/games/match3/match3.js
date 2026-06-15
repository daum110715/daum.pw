/* ===== Match-3 消消乐 ===== */

const BOARD_SIZE = 8;
const GEM_TYPES = 6;

const $ = GameUtils.$;
const storage = new GameStorage('game_match3');
const statsMgr = new GameStats(storage, 'stats_v1', { version: 1, started: 0, won: 0, sessions: [], bestScore: 0, bestCombo: 0 });

/* ---------- 状态 ---------- */
let board = []; // { type, id } or null
let mode = 'time';
let score = 0;
let targetScore = 1000;
let movesLeft = 20;
let timeLeft = 60;
let selected = null;
let isResolving = false;
let combo = 0;
let maxCombo = 0;
let gameOver = false;
let gameWon = false;
let countdownInterval = null;
let gemIdCounter = 0;

/* ---------- 初始化 ---------- */
function init() {
  GameOverlay.bindEscToClose('win-overlay', 'help-overlay', 'confirm-overlay');

  $('btn-new').addEventListener('click', askNewGame);
  $('btn-help').addEventListener('click', showHelp);
  $('help-close').addEventListener('click', hideHelp);
  $('win-new').addEventListener('click', () => { hideWin(); newGame(); });

  $('mode-select').addEventListener('change', () => {
    if (gameOver || score === 0) {
      newGame($('mode-select').value);
    } else {
      GameOverlay.showConfirm('切换模式将开始新游戏，当前进度将丢失。').then(ok => {
        if (ok) newGame($('mode-select').value);
        else { $('mode-select').value = mode; syncDropdown($('mode-select')); }
      });
    }
  });

  document.addEventListener('keydown', onKeyDown);

  if (!loadGame()) {
    newGame();
  }

  if (typeof window.buildCustomDropdown === 'function') {
    window.buildCustomDropdown($('mode-select'));
  }
}

function syncDropdown(sel) {
  if (sel._updateCustomDropdown) sel._updateCustomDropdown();
}

/* ---------- 新游戏 ---------- */
function newGame(newMode) {
  if (newMode) mode = newMode;

  gemIdCounter = 0;
  board = generateBoard();
  score = 0;
  targetScore = 1000;
  movesLeft = 20;
  timeLeft = 60;
  selected = null;
  isResolving = false;
  combo = 0;
  maxCombo = 0;
  gameOver = false;
  gameWon = false;

  stopCountdown();
  if (mode === 'time') startCountdown();

  render();
  updateStatsDisplay();
  safeSaveGame();
}

function askNewGame() {
  if (gameOver || score === 0) {
    newGame();
  } else {
    GameOverlay.showConfirm('当前对局尚未结束，确定要重新开始吗？').then(ok => {
      if (ok) newGame();
    });
  }
}

/* ---------- 棋盘生成 ---------- */
function generateBoard() {
  const b = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    b[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      b[r][c] = createRandomGem();
    }
  }
  // 确保无预置匹配
  while (findMatches(b).length > 0) {
    const matches = findMatches(b);
    for (const match of matches) {
      for (const { r, c } of match.cells) {
        b[r][c] = createRandomGem();
      }
    }
  }
  // 确保有至少一个合法交换
  if (!hasPossibleMoves(b)) {
    return generateBoard();
  }
  return b;
}

function createRandomGem() {
  return { type: Math.floor(Math.random() * GEM_TYPES), id: ++gemIdCounter };
}

/* ---------- 匹配检测 ---------- */
function findMatches(b) {
  const matches = [];
  const matched = new Set();

  // 横向
  for (let r = 0; r < BOARD_SIZE; r++) {
    let c = 0;
    while (c < BOARD_SIZE) {
      if (!b[r][c]) { c++; continue; }
      const type = b[r][c].type;
      let len = 1;
      while (c + len < BOARD_SIZE && b[r][c + len] && b[r][c + len].type === type) len++;
      if (len >= 3) {
        const cells = [];
        for (let i = 0; i < len; i++) {
          const key = r + ',' + (c + i);
          if (!matched.has(key)) {
            matched.add(key);
            cells.push({ r, c: c + i });
          }
        }
        if (cells.length > 0) matches.push({ cells, type, length: len });
      }
      c += len;
    }
  }

  // 纵向
  for (let c = 0; c < BOARD_SIZE; c++) {
    let r = 0;
    while (r < BOARD_SIZE) {
      if (!b[r][c]) { r++; continue; }
      const type = b[r][c].type;
      let len = 1;
      while (r + len < BOARD_SIZE && b[r + len][c] && b[r + len][c].type === type) len++;
      if (len >= 3) {
        const cells = [];
        for (let i = 0; i < len; i++) {
          const key = (r + i) + ',' + c;
          if (!matched.has(key)) {
            matched.add(key);
            cells.push({ r: r + i, c });
          }
        }
        if (cells.length > 0) matches.push({ cells, type, length: len });
      }
      r += len;
    }
  }

  return matches;
}

/* ---------- 交换 ---------- */
function swapCells(r1, c1, r2, c2) {
  const tmp = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = tmp;
}

function areAdjacent(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

/* ---------- 重力 ---------- */
function applyGravity() {
  for (let c = 0; c < BOARD_SIZE; c++) {
    let writeRow = BOARD_SIZE - 1;
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      if (board[r][c]) {
        if (writeRow !== r) {
          board[writeRow][c] = board[r][c];
          board[r][c] = null;
        }
        writeRow--;
      }
    }
    for (let r = writeRow; r >= 0; r--) {
      board[r][c] = createRandomGem();
    }
  }
}

/* ---------- 死局检测 ---------- */
function hasPossibleMoves(b) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (c + 1 < BOARD_SIZE) {
        swapInPlace(b, r, c, r, c + 1);
        if (findMatches(b).length > 0) {
          swapInPlace(b, r, c, r, c + 1);
          return true;
        }
        swapInPlace(b, r, c, r, c + 1);
      }
      if (r + 1 < BOARD_SIZE) {
        swapInPlace(b, r, c, r + 1, c);
        if (findMatches(b).length > 0) {
          swapInPlace(b, r, c, r + 1, c);
          return true;
        }
        swapInPlace(b, r, c, r + 1, c);
      }
    }
  }
  return false;
}

function swapInPlace(b, r1, c1, r2, c2) {
  const tmp = b[r1][c1];
  b[r1][c1] = b[r2][c2];
  b[r2][c2] = tmp;
}

function shuffleBoard() {
  // 收集所有现有宝石并打乱位置
  const gems = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c]) gems.push(board[r][c]);
    }
  }
  for (let i = gems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gems[i], gems[j]] = [gems[j], gems[i]];
  }
  let idx = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      board[r][c] = gems[idx++] || createRandomGem();
    }
  }
  // 打乱后如果还有匹配，继续消除（cascade）
  const matches = findMatches(board);
  if (matches.length > 0) {
    isResolving = true;
    resolveMatches(matches);
  } else if (!hasPossibleMoves(board)) {
    // 极端情况：重新生成
    board = generateBoard();
    render();
  }
}

/* ---------- 计分 ---------- */
function calcScore(length, currentCombo) {
  let base = 0;
  if (length === 3) base = 30;
  else if (length === 4) base = 60;
  else if (length === 5) base = 120;
  else base = 200;
  const multiplier = 1 + currentCombo * 0.5;
  return Math.round(base * multiplier);
}

/* ---------- 交互 ---------- */
function onCellClick(r, c) {
  if (gameOver || isResolving || !board[r][c]) return;

  if (!selected) {
    selected = { r, c };
    render();
    return;
  }

  if (selected.r === r && selected.c === c) {
    selected = null;
    render();
    return;
  }

  if (!areAdjacent(selected.r, selected.c, r, c)) {
    selected = { r, c };
    render();
    return;
  }

  // 执行交换
  const sr = selected.r, sc = selected.c;
  selected = null;
  swapCells(sr, sc, r, c);

  const matches = findMatches(board);
  if (matches.length === 0) {
    // 无匹配，回弹
    isResolving = true;
    render();
    setTimeout(() => {
      swapCells(sr, sc, r, c);
      render();
      isResolving = false;
    }, 250);
    return;
  }

  // 有匹配，开始 resolve
  isResolving = true;
  if (mode === 'moves') movesLeft--;
  combo = 0;
  resolveMatches(matches);
}

function resolveMatches(matches) {
  // 计算得分
  let totalScore = 0;
  for (const match of matches) {
    totalScore += calcScore(match.length, combo);
  }
  score += totalScore;
  combo++;
  if (combo > maxCombo) maxCombo = combo;

  // 标记消除 - 给现有 DOM 元素添加 .matched 类，保留 shrink 动画
  const boardEl = $('board');
  const cells = boardEl.querySelectorAll('.match3-cell');
  for (const match of matches) {
    for (const { r, c } of match.cells) {
      const idx = r * BOARD_SIZE + c;
      if (cells[idx]) cells[idx].classList.add('matched');
    }
  }
  updateTopbar();

  setTimeout(() => {
    // 动画结束后才真正从 board 移除
    for (const match of matches) {
      for (const { r, c } of match.cells) {
        board[r][c] = null;
      }
    }
    applyGravity();
    render(true); // true = 标记 falling 动画

    setTimeout(() => {
      const nextMatches = findMatches(board);
      if (nextMatches.length > 0) {
        resolveMatches(nextMatches);
      } else {
        // cascade 结束
        isResolving = false;
        safeSaveGame();
        checkWinOrDead();
      }
    }, 300);
  }, 350);
}

function checkWinOrDead() {
  if (gameOver) return;

  if (score >= targetScore) {
    endGame(true);
    return;
  }

  if (mode === 'time' && timeLeft <= 0) {
    endGame(false);
    return;
  }

  if (mode === 'moves' && movesLeft <= 0) {
    endGame(score >= targetScore);
    return;
  }

  // 死局检测
  if (!hasPossibleMoves(board)) {
    shuffleBoard();
    render();
  }
}

function endGame(won) {
  gameOver = true;
  gameWon = won;
  stopCountdown();
  updateStats(won);
  clearSave();
  setTimeout(() => {
    showWin();
    if (won) fireConfetti();
  }, 300);
}

/* ---------- 倒计时 ---------- */
function startCountdown() {
  stopCountdown();
  countdownInterval = setInterval(() => {
    if (gameOver) return;
    timeLeft--;
    updateTopbar();
    safeSaveGame();
    if (timeLeft <= 0) {
      endGame(score >= targetScore);
    }
  }, 1000);
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

/* ---------- 渲染 ---------- */
function render(markFalling) {
  updateTopbar();

  const boardEl = $('board');
  boardEl.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'match3-board';

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'match3-cell';
      cell.dataset.r = r;
      cell.dataset.c = c;

      if (selected && selected.r === r && selected.c === c) {
        cell.classList.add('selected');
      }

      const gem = board[r][c];
      if (gem) {
        const gemEl = document.createElement('div');
        gemEl.className = 'gem gem-type-' + gem.type;
        cell.appendChild(gemEl);
      }

      if (markFalling && gem && gem.id > gemIdCounter - BOARD_SIZE * 2) {
        // 新生成的宝石添加下落动画
        cell.classList.add('falling');
      }

      cell.addEventListener('click', () => onCellClick(r, c));
      grid.appendChild(cell);
    }
  }

  boardEl.appendChild(grid);
}

function updateTopbar() {
  $('stat-score').textContent = score;
  $('stat-mode').textContent = mode === 'time' ? '限时' : '步数';
  $('stat-target').textContent = targetScore;
  $('stat-combo').textContent = maxCombo;
  if (mode === 'time') {
    $('stat-remaining').textContent = timeLeft + '秒';
  } else {
    $('stat-remaining').textContent = movesLeft + '步';
  }
}

/* ---------- 胜利 ---------- */
function showWin() {
  $('win-title').textContent = gameWon ? '恭喜通关！' : '游戏结束';
  $('win-score').textContent = score;
  $('win-combo').textContent = maxCombo;
  $('win-mode').textContent = mode === 'time' ? '限时' : '步数';
  const winStats = $('win-stats');
  if (winStats) winStats.innerHTML = generateStatsHTML();
  GameOverlay.show('win-overlay');
}
function hideWin() { GameOverlay.hide('win-overlay'); }

/* ---------- 统计 ---------- */
function updateStats(won) {
  const data = statsMgr.get();
  data.started++;
  if (won) {
    data.won++;
  }
  data.sessions.unshift({
    mode,
    score,
    maxCombo,
    won: !!won,
    completedAt: Date.now()
  });
  if (data.sessions.length > 50) data.sessions.pop();

  if (score > data.bestScore) data.bestScore = score;
  if (maxCombo > data.bestCombo) data.bestCombo = maxCombo;

  statsMgr.set(data);
  updateStatsDisplay();
}

function updateStatsDisplay() {
  const s = statsMgr.get();
  $('stats-started').textContent = s.started || 0;
  $('stats-won').textContent = s.won || 0;
  const winRate = s.started ? Math.round((s.won / s.started) * 100) : 0;
  $('stats-win-rate').textContent = winRate + '%';
  $('stats-best-score').textContent = s.bestScore || '-';
  $('stats-best-combo').textContent = s.bestCombo || '-';

  const wonSessions = (s.sessions || []).filter(x => x.won);
  const avgScore = wonSessions.length ? Math.round(wonSessions.reduce((sum, x) => sum + x.score, 0) / wonSessions.length) : 0;
  $('stats-avg-score').textContent = avgScore || '-';

  renderRecentList(s.sessions || []);
}

function generateStatsHTML() {
  const s = statsMgr.get();
  const winRate = s.started ? Math.round((s.won / s.started) * 100) : 0;
  return '<div>胜率 <strong>' + winRate + '%</strong></div>' +
    '<div>最高分数 <strong>' + (s.bestScore || '-') + '</strong></div>' +
    '<div>最高连锁 <strong>' + (s.bestCombo || '-') + '</strong></div>';
}

function renderRecentList(sessions) {
  const list = $('recent-list');
  if (!sessions.length) {
    list.innerHTML = '<div class="recent-empty">暂无记录</div>';
    return;
  }
  list.innerHTML = sessions.slice(0, 10).map(s => {
    const modeName = s.mode === 'time' ? '限时' : '步数';
    return '<div class="recent-item">' +
      '<span>' + modeName + '</span>' +
      '<span>' + s.score + '分 · 连锁' + s.maxCombo + '</span>' +
      '<span>' + (s.won ? '胜利' : '失败') + '</span>' +
      '</div>';
  }).join('');
}

/* ---------- 保存/加载 ---------- */
function saveGame() {
  const data = {
    board: board.map(row => row.map(gem => gem ? { type: gem.type, id: gem.id } : null)),
    mode,
    score,
    targetScore,
    movesLeft,
    timeLeft,
    combo,
    maxCombo,
    gameOver,
    gameWon,
    gemIdCounter,
    selected,
    isResolving
  };
  storage.save('save_v1', data);
}

function loadGame() {
  try {
    const data = storage.load('save_v1');
    if (!data || !Array.isArray(data.board)) return false;
    if (data.gameOver) { clearSave(); return false; }

    board = data.board.map(row => row.map(gem => gem ? { type: gem.type, id: gem.id } : null));
    mode = data.mode || 'time';
    score = data.score || 0;
    targetScore = data.targetScore || 1000;
    movesLeft = data.movesLeft || 20;
    timeLeft = data.timeLeft || 60;
    combo = data.combo || 0;
    maxCombo = data.maxCombo || 0;
    gameOver = data.gameOver || false;
    gameWon = data.gameWon || false;
    gemIdCounter = data.gemIdCounter || 0;
    selected = data.selected || null;
    isResolving = data.isResolving || false;

    $('mode-select').value = mode;
    syncDropdown($('mode-select'));

    stopCountdown();
    if (mode === 'time' && !gameOver) startCountdown();

    updateStatsDisplay();
    render();

    // 如果读档时正处于 resolve 中，自动检测并继续
    if (isResolving) {
      const matches = findMatches(board);
      if (matches.length > 0) {
        resolveMatches(matches);
      } else {
        isResolving = false;
        checkWinOrDead();
      }
    } else {
      checkWinOrDead();
    }

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
  if (isResolving) return;
  const key = e.key.toLowerCase();
  if (key === 'r') {
    e.preventDefault();
    askNewGame();
  }
}

/* ---------- 启动 ---------- */
init();
