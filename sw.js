// sw.js - Service Worker for offline functionality
const CACHE_NAME = 'mercari-calc-v1';
const urlsToCache = [
    '/mercari-calculator/',
    '/mercari-calculator/index.html',
    '/mercari-calculator/css/style.css',
    '/mercari-calculator/js/app.js',
    '/mercari-calculator/js/storage.js',
    '/mercari-calculator/js/calculator.js',
    '/mercari-calculator/js/materials.js',
    '/mercari-calculator/js/history.js',
    '/mercari-calculator/js/export.js',
    '/mercari-calculator/js/goals.js',
    '/mercari-calculator/js/effects.js',
    '/mercari-calculator/manifest.json'
];

// インストール
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// フェッチ
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // キャッシュがあればそれを返す
                if (response) {
                    return response;
                }
                
                // なければネットワークから取得
                return fetch(event.request).then(response => {
                    // 正常なレスポンスでない場合はそのまま返す
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // レスポンスをクローンしてキャッシュに保存
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                });
            })
            .catch(() => {
                // オフライン時のフォールバック
                return caches.match('/index.html');
            })
    );
});

// アクティベート
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
