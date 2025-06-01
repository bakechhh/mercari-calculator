// materials.js - 材料管理機能
const Materials = {
    currentEditId: null,

    init() {
        this.setupEventListeners();
        this.renderMaterialsList();
    },

    setupEventListeners() {
        // 新規材料追加ボタン
        document.getElementById('add-new-material').addEventListener('click', () => {
            this.showMaterialForm();
        });

        // 材料登録フォーム
        document.getElementById('material-register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveMaterial();
        });

        // 購入数量と総額から単価を計算
        ['material-purchase-quantity', 'material-purchase-price', 'material-shipping'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.calculateUnitPrice();
            });
        });

        // モーダル背景クリックで閉じる
        document.getElementById('material-form').addEventListener('click', (e) => {
            if (e.target.id === 'material-form') {
                this.closeMaterialForm();
            }
        });
    },

    showMaterialForm(material = null) {
        this.currentEditId = material ? material.id : null;
        const modal = document.getElementById('material-form');
        const form = document.getElementById('material-register-form');
        
        if (material) {
            document.getElementById('material-name').value = material.name || '';
            document.getElementById('material-category').value = material.category || '';
            document.getElementById('material-unit-price').value = material.unitPrice || '';
            document.getElementById('material-unit').value = material.unit || '個';
            document.getElementById('material-purchase-quantity').value = material.purchaseQuantity || '';
            document.getElementById('material-purchase-price').value = material.purchasePrice || '';
            document.getElementById('material-shipping').value = material.shippingFee || 0;
        } else {
            form.reset();
            document.getElementById('material-unit').value = '個';
        }
        
        modal.style.display = 'flex';
        this.calculateUnitPrice();
    },

    closeMaterialForm() {
        document.getElementById('material-form').style.display = 'none';
        document.getElementById('material-register-form').reset();
        this.currentEditId = null;
    },

    calculateUnitPrice() {
        const quantity = parseFloat(document.getElementById('material-purchase-quantity').value) || 0;
        const price = parseFloat(document.getElementById('material-purchase-price').value) || 0;
        const shipping = parseFloat(document.getElementById('material-shipping').value) || 0;
        const unit = document.getElementById('material-unit').value;
        
        if (quantity > 0 && price > 0) {
            const unitPrice = (price + shipping) / quantity;
            document.getElementById('calculated-unit-price').textContent = `¥${unitPrice.toFixed(2)}`;
            document.getElementById('calculated-unit').textContent = unit;
            document.getElementById('material-unit-price').value = unitPrice.toFixed(2);
        } else {
            const manualPrice = parseFloat(document.getElementById('material-unit-price').value) || 0;
            document.getElementById('calculated-unit-price').textContent = `¥${manualPrice.toFixed(2)}`;
            document.getElementById('calculated-unit').textContent = unit;
        }
    },

    saveMaterial() {
        const material = {
            name: document.getElementById('material-name').value,
            category: document.getElementById('material-category').value,
            unitPrice: parseFloat(document.getElementById('material-unit-price').value),
            unit: document.getElementById('material-unit').value,
            purchaseQuantity: parseFloat(document.getElementById('material-purchase-quantity').value) || null,
            purchasePrice: parseFloat(document.getElementById('material-purchase-price').value) || null,
            shippingFee: parseFloat(document.getElementById('material-shipping').value) || 0
        };

        if (this.currentEditId) {
            Storage.updateMaterial(this.currentEditId, material);
        } else {
            Storage.saveMaterial(material);
        }

        this.closeMaterialForm();
        this.renderMaterialsList();
        
        // 計算機の材料選択を更新
        if (typeof Calculator !== 'undefined') {
            Calculator.updateMaterialSelects();
        }
    },

    deleteMaterial(id) {
        if (confirm('この材料を削除しますか？')) {
            Storage.deleteMaterial(id);
            this.renderMaterialsList();
            
            // 計算機の材料選択を更新
            if (typeof Calculator !== 'undefined') {
                Calculator.updateMaterialSelects();
            }
        }
    },

    renderMaterialsList() {
        const materials = Storage.getMaterials();
        const container = document.getElementById('materials-list');
        
        if (materials.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">材料が登録されていません</p>';
            return;
        }
        
        // カテゴリー別にグループ化
        const grouped = materials.reduce((acc, material) => {
            const category = material.category || 'その他';
            if (!acc[category]) acc[category] = [];
            acc[category].push(material);
            return acc;
        }, {});
        
        container.innerHTML = Object.entries(grouped).map(([category, items]) => `
            <div class="material-category">
                <h3 style="margin: 1rem 0 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                    ${category}
                </h3>
                ${items.map(material => `
                    <div class="material-item">
                        <div class="material-info">
                            <h4>${material.name}</h4>
                            <div class="material-details">
                                単価: ¥${material.unitPrice.toFixed(2)} / ${material.unit}
                                ${material.purchaseQuantity ? `
                                    <br>購入情報: ${material.purchaseQuantity}${material.unit} × ¥${(material.purchasePrice + material.shippingFee).toFixed(0)}
                                ` : ''}
                            </div>
                        </div>
                        <div class="material-actions">
                            <button class="secondary-btn" onclick="Materials.showMaterialForm(${JSON.stringify(material).replace(/"/g, '&quot;')})">
                                編集
                            </button>
                            <button class="danger-btn" onclick="Materials.deleteMaterial('${material.id}')">
                                削除
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');
    }
};

// グローバルスコープに公開（onclickイベント用）
window.Materials = Materials;
window.closeMaterialForm = () => Materials.closeMaterialForm();
