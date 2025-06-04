const App = {
    deferredPrompt: null,

    init() {
        this.setupTheme();
        this.setupTabs();
        this.setupSettings();
        this.registerServiceWorker();
        this.setupPWA();
        
        // 各モジュールの初期化
        Calculator.init();
        History.init();
        Materials.init();
        Export.init();
        Goals.init();
        Calendar.init();
        
        // UserSyncの初期化を追加
        if (typeof UserSync !== 'undefined') {
            UserSync.init();
        } else {
            console.error('UserSync not loaded');
        }
        
        // アニメーション用CSS追加
        this.addAnimations();
    },

    setupTheme() {
        const savedTheme = Storage.getTheme();
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (savedTheme === 'auto' && prefersDark)) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        
        // テーマ切り替えボタン
        document.getElementById('theme-toggle').addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            Storage.setTheme(newTheme);
        });
    },

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                
                // ボタンのアクティブ状態を更新
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // タブコンテンツの表示を更新
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `${targetTab}-tab`) {
                        content.classList.add('active');
                    }
                });
                
                // 履歴タブが選択されたら更新
                if (targetTab === 'history') {
                    History.renderHistory();
                }
                
                // 目標タブが選択されたら更新
                if (targetTab === 'goals') {
                    Goals.render();
                }
                // カレンダータブが選択されたら更新
                if (targetTab === 'calendar') {
                    Calendar.render();
                }
            });
        });
    },

    setupSettings() {
        const defaultCommissionInput = document.getElementById('default-commission');
        const settings = Storage.getSettings();
        
        defaultCommissionInput.value = settings.defaultCommissionRate;
        
        defaultCommissionInput.addEventListener('change', () => {
            const newSettings = {
                ...settings,
                defaultCommissionRate: parseFloat(defaultCommissionInput.value)
            };
            Storage.saveSettings(newSettings);
            Calculator.loadDefaults();
        });
    },

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registered:', registration);
            } catch (error) {
                console.log('ServiceWorker registration failed:', error);
            }
        }
    },

    setupPWA() {
        const installButton = document.getElementById('install-pwa');
        
        // インストールプロンプトをキャッチ
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            installButton.style.display = 'block';
            installButton.classList.add('show');
        });
        
        // インストールボタンのクリック
        installButton.addEventListener('click', async () => {
            if (!this.deferredPrompt) return;
            
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            console.log(`User response: ${outcome}`);
            this.deferredPrompt = null;
            installButton.style.display = 'none';
        });
        
        // インストール完了
        window.addEventListener('appinstalled', () => {
            console.log('PWA installed');
            this.deferredPrompt = null;
        });
    },

    addAnimations() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideUp {
                from {
                    transform: translate(-50%, 100%);
                    opacity: 0;
                }
                to {
                    transform: translate(-50%, 0);
                    opacity: 1;
                }
            }
            
            @keyframes slideDown {
                from {
                    transform: translate(-50%, 0);
                    opacity: 1;
                }
                to {
                    transform: translate(-50%, 100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
};

// DOMContentLoaded後に初期化
document.addEventListener('DOMContentLoaded', () => {
    // Supabaseの読み込みを待つ
    const checkSupabase = setInterval(() => {
        if (window.supabase) {
            clearInterval(checkSupabase);
            App.init();
        }
    }, 100);
});
