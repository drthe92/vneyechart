/**
 * Module 3: Vergence Tracker Game (Trắc nghiệm theo dõi vận nhãn ngang)
 * 
 * Trò chơi đo lường khả năng hội tụ (Base-Out/Crossed) và phân kỳ (Base-In/Uncrossed):
 * - Bar 1 (Left Eye): Thanh dọc màu mắt trái
 * - Bar 2 (Right Eye): Thanh dọc màu mắt phải
 * - splitDistance tăng dần khiến 2 bar tách xa nhau theo hướng mode hiện tại
 * - Người dùng bấm Spacebar khi mất dung hợp → ghi nhận break point
 * - Luân phiên đổi giữa Base-Out (Hội tụ) và Base-In (Phân kỳ) sau mỗi lần bấm Space
 */

class VergenceTrackerGame extends BinocularGameEngine {
    /**
     * Khởi tạo trò chơi Vergence Tracker
     * Thiết lập trạng thái ban đầu: Base-Out mode, splitDistance = 0
     */
    constructor() {
        super();

        // --- Trạng thái trò chơi ---
        this.mode = 'Base-Out';            // Chế độ bắt đầu: Base-Out (Hội tụ / Crossed)
        this.splitDistance = 0;            // Khoảng cách tách giữa 2 bar (px)
        this.lastBreakPoint = null;        // Giá trị splitDistance khi user bấm Spacebar

        // --- Cấu hình thực thể ---
        this.barWidth = 40;                // Chiều rộng bar: 40px
        this.barHeight = 150;              // Chiều cao bar: 150px
        this.speed = 0.5;                  // Tốc độ tăng splitDistance: 0.5px/frame

        // --- Sự kiện bàn phím: Lắng nghe Spacebar ---
        this.handleKeydown = this._handleKeydown.bind(this);
        window.addEventListener('keydown', this.handleKeydown);
    }

    /**
     * Xử lý sự kiện phím Spacebar
     * Khi người dùng bấm Space (mắt bị mất dung hợp, thấy hình tách đôi):
     * - Lưu lastBreakPoint = Math.floor(splitDistance)
     * - Reset splitDistance = 0
     * - Đổi mode (Base-Out ↔ Base-In)
     * @param {KeyboardEvent} e
     */
    _handleKeydown(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            this.lastBreakPoint = Math.floor(this.splitDistance);
            this.splitDistance = 0;
            this.mode = this.mode === 'Base-Out' ? 'Base-In' : 'Base-Out';
        }
    }

    /**
     * Cập nhật logic trò chơi
     * Tăng splitDistance và tính tọa độ 2 bar dựa trên mode hiện tại
     */
    update() {
        this.splitDistance += this.speed;
    }

    /**
     * Tính tọa độ X của 2 bar dựa trên mode và splitDistance
     * @returns {{ leftX: number, rightX: number }} Tọa độ X của Bar 1 (trái) và Bar 2 (phải)
     */
    _calculateBarPositions() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        let leftX, rightX;

        if (this.mode === 'Base-In') {
            // Base-In (Phân kỳ / Uncrossed):
            // Bar 1 (Mắt trái) dịch sang TRÁI, Bar 2 (Mắt phải) dịch sang PHẢI
            leftX = centerX - this.splitDistance / 2 - this.barWidth / 2;
            rightX = centerX + this.splitDistance / 2 - this.barWidth / 2;
        } else {
            // Base-Out (Hội tụ / Crossed):
            // Bar 1 (Mắt trái) dịch sang PHẢI, Bar 2 (Mắt phải) dịch sang TRÁI (tắt chéo)
            leftX = centerX + this.splitDistance / 2 - this.barWidth / 2;
            rightX = centerX - this.splitDistance / 2 - this.barWidth / 2;
        }

        return { leftX, rightX, centerY };
    }

    /**
     * Render đồ họa trò chơi
     * Dòng 1: super.render() – dọn dẹp frame, vẽ nền trắng + viền đen
     * Dòng 2: Vẽ 2 bar với multiply blend mode để tạo màu tối khi đè lên nhau ở tâm
     * Dòng 3: Hiển thị mode và lastBreakPoint
     */
    render() {
        // A. Môi trường quang học an toàn (nền trắng + viền đen)
        super.render();

        const ctx = this.ctx;
        const { leftX, rightX, centerY } = this._calculateBarPositions();

        // B. Vẽ 2 bar với multiply blend mode (khi đè lên nhau tạo màu tối dung hợp)
        ctx.globalCompositeOperation = 'multiply';

        // Bar 1 (Mắt trái)
        ctx.fillStyle = this.colors.left;
        ctx.fillRect(leftX, centerY - this.barHeight / 2, this.barWidth, this.barHeight);

        // Bar 2 (Mắt phải)
        ctx.fillStyle = this.colors.right;
        ctx.fillRect(rightX, centerY - this.barHeight / 2, this.barWidth, this.barHeight);

        // Đặt lại blend mode về mặc định
        ctx.globalCompositeOperation = 'source-over';

        // C. Hiển thị thông tin (màu đen – chung cho cả hai mắt)
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(`Chế độ: ${this.mode}`, 15, 18);

        if (this.lastBreakPoint !== null) {
            ctx.font = '18px Arial, sans-serif';
            ctx.fillText(`Break Point: ${this.lastBreakPoint}px`, 15, 48);
        }
    }

    /**
     * Ghi đè stop() để dọn dẹp event listener bàn phím trước khi gọi super.stop()
     * Đảm bảo không rò rỉ bộ nhớ khi chuyển không gian làm việc
     */
    stop() {
        // Dọn dẹp event listener bàn phím trước khi unmount canvas
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', this.handleKeydown);
        }
        super.stop(); // Gọi cha: cancelAnimationFrame, remove DOM, clear SPA listener
    }
}

// Xuất module cho ES Module import
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VergenceTrackerGame };
}
