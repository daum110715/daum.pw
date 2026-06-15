# 小游戏合集 — 项目导航文档

> 本文件用于快速定位代码位置、理解架构约定、评估改动影响范围。

---

## 1. 项目概览

| 属性 | 说明 |
|------|------|
| 类型 | 纯前端静态站点（HTML + CSS + JS），无构建工具 |
| 用途 | 8 款经典益智/街机/纸牌游戏的合集主页 + 独立游戏页 |
| 主题系统 | 18 套 CSS 主题，通过 `data-theme` 属性切换，全部集中在 `styles/common.css` |
| 数据持久化 | `localStorage`，各游戏自行管理存档与统计 |
| 许可证 | GPL v3（`LICENSE`） |

---

## 2. 目录结构

```
project-root/
├── index.html                 # 合集主页：游戏卡片网格 + 主题下拉框 + 各游戏统计摘要
├── LICENSE                    # GPL v3
├── styles/
│   └── common.css             # 【核心】全局样式 + 18 套主题变量（~700 行起是主题覆盖）
├── scripts/
│   ├── theme.js               # 【核心】主题切换逻辑 + 自定义下拉框组件
│   └── confetti.js            # 胜利礼花动画（全局共享）
├── games/
│   ├── 2048/
│   │   ├── index.html         # 游戏页面结构
│   │   ├── 2048.css           # 游戏专属样式
│   │   └── 2048.js            # 游戏逻辑（网格、滑动合并、撤销、统计）
│   ├── minesweeper/
│   │   ├── index.html
│   │   ├── minesweeper.css
│   │   └── minesweeper.js     # 扫雷逻辑（三档难度 + 自定义、第一次点击安全、提示）
│   ├── klondike/
│   │   ├── index.html
│   │   ├── klondike.css
│   │   └── klondike.js        # 克朗代克纸牌（翻 1/3 张、拖拽、计时）
│   ├── freecell/
│   │   ├── index.html
│   │   ├── freecell.css
│   │   └── freecell.js        # 空当接龙（4 中转空列、几乎每局可解）
│   ├── spider/
│   │   ├── index.html
│   │   ├── spider.css
│   │   ├── spider.js          # 蜘蛛纸牌主逻辑（1/2/4 花色、求解器接口）
│   │   ├── solver-core.js     # 求解器核心 + 牌组/发牌生成（主线程 + Worker 共享）
│   │   └── solver-worker.js   # Web Worker 包装，调用 solver-core
│   ├── sudoku/
│   │   ├── index.html
│   │   ├── sudoku.css
│   │   └── sudoku.js          # 数独（生成、求解、笔记、冲突高亮、提示）
│   ├── snake/
│   │   ├── index.html
│   │   ├── snake.css
│   │   └── snake.js           # 贪吃蛇（经典/无尽模式、触屏滑动）
│   └── tetris/
│       ├── index.html
│       ├── tetris.css
│       └── tetris.js          # 俄罗斯方块（7-bag、SRS 旋转、暂存、硬降、幽灵块）
```

---

## 3. 核心共享机制

### 3.1 主题系统

| 文件 | 职责 |
|------|------|
| `styles/common.css` | 定义 `:root` 默认变量；从大约第 700 行开始，按 `[data-theme="xxx"]` 覆盖变量 |
| `scripts/theme.js` | 读取/写入 `localStorage.theme`；为 `<select id="theme-switcher">` 生成自定义下拉框；页面加载时同步 `data-theme` |

**18 套主题名（必须和 CSS 与 VALID_THEMES 数组保持一致）**：
`dark`, `flat`, `neumorphism`, `cyberpunk`, `terminal`, `material`, `vaporwave`, `sketch`（默认）, `clay`, `brutalist`, `pixel`, `editorial`, `swiss`, `bento`, `noir`, `parchment`, `bauhaus`, `synthwave`

**如果要新增/删除主题**：
1. 在 `styles/common.css` 新增/删除 `[data-theme="xxx"]` 变量块
2. 在 `scripts/theme.js` 的 `VALID_THEMES` 数组同步
3. 在 `index.html` 的 `<select id="theme-switcher">` 同步 `<option>`
4. 各游戏页面的 `<select>`（如果有）也要同步

