// ===== Klondike 纸牌 =====

const SUITS = ['黑桃', '红桃', '方块', '梅花'];
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const HISTORY_LIMIT = 200;

function getCardH() {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-h'), 10) || 108;
}
function getFaceOffset() {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--face-offset'), 10) || 24;
}
function getBackOffset() {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--back-offset'), 10) || 4;
}

let state = null;
let dropHintCol = null;      // 拖拽落点：tableau
let dropHintFound = null;    // 拖拽落点：foundation
let hintSourceType = null;   // 提示来源类型 ('waste' | 'tableau' | 'stock')
let hintSourceIdx = null;    // 提示来源索引
let hintTargetCol = null;    // 提示目标：tableau
let hintTargetFound = null;  // 提示目标：foundation
let gameStartTime = 0;
let gameTimerInterval = null;
let hintTimer = null;

const STATS_KEY = 'game_klondike_stats_v1';
const SAVE_KEY = 'game_klondike_save_v1';

function migrateLegacyKeys() {
  const oldSave = localStorage.getItem('klondike_save_v1');
  if (oldSave && !localStorage.getItem(SAVE_KEY)) {
    localStorage.setItem(SAVE_KEY, oldSave);
  }
}

function $(id) { return document.getElementById(id); }
const tableauEl = $('tableau');
const foundationEl = $('foundation');
const stockEl = $('stock');
const wasteEl = $('waste');
const dragLayer = $('drag-layer');
const toastEl = $('toast');

// ============================================================
// 工具
// ============================================================

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isRed(suit) { return suit === 1 || suit === 2; }

function isWinOpen() {
  return $('win-overlay') && !$('win-overlay').hidden;
}

function isLocked() {
  return !state || state.drag || isWinOpen();
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function getElapsedMs() {
  if (!gameStartTime) return 0;
  return Math.max(0, Date.now() - gameStartTime);
}

function updateTimerDisplay() {
  if (!gameStartTime) return;
  $('stat-time').textContent = formatTime(getElapsedMs());
}

function startGameTimer() {
  stopGameTimer();
  updateTimerDisplay();
  gameTimerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopGameTimer() {
  if (gameTimerInterval) {
    clearInterval(gameTimerInterval);
    gameTimerInterval = null;
  }
}

// ============================================================
// 统计
// ============================================================

function defaultStats() {
  return { version: 2, started: 0, won: 0, sessions: [] };
}

function getStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (typeof data.started !== 'number') data.started = 0;
      if (typeof data.won !== 'number') data.won = 0;
      if (!Array.isArray(data.sessions)) data.sessions = [];
      if (!Number.isFinite(data.version)) {
        data.version = 2;
      }
      return data;
    }
  } catch {}
  return defaultStats();
}

function saveStats(data) {
  try {
    data.won = data.sessions.filter((s) => s.won).length;
    localStorage.setItem(STATS_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Stats save failed', err);
  }
}

function recordStart() {
  const stats = getStats();
  stats.started = (stats.started || 0) + 1;
  saveStats(stats);
  gameStartTime = Date.now();
}

function recordWin(score, moves) {
  const stats = getStats();
  stats.won = (stats.won || 0) + 1;
  const timeMs = Date.now() - gameStartTime;
  stats.sessions = stats.sessions || [];
  stats.sessions.unshift({
    score, moves, timeMs,
    won: true,
    dealMode: state.dealMode,
    completedAt: Date.now(),
  });
  if (stats.sessions.length > 50) stats.sessions.length = 50;
  saveStats(stats);
  return stats;
}

// ============================================================
// 保存 / 恢复
// ============================================================

function saveGame() {
  if (!state) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      stock: state.stock,
      waste: state.waste,
      foundation: state.foundation,
      tableau: state.tableau,
      score: state.score,
      moves: state.moves,
      dealMode: state.dealMode,
      history: state.history,
      elapsedMs: getElapsedMs(),
      savedAt: Date.now(),
    }));
  } catch (err) {
    console.warn('Game save failed', err);
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.tableau) || !Array.isArray(data.stock)) return false;
    const dealMode = Number.isFinite(data.dealMode) && (data.dealMode === 1 || data.dealMode === 3) ? data.dealMode : 3;
    state = {
      stock: data.stock,
      waste: data.waste,
      foundation: data.foundation,
      tableau: data.tableau,
      score: data.score ?? 0,
      moves: data.moves ?? 0,
      dealMode,
      history: Array.isArray(data.history) ? data.history : [],
      drag: null,
    };
    const elapsed = Number.isFinite(data.elapsedMs) ? data.elapsedMs : 0;
    gameStartTime = Date.now() - Math.max(0, elapsed);
    dropHintCol = null;
    dropHintFound = null;
    $('deal-mode').value = String(state.dealMode);
    if ($('deal-mode')._updateCustomDropdown) $('deal-mode')._updateCustomDropdown();
    hideWin();
    clearHint();
    render();
    startGameTimer();
    return true;
  } catch {
    return false;
  }
}

