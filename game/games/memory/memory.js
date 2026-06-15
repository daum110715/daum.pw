/* ===== Memory 记忆翻牌 ===== */

/* 50 个 SVG 几何路径（直接从远古遗留产物 game1.html 照搬） */
const SVG_PATHS = [
  "M50 15 L85 80 L15 80 Z","M20 20 H80 V80 H20 Z","M50 10 A40 40 0 1 1 49.9 10 Z","M50 15 L61 40 L85 40 L66 58 L72 85 L50 70 L28 85 L34 58 L15 40 L39 40 Z",
  "M20 50 Q20 20 50 20 T80 50 T50 80 T20 50","M50 20 L80 40 V60 L50 80 L20 60 V40 Z","M30 20 L70 20 L80 80 L20 80 Z","M50 15 C20 15 20 50 50 85 C80 50 80 15 50 15",
  "M20 20 L50 30 L80 20 L70 50 L80 80 L50 70 L20 80 L30 50 Z","M15 15 L85 15 L50 50 L85 85 L15 85 L50 50 Z","M50 10 L90 30 L90 70 L50 90 L10 70 L10 30 Z",
  "M20 30 Q50 10 80 30 L80 70 Q50 90 20 70 Z","M50 10 L65 35 H85 L70 55 L80 85 L50 70 L20 85 L30 55 L15 35 H35 Z","M20 20 Q80 20 80 80 Q20 80 20 20",
  "M30 20 H70 A10 10 0 0 1 70 80 H30 A10 10 0 0 1 30 20","M50 10 L80 80 H20 Z M50 30 L70 70 H30 Z","M20 50 L50 20 L80 50 L50 80 Z","M10 10 H40 V40 H10 Z M60 60 H90 V90 H60 Z",
  "M50 10 L20 80 H80 Z M50 30 L35 70 H65 Z","M20 20 L80 80 M80 20 L20 80","M10 50 L50 10 L90 50 L50 90 Z","M30 30 H70 V70 H30 Z M45 45 H55 V55 H45 Z",
  "M20 30 Q50 60 80 30","M50 10 V90 M10 50 H90","M20 20 L50 50 L80 20","M10 10 L90 90","M50 10 L60 40 H90 L65 60 L75 90 L50 70 L25 90 L35 60 L10 40 H40 Z",
  "M15 15 L85 85 M15 85 L85 15","M30 20 C10 20 10 50 30 50 H70 C90 50 90 20 70 20 Z","M50 20 L80 50 L50 80 L20 50 Z","M20 20 H45 V45 H20 Z M55 55 H80 V80 H55 Z",
  "M10 50 A40 40 0 1 0 90 50 A40 40 0 1 0 10 50 M30 50 A20 20 0 1 0 70 50 A20 20 0 1 0 30 50","M20 20 Q50 0 80 20 Q100 50 80 80 Q50 100 20 80 Q0 50 20 20",
  "M50 5 L95 50 L50 95 L5 50 Z","M30 30 L70 30 L50 70 Z","M10 10 H90 V20 H10 Z M10 80 H90 V90 H10 Z","M20 20 V80 M80 20 V80 M20 50 H80",
  "M15 50 Q50 10 85 50 Q50 90 15 50","M50 10 L90 80 H10 Z","M30 10 H70 L90 90 H10 Z","M10 10 L50 50 L90 10 L90 90 L50 50 L10 90 Z",
  "M50 10 L60 40 L90 40 L65 60 L75 90 L50 75 L25 90 L35 60 L10 40 L40 40 Z","M10 10 L40 40 M60 60 L90 90","M20 50 H80","M50 10 V90","M20 20 L80 20 L50 80 Z",
  "M50 20 A30 30 0 1 0 50 80 A30 30 0 1 0 50 20","M20 20 H80 V40 H20 Z M20 60 H80 V80 H20 Z",
  "M10 10 L30 10 V90 H10 Z M70 10 H90 V90 H70 Z","M10 45 H90 V55 H10 Z","M45 10 H55 V90 H45 Z"
];

