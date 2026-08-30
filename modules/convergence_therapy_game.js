import BinocularGameEngine from './binocular_game_engine.js';

class ConvergenceTherapyGame extends BinocularGameEngine {
    constructor() {
        super();
        this.gameName = 'M13: Tập Hội Tụ';
        this.state = 'PLAYING'; // PLAYING, RESTING, ENDED (LOBBY removed — UI managed by Controller)
        
        this.currentDiopter = 3;
        this.targetDiopter = 15;
        this.holdTimeMs = 10000; // 10 giây duy trì hợp thị
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
        const domStart = document.getElementById('m13-start') || document.querySelector('[data-start-diopter]');
        const domTarget = document.getElementById('m13-target') || document.querySelector('[data-target-diopter]');
        
        this.currentDiopter = config.startDiopter || (domStart ? parseInt(domStart.value) : 3);
        this.targetDiopter = config.targetDiopter || (domTarget ? parseInt(domTarget.value) : 15);
        
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
                // Vượt qua 10s thành công -> Tăng 2 Diop
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

        // 1. Tính toán vị trí Lăng kính Hội tụ (Base-Out)
        // ĐẢO MÀU PHÂN THỊ: Mắt Trái (Đỏ) dịch phải, Mắt Phải (Cyan) dịch trái
        // → Tạo hiệu ứng Base-Out (Hội tụ) ngược với M6 Phân kỳ
        let visualDiopter = this.currentDiopter;
        if (this.state === 'RESTING') {
            // Khi nghỉ, giảm lăng kính đi 2 Diop để mắt thư giãn
            visualDiopter = Math.max(0, this.currentDiopter - 2); 
        }
        
        const splitPx = this._dioptersToPixels(visualDiopter) / 2;
        const leftBarX = cx + splitPx;  // Trái tiến sang Phải
        const rightBarX = cx - splitPx; // Phải tiến sang Trái

        // 2. Vẽ hai khối màu (Blend Mode) — HOÁN ĐỔI MÀU giữa 2 mắt
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = this.colors.right || '#FF0000'; // Mắt Trái dùng ĐỎ (Base-Out)
        ctx.fillRect(leftBarX - this.barWidth/2, cy - this.barHeight/2, this.barWidth, this.barHeight);
        
        ctx.fillStyle = this.colors.left || '#00FFFF'; // Mắt Phải dùng CYAN (Base-Out)
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

        // Mức hội tụ tối đa đạt được (Prism Diopters - Δ)
        const maxDiopters = this.currentDiopter;

        const customData = {
            maxDiopter: this.currentDiopter,
            targetDiopter: this.targetDiopter,
            finalConvergenceDiopter: parseFloat(maxDiopters.toFixed(2)),
            totalStrikes: Object.values(this.strikes).reduce((a, b) => a + b, 0),
            status: reason
        };

        // Lưu hệ thống Therapy
        if (this.sessionMetrics) {
            this.sessionMetrics.customData = customData;
            this.sessionMetrics.score = maxDiopters; // Fallback: score = số Diop
            this.sessionMetrics.durationSeconds = this.totalPlayTime;
            if (typeof this.finishSession === 'function') this.finishSession();
        }

        // Phát sự kiện Backup
        document.dispatchEvent(new CustomEvent('therapy_session_completed', {
            detail: {
                gameId: 'M13',
                gameName: this.gameName,
                duration: this.totalPlayTime,
                score: maxDiopters,
                metrics: {
                    finalConvergenceDiopter: parseFloat(maxDiopters.toFixed(2))
                }
            }
        }));

        // Global Result Modal hiển thị kết quả (thay cho alert() cũ)
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { ConvergenceTherapyGame };

export default ConvergenceTherapyGame;