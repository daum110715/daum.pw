/* ===== FreeCell 空当接龙 ===== */

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RANK_VAL = {A:1, J:11, Q:12, K:13};
function val(r) { return RANK_VAL[r] || parseInt(r); }
function suitColor(s) { return s % 2 === 0 ? 'black' : 'red'; }

const $ = GameUtils.$;
const storage = new GameStorage('game_freecell');
const statsMgr = new GameStats(storage, 'stats_v1', { version: 2, started: 0, won: 0, sessions: [], bestTime: 0, bestMoves: 0, totalTime: 0, totalMoves: 0 });
const timer = new GameTimer(ms => {
  $('stat-time').textContent = GameUtils.formatTime(Math.floor(ms / 1000));
});

/* ---------- 状态 ---------- */
let freecell = [null, null, null, null];
let foundation = [[], [], [], []];
let tableau = [[], [], [], [], [], [], [], []];
let moves = 0, history = [];
let drag = null;
let gameWon = false;
let hintTimer = null;
let hintSource = null; // { type, idx, cardIdx? }
let hintTarget = null; // { type, idx }

function migrateLegacyKeys() {
  const oldSave = localStorage.getItem('freecell_save_v1');
  if (oldSave && !localStorage.getItem(storage._key('save_v1'))) {
    localStorage.setItem(storage._key('save_v1'), oldSave);
  }
  const oldStats = localStorage.getItem('freecell_stats_v1');
  if (oldStats && !localStorage.getItem(storage._key('stats_v1'))) {
    localStorage.setItem(storage._key('stats_v1'), oldStats);
  }
}

/* ---------- 初始化 ---------- */
function init() {
  migrateLegacyKeys();
  buildTableau();
  initEvents();
  const saved = loadGame();
  if (saved) {
    restoreState(saved);
    if (gameWon) { timer.stop(); }
    else { timer.start(); }
    render();
  } else {
    newGame();
  }
}

function buildTableau() {
  const el = $('tableau');
  el.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const col = document.createElement('div');
    col.className = 'column';
    col.dataset.col = i;
    el.appendChild(col);
  }
}

