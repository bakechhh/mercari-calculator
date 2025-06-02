// calculator.js - 計算機能
const Calculator = {
    init() {
        this.form = document.getElementById('calc-form');
        this.setupEventListeners();
        this.loadDefaults();
        this.addMaterialRow(); // 初期材料行
        this.updateMaterialSelects();
    },

    setupEventListeners() {
        // フォーム送信
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSale();
        });

        // リアルタイム計算
        ['selling-price', 'shipping-fee', 'indirect-costs', 'commission-rate'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.calculate());
        });

        // 材料追加ボタン
        document.getElementById('add-material-btn').addEventListener('click', () => {
            this.addMaterialRow();
        });

        // 材料入力の変更監視（イベント委譲）
        document.getElementById('material-inputs').addEventListener('input', (e) => {
            if (e.target.classList.contains('material-select') || 
                e.target.classList.contains('material-quantity') ||
                e.target.classList.contains('material-price')) {
                this.handleMaterialChange(e.target);
                this.calculate();
            }
        });

        // 材料削除ボタン（イベント委譲）
        document.getElementById('material-inputs').addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-material-btn')) {
                this.removeMaterialRow(e.target);
            }
        });
    },

    loadDefaults() {
        const settings = Storage.getSettings();
        document.getElementById('commission-rate').value = settings.defaultCommissionRate;
    },

    addMaterialRow() {
        const container = document.getElementById('material-inputs');
        const row = document.createElement('div');
        row.className = 'material-input-row';
        
        row.innerHTML = `
            <select class="material-select">
                <option value="">材料を選択</option>
                <option value="custom">直接入力</option>
            </select>
            <input type="number" class="material-quantity" placeholder="数量" min="0" step="0.01">
            <input type="number" class="material-price" placeholder="単価" min="0">
            <button type="button" class="remove-material-btn">×</button>
        `;
        
        container.appendChild(row);
        this.updateMaterialSelects();
    },

    removeMaterialRow(button) {
        const row = button.closest('.material-input-row');
        if (document.querySelectorAll('.material-input-row').length > 1) {
            row.remove();
            this.calculate();
        }
    },

    updateMaterialSelects() {
        const materials = Storage.getMaterials();
        const selects = document.querySelectorAll('.material-select');
        
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = `
                <option value="">材料を選択</option>
                <option value="custom">直接入力</option>
                ${materials.map(m => `
                    <option value="${m.id}" data-price="${m.unitPrice}" data-unit="${m.unit}">
                        ${m.name} (¥${m.unitPrice}/${m.unit})
                    </option>
                `).join('')}
            `;
            select.value = currentValue;
        });
    },

    handleMaterialChange(element) {
        const row = element.closest('.material-input-row');
        const select = row.querySelector('.material-select');
        const priceInput = row.querySelector('.material-price');
        
        if (element === select && select.value && select.value !== 'custom') {
            const option = select.querySelector(`option[value="${select.value}"]`);
            if (option) {
                priceInput.value = option.dataset.price;
            }
        }
    },

    calculate() {
        const sellingPrice = parseFloat(document.getElementById('selling-price').value) || 0;
        const shippingFee = parseFloat(document.getElementById('shipping-fee').value) || 0;
        const indirectCosts = parseFloat(document.getElementById('indirect-costs').value) || 0;
        const commissionRate = parseFloat(document.getElementById('commission-rate').value) || 0;
        
        // 材料費計算
        let materialCost = 0;
        document.querySelectorAll('.material-input-row').forEach(row => {
            const quantity = parseFloat(row.querySelector('.material-quantity').value) || 0;
            const price = parseFloat(row.querySelector('.material-price').value) || 0;
            materialCost += quantity * price;
        });
        
        // 手数料計算
        const commission = Math.floor(sellingPrice * (commissionRate / 100));
        
        // 実質手取り計算
        const totalCost = commission + materialCost + shippingFee + indirectCosts;
        const netIncome = sellingPrice - totalCost;
        
        // 利益率計算
        const profitRate = sellingPrice > 0 ? ((netIncome / sellingPrice) * 100).toFixed(1) : 0;
        
        // 結果表示
        document.getElementById('result-price').textContent = `¥${sellingPrice.toLocaleString()}`;
        document.getElementById('result-commission').textContent = `-¥${commission.toLocaleString()}`;
        document.getElementById('result-material').textContent = `-¥${materialCost.toLocaleString()}`;
        document.getElementById('result-shipping').textContent = `-¥${shippingFee.toLocaleString()}`;
        document.getElementById('result-indirect').textContent = `-¥${indirectCosts.toLocaleString()}`;
        document.getElementById('result-net').textContent = `¥${netIncome.toLocaleString()}`;
        document.getElementById('result-profit-rate').textContent = `${profitRate}%`;
        
        // 利益に応じて色を変更
        const netElement = document.getElementById('result-net');
        if (netIncome > 0) {
            netElement.style.color = 'var(--success-color)';
        } else if (netIncome < 0) {
            netElement.style.color = 'var(--danger-color)';
        } else {
            netElement.style.color = 'var(--text-primary)';
        }
    },

    getMaterialsData() {
        const materialsData = [];
        document.querySelectorAll('.material-input-row').forEach(row => {
            const select = row.querySelector('.material-select');
            const quantity = parseFloat(row.querySelector('.material-quantity').value) || 0;
            const unitPrice = parseFloat(row.querySelector('.material-price').value) || 0;
            
            if (select.value && quantity > 0) {
                const material = {
                    quantity,
                    unitPrice,
                    totalPrice: quantity * unitPrice
                };
                
                if (select.value === 'custom') {
                    material.name = '直接入力材料';
                    material.id = null;
                } else {
                    const option = select.querySelector(`option[value="${select.value}"]`);
                    material.id = select.value;
                    material.name = option.textContent.split(' (')[0];
                    material.unit = option.dataset.unit;
                }
                
                materialsData.push(material);
            }
        });
        return materialsData;
    },

    saveSale() {
        const productName = document.getElementById('product-name').value;
        const sellingPrice = parseFloat(document.getElementById('selling-price').value) || 0;
        const shippingFee = parseFloat(document.getElementById('shipping-fee').value) || 0;
        const indirectCosts = parseFloat(document.getElementById('indirect-costs').value) || 0;
        const commissionRate = parseFloat(document.getElementById('commission-rate').value) || 0;
        
        const materials = this.getMaterialsData();
        const materialCost = materials.reduce((sum, m) => sum + m.totalPrice, 0);
        const commission = Math.floor(sellingPrice * (commissionRate / 100));
        const totalCost = commission + materialCost + shippingFee + indirectCosts;
        const netIncome = sellingPrice - totalCost;
        const profitRate = sellingPrice > 0 ? ((netIncome / sellingPrice) * 100).toFixed(1) : 0;
        
        const sale = {
            productName,
            sellingPrice,
            materials,
            materialCost,
            shippingFee,
            indirectCosts,
            commissionRate,
            commission,
            netIncome,
            profitRate: parseFloat(profitRate)
        };
        
        Storage.saveSale(sale);
        
        // エフェクト表示
        if (typeof Effects !== 'undefined') {
            Effects.showSaveEffect(sale.sellingPrice);
        }
        
        // 目標データを更新
        if (typeof Goals !== 'undefined') {
            const currentYearMonth = new Date().toISOString().slice(0, 7);
            const goal = Storage.getGoal(currentYearMonth);
            const sales = Storage.getSales().filter(s => s.date.startsWith(currentYearMonth));
            goal.currentAmount = sales.reduce((sum, s) => sum + s.sellingPrice, 0);
            goal.salesCount = sales.length;
            Storage.saveGoal(currentYearMonth, goal);
        }
        
        // フォームリセット
        this.form.reset();
        this.loadDefaults();
        
        // 材料入力をリセット
        const container = document.getElementById('material-inputs');
        container.innerHTML = '';
        this.addMaterialRow();
        
        // 履歴タブに切り替え
        document.querySelector('[data-tab="history"]').click();
        
        // 成功メッセージ（簡易的な通知）
        this.showNotification('保存しました！');
    },

    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: var(--success-color);
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