function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

// ============================================================
// 初始化
// ============================================================

function makeDeck() {
  const deck = [];
  let id = 0;
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: id++, suit, rank, faceUp: false });
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function newGame(dealMode) {
  clearSave();
  const deck = shuffle(makeDeck());
  const tableau = [[], [], [], [], [], [], []];
  let idx = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck[idx++];
      card.faceUp = row === col;
      tableau[col].push(card);
    }
  }
  const stock = deck.slice(idx);
  state = {
    stock,
    waste: [],
    foundation: [[], [], [], []],
    tableau,
    score: 0,
    moves: 0,
    dealMode,
    history: [],
    drag: null,
  };
  dropHintCol = null;
  dropHintFound = null;
  hideWin();
  clearHint();
  recordStart();
  render();
  startGameTimer();
}

// ============================================================
// 规则
// ============================================================

function canPlaceOnFoundation(card, foundIdx) {
  const pile = state.foundation[foundIdx];
  if (pile.length === 0) return card.rank === 1; // A
  const top = pile[pile.length - 1];
  return top.suit === card.suit && top.rank + 1 === card.rank;
}

function isValidSequence(cards) {
  for (let i = 0; i < cards.length - 1; i++) {
    const a = cards[i], b = cards[i + 1];
    if (a.rank !== b.rank + 1) return false;
    if (isRed(a.suit) === isRed(b.suit)) return false;
  }
  return true;
}

function canPlaceOnTableau(cards, colIdx) {
  if (!isValidSequence(cards)) return false;
  const col = state.tableau[colIdx];
  const first = cards[0];
  if (col.length === 0) return first.rank === 13; // K
  const top = col[col.length - 1];
  if (!top.faceUp) return false;
  return top.rank === first.rank + 1 && isRed(top.suit) !== isRed(first.suit);
}

function findFoundationFor(card) {
  for (let i = 0; i < 4; i++) {
    if (canPlaceOnFoundation(card, i)) return i;
  }
  return -1;
}

// ============================================================
// 历史与撤销
// ============================================================

function snapshot() {
  return {
    stock: state.stock.map((c) => ({ ...c })),
    waste: state.waste.map((c) => ({ ...c })),
    foundation: state.foundation.map((p) => p.map((c) => ({ ...c }))),
    tableau: state.tableau.map((col) => col.map((c) => ({ ...c }))),
    score: state.score,
    moves: state.moves,
  };
}

function pushHistory() {
  state.history.push(snapshot());
  if (state.history.length > HISTORY_LIMIT) state.history.shift();
}

function undo() {
  if (isLocked()) return;
  if (state.history.length === 0) return;
  clearHint();
  const snap = state.history.pop();
  state.stock = snap.stock;
  state.waste = snap.waste;
  state.foundation = snap.foundation;
  state.tableau = snap.tableau;
  state.score = snap.score;
  state.moves = snap.moves;
  render();
  saveGame();
}

// ============================================================
// 移动执行
// ============================================================

function addScore(points) {
  state.score = Math.max(0, state.score + points);
}

function moveToFoundation(sourceType, sourceIdx, cardIdx, foundIdx, skipHistory) {
  if (!skipHistory) pushHistory();
  let card;
  if (sourceType === 'waste') {
    card = state.waste.pop();
  } else if (sourceType === 'tableau') {
    card = state.tableau[sourceIdx].pop();
  }
  if (!card) return false;
  state.foundation[foundIdx].push({ ...card, faceUp: true });
  state.moves++;
  addScore(10);
  if (sourceType === 'tableau') {
    const col = state.tableau[sourceIdx];
    if (col.length > 0 && !col[col.length - 1].faceUp) {
      col[col.length - 1].faceUp = true;
      addScore(5);
    }
  }
  saveGame();
  return true;
}