/* ---------- 新游戏 ---------- */
function newGame() {
  if (moves > 0 && !gameWon) {
    updateStats(false);
  }
  timer.stop();
  gameWon = false;
  moves = 0;
  history = [];
  freecell = [null, null, null, null];
  foundation = [[], [], [], []];
  tableau = [[], [], [], [], [], [], [], []];

  const deck = [];
  for (let s = 0; s < 4; s++) {
    for (let r = 0; r < 13; r++) {
      deck.push({ suit: s, rank: RANKS[r], faceUp: true });
    }
  }
  shuffle(deck);

  // 前4列7张，后4列6张
  let idx = 0;
  for (let c = 0; c < 8; c++) {
    const count = c < 4 ? 7 : 6;
    for (let i = 0; i < count; i++) {
      tableau[c].push(deck[idx++]);
    }
  }

  timer.reset();
  timer.start();
  clearHint();
  render();
  safeSaveGame();
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

/* ---------- 渲染 ---------- */
function render() {
  clearHint();
  $('stat-moves').textContent = moves;
  $('stat-time').textContent = GameUtils.formatTime(Math.floor(timer.getElapsedMs() / 1000));

  // freecells
  const fcSlots = document.querySelectorAll('.cell-slot');
  fcSlots.forEach((slot, i) => {
    slot.innerHTML = '';
    if (freecell[i]) {
      slot.appendChild(cardEl(freecell[i]));
    }
  });

  // foundation
  const foundSlots = document.querySelectorAll('.found-slot');
  foundSlots.forEach((slot, i) => {
    slot.innerHTML = '';
    const pile = foundation[i];
    if (pile.length) {
      slot.appendChild(cardEl(pile[pile.length - 1]));
    } else {
      slot.textContent = SUITS[i];
    }
  });

  // tableau
  const cols = document.querySelectorAll('.column');
  const offset = getFaceOffset();
  const cardH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-h'), 10) || 100;
  cols.forEach((col, i) => {
    col.innerHTML = '';
    if (tableau[i].length === 0) {
      GameUtils.addClass(col, 'empty-slot');
      col.style.height = '';
    } else {
      GameUtils.removeClass(col, 'empty-slot');
      tableau[i].forEach((card, ci) => {
        const el = cardEl(card);
        el.style.top = (ci * offset) + 'px';
        col.appendChild(el);
      });
      col.style.height = ((tableau[i].length - 1) * offset + cardH) + 'px';
    }
  });
}

function cardEl(card) {
  const el = document.createElement('div');
  el.className = 'card face-up suit-' + card.suit;
  el.innerHTML =
    '<div class="corner top"><div class="rank">' + card.rank +
    '</div><div class="suit">' + SUITS[card.suit] + '</div></div>' +
    '<div class="center">' + SUITS[card.suit] + '</div>' +
    '<div class="corner bot"><div class="suit">' + SUITS[card.suit] + '</div><div class="rank">' + card.rank +
    '</div></div>';
  return el;
}

/* ---------- 尺寸 ---------- */
function getFaceOffset() {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--face-offset'), 10) || 22;
}

/* ---------- 提示系统 ---------- */
function showHint() {
  if (gameWon) return;
  clearHint();
  const h = findHint();
  if (!h) { showToast('暂无可用移动'); return; }
  hintSource = { type: h.sourceType, idx: h.sourceIdx, cardIdx: h.cardIdx };
  hintTarget = { type: h.targetType, idx: h.targetIdx };
  applyHint();
  hintTimer = setTimeout(() => { clearHint(); hintTimer = null; }, 3000);
}

function applyHint() {
  if (!hintSource || !hintTarget) return;
  // source
  if (hintSource.type === 'fc') {
    const slot = document.querySelector('.cell-slot[data-idx="' + hintSource.idx + '"]');
    if (slot) GameUtils.addClass(slot.querySelector('.card'), 'hint-source');
  } else if (hintSource.type === 'tab') {
    const col = document.querySelectorAll('.column')[hintSource.idx];
    if (col) GameUtils.addClass(col.children[hintSource.cardIdx], 'hint-source');
  }
  // target
  if (hintTarget.type === 'fc') {
    GameUtils.addClass(document.querySelector('.cell-slot[data-idx="' + hintTarget.idx + '"]'), 'hint-target');
  } else if (hintTarget.type === 'found') {
    GameUtils.addClass(document.querySelector('.found-slot[data-pile="' + hintTarget.idx + '"]'), 'hint-target');
  } else if (hintTarget.type === 'tab') {
    const col = document.querySelectorAll('.column')[hintTarget.idx];
    if (col) GameUtils.addClass(col, 'hint-target');
  }
}

function clearHint() {
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
  hintSource = null; hintTarget = null;
  document.querySelectorAll('.hint-source').forEach(el => GameUtils.removeClass(el, 'hint-source'));
  document.querySelectorAll('.hint-target').forEach(el => GameUtils.removeClass(el, 'hint-target'));
}

function findHint() {
  // 1. freecell → foundation
  for (let i = 0; i < 4; i++) {
    if (freecell[i] && canPlaceFoundation(freecell[i], freecell[i].suit)) {
      return { sourceType: 'fc', sourceIdx: i, targetType: 'found', targetIdx: freecell[i].suit };
    }
  }
  // 2. tableau → foundation
  for (let c = 0; c < 8; c++) {
    const col = tableau[c];
    if (!col.length) continue;
    const card = col[col.length - 1];
    if (canPlaceFoundation(card, card.suit)) {
      return { sourceType: 'tab', sourceIdx: c, cardIdx: col.length - 1, targetType: 'found', targetIdx: card.suit };
    }
  }
  // 3. tableau card/stack → tableau（从短序列优先，更实用）
  const maxMove = maxMoveCount();
  for (let c = 0; c < 8; c++) {
    const col = tableau[c];
    if (!col.length) continue;
    for (let ci = col.length - 1; ci >= 0; ci--) {
      const seqLen = col.length - ci;
      if (seqLen > maxMove) continue;
      if (!isValidSequence(col, ci, col.length - 1)) continue;
      const card = col[ci];
      for (let tc = 0; tc < 8; tc++) {
        if (tc === c) continue;
        if (tableau[tc].length === 0) {
          return { sourceType: 'tab', sourceIdx: c, cardIdx: ci, targetType: 'tab', targetIdx: tc };
        }
        const top = tableau[tc][tableau[tc].length - 1];
        if (canStack(card, top)) {
          return { sourceType: 'tab', sourceIdx: c, cardIdx: ci, targetType: 'tab', targetIdx: tc };
        }
      }
    }
  }
  // 4. freecell → tableau
  for (let i = 0; i < 4; i++) {
    if (!freecell[i]) continue;
    for (let tc = 0; tc < 8; tc++) {
      if (tableau[tc].length === 0) {
        return { sourceType: 'fc', sourceIdx: i, targetType: 'tab', targetIdx: tc };
      }
      const top = tableau[tc][tableau[tc].length - 1];
      if (canStack(freecell[i], top)) {
        return { sourceType: 'fc', sourceIdx: i, targetType: 'tab', targetIdx: tc };
      }
    }
  }
  // 5. tableau single → freecell
  for (let c = 0; c < 8; c++) {
    if (!tableau[c].length) continue;
    for (let fi = 0; fi < 4; fi++) {
      if (freecell[fi] === null) {
        return { sourceType: 'tab', sourceIdx: c, cardIdx: tableau[c].length - 1, targetType: 'fc', targetIdx: fi };
      }
    }
  }
  return null;
}

function canPlaceFoundation(card, pileIdx) {
  const pile = foundation[pileIdx];
  if (card.suit !== pileIdx) return false;
  if (pile.length === 0) return card.rank === 'A';
  return val(card.rank) === val(pile[pile.length - 1].rank) + 1;
}

function canStack(bottom, top) {
  return suitColor(bottom.suit) !== suitColor(top.suit) && val(bottom.rank) === val(top.rank) - 1;
}

function isValidSequence(col, start, end) {
  for (let i = start; i < end; i++) {
    if (!canStack(col[i + 1], col[i])) return false;
  }
  return true;
}

function maxMoveCount() {
  const emptyFc = freecell.filter(c => c === null).length;
  const emptyCols = tableau.filter(c => c.length === 0).length;
  return (emptyFc + 1) * Math.pow(2, emptyCols);
}

/* ---------- 拖拽系统 ---------- */
function initEvents() {
  // 按钮
  $('btn-new').addEventListener('click', () => {
    showConfirm('开始新游戏？当前进度将丢失。').then(ok => { if (ok) newGame(); });
  });
  $('btn-undo').addEventListener('click', undo);
  $('btn-auto').addEventListener('click', autoCollect);
  $('btn-hint').addEventListener('click', showHint);
  $('btn-help').addEventListener('click', showHelp);
  $('help-close').addEventListener('click', hideHelp);
  $('win-new').addEventListener('click', () => { hideWin(); newGame(); });
  $('confirm-ok').addEventListener('click', () => { if (confirmResolve) confirmResolve(true); confirmResolve = null; hideConfirm(); });
  $('confirm-cancel').addEventListener('click', () => { if (confirmResolve) confirmResolve(false); confirmResolve = null; hideConfirm(); });

  // 棋盘 pointer events
  $('freecells').addEventListener('pointerdown', onPointerDown, { passive: false });
  $('foundation').addEventListener('pointerdown', onPointerDown, { passive: false });
  $('tableau').addEventListener('pointerdown', onPointerDown, { passive: false });

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', endDrag);

  // 键盘
  document.addEventListener('keydown', onKeyDown);

  // 窗口大小（防抖）
  var resizeTimer = null;
  window.addEventListener('resize', function() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });
}

