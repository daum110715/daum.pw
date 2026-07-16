// ===== 蜘蛛纸牌 =====
// 数据驱动 + 全量重渲染。
// 单文件实现：牌组生成、发牌、渲染、拖拽、规则、撤销、胜利、发牌动画。

const FACE_OFFSET = 28;
const BACK_OFFSET = 6;
function getCardH() {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue("--card-h"), 10) || 112;
}
const HISTORY_LIMIT = 200;
const DEAL_FLY_MS = 320;       // 单张飞行时长
const DEAL_STAGGER_MS = 55;    // 每张错开出发的间隔

let state = null;
let dropHintCol = null;
let hintTimer = null;

const storage = new GameStorage('game_spider');
const timer = new GameTimer(ms => {
  $('stat-time').textContent = GameUtils.formatTime(Math.floor(ms / 1000));
});

function migrateLegacyKeys() {
  const newStatsKey = storage._key('stats_v1');
  const oldStats = localStorage.getItem('spider_stats_v1');
  if (oldStats && !localStorage.getItem(newStatsKey)) {
    localStorage.setItem(newStatsKey, oldStats);
  }
  const newSaveKey = storage._key('save_v1');
  const oldSave = localStorage.getItem('spider_save_v1');
  if (oldSave && !localStorage.getItem(newSaveKey)) {
    localStorage.setItem(newSaveKey, oldSave);
  }
}

function saveGame() {
  if (!state) return;
  storage.save('save_v1', {
    suits: state.suits,
    tableau: state.tableau,
    stock: state.stock,
    foundation: state.foundation,
    score: state.score,
    moves: state.moves,
    history: state.history.slice(-50), // 保留最近 50 步以控制体积
    elapsedMs: timer.getElapsedMs(),
    savedAt: Date.now(),
  });
}
function loadGame() {
  try {
    const data = storage.load('save_v1');
    if (!data || !Array.isArray(data.tableau) || !Array.isArray(data.stock)) return false;
    state = {
      suits: data.suits,
      tableau: data.tableau,
      stock: data.stock,
      foundation: data.foundation ?? 0,
      score: data.score ?? 500,
      moves: data.moves ?? 0,
      history: Array.isArray(data.history) ? data.history : [],
      drag: null,
      isDealing: false,
    };
    // 复原计时:把已用时长换算成"假装从过去某个时刻开始",离线时间不计入
    const elapsed = Number.isFinite(data.elapsedMs) ? data.elapsedMs : 0;
    timer.setElapsedMs(Math.max(0, elapsed));
    dropHintCol = null;
    $("difficulty").value = String(state.suits);
    if ($("difficulty")._customSync) $("difficulty")._customSync();
    hideWin();
    clearHint();
    render();
    timer.start();
    return true;
  } catch {
    return false;
  }
}
function clearSave() {
  storage.remove('save_v1');
}

// ============================================================
// 并行求解器（Web Worker）
// ============================================================

const WORKER_COUNT = Math.min(4, navigator.hardwareConcurrency || 2);

async function solveOneInWorker(deal) {
  return new Promise((resolve) => {
    let worker;
    try {
      worker = new Worker("solver-worker.js");
    } catch {
      resolve({ solvable: false });
      return;
    }
    worker.postMessage({ deal });
    worker.onmessage = (e) => {
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve({ solvable: false });
    };
  });
}

function updateLoadingProgress(done, total) {
  $("loading-text").textContent = `正在验证牌局... (${done}/${total})`;
}

