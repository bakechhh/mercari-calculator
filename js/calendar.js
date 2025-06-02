// calendar.js - カレンダー機能
const Calendar = {
    currentYearMonth: '',
    
    init() {
        this.currentYearMonth = this.getCurrentYearMonth();
        this.setupEventListeners();
        this.render();
    },

    setupEventListeners() {
        // 月切り替え
        document.getElementById('cal-prev-month').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('cal-next-month').addEventListener('click', () => this.changeMonth(1));
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
        // 月表示を更新
        document.getElementById('cal-current-month').textContent = this.formatYearMonth(this.currentYearMonth);
        
        // カレンダーグリッドを生成
        this.renderCalendar();
        
        // サマリーを更新
        this.updateSummary();
    },

    renderCalendar() {
        const [year, month] = this.currentYearMonth.split('-').map(Number);
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        const prevLastDay = new Date(year, month - 1, 0);
        
        const firstDayOfWeek = firstDay.getDay();
        const lastDate = lastDay.getDate();
        const prevLastDate = prevLastDay.getDate();
        
        // 月の売上データを取得
        const monthSales = this.getMonthSalesData();
        
        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';
        
        // 前月の日付
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const day = prevLastDate - i;
            const dayElement = this.createDayElement(day, true, null);
            grid.appendChild(dayElement);
        }
        
        // 当月の日付
        for (let day = 1; day <= lastDate; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const daySales = monthSales[dateStr] || null;
            const dayElement = this.createDayElement(day, false, daySales);
            grid.appendChild(dayElement);
        }
        
        // 次月の日付
        const remainingDays = 42 - (firstDayOfWeek + lastDate);
        for (let day = 1; day <= remainingDays; day++) {
            const dayElement = this.createDayElement(day, true, null);
            grid.appendChild(dayElement);
        }
    },

    createDayElement(day, isOtherMonth, daySales) {
        const div = document.createElement('div');
        div.className = 'calendar-day';
        
        if (isOtherMonth) {
            div.classList.add('other-month');
        }
        
        if (daySales) {
            div.classList.add('has-sales');
            
            // 利益率が高い日は特別な色
            const avgProfitRate = daySales.totalProfit / daySales.totalSales * 100;
            if (avgProfitRate > 30) {
                div.classList.add('high-profit');
            }
            
            div.innerHTML = `
                <div class="day-number">${day}</div>
                <div class="day-sales">¥${daySales.totalSales.toLocaleString()}</div>
                <div class="day-count">${daySales.count}件</div>
            `;
            
            div.addEventListener('click', () => {
                this.showDayDetail(daySales.date, daySales.sales);
            });
        } else {
            div.innerHTML = `<div class="day-number">${day}</div>`;
        }
        
        return div;
    },

    getMonthSalesData() {
        const [year, month] = this.currentYearMonth.split('-').map(Number);
        const sales = Storage.getSales();
        const monthSales = {};
        
        sales.forEach(sale => {
            const saleDate = new Date(sale.date);
            if (saleDate.getFullYear() === year && saleDate.getMonth() + 1 === month) {
                const dateStr = saleDate.toISOString().split('T')[0];
                
                if (!monthSales[dateStr]) {
                    monthSales[dateStr] = {
                        date: dateStr,
                        sales: [],
                        totalSales: 0,
                        totalProfit: 0,
                        count: 0
                    };
                }
                
                monthSales[dateStr].sales.push(sale);
                monthSales[dateStr].totalSales += sale.sellingPrice;
                monthSales[dateStr].totalProfit += sale.netIncome;
                monthSales[dateStr].count++;
            }
        });
        
        return monthSales;
    },

    updateSummary() {
        const monthSales = this.getMonthSalesData();
        const salesDays = Object.keys(monthSales).length;
        
        let totalSales = 0;
        let bestDay = null;
        let bestDayAmount = 0;
        
        Object.entries(monthSales).forEach(([date, data]) => {
            totalSales += data.totalSales;
            if (data.totalSales > bestDayAmount) {
                bestDayAmount = data.totalSales;
                bestDay = date;
            }
        });
        
        const dailyAverage = salesDays > 0 ? Math.floor(totalSales / salesDays) : 0;
        
        // サマリー更新
        document.getElementById('cal-business-days').textContent = `${salesDays}日`;
        document.getElementById('cal-daily-average').textContent = `¥${dailyAverage.toLocaleString()}`;
        
        if (bestDay) {
            const date = new Date(bestDay);
            document.getElementById('cal-best-day').textContent = 
                `${date.getMonth() + 1}/${date.getDate()} (¥${bestDayAmount.toLocaleString()})`;
        } else {
            document.getElementById('cal-best-day').textContent = '-';
        }
    },

    showDayDetail(dateStr, sales) {
        const date = new Date(dateStr);
        const dateDisplay = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
        
        document.getElementById('day-detail-title').textContent = `${dateDisplay}の売上`;
        
        const listContainer = document.getElementById('day-sales-list');
        listContainer.innerHTML = '';
        
        let total = 0;
        
        sales.forEach(sale => {
            const div = document.createElement('div');
            div.className = 'day-detail-item';
            div.innerHTML = `
                <div class="day-detail-title">${sale.productName}</div>
                <div class="day-detail-info">
                    売上: ¥${sale.sellingPrice.toLocaleString()} / 
                    利益: ¥${sale.netIncome.toLocaleString()} 
                    (${sale.profitRate}%)
                </div>
            `;
            listContainer.appendChild(div);
            total += sale.sellingPrice;
        });
        
        document.getElementById('day-total-amount').textContent = `¥${total.toLocaleString()}`;
        document.getElementById('day-detail-modal').style.display = 'flex';
    },

    closeDayDetail() {
        document.getElementById('day-detail-modal').style.display = 'none';
    }
};

// グローバルスコープに公開
window.Calendar = Calendar;