function isLocked() {
  return gameWon;
}

function onPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (isLocked()) return;
  if (e.detail === 2) {
    const cardEl = e.target.closest('.card.face-up');
    if (cardEl) { e.preventDefault(); handleDoubleClick(cardEl); return; }
  }

  const cardEl = e.target.closest('.card.face-up');
  if (!cardEl) return;

  // 定位来源
  const colEl = cardEl.closest('.column');
  const fcSlot = cardEl.closest('.cell-slot');

  let sourceType, sourceIdx, cardIdx, cards;
  if (colEl) {
    sourceType = 'tab';
    sourceIdx = parseInt(colEl.dataset.col, 10);
    const col = tableau[sourceIdx];
    cardIdx = Array.from(colEl.children).indexOf(cardEl);
    if (cardIdx === -1) return;
    // 从cardIdx到末尾必须是一个有效序列，且长度不超过maxMove
    const seqLen = col.length - cardIdx;
    if (seqLen > maxMoveCount()) return;
    if (!isValidSequence(col, cardIdx, col.length - 1)) return;
    cards = col.slice(cardIdx);
  } else if (fcSlot) {
    sourceType = 'fc';
    sourceIdx = parseInt(fcSlot.dataset.idx, 10);
    if (!freecell[sourceIdx]) return;
    cards = [freecell[sourceIdx]];
    cardIdx = 0;
  } else {
    // foundation上的牌不允许拖拽走
    return;
  }

  e.preventDefault();
  clearHint();

  const rect = cardEl.getBoundingClientRect();
  drag = {
    cards,
    sourceType,
    sourceIdx,
    cardIdx,
    startX: e.clientX,
    startY: e.clientY,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    active: false,
    stack: null,
    origEl: cardEl,
    dropTarget: null
  };
}

