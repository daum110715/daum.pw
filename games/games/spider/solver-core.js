// 求解器核心 + 牌组生成（供主线程和 Web Worker 共享）

const SUITS = ["黑桃", "红桃", "方块", "梅花"];
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function buildDeck(suitsCount) {
  let sc = parseInt(suitsCount, 10) || 4;
  if (sc !== 1 && sc !== 2) sc = 4;
  const suitsList = [];
  for (let i = 0; i < 8; i++) {
    if (sc === 1) suitsList.push(0);
    else if (sc === 2) suitsList.push(i % 2);
    else suitsList.push(i % 4);
  }
  const cards = [];
  let id = 0;
  for (const suit of suitsList) {
    for (let rank = 1; rank <= 13; rank++) {
      cards.push({ id: "c" + id++, suit, rank, faceUp: false });
    }
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function generateDeal(suitsCount) {
  const deck = buildDeck(suitsCount);
  const tableau = Array.from({ length: 10 }, () => []);
  const stock = [];
  const counts = [6, 6, 6, 6, 5, 5, 5, 5, 5, 5];
  let p = 0;
  for (let c = 0; c < 10; c++) {
    for (let r = 0; r < counts[c]; r++) {
      tableau[c].push({ ...deck[p++] });
    }
    tableau[c][tableau[c].length - 1].faceUp = true;
  }
  for (let s = 0; s < 5; s++) {
    stock.push(deck.slice(p, p + 10).map((c) => ({ ...c })));
    p += 10;
  }
  return { tableau, stock };
}

// 构造性生成：精确控制每序列切分，保证 100% 可解且符合初始分布
function generateSolvableDeal(suitsCount) {
  let sc = parseInt(suitsCount, 10) || 4;
  if (sc !== 1 && sc !== 2) sc = 4;

  // 1. 确定 8 个序列的 suit
  const suitsList = [];
  for (let i = 0; i < 8; i++) {
    if (sc === 1) suitsList.push(0);
    else if (sc === 2) suitsList.push(i % 2);
    else suitsList.push(i % 4);
  }

  // 2. 创建 8 个完整序列（K 到 A）
  let cardId = 0;
  const sequences = [];
  for (let i = 0; i < 8; i++) {
    const seq = [];
    for (let r = 13; r >= 1; r--) {
      seq.push({ id: "c" + cardId++, suit: suitsList[i], rank: r, faceUp: true });
    }
    sequences.push(seq);
  }

  // 3. 随机选择 2 个序列切成 3 段（2 段 tableau + 1 段 stock）
  //    其余 6 个序列切成 2 段（1 段 tableau + 1 段 stock）
  const seqIndices = [0, 1, 2, 3, 4, 5, 6, 7];
  for (let i = seqIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [seqIndices[i], seqIndices[j]] = [seqIndices[j], seqIndices[i]];
  }
  const doubleSeq = [seqIndices[0], seqIndices[1]]; // 提供 2 个 tableau 段
  const singleSeq = seqIndices.slice(2);             // 各提供 1 个 tableau 段

  const tableauSegments = [];
  const stockSegments = [];

  // 6 个 single 序列：tableau 段长度从 [5,5,5,5,6,6] 中随机分配
  const singleLens = [5, 5, 5, 5, 6, 6];
  for (let i = singleLens.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [singleLens[i], singleLens[j]] = [singleLens[j], singleLens[i]];
  }
  for (let i = 0; i < 6; i++) {
    const seqIdx = singleSeq[i];
    const len = singleLens[i];
    tableauSegments.push(sequences[seqIdx].slice(0, len));
    stockSegments.push(sequences[seqIdx].slice(len));
  }

  // 2 个 double 序列：每序列切成 5+6，两段都进 tableau，剩余 2 张进 stock
  const doubleLens = [
    [5, 6],
    [5, 6],
  ];
  for (let i = 0; i < 2; i++) {
    const seqIdx = doubleSeq[i];
    const [len1, len2] = doubleLens[i];
    // 随机决定是否交换两段长度
    if (Math.random() < 0.5) {
      tableauSegments.push(sequences[seqIdx].slice(0, len1));
      tableauSegments.push(sequences[seqIdx].slice(len1, len1 + len2));
    } else {
      tableauSegments.push(sequences[seqIdx].slice(0, len2));
      tableauSegments.push(sequences[seqIdx].slice(len2, len2 + len1));
    }
    stockSegments.push(sequences[seqIdx].slice(len1 + len2));
  }

  // 4. 把 10 个 tableau 段随机分配到 10 列（每列一段，长度自然为 5 或 6）
  for (let i = tableauSegments.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tableauSegments[i], tableauSegments[j]] = [tableauSegments[j], tableauSegments[i]];
  }
  const tableau = Array.from({ length: 10 }, () => []);
  for (let i = 0; i < 10; i++) {
    tableau[i].push(...tableauSegments[i]);
  }

  // 5. 把所有 stock 段打散成单张，洗牌，组成 5 batches（每批 10 张）
  let stockCards = [];
  for (const seg of stockSegments) stockCards.push(...seg);
  for (let i = stockCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [stockCards[i], stockCards[j]] = [stockCards[j], stockCards[i]];
  }
  const stock = [];
  for (let b = 0; b < 5; b++) {
    const batch = stockCards.slice(b * 10, (b + 1) * 10).map((c) => ({ ...c, faceUp: false }));
    stock.push(batch);
  }

  // 6. 翻牌：每列只有最上面一张 faceUp
  for (let i = 0; i < 10; i++) {
    const col = tableau[i];
    for (let j = 0; j < col.length; j++) {
      col[j].faceUp = j === col.length - 1;
    }
  }

  return { tableau, stock };
}

function solverCloneState(s) {
  const tableau = new Array(10);
  for (let c = 0; c < 10; c++) {
    const col = s.tableau[c];
    const newCol = new Array(col.length);
    for (let i = 0; i < col.length; i++) {
      const card = col[i];
      newCol[i] = { suit: card.suit, rank: card.rank, faceUp: card.faceUp };
    }
    tableau[c] = newCol;
  }
  const stock = new Array(s.stock.length);
  for (let b = 0; b < s.stock.length; b++) {
    const batch = s.stock[b];
    const newBatch = new Array(batch.length);
    for (let i = 0; i < batch.length; i++) {
      const card = batch[i];
      newBatch[i] = { suit: card.suit, rank: card.rank, faceUp: card.faceUp };
    }
    stock[b] = newBatch;
  }
  return { suits: s.suits, tableau, stock, foundation: s.foundation };
}

function solverSerialize(s) {
  return (
    s.tableau
      .map((col) => col.map((c) => `${c.suit},${c.rank},${c.faceUp ? 1 : 0}`).join(";"))
      .join("|") +
    "#" +
    s.stock.map((b) => b.map((c) => `${c.suit},${c.rank}`).join(";")).join("|") +
    "#" +
    s.foundation
  );
}

function solverCanDrag(col, idx) {
  if (idx < 0 || idx >= col.length) return false;
  if (!col[idx].faceUp) return false;
  for (let i = idx; i < col.length - 1; i++) {
    if (col[i].suit !== col[i + 1].suit) return false;
    if (col[i].rank !== col[i + 1].rank + 1) return false;
  }
  return true;
}

function solverCanDrop(tgtCol, cards) {
  if (tgtCol.length === 0) return true;
  const top = tgtCol[tgtCol.length - 1];
  if (!top.faceUp) return false;
  return top.rank === cards[0].rank + 1;
}

function solverTryCollectOne(s, colIdx) {
  const c = s.tableau[colIdx];
  if (c.length < 13) return false;
  const start = c.length - 13;
  const suit = c[start].suit;
  for (let i = 0; i < 13; i++) {
    const card = c[start + i];
    if (!card.faceUp || card.suit !== suit || card.rank !== 13 - i) return false;
  }
  c.splice(start);
  s.foundation++;
  if (c.length > 0 && !c[c.length - 1].faceUp) {
    c[c.length - 1].faceUp = true;
  }
  return true;
}

function solverAutoCollect(s) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < 10; i++) {
      if (solverTryCollectOne(s, i)) {
        changed = true;
        if (s.foundation === 8) return;
      }
    }
  }
}