const COLORS = Array.from({ length: 50 }, function(_, i) {
  var h1 = (i * 137) % 360;
  var h2 = (h1 + 40) % 360;
  return ['hsl(' + h1 + ', 80%, 75%)', 'hsl(' + h2 + ', 80%, 65%)'];
});

const DIFFICULTIES = {
  easy:   { name: '简单', rows: 4, cols: 4, pairs: 8 },
  medium: { name: '中等', rows: 4, cols: 5, pairs: 10 },
  hard:   { name: '困难', rows: 6, cols: 6, pairs: 18 }
};

/* ---------- 状态 ---------- */
let cards = [];
let firstPick = null;
let secondPick = null;
let isLocked = false;
let moves = 0;
let matchedPairs = 0;
let totalPairs = 8;
let difficulty = 'easy';
let gameWon = false;
let history = [];

const $ = GameUtils.$;
const storage = new GameStorage('game_memory');
const statsMgr = new GameStats(storage, 'stats_v1', { version: 3, started: 0, won: 0, sessions: [], bestMoves: 0, bestTimeMs: 0 });
const timer = new GameTimer(ms => {
  $('stat-time').textContent = GameUtils.formatTime(Math.floor(ms / 1000));
});

/* ---------- 初始化 ---------- */
function init() {
  GameOverlay.bindEscToClose('win-overlay', 'help-overlay', 'confirm-overlay');

  $('btn-new').addEventListener('click', askNewGame);
  $('btn-undo').addEventListener('click', undo);
  $('btn-help').addEventListener('click', showHelp);
  $('help-close').addEventListener('click', hideHelp);
  $('win-new').addEventListener('click', function() { hideWin(); newGame(); });

  $('difficulty').addEventListener('change', function() {
    if (gameWon || matchedPairs === 0) {
      newGame($('difficulty').value);
    } else {
      GameOverlay.showConfirm('切换难度将开始新游戏，当前进度将丢失。').then(function(ok) {
        if (ok) newGame($('difficulty').value);
        else { $('difficulty').value = difficulty; syncDropdown($('difficulty')); }
      });
    }
  });

  document.addEventListener('keydown', onKeyDown);

  if (!loadGame()) {
    newGame();
  }

  if (typeof window.buildCustomDropdown === 'function') {
    window.buildCustomDropdown($('difficulty'));
  }
}

function syncDropdown(sel) {
  if (sel._updateCustomDropdown) sel._updateCustomDropdown();
}

/* ---------- 新游戏 ---------- */
function newGame(diff) {
  if (diff) difficulty = diff;
  var cfg = DIFFICULTIES[difficulty];
  totalPairs = cfg.pairs;

  // 从 50 个形状中随机选 totalPairs 个
  var available = Array.from({ length: SVG_PATHS.length }, function(_, i) { return i; });
  shuffle(available);
  var indices = available.slice(0, totalPairs);

  var deck = [].concat(indices, indices);
  shuffle(deck);

  cards = deck.map(function(shapeIndex, i) {
    return { id: i, shapeIndex: shapeIndex, flipped: false, matched: false };
  });

  firstPick = null;
  secondPick = null;
  isLocked = false;
  moves = 0;
  matchedPairs = 0;
  gameWon = false;
  history = [];

  timer.reset();
  timer.start();
  render();
  updateStatsDisplay();
  safeSaveGame();
}

function askNewGame() {
  if (gameWon || matchedPairs === 0) {
    newGame();
  } else {
    GameOverlay.showConfirm('当前对局尚未结束，确定要重新开始吗？').then(function(ok) {
      if (ok) newGame();
    });
  }
}

function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
}