async function findSolvableDealParallel(suitsCount, maxAttempts = 128) {
  const deals = [];
  for (let i = 0; i < maxAttempts; i++) {
    deals.push(generateDeal(suitsCount));
  }

  let completed = 0;
  let found = false;
  const TOTAL_TIME_LIMIT = 15000; // 总时间限制 15 秒
  const startTime = Date.now();

  // 如果 Worker 无法创建，回退到主线程串行
  let workerSupported = true;
  try {
    new Worker("solver-worker.js").terminate();
  } catch {
    workerSupported = false;
  }

  if (!workerSupported) {
    return findSolvableDealSerial(suitsCount, deals, TOTAL_TIME_LIMIT);
  }

  return new Promise((resolve) => {
    const workers = [];
    let activeWorkers = 0;
    let timeoutId = null;

    function finish(result) {
      if (found) return;
      found = true;
      if (timeoutId) clearTimeout(timeoutId);
      workers.forEach((w) => {
        try { w.terminate(); } catch {}
      });
      resolve(result);
    }

    const WORKER_TIMEOUT = 5000; // 单个 Worker 5 秒超时
    const workerTimers = new Map();

    function clearWorkerTimer(worker) {
      const t = workerTimers.get(worker);
      if (t) { clearTimeout(t); workerTimers.delete(worker); }
    }
    function setWorkerTimer(worker) {
      clearWorkerTimer(worker);
      workerTimers.set(worker, setTimeout(() => {
        try { worker.terminate(); } catch {}
        if (found) return;
        activeWorkers--;
        if (activeWorkers <= 0) finish(null);
        else if (deals.length > 0) spawnWorker();
      }, WORKER_TIMEOUT));
    }
    function spawnWorker() {
      let w;
      try { w = new Worker("solver-worker.js"); } catch { return; }
      workers.push(w);
      activeWorkers++;
      w.onmessage = (ev) => {
        clearWorkerTimer(w);
        onResult(ev.data, w);
      };
      w.onerror = () => {
        clearWorkerTimer(w);
        if (found) return;
        completed++;
        updateLoadingProgress(completed, maxAttempts);
        activeWorkers--;
        if (activeWorkers <= 0) finish(null);
        else if (deals.length > 0) spawnWorker();
      };
      if (deals.length > 0) {
        w.postMessage({ deal: deals.pop() });
        setWorkerTimer(w);
      }
    }

    function onResult(result, worker) {
      if (found) return;
      completed++;
      updateLoadingProgress(completed, maxAttempts);
      if (result.solvable) {
        finish(result);
        return;
      }
      if (Date.now() - startTime > TOTAL_TIME_LIMIT) {
        finish(null);
        return;
      }
      if (deals.length > 0) {
        worker.postMessage({ deal: deals.pop() });
        setWorkerTimer(worker);
      } else {
        activeWorkers--;
        if (activeWorkers <= 0) {
          finish(null);
        }
      }
    }

    for (let i = 0; i < Math.min(WORKER_COUNT, maxAttempts); i++) {
      if (deals.length > 0) spawnWorker();
    }

    if (activeWorkers === 0) {
      resolve(null);
      return;
    }

    // 兜底：32 秒后无论结果直接结束
    timeoutId = setTimeout(() => {
      finish(null);
    }, TOTAL_TIME_LIMIT + 2000);
  });
}

async function findSolvableDealSerial(suitsCount, deals, timeLimit = 15000) {
  const startTime = Date.now();
  for (let i = 0; i < deals.length; i++) {
    if (Date.now() - startTime > timeLimit) return null;
    updateLoadingProgress(i + 1, deals.length);
    const testState = {
      suits: suitsCount,
      tableau: deals[i].tableau,
      stock: deals[i].stock,
      foundation: 0,
    };
    if (isSolvableByGreedy(testState)) {
      return { solvable: true, tableau: deals[i].tableau, stock: deals[i].stock };
    }
    // 让 UI 有呼吸机会
    if (i % 16 === 15) await new Promise((r) => setTimeout(r, 0));
  }
  return null;
}

function defaultStats() {
  return { version: 2, started: 0, won: 0, sessions: [] };
}

function loadStats() {
  try {
    const raw = storage.load('stats_v1');
    if (!raw) return defaultStats();
    if (raw && typeof raw.version === 'number') return raw;

    // Migrate old format: {"1": {...}, "2": {...}, "4": {...}}
    const migrated = defaultStats();
    for (const key of ['1', '2', '4']) {
      if (raw[key]) {
        migrated.started += raw[key].started || 0;
        migrated.won += raw[key].won || 0;
        migrated[key] = raw[key];
      }
    }
    saveStats(migrated);
    return migrated;
  } catch {
    return defaultStats();
  }
}
function saveStats(stats) {
  storage.save('stats_v1', stats);
}
function getStatsEntry(stats, suits) {
  const key = String(suits);
  if (!stats[key]) {
    stats[key] = { started: 0, won: 0, bestScore: null, bestMoves: null, bestTimeMs: null };
  }
  return stats[key];
}
function recordStart(suits) {
  const stats = loadStats();
  stats.started = (stats.started || 0) + 1;
  const e = getStatsEntry(stats, suits);
  e.started++;
  saveStats(stats);
  timer.reset();
  timer.start();
}
function recordWin(suits, score, moves) {
  const stats = loadStats();
  stats.won = (stats.won || 0) + 1;
  const timeMs = timer.getElapsedMs();
  if (!Array.isArray(stats.sessions)) stats.sessions = [];
  stats.sessions.push({ suits, score, moves, timeMs, date: Date.now() });

  const e = getStatsEntry(stats, suits);
  e.won++;
  if (e.bestScore == null || score > e.bestScore) e.bestScore = score;
  if (e.bestMoves == null || moves < e.bestMoves) e.bestMoves = moves;
  if (e.bestTimeMs == null || timeMs < e.bestTimeMs) e.bestTimeMs = timeMs;

  saveStats(stats);
  return e;
}