### 3.2 自定义下拉框组件

`scripts/theme.js` 中 `buildCustomDropdown(select)` 会把原生 `<select>` 替换成自定义样式的下拉框，并暴露 `_updateCustomDropdown()` 方法供外部同步值。

**影响范围**：主页、所有使用主题切换器的游戏页。

### 3.3 礼花动画

`scripts/confetti.js` 暴露全局函数 `fireConfetti(opts)` / `launchConfetti(opts)`。各游戏胜利时调用。

---

## 4. localStorage 键名规范

> 各游戏独立命名，互不冲突。旧版键名通过 `migrateLegacyKeys()` 迁移。

| 游戏 | 存档键 | 统计键 | 最佳记录键 | 其他 |
|------|--------|--------|------------|------|
| 2048 | `game_2048_save_v1` | `game_2048_stats_v1` | `game_2048_best_v1` | — |
| 扫雷 | `game_minesweeper_save_v1` | `game_minesweeper_stats_v1` | `game_minesweeper_best_v1` | 自定义难度 `game_minesweeper_custom_v1` |
| 纸牌(Klondike) | `game_klondike_save_v1` | `game_klondike_stats_v1` | — | 旧版 `klondike_save_v1` / `klondike_stats_v1` |
| 空当接龙 | `game_freecell_save_v1` | `game_freecell_stats_v1` | — | 旧版 `freecell_save_v1` |
| 蜘蛛纸牌 | `game_spider_save_v1` | `game_spider_stats_v1` | — | 旧版 `spider_save_v1` / `spider_stats_v1` |
| 数独 | `game_sudoku_save_v1` | `game_sudoku_stats_v1` | — | — |
| 贪吃蛇 | `game_snake_save_v1` | `game_snake_stats_v1` | — | — |
| 俄罗斯方块 | `game_tetris_save_v2` | `game_tetris_stats_v2` | — | — |
| 全局主题 | `theme` | — | — | — |

**统计数据结构共性**：
```js
{
  started: number,
  sessions: [
    { won: boolean, completedAt: timestamp, time?: ms, score?: number, ... }
  ]
}
```
纸牌类游戏（蜘蛛/纸牌/空当接龙）早期结构可能按子难度分键（如 `stats['1']`、`stats['3']`），需查看具体文件兼容逻辑。

---

## 5. 各游戏快速定位表

### 5.1 2048

| 修改目标 | 定位位置 |
|----------|----------|
| 网格大小 / 胜利目标 | `games/2048/2048.js` 顶部 `SIZE = 4`, `TARGET = 2048` |
| 滑动动画时长 | `MOVE_ANIMATION_MS = 110` |
| 撤销历史上限 | `HISTORY_LIMIT = 100` |
| 得分/最佳分/步数 UI | `2048.js` 中 `scoreEl`, `bestEl`, `movesEl` 及相关渲染函数 |
| 游戏结束/胜利遮罩 | `overlayEl` 及 `showOverlay()` |
| 触摸/键盘事件 | `handleTouchStart`, `handleTouchEnd`, `keydown` 监听 |
| 样式：方块颜色/大小 | `games/2048/2048.css` |

### 5.2 扫雷 (Minesweeper)

| 修改目标 | 定位位置 |
|----------|----------|
| 三档难度参数 | `games/minesweeper/minesweeper.js` 顶部 `DIFFICULTIES` 对象 |
| 第一次点击安全逻辑 | `handleFirstClick()` / `placeMines()` |
| 提示功能 | `hintBtnEl` 及 `showHint()` |
| 键盘模式（方向键移动） | `keyboardMode`, `focusPos`, `keydown` 事件中的方向键处理 |
| 自定义难度面板 | `customOverlayEl` 及 `customCols/Rows/Mines` |
| 样式：格子、雷、旗 | `minesweeper.css` |

### 5.3 克朗代克纸牌 (Klondike)

| 修改目标 | 定位位置 |
|----------|----------|
| 翻牌张数切换（1/3） | `difficulty` / `drawCount` 相关逻辑 |
| 拖拽系统 | `drag`, `dragLayer`, `onPointerDown/Move/Up` |
| 提示系统 | `hintTimer`, `hintSourceType`, `hintTargetCol/Found` |
| 计时器 | `gameStartTime`, `gameTimerInterval`, `formatTime()` |
| 发牌/初始化 | `newGame()`, `deal()` |
| 样式：牌面堆叠偏移 | CSS 变量 `--face-offset`, `--back-offset`；`getCardH()` 动态读取 |

### 5.4 空当接龙 (FreeCell)

| 修改目标 | 定位位置 |
|----------|----------|
| 中转空列数 / 目标堆数 | 常量 `SUITS`, `RANKS`, 及 `freecell[4]`, `foundation[4]` |
| 可移动最大张数计算 | 根据空列数 + 空单元格数的规则（搜索 `maxMove` / `emptyCount`） |
| 拖拽与规则校验 | `canDrop()` / `isSequenceMovable()` 类函数 |
| 计时器与步数 | `startTime`, `timerInterval`, `moves` |
| 样式 | `freecell.css` |

### 5.5 蜘蛛纸牌 (Spider)

| 修改目标 | 定位位置 |
|----------|----------|
| 难度（1/2/4 花色） | `state.suits` 及 `generateDeal()` |
| 求解器 | `solver-core.js`（生成 + 求解逻辑）, `solver-worker.js`（Worker 封装） |
| 构造性可解发牌 | `generateSolvableDeal()`（保证 100% 可解） |
| 发牌飞入动画 | `DEAL_FLY_MS`, `DEAL_STAGGER_MS` |
| 历史/撤销上限 | `HISTORY_LIMIT = 200` |
| 样式：牌堆叠 | CSS 变量 `--card-h`, `--face-offset`, `--back-offset` |

### 5.6 数独 (Sudoku)

| 修改目标 | 定位位置 |
|----------|----------|
| 难度定义（挖空数） | `DIFFICULTIES`：`easy: 36`, `medium: 46`, `hard: 56` |
| 生成算法 | `fillBoard()`（回溯） + `countSolutions()`（唯一解校验） |
| 笔记模式 | `notes` 二维数组 + `renderNotes()` |
| 冲突高亮 | `highlightConflicts()` |
| 提示 | `giveHint()` |
| 撤销 | `history` 栈 |
| 自动保存 | `saveGame()` / `loadGame()` |

### 5.7 贪吃蛇 (Snake)

| 修改目标 | 定位位置 |
|----------|----------|
| 网格尺寸（移动端 16 / 桌面 20） | `calculateBoardSize()` 中 `state.cellCount` |
| 速度/难度 | `state.speed = 150`（ms 间隔） |
| 模式（经典/无尽） | `state.mode` |
| 触屏滑动控制 | `touchStart` 及 `handleTouchStart/Move/End` |
| 死亡/暂停遮罩 | `goOverlay`, `pauseOverlay` |

### 5.8 俄罗斯方块 (Tetris)

| 修改目标 | 定位位置 |
|----------|----------|
| 场地大小 | `COLS = 10`, `ROWS = 20` |
| 7-bag 随机生成 | `bag` 队列逻辑（搜索 `bag`） |
| SRS 旋转系统 | `SHAPES` 各 piece 的 4 种朝向 + `wallKickData`（I 与其他块不同） |
| 锁定延迟 / 最大重置次数 | `LOCK_DELAY = 500`, `MAX_LOCK_RESETS = 15` |
| 幽灵方块 | `ghostPiece` 渲染逻辑 |
| 暂存 (Hold) | `holdPiece` 及交换逻辑 |
| 硬降 / 软降 | `hardDrop()`, `softDrop()` |
| 预览块数 | `PREVIEW_COUNT = 3` |

---

## 6. 主页 (index.html) 结构

```
.site-header
  .header-row
    .site-title          "小游戏合集"
    .theme-switcher      <select id="theme-switcher"> (18 个 option)
  .site-subtitle         "闲来无事，挑一个开始玩。"
.game-grid
  a.game-card × 8         每个卡片包含：name / desc / dash-stats / tag
```

**统计摘要注入逻辑**：内联 `<script>` 在页面底部，读取各游戏 `localStorage` 统计键，生成今日局数、胜率、最近记录，写入对应 `.dash-stats`。如果要修改主页卡片布局或新增游戏，需要同时修改 HTML 结构 + 底部注入脚本。