function moveToTableau(fromCol, fromIdx, toCol, skipHistory) {
  if (!skipHistory) pushHistory();
  const moving = state.tableau[fromCol].splice(fromIdx);
  state.tableau[toCol].push(...moving);
  state.moves++;
  addScore(5);
  const src = state.tableau[fromCol];
  if (src.length > 0 && !src[src.length - 1].faceUp) {
    src[src.length - 1].faceUp = true;
    addScore(5);
  }
  saveGame();
  return true;
}

function moveWasteToTableau(toCol, skipHistory) {
  if (!skipHistory) pushHistory();
  const card = state.waste.pop();
  state.tableau[toCol].push({ ...card, faceUp: true });
  state.moves++;
  addScore(5);
  saveGame();
  return true;
}

function dealStock() {
  const n = state.dealMode;
  if (state.stock.length === 0 && state.waste.length === 0) return;
  clearHint();
  pushHistory();
  if (state.stock.length === 0) {
    // 回收 waste 到 stock
    while (state.waste.length) {
      const c = state.waste.pop();
      c.faceUp = false;
      state.stock.push(c);
    }
    state.moves++;
    addScore(-100);
    saveGame();
    render();
    return;
  }
  const count = Math.min(n, state.stock.length);
  for (let i = 0; i < count; i++) {
    const c = state.stock.pop();
    c.faceUp = true;
    state.waste.push(c);
  }
  state.moves++;
  saveGame();
  render();
}

// ============================================================
// 自动收集
// ============================================================

function autoCollect() {
  if (isLocked()) return false;
  clearHint();
  let moved = false;
  let safety = 50;
  while (safety-- > 0) {
    let found = false;
    // waste top
    if (state.waste.length > 0) {
      const c = state.waste[state.waste.length - 1];
      const f = findFoundationFor(c);
      if (f !== -1 && isSafeToFoundation(c)) {
        moveToFoundation('waste', 0, 0, f);
        found = true;
      }
    }
    // tableau tops
    if (!found) {
      for (let col = 0; col < 7; col++) {
        const column = state.tableau[col];
        if (column.length === 0) continue;
        const c = column[column.length - 1];
        if (!c.faceUp) continue;
        const f = findFoundationFor(c);
        if (f !== -1 && isSafeToFoundation(c)) {
          moveToFoundation('tableau', col, column.length - 1, f);
          found = true;
          break;
        }
      }
    }
    if (!found) break;
    moved = true;
  }
  if (moved) {
    render();
    checkWin();
  }
  return moved;
}

function isSafeToFoundation(card) {
  // 保守策略：只有 A/2 或同花色更小的牌已经在基台时才自动移
  if (card.rank <= 2) return true;
  const otherSuit = card.suit;
  const neededRank = card.rank - 1;
  const pile = state.foundation[otherSuit];
  return pile.length >= neededRank;
}

// ============================================================
// 胜利
// ============================================================

function checkWin() {
  for (let i = 0; i < 4; i++) {
    if (state.foundation[i].length !== 13) return;
  }
  showWin();
}

function showWin() {
  stopGameTimer();
  clearSave();
  $('win-score').textContent = state.score;
  $('win-moves').textContent = state.moves;
  $('win-time').textContent = formatTime(getElapsedMs());
  const stats = recordWin(state.score, state.moves);
  renderWinStats(stats);
  $('win-overlay').hidden = false;
  launchConfetti();
}

function hideWin() {
  $('win-overlay').hidden = true;
}

function renderWinStats(stats) {
  const el = $('win-stats');
  if (!el) return;
  const winRate = stats.started > 0 ? Math.round((stats.won / stats.started) * 100) : 0;
  const wonSessions = (stats.sessions || []).filter((s) => s.won);
  const bestScore = wonSessions.sort((a, b) => b.score - a.score)[0];
  const bestMoves = wonSessions.sort((a, b) => a.moves - b.moves)[0];
  el.innerHTML =
    `胜率 <strong>${winRate}%</strong>　` +
    `最佳 <strong>${bestScore ? bestScore.score : '-'}</strong> 分　` +
    `最少 <strong>${bestMoves ? bestMoves.moves : '-'}</strong> 步`;
}


