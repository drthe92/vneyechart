import BinocularGameEngine from './binocular_game_engine.js';

class DivergenceTherapyGame extends BinocularGameEngine {
    constructor() {
        super();
        this.gameName = 'M6: Tập Phân Kỳ';
        this.state = 'PLAYING'; // PLAYING, RESTING, ENDED (LOBBY removed — UI managed by Controller)
        
        this.currentDiopter = 2;
        this.targetDiopter = 8;
        this.holdTimeMs = 10000; // Tăng từ 5000 lên 10000 (10 giây duy trì hợp thị)
        this.restTimeMs = 3000; // 3 giây nghỉ khi vỡ
        
        this.stateStartTime = 0;
        this.strikes = {}; // Theo dõi số lần vỡ tại mỗi mức lăng kính
        this.totalPlayTime = 0;
        this.gameStartTime = 0;

        this.barWidth = 60;
        this.barHeight = 150;
        
        this._spaceHandler = (e) => {
            if (e.code === 'Space' && this.state === 'PLAYING') this._handleBreak();
        };
    }

    start(config = {}) {
        super.start();
        window.addEventListener('keydown', this._spaceHandler);
        
        // Đọc cấu hình từ Menu Controller truyền vào, hoặc tự tìm trên DOM, hoặc dùng mặc định
        const domStart = document.getElementById('m6-start') || document.querySelector('[data-start-diopter]');
        const domTarget = document.getElementById('m6-target') || document.querySelector('[data-target-diopter]');
        
        this.currentDiopter = config.startDiopter || (domStart ? parseInt(domStart.value) : 2);
        this.targetDiopter = config.targetDiopter || (domTarget ? parseInt(domTarget.value) : 8);
        
        this.canvas.style.cursor = 'none';
        this.gameStartTime = Date.now();
        this._setState('PLAYING');
    }

    stop() {
        window.removeEventListener('keydown', this._spaceHandler);
        super.stop();
    }

    _setState(newState) {
        this.state = newState;
        this.stateStartTime = Date.now();
    }

    // --- 2. LOGIC QUÁ TẢI TIẾN TRIỂN ---
    _handleBreak() {
        if (!this.strikes[this.currentDiopter]) this.strikes[this.currentDiopter] = 0;
        this.strikes[this.currentDiopter]++;
        
        if (this.strikes[this.currentDiopter] >= 3) {
            this._endGame('THẤT BẠI (Vỡ hợp thị 3 lần liên tiếp)');
        } else {
            this._setState('RESTING');
        }
    }

    update() {
        if (this.state === 'ENDED') return;
        
        const elapsed = Date.now() - this.stateStartTime;

        if (this.state === 'PLAYING') {
            if (elapsed >= this.holdTimeMs) {
                // Vượt qua 5s thành công -> Tăng 2 Diop
                if (this.currentDiopter >= this.targetDiopter) {
                    this._endGame('THÀNH CÔNG (Đạt mục tiêu lâm sàng)');
                } else {
                    this.currentDiopter += 2;
                    this._setState('PLAYING'); // Reset timer
                }
            }
        } else if (this.state === 'RESTING') {
            if (elapsed >= this.restTimeMs) {
                // Nghỉ xong 3s -> Thử lại mức cũ
                this._setState('PLAYING');
            }
        }
    }

    // --- 3. ĐỒNG HỒ VÒNG TRÒN & QUANG HỌC ---
    _dioptersToPixels(diopters) {
        const distMeters = (this.calibration?.viewingDistanceCm || 40) / 100;
        const pixelsPerCm = (this.calibration?.pixelsPerMm || 3.78) * 10;
        const pixelsPerPrism = pixelsPerCm * distMeters; // 1 PD = 1cm at 1m
        return diopters * pixelsPerPrism;
    }

