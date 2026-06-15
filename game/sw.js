const CACHE_NAME = 'game-collection-v3';

const urlsToCache = [
  './',
  './index.html',
  './styles/common.css',
  './scripts/theme.js',
  './scripts/confetti.js',
  './scripts/game-common.js',
  './icon.svg',
  './manifest.json',
  './games/2048/index.html',
  './games/2048/2048.css',
  './games/2048/2048.js',
  './games/minesweeper/index.html',
  './games/minesweeper/minesweeper.css',
  './games/minesweeper/minesweeper.js',
  './games/klondike/index.html',
  './games/klondike/klondike.css',
  './games/klondike/klondike.js',
  './games/freecell/index.html',
  './games/freecell/freecell.css',
  './games/freecell/freecell.js',
  './games/spider/index.html',
  './games/spider/spider.css',
  './games/spider/spider.js',
  './games/spider/solver-core.js',
  './games/spider/solver-worker.js',
  './games/sudoku/index.html',
  './games/sudoku/sudoku.css',
  './games/sudoku/sudoku.js',
  './games/snake/index.html',
  './games/snake/snake.css',
  './games/snake/snake.js',
  './games/tetris/index.html',
  './games/tetris/tetris.css',
  './games/tetris/tetris.js',
  './games/memory/index.html',
  './games/memory/memory.css',
  './games/memory/memory.js',
  './games/gomoku/index.html',
  './games/gomoku/gomoku.css',
  './games/gomoku/gomoku.js',
  './games/othello/index.html',
  './games/othello/othello.css',
  './games/othello/othello.js',
  './games/match3/index.html',
  './games/match3/match3.css',
  './games/match3/match3.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