// ----- DOM 引用 -----
const $ = GameUtils.$;
const tableauEl = $("tableau");
const foundationEl = $("foundation");
const stockEl = $("stock");
const dragLayer = $("drag-layer");
const toastEl = $("toast");

// ============================================================
// 工具
// ============================================================

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isWinOverlayOpen() {
  return $("win-overlay") && !$("win-overlay").hidden;
}

function isLoading() {
  return $("loading-overlay") && !$("loading-overlay").hidden;
}

function isLocked() {
  return !state || state.drag || state.isDealing || isWinOverlayOpen() || isLoading();
}

function getStackTop(idx) {
  if (idx <= 35) return idx * 0.5;
  if (idx <= 45) return 17.5 + (idx - 35) * 1;
  return 27.5 + (idx - 45) * 2;
}

// ============================================================
// 牌组与初始化
// ============================================================

function applyNewGame(suitsCount, tableau, stock) {
  state = {
    suits: suitsCount,
    tableau,
    stock,
    foundation: 0,
    moves: 0,
    score: 500,
    history: [],
    drag: null,
    isDealing: false,
  };
  dropHintCol = null;
  hideWin();
  clearHint();
  recordStart(suitsCount);
  render();
  timer.start();
}

async function newGame(suitsCount, ensureSolvable = false) {
  clearSave();

  if (!ensureSolvable) {
    const { tableau, stock } = generateDeal(suitsCount);
    applyNewGame(suitsCount, tableau, stock);
    return;
  }

  // 真正去验证：让并行 Worker 池跑求解器，找到可解牌局再交给 UI
  showLoading("正在验证牌局是否可解... (0/?)");
  let result = null;
  try {
    result = await findSolvableDealParallel(suitsCount);
  } catch {
    result = null;
  }
  hideLoading();

  if (result && result.solvable) {
    applyNewGame(suitsCount, result.tableau, result.stock);
    toast("已生成可解牌局");
  } else {
    const { tableau, stock } = generateDeal(suitsCount);
    applyNewGame(suitsCount, tableau, stock);
    toast("未能在限定时间内找到可解牌局，已使用随机牌局");
  }
}

// ============================================================
// 历史与撤销
// ============================================================

