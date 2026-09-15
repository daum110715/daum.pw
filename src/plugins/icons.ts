import { addIcon } from '@iconify/vue'
import { icons as simpleIcons } from '@iconify-json/simple-icons'
import { icons as lucide } from '@iconify-json/lucide'
import { icons as phosphor } from '@iconify-json/ph'

/**
 * Iconify JSON 包里单图标通常只包含 body，宽高写在集合顶层。
 * addIcon() 不会自动合并集合默认值，所以手动补上传给渲染器，
 * 否则 viewBox 会退化成 16x16，导致图标被裁切。
 */

// 品牌图标 (CC0-1.0)
addIcon('simple-icons:bilibili', {
  width: simpleIcons.width,
  height: simpleIcons.height,
  ...simpleIcons.icons.bilibili,
})
addIcon('simple-icons:github', {
  width: simpleIcons.width,
  height: simpleIcons.height,
  ...simpleIcons.icons.github,
})

// UI 图标
// lucide: ISC
addIcon('lucide:mail', {
  width: lucide.width,
  height: lucide.height,
  ...lucide.icons.mail,
})
addIcon('lucide:rotate-ccw', {
  width: lucide.width,
  height: lucide.height,
  ...lucide.icons['rotate-ccw'],
})

// phosphor: MIT, 更简约的线性图标
addIcon('ph:sun-thin', {
  width: phosphor.width,
  height: phosphor.height,
  ...phosphor.icons['sun-thin'],
})
addIcon('ph:moon-thin', {
  width: phosphor.width,
  height: phosphor.height,
  ...phosphor.icons['moon-thin'],
})
