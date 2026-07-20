import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { createReadStream, statSync } from 'node:fs'
import path from 'node:path'

// 相对 base:同时兼容自定义域(daum.pw 根)与项目页(daum110715.github.io/daum.pw/)两种 GitHub Pages 服务路径
// dev 下让 /legacy/ 可访问(vite 默认不 serve 项目根的 legacy/),供「旧版」按钮转场跳转;
// prod 靠 deploy.yml 的 rsync 把 legacy/ 放进 dist/legacy/,此插件仅 dev 生效。
function serveLegacyDev() {
  return {
    name: 'serve-legacy-dev',
    configureServer(server) {
      const root = fileURLToPath(new URL('./legacy', import.meta.url))
      const MIME = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
      }
      server.middlewares.use('/legacy', (req, res, next) => {
        let p = decodeURIComponent((req.url || '').split('?')[0])
        if (p === '' || p === '/') p = '/index.html'
        const file = path.join(root, p)
        if (!file.startsWith(root)) return next() // 防穿越
        try {
          if (!statSync(file).isFile()) return next()
        } catch {
          return next()
        }
        res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [vue(), serveLegacyDev()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
  },
})