function snapshot() {
  return {
    tableau: state.tableau.map((col) => col.map((c) => ({ ...c }))),
    stock: state.stock.map((s) => s.map((c) => ({ ...c }))),
    foundation: state.foundation,
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
  const snap = state.history.pop();
  state.tableau = snap.tableau;
  state.stock = snap.stock;
  state.foundation = snap.foundation;
  state.score = snap.score;
  state.moves = snap.moves;
  render();
  saveGame();
}

// ============================================================
// 规则
// ============================================================

function canDrag(col, idx) {
  const c = state.tableau[col];
  if (idx < 0 || idx >= c.length) return false;
  if (!c[idx].faceUp) return false;
  for (let i = idx; i < c.length - 1; i++) {
    if (c[i].suit !== c[i + 1].suit) return false;
    if (c[i].rank !== c[i + 1].rank + 1) return false;
  }
  return true;
}

function canDrop(toCol, cards, fromCol) {
  if (fromCol != null && toCol === fromCol) return false;
  const c = state.tableau[toCol];
  if (c.length === 0) return true;
  const top = c[c.length - 1];
  if (!top.faceUp) return false;
  return top.rank === cards[0].rank + 1;
}

// ============================================================
// 移动与自动收
// ============================================================

function applyMove(fromCol, fromIdx, toCol) {
  pushHistory();
  const moving = state.tableau[fromCol].splice(fromIdx);
  const movingCount = moving.length;
  state.tableau[toCol].push(...moving);
  const src = state.tableau[fromCol];
  if (src.length > 0 && !src[src.length - 1].faceUp) {
    src[src.length - 1].faceUp = true;
  }
  state.moves++;
  state.score = Math.max(0, state.score - 1);
  const collected = tryCollectCompleted(toCol);
  render();
  saveGame();
  if (collected) flashCollect(toCol);
  else flashJustPlaced(toCol, movingCount);
  if (state.foundation === 8) showWin();
}

function tryCollectCompleted(col) {
  const c = state.tableau[col];
  if (c.length < 13) return false;
  const start = c.length - 13;
  const suit = c[start].suit;
  for (let i = 0; i < 13; i++) {
    const card = c[start + i];
    if (!card.faceUp) return false;
    if (card.suit !== suit) return false;
    if (card.rank !== 13 - i) return false;
  }
  c.splice(start);
  state.foundation++;
  state.score += 100;
  if (c.length > 0 && !c[c.length - 1].faceUp) {
    c[c.length - 1].faceUp = true;
  }
  return true;
}

// ============================================================
// 发牌（带动画）
// ============================================================

async function dealNext() {
  if (isLocked()) return;
  if (state.stock.length === 0) {
    toast("已经发完了");
    return;
  }
  for (let i = 0; i < 10; i++) {
    if (state.tableau[i].length === 0) {
      toast("每列至少要有一张牌才能发");
      return;
    }
  }
  state.isDealing = true;
  pushHistory();
  const batch = state.stock.pop();

  // 1. 记录这 10 张牌在 stock 堆叠中的实际位置（在移除之前）
  const stockRect = stockEl.getBoundingClientRect();
  const totalBefore = state.stock.reduce((s, b) => s + b.length, 0) + batch.length;
  const startPositions = [];
  for (let i = 0; i < 10; i++) {
    // 从下往上发：batch[0] 在牌堆上方，batch[9] 在牌堆下方，先让底部先飞
    startPositions.push({
      left: stockRect.left,
      top: stockRect.top + getStackTop(totalBefore - batch.length + i),
    });
  }

  // 2. 算每列目标位置（基于当前 tableau 的列尾）
  const targets = computeDealTargets();
  // 3. 飞行动画（内部会在创建 flyer 后再更新 stock 视觉，避免上移感）
  await animateDeal(batch, targets, startPositions);
  // 5. 真正落入数据
  for (let i = 0; i < 10; i++) {
    batch[i].faceUp = true;
    state.tableau[i].push(batch[i]);
  }
  state.moves++;
  state.score = Math.max(0, state.score - 1);
  const collectedCols = [];
  for (let i = 0; i < 10; i++) {
    if (tryCollectCompleted(i)) collectedCols.push(i);
  }
  state.isDealing = false;
  render();
  saveGame();
  collectedCols.forEach((c) => flashCollect(c));
  if (state.foundation === 8) showWin();
}

function computeDealTargets() {
  const targets = [];
  for (let i = 0; i < 10; i++) {
    const colEl = tableauEl.querySelector(`.column[data-col="${i}"]`);
    const rect = colEl.getBoundingClientRect();
    const cards = state.tableau[i];
    let y = 0;
    for (const c of cards) y += c.faceUp ? FACE_OFFSET : BACK_OFFSET;
    targets.push({ left: rect.left, top: rect.top + y });
  }
  return targets;
}

async function animateDeal(batch, targets, startPositions) {
  const flyers = [];
  for (let i = 0; i < 10; i++) {
    const flyer = makeCardEl({ ...batch[i], faceUp: false });
    flyer.style.position = "fixed";
    flyer.style.left = startPositions[i].left + "px";
    flyer.style.top = startPositions[i].top + "px";
    flyer.style.margin = "0";
    flyer.style.zIndex = 500;
    flyer.style.transition =
      `left ${DEAL_FLY_MS}ms cubic-bezier(.2,.7,.3,1), ` +
      `top ${DEAL_FLY_MS}ms cubic-bezier(.2,.7,.3,1)`;
    dragLayer.appendChild(flyer);
    flyers.push(flyer);
  }
  // 强制一次重排，让初始位置生效
  void flyers[0].offsetHeight;
  // 错开飞行
  for (let i = 0; i < 10; i++) {
    const f = flyers[i];
    setTimeout(() => {
      f.style.left = targets[i].left + "px";
      f.style.top = targets[i].top + "px";
    }, (9 - i) * DEAL_STAGGER_MS);
  }
  await sleep(DEAL_FLY_MS + (10 - 1) * DEAL_STAGGER_MS + 30);
  flyers.forEach((f) => f.remove());
}

// ============================================================
// 渲染
// ============================================================

function makeCardEl(card) {
  const el = document.createElement("div");
  const suit = Math.max(0, Math.min(3, card.suit == null ? 0 : card.suit));
  const rank = Math.max(1, Math.min(13, card.rank == null ? 1 : card.rank));
  if (!card.faceUp) {
    el.className = "card face-down";
  } else {
    el.className = "card face-up suit-" + suit;
    const top = document.createElement("div");
    top.className = "corner top";
    top.innerHTML =
      `<div class="rank">${RANKS[rank]}</div>` +
      `<div class="suit">${SUITS[suit]}</div>`;
    const center = document.createElement("div");
    center.className = "center";
    center.textContent = SUITS[suit];
    const bot = document.createElement("div");
    bot.className = "corner bot";
    bot.innerHTML =
      `<div class="rank">${RANKS[rank]}</div>` +
      `<div class="suit">${SUITS[suit]}</div>`;
    el.appendChild(top);
    el.appendChild(center);
    el.appendChild(bot);
  }
  el.dataset.id = card.id;
  return el;
}

function renderStock() {
  stockEl.innerHTML = "";
  if (state.stock.length === 0) {
    stockEl.classList.add("empty");
    return;
  }
  stockEl.classList.remove("empty");

  // 计算总剩余牌数
  let totalRemaining = 0;
  for (const batch of state.stock) {
    totalRemaining += batch.length;
  }

  // 总数标签
  const countLabel = document.createElement("div");
  countLabel.className = "stock-count";
  countLabel.textContent = "剩余 " + totalRemaining;
  stockEl.appendChild(countLabel);

  // 只有一个大堆叠，所有牌向下偏移露出边缘
  const pile = document.createElement("div");
  pile.className = "stock-pile";

  let cardIndex = 0;
  for (const batch of state.stock) {
    for (let j = 0; j < batch.length; j++) {
      const back = document.createElement("div");
      back.className = "card face-down stack-card";
      back.style.left = "0";
      back.style.top = getStackTop(cardIndex) + "px";
      pile.appendChild(back);
      cardIndex++;
    }
  }

  stockEl.appendChild(pile);
}

function render() {
  $("stat-score").textContent = state.score;
  $("stat-moves").textContent = state.moves;
  $("stat-done").textContent = state.foundation;
  $("btn-undo").disabled = state.history.length === 0 || state.isDealing || state.drag;

  // foundation
  foundationEl.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const slot = document.createElement("div");
    slot.className = "found-slot" + (i < state.foundation ? " filled" : "");
    if (i < state.foundation) slot.textContent = "OK";
    foundationEl.appendChild(slot);
  }

  renderStock();

  // tableau
  tableauEl.innerHTML = "";
  for (let col = 0; col < 10; col++) {
    const colEl = document.createElement("div");
    colEl.className = "column";
    colEl.dataset.col = col;
    if (state.tableau[col].length === 0) colEl.classList.add("empty-slot");
    if (dropHintCol === col) colEl.classList.add("drop-hint");
    let y = 0;
    const cards = state.tableau[col];
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const cardEl = makeCardEl(card);
      cardEl.style.top = y + "px";
      cardEl.dataset.col = col;
      cardEl.dataset.idx = i;
      if (state.drag && state.drag.fromCol === col && state.drag.fromIdx <= i) {
        cardEl.classList.add("dragging");
      }
      colEl.appendChild(cardEl);
      y += card.faceUp ? FACE_OFFSET : BACK_OFFSET;
    }
    const cardH = getCardH();
    colEl.style.minHeight = Math.max(cardH, y + cardH) + "px";
    tableauEl.appendChild(colEl);
  }
}