function updateDragPos(x, y) {
  if (!drag || !drag.stack) return;
  drag.stack.style.left = (x - drag.offsetX) + 'px';
  drag.stack.style.top = (y - drag.offsetY) + 'px';
}

function onPointerMove(e) {
  if (!drag) return;
  if (!drag.active) {
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.sqrt(dx * dx + dy * dy) < 3) return;
    // 真正开始拖拽
    drag.active = true;
    GameUtils.addClass(drag.origEl, 'dragging');
    if (drag.sourceType === 'tab') {
      const colEl2 = document.querySelectorAll('.column')[drag.sourceIdx];
      for (let i = drag.cardIdx + 1; i < colEl2.children.length; i++) {
        GameUtils.addClass(colEl2.children[i], 'dragging');
      }
    }
    const layer = $('drag-layer');
    layer.innerHTML = '';
    const stack = document.createElement('div');
    stack.className = 'drag-stack';
    const offset = getFaceOffset();
    drag.cards.forEach((card, i) => {
      const el = cardEl(card);
      el.style.top = (i * offset) + 'px';
      stack.appendChild(el);
    });
    layer.appendChild(stack);
    drag.stack = stack;
  }
  updateDragPos(e.clientX, e.clientY);
  // 清除旧的drop hint
  document.querySelectorAll('.drop-hint').forEach(el => GameUtils.removeClass(el, 'drop-hint'));
  // 计算hover目标
  const target = getDropTarget(e.clientX, e.clientY);
  if (target) {
    if (target.type === 'tab') {
      const col = document.querySelectorAll('.column')[target.idx];
      GameUtils.addClass(col, 'drop-hint');
    } else if (target.type === 'fc') {
      GameUtils.addClass(document.querySelector('.cell-slot[data-idx="' + target.idx + '"]'), 'drop-hint');
    } else if (target.type === 'found') {
      GameUtils.addClass(document.querySelector('.found-slot[data-pile="' + target.idx + '"]'), 'drop-hint');
    }
    drag.dropTarget = target;
  } else {
    drag.dropTarget = null;
  }
}

function onPointerUp(e) {
  if (!drag) return;
  if (!drag.active) {
    endDrag();
    return;
  }
  const target = drag.dropTarget || getDropTarget(e.clientX, e.clientY);
  if (target) {
    const valid = attemptMove(drag.sourceType, drag.sourceIdx, drag.cardIdx, target.type, target.idx);
    if (!valid && drag.origEl) {
      GameUtils.addClass(drag.origEl, 'invalid-flash');
      setTimeout(() => GameUtils.removeClass(drag.origEl, 'invalid-flash'), 400);
    }
  }
  endDrag();
}