    render() {
        super.render(); // Nền trắng an toàn
        if (this.state === 'ENDED') return;

        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        // 1. Tính toán vị trí Lăng kính Phân kỳ (Base-In)
        // Mắt Trái (Cyan) dịch phải, Mắt Phải (Đỏ) dịch trái
        let visualDiopter = this.currentDiopter;
        if (this.state === 'RESTING') {
            // Khi nghỉ, giảm lăng kính đi 2 Diop để mắt thư giãn
            visualDiopter = Math.max(0, this.currentDiopter - 2); 
        }
        
        const splitPx = this._dioptersToPixels(visualDiopter) / 2;
        const leftBarX = cx + splitPx;  // Trái tiến sang Phải
        const rightBarX = cx - splitPx; // Phải tiến sang Trái

        // 2. Vẽ hai khối màu (Blend Mode)
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = this.colors.left || '#00FFFF'; // Cyan
        ctx.fillRect(leftBarX - this.barWidth/2, cy - this.barHeight/2, this.barWidth, this.barHeight);
        
        ctx.fillStyle = this.colors.right || '#FF0000'; // Red
        ctx.fillRect(rightBarX - this.barWidth/2, cy - this.barHeight/2, this.barWidth, this.barHeight);
        ctx.globalCompositeOperation = 'source-over';
        // 4. Tính toán thời gian còn lại
        const elapsed = Date.now() - this.stateStartTime;
        const totalTime = this.state === 'PLAYING' ? this.holdTimeMs : this.restTimeMs;
        const timeLeft = Math.max(0, Math.ceil((totalTime - elapsed) / 1000));

        // 5. Text HUD (Đưa đồng hồ đếm ngược ra vùng ngoại vi)
        ctx.fillStyle = '#000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`${this.currentDiopter} Δ`, 20, 30);
        
        ctx.font = '16px Arial';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`Mục tiêu: ${this.targetDiopter} Δ`, 20, 60);
        
        const currentStrikes = this.strikes[this.currentDiopter] || 0;
        ctx.fillStyle = currentStrikes > 0 ? '#ef4444' : '#64748b';
        ctx.fillText(`Lỗi: ${currentStrikes}/3`, 20, 90);

        // Đếm ngược thời gian
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = this.state === 'PLAYING' ? '#3b82f6' : '#f59e0b';
        ctx.fillText(this.state === 'PLAYING' ? `Duy trì: ${timeLeft}s` : `Nghỉ: ${timeLeft}s`, 20, 120);

        if (this.state === 'RESTING') {
            ctx.fillStyle = '#f59e0b';
            ctx.textAlign = 'center';
            ctx.fillText('ĐANG NGHỈ NGƠI...', cx, cy - 60);
        }
    }

    // --- 4. KẾT THÚC VÀ LƯU BỆNH ÁN ---
    _endGame(reason) {
        this.state = 'ENDED';
        this.totalPlayTime = Math.round((Date.now() - this.gameStartTime) / 1000);
        this.canvas.style.cursor = 'default';

        const customData = {
            maxDiopter: this.currentDiopter,
            targetDiopter: this.targetDiopter,
            totalStrikes: Object.values(this.strikes).reduce((a, b) => a + b, 0),
            status: reason
        };

        // Lưu hệ thống Therapy
        if (this.sessionMetrics) {
            this.sessionMetrics.customData = customData;
            this.sessionMetrics.durationSeconds = this.totalPlayTime;
            if (typeof this.finishSession === 'function') this.finishSession();
        }

        // Phát sự kiện Backup
        document.dispatchEvent(new CustomEvent('therapySessionCompleted', {
            detail: {
                gameName: this.gameName,
                durationSeconds: this.totalPlayTime,
                metrics: { customData }
            }
        }));

        // Trả về màn hình chính
        alert(`KẾT THÚC TẬP PHÂN KỲ\n\nKết quả: ${reason}\nMức tối đa: ${this.currentDiopter} Δ\nThời gian tập: ${this.totalPlayTime} giây`);
        if (typeof window.loadTest === 'function') window.loadTest('dashboard');
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { DivergenceTherapyGame };

export default DivergenceTherapyGame;