// ============================================================
// 拖拽
// ============================================================

function onPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (isLocked()) return;
  const cardEl = e.target.closest(".card.face-up");
  if (!cardEl) return;
  const col = parseInt(cardEl.dataset.col, 10);
  const idx = parseInt(cardEl.dataset.idx, 10);
  if (Number.isNaN(col) || Number.isNaN(idx)) return;

  if (!canDrag(col, idx)) {
    flashCard(cardEl);
    return;
  }

  const cards = state.tableau[col].slice(idx);

  // 浮层
  const stack = document.createElement("div");
  stack.className = "drag-stack";
  for (let i = 0; i < cards.length; i++) {
    const c = makeCardEl(cards[i]);
    c.style.top = i * FACE_OFFSET + "px";
    c.style.left = "0";
    stack.appendChild(c);
  }
  dragLayer.appendChild(stack);

  // 让浮层最顶张与原牌左上角对齐
  const startCardEl = tableauEl.querySelector(
    `.column[data-col="${col}"] .card[data-idx="${idx}"]`
  );
  if (!startCardEl) {
    cleanupDragListeners();
    return;
  }
  const rect = startCardEl.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;
  stack.style.left = e.clientX - offsetX + "px";
  stack.style.top = e.clientY - offsetY + "px";

  // 隐藏原牌
  const colEl = tableauEl.querySelector(`.column[data-col="${col}"]`);
  const colCardEls = colEl.querySelectorAll(".card");
  for (let i = idx; i < colCardEls.length; i++) {
    colCardEls[i].classList.add("dragging");
  }

  state.drag = {
    fromCol: col,
    fromIdx: idx,
    cards,
    stack,
    offsetX,
    offsetY,
  };

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerCancel);
}

