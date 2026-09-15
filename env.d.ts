/// <reference types="vite/client" />

/** 视口矩形(左/上/宽/高):飞行/停靠/烘焙共用的最小几何 */
interface BoxRect {
  left: number
  top: number
  width: number
  height: number
}

interface Window {
  /* main.ts ↔ HeroSection.vue 的 boot 桥(历史兜底通道,见 CONTRIBUTING) */
  __finishBoot?: () => void
  __prepareBrandDockForBoot?: () => void
  __getBrandDockTarget?: () => BoxRect | null
  __syncBrandDockForBoot?: (opts?: { landTitle?: boolean }) => void
}