/* ---------- 粒子爆炸（配对成功时，使用主题色） ---------- */
function burst(x, y) {
  var color = getComputedStyle(document.documentElement).getPropertyValue('--good').trim() || '#5a8a6a';
  for (var i = 0; i < 12; i++) {
    var p = document.createElement('div');
    p.className = 'memory-particle';
    p.style.backgroundColor = color;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.boxShadow = '0 0 6px ' + color;
    document.body.appendChild(p);
    var angle = Math.random() * Math.PI * 2;
    var dist = 50 + Math.random() * 40;
    var dx = Math.cos(angle) * dist;
    var dy = Math.sin(angle) * dist;
    var anim = p.animate([
      { transform: 'translate(0,0) scale(2)', opacity: 1 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0)', opacity: 0 }
    ], { duration: 600, easing: 'ease-out', fill: 'forwards' });
    anim.onfinish = function() { this.target.remove(); };
    // 兜底：700ms 后强制清理
    setTimeout(function() { if (p.parentNode) p.remove(); }, 700);
  }
}

/* ---------- 渲染 ---------- */
function render() {
  // 清理残留粒子
  var particles = document.querySelectorAll('.memory-particle');
  for (var i = 0; i < particles.length; i++) {
    particles[i].remove();
  }

  var cfg = DIFFICULTIES[difficulty];
  $('stat-difficulty').textContent = cfg.name;
  $('stat-moves').textContent = moves;
  $('stat-remaining').textContent = totalPairs - matchedPairs;
  $('btn-undo').disabled = history.length === 0 || isLocked;

  var board = $('board');
  board.innerHTML = '';

  var grid = document.createElement('div');
  grid.className = 'memory-grid ' + difficulty;

  cards.forEach(function(card, idx) {
    var el = document.createElement('div');
    el.className = 'memory-card';
    if (card.flipped || card.matched) el.classList.add('flipped');
    if (card.matched) {
      el.classList.add('matched', 'disabled');
    }
    if (isLocked && !card.matched) el.classList.add('disabled');

    // 正面：SVG 几何形状
    var colors = COLORS[card.shapeIndex];
    var gradId = 'g-' + card.id + '-' + card.shapeIndex;
    var path = SVG_PATHS[card.shapeIndex];

    el.innerHTML =
      '<div class="memory-card-face memory-card-front">' +
        '<svg viewBox="0 0 100 100" class="memory-shape-svg">' +
          '<defs><linearGradient id="' + gradId + '">' +
            '<stop offset="0%" stop-color="' + colors[0] + '"/>' +
            '<stop offset="100%" stop-color="' + colors[1] + '"/>' +
          '</linearGradient></defs>' +
          '<path d="' + path + '" fill="url(#' + gradId + ')" />' +
        '</svg>' +
      '</div>' +
      '<div class="memory-card-face memory-card-back"></div>';

    el.addEventListener('click', (function(i) { return function() { onCardClick(i); }; })(idx));
    grid.appendChild(el);
  });

  board.appendChild(grid);
}

