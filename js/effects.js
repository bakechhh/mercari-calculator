const Effects = {
    confettiParticles: [],
    animationId: null,

    // 売上保存時の紙吹雪エフェクト
    showSaveEffect(amount) {
        // 金額ポップアップ
        this.showAmountPopup(amount);
        
        // 紙吹雪
        this.startConfetti(50);
        
        // 3秒後に停止
        setTimeout(() => this.stopConfetti(), 3000);
    },

    // 目標達成時の特別エフェクト
    showAchievementEffect() {
        // 達成バナー表示
        this.showAchievementBanner();
        
        // 豪華な紙吹雪
        this.startConfetti(150, true);
        
        // 5秒後に停止
        setTimeout(() => this.stopConfetti(), 5000);
    },

    // 金額ポップアップ
    showAmountPopup(amount) {
        const popup = document.createElement('div');
        popup.className = 'amount-popup';
        popup.textContent = `+¥${amount.toLocaleString()}`;
        
        // ランダムな位置に配置
        const x = Math.random() * (window.innerWidth - 200) + 100;
        popup.style.left = `${x}px`;
        popup.style.bottom = '100px';
        
        document.body.appendChild(popup);
        
        // アニメーション後に削除
        setTimeout(() => popup.remove(), 2000);
    },

    // 達成バナー
    showAchievementBanner() {
        const banner = document.createElement('div');
        banner.className = 'achievement-banner';
        banner.innerHTML = `
            <div class="achievement-content">
                <div class="achievement-icon">🎉</div>
                <div class="achievement-text">目標達成！</div>
                <div class="achievement-subtext">おめでとうございます！</div>
            </div>
        `;
        
        document.body.appendChild(banner);
        
        // 5秒後に削除
        setTimeout(() => {
            banner.classList.add('fade-out');
            setTimeout(() => banner.remove(), 500);
        }, 5000);
    },

    // 紙吹雪の開始
    startConfetti(particleCount = 100, isGolden = false) {
        const canvas = document.getElementById('confetti-canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.style.display = 'block';
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // パーティクル生成
        this.confettiParticles = [];
        const colors = isGolden ? 
            ['#FFD700', '#FFA500', '#FFD700', '#FFFF00', '#FFC700'] :
            ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
        
        for (let i = 0; i < particleCount; i++) {
            this.confettiParticles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                vx: Math.random() * 3 - 1.5,
                vy: Math.random() * 3 + 2,
                angle: Math.random() * 360,
                angularVelocity: Math.random() * 10 - 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 10 + 5,
                shape: Math.random() > 0.5 ? 'rect' : 'circle'
            });
        }
        
        this.animateConfetti(ctx);
    },

    // 紙吹雪アニメーション
    animateConfetti(ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        this.confettiParticles = this.confettiParticles.filter(particle => {
            // 更新
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.1; // 重力
            particle.angle += particle.angularVelocity;
            
            // 描画
            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.angle * Math.PI / 180);
            ctx.fillStyle = particle.color;
            
            if (particle.shape === 'rect') {
                ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.6);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
            
            // 画面外チェック
            return particle.y < ctx.canvas.height + 50;
        });
        
        if (this.confettiParticles.length > 0) {
            this.animationId = requestAnimationFrame(() => this.animateConfetti(ctx));
        } else {
            this.stopConfetti();
        }
    },

    // 紙吹雪停止
    stopConfetti() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        const canvas = document.getElementById('confetti-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
        
        this.confettiParticles = [];
    },

    // 記録更新エフェクト
    showNewRecordEffect(recordType) {
        const effect = document.createElement('div');
        effect.className = 'new-record-effect';
        effect.innerHTML = `
            <div class="new-record-content">
                <div class="new-record-stars">✨</div>
                <div class="new-record-text">NEW RECORD!</div>
                <div class="new-record-type">${recordType}</div>
            </div>
        `;
        
        document.body.appendChild(effect);
        
        // 3秒後に削除
        setTimeout(() => {
            effect.classList.add('fade-out');
            setTimeout(() => effect.remove(), 500);
        }, 3000);
    }
};

// グローバルスコープに公開
window.Effects = Effects;