// ============================================================
// 提示
// ============================================================

function hint() {
  if (isLocked()) return;
  clearHint();
  const found = findHint();
  if (!found) {
    toast('没有可移动的提示');
    return;
  }
  applyHint(found);
  hintTimer = setTimeout(clearHint, 3000);
}

function findHint() {
  // 1. waste -> foundation
  if (state.waste.length > 0) {
    const c = state.waste[state.waste.length - 1];
    const f = findFoundationFor(c);
    if (f !== -1) return { type: 'waste-to-found', found: f };
  }
  // 2. tableau top -> foundation
  for (let col = 0; col < 7; col++) {
    const column = state.tableau[col];
    if (column.length === 0) continue;
    const c = column[column.length - 1];
    if (!c.faceUp) continue;
    const f = findFoundationFor(c);
    if (f !== -1) return { type: 'tab-to-found', col, found: f };
  }
  // 3. waste -> tableau
  if (state.waste.length > 0) {
    const c = state.waste[state.waste.length - 1];
    for (let col = 0; col < 7; col++) {
      if (canPlaceOnTableau([c], col)) return { type: 'waste-to-tab', col };
    }
  }
  // 4. tableau -> tableau
  for (let from = 0; from < 7; from++) {
    const col = state.tableau[from];
    for (let idx = 0; idx < col.length; idx++) {
      if (!col[idx].faceUp) continue;
      const seq = col.slice(idx);
      for (let to = 0; to < 7; to++) {
        if (to === from) continue;
        if (canPlaceOnTableau(seq, to)) return { type: 'tab-to-tab', from, idx, to };
      }
    }
  }
  // 5. stock recyclable
  if (state.stock.length === 0 && state.waste.length > 0) {
    return { type: 'recycle' };
  }
  return null;
}

function applyHint(found) {
  if (found.type === 'waste-to-found') {
    const card = wasteEl.querySelector('.card:last-child');
    if (card) card.classList.add('hint-source');
    const slot = foundationEl.querySelector(`.found-slot[data-pile="${found.found}"]`);
    if (slot) slot.classList.add('hint-target');
    hintSourceType = 'waste';
    hintTargetFound = found.found;
  } else if (found.type === 'tab-to-found') {
    const colEl = tableauEl.querySelector(`.column[data-col="${found.col}"]`);
    const card = colEl?.querySelector('.card:last-child');
    if (card) card.classList.add('hint-source');
    const slot = foundationEl.querySelector(`.found-slot[data-pile="${found.found}"]`);
    if (slot) slot.classList.add('hint-target');
    hintSourceType = 'tableau';
    hintSourceIdx = found.col;
    hintTargetFound = found.found;
  } else if (found.type === 'waste-to-tab') {
    const card = wasteEl.querySelector('.card:last-child');
    if (card) card.classList.add('hint-source');
    const colEl = tableauEl.querySelector(`.column[data-col="${found.col}"]`);
    if (colEl) colEl.classList.add('hint-target');
    hintSourceType = 'waste';
    hintTargetCol = found.col;
  } else if (found.type === 'tab-to-tab') {
    const fromEl = tableauEl.querySelector(`.column[data-col="${found.from}"]`);
    const cards = fromEl?.querySelectorAll('.card');
    if (cards) {
      const start = Math.max(0, cards.length - (state.tableau[found.from].length - found.idx));
      for (let i = start; i < cards.length; i++) cards[i].classList.add('hint-source');
    }
    const toEl = tableauEl.querySelector(`.column[data-col="${found.to}"]`);
    if (toEl) toEl.classList.add('hint-target');
    hintSourceType = 'tableau';
    hintSourceIdx = found.from;
    hintTargetCol = found.to;
  } else if (found.type === 'recycle') {
    stockEl.classList.add('hint-source');
    hintSourceType = 'stock';
  }
}

function clearHint() {
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
  document.querySelectorAll('.hint-source').forEach((el) => el.classList.remove('hint-source'));
  document.querySelectorAll('.hint-target').forEach((el) => el.classList.remove('hint-target'));
  hintSourceType = null;
  hintSourceIdx = null;
  hintTargetCol = null;
  hintTargetFound = null;
}

