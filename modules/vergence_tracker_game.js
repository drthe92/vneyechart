/**
 * Module 3: Vergence Tracker Game (Trắc nghiệm theo dõi vận nhãn ngang)
 * 
 * Trò chơi đo lường khả năng hội tụ (Base-Out/Crossed) và phân kỳ (Base-In/Uncrossed):
 * - Bar 1 (Left Eye): Thanh dọc màu mắt trái (Luc Lam/Cyan cho mắt nhược thị)
 * - Bar 2 (Right Eye): Thanh dọc màu mắt phải (Đỏ cho mắt lành)
 * - splitDistance tăng dần khiến 2 bar tách xa nhau theo hướng mode hiện tại
 * - Người dùng bấm SPACEBAR khi mất dung hợp → ghi nhận break point
 * - Thực hiện 4 lượt: 2 lượt Base-Out (Hội tụ) và 2 lượt Base-In (Phân kỳ)
 * - Áp dụng thủ thuật Central Check (Chữ E trắng) để chống ức chế luân phiên
 */

import BinocularGameEngine from './binocular_game_engine.js';

class VergenceTrackerGame extends BinocularGameEngine {
    /**
     * Khởi tạo trò chơi Vergence Tracker
     * Thiết lập trạng thái ban đầu: round=1, mode=Base-Out, splitDistance=0
     */
    constructor() {
        super();

        // --- Tên game cho EMR identification ---
        this.gameName = 'M3: Vận nhãn (Vergence Tracker)';

        // --- Trạng thái trò chơi ---
        this.round = 1;
        this.maxRounds = 4;
        this.mode = 'Base-Out'; // Bắt đầu bằng Hội tụ
        this.splitDistance = 0;
        this.speed = 0.15; // Tách 0.15px mỗi frame (Giảm tốc độ để mắt tái dung hợp)
        this.isPaused = true; // Trạng thái nghỉ ban đầu
        this.pauseFrames = 120; // 120 frames (2 giây ở 60fps) để bắt đầu game
        this.results = { BO: [], BI: [] }; // Mảng lưu kết quả

        // --- Cấu hình thực thể ---
        this.barWidth = 60; // Kích thước 60x150px
        this.barHeight = 150;

        // --- Sự kiện bàn phím: Lắng nghe Spacebar ---
        this.handleSpacebar = (e) => { if (e.code === 'Space') this._recordBreakPoint(); };
    }

    /**
     * Bắt đầu trò chơi
     * Gọi super.start(), ẩn chuột, lắng nghe sự kiện bàn phím
     */
    start() {
        super.start();
        this.canvas.style.cursor = 'none';
        window.addEventListener('keydown', this.handleSpacebar);
    }

    /**
     * Dừng trò chơi
     * Loại bỏ event listener, hiện lại chuột, gọi super.stop()
     */
    stop() {
        window.removeEventListener('keydown', this.handleSpacebar);
        if (this.canvas) {
            this.canvas.style.cursor = 'default';
        }
        super.stop();
    }

    /**
     * Ghi nhận điểm đứt gãy và xử lý chuyển vòng
     * - Lưu kết quả vào mảng results.BO hoặc results.BI
     * - Tăng round, đổi mode, reset splitDistance
     * - Nếu vượt quá maxRounds, gọi _endGame()
     */
    _recordBreakPoint() {
        // Chuyển đổi khoảng cách đứt gãy sang Lăng kính
        const breakPointDelta = this.pixelsToDiopter(this.splitDistance * 2);

        // Lưu kết quả theo mode hiện tại
        if (this.mode === 'Base-Out') {
            this.results.BO.push(breakPointDelta);
        } else {
            this.results.BI.push(breakPointDelta);
        }

        // Xử lý chuyển vòng
        this.round++;

        // Kiểm tra kết thúc game
        if (this.round > this.maxRounds) {
            this._endGame();
            return;
        }

        // Đổi mode
        this.mode = (this.mode === 'Base-Out') ? 'Base-In' : 'Base-Out';

        // Reset khoảng cách
        this.splitDistance = 0;

        // Kích hoạt trạng thái nghỉ để mắt tái dung hợp khi chuyển vòng
        this.isPaused = true;
        this.pauseFrames = 120;
    }

    /**
     * Cập nhật logic trò chơi
     * Tăng khoảng cách tách bar mỗi frame
     */
    update() {
        if (this.isPaused) {
            this.pauseFrames--;
            if (this.pauseFrames <= 0) {
                this.isPaused = false;
            }
            return; // Bỏ qua việc tăng khoảng cách
        }
        this.splitDistance += this.speed;
    }