function endDrag() {
  if (!drag) return;
  // 移除dragging class
  document.querySelectorAll('.dragging').forEach(el => GameUtils.removeClass(el, 'dragging'));
  document.querySelectorAll('.drop-hint').forEach(el => GameUtils.removeClass(el, 'drop-hint'));
  $('drag-layer').innerHTML = '';
  drag = null;
}

function getDropTarget(x, y) {
  // 检查 freecells
  const fcSlots = document.querySelectorAll('.cell-slot');
  for (let i = 0; i < fcSlots.length; i++) {
    const r = fcSlots[i].getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      if (freecell[i] === null && drag.cards.length === 1) return { type: 'fc', idx: i };
    }
  }
  // 检查 foundation
  const foundSlots = document.querySelectorAll('.found-slot');
  for (let i = 0; i < foundSlots.length; i++) {
    const r = foundSlots[i].getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      if (drag.cards.length === 1 && canPlaceFoundation(drag.cards[0], i)) {
        return { type: 'found', idx: i };
      }
    }
  }
  // 检查 tableau columns
  const cols = document.querySelectorAll('.column');
  for (let i = 0; i < cols.length; i++) {
    const r = cols[i].getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      if (i === drag.sourceIdx && drag.sourceType === 'tab') return null;
      const targetCol = tableau[i];
      if (targetCol.length === 0) {
        if (drag.cards.length <= maxMoveCount()) return { type: 'tab', idx: i };
      } else {
        const top = targetCol[targetCol.length - 1];
        if (canStack(drag.cards[0], top) && drag.cards.length <= maxMoveCount()) {
          return { type: 'tab', idx: i };
        }
      }
      return null;
    }
  }
  return null;
}

/* ---------- 移动 ---------- */
function attemptMove(srcType, srcIdx, cardIdx, targetType, targetIdx) {
  let cards, srcArr;
  if (srcType === 'tab') {
    srcArr = tableau[srcIdx];
    cards = srcArr.slice(cardIdx);
  } else if (srcType === 'fc') {
    cards = [freecell[srcIdx]];
  } else return false;

  // 验证移动
  if (targetType === 'fc') {
    if (cards.length !== 1) return false;
    if (freecell[targetIdx] !== null) return false;
  } else if (targetType === 'found') {
    if (cards.length !== 1) return false;
    if (!canPlaceFoundation(cards[0], targetIdx)) return false;
  } else if (targetType === 'tab') {
    const targetCol = tableau[targetIdx];
    if (targetCol.length === 0) {
      // 空列，任意序列都可以（只要长度不超过限制，已在拖拽时检查）
    } else {
      const top = targetCol[targetCol.length - 1];
      if (!canStack(cards[0], top)) return false;
    }
    // 长度检查
    if (cards.length > maxMoveCount()) return false;
  }

  // 执行移动
  pushHistory();
  if (srcType === 'tab') {
    srcArr.splice(cardIdx, cards.length);
  } else if (srcType === 'fc') {
    freecell[srcIdx] = null;
  }

  if (targetType === 'tab') {
    tableau[targetIdx].push(...cards);
  } else if (targetType === 'fc') {
    freecell[targetIdx] = cards[0];
  } else if (targetType === 'found') {
    foundation[targetIdx].push(cards[0]);
  }

  moves++;
  clearHint();
  render();
  safeSaveGame();
  checkWin();
  return true;
}

