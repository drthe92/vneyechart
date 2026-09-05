import BinocularGameEngine from './binocular_game_engine.js';

// [A4] Kích thước thanh hợp thị theo GÓC THỊ GIÁC tuyệt đối (arcsec) —
// quy đổi sang px bằng this.arcsecToPixels() của Engine, thay cho
// kích thước cứng 60x150px (trôi tỷ lệ vật lý khi đổi màn hình).
const M6_BAR_WIDTH_ARCSEC = 6480;   // ~1.8° chiều ngang thanh hợp thị
const M6_BAR_HEIGHT_ARCSEC = 16200; // ~4.5° chiều dọc thanh hợp thị

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

        // [A4] Kích thước vật lý thanh hợp thị (px thực tế theo hiệu chuẩn)
        this._updateBarPhysicalSize();
        
        this._spaceHandler = (e) => {
            if (e.code === 'Space' && this.state === 'PLAYING') this._handleBreak();
        };
    }

    /**
     * [A4] Quy đổi kích thước thanh hợp thị từ góc thị giác (arcsec)
     * sang px thực tế bằng hệ số hiệu chuẩn của Engine (arcsecToPixels).
     * Kích thước vật lý giữ nguyên khi đổi màn hình / resize cửa sổ.
     * @private
     */
    _updateBarPhysicalSize() {
        this.barWidth = Math.max(24, Math.round(this.arcsecToPixels(M6_BAR_WIDTH_ARCSEC)));
        this.barHeight = Math.max(40, Math.round(this.arcsecToPixels(M6_BAR_HEIGHT_ARCSEC)));
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
    // [A3] Sử dụng this.diopterToPixels() kế thừa từ Engine (hệ quy chiếu
    // Prism Diopter duy nhất theo hiệu chuẩn) — đã xóa công thức tự tính
    // với hardcode 3.78 px/mm & 40cm.

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
        
        const splitPx = this.diopterToPixels(visualDiopter) / 2;
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

        // Mức phân kỳ tối đa đạt được (Prism Diopters - Δ)
        const maxDiopters = this.currentDiopter;

        // Lưu hệ thống Therapy theo chuẩn Engine (Firebase & LocalStorage)
        this.sessionMetrics.customData = {
            maxDiopter: this.currentDiopter,
            targetDiopter: this.targetDiopter,
            finalDivergenceDiopter: parseFloat(maxDiopters.toFixed(2)),
            totalStrikes: Object.values(this.strikes).reduce((a, b) => a + b, 0),
            status: reason
        };
        this.sessionMetrics.score = maxDiopters;
        this.sessionMetrics.durationSeconds = this.totalPlayTime;
        this.score = maxDiopters;
        this.finishSession();
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { DivergenceTherapyGame };

export default DivergenceTherapyGame;
