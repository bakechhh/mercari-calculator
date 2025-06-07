// sw.js - Service Worker with Network First strategy
const CACHE_NAME = 'mercari-calc-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/storage.js',
    '/js/calculator.js',
    '/js/materials.js',
    '/js/history.js',
    '/js/export.js',
    '/js/goals.js',
    '/js/effects.js',
    '/js/user-sync.js',
    '/js/calendar.js',
    '/js/env-config.js',
    '/manifest.json'
];

// 動的に変更される可能性のあるファイル（常にネットワークから取得）
const alwaysFetchUrls = [
    '/js/env-config.js',  // 環境変数
    '/index.html'         // HTMLは常に最新を取得
];

// インストール
self.addEventListener('install', event => {
    // 即座にアクティベート
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// アクティベート
self.addEventListener('activate', event => {
    // 即座にコントロールを取得
    event.waitUntil(
        clients.claim().then(() => {
            // 古いキャッシュを削除
            return caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            });
        })
    );
});

// フェッチ - Network First戦略
self.addEventListener('fetch', event => {
    // Supabase APIへのリクエストはキャッシュしない
    if (event.request.url.includes('supabase.co')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // 常にネットワークから取得すべきURLかチェック
    const shouldAlwaysFetch = alwaysFetchUrls.some(url => 
        event.request.url.endsWith(url)
    );

    if (shouldAlwaysFetch) {
        // Network Firstで、失敗時のみキャッシュを使用
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // 成功したらキャッシュを更新
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // ネットワークエラー時はキャッシュから
                    return caches.match(event.request);
                })
        );
    } else {
        // その他のリソースは Network First with Cache Fallback
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    
                    return response;
                })
                .catch(() => {
                    // オフライン時はキャッシュから
                    return caches.match(event.request);
                })
        );
    }
});

// バックグラウンド同期の登録
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

// データ同期関数
async function syncData() {
    try {
        const allClients = await clients.matchAll();
        for (const client of allClients) {
            client.postMessage({
                type: 'SYNC_REQUIRED'
            });
        }
    } catch (error) {
        console.error('Sync failed:', error);
    }
}

// 定期的なキャッシュ更新
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'UPDATE_CACHE') {
        event.waitUntil(
            caches.open(CACHE_NAME).then(cache => {
                return Promise.all(
                    urlsToCache.map(url => {
                        return fetch(url).then(response => {
                            if (response && response.status === 200) {
                                return cache.put(url, response);
                            }
                        }).catch(err => {
                            console.log('Failed to update cache for:', url);
                        });
                    })
                );
            })
        );
    }
});