/* ---------- 双击 ---------- */
function handleDoubleClick(cardEl) {
  if (isLocked()) return;
  const colEl = cardEl.closest('.column');
  const fcSlot = cardEl.closest('.cell-slot');
  let card, srcType, srcIdx;
  if (colEl) {
    srcType = 'tab';
    srcIdx = parseInt(colEl.dataset.col, 10);
    const col = tableau[srcIdx];
    const idx = Array.from(colEl.children).indexOf(cardEl);
    if (idx !== col.length - 1) return; // 只能双击最底下的牌
    card = col[idx];
  } else if (fcSlot) {
    srcType = 'fc';
    srcIdx = parseInt(fcSlot.dataset.idx, 10);
    card = freecell[srcIdx];
  } else return;

  if (!card) return;

  // 尝试放到foundation
  const pile = card.suit;
  if (canPlaceFoundation(card, pile)) {
    pushHistory();
    if (srcType === 'tab') tableau[srcIdx].pop();
    else if (srcType === 'fc') freecell[srcIdx] = null;
    foundation[pile].push(card);
    moves++;
    render();
    safeSaveGame();
    checkWin();
    return;
  }

  // 尝试放到空freecell（仅限从tableau双击）
  if (srcType === 'tab') {
    const emptyFc = freecell.indexOf(null);
    if (emptyFc !== -1) {
      pushHistory();
      tableau[srcIdx].pop();
      freecell[emptyFc] = card;
      moves++;
      render();
      safeSaveGame();
      return;
    }
  }
}

/* ---------- 自动收集 ---------- */
function autoCollect() {
  if (isLocked()) return;
  let moved = true, count = 0;
  pushHistory();
  while (moved && count < 52 && !gameWon) {
    moved = false;
    // freecell → foundation
    for (let i = 0; i < 4; i++) {
      if (freecell[i] && canPlaceFoundation(freecell[i], freecell[i].suit)) {
        const card = freecell[i];
        freecell[i] = null;
        foundation[card.suit].push(card);
        moves++; count++; moved = true;
        checkWin();
        break;
      }
    }
    if (moved) continue;
    // tableau → foundation
    for (let c = 0; c < 8; c++) {
      if (!tableau[c].length) continue;
      const card = tableau[c][tableau[c].length - 1];
      if (canPlaceFoundation(card, card.suit)) {
        tableau[c].pop();
        foundation[card.suit].push(card);
        moves++; count++; moved = true;
        checkWin();
        break;
      }
    }
  }
  if (count > 0) {
    render(); safeSaveGame();
  } else {
    history.pop();
    showToast('没有可自动收集的牌');
  }
}

/* ---------- 撤销 ---------- */
function pushHistory() {
  history.push({
    freecell: GameUtils.deepClone(freecell),
    foundation: GameUtils.deepClone(foundation),
    tableau: GameUtils.deepClone(tableau),
    moves
  });
  if (history.length > 200) history.shift();
}

function undo() {
  if (gameWon) return;
  if (!history.length) { showToast('没有可撤销的操作'); return; }
  const s = history.pop();
  freecell = s.freecell;
  foundation = s.foundation;
  tableau = s.tableau;
  moves = s.moves;
  clearHint();
  render();
  safeSaveGame();
}

/* ---------- 胜利 ---------- */
function checkWin() {
  if (gameWon) return;
  const total = foundation.reduce((s, p) => s + p.length, 0);
  if (total < 52) return;
  gameWon = true;
  timer.stop();
  updateStats(true);
  setTimeout(() => {
    showWin();
    fireConfetti();
  }, 300);
}

function showWin() {
  if (!gameWon) return;
  $('win-moves').textContent = moves;
  $('win-time').textContent = GameUtils.formatTime(Math.floor(timer.getElapsedMs() / 1000));
  $('win-stats').innerHTML = generateStatsHTML();
  GameOverlay.show('win-overlay');
}
function hideWin() { GameOverlay.hide('win-overlay'); }

/* ---------- 统计 ---------- */
function updateStats(won) {
  const stats = getStats();
  stats.started++;
  if (won) {
    const time = Math.floor(timer.getElapsedMs() / 1000);
    stats.totalTime += time;
    stats.totalMoves += moves;
    stats.won++;
    stats.sessions.push({ time, moves });
    if (time < stats.bestTime || stats.bestTime === 0) stats.bestTime = time;
    if (moves < stats.bestMoves || stats.bestMoves === 0) stats.bestMoves = moves;
  }
  storage.save('stats_v1', stats);
}