/* ---------- 交互 ---------- */
function onCardClick(idx) {
  if (isLocked || gameWon) return;
  var card = cards[idx];
  if (card.flipped || card.matched) return;

  pushHistory();
  card.flipped = true;

  if (firstPick === null) {
    firstPick = idx;
    render();
    safeSaveGame();
    return;
  }

  if (firstPick === idx) return;

  secondPick = idx;
  moves++;
  isLocked = true;
  render();

  var firstCard = cards[firstPick];
  var secondCard = cards[secondPick];

  // 等 350ms 让翻开动画播完再判断
  setTimeout(function() {
    if (firstCard.shapeIndex === secondCard.shapeIndex) {
      // 匹配成功：celebrate → matched → 粒子
      var cells = document.querySelectorAll('.memory-card');
      cells[firstPick].classList.add('celebrate');
      cells[secondPick].classList.add('celebrate');

      setTimeout(function() {
        firstCard.matched = true;
        secondCard.matched = true;
        matchedPairs++;
        // 直接操作 DOM：给现有元素加 matched class 触发动画
        cells[firstPick].classList.add('matched');
        cells[secondPick].classList.add('matched');
        // 记录位置，等卡片消失后再爆发粒子
        var r1 = cells[firstPick].getBoundingClientRect();
        var r2 = cells[secondPick].getBoundingClientRect();
        firstPick = null;
        secondPick = null;
        isLocked = false;
        // 等卡片消失动画结束后再爆发粒子 + render 重建
        setTimeout(function() {
          burst(r1.left + r1.width / 2, r1.top + r1.height / 2);
          burst(r2.left + r2.width / 2, r2.top + r2.height / 2);
          render();
          safeSaveGame();
          checkWin();
        }, 450);
      }, 450);
    } else {
      // 匹配失败：停留 800ms 让用户看清，再翻回
      setTimeout(function() {
        var cells = document.querySelectorAll('.memory-card');
        cells[firstPick].classList.remove('flipped');
        cells[secondPick].classList.remove('flipped');
        // 等翻回动画播完（0.3s）再重置状态
        setTimeout(function() {
          firstCard.flipped = false;
          secondCard.flipped = false;
          firstPick = null;
          secondPick = null;
          isLocked = false;
          render();
          safeSaveGame();
        }, 350);
      }, 800);
    }
  }, 350);
}

/* ---------- 撤销 ---------- */
function pushHistory() {
  history.push({
    cards: cards.map(function(c) { return { id: c.id, shapeIndex: c.shapeIndex, flipped: c.flipped, matched: c.matched }; }),
    firstPick: firstPick,
    secondPick: secondPick,
    isLocked: isLocked,
    moves: moves,
    matchedPairs: matchedPairs
  });
  if (history.length > 100) history.shift();
}

function undo() {
  if (gameWon || history.length === 0 || isLocked) return;
  var s = history.pop();
  cards = s.cards;
  firstPick = s.firstPick;
  secondPick = s.secondPick;
  isLocked = s.isLocked;
  moves = s.moves;
  matchedPairs = s.matchedPairs;
  render();
  safeSaveGame();
}

/* ---------- 胜利 ---------- */
function checkWin() {
  if (matchedPairs < totalPairs) return;
  gameWon = true;
  timer.stop();
  updateStats(true);
  clearSave();
  setTimeout(function() {
    showWin();
    fireConfetti();
  }, 300);
}

function showWin() {
  $('win-difficulty').textContent = DIFFICULTIES[difficulty].name;
  $('win-moves').textContent = moves;
  $('win-time').textContent = GameUtils.formatTime(Math.floor(timer.getElapsedMs() / 1000));
  var winStats = $('win-stats');
  if (winStats) winStats.innerHTML = generateStatsHTML();
  GameOverlay.show('win-overlay');
}
function hideWin() { GameOverlay.hide('win-overlay'); }

/* ---------- 统计 ---------- */
function updateStats(won) {
  var stats = statsMgr.get();
  stats.started++;
  if (won) {
    stats.won++;
    var session = {
      difficulty: difficulty,
      won: true,
      moves: moves,
      timeMs: timer.getElapsedMs(),
      completedAt: Date.now()
    };
    stats.sessions.unshift(session);
    if (stats.sessions.length > 50) stats.sessions.pop();
    if (stats.bestMoves === 0 || moves < stats.bestMoves) stats.bestMoves = moves;
    var timeMs = timer.getElapsedMs();
    if (stats.bestTimeMs === 0 || timeMs < stats.bestTimeMs) stats.bestTimeMs = timeMs;
  }
  statsMgr.set(stats);
  updateStatsDisplay();
}