function solverScoreMove(s, fromCol, fromIdx, toCol) {
  const src = s.tableau[fromCol];
  const tgt = s.tableau[toCol];
  const moving = src.slice(fromIdx);
  let score = 0;

  // 1. 能翻开背面牌 —— 最有价值
  if (fromIdx > 0 && !src[fromIdx - 1].faceUp) score += 100;

  // 2. 延长同花色序列（形成完整 13 张序列可立即收集，给予最高奖励）
  if (tgt.length > 0) {
    const tgtTop = tgt[tgt.length - 1];
    if (tgtTop.suit === moving[0].suit && tgtTop.rank === moving[0].rank + 1) {
      score += 60;
      if (tgt.length + moving.length === 13) score += 200; // 一步完成收集
    }
  }

  // 3. 空列策略：K 放空列很好，为了翻牌而使用空列也很好
  if (tgt.length === 0) {
    if (moving[0].rank === 13) score += 50;          // K 放空列
    else if (fromIdx > 0 && !src[fromIdx - 1].faceUp) score += 35; // 腾空翻牌
    else if (moving.length > 1) score += 2;          // 整组移到空列重组（低奖励，避免无意义来回）
    else score += 5;                                  // 单张移到空列
  } else {
    score += 10;
  }

  // 4. 优先移动更长的序列（奖励长度）
  score += moving.length * 2;

  return score;
}

