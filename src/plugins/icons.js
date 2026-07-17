import { addIcon } from '@iconify/vue'
import { icons as simpleIcons } from '@iconify-json/simple-icons'
import { icons as lucide } from '@iconify-json/lucide'
import { icons as phosphor } from '@iconify-json/ph'

// 品牌图标 (CC0-1.0)
addIcon('simple-icons:bilibili', simpleIcons.icons.bilibili)
addIcon('simple-icons:github', simpleIcons.icons.github)

// UI 图标
// lucide: ISC
addIcon('lucide:mail', lucide.icons.mail)
// phosphor: MIT,更简约的线性图标
addIcon('ph:sun-thin', phosphor.icons['sun-thin'])
addIcon('ph:moon-thin', phosphor.icons['moon-thin'])