function onPointerMove(e) {
  if (!state.drag) return;
  const { stack, offsetX, offsetY, cards } = state.drag;
  stack.style.left = e.clientX - offsetX + "px";
  stack.style.top = e.clientY - offsetY + "px";

  // 清除旧的 drop-hint
  if (dropHintCol !== null) {
    const old = tableauEl.querySelector(`.column[data-col="${dropHintCol}"]`);
    if (old) old.classList.remove("drop-hint");
  }
  dropHintCol = null;

  const target = findDropTarget(e.clientX, e.clientY);
  if (target !== null && canDrop(target, cards, state.drag.fromCol)) {
    dropHintCol = target;
    const colEl = tableauEl.querySelector(`.column[data-col="${target}"]`);
    if (colEl) colEl.classList.add("drop-hint");
  }
}

function onPointerUp(e) {
  if (!state.drag) return;
  const { fromCol, fromIdx, cards, stack } = state.drag;
  const target = findDropTarget(e.clientX, e.clientY);

  cleanupDragListeners();

  // 清除 drop-hint
  if (dropHintCol !== null) {
    const old = tableauEl.querySelector(`.column[data-col="${dropHintCol}"]`);
    if (old) old.classList.remove("drop-hint");
    dropHintCol = null;
  }

  if (target !== null && canDrop(target, cards, fromCol)) {
    state.drag = null;
    stack.remove();
    applyMove(fromCol, fromIdx, target);
  } else {
    state.drag = null;
    const originEl = tableauEl.querySelector(
      `.column[data-col="${fromCol}"] .card[data-idx="${fromIdx}"]`
    );
    if (originEl) {
      const rect = originEl.getBoundingClientRect();
      stack.style.transition = "left 0.2s ease-out, top 0.2s ease-out";
      stack.style.left = rect.left + "px";
      stack.style.top = rect.top + "px";
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        stack.remove();
        render();
      };
      stack.addEventListener("transitionend", cleanup, { once: true });
      setTimeout(cleanup, 250);
    } else {
      stack.remove();
      render();
    }
  }
}

function onPointerCancel() {
  if (!state.drag) return;
  cleanupDragListeners();
  state.drag.stack.remove();
  state.drag = null;
  if (dropHintCol !== null) {
    const old = tableauEl.querySelector(`.column[data-col="${dropHintCol}"]`);
    if (old) old.classList.remove("drop-hint");
    dropHintCol = null;
  }
  render();
}

function cancelDrag() {
  if (!state.drag) return;
  state.drag.stack.remove();
  state.drag = null;
  cleanupDragListeners();
  if (dropHintCol !== null) {
    const old = tableauEl.querySelector(`.column[data-col="${dropHintCol}"]`);
    if (old) old.classList.remove("drop-hint");
    dropHintCol = null;
  }
  render();
}

function cleanupDragListeners() {
  document.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("pointerup", onPointerUp);
  document.removeEventListener("pointercancel", onPointerCancel);
}

function findDropTarget(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const colEl = el.closest(".column");
  if (!colEl) return null;
  return parseInt(colEl.dataset.col, 10);
}

// ============================================================
// 杂项
// ============================================================

function flashCard(el) {
  el.classList.remove("invalid-flash");
  // 强制重排以重启动画
  void el.offsetWidth;
  el.classList.add("invalid-flash");
  setTimeout(() => el.classList.remove("invalid-flash"), 400);
}

function flashCollect(col) {
  const colEl = tableauEl.querySelector(`.column[data-col="${col}"]`);
  if (!colEl) return;
  colEl.classList.remove("collect-flash");
  void colEl.offsetWidth;
  colEl.classList.add("collect-flash");
  setTimeout(() => colEl.classList.remove("collect-flash"), 700);
}

function flashJustPlaced(col, count) {
  const colEl = tableauEl.querySelector(`.column[data-col="${col}"]`);
  if (!colEl) return;
  const cards = colEl.querySelectorAll(".card");
  const start = Math.max(0, cards.length - count);
  for (let i = start; i < cards.length; i++) {
    const el = cards[i];
    el.classList.remove("just-placed");
    void el.offsetWidth;
    el.classList.add("just-placed");
    setTimeout(() => el.classList.remove("just-placed"), 500);
  }
}

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1600);
}

function showLoading(text) {
  $("loading-text").textContent = text || "正在加载...";
  $("loading-overlay").hidden = false;
}
function hideLoading() {
  $("loading-overlay").hidden = true;
}

let confirmResolve = null;
let confirmOpen = false;
function showConfirm(message, confirmText = "确认", cancelText = "取消") {
  if (confirmOpen) return Promise.resolve(false);
  confirmOpen = true;
  return new Promise((resolve) => {
    confirmResolve = resolve;
    $("confirm-message").textContent = message;
    $("confirm-ok").textContent = confirmText;
    $("confirm-cancel").textContent = cancelText;
    $("confirm-overlay").hidden = false;
  });
}
function hideConfirm(result = false) {
  if (confirmResolve) { confirmResolve(result); confirmResolve = null; }
  confirmOpen = false;
  $("confirm-overlay").hidden = true;
}

