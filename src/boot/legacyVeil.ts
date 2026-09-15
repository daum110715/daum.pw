/* ============================================================
 * 旧版回流到达幕布
 * index.html head 已在首帧前给 <html> 挂 data-from-legacy,
 * body::after 以 --bg 满幅遮盖。此处 boot 早期触发虹膜揭示:
 * mask 开孔自旧版「新版」按钮同轴位置放大,品牌描边在渐开的
 * 虹膜下显现——离场(旧版虹膜合拢遮盖)与到岸(新版虹膜开孔揭示)
 * 严格互逆,同一语言、同一节奏、同一轴线。
 * ============================================================ */
import { reduced } from './timing'

function openReturnVeil() {
  const root = document.documentElement
  if (root.getAttribute('data-from-legacy') !== '1') return
  if (root.classList.contains('return-veil-open')) return
  // 清 URL 参数,防刷新/分享重演转场
  try {
    history.replaceState(null, '', location.pathname + location.hash)
  } catch (e) {}
  root.classList.add('return-veil-open')
  window.setTimeout(() => {
    root.removeAttribute('data-from-legacy')
    root.classList.remove('return-veil-open')
  }, 1000)
}

/** app mount 后调用:reduced 直接揭盖;否则双 rAF 后开虹膜;bfcache 恢复补开 */
export function initLegacyVeil() {
  if (reduced) {
    document.documentElement.removeAttribute('data-from-legacy')
  } else {
    requestAnimationFrame(() => requestAnimationFrame(openReturnVeil))
  }

  // bfcache 恢复(浏览器后退):head 检测脚本不重跑,按会话标记补开虹膜
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted || reduced) return
    let flagged = false
    try {
      flagged = sessionStorage.getItem('daum-legacy-visit') === '1'
      sessionStorage.removeItem('daum-legacy-visit')
    } catch (err) {}
    if (!flagged) return
    document.documentElement.setAttribute('data-from-legacy', '1')
    requestAnimationFrame(() => requestAnimationFrame(openReturnVeil))
  })
}