    /**
     * Render đồ họa trò chơi
     * - Gọi super.render() ở dòng 1
     * - Vẽ Text HUD hiển thị thông tin vòng, chế độ, hướng dẫn
     * - Tính tọa độ 2 thanh dựa trên mode
     * - Vẽ 2 thanh với blend mode 'multiply'
     * - Vẽ Central Check (Chữ E trắng) ở tâm màn hình
     */
    render() {
        // A. Môi trường quang học an toàn (nền trắng + viền đen)
        super.render();

        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        // B. Vẽ Text HUD
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Vòng: ${this.round}/${this.maxRounds}`, 20, 20);

        const modeLabel = this.mode === 'Base-Out' ? 'Hội tụ (Base-Out)' : 'Phân kỳ (Base-In)';
        ctx.fillText(`Chế độ: ${modeLabel}`, 20, 50);

        // Tính Lăng kính hiện tại và hiển thị HUD
        const currentDiopters = this.pixelsToDiopter(this.splitDistance * 2);
        ctx.fillText('Nhu cầu vận nhãn: ' + currentDiopters.toFixed(1) + ' Δ', 15, 65);

        // Hiển thị thông báo trạng thái nghỉ (đang định thị)

        // Hiển thị profile phần cứng để giám sát sai số vật lý
        ctx.fillStyle = '#64748b'; // Màu xám nhạt
        ctx.font = '12px Arial, sans-serif';
        const pxMm = this.calibration?.pixelsPerMm ? this.calibration.pixelsPerMm.toFixed(2) : 'N/A';
        const dist = this.calibration?.viewingDistanceCm || 'N/A';
        ctx.fillText(`[Hardware: ${pxMm} px/mm | Khoảng cách: ${dist} cm]`, 15, 85);

        // Text hướng dẫn mờ ở góc phải
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.font = '16px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('Bấm SPACE khi khối màu tách đôi | ESC để thoát', this.canvas.width - 20, 20);

        // C. Tính tọa độ 2 thanh
        let leftBarX = cx;
        let rightBarX = cx;

        if (this.mode === 'Base-Out') {
            // Base-Out (Hội tụ): Lăng kính gốc hướng ra ngoài → Bệnh nhân phải CROSS để dung hợp
            // Mắt trái - Cyan - dịch TRÁI | Mắt phải - Đỏ - dịch PHẢI → Tách ra xa
            leftBarX = cx - this.splitDistance;
            rightBarX = cx + this.splitDistance;
        } else {
            // Base-In (Phân kỳ): Lăng kính đỉnh hướng ra ngoài → Bệnh nhân phải DIVERGE để dung hợp
            // Mắt trái - Cyan - dịch PHẢI | Mắt phải - Đỏ - dịch TRÁI → Tiến lại gần
            leftBarX = cx + this.splitDistance;
            rightBarX = cx - this.splitDistance;
        }

        // D. Vẽ 2 thanh với blend mode 'multiply'
        ctx.globalCompositeOperation = 'multiply';

        // Vẽ thanh mắt Nhược thị (Left Eye - Cyan)
        ctx.fillStyle = this.colors.left;
        ctx.fillRect(leftBarX - this.barWidth / 2, cy - this.barHeight / 2, this.barWidth, this.barHeight);

        // Vẽ thanh mắt Lành (Right Eye - Red)
        ctx.fillStyle = this.colors.right;
        ctx.fillRect(rightBarX - this.barWidth / 2, cy - this.barHeight / 2, this.barWidth, this.barHeight);

        // Đặt lại blend mode về mặc định
        ctx.globalCompositeOperation = 'source-over';

    }

    /**
     * Kết thúc game — nhường quyền hiển thị cho Global Result Modal
     * - Tính trung bình avgBO và avgBI từ this.results
     * - Đóng gói sessionMetrics và phát event để EMR lưu + Modal hiển thị
     */
    _endGame() {
        // Tính trung bình
        const avgBO = this.results.BO.length > 0
            ? this.results.BO.reduce((a, b) => a + b, 0) / this.results.BO.length
            : 0;
        const avgBI = this.results.BI.length > 0
            ? this.results.BI.reduce((a, b) => a + b, 0) / this.results.BI.length
            : 0;

        // Đóng gói dữ liệu đo lường
        this.sessionMetrics.customData = { 
            avgBaseOut: parseFloat(avgBO.toFixed(1)), 
            avgBaseIn: parseFloat(avgBI.toFixed(1)) 
        };
        
        // Kết thúc session (Hệ thống sẽ tự kích hoạt Global Modal qua event)
        this.stop();
        this.canvas.style.cursor = 'default';
        this.finishSession();
    }
}

// Xuất module cho ES Module import
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VergenceTrackerGame };
}

export default VergenceTrackerGame;
