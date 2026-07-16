const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3456;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DATA_FILES = new Set(['projects', 'timeline', 'signatures']);
const PUBLIC_FILES = new Set(['/index.html']);
const PUBLIC_DIRS = ['/assets/', '/css/', '/js/'];
const MAX_BODY_SIZE = 1024 * 1024;
const ADMIN_AUTH = process.env.ADMIN_AUTH || '';
const ADMIN_REALM = 'daum.pw admin';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function sendJSON(res, status, body) {
  send(res, status, JSON.stringify(body), MIME['.json']);
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function getDataFile(name) {
  if (!DATA_FILES.has(name)) return null;
  const filePath = path.resolve(DATA_DIR, `${name}.json`);
  return isInside(DATA_DIR, filePath) ? filePath : null;
}

function isPublicPath(pathname) {
  const normalized = pathname.replace(/\\/g, '/');
  return PUBLIC_FILES.has(normalized) || PUBLIC_DIRS.some(dir => normalized.startsWith(dir));
}

function requireAdminAuth(req, res) {
  if (!ADMIN_AUTH) return true;
  const header = req.headers['authorization'] || '';
  if (header.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
      if (decoded === ADMIN_AUTH) return true;
    } catch {}
  }
  res.writeHead(401, {
    'Content-Type': 'text/plain; charset=utf-8',
    'WWW-Authenticate': `Basic realm="${ADMIN_REALM}"`,
  });
  res.end('Unauthorized');
  return false;
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
  } catch {
    sendJSON(res, 400, { error: 'bad request url' });
    return;
  }

  const apiMatch = url.pathname.match(/^\/api\/data\/([a-z0-9_-]+)\.json$/i);
  if (apiMatch) {
    const filePath = getDataFile(apiMatch[1]);
    if (!filePath) {
      sendJSON(res, 404, { error: 'unknown data file' });
      return;
    }

    if (req.method === 'GET') {
      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        send(res, 200, data, MIME['.json']);
      } catch {
        send(res, 404, '[]', MIME['.json']);
      }
      return;
    }

    if (req.method === 'POST') {
      if (!requireAdminAuth(req, res)) return;
      const chunks = [];
      let received = 0;
      let tooLarge = false;

      req.on('data', chunk => {
        if (tooLarge) return;
        received += chunk.length;
        if (received > MAX_BODY_SIZE) {
          tooLarge = true;
          sendJSON(res, 413, { error: 'payload too large' });
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        if (tooLarge) return;
        try {
          const body = Buffer.concat(chunks).toString('utf-8');
          const parsed = JSON.parse(body);
          if (!Array.isArray(parsed)) throw new Error('expected array');
          fs.writeFileSync(filePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8');
          sendJSON(res, 200, { ok: true });
        } catch {
          sendJSON(res, 400, { error: 'invalid json' });
        }
      });
      return;
    }

    sendJSON(res, 405, { error: 'method not allowed' });
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    send(res, 400, 'Bad request');
    return;
  }

  pathname = pathname === '/' ? '/index.html' : pathname;
  if (!isPublicPath(pathname)) {
    send(res, 404, 'Not found');
    return;
  }

  const filePath = path.resolve(ROOT_DIR, `.${pathname}`);
  if (!isInside(ROOT_DIR, filePath)) {
    send(res, 403, 'Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) throw new Error('not a file');
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    send(res, 404, 'Not found');
  }
});

server.listen(PORT, () => console.log(`daum.pw dev server -> http://localhost:${PORT}`));