// ============================================================
// 渲染
// ============================================================

function makeCardEl(card) {
  const el = document.createElement('div');
  const suit = Math.max(0, Math.min(3, card.suit == null ? 0 : card.suit));
  const rank = Math.max(1, Math.min(13, card.rank == null ? 1 : card.rank));
  if (!card.faceUp) {
    el.className = 'card face-down';
  } else {
    el.className = 'card face-up suit-' + suit;
    const top = document.createElement('div');
    top.className = 'corner top';
    top.innerHTML = `<div class="rank">${RANKS[rank]}</div><div class="suit">${SUITS[suit]}</div>`;
    const center = document.createElement('div');
    center.className = 'center';
    center.textContent = SUITS[suit];
    const bot = document.createElement('div');
    bot.className = 'corner bot';
    bot.innerHTML = `<div class="rank">${RANKS[rank]}</div><div class="suit">${SUITS[suit]}</div>`;
    el.appendChild(top);
    el.appendChild(center);
    el.appendChild(bot);
  }
  el.dataset.id = card.id;
  return el;
}

function renderStock() {
  stockEl.innerHTML = '';
  stockEl.classList.remove('hint-source');
  const hasStock = state.stock.length > 0;
  const hasWaste = state.waste.length > 0;
  if (!hasStock && !hasWaste) {
    stockEl.classList.add('empty');
    stockEl.classList.remove('recyclable');
    return;
  }
  if (!hasStock && hasWaste) {
    stockEl.classList.add('empty', 'recyclable');
    return;
  }
  stockEl.classList.remove('empty', 'recyclable');
  for (let i = 0; i < state.stock.length; i++) {
    const back = document.createElement('div');
    back.className = 'card face-down stack-card';
    back.style.left = '0';
    back.style.top = (i * 0.5) + 'px';
    stockEl.appendChild(back);
  }
}

function renderWaste() {
  wasteEl.innerHTML = '';
  const total = state.waste.length;
  if (total === 0) return;
  const showCount = Math.min(state.dealMode, total);
  const start = total - showCount;
  for (let i = start; i < total; i++) {
    const card = state.waste[i];
    const cardEl = makeCardEl(card);
    cardEl.dataset.wasteIdx = i;
    const offset = i - start;           // 0, 1, 2... 越新越靠右
    cardEl.style.left = (offset * 4) + 'px';
    cardEl.style.zIndex = i;            // 新牌 z-index 更高
    if (offset < showCount - 1) cardEl.style.opacity = '0.85';
    wasteEl.appendChild(cardEl);
  }
}

function renderFoundation() {
  foundationEl.querySelectorAll('.found-slot').forEach((slot, i) => {
    slot.innerHTML = '';
    slot.dataset.pile = i;
    const pile = state.foundation[i];
    if (pile.length > 0) {
      const top = pile[pile.length - 1];
      const cardEl = makeCardEl(top);
      slot.appendChild(cardEl);
    }
  });
}

function render() {
  clearHint();
  $('stat-score').textContent = state.score;
  $('stat-moves').textContent = state.moves;
  $('btn-undo').disabled = state.history.length === 0 || state.drag;
  renderStock();
  renderWaste();
  renderFoundation();

  const cardH = getCardH();
  const faceOffset = getFaceOffset();
  const backOffset = getBackOffset();

  tableauEl.innerHTML = '';
  for (let col = 0; col < 7; col++) {
    const colEl = document.createElement('div');
    colEl.className = 'column';
    colEl.dataset.col = col;
    if (state.tableau[col].length === 0) colEl.classList.add('empty-slot');
    let y = 0;
    const cards = state.tableau[col];
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const cardEl = makeCardEl(card);
      cardEl.style.top = y + 'px';
      cardEl.dataset.col = col;
      cardEl.dataset.idx = i;
      if (state.drag && state.drag.sourceType === 'tableau' && state.drag.sourceIdx === col && state.drag.cardIdx <= i) {
        cardEl.classList.add('dragging');
      }
      colEl.appendChild(cardEl);
      y += card.faceUp ? faceOffset : backOffset;
    }
    colEl.style.minHeight = Math.max(cardH, y + cardH) + 'px';
    tableauEl.appendChild(colEl);
  }
}

