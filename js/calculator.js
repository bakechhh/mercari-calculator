// calculator.js - 計算機能（編集機能付き）
const Calculator = {
    editingId: null, // 編集中のID

    init() {
        this.form = document.getElementById('calc-form');
        this.setupEventListeners();
        this.setupOCR(); // この行を追加
        this.loadDefaults();
        this.addMaterialRow(); // 初期材料行
        this.updateMaterialSelects();
    },

    setupEventListeners() {
        // フォーム送信
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.editingId) {
                this.updateSale();
            } else {
                this.saveSale();
            }
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

    setupOCR() {
        const ocrBtn = document.getElementById('ocr-scan-btn');
        const fileInput = document.getElementById('ocr-file-input');
        
        if (!ocrBtn || !fileInput) return; // 要素が存在しない場合は終了
        
        ocrBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // ローディング表示
            const loadingDiv = document.getElementById('ocr-loading');
            if (loadingDiv) loadingDiv.style.display = 'block';
            ocrBtn.disabled = true;
            
            try {
                const result = await this.processOCR(file);
                
                if (result.productName) {
                    document.getElementById('product-name').value = result.productName;
                }
                
                if (result.sellingPrice) {
                    document.getElementById('selling-price').value = result.sellingPrice;
                    this.calculate(); // 自動計算実行
                }
                
                // 成功通知
                this.showNotification(
                    result.productName && result.sellingPrice ? 
                    '読み込み完了！' : 
                    '一部の項目を読み込みました'
                );
                
            } catch (error) {
                console.error('OCR Error:', error);
                this.showNotification('読み込みに失敗しました', 'error');
            } finally {
                if (loadingDiv) loadingDiv.style.display = 'none';
                ocrBtn.disabled = false;
                fileInput.value = ''; // ファイル選択をリセット
            }
        });
    },
    
    async processOCR(file) {
        // 画像を前処理
        const processedImage = await this.preprocessImage(file);
        
        // Tesseract.jsでOCR実行
        const worker = await Tesseract.createWorker({
            logger: m => console.log(m)
        });
        
        await worker.loadLanguage('jpn');
        await worker.initialize('jpn');
        
        const { data: { text } } = await worker.recognize(processedImage);
        await worker.terminate();
        
        // テキストから情報を抽出
        return this.extractInfo(text);
    },
    
    async preprocessImage(file) {
        return new Promise((resolve) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            img.onload = () => {
                // キャンバスサイズ設定（大きすぎる画像は縮小）
                const maxWidth = 1200;
                const scale = img.width > maxWidth ? maxWidth / img.width : 1;
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                
                // 画像描画
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // コントラスト強調
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                for (let i = 0; i < data.length; i += 4) {
                    // グレースケール化
                    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                    
                    // コントラスト強調
                    const enhanced = (gray - 128) * 1.5 + 128;
                    
                    data[i] = enhanced;
                    data[i + 1] = enhanced;
                    data[i + 2] = enhanced;
                }
                
                ctx.putImageData(imageData, 0, 0);
                canvas.toBlob(resolve, 'image/png');
            };
            
            img.src = URL.createObjectURL(file);
        });
    },
    
    extractInfo(text) {
        const result = {
            productName: '',
            sellingPrice: 0
        };
        
        // テキストを行に分割
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        
        // 商品名の抽出（取引画面の最初の行または「取引画面」の次の行）
        const titleIndex = lines.findIndex(line => line.includes('取引画面'));
        if (titleIndex !== -1 && titleIndex < lines.length - 1) {
            // 「取引画面」の次の行を商品名とする
            result.productName = lines[titleIndex + 1];
        } else {
            // 最初の実質的な行を商品名とする（短すぎる行は除外）
            const productLine = lines.find(line => line.length > 5 && !line.includes('¥'));
            if (productLine) {
                result.productName = productLine;
            }
        }
        
        // 商品代金の抽出
        const pricePattern = /商品代金[:\s]*¥([0-9,]+)/;
        const priceMatch = text.match(pricePattern);
        
        if (priceMatch) {
            result.sellingPrice = parseInt(priceMatch[1].replace(/,/g, ''));
        } else {
            // 「商品代金」というテキストが見つからない場合、¥マークの後の数字を探す
            const yenPattern = /¥([0-9,]+)/g;
            const yenMatches = [...text.matchAll(yenPattern)];
            
            // 最初に見つかった金額を商品代金とする（通常最も大きい金額）
            if (yenMatches.length > 0) {
                result.sellingPrice = parseInt(yenMatches[0][1].replace(/,/g, ''));
            }
        }
        
        return result;
    },

    loadDefaults() {
        const settings = Storage.getSettings();
        document.getElementById('commission-rate').value = settings.defaultCommissionRate;
    },

    addMaterialRow() {
        // 既存の直接入力欄をすべて非表示にする
        document.querySelectorAll('.material-input-row').forEach(row => {
            const select = row.querySelector('.material-select');
            if (select.value !== 'custom') {
                this.hideCustomMaterialInput(row);
            }
        });
        
        const container = document.getElementById('material-inputs');
        const row = document.createElement('div');
        row.className = 'material-input-row';
        
        row.innerHTML = `
            <select class="material-select">
                <option value="">材料を選択</option>
                <option value="custom">直接入力</option>
            </select>
            <input type="number" class="material-quantity" placeholder="数量" min="0" step="0.01">
            <input type="number" class="material-price" placeholder="単価" min="0" step="0.01">
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
        
        if (element === select) {
            if (select.value === 'custom') {
                // 直接入力の場合、材料名入力欄を表示
                this.showCustomMaterialInput(row);
                priceInput.value = ''; // 単価をクリア
            } else if (select.value && select.value !== '') {
                // 既存材料の場合
                this.hideCustomMaterialInput(row);
                const option = select.querySelector(`option[value="${select.value}"]`);
                if (option) {
                    priceInput.value = option.dataset.price;
                }
            } else {
                // 未選択の場合
                this.hideCustomMaterialInput(row);
                priceInput.value = '';
            }
        }
    },

    showCustomMaterialInput(row) {
        // 既存のカスタム入力欄があれば削除
        const existingInput = row.querySelector('.custom-material-input');
        if (existingInput) return;
        
        // カスタム材料名入力欄を追加
        const customInput = document.createElement('input');
        customInput.type = 'text';
        customInput.className = 'custom-material-input';
        customInput.placeholder = '材料名を入力';
        customInput.required = true;
        
        // selectの後に挿入
        const select = row.querySelector('.material-select');
        select.parentNode.insertBefore(customInput, select.nextSibling);
    },

    hideCustomMaterialInput(row) {
        const customInput = row.querySelector('.custom-material-input');
        if (customInput) {
            customInput.remove();
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
                    // カスタム材料名入力欄から名前を取得
                    const customInput = row.querySelector('.custom-material-input');
                    material.name = customInput ? customInput.value : '直接入力材料';
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

    // 編集用データ読み込み
    loadSaleForEdit(id) {
        const sale = Storage.getSales().find(s => s.id === id);
        if (!sale) return;

        this.editingId = id;
        
        // フォームにデータを設定
        document.getElementById('product-name').value = sale.productName;
        document.getElementById('selling-price').value = sale.sellingPrice;
        document.getElementById('shipping-fee').value = sale.shippingFee;
        document.getElementById('indirect-costs').value = sale.indirectCosts || 0;
        document.getElementById('commission-rate').value = sale.commissionRate;

        // 材料データを読み込み
        this.loadMaterialsData(sale.materials);
        
        // ボタンテキストを変更
        const submitBtn = this.form.querySelector('button[type="submit"]');
        submitBtn.textContent = '更新';
        submitBtn.className = 'primary-btn';
        
        // キャンセルボタンを追加
        this.addCancelButton();
        
        // 計算実行
        this.calculate();
    },

    loadMaterialsData(materials) {
        const container = document.getElementById('material-inputs');
        container.innerHTML = '';
        
        if (materials.length === 0) {
            this.addMaterialRow();
            return;
        }
        
        materials.forEach(material => {
            const row = document.createElement('div');
            row.className = 'material-input-row';
            
            row.innerHTML = `
                <select class="material-select">
                    <option value="">材料を選択</option>
                    <option value="custom">直接入力</option>
                </select>
                <input type="number" class="material-quantity" placeholder="数量" min="0" step="0.01" value="${material.quantity}">
                <input type="number" class="material-price" placeholder="単価" min="0" step="0.01" value="${material.unitPrice}">
                <button type="button" class="remove-material-btn">×</button>
            `;
            
            container.appendChild(row);
        });
        
        // 材料選択肢を更新
        this.updateMaterialSelects();
        
        // 材料データを設定
        const rows = container.querySelectorAll('.material-input-row');
        materials.forEach((material, index) => {
            const row = rows[index];
            const select = row.querySelector('.material-select');
            
            if (material.id) {
                // 登録済み材料
                select.value = material.id;
            } else {
                // 直接入力材料
                select.value = 'custom';
                this.showCustomMaterialInput(row);
                const customInput = row.querySelector('.custom-material-input');
                if (customInput) {
                    customInput.value = material.name;
                }
            }
        });
    },

    addCancelButton() {
        // 既存のキャンセルボタンがあれば削除
        const existingCancel = document.getElementById('cancel-edit-btn');
        if (existingCancel) {
            existingCancel.remove();
        }
        
        const submitBtn = this.form.querySelector('button[type="submit"]');
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.id = 'cancel-edit-btn';
        cancelBtn.className = 'secondary-btn';
        cancelBtn.textContent = 'キャンセル';
        cancelBtn.style.marginTop = '0.5rem';
        
        cancelBtn.addEventListener('click', () => {
            this.cancelEdit();
        });
        
        submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
    },

    cancelEdit() {
        this.editingId = null;
        
        // フォームリセット
        this.form.reset();
        this.loadDefaults();
        
        // 材料入力をリセット
        const container = document.getElementById('material-inputs');
        container.innerHTML = '';
        this.addMaterialRow();
        
        // ボタンを元に戻す
        const submitBtn = this.form.querySelector('button[type="submit"]');
        submitBtn.textContent = '保存';
        
        const cancelBtn = document.getElementById('cancel-edit-btn');
        if (cancelBtn) {
            cancelBtn.remove();
        }
        
        this.calculate();
    },

    updateSale() {
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
        
        const updatedSale = {
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
        
        Storage.updateSale(this.editingId, updatedSale);
        
        // 編集モードを終了
        this.editingId = null;
        
        // フォームリセット
        this.form.reset();
        this.loadDefaults();
        
        // 材料入力をリセット
        const container = document.getElementById('material-inputs');
        container.innerHTML = '';
        this.addMaterialRow();
        
        // ボタンを元に戻す
        const submitBtn = this.form.querySelector('button[type="submit"]');
        submitBtn.textContent = '保存';
        
        const cancelBtn = document.getElementById('cancel-edit-btn');
        if (cancelBtn) {
            cancelBtn.remove();
        }
        
        // 履歴タブに切り替え
        document.querySelector('[data-tab="history"]').click();
        
        // 目標データも更新
        if (typeof Goals !== 'undefined') {
            Goals.render();
        }
        
        // 成功メッセージ
        this.showNotification('更新しました！');
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
            
            // 売上データを再取得して正確に計算
            const allSales = Storage.getSales();
            const monthSales = allSales.filter(s => s.date.startsWith(currentYearMonth));
            
            goal.currentAmount = monthSales.reduce((sum, s) => sum + s.sellingPrice, 0);
            goal.salesCount = monthSales.length;
            
            Storage.saveGoal(currentYearMonth, goal);
            
            // 記録も即座に更新
            Goals.updateRecords();
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