/* confetti shared: scripts/confetti.js */

function showWin() {
  timer.stop();
  clearSave();
  $("win-score").textContent = state.score;
  $("win-moves").textContent = state.moves;
  const stats = recordWin(state.suits, state.score, state.moves);
  renderWinStats(stats);
  GameOverlay.show('win-overlay');
  launchConfetti();
}
function hideWin() {
  GameOverlay.hide('win-overlay');
}

function showHelpOverlay() {
  GameOverlay.show('help-overlay');
}

function hideHelpOverlay() {
  GameOverlay.hide('help-overlay');
}

// ============================================================
// 启动
// ============================================================

function renderWinStats(entry) {
  const el = $("win-stats");
  if (!el) return;
  const winRate = entry.started > 0 ? Math.round((entry.won / entry.started) * 100) : 0;
  el.innerHTML =
    `胜率 <strong>${winRate}%</strong>　` +
    `最佳 <strong>${entry.bestScore ?? "-"}</strong> 分　` +
    `最少 <strong>${entry.bestMoves ?? "-"}</strong> 步　` +
    `最快 <strong>${entry.bestTimeMs ? formatTime(entry.bestTimeMs) : "-"}</strong>`;
}

function onKeyDown(e) {
  if (e.key === "Escape") {
    if (!$("confirm-overlay").hidden) {
      hideConfirm(false);
      return;
    }
    if (!$("help-overlay").hidden) {
      hideHelpOverlay();
      return;
    }
  }
  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
      return;
    }
  }
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  switch (e.key.toLowerCase()) {
    case "n":
      if (state && (state.drag || state.isDealing)) return;
      confirmNewGame().then((ok) => { if (ok) newGame(parseInt($("difficulty").value, 10)); });
      break;
    case "d":
      dealNext();
      break;
    case "h":
      showHint();
      break;
    case "escape":
      cancelDrag();
      break;
  }
  if (e.key === "?") {
    e.preventDefault();
    if ($("help-overlay").hidden) showHelpOverlay();
    else hideHelpOverlay();
  }
}

function findAutoMoveTargets(col, idx) {
  if (!canDrag(col, idx)) return [];
  const cards = state.tableau[col].slice(idx);
  const targets = [];
  for (let t = 0; t < 10; t++) {
    if (canDrop(t, cards, col)) targets.push(t);
  }
  return targets;
}

function isCyclicMove(fromCol, fromIdx, toCol) {
  const moving = state.tableau[fromCol].slice(fromIdx);
  const newSrc = state.tableau[fromCol].slice(0, fromIdx);
  const tgt = state.tableau[toCol];
  // 目标列非空时，moving[0] 被放到 tgtTop 下面，不在顶部，无法直接移回
  if (tgt.length > 0) return false;
  // 目标列为空时，检查是否又能移回源列（需要同花色才能完整移回）
  if (newSrc.length === 0) return true;
  const srcTop = newSrc[newSrc.length - 1];
  return srcTop.faceUp && srcTop.suit === moving[0].suit && srcTop.rank === moving[0].rank + 1;
}

function scoreMove(fromCol, fromIdx, toCol) {
  const src = state.tableau[fromCol];
  const tgt = state.tableau[toCol];
  const moving = src.slice(fromIdx);
  let score = 0;

  // 1. 能翻开背面牌 —— 最有价值
  if (fromIdx > 0 && !src[fromIdx - 1].faceUp) {
    score += 100;
  }

  // 2. 延长同花色序列（形成完整 13 张序列可立即收集，给予最高奖励）
  if (tgt.length > 0) {
    const tgtTop = tgt[tgt.length - 1];
    if (tgtTop.suit === moving[0].suit && tgtTop.rank === moving[0].rank + 1) {
      score += 50;
      if (tgt.length + moving.length === 13) score += 200;
    }
  }

  // 3. 目标列非空基础分；空列扣分（但 K 放空列尚可）
  if (tgt.length === 0) {
    score += moving[0].rank === 13 ? 5 : -20;
  } else {
    score += 5;
  }

  // 4. 循环移动大幅扣分
  if (isCyclicMove(fromCol, fromIdx, toCol)) {
    score -= 200;
  }

  return score;
}

function findBestMove() {
  let best = null;
  let bestScore = -Infinity;
  for (let col = 0; col < 10; col++) {
    const c = state.tableau[col];
    for (let idx = 0; idx < c.length; idx++) {
      if (!c[idx].faceUp) continue;
      const targets = findAutoMoveTargets(col, idx);
      for (const toCol of targets) {
        const s = scoreMove(col, idx, toCol);
        if (s > bestScore) {
          bestScore = s;
          best = { fromCol: col, fromIdx: idx, toCol };
        }
      }
    }
  }
  return best;
}