function updateStatsDisplay() {
  var s = statsMgr.get();
  $('stats-started').textContent = s.started || 0;
  $('stats-won').textContent = s.won || 0;
  var winRate = s.started ? Math.round((s.won / s.started) * 100) : 0;
  $('stats-win-rate').textContent = winRate + '%';
  $('stats-best-moves').textContent = s.bestMoves || '-';
  $('stats-best-time').textContent = s.bestTimeMs ? GameUtils.formatTime(Math.floor(s.bestTimeMs / 1000)) : '-';
  var wonSessions = (s.sessions || []).filter(function(x) { return x.won; });
  var avgMoves = wonSessions.length ? Math.round(wonSessions.reduce(function(sum, x) { return sum + x.moves; }, 0) / wonSessions.length) : 0;
  $('stats-avg-moves').textContent = avgMoves || '-';
  renderRecentList(s.sessions || []);
}

function generateStatsHTML() {
  var s = statsMgr.get();
  var winRate = s.started ? Math.round((s.won / s.started) * 100) : 0;
  return '<div>胜率 <strong>' + winRate + '%</strong></div>' +
    '<div>最佳步数 <strong>' + (s.bestMoves || '-') + '</strong></div>' +
    '<div>最快时间 <strong>' + (s.bestTimeMs ? GameUtils.formatTime(Math.floor(s.bestTimeMs / 1000)) : '-') + '</strong></div>';
}

function renderRecentList(sessions) {
  var list = $('recent-list');
  var wonSessions = sessions.filter(function(s) { return s.won; });
  if (!wonSessions.length) {
    list.innerHTML = '<div class="recent-empty">暂无记录</div>';
    return;
  }
  list.innerHTML = wonSessions.slice(0, 10).map(function(s) {
    var diffName = DIFFICULTIES[s.difficulty] ? DIFFICULTIES[s.difficulty].name : s.difficulty;
    return '<div class="recent-item">' +
      '<span>' + diffName + '</span>' +
      '<span>' + s.moves + ' 步</span>' +
      '<span>' + GameUtils.formatTime(Math.floor(s.timeMs / 1000)) + '</span>' +
      '</div>';
  }).join('');
}

/* ---------- 保存/加载 ---------- */
function saveGame() {
  var data = {
    cards: cards,
    firstPick: firstPick,
    secondPick: secondPick,
    isLocked: isLocked,
    moves: moves,
    matchedPairs: matchedPairs,
    totalPairs: totalPairs,
    difficulty: difficulty,
    gameWon: gameWon,
    elapsedMs: timer.getElapsedMs()
  };
  storage.save('save_v1', data);
}

function loadGame() {
  try {
    var data = storage.load('save_v1');
    if (!data || !Array.isArray(data.cards)) return false;
    if (data.gameOver) { clearSave(); return false; }
    // 丢弃旧格式存档（无 shapeIndex 字段）
    if (data.cards.length > 0 && data.cards[0].shapeIndex === undefined) {
      clearSave(); return false;
    }
    cards = data.cards;
    firstPick = data.firstPick;
    secondPick = data.secondPick;
    isLocked = data.isLocked || false;
    moves = data.moves || 0;
    matchedPairs = data.matchedPairs || 0;
    totalPairs = data.totalPairs || (DIFFICULTIES[data.difficulty] ? DIFFICULTIES[data.difficulty].pairs : 8);
    difficulty = data.difficulty || 'easy';
    gameWon = data.gameOver || false;
    history = [];
    timer.setElapsedMs(data.elapsedMs || 0);
    $('difficulty').value = difficulty;
    syncDropdown($('difficulty'));
    updateStatsDisplay();
    render();
    if (!gameWon) timer.start();
    return true;
  } catch(e) { return false; }
}

function safeSaveGame() {
  try { saveGame(); } catch(e) {}
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
  if (isLocked) return;
  var key = e.key.toLowerCase();
  if (key === 'r') {
    e.preventDefault();
    askNewGame();
  } else if (key === 'u' || (e.ctrlKey && key === 'z')) {
    e.preventDefault(); undo();
  }
}

/* ---------- 启动 ---------- */
init();