// ============================================================
// 拖拽
// ============================================================

function onPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (isLocked()) return;
  if (!e.target.closest('.card, .stock-pile, .column, .foundation-slot')) return;

  // 双击检测
  if (e.detail === 2) {
    const cardEl = e.target.closest('.card.face-up');
    if (cardEl) {
      e.preventDefault();
      handleDoubleClick(cardEl);
      return;
    }
  }

  const cardEl = e.target.closest('.card.face-up');
  if (!cardEl) return;

  // waste card
  if (cardEl.parentElement === wasteEl) {
    const wasteIdx = parseInt(cardEl.dataset.wasteIdx, 10);
    if (wasteIdx !== state.waste.length - 1) return; // only top
    startDrag(e, 'waste', 0, wasteIdx, [state.waste[wasteIdx]]);
    return;
  }

  // tableau card
  const col = parseInt(cardEl.dataset.col, 10);
  const idx = parseInt(cardEl.dataset.idx, 10);
  if (Number.isNaN(col) || Number.isNaN(idx)) return;

  const seq = state.tableau[col].slice(idx);
  if (!isValidSequence(seq)) {
    flashCard(cardEl);
    return;
  }

  startDrag(e, 'tableau', col, idx, seq);
}

function startDrag(e, sourceType, sourceIdx, cardIdx, cards) {
  clearHint();
  const stack = document.createElement('div');
  stack.className = 'drag-stack';
  const faceOffset = getFaceOffset();
  for (let i = 0; i < cards.length; i++) {
    const c = makeCardEl(cards[i]);
    c.style.top = (i * faceOffset) + 'px';
    c.style.left = '0';
    stack.appendChild(c);
  }
  dragLayer.appendChild(stack);

  let startCardEl;
  if (sourceType === 'waste') {
    startCardEl = wasteEl.querySelector('.card:last-child');
  } else {
    startCardEl = tableauEl.querySelector(`.column[data-col="${sourceIdx}"] .card[data-idx="${cardIdx}"]`);
  }
  if (!startCardEl) { stack.remove(); return; }

  const rect = startCardEl.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;
  stack.style.left = (e.clientX - offsetX) + 'px';
  stack.style.top = (e.clientY - offsetY) + 'px';

  // hide originals
  if (sourceType === 'tableau') {
    const colEls = tableauEl.querySelector(`.column[data-col="${sourceIdx}"]`).querySelectorAll('.card');
    for (let i = cardIdx; i < colEls.length; i++) colEls[i].classList.add('dragging');
  } else if (sourceType === 'waste') {
    startCardEl.classList.add('dragging');
  }

  state.drag = {
    sourceType, sourceIdx, cardIdx, cards,
    stack, offsetX, offsetY,
  };

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerCancel);
}

function onPointerMove(e) {
  if (!state.drag) return;
  const { stack, offsetX, offsetY } = state.drag;
  stack.style.left = (e.clientX - offsetX) + 'px';
  stack.style.top = (e.clientY - offsetY) + 'px';

  clearDropHints();
  const t = findDropTarget(e.clientX, e.clientY);
  if (t) {
    if (t.type === 'tableau') {
      if (canPlaceOnTableau(state.drag.cards, t.idx)) {
        dropHintCol = t.idx;
        const colEl = tableauEl.querySelector(`.column[data-col="${t.idx}"]`);
        if (colEl) colEl.classList.add('drop-hint');
      }
    } else if (t.type === 'foundation') {
      if (state.drag.cards.length === 1 && canPlaceOnFoundation(state.drag.cards[0], t.idx)) {
        dropHintFound = t.idx;
        const slot = foundationEl.querySelector(`.found-slot[data-pile="${t.idx}"]`);
        if (slot) slot.classList.add('drop-hint');
      }
    }
  }
}

