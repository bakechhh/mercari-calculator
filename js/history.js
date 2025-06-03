// history.js - 履歴管理機能（編集機能付き）
const History = {
    currentFilter: 'all',
    searchQuery: '',

    init() {
        this.setupEventListeners();
        this.renderHistory();
    },

    setupEventListeners() {
        // 検索
        document.getElementById('history-search').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderHistory();
        });

        // フィルター
        document.getElementById('history-filter').addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.renderHistory();
        });
    },

    filterSales(sales) {
        let filtered = [...sales];
        
        // 期間フィルター
        const now = new Date();
        switch (this.currentFilter) {
            case 'week':
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                filtered = filtered.filter(s => new Date(s.date) >= weekAgo);
                break;
            case 'month':
                const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                filtered = filtered.filter(s => new Date(s.date) >= monthAgo);
                break;
            case 'year':
                const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                filtered = filtered.filter(s => new Date(s.date) >= yearAgo);
                break;
        }
        
        // 検索フィルター
        if (this.searchQuery) {
            filtered = filtered.filter(s => 
                s.productName.toLowerCase().includes(this.searchQuery) ||
                s.materials.some(m => m.name.toLowerCase().includes(this.searchQuery))
            );
        }
        
        return filtered;
    },

    calculateSummary(sales) {
        if (sales.length === 0) {
            return {
                totalSales: 0,
                totalProfit: 0,
                avgProfitRate: 0
            };
        }
        
        const totalSales = sales.reduce((sum, s) => sum + s.sellingPrice, 0);
        const totalProfit = sales.reduce((sum, s) => sum + s.netIncome, 0);
        const avgProfitRate = sales.reduce((sum, s) => sum + s.profitRate, 0) / sales.length;
        
        return {
            totalSales,
            totalProfit,
            avgProfitRate: avgProfitRate.toFixed(1)
        };
    },

    renderHistory() {
        const allSales = Storage.getSales();
        const filteredSales = this.filterSales(allSales);
        const summary = this.calculateSummary(filteredSales);
        
        // サマリー表示
        document.getElementById('total-sales').textContent = `¥${summary.totalSales.toLocaleString()}`;
        document.getElementById('total-profit').textContent = `¥${summary.totalProfit.toLocaleString()}`;
        document.getElementById('avg-profit-rate').textContent = `${summary.avgProfitRate}%`;
        
        // 履歴リスト表示
        const container = document.getElementById('history-list');
        
        if (filteredSales.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">履歴がありません</p>';
            return;
        }
        
        container.innerHTML = filteredSales.map(sale => {
            const date = new Date(sale.date);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
            
            return `
                <div class="history-item" onclick="History.showDetail('${sale.id}')">
                    <div class="history-item-header">
                        <div class="history-item-title">${sale.productName}</div>
                        <div class="history-item-date">${dateStr}</div>
                    </div>
                    <div class="history-item-details">
                        <div>売却: ¥${sale.sellingPrice.toLocaleString()}</div>
                        <div>材料費: ¥${sale.materialCost.toLocaleString()}</div>
                        <div>手数料: ${sale.commissionRate}%</div>
                        <div>送料: ¥${sale.shippingFee.toLocaleString()}</div>
                    </div>
                    <div class="history-item-profit">
                        利益: ¥${sale.netIncome.toLocaleString()} (${sale.profitRate}%)
                    </div>
                </div>
            `;
        }).join('');
    },

    showDetail(id) {
        const sale = Storage.getSales().find(s => s.id === id);
        if (!sale) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>${sale.productName}</h3>
                <div class="result-box">
                    <div class="result-item">
                        <span>売却価格：</span>
                        <span>¥${sale.sellingPrice.toLocaleString()}</span>
                    </div>
                    <div class="result-item">
                        <span>手数料 (${sale.commissionRate}%)：</span>
                        <span>-¥${sale.commission.toLocaleString()}</span>
                    </div>
                    <div class="result-item">
                        <span>材料費：</span>
                        <span>-¥${sale.materialCost.toLocaleString()}</span>
                    </div>
                    ${sale.materials.length > 0 ? `
                        <div style="margin-left: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
                            ${sale.materials.map(m => `
                                <div>${m.name}: ${m.quantity}${m.unit || '個'} × ¥${m.unitPrice} = ¥${m.totalPrice}</div>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="result-item">
                        <span>送料：</span>
                        <span>-¥${sale.shippingFee.toLocaleString()}</span>
                    </div>
                    ${sale.indirectCosts ? `
                        <div class="result-item">
                            <span>間接費用：</span>
                            <span>-¥${sale.indirectCosts.toLocaleString()}</span>
                        </div>
                    ` : ''}
                    <div class="result-item total">
                        <span>実質手取り：</span>
                        <span>¥${sale.netIncome.toLocaleString()}</span>
                    </div>
                    <div class="result-item">
                        <span>利益率：</span>
                        <span>${sale.profitRate}%</span>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="primary-btn" onclick="History.editSale('${sale.id}')">編集</button>
                    <button class="danger-btn" onclick="History.deleteSale('${sale.id}')">削除</button>
                    <button class="secondary-btn" onclick="History.closeDetail()">閉じる</button>
                </div>
            </div>
        `;
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                History.closeDetail();
            }
        });
        
        document.body.appendChild(modal);
    },

    editSale(id) {
        // モーダルを閉じる
        this.closeDetail();
        
        // 計算タブに切り替え
        document.querySelector('[data-tab="calculator"]').click();
        
        // 計算機に編集データを読み込む
        if (typeof Calculator !== 'undefined') {
            Calculator.loadSaleForEdit(id);
        }
    },

    closeDetail() {
        const modal = document.querySelector('.modal');
        if (modal) {
            modal.remove();
        }
    },

    deleteSale(id) {
        if (confirm('この履歴を削除しますか？')) {
            Storage.deleteSale(id);
            this.closeDetail();
            this.renderHistory();
            
            // 目標データも更新
            if (typeof Goals !== 'undefined') {
                Goals.render();
            }
        }
    }
};

// グローバルスコープに公開
window.History = History;
