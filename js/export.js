// export.js - エクスポート/インポート機能
const Export = {
    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        // JSONエクスポート
        document.getElementById('export-json').addEventListener('click', () => {
            this.exportJSON();
        });

        // JSONインポート
        document.getElementById('import-json').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });

        document.getElementById('import-file').addEventListener('change', (e) => {
            this.importJSON(e.target.files[0]);
        });

        // CSV出力
        document.getElementById('export-csv').addEventListener('click', () => {
            this.exportCSV();
        });

        // データクリア
        document.getElementById('clear-data').addEventListener('click', () => {
            this.clearAllData();
        });
    },

    exportJSON() {
        const data = Storage.exportData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `mercari_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('データをエクスポートしました');
    },

    async importJSON(file) {
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!data.version || !data.sales || !data.materials) {
                throw new Error('無効なバックアップファイルです');
            }
            
            if (confirm('現在のデータを上書きしてインポートしますか？')) {
                Storage.importData(data);
                
                // 画面を更新
                if (typeof History !== 'undefined') History.renderHistory();
                if (typeof Materials !== 'undefined') Materials.renderMaterialsList();
                if (typeof Calculator !== 'undefined') Calculator.updateMaterialSelects();
                
                this.showNotification('データをインポートしました');
            }
        } catch (error) {
            alert('インポートに失敗しました: ' + error.message);
        }
    },

    exportCSV() {
        const sales = Storage.getSales();
        
        if (sales.length === 0) {
            alert('エクスポートする履歴がありません');
            return;
        }
        
        // CSVヘッダー
        const headers = [
            '日付',
            '商品名',
            '売却価格',
            '手数料率(%)',
            '手数料',
            '材料費',
            '材料詳細',
            '送料',
            '間接費用',
            '実質手取り',
            '利益率(%)'
        ];
        
        // CSV行データ
        const rows = sales.map(sale => {
            const date = new Date(sale.date).toLocaleString('ja-JP');
            const materialDetails = sale.materials.map(m => 
                `${m.name}:${m.quantity}${m.unit || '個'}×¥${m.unitPrice}`
            ).join('、');
            
            return [
                date,
                sale.productName,
                sale.sellingPrice,
                sale.commissionRate,
                sale.commission,
                sale.materialCost,
                materialDetails,
                sale.shippingFee,
                sale.indirectCosts || 0,
                sale.netIncome,
                sale.profitRate
            ];
        });
        
        // BOM付きUTF-8でCSV作成
        const bom = '\uFEFF';
        const csvContent = bom + headers.join(',') + '\n' + 
            rows.map(row => row.map(cell => {
                // セル内にカンマや改行がある場合は引用符で囲む
                const cellStr = String(cell);
                if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
                    return '"' + cellStr.replace(/"/g, '""') + '"';
                }
                return cellStr;
            }).join(',')).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `mercari_history_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('CSVをエクスポートしました');
    },

    clearAllData() {
        if (confirm('すべてのデータを削除しますか？この操作は取り消せません。')) {
            if (confirm('本当に削除してもよろしいですか？')) {
                Storage.clearAllData();
                
                // 画面を更新
                if (typeof History !== 'undefined') History.renderHistory();
                if (typeof Materials !== 'undefined') Materials.renderMaterialsList();
                if (typeof Calculator !== 'undefined') {
                    Calculator.loadDefaults();
                    Calculator.updateMaterialSelects();
                }
                
                this.showNotification('すべてのデータを削除しました');
            }
        }
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
