const UserSync = {
    supabase: null,
    userId: null,
    autoSyncEnabled: false,
    syncTimeout: null,
    lastSyncTime: null,

    init() {
        // Supabaseが読み込まれているか確認
        if (!window.supabase) {
            console.error('Supabase not loaded');
            return;
        }
        
        // Supabase初期化（修正版）
        const { createClient } = window.supabase;
        this.supabase = createClient(
            'https://xooaanwzbkxgoforivvp.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvb2Fhbnd6Ymt4Z29mb3JpdnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMzc1NTgsImV4cCI6MjA2NDYxMzU1OH0.TbOJMsOyNKMBXf1VFE9po7tTA_dwwiYBVoTO7V0BTxE' // ← ここに実際のキーを入れる
        );

        // ユーザーID取得または生成
        this.userId = this.getUserId();
        this.displayUserId();

        // 自動同期設定の復元
        this.autoSyncEnabled = localStorage.getItem('auto_sync') === 'true';
        const autoSyncToggle = document.getElementById('auto-sync-toggle');
        if (autoSyncToggle) {
            autoSyncToggle.checked = this.autoSyncEnabled;
        }

        // イベントリスナー設定
        this.setupEventListeners();

        // 初回同期
        if (this.autoSyncEnabled) {
            this.syncFromCloud();
        }
    },

    getUserId() {
        let userId = localStorage.getItem('user_id');
        if (!userId) {
            // 6文字のランダムID生成
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
        } else {
            console.error('Sync button or modal not found');
        }
        
        // データ変更の監視（自動同期用）
        if (this.autoSyncEnabled) {
            this.enableDataWatchers();
        }
    },

    enableDataWatchers() {
        // Storage の各保存メソッドをラップ
        const methods = ['saveSale', 'saveMaterial', 'saveGoal', 'saveSettings'];
        
        methods.forEach(method => {
            const original = Storage[method];
            Storage[method] = (...args) => {
                const result = original.apply(Storage, args);
                this.scheduleSync();
                return result;
            };
        });
    },

    scheduleSync() {
        if (!this.autoSyncEnabled) return;

        clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => {
            this.syncToCloud();
        }, 3000); // 3秒後に同期
    },

    async syncToCloud() {
        try {
            this.updateSyncStatus('同期中...');
            
            const data = Storage.exportData();
            
            const { error } = await this.supabase
                .from('user_data')
                .upsert({
                    user_id: this.userId,
                    data: data,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            this.lastSyncTime = new Date();
            localStorage.setItem('last_sync', this.lastSyncTime.toISOString());
            this.updateSyncStatus('同期完了', true);
            
            return true;
        } catch (error) {
            console.error('Sync error:', error);
            this.updateSyncStatus('同期エラー', false);
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
                Storage.importData(data.data);
                this.lastSyncTime = new Date(data.updated_at);
                this.updateSyncStatus('同期完了', true);
                
                // UIを更新
                if (typeof History !== 'undefined') History.renderHistory();
                if (typeof Materials !== 'undefined') Materials.renderMaterialsList();
                if (typeof Calculator !== 'undefined') Calculator.updateMaterialSelects();
                if (typeof Goals !== 'undefined') Goals.render();
            }

            return true;
        } catch (error) {
            console.error('Sync error:', error);
            this.updateSyncStatus('同期エラー', false);
            throw error;
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
                localStorage.setItem('user_id', newId);
                this.userId = newId;
                this.displayUserId();
                
                await this.syncFromCloud();
                
                alert('ログインしました！');
                this.closeModal();
                
                // ページをリロード
                location.reload();
            } catch (error) {
                alert('データの取得に失敗しました。IDを確認してください。');
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

    toggleAutoSync(enabled) {
        this.autoSyncEnabled = enabled;
        localStorage.setItem('auto_sync', enabled);
        
        if (enabled) {
            this.enableDataWatchers();
            this.syncToCloud();
        }
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
