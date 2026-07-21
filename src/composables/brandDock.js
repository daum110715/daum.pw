import { reactive, ref } from 'vue'

/**
 * 品牌字停靠几何(Hero 测量,PagePager 消费):
 * daum12569 整体为同一个 SVG 元素——飞入 tab 栏后 SVG 内数字路径
 * 自身摊开;PagePager 只提供点击热区(1/2/5/6/9 透明)与新补入的
 * 3/4/7/8 数字,左→右排开 1-9。全部为停靠常量。
 */
export const dockGeo = reactive({
  ready: false,
  left: 0, // 停靠后 SVG 视口 left,px
  top: 0, // 停靠后 SVG 视口 top,px
  w: 0, // 停靠后 SVG 宽,px
  h: 0, // 停靠后 SVG 高,px
  advance: 0, // 接替态槽宽(=字体数字步进),px
  gap: 0, // 宽松态每槽加宽量,px
  spacer: 0, // daum 区宽(SVG 左缘 → 数字 1 槽位左缘),px
  digitH: 0, // 数字字形高,px(供 DOM 数字换算字号)
})

/** 动画进度 0-1 = ScrollTrigger scrub progress(Hero 写入,PagePager 消费) */
export const flyP = ref(0)

/** 展开度 0-1:Hero 的独立展开/收回补间(到位弹开 back.out、回滚收回)
 *  写入,PagePager 消费同一值撑槽/补新数字——单一驱动,任意时刻不错位 */
export const flyEase = ref(0)

/** 当前所在页(1-9),PagePager 的 IntersectionObserver 写入并自用于高亮 */
export const activePage = ref(1)

/** 开屏 preloader 完成(main.js finishBoot 写入):preloader 透明底,
 *  非首页刷新时 tab 栏不加闸门会透过 preloader 抢跑 */
export const bootDone = ref(false)

/** 主题切换中:为 true 时 pin 段 snap 返回当前进度(不吸附端点)。
 *  color-scheme/滚动条换肤会触发布局重排 → ST snap 把滚轮拽到 0/1,
 *  中途飞行被瞬间钉死——ThemeToggle/useTheme 在换肤前后开关此锁 */
export const themeScrollLock = ref(false)