---

## 7. 通用 UI 组件约定

> 各游戏页面复用相似结构，但未提取成共享模板（纯静态 HTML）。

### 7.1 常见 DOM 结构模式

```
.game-topbar              # 顶部栏：标题 + 主题切换器
.game-stats               # 统计栏：时间/步数/得分等
.board-container / .board # 游戏主区域
.overlay                  # 游戏结束/胜利遮罩（hidden 控制显隐）
  .overlay-title          # "胜利"/"游戏结束"
  .overlay-scoreline      # 得分摘要
  .overlay-actions        # 按钮组（重来、返回主页、继续）
.stats-section            # 底部统计面板（总局数、胜率、最近记录列表）
  .stats-panel            # 汇总面板
  .recent-panel           # 最近对局列表
```

### 7.2 共享函数命名约定

| 功能 | 常见函数名 |
|------|-----------|
| DOM 选择器 | `$(id)` |
| 新游戏 | `newGame()` |
| 保存/读取 | `saveGame()` / `loadGame()` |
| 撤销 | `undo()`（通常从 `history` 栈弹出） |
| 提示 | `showHint()` / `giveHint()` |
| 计时器启动/停止 | `startTimer()` / `stopTimer()` |
| 格式化时间 | `formatTime(ms)` |
| 旧键迁移 | `migrateLegacyKeys()` |

---

## 8. 修改影响速查

| 你想改什么 | 应该改哪里 | 影响范围 |
|------------|-----------|----------|
| 新增一套主题 | `common.css` + `theme.js` VALID_THEMES + 所有 HTML 的 `<select>` | 全站 |
| 修改默认主题 | `theme.js` 中 `DEFAULT_THEME` | 全站 |
| 新增游戏 | 新建 `games/xxx/` 目录；在 `index.html` 添加卡片 + 统计注入脚本 | 主页 + 新增页面 |
| 修改礼花效果 | `scripts/confetti.js` | 所有胜利动画 |
| 修改主页布局/卡片样式 | `index.html` + `common.css` 中 `.game-grid`, `.game-card` | 主页 |
| 修改各游戏共享的遮罩/按钮样式 | `common.css` 中游戏相关通用选择器 | 所有游戏页 |
| 修改某游戏专属规则/难度 | 对应 `games/xxx/xxx.js` | 该游戏 |
| 修改某游戏专属视觉 | 对应 `games/xxx/xxx.css` | 该游戏 |
| 统一存档/统计数据结构 | 需改动对应游戏的 `saveGame` / `loadGame` 及主页注入脚本 | 该游戏 + 主页摘要 |
| 添加音效 | 目前无音效系统；需在对应游戏 JS 中添加 Audio 对象及播放逻辑 | 需逐游戏添加 |
| 添加 PWA / Service Worker | 新建 `sw.js` + `manifest.json`；在各 `index.html` 注册 | 全站 |

---

## 9. 注意事项与陷阱

1. **纯静态部署**：没有构建步骤，不能直接使用 `import/export`（除非改 type="module"）。目前全部使用传统 IIFE 或全局脚本标签加载。
2. **主题变量覆盖顺序**：`common.css` 中 `:root` 定义默认值，各 `[data-theme]` 块覆盖。游戏专属 CSS 不应重新定义全局变量，除非该游戏只需要特定样式。
3. **localStorage 容量**：蜘蛛纸牌存档保留最近 50 步历史（`history.slice(-50)`），其余游戏也有各自上限，防止存爆。
4. **Solver Worker**：蜘蛛纸牌的 `solver-worker.js` 引入 `solver-core.js`，在本地文件协议 (`file://`) 下可能因同源策略无法加载 Worker，需通过 HTTP 服务器访问。
5. **旧键迁移**：Klondike / FreeCell / Spider 均有 `migrateLegacyKeys()`，注意在更改键名版本时保留迁移逻辑。
6. **移动端适配**：各游戏通过 `window.innerWidth` 计算棋盘尺寸（如 Snake 的 `cellCount` 切换），修改棋盘大小时需兼顾移动端布局。

