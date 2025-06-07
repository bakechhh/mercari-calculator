const UserSync = {
    supabase: null,
    userId: null,
    autoSyncEnabled: false,
    syncTimeout: null,
    lastSyncTime: null,
    syncQueue: [],
    isOnline: navigator.onLine,
    syncRetryCount: 0,
    maxRetries: 3,
    changeCount: 0,  // 変更カウンター
    lastDataHash: null,  // データのハッシュ値
    syncInterval: null,  // 定期同期のインターバル

    init() {
        // オンライン状態の監視
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processSyncQueue();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });

        // Service Workerからのメッセージ受信
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'SYNC_REQUIRED') {
                    this.syncToCloud();
                }
            });
        }

        // Supabaseが読み込まれているか確認
        if (!window.supabase) {
            console.error('Supabase not loaded');
            return;
        }
        
        // 環境変数が読み込まれているか確認
        if (!window.ENV || !window.ENV.SUPABASE_URL || !window.ENV.SUPABASE_ANON_KEY) {
            console.error('Environment variables not loaded');
            return;
        }
        
        // Supabase初期化
        const { createClient } = window.supabase;
        this.supabase = createClient(
            window.ENV.SUPABASE_URL,
            window.ENV.SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: false  // セッション管理を無効化（認証不要のため）
                },
                realtime: {
                    params: {
                        eventsPerSecond: 2
                    }
                }
            }
        );

        // ユーザーID取得または生成
        this.userId = this.getUserId();
        this.displayUserId();

        // 自動同期設定の復元（デフォルトでON）
        this.autoSyncEnabled = localStorage.getItem('auto_sync') !== 'false';
        const autoSyncToggle = document.getElementById('auto-sync-toggle');
        if (autoSyncToggle) {
            autoSyncToggle.checked = this.autoSyncEnabled;
        }

        // イベントリスナー設定
        this.setupEventListeners();

        // 初回同期
        if (this.autoSyncEnabled) {
            this.syncFromCloud().then(() => {
                // リアルタイム同期の設定
                this.setupRealtimeSync();
            });
        }

        // ページ終了時の同期
        window.addEventListener('beforeunload', () => {
            if (this.syncQueue.length > 0) {
                this.forceSyncToCloud();
            }
        });

        // 定期的な同期（30分ごと）
        setInterval(() => {
            if (this.autoSyncEnabled && this.isOnline) {
                this.syncToCloud();
            }
        }, 30 * 60 * 1000);
    },

    getUserId() {
        let userId = localStorage.getItem('user_id');
        if (!userId) {
            userId = this.generateUserId();
            localStorage.setItem('user_id', userId);
        }
        return userId;
    },

    generateUserId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = '';
        for (let i = 0; i < 6; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    },

    displayUserId() {
        const display = document.getElementById('user-id-display');
        const input = document.getElementById('current-user-id');
        
        if (display) display.textContent = `ID: ${this.userId}`;
        if (input) input.value = this.userId;
    },

    setupEventListeners() {
        // 同期ボタン
        const syncBtn = document.getElementById('sync-status-btn');
        const syncModal = document.getElementById('sync-modal');
        
        if (syncBtn && syncModal) {
            syncBtn.addEventListener('click', () => {
                syncModal.style.display = 'flex';
                this.updateSyncStatus();
            });
        }
        
        // データ変更の監視
        if (this.autoSyncEnabled) {
            this.enableDataWatchers();
        }
    },

    enableDataWatchers() {
        // Storage の各保存メソッドをラップ
        const methods = ['saveSale', 'updateSale', 'deleteSale', 'saveMaterial', 'updateMaterial', 'deleteMaterial', 'saveGoal', 'saveSettings'];
        
        methods.forEach(method => {
            const original = Storage[method];
            Storage[method] = (...args) => {
                const result = original.apply(Storage, args);
                this.scheduleSync();
                return result;
            };
        });
    },

    setupRealtimeSync() {
        // Realtimeは無効化（リクエスト削減のため）
        // 代わりに手動同期とタブ間通信を使用
        
        // タブ間通信でローカル同期
        window.addEventListener('storage', (e) => {
            if (e.key === 'sync_trigger' && e.newValue) {
                const trigger = JSON.parse(e.newValue);
                if (trigger.userId === this.userId && trigger.timestamp > Date.now() - 5000) {
                    this.refreshUI();
                }
            }
        });
    },

    scheduleSync() {
        if (!this.autoSyncEnabled) return;

        this.changeCount++;
        
        clearTimeout(this.syncTimeout);
        
        // 変更数に応じて同期タイミングを調整
        let delay;
        if (this.changeCount >= 10) {
            delay = 5000;  // 5秒後（大量変更時）
        } else if (this.changeCount >= 5) {
            delay = 15000; // 15秒後（中程度の変更）
        } else {
            delay = 30000; // 30秒後（少量の変更）
        }
        
        this.syncTimeout = setTimeout(() => {
            this.syncToCloud();
        }, delay);
    },

    async syncToCloud() {
        if (!this.isOnline) {
            this.addToSyncQueue('sync');
            return;
        }

        try {
            // データが変更されていない場合はスキップ
            const currentData = Storage.exportData();
            const currentHash = this.generateHash(JSON.stringify(currentData));
            
            if (currentHash === this.lastDataHash) {
                console.log('No changes detected, skipping sync');
                this.changeCount = 0;
                return;
            }

            this.updateSyncStatus('同期中...');
            const syncBtn = document.getElementById('sync-status-btn');
            if (syncBtn) syncBtn.classList.add('syncing');
            
            const timestamp = new Date().toISOString();
            
            const { error } = await this.supabase
                .from('user_data')
                .upsert({
                    user_id: this.userId,
                    data: currentData,
                    updated_at: timestamp,
                    device_id: this.getDeviceId(),
                    sync_version: (currentData.sync_version || 0) + 1
                }, {
                    onConflict: 'user_id'
                });
    
            if (error) throw error;
    
            this.lastSyncTime = new Date(timestamp);
            this.lastDataHash = currentHash;
            this.changeCount = 0;
            localStorage.setItem('last_sync', timestamp);
            localStorage.setItem('last_data_hash', currentHash);
            this.syncRetryCount = 0;
            this.updateSyncStatus('同期完了', true);
            
            // タブ間通信で他のタブに通知
            localStorage.setItem('sync_trigger', JSON.stringify({
                userId: this.userId,
                timestamp: Date.now()
            }));
            
            if (syncBtn) syncBtn.classList.remove('syncing');
            
            return true;
        } catch (error) {
            console.error('Sync error:', error);
            const syncBtn = document.getElementById('sync-status-btn');
            if (syncBtn) {
                syncBtn.classList.remove('syncing');
                syncBtn.classList.add('error');
            }
            
            // リトライ
            if (this.syncRetryCount < this.maxRetries) {
                this.syncRetryCount++;
                setTimeout(() => this.syncToCloud(), 2000 * this.syncRetryCount);
            } else {
                this.updateSyncStatus('同期エラー', false);
                this.syncRetryCount = 0;
            }
            
            throw error;
        }
    },

    async syncFromCloud() {
        try {
            this.updateSyncStatus('データ取得中...');

            const { data, error } = await this.supabase
                .from('user_data')
                .select('*')
                .eq('user_id', this.userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // データが存在しない場合は新規作成
                    await this.syncToCloud();
                    return;
                }
                throw error;
            }

            if (data && data.data) {
                // ローカルデータとマージ（競合解決）
                const localData = Storage.exportData();
                const mergedData = this.mergeData(localData, data.data);
                
                Storage.importData(mergedData);
                this.lastSyncTime = new Date(data.updated_at);
                this.updateSyncStatus('同期完了', true);
                
                // UIを更新
                this.refreshUI();
            }

            return true;
        } catch (error) {
            console.error('Sync error:', error);
            this.updateSyncStatus('同期エラー', false);
            throw error;
        }
    },

    mergeData(localData, remoteData) {
        // シンプルなマージ戦略：より新しいデータを優先
        const merged = { ...remoteData };
        
        // 売上データのマージ（IDベースで重複を避ける）
        if (localData.sales && remoteData.sales) {
            const salesMap = new Map();
            
            // リモートデータを先に追加
            remoteData.sales.forEach(sale => salesMap.set(sale.id, sale));
            
            // ローカルデータで上書き（より新しい場合）
            localData.sales.forEach(sale => {
                const existing = salesMap.get(sale.id);
                if (!existing || new Date(sale.date) > new Date(existing.date)) {
                    salesMap.set(sale.id, sale);
                }
            });
            
            merged.sales = Array.from(salesMap.values())
                .sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        
        // 材料データも同様にマージ
        if (localData.materials && remoteData.materials) {
            const materialsMap = new Map();
            remoteData.materials.forEach(m => materialsMap.set(m.id, m));
            localData.materials.forEach(m => materialsMap.set(m.id, m));
            merged.materials = Array.from(materialsMap.values());
        }
        
        // 目標データのマージ
        if (localData.goals && remoteData.goals) {
            merged.goals = { ...remoteData.goals, ...localData.goals };
        }
        
        return merged;
    },

    getDeviceId() {
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
            deviceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('device_id', deviceId);
        }
        return deviceId;
    },

    forceSyncToCloud() {
        // 同期的に送信（ページ終了時用）
        const data = Storage.exportData();
        const timestamp = new Date().toISOString();
        
        // Beacon APIを使用して確実に送信
        if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify({
                user_id: this.userId,
                data: data,
                updated_at: timestamp
            })], { type: 'application/json' });
            
            navigator.sendBeacon(
                `${window.ENV.SUPABASE_URL}/rest/v1/user_data?user_id=eq.${this.userId}`,
                blob
            );
        }
    },

    addToSyncQueue(action) {
        this.syncQueue.push({
            action,
            timestamp: new Date().toISOString(),
            data: Storage.exportData()
        });
        
        // オンラインになったら処理
        if (this.isOnline) {
            this.processSyncQueue();
        }
    },

    async processSyncQueue() {
        while (this.syncQueue.length > 0 && this.isOnline) {
            const item = this.syncQueue.shift();
            try {
                await this.syncToCloud();
            } catch (error) {
                // 失敗したら戻す
                this.syncQueue.unshift(item);
                break;
            }
        }
    },

    generateHash(str) {
        // 簡易的なハッシュ生成（変更検知用）
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    },

    toggleAutoSync(enabled) {
        this.autoSyncEnabled = enabled;
        localStorage.setItem('auto_sync', enabled ? 'true' : 'false');
        
        if (enabled) {
            this.enableDataWatchers();
            this.syncToCloud();
            // Realtimeは使用しない（リクエスト削減）
        }
    },

    async loginWithId() {
        const newId = document.getElementById('login-user-id').value.toUpperCase().trim();
        
        if (!newId || newId.length !== 6) {
            alert('6文字のIDを入力してください');
            return;
        }

        if (confirm(`ID: ${newId} でログインしますか？\n現在のデータは上書きされます。`)) {
            try {
                // 現在のデータをバックアップ
                const backup = Storage.exportData();
                localStorage.setItem('backup_data', JSON.stringify(backup));
                
                localStorage.setItem('user_id', newId);
                this.userId = newId;
                this.displayUserId();
                
                await this.syncFromCloud();
                
                alert('ログインしました！');
                this.closeModal();
                
                // Service Workerのキャッシュを更新
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'UPDATE_CACHE'
                    });
                }
                
                // ページをリロード
                location.reload();
            } catch (error) {
                alert('データの取得に失敗しました。IDを確認してください。');
                // バックアップから復元
                const backup = localStorage.getItem('backup_data');
                if (backup) {
                    Storage.importData(JSON.parse(backup));
                    localStorage.removeItem('backup_data');
                }
                // 元のIDに戻す
                this.userId = this.getUserId();
                this.displayUserId();
            }
        }
    },

    copyUserId() {
        const userId = document.getElementById('current-user-id').value;
        navigator.clipboard.writeText(userId).then(() => {
            this.showNotification('IDをコピーしました');
        });
    },

    manualSync() {
        this.syncToCloud().then(() => {
            this.showNotification('同期完了！');
        }).catch(() => {
            this.showNotification('同期に失敗しました', 'error');
        });
    },

    updateSyncStatus(status = '', success = null) {
        const statusText = document.getElementById('sync-status-text');
        const statusEl = document.getElementById('sync-status');
        const lastSyncEl = document.getElementById('last-sync-time');

        if (!statusText || !statusEl || !lastSyncEl) {
            console.error('Sync status elements not found');
            return;
        }
        
        if (status) {
            statusText.textContent = status;
        }
        
        if (success !== null) {
            statusEl.className = success ? 'sync-status success' : 'sync-status error';
        }
        
        if (this.lastSyncTime) {
            const timeAgo = this.getTimeAgo(this.lastSyncTime);
            lastSyncEl.textContent = `最終同期: ${timeAgo}`;
        }
    },

    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return '今';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}分前`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}時間前`;
        return `${Math.floor(seconds / 86400)}日前`;
    },

    refreshUI() {
        if (typeof History !== 'undefined') History.renderHistory();
        if (typeof Materials !== 'undefined') Materials.renderMaterialsList();
        if (typeof Calculator !== 'undefined') Calculator.updateMaterialSelects();
        if (typeof Goals !== 'undefined') Goals.render();
        if (typeof Calendar !== 'undefined') Calendar.render();
    },

    closeModal() {
        document.getElementById('sync-modal').style.display = 'none';
    },

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: ${type === 'error' ? 'var(--danger-color)' : 'var(--success-color)'};
            color: white;
            padding: 1rem 2rem;
            border-radius: var(--border-radius);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideUp 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideDown 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
};

// グローバルスコープに公開
window.UserSync = UserSync;