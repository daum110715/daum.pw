import { reactive, ref } from 'vue'

/**
 * 品牌字停靠几何(Hero 测量,PagePager 消费):
 * Hero 的 daum12569 SVG 飞入顶部后,daum 留在 tab 栏最左(SVG 真身),
 * 数字区由 PagePager 的同字体 DOM 按钮接替,左→右排开 1-9。
 * 全部为停靠常量,无跨尺度换算(PagePager 只做 flex 布局)。
 */
export const dockGeo = reactive({
  ready: false,
  left: 0, // 停靠后 SVG 视口 left,px
  top: 0, // 停靠后 SVG 视口 top,px
  w: 0, // 停靠后 SVG 宽,px
  h: 0, // 停靠后 SVG 高,px
  advance: 0, // 接替态槽宽(=字体数字步进),px
  slotLoose: 0, // 宽松态槽宽(advance + SLOT_GAP),px
  spacer: 0, // daum 区宽(SVG 左缘 → 数字 1 槽位左缘),px
  wCompact: 0, // 接替态胶囊宽(spacer + 5 紧凑槽 + padding),px
  wFull: 0, // 宽松态胶囊宽(spacer + 9 宽松槽 + padding),px
  digitH: 0, // 数字字形高,px(供 DOM 数字换算字号)
})

/** 品牌状态机:hero(在首屏) → flying → docked(tab 栏)
 *              → collapsing(收回先行) → flying → hero。Hero 写入 */
export const dockState = ref('hero')

/** 当前所在页(1-9),PagePager 的 IntersectionObserver 写入并自用于高亮 */
export const activePage = ref(1)