function onPointerUp(e) {
  if (!state.drag) return;
  const { sourceType, sourceIdx, cardIdx, cards, stack } = state.drag;
  cleanupDragListeners();
  clearDropHints();

  const t = findDropTarget(e.clientX, e.clientY);
  let moved = false;

  if (t && t.type === 'tableau') {
    if (canPlaceOnTableau(cards, t.idx)) {
      if (sourceType === 'waste') {
        moveWasteToTableau(t.idx);
      } else {
        moveToTableau(sourceIdx, cardIdx, t.idx);
      }
      moved = true;
    }
  } else if (t && t.type === 'foundation') {
    if (cards.length === 1 && canPlaceOnFoundation(cards[0], t.idx)) {
      moveToFoundation(sourceType, sourceIdx, cardIdx, t.idx);
      moved = true;
    }
  }

  if (moved) {
    stack.remove();
    state.drag = null;
    render();
    checkWin();
  } else {
    animateReturn(stack, sourceType, sourceIdx, cardIdx);
  }
}

function animateReturn(stack, sourceType, sourceIdx, cardIdx) {
  let originEl;
  if (sourceType === 'waste') {
    originEl = wasteEl.querySelector('.card:last-child');
  } else {
    originEl = tableauEl.querySelector(`.column[data-col="${sourceIdx}"] .card[data-idx="${cardIdx}"]`);
  }
  if (originEl) {
    const rect = originEl.getBoundingClientRect();
    stack.style.transition = 'left 0.2s ease-out, top 0.2s ease-out';
    stack.style.left = rect.left + 'px';
    stack.style.top = rect.top + 'px';
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      stack.remove();
      state.drag = null;
      render();
    };
    stack.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, 250);
  } else {
    stack.remove();
    state.drag = null;
    render();
  }
}

function onPointerCancel() {
  if (!state.drag) return;
  cleanupDragListeners();
  state.drag.stack.remove();
  state.drag = null;
  clearDropHints();
  render();
}

function cancelDrag() {
  if (!state.drag) return;
  state.drag.stack.remove();
  state.drag = null;
  cleanupDragListeners();
  clearDropHints();
  render();
}

function cleanupDragListeners() {
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
  document.removeEventListener('pointercancel', onPointerCancel);
}

function clearDropHints() {
  if (dropHintCol !== null) {
    const old = tableauEl.querySelector(`.column[data-col="${dropHintCol}"]`);
    if (old) old.classList.remove('drop-hint');
    dropHintCol = null;
  }
  if (dropHintFound !== null) {
    const old = foundationEl.querySelector(`.found-slot[data-pile="${dropHintFound}"]`);
    if (old) old.classList.remove('drop-hint');
    dropHintFound = null;
  }
}

function findDropTarget(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const colEl = el.closest('.column');
  if (colEl) return { type: 'tableau', idx: parseInt(colEl.dataset.col, 10) };
  const foundEl = el.closest('.found-slot');
  if (foundEl) return { type: 'foundation', idx: parseInt(foundEl.dataset.pile, 10) };
  return null;
}


// ============================================================
// 点击 / 双击
// ============================================================

function onStockClick() {
  if (isLocked()) return;
  dealStock();
}

function onCardClick(e) {
  if (isLocked()) return;
  const cardEl = e.target.closest('.card.face-up');
  if (!cardEl) return;
  // 双击已在 onPointerDown 中通过 e.detail === 2 处理
  // 此处仅保留单击可能需要的逻辑（当前无）
}

function handleDoubleClick(cardEl) {
  if (state.drag) return;
  // waste top
  if (cardEl.parentElement === wasteEl) {
    const wasteIdx = parseInt(cardEl.dataset.wasteIdx, 10);
    if (wasteIdx !== state.waste.length - 1) return;
    const c = state.waste[state.waste.length - 1];
    if (!c) return;
    const f = findFoundationFor(c);
    if (f !== -1) {
      moveToFoundation('waste', 0, wasteIdx, f);
      render();
      checkWin();
    }
    return;
  }
  // tableau card
  const col = parseInt(cardEl.dataset.col, 10);
  const idx = parseInt(cardEl.dataset.idx, 10);
  if (Number.isNaN(col) || Number.isNaN(idx)) return;
  const c = state.tableau[col][idx];
  if (!c) return;
  const seq = state.tableau[col].slice(idx);
  if (seq.length === 1) {
    const f = findFoundationFor(c);
    if (f !== -1) {
      moveToFoundation('tableau', col, idx, f);
      render();
      checkWin();
    }
  }
}

// ============================================================
// 杂项
// ============================================================