function getStats() {
  try {
    const raw = storage.load('stats_v1');
    if (!raw) return defaultStats();
    if (raw.version === 2) return raw;
    // migrate old format
    return {
      version: 2,
      started: raw.total || 0,
      won: raw.wins || 0,
      sessions: [],
      bestTime: raw.bestTime || 0,
      bestMoves: raw.bestMoves || 0,
      totalTime: raw.totalTime || 0,
      totalMoves: raw.totalMoves || 0
    };
  } catch { return defaultStats(); }
}

function defaultStats() {
  return { version: 2, started: 0, won: 0, sessions: [], bestTime: 0, bestMoves: 0, totalTime: 0, totalMoves: 0 };
}

function generateStatsHTML() {
  const s = getStats();
  const winRate = s.started ? Math.round((s.won / s.started) * 100) : 0;
  const avgTime = s.won ? Math.round(s.totalTime / s.won) : 0;
  return (
    '<div>胜率 <strong>' + winRate + '%</strong></div>' +
    '<div>最佳时间 <strong>' + (s.bestTime != null ? GameUtils.formatTime(s.bestTime) : '-') + '</strong></div>' +
    '<div>最佳步数 <strong>' + (s.bestMoves != null ? s.bestMoves : '-') + '</strong></div>' +
    '<div>平均通关用时 <strong>' + (avgTime != null ? GameUtils.formatTime(avgTime) : '-') + '</strong></div>'
  );
}

/* ---------- 保存/加载 ---------- */
function saveGame() {
  const elapsed = Math.floor(timer.getElapsedMs() / 1000);
  const data = {
    freecell, foundation, tableau, moves,
    elapsed, gameWon, history
  };
  storage.save('save_v1', data);
}

function loadGame() {
  try { return storage.load('save_v1'); }
  catch { return null; }
}

function restoreState(data) {
  freecell = data.freecell || [null, null, null, null];
  foundation = data.foundation || [[], [], [], []];
  tableau = data.tableau || [[], [], [], [], [], [], [], []];
  moves = data.moves || 0;
  const elapsed = data.elapsed || 0;
  timer.setElapsedMs(elapsed * 1000);
  gameWon = data.gameWon || false;
  history = data.history || [];
}

function safeSaveGame() {
  try { saveGame(); } catch (err) { console.warn('Save failed', err); }
}

/* ---------- 弹窗 ---------- */
let confirmResolve = null;
function showConfirm(msg) {
  $('confirm-message').textContent = msg;
  $('confirm-overlay').hidden = false;
  return new Promise(r => { confirmResolve = r; });
}
function hideConfirm() {
  if (confirmResolve) { confirmResolve(false); confirmResolve = null; }
  $('confirm-overlay').hidden = true;
}

function showHelp() { GameOverlay.show('help-overlay'); }
function hideHelp() { GameOverlay.hide('help-overlay'); }

function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  GameUtils.addClass(t, 'show');
  setTimeout(() => GameUtils.removeClass(t, 'show'), 1800);
}

/* ---------- 键盘 ---------- */
function onKeyDown(e) {
  if (e.key === 'Escape') {
    if (!drag) { hideHelp(); hideWin(); hideConfirm(); }
    else { endDrag(); }
    return;
  }
  if (e.key === '?') { showHelp(); return; }
  if (isLocked()) return;
  const key = e.key.toLowerCase();
  if (key === 'n') {
    showConfirm('开始新游戏？当前进度将丢失。').then(ok => { if (ok) newGame(); });
  } else if (key === 'u' || (e.ctrlKey && key === 'z')) {
    e.preventDefault(); undo();
  } else if (key === 'a') {
    e.preventDefault(); autoCollect();
  } else if (key === 'h') {
    e.preventDefault(); showHint();
  }
}

/* ---------- 彩纸 (shared: scripts/confetti.js) ---------- */

/* ---------- 启动 ---------- */
init();
