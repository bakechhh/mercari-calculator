// storage.js - ローカルストレージ管理
const Storage = {
    KEYS: {
        SALES: 'mercari_sales',
        MATERIALS: 'mercari_materials',
        SETTINGS: 'mercari_settings',
        THEME: 'mercari_theme'
    },

    // 売却データ
    getSales() {
        const data = localStorage.getItem(this.KEYS.SALES);
        return data ? JSON.parse(data) : [];
    },

    saveSale(sale) {
        const sales = this.getSales();
        sale.id = Date.now().toString();
        sale.date = new Date().toISOString();
        sales.unshift(sale);
        localStorage.setItem(this.KEYS.SALES, JSON.stringify(sales));
        return sale;
    },

    updateSale(id, updatedSale) {
        const sales = this.getSales();
        const index = sales.findIndex(s => s.id === id);
        if (index !== -1) {
            sales[index] = { ...sales[index], ...updatedSale };
            localStorage.setItem(this.KEYS.SALES, JSON.stringify(sales));
            return sales[index];
        }
        return null;
    },

    deleteSale(id) {
        const sales = this.getSales();
        const filtered = sales.filter(s => s.id !== id);
        localStorage.setItem(this.KEYS.SALES, JSON.stringify(filtered));
        return true;
    },

    // 材料データ
    getMaterials() {
        const data = localStorage.getItem(this.KEYS.MATERIALS);
        return data ? JSON.parse(data) : [];
    },

    saveMaterial(material) {
        const materials = this.getMaterials();
        material.id = Date.now().toString();
        materials.push(material);
        localStorage.setItem(this.KEYS.MATERIALS, JSON.stringify(materials));
        return material;
    },

    updateMaterial(id, updatedMaterial) {
        const materials = this.getMaterials();
        const index = materials.findIndex(m => m.id === id);
        if (index !== -1) {
            materials[index] = { ...materials[index], ...updatedMaterial };
            localStorage.setItem(this.KEYS.MATERIALS, JSON.stringify(materials));
            return materials[index];
        }
        return null;
    },

    deleteMaterial(id) {
        const materials = this.getMaterials();
        const filtered = materials.filter(m => m.id !== id);
        localStorage.setItem(this.KEYS.MATERIALS, JSON.stringify(filtered));
        return true;
    },

    // 設定
    getSettings() {
        const data = localStorage.getItem(this.KEYS.SETTINGS);
        return data ? JSON.parse(data) : {
            defaultCommissionRate: 10,
            currency: 'JPY'
        };
    },

    saveSettings(settings) {
        localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
        return settings;
    },

    // テーマ
    getTheme() {
        return localStorage.getItem(this.KEYS.THEME) || 'auto';
    },

    setTheme(theme) {
        localStorage.setItem(this.KEYS.THEME, theme);
        return theme;
    },

    // エクスポート/インポート
    exportData() {
        return {
            sales: this.getSales(),
            materials: this.getMaterials(),
            settings: this.getSettings(),
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
    },

    importData(data) {
        try {
            if (data.sales) {
                localStorage.setItem(this.KEYS.SALES, JSON.stringify(data.sales));
            }
            if (data.materials) {
                localStorage.setItem(this.KEYS.MATERIALS, JSON.stringify(data.materials));
            }
            if (data.settings) {
                localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(data.settings));
            }
            return true;
        } catch (error) {
            console.error('Import error:', error);
            return false;
        }
    },

    // データクリア
    clearAllData() {
        const theme = this.getTheme();
        localStorage.clear();
        this.setTheme(theme); // テーマ設定は保持
        return true;
    }
};