function flashCard(el) {
  el.classList.remove('invalid-flash');
  void el.offsetWidth;
  el.classList.add('invalid-flash');
  setTimeout(() => el.classList.remove('invalid-flash'), 400);
}

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
}

/* confetti shared: scripts/confetti.js */

let confirmResolve = null;
let confirmOpen = false;
function showConfirm(message, confirmText, cancelText) {
  if (confirmOpen) return Promise.resolve(false);
  confirmOpen = true;
  return new Promise((resolve) => {
    confirmResolve = resolve;
    $('confirm-message').textContent = message;
    $('confirm-ok').textContent = confirmText || '确认';
    $('confirm-cancel').textContent = cancelText || '取消';
    $('confirm-overlay').hidden = false;
  });
}
function hideConfirm() {
  if (confirmResolve) { confirmResolve(false); confirmResolve = null; }
  confirmOpen = false;
  $('confirm-overlay').hidden = true;
}

function showHelpOverlay() {
  $('help-overlay').hidden = false;
}
function hideHelpOverlay() {
  $('help-overlay').hidden = true;
}

// ============================================================
// 键盘与事件
// ============================================================

function onKeyDown(e) {
  if (e.key === 'Escape') {
    if (!$('help-overlay').hidden) { hideHelpOverlay(); return; }
    if (!$('confirm-overlay').hidden) {
      if (confirmResolve) confirmResolve(false);
      confirmResolve = null;
      hideConfirm();
      return;
    }
    if (state.drag) { cancelDrag(); return; }
    return;
  }
  if (!$('help-overlay').hidden) return;
  if (!$('confirm-overlay').hidden) return;

  const key = e.key.toLowerCase();
  if (key === 'n') {
    e.preventDefault();
    askNewGame();
  } else if (key === 'u' || (e.ctrlKey && key === 'z')) {
    e.preventDefault();
    undo();
  } else if (key === 'h') {
    e.preventDefault();
    hint();
  } else if (key === 'a') {
    e.preventDefault();
    autoCollect();
  } else if (key === 'd' || key === ' ') {
    e.preventDefault();
    onStockClick();
  } else if (key === '?') {
    e.preventDefault();
    showHelpOverlay();
  }
}

async function askNewGame() {
  if (isLocked()) return;
  const dealMode = parseInt($('deal-mode').value, 10);
  const hasProgress = state && state.history.length > 0;
  if (hasProgress) {
    const ok = await showConfirm('当前对局尚未结束，确定要开始新游戏吗？');
    if (!ok) return;
  }
  newGame(Number.isNaN(dealMode) ? 3 : dealMode);
}

// ============================================================
// 启动
// ============================================================

function init() {
  // custom dropdown for deal-mode
  if (window.buildCustomDropdown) {
    buildCustomDropdown($('deal-mode'));
    $('deal-mode').addEventListener('change', function() {
      if (!state) return;
      const mode = parseInt(this.value, 10);
      if (Number.isNaN(mode)) return;
      const validMode = mode === 1 ? 1 : 3;
      if (validMode !== state.dealMode) {
        state.dealMode = validMode;
        saveGame();
      }
    });
  }

  $('btn-new').addEventListener('click', askNewGame);
  $('btn-undo').addEventListener('click', undo);
  $('btn-help').addEventListener('click', showHelpOverlay);
  $('btn-auto').addEventListener('click', autoCollect);
  $('help-close').addEventListener('click', hideHelpOverlay);
  $('win-new').addEventListener('click', () => {
    hideWin();
    const dealMode = parseInt($('deal-mode').value, 10);
    newGame(Number.isNaN(dealMode) ? 3 : dealMode);
  });

  $('confirm-ok').addEventListener('click', () => {
    if (confirmResolve) confirmResolve(true);
    confirmResolve = null;
    hideConfirm();
  });
  $('confirm-cancel').addEventListener('click', () => {
    if (confirmResolve) confirmResolve(false);
    confirmResolve = null;
    hideConfirm();
  });

  stockEl.addEventListener('click', onStockClick);
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('keydown', onKeyDown);

  window.addEventListener('resize', () => {
    if (state) render();
  });

  if (!loadGame()) {
    newGame(3);
  }
}

migrateLegacyKeys();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
