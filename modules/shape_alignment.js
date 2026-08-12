/**
 * Module 2: Shape Alignment Game (Flat Fusion)
 * 
 * Trò chơi huấn luyện dung hợp phẳng (Binocular Flat Fusion):
 * - Target Shape (Left Eye): Khung rỗng tĩnh, viền dày 5px, kích thước 100x100px
 * - Player Shape (Right Eye): Khối đặc động, kích thước 90x90px, di chuyển theo chuột
 * - Mục tiêu: Giữ Player trong Target liên tục 2 giây (120 frames) để khóa dung hợp
 */

class ShapeAlignmentGame extends BinocularGameEngine {
    /**
     * Khởi tạo trò chơi Shape Alignment
     * Thiết lập Target Shape tĩnh và Player Shape động
     */
    constructor() {
        super(); // Khởi tạo cha: kiểm tra anaglyphColors, tạo canvas, bind event SPA

        // --- Trạng thái dung hợp ---
        this.score = 0;                    // Điểm số (số lần fusion lock thành công)
        this.fusionFrameCount = 0;         // Biến đếm frame duy trì lock (< 10px khoảng cách)
        this.FUSION_REQUIRED_FRAMES = 120; // 120 frames @ 60fps = 2 giây lock liên tục

        // --- Target Shape (Left Eye – Khung rỗng tĩnh) ---
        this.targetSize = 100;             // Kích thước khung: 100x100px
        this.targetBorderWidth = 5;        // Độ dày viền: 5px
        this._randomizeTargetPosition();   // Đặt vị trí ngẫu nhiên ban đầu

        // --- Player Shape (Right Eye – Khối đặc động) ---
        this.playerSize = 90;              // Kích thước khối: 90x90px (nhỏ hơn target để lọt vào)
        this.playerX = this.canvas.width / 2 - this.playerSize / 2;
        this.playerY = this.canvas.height / 2 - this.playerSize / 2;

        // --- Sự kiện chuột: Điều khiển Player Shape ---
        this.handleMouseMove = this._handleMouseMove.bind(this);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
    }

    /**
     * Xử lý sự kiện di chuyển chuột → cập nhật tọa độ Player Shape
     * Căn giữa Player theo con trỏ chuột, giới hạn trong biên canvas
     * @param {MouseEvent} e
     */
    _handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Đặt tâm Player trùng tâm chuột, tính lại góc trên trái
        this.playerX = Math.max(0, Math.min(mouseX - this.playerSize / 2, this.canvas.width - this.playerSize));
        this.playerY = Math.max(0, Math.min(mouseY - this.playerSize / 2, this.canvas.height - this.playerSize));
    }

    /**
     * Random vị trí Target Shape trong canvas (giữ margin 150px từ mép)
     */
    _randomizeTargetPosition() {
        const margin = 150;
        this.targetX = margin + Math.random() * (this.canvas.width - margin * 2 - this.targetSize);
        this.targetY = margin + Math.random() * (this.canvas.height - margin * 2 - this.targetSize);
    }

    /**
     * Tính khoảng cách Euclidean giữa tâm Target và tâm Player
     * @returns {number} Khoảng cách vector giữa hai tâm
     */
    _euclideanDistance() {
        const targetCenterX = this.targetX + this.targetSize / 2;
        const targetCenterY = this.targetY + this.targetSize / 2;
        const playerCenterX = this.playerX + this.playerSize / 2;
        const playerCenterY = this.playerY + this.playerSize / 2;

        const dx = targetCenterX - playerCenterX;
        const dy = targetCenterY - playerCenterY;

        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Cập nhật logic dung hợp phẳng
     * Kiểm tra khoảng cách liên tục < 10px để đếm 120 frames (2 giây)
     */
    update() {
        const dist = this._euclideanDistance();

        if (dist < 10) {
            // Khoảng cách < 10px: tăng bộ đếm fusion
            this.fusionFrameCount++;

            // Đủ 120 frames (2 giây) → Fusion Lock thành công
            if (this.fusionFrameCount >= this.FUSION_REQUIRED_FRAMES) {
                this.score++;                          // Tăng điểm
                this.fusionFrameCount = 0;             // Reset bộ đếm
                this._randomizeTargetPosition();       // Đổi vị trí Target ngẫu nhiên
            }
        } else {
            // Hỏng khoảng cách: reset bộ đếm fusion
            this.fusionFrameCount = 0;
        }
    }

    /**
     * Render đồ họa trò chơi
     * Dòng 1: super.render() – dọn dẹp frame, vẽ nền trắng + viền đen
     * Dòng 2 & 3: Vẽ Target Shape (khung rỗng) và Player Shape (khối đặc)
     * Dòng 4: Hiển thị điểm số + trạng thái fusion
     */
    render() {
        // A. Môi trường quang học an toàn (nền trắng + viền đen)
        super.render();

        const ctx = this.ctx;

        // B. Vẽ Target Shape (Left Eye – Khung rỗng, viền dày 5px)
        ctx.strokeStyle = this.colors.left;
        ctx.lineWidth = this.targetBorderWidth;
        ctx.strokeRect(this.targetX, this.targetY, this.targetSize, this.targetSize);

        // C. Vẽ Player Shape (Right Eye – Khối đặc)
        ctx.fillStyle = this.colors.right;
        ctx.fillRect(this.playerX, this.playerY, this.playerSize, this.playerSize);

        // D. Hiển thị điểm số + trạng thái fusion (màu đen – chung cho cả hai mắt)
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(`Điểm: ${this.score}`, 15, 18);

        // Hiển thị thanh tiến trình fusion (nếu đang gần lock)
        if (this.fusionFrameCount > 0) {
            const progress = this.fusionFrameCount / this.FUSION_REQUIRED_FRAMES;
            const barWidth = 150;
            const barHeight = 12;
            const barX = 15;
            const barY = 48;

            // Nền thanh progress
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Tiến trình điền đầy
            ctx.fillStyle = '#00AA00';
            ctx.fillRect(barX, barY, barWidth * progress, barHeight);

            // Viền thanh progress
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);

            // Text tiến trình
            ctx.fillStyle = '#000000';
            ctx.font = '14px Arial, sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.floor(progress * 100)}%`, barX + barWidth / 2 - 10, barY + barHeight / 2);
        }
    }

    /**
     * Ghi đè stop() để dọn dẹp event listener chuột trước khi gọi super.stop()
     * Đảm bảo không rò rỉ bộ nhớ khi chuyển không gian làm việc
     */
    stop() {
        // Dọn dẹp event listener chuột trước khi unmount canvas
        if (this.canvas) {
            this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        }
        super.stop(); // Gọi cha: cancelAnimationFrame, remove DOM, clear SPA listener
    }
}

// Xuất module cho ES Module import
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShapeAlignmentGame };
}