---

---

## 10. 新游戏设计文档（接口级）

> 开发顺序：记忆翻牌 → 五子棋 → 黑白棋 → 消消乐  
> 复用约定：`game-common.js` 全局模块 + 内部 IIFE 拆分  
> UI 约定：复用 `common.css` 主题变量，控件自定义样式  
> 键名约定：`game_<name>_save_v1` / `game_<name>_stats_v1`

---

### 10.1 记忆翻牌 (Memory)

#### 规则
- 4×4 / 4×5 / 6×6 网格，背面朝上，每次翻开两张
- 配对成功则保持翻开，失败则翻回
- 全部配对完成即胜利，记录用时和翻牌次数
- 支持三档难度（格子数不同）

#### 文件清单
```
games/memory/
├── index.html    # 标准游戏页结构
├── memory.css    # 卡牌网格、翻转动画、配对高亮
└── memory.js     # 游戏逻辑（模块化拆分见下）
```

#### 数据结构 (state)
```js
{
  cards: [        // 每张牌：{ id, value, matched, flipped }
    { id: 0, value: '🐱', matched: false, flipped: false },
    ...
  ],
  firstPick: null,    // { index } 或 null
  secondPick: null,
  isLocked: false,    // 翻牌动画期间锁定输入
  moves: 0,
  matchedPairs: 0,
  totalPairs: 8,      // 根据难度变化
  difficulty: 'easy', // easy(4×4) / medium(4×5) / hard(6×6)
  gameWon: false,
  elapsedMs: 0
}
```

#### 核心函数签名
```js
// === 初始化 ===
init()                          // 绑定事件、尝试 loadGame()、否则 newGame()
newGame(difficulty?)            // 生成配对牌组 → shuffle → 重置 state → 启动计时器
buildCards(pairCount)           // 返回打乱的 cards 数组（emoji 池子内选取）

// === 渲染 ===
render()                        // 根据 state.cards 生成 DOM，处理翻转/匹配态
renderStatsPanel()              // 总局数、胜率、最佳翻牌次数

// === 交互 ===
onCardClick(index)              // 翻牌逻辑：第一张 → 记录；第二张 → 比较 → 延迟翻回
flipCard(index, faceUp)         // 设置 state.cards[index].flipped
handleMatch()                   // matched = true，matchedPairs++，检查 win
handleMismatch()                // 延迟 800ms 后翻回两张，isLocked = false

// === 计时/统计/存储 ===
// 复用 GameTimer + GameStats + GameStorage
// saveGame() / loadGame() / clearSave()
// updateStats(won, moves, elapsedMs)
```

#### UI 结构
```
.topbar
  .topbar-left    返回 + "记忆翻牌"
  .topbar-stats   用时 / 步数 / 剩余对数
  .topbar-right   主题切换 + 难度选择 + 新游戏 + 帮助
.board
  .memory-grid    CSS Grid，gap 由主题变量控制
    .card × N     正面 emoji / 背面图案（用 CSS 3D 翻转）
.stats-section   对局数据 + 近期战绩
```

#### localStorage
| 用途 | 键名 |
|------|------|
| 存档 | `game_memory_save_v1` |
| 统计 | `game_memory_stats_v1` |

---

### 10.2 五子棋 (Gomoku)

#### 规则
- 15×15 棋盘，黑白双方轮流落子
- 先连成五子者获胜
- 支持双人（本地轮流）和人机对战
- 人机用 Minimax + Alpha-Beta 剪枝 + 简单评估函数

#### 文件清单
```
games/gomoku/
├── index.html    # 标准游戏页结构
├── gomoku.css    # 棋盘网格、棋子样式、最后落子标记
└── gomoku.js     # 主逻辑 + AI 模块（内部 IIFE 拆分）
```

#### 数据结构 (state)
```js
{
  board: Array(15).fill(Array(15).fill(0)), // 0=空, 1=黑, 2=白
  currentPlayer: 1,  // 1=黑(玩家), 2=白(AI 或玩家2)
  mode: 'pvp',       // 'pvp' / 'ai'
  gameOver: false,
  winner: null,      // 1 / 2 / null
  moves: 0,
  history: [],       // { row, col, player }[]，用于撤销
  lastMove: null,    // { row, col }
  aiDepth: 2,        // AI 搜索深度（简单/中等/困难）
  isThinking: false  // AI 思考中锁定输入
}
```

#### 核心函数签名
```js
// === 初始化 ===
init()
newGame(mode?, aiDifficulty?)   // mode: 'pvp'/'ai'，难度控制 aiDepth

// === 渲染 ===
render()
renderBoard()                   // 生成 15×15 网格 + 棋子 + 最后落子标记
renderStatsPanel()

// === 规则与胜负 ===
placeStone(row, col)            // 落子 → pushHistory → 检查胜负 → 切换玩家
checkWin(row, col, player)      // 四方向扫描（横竖斜），是否连成 5
undo()                          // history.pop() → 回退 board + currentPlayer

// === AI 模块 (内部 IIFE) ===
findBestMove(board, depth, player)   // Minimax + Alpha-Beta
evaluateBoard(board)                 // 简单启发式：活四 > 冲四 > 活三 > ...
getValidMoves(board)                 // 只考虑已有棋子周围 2 格内的空位（剪枝）

// === 计时/统计/存储 ===
// 复用 GameTimer + GameStats + GameStorage
// PvP 模式不记胜负到 stats；AI 模式记录玩家胜负
```

#### UI 结构
```
.topbar
  .topbar-stats   当前回合(黑/白) / 总步数
  .topbar-right   主题切换 + 模式(PvP/AI) + AI难度 + 新游戏 + 撤销 + 帮助
.board
  .gomoku-board   15×15 CSS Grid
    .cell × 225   点击落子；已有棋子显示黑白圆
    .last-move     最后落子加红色方框标记
.overlay          胜利/平局遮罩
```

#### localStorage
| 用途 | 键名 |
|------|------|
| 存档 | `game_gomoku_save_v1` |
| 统计 | `game_gomoku_stats_v1` |

---

### 10.3 黑白棋 (Othello)

#### 规则
- 8×8 棋盘，开局四角空白，中心 2×2 放两黑两白交叉
- 每步必须至少翻转对方一枚棋子（横竖斜夹住）
- 无合法步则跳过回合；双方都无法走棋时结束
- 棋子多者获胜
- 支持双人和人机（评估函数比五子棋更直观：位置权重表）

#### 文件清单
```
games/othello/
├── index.html    # 标准游戏页结构
├── othello.css   # 棋盘、棋子黑白翻转动画、合法落子提示
└── othello.js    # 主逻辑 + AI 模块
```

#### 数据结构 (state)
```js
{
  board: Array(8).fill(Array(8).fill(0)), // 0=空, 1=黑, 2=白
  currentPlayer: 1,
  mode: 'pvp',       // 'pvp' / 'ai'
  gameOver: false,
  blackCount: 2,
  whiteCount: 2,
  skippedTurn: false,// 记录上回合是否被跳过（连续跳则终局）
  moves: 0,
  history: [],       // { row, col, player, flipped: [] }[]
  aiDifficulty: 'medium', // easy/medium/hard（影响搜索深度和评估）
  isThinking: false
}
```

#### 核心函数签名
```js
// === 初始化 ===
init()
newGame(mode?, difficulty?)

// === 规则 ===
getValidMoves(board, player)         // 返回所有合法落子坐标 {row, col}[]
getFlippedDiscs(board, row, col, player)  // 八方向扫描，返回被翻转的坐标数组
placeDisc(row, col)                  // 落子 + 翻转 + 更新 count + 切玩家
hasValidMove(board, player)          // 是否有合法步
skipTurn()                           // 当前玩家无合法步，切对方
endGame()                            // 双方均无步或棋盘满 → 统计胜负
undo()                               // history.pop() 回退

// === AI 模块 (内部 IIFE) ===
findBestMove(board, player, depth)   // Minimax + Alpha-Beta
evaluateBoard(board)                 // 位置权重表（角 > 边 > 中心）+ 行动力 + 稳定子

// === 渲染 ===
render()
renderBoard()                        // 格子 + 棋子（黑/白）+ 合法步提示（半透明圆点）
renderCounts()                       // 黑: X / 白: Y
renderStatsPanel()

// === 计时/统计/存储 ===
// 复用 GameTimer + GameStats + GameStorage
```

#### UI 结构
```
.topbar
  .topbar-stats   黑子数 / 白子数 / 当前回合
  .topbar-right   主题切换 + 模式 + AI难度 + 新游戏 + 撤销 + 帮助
.board
  .othello-board  8×8 Grid
    .cell × 64    黑/白棋子（CSS 翻转动画）；合法位置显示 hint-dot
.overlay
```

#### localStorage
| 用途 | 键名 |
|------|------|
| 存档 | `game_othello_save_v1` |
| 统计 | `game_othello_stats_v1` |

---

### 10.4 消消乐 (Match-3)

#### 规则
- 8×8 棋盘，随机填充 5-6 种颜色的宝石/方块
- 交换相邻两个，形成 3 个或以上同色连线则消除
- 消除后上方方块下落，顶部生成新方块填补空缺
- 支持连锁消除（一次交换触发多轮消除）
- 计分系统：3连=30分，4连=60分，5连=120分，连锁有倍率加成
- 限时模式（60秒）或步数模式（20步）

#### 文件清单
```
games/match3/
├── index.html    # 标准游戏页结构
├── match3.css    # 宝石样式、消除动画、下落动画、粒子效果
└── match3.js     # 主逻辑（状态机：idle → select → swap → resolve → cascade）
```

#### 数据结构 (state)
```js
{
  board: Array(8).fill(Array(8).fill(null)), // null 或 { type: 0-5, id }
  mode: 'time',      // 'time' / 'moves'
  score: 0,
  targetScore: 1000, // 过关目标（或无尽模式不设目标）
  movesLeft: 20,     // 步数模式
  timeLeft: 60,      // 限时模式（秒）
  selected: null,    // { row, col } 当前选中的宝石
  isResolving: false,// 消除/下落动画期间锁定输入
  combo: 0,          // 当前连锁数
  maxCombo: 0,       // 本局最大连锁
  gameOver: false,
  gameWon: false     // 达到 targetScore
}
```

#### 核心函数签名
```js
// === 初始化 ===
init()
newGame(mode?)                     // mode: 'time' / 'moves'
generateBoard()                    // 生成初始棋盘，确保无预置匹配（或允许一次 auto-resolve）

// === 状态机 ===
// idle → 玩家选中 → select → 交换 → swap → 检测匹配 → resolve → 下落 → cascade → idle

onCellClick(row, col)              // 选中/交换逻辑
swapCells(r1, c1, r2, c2)        // 交换两个宝石（如果相邻）
findMatches(board)                 // 返回所有匹配线段 { cells: [{r,c}], type, length }[]
removeMatches(matches)             // 将匹配的 cell 置 null，计算得分
applyGravity()                     // 下落：每列 null 上方的宝石下移，顶部生成新宝石
hasPossibleMoves(board)            // 扫描是否存在至少一个合法交换（避免死局）
shuffleBoard()                     // 死局时重新打乱
endGame(won?)                      // 停止计时器，显示结果遮罩

// === 渲染 ===
render()
renderBoard()                      // 宝石网格 + 选中态 + 交换/消除/下落动画（CSS transition）
renderStatsPanel()

// === 计时/统计/存储 ===
// 复用 GameTimer（限时模式反向倒计时）+ GameStats + GameStorage
// 统计：总局数、总得分、最高单次得分、最高连锁
```

#### UI 结构
```
.topbar
  .topbar-stats   分数 / 剩余时间 或 剩余步数 / 目标分数 / 最大连锁
  .topbar-right   主题切换 + 模式切换 + 新游戏 + 帮助
.board
  .match3-board   8×8 Grid
    .cell × 64    宝石（6 种颜色，CSS 变量控制）
    .selected      选中态发光边框
    .matched       消除动画（缩小/淡出）
    .falling       下落动画
.stats-section
```

#### localStorage
| 用途 | 键名 |
|------|------|
| 存档 | `game_match3_save_v1` |
| 统计 | `game_match3_stats_v1` |

---

*文档生成时间：2026-05-18*  
*对应仓库最新提交：main 分支*
