// goals.js - 目標管理機能
const Goals = {
    currentYearMonth: '',
    chart: null,

    init() {
        this.currentYearMonth = this.getCurrentYearMonth();
        this.setupEventListeners();
        this.render();
        this.initChart();
    },

    setupEventListeners() {
        // 月切り替え
        document.getElementById('prev-month').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('next-month').addEventListener('click', () => this.changeMonth(1));

        // 目標編集
        document.getElementById('edit-goal-btn').addEventListener('click', () => this.showGoalModal());
        document.getElementById('close-goal-modal').addEventListener('click', () => this.closeGoalModal());

        // 目標フォーム
        document.getElementById('goal-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveGoal();
        });

        // 提案ボタン
        document.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('goal-input').value = btn.dataset.amount;
            });
        });

        // モーダル背景クリック
        document.getElementById('goal-modal').addEventListener('click', (e) => {
            if (e.target.id === 'goal-modal') {
                this.closeGoalModal();
            }
        });
    },

    getCurrentYearMonth() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    },

    formatYearMonth(yearMonth) {
        const [year, month] = yearMonth.split('-');
        return `${year}年${parseInt(month)}月`;
    },

    changeMonth(direction) {
        const [year, month] = this.currentYearMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + direction, 1);
        this.currentYearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        this.render();
    },

    render() {
        // 現在の月を表示
        document.getElementById('current-month-display').textContent = this.formatYearMonth(this.currentYearMonth);

        // 目標データを取得
        const goal = Storage.getGoal(this.currentYearMonth);
        const sales = this.getMonthSales(this.currentYearMonth);
        
        // 現在の売上を計算
        goal.currentAmount = sales.reduce((sum, sale) => sum + sale.sellingPrice, 0);
        goal.salesCount = sales.length;

        // ここで現在の月のデータも保存！
        Storage.saveGoal(this.currentYearMonth, goal);

        // 達成率を計算
        const achievementRate = goal.targetAmount > 0 ? 
            Math.min((goal.currentAmount / goal.targetAmount) * 100, 999) : 0;

        // 目標金額表示
        document.getElementById('goal-amount-display').textContent = `¥${goal.targetAmount.toLocaleString()}`;
        
        // プログレスサークル更新
        this.updateProgressCircle(achievementRate);

        // 詳細情報更新
        document.getElementById('current-sales').textContent = `¥${goal.currentAmount.toLocaleString()}`;
        document.getElementById('remaining-amount').textContent = 
            goal.targetAmount > goal.currentAmount ? 
            `¥${(goal.targetAmount - goal.currentAmount).toLocaleString()}` : 
            '達成！';
        document.getElementById('sales-count').textContent = `${goal.salesCount}回`;

        // 達成チェックと記録更新
        this.checkAchievement(goal, achievementRate);
        this.updateRecords();

        // グラフ更新
        this.updateChart();

        // 前月実績を表示
        this.showLastMonthSales();
    },

    updateProgressCircle(percentage) {
        const circle = document.querySelector('.progress-fill');
        const text = document.querySelector('.progress-percentage');
        const container = document.querySelector('.progress-section');
        
        // 円周の計算
        const radius = 85;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;
        
        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = `${offset}`;
        
        // パーセンテージ表示（アニメーション）
        this.animateNumber(text, percentage, '%');
        
        // 達成率に応じて色を変更
        container.classList.remove('achievement-low', 'achievement-medium', 'achievement-high', 'achievement-complete');
        if (percentage >= 100) {
            container.classList.add('achievement-complete');
        } else if (percentage >= 70) {
            container.classList.add('achievement-high');
        } else if (percentage >= 30) {
            container.classList.add('achievement-medium');
        } else {
            container.classList.add('achievement-low');
        }
    },

    animateNumber(element, target, suffix = '') {
        const start = parseFloat(element.textContent) || 0;
        const duration = 1000;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // イージング関数
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = start + (target - start) * easeOutQuart;
            
            element.textContent = `${current.toFixed(target % 1 === 0 ? 0 : 1)}${suffix}`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    },

    getMonthSales(yearMonth) {
        const [year, month] = yearMonth.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);
        
        return Storage.getSales().filter(sale => {
            const saleDate = new Date(sale.date);
            return saleDate >= startDate && saleDate <= endDate;
        });
    },

    checkAchievement(goal, achievementRate) {
        if (goal.targetAmount > 0 && goal.currentAmount >= goal.targetAmount && !goal.achieved) {
            goal.achieved = true;
            goal.achievedDate = new Date().toISOString();
            Storage.saveGoal(this.currentYearMonth, goal);
            
            // 達成エフェクト
            if (typeof Effects !== 'undefined') {
                Effects.showAchievementEffect();
            }
        }
    },

    updateRecords() {
        const records = Storage.getRecords();
        const allGoals = Storage.getGoals();
        
        // 現在の月のデータも確実に含める
        const currentGoal = Storage.getGoal(this.currentYearMonth);
        allGoals[this.currentYearMonth] = currentGoal;
        
        let updated = false;

        // 全月の目標をチェック（現在月も含む）
        Object.values(allGoals).forEach(goal => {
            // 売上データを再計算して最新に
            if (goal.yearMonth) {
                const sales = this.getMonthSales(goal.yearMonth);
                goal.currentAmount = sales.reduce((sum, sale) => sum + sale.sellingPrice, 0);
                goal.salesCount = sales.length;
            }
            
            // 最高売上
            if (goal.currentAmount > 0 && goal.currentAmount > records.maxMonthlySales.amount) {
                records.maxMonthlySales = {
                    amount: goal.currentAmount,
                    yearMonth: goal.yearMonth
                };
                updated = true;
                
                // NEW RECORD エフェクト
                if (typeof Effects !== 'undefined' && goal.yearMonth === this.currentYearMonth) {
                    Effects.showNewRecordEffect('月間最高売上');
                }
            }

            // 最多販売回数
            if (goal.salesCount > 0 && goal.salesCount > records.maxMonthlySalesCount.count) {
                records.maxMonthlySalesCount = {
                    count: goal.salesCount,
                    yearMonth: goal.yearMonth
                };
                updated = true;
                
                // NEW RECORD エフェクト
                if (typeof Effects !== 'undefined' && goal.yearMonth === this.currentYearMonth) {
                    Effects.showNewRecordEffect('月間最多販売');
                }
            }

            // 最高達成率
            if (goal.targetAmount > 0) {
                const rate = (goal.currentAmount / goal.targetAmount) * 100;
                if (rate > records.maxAchievementRate.rate) {
                    records.maxAchievementRate = {
                        rate: Math.min(rate, 999),
                        yearMonth: goal.yearMonth
                    };
                    updated = true;
                    
                    // NEW RECORD エフェクト
                    if (typeof Effects !== 'undefined' && goal.yearMonth === this.currentYearMonth) {
                        Effects.showNewRecordEffect('最高達成率');
                    }
                }
            }
        });

        if (updated) {
            Storage.updateRecords(records);
        }

        // 記録表示を更新
        this.displayRecords(records);
    },

    displayRecords(records) {
        // 最高売上
        document.getElementById('max-sales').textContent = 
            `¥${records.maxMonthlySales.amount.toLocaleString()}`;
        document.getElementById('max-sales-date').textContent = 
            records.maxMonthlySales.yearMonth ? 
            this.formatYearMonth(records.maxMonthlySales.yearMonth) : '-';

        // 最多販売
        document.getElementById('max-count').textContent = 
            `${records.maxMonthlySalesCount.count}回`;
        document.getElementById('max-count-date').textContent = 
            records.maxMonthlySalesCount.yearMonth ? 
            this.formatYearMonth(records.maxMonthlySalesCount.yearMonth) : '-';

        // 最高達成率
        document.getElementById('max-rate').textContent = 
            `${records.maxAchievementRate.rate.toFixed(0)}%`;
        document.getElementById('max-rate-date').textContent = 
            records.maxAchievementRate.yearMonth ? 
            this.formatYearMonth(records.maxAchievementRate.yearMonth) : '-';
    },

    showGoalModal() {
        const modal = document.getElementById('goal-modal');
        const goal = Storage.getGoal(this.currentYearMonth);
        
        document.getElementById('goal-input').value = goal.targetAmount || '';
        modal.style.display = 'flex';
    },

    closeGoalModal() {
        document.getElementById('goal-modal').style.display = 'none';
    },

    saveGoal() {
        const amount = parseInt(document.getElementById('goal-input').value);
        
        if (amount >= 0) {
            const goal = Storage.getGoal(this.currentYearMonth);
            goal.targetAmount = amount;
            
            // 既に達成している場合はリセット
            if (goal.currentAmount < amount) {
                goal.achieved = false;
                goal.achievedDate = null;
            }
            
            Storage.saveGoal(this.currentYearMonth, goal);
            this.closeGoalModal();
            this.render();
        }
    },

    showLastMonthSales() {
        const [year, month] = this.currentYearMonth.split('-').map(Number);
        const lastMonth = new Date(year, month - 2, 1);
        const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
        
        const lastMonthGoal = Storage.getGoal(lastMonthKey);
        const lastMonthSales = this.getMonthSales(lastMonthKey);
        const lastMonthAmount = lastMonthSales.reduce((sum, sale) => sum + sale.sellingPrice, 0);
        
        document.getElementById('last-month-sales').textContent = `¥${lastMonthAmount.toLocaleString()}`;
    },

    initChart() {
        const canvas = document.getElementById('sales-chart');
        const ctx = canvas.getContext('2d');
        
        // 親要素のサイズを取得
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Canvasの表示サイズを設定
        canvas.style.width = '100%';
        canvas.style.height = '200px';
        
        // 実際の描画サイズを設定（高解像度対応）
        const scale = window.devicePixelRatio || 1;
        canvas.width = rect.width * scale;
        canvas.height = 200 * scale;
        ctx.scale(scale, scale);
    },

    updateChart() {
        const canvas = document.getElementById('sales-chart');
        const ctx = canvas.getContext('2d');
        
        // Canvas のサイズを再設定
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const scale = window.devicePixelRatio || 1;
        
        canvas.width = rect.width * scale;
        canvas.height = 200 * scale;
        ctx.scale(scale, scale);
        
        const width = rect.width;
        const height = 200;
        
        // クリア
        ctx.clearRect(0, 0, width, height);
        
        // 過去6ヶ月のデータを取得
        const monthsData = [];
        const [currentYear, currentMonth] = this.currentYearMonth.split('-').map(Number);
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - 1 - i, 1);
            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const sales = this.getMonthSales(yearMonth);
            const amount = sales.reduce((sum, sale) => sum + sale.sellingPrice, 0);
            const goal = Storage.getGoal(yearMonth);
            
            monthsData.push({
                month: `${date.getMonth() + 1}月`,
                amount,
                target: goal.targetAmount || 0
            });
        }
        
        // グラフ描画
        const margin = { top: 20, right: 20, bottom: 30, left: 50 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        
        // 最大値を計算
        const maxValue = Math.max(
            ...monthsData.map(d => Math.max(d.amount, d.target)),
            10000
        );
        
        // スケール
        const xScale = chartWidth / monthsData.length;
        const yScale = chartHeight / maxValue;
        
        // グリッド線
        ctx.strokeStyle = 'rgba(128, 128, 128, 0.2)';
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= 5; i++) {
            const y = margin.top + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(width - margin.right, y);
            ctx.stroke();
        }
        
        // 棒グラフ（売上）
        monthsData.forEach((data, index) => {
            const x = margin.left + xScale * index + xScale * 0.25;
            const barWidth = xScale * 0.5;
            const barHeight = data.amount * yScale;
            const y = margin.top + chartHeight - barHeight;
            
            // グラデーション
            const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
            gradient.addColorStop(0, '#ff0211');
            gradient.addColorStop(1, '#ff4444');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // 目標線
            if (data.target > 0) {
                const targetY = margin.top + chartHeight - (data.target * yScale);
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(x - 5, targetY);
                ctx.lineTo(x + barWidth + 5, targetY);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            
            // ラベル
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(data.month, x + barWidth / 2, height - 5);
        });
    }
};

// グローバルスコープに公開
window.Goals = Goals;