function autoMoveCard(col, idx) {
  if (isLocked()) return;
  const targets = findAutoMoveTargets(col, idx);
  if (targets.length === 0) {
    toast("没有可移动的合法位置");
    return;
  }
  let best = null;
  let bestScore = -Infinity;
  for (const toCol of targets) {
    const s = scoreMove(col, idx, toCol);
    if (s > bestScore) {
      bestScore = s;
      best = toCol;
    }
  }
  if (!best) return;
  applyMove(col, idx, best);
}

function onDoubleClick(e) {
  if (isLocked()) return;
  const cardEl = e.target.closest(".card.face-up");
  if (!cardEl) return;
  const col = parseInt(cardEl.dataset.col, 10);
  const idx = parseInt(cardEl.dataset.idx, 10);
  if (Number.isNaN(col) || Number.isNaN(idx)) return;
  autoMoveCard(col, idx);
}

function clearHint() {
  if (hintTimer) {
    clearTimeout(hintTimer);
    hintTimer = null;
  }
  document.querySelectorAll(".hint-source, .hint-target").forEach((el) => {
    el.classList.remove("hint-source", "hint-target");
  });
}

function hasAnyLegalMove() {
  for (let col = 0; col < 10; col++) {
    const c = state.tableau[col];
    for (let idx = 0; idx < c.length; idx++) {
      if (!c[idx].faceUp) continue;
      if (findAutoMoveTargets(col, idx).length > 0) return true;
    }
  }
  return false;
}

function showHint() {
  if (isLocked()) return;
  clearHint();
  const best = findBestMove();
  if (!best) {
    toast(hasAnyLegalMove() ? "当前局面没有有价值的移动" : "没有可移动的牌");
    return;
  }
  const srcEl = tableauEl.querySelector(
    `.column[data-col="${best.fromCol}"] .card[data-idx="${best.fromIdx}"]`
  );
  const tgtEl = tableauEl.querySelector(`.column[data-col="${best.toCol}"]`);
  if (srcEl) srcEl.classList.add("hint-source");
  if (tgtEl) tgtEl.classList.add("hint-target");
  hintTimer = setTimeout(clearHint, 2000);
}

function isGameInProgress() {
  return state && state.moves > 0 && state.foundation < 8;
}

async function confirmNewGame() {
  if (!isGameInProgress()) return true;
  return await showConfirm("当前游戏未结束，是否开始新游戏？", "开始新游戏", "取消");
}

function bind() {
  $("btn-new").addEventListener("click", async () => {
    if (isLoading()) return;
    if (state && (state.drag || state.isDealing)) return;
    if (!await confirmNewGame()) return;
    const suits = parseInt($("difficulty").value, 10);
    const ensure = $("ensure-solvable")?.checked ?? false;
    newGame(suits, ensure);
  });
  $("btn-undo").addEventListener("click", undo);
  $("difficulty").addEventListener("change", async (e) => {
    if (isLoading()) {
      e.target.value = String(state.suits);
      return;
    }
    if (state && (state.drag || state.isDealing)) {
      e.target.value = String(state.suits);
      return;
    }
    if (!await confirmNewGame()) {
      e.target.value = String(state.suits);
      return;
    }
    const ensure = $("ensure-solvable")?.checked ?? false;
    newGame(parseInt(e.target.value, 10), ensure);
  });
  stockEl.addEventListener("click", dealNext);
  $("win-new").addEventListener("click", () => {
    newGame(parseInt($("difficulty").value, 10));
  });
  tableauEl.addEventListener("pointerdown", onPointerDown);
  $("btn-hint").addEventListener("click", showHint);
  $("btn-help").addEventListener("click", showHelpOverlay);
  $("help-close").addEventListener("click", hideHelpOverlay);
  $("help-overlay").addEventListener("click", (e) => {
    if (e.target === $("help-overlay")) hideHelpOverlay();
  });
  tableauEl.addEventListener("dblclick", onDoubleClick);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("beforeunload", saveGame);

  $("confirm-ok").addEventListener("click", () => {
    if (confirmResolve) confirmResolve(true);
    hideConfirm();
  });
  $("confirm-cancel").addEventListener("click", () => {
    if (confirmResolve) confirmResolve(false);
    hideConfirm();
  });

  if (typeof window.buildCustomDropdown === "function") window.buildCustomDropdown($("difficulty"));

  document.addEventListener("click", () => {
    document.querySelectorAll(".custom-select.open").forEach((el) => el.classList.remove("open"));
  });
}

migrateLegacyKeys();
bind();
if (!loadGame()) {
  newGame(parseInt($("difficulty").value, 10));
}