// 状态评估函数 —— 用于 Beam Search
function solverEvaluateState(s) {
  let score = s.foundation * 100000;

  // 奖励 tableau 中同花色的连续降序序列（从底部开始）
  let totalRun = 0;
  let faceUpCount = 0;
  for (const col of s.tableau) {
    let run = 0;
    for (let i = col.length - 1; i >= 0; i--) {
      if (!col[i].faceUp) break;
      faceUpCount++;
      if (i === col.length - 1) {
        run = 1;
      } else if (col[i].suit === col[i + 1].suit && col[i].rank === col[i + 1].rank + 1) {
        run++;
      } else {
        break;
      }
    }
    totalRun += run * run; // 平方奖励长序列
  }
  score += totalRun * 50;
  score += faceUpCount * 5;

  // 空列：有 stock 时无法发牌，所以空列是坏事
  for (const col of s.tableau) {
    if (col.length === 0) {
      score -= s.stock.length > 0 ? 40 : 5;
    }
  }

  // stock 剩余批次奖励（发牌越少越好？不，这不重要）
  score += s.stock.length * 10;

  return score;
}

// Beam Search 求解器 —— 比贪心可靠，比 DFS 快
function isSolvableByGreedy(initialState, beamWidth = 60, maxSteps = 100, topMovesLimit = 20) {
  let beams = [solverCloneState(initialState)];

  for (let step = 0; step < maxSteps; step++) {
    const nextStates = [];

    for (const state of beams) {
      solverAutoCollect(state);
      if (state.foundation === 8) return true;

      // 生成所有移动并评分，只保留前 12 个
      const scoredMoves = [];
      for (let from = 0; from < 10; from++) {
        const col = state.tableau[from];
        for (let idx = 0; idx < col.length; idx++) {
          if (!col[idx].faceUp) continue;
          if (!solverCanDrag(col, idx)) continue;
          const cards = col.slice(idx);
          for (let to = 0; to < 10; to++) {
            if (to === from) continue;
            if (!solverCanDrop(state.tableau[to], cards)) continue;
            scoredMoves.push({ from, idx, to, score: solverScoreMove(state, from, idx, to) });
          }
        }
      }
      scoredMoves.sort((a, b) => b.score - a.score);
      const topMoves = scoredMoves.slice(0, topMovesLimit);

      for (const m of topMoves) {
        const s2 = solverCloneState(state);
        const moving = s2.tableau[m.from].splice(m.idx);
        s2.tableau[m.to].push(...moving);
        if (s2.tableau[m.from].length > 0 && !s2.tableau[m.from][s2.tableau[m.from].length - 1].faceUp) {
          s2.tableau[m.from][s2.tableau[m.from].length - 1].faceUp = true;
        }
        nextStates.push(s2);
      }

      // 发牌
      if (state.stock.length > 0) {
        let canDeal = true;
        for (let i = 0; i < 10; i++) {
          if (state.tableau[i].length === 0) { canDeal = false; break; }
        }
        if (canDeal) {
          const s2 = solverCloneState(state);
          const batch = s2.stock.pop();
          for (let i = 0; i < 10; i++) {
            batch[i].faceUp = true;
            s2.tableau[i].push(batch[i]);
          }
          nextStates.push(s2);
        }
      }
    }

    if (nextStates.length === 0) return false;

    // 轻量去重：仅当状态数过多时才序列化去重，否则直接评估
    let scored;
    if (nextStates.length > beamWidth * 3) {
      const seen = new Set();
      scored = [];
      for (const s2 of nextStates) {
        const key = solverSerialize(s2);
        if (seen.has(key)) continue;
        seen.add(key);
        scored.push({ state: s2, score: solverEvaluateState(s2) });
      }
    } else {
      scored = nextStates.map((s2) => ({ state: s2, score: solverEvaluateState(s2) }));
    }

    // 按分数排序，保留前 beamWidth
    scored.sort((a, b) => b.score - a.score);
    beams = scored.slice(0, beamWidth).map((x) => x.state);
  }

  return false;
}

