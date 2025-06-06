const Storage = {
    KEYS: {
        SALES: 'mercari_sales',
        MATERIALS: 'mercari_materials',
        SETTINGS: 'mercari_settings',
        THEME: 'mercari_theme',
        GOALS: 'mercari_goals',
        RECORDS: 'mercari_records'
    },

    // 売却データ
    getSales() {
        const data = localStorage.getItem(this.KEYS.SALES);
        return data ? JSON.parse(data) : [];
    },

    saveSale(sale) {
        const sales = this.getSales();
        sale.id = Date.now().toString();
        // dateが既に設定されていない場合のみ現在時刻を設定
        if (!sale.date) {
            sale.date = new Date().toISOString();
        }
        sales.unshift(sale);
        // 日付順にソート（新しい順）
        sales.sort((a, b) => new Date(b.date) - new Date(a.date));
        localStorage.setItem(this.KEYS.SALES, JSON.stringify(sales));
        return sale;
    },

    updateSale(id, updatedSale) {
        const sales = this.getSales();
        const index = sales.findIndex(s => s.id === id);
        if (index !== -1) {
            // 元のIDは保持し、日付は更新データに含まれていればそれを使用
            sales[index] = { 
                ...sales[index], 
                ...updatedSale,
                id: sales[index].id,
                date: updatedSale.date || sales[index].date
            };
            // 日付順にソート（新しい順）
            sales.sort((a, b) => new Date(b.date) - new Date(a.date));
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
            goals: this.getGoals(),
            records: this.getRecords(),
            exportDate: new Date().toISOString(),
            version: '1.1'
        };
    },

    importData(data) {
        try {
            if (data.sales) {
                // インポート時に日付順にソート
                data.sales.sort((a, b) => new Date(b.date) - new Date(a.date));
                localStorage.setItem(this.KEYS.SALES, JSON.stringify(data.sales));
            }
            if (data.materials) {
                localStorage.setItem(this.KEYS.MATERIALS, JSON.stringify(data.materials));
            }
            if (data.settings) {
                localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(data.settings));
            }
            if (data.goals) {
                localStorage.setItem(this.KEYS.GOALS, JSON.stringify(data.goals));
            }
            if (data.records) {
                localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(data.records));
            }
            return true;
        } catch (error) {
            console.error('Import error:', error);
            return false;
        }
    },

    // 目標データ
    getGoals() {
        const data = localStorage.getItem(this.KEYS.GOALS);
        return data ? JSON.parse(data) : {};
    },

    getGoal(yearMonth) {
        const goals = this.getGoals();
        return goals[yearMonth] || {
            yearMonth,
            targetAmount: 0,
            currentAmount: 0,
            salesCount: 0,
            achieved: false,
            achievedDate: null
        };
    },

    saveGoal(yearMonth, goal) {
        const goals = this.getGoals();
        goals[yearMonth] = { ...goals[yearMonth], ...goal, yearMonth };
        localStorage.setItem(this.KEYS.GOALS, JSON.stringify(goals));
        return goals[yearMonth];
    },

    // 記録データ
    getRecords() {
        const data = localStorage.getItem(this.KEYS.RECORDS);
        return data ? JSON.parse(data) : {
            maxMonthlySales: { amount: 0, yearMonth: null },
            maxMonthlySalesCount: { count: 0, yearMonth: null },
            maxAchievementRate: { rate: 0, yearMonth: null }
        };
    },

    updateRecords(records) {
        localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(records));
        return records;
    },

    // データクリア
    clearAllData() {
        const theme = this.getTheme();
        localStorage.clear();
        this.setTheme(theme); // テーマ設定は保持
        return true;
    }
};