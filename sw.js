// ================================================================
// 差益チェッカー Service Worker
// ================================================================
const CACHE_NAME = 'saiekichecker-v2';

// キャッシュするローカルファイル
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// ─── インストール: シェルファイルをキャッシュ ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_FILES).catch(() => {
        // アイコンが未生成でも続行
        return cache.addAll(['/', '/index.html', '/manifest.json']);
      });
    })
  );
  self.skipWaiting();
});

// ─── アクティベート: 古いキャッシュを削除 ─────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── フェッチ戦略 ─────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 外部CDN（Tesseract.js / jsQR / Frankfurter API）→ Network First
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // CDNスクリプトはキャッシュに保存してオフラインでも動くように
          if (res.ok && url.pathname.endsWith('.js')) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ローカルファイル → Cache First、なければNetwork、失敗したらindex.html
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      });
      return cached || networkFetch.catch(() => caches.match('/index.html'));
    })
  );
});