// 保留的 DFS 求解器（深度搜索，慢但理论上更可靠）
function isSolvable(initialState, maxDepth = 500, timeLimitMs = 5000, maxVisited = Infinity) {
  const startTime = Date.now();
  const visited = new Set();

  function search(s, depth) {
    if (Date.now() - startTime > timeLimitMs) return false;
    if (s.foundation === 8) return true;
    if (depth >= maxDepth) return false;

    const key = solverSerialize(s);
    if (visited.has(key)) return false;
    visited.add(key);
    if (maxVisited !== Infinity && visited.size > maxVisited) return false;

    solverAutoCollect(s);
    if (s.foundation === 8) return true;

    if (s.stock.length > 0) {
      let canDeal = true;
      for (let i = 0; i < 10; i++) {
        if (s.tableau[i].length === 0) {
          canDeal = false;
          break;
        }
      }
      if (canDeal) {
        const s2 = solverCloneState(s);
        const batch = s2.stock.pop();
        for (let i = 0; i < 10; i++) {
          batch[i].faceUp = true;
          s2.tableau[i].push(batch[i]);
        }
        if (search(s2, depth + 1)) return true;
      }
    }

    const moves = [];
    for (let from = 0; from < 10; from++) {
      const col = s.tableau[from];
      for (let idx = 0; idx < col.length; idx++) {
        if (!col[idx].faceUp) continue;
        if (!solverCanDrag(col, idx)) continue;
        const cards = col.slice(idx);
        for (let to = 0; to < 10; to++) {
          if (to === from) continue;
          if (!solverCanDrop(s.tableau[to], cards)) continue;
          moves.push({ from, idx, to, score: solverScoreMove(s, from, idx, to) });
        }
      }
    }

    moves.sort((a, b) => b.score - a.score);

    for (const m of moves) {
      const s2 = solverCloneState(s);
      const { from, idx, to } = m;
      const moving = s2.tableau[from].splice(idx);
      s2.tableau[to].push(...moving);
      if (s2.tableau[from].length > 0 && !s2.tableau[from][s2.tableau[from].length - 1].faceUp) {
        s2.tableau[from][s2.tableau[from].length - 1].faceUp = true;
      }
      if (search(s2, depth + 1)) return true;
    }

    return false;
  }

  const s = solverCloneState(initialState);
  solverAutoCollect(s);
  return search(s, 0);
}

// 暴露给 Worker 使用（如果作为模块被 importScripts 引入）
if (typeof self !== "undefined") {
  self.buildDeck = buildDeck;
  self.generateDeal = generateDeal;
  self.generateSolvableDeal = generateSolvableDeal;
  self.isSolvable = isSolvable;
  self.isSolvableByGreedy = isSolvableByGreedy;
}

// 暴露给 Node.js 使用
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildDeck, generateDeal, generateSolvableDeal, isSolvable, isSolvableByGreedy,
    solverCloneState, solverSerialize, solverCanDrag, solverCanDrop,
    solverScoreMove, solverAutoCollect, solverTryCollectOne
  };
}
