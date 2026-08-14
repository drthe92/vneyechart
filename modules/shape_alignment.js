/**
 * Module 2: Shape Alignment Game (Flat Fusion + Crowding Effect)
 * 
 * Trò chơi huấn luyện dung hợp phẳng với Hiệu ứng đám đông (Crowding Effect):
 * - Target Shape (Left Eye/Cyan): Khung rỗng tĩnh, viền dày, kích thước thu nhỏ dần theo level
 * - Player Shape (Right Eye/Red): Khối đặc động, kích thước bằng target, di chuyển theo chuột
 * - 4 Vạch nhiễu (Flanking Bars): Bao quanh target, khoảng cách giảm dần theo level
 * - Mục tiêu: Giữ Player trong Target liên tục 2 giây (120 frames) để khóa khớp
 * - 10 cấp độ: Kích thước giảm từ 120px xuống 30px, nhiễu ép sát vào tâm
 */

class ShapeAlignmentGame extends BinocularGameEngine {
    /**
     * Khởi tạo trò chơi Shape Alignment
     * Thiết lập trạng thái game, vị trí ban đầu, và event SPA
     */
    constructor() {
        super(); // Khởi tạo cha: kiểm tra anaglyphColors, tạo canvas, bind event SPA

        // --- Tên game cho EMR identification ---
        this.gameName = 'M2: Khớp khung (Flat Fusion)';

        // --- Trạng thái cấp độ & hold ---
        this.level = 1;
        this.maxLevel = 10;
        this.baseSize = 120; // Kích thước ban đầu (px)
        this.holdFrames = 0;
        this.targetFrames = 120; // 2 giây @ 60fps

        // --- Vị trí ---
        this.targetPos = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
        this.playerPos = { x: this.canvas.width / 2 + 100, y: this.canvas.height / 2 + 100 };

        // --- Con trỏ chuột ẩn ---
        this.canvas.style.cursor = 'none';

        // --- Sự kiện chuột: Điều khiển Player Position ---
        this._handleMouseMove = this._handleMouseMove.bind(this);
        this.canvas.addEventListener('mousemove', this._handleMouseMove);
    }

    /**
     * Xử lý sự kiện di chuyển chuột → cập nhật playerPos (tâm chuột)
     * @param {MouseEvent} e
     */
    _handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        this.playerPos.x = mouseX;
        this.playerPos.y = mouseY;
    }

    /**
     * Tính kích thước hiện tại dựa trên level
     * Giảm 10px mỗi level, tối thiểu 30px
     * @returns {number} Kích thước hiện tại
     */
    getCurrentSize() {
        return Math.max(30, this.baseSize - (this.level - 1) * 10);
    }

    /**
     * Random vị trí target trong canvas (giữ margin an toàn 80px từ mép)
     */
    _randomizeTargetPosition() {
        const margin = 80;
        this.targetPos.x = margin + Math.random() * (this.canvas.width - margin * 2);
        this.targetPos.y = margin + Math.random() * (this.canvas.height - margin * 2);
    }

    /**
     * Tính khoảng cách Euclidean giữa playerPos và targetPos
     * @returns {number} Khoảng cách vector giữa hai tâm
     */
    _euclideanDistance() {
        const dx = this.targetPos.x - this.playerPos.x;
        const dy = this.targetPos.y - this.playerPos.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Cập nhật logic vật lý & cấp độ
     * - Cập nhật playerPos theo chuột (đã làm trong _handleMouseMove)
     * - Kiểm tra fusion lock (khoảng cách < size/4)
     * - Xử lý level up khi đủ holdFrames
     */
    update() {
        const dist = this._euclideanDistance();

        // Dung hợp (Fusion Lock): Sai số tâm tối đa 5 pixel
        if (dist <= 5) {
            this.holdFrames++;
        } else {
            this.holdFrames = 0;
        }

        // Qua bàn (Level Up)
        if (this.holdFrames >= this.targetFrames) {
            if (this.level >= this.maxLevel) {
                this._endGame();
                return;
            }
            // Level lên: reset hold, random target mới
            this.level++;
            this.holdFrames = 0;
            this._randomizeTargetPosition();
        }
    }

    /**
     * Render đồ họa trò chơi
     * Áp dụng Crowding Effect: Target khung rỗng + 4 vạch nhiễu + Player khối đặc
     */
    render() {
        // Bắt buộc gọi super.render() ở dòng đầu
        super.render();
        const ctx = this.ctx;
        ctx.globalCompositeOperation = 'source-over';

        const progress = this.holdFrames / this.targetFrames;

        // --- A. Tính toán kích thước & khoảng cách ---
        const targetSize = Math.max(30, this.baseSize - (this.level - 1) * 10);
        const playerSize = targetSize - 8; // Player nhỏ hơn 8px để lọt khít
        const gap = Math.max(5, 40 - (this.level * 3)); // Khoảng cách từ mép Target đến thanh nhiễu
        const barThickness = 4;

        // --- B. Vẽ Text HUD ---
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(`Cấp độ: ${this.level}/${this.maxLevel}`, 15, 15);

        // Thanh tiến trình hold
        const barWidth = 200;
        const barHeight = 14;
        const barX = 15;
        const barY = 40;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = '#00AA00';
        ctx.fillRect(barX, barY, barWidth * progress, barHeight);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.floor(progress * 100)}%`, barX + barWidth / 2 - 10, barY + barHeight / 2);

        // Hướng dẫn ESC mờ ở góc phải
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.font = '14px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('[ESC] Thoát', this.canvas.width - 15, 15);
        ctx.textAlign = 'left'; // Reset

        // --- C. Vẽ Mắt Nhược thị (Target & Flanking Bars) ---
        ctx.strokeStyle = this.colors.left; // Cyan cho mắt nhược thị
        ctx.fillStyle = this.colors.left;
        ctx.lineWidth = 4;

        // Tọa độ tâm Target
        const tx = this.targetPos.x;
        const ty = this.targetPos.y;

        // Vẽ Target (Khung rỗng) với cạnh targetSize, tại tâm this.targetPos
        ctx.strokeRect(tx - targetSize / 2, ty - targetSize / 2, targetSize, targetSize);

        // Vẽ 4 Thanh nhiễu (Crowding Bars)
        // Thanh TRÊN: tx - targetSize/2, ty - targetSize/2 - gap - barThickness, targetSize, barThickness
        ctx.fillRect(tx - targetSize / 2, ty - targetSize / 2 - gap - barThickness, targetSize, barThickness);
        // Thanh DƯỚI: tx - targetSize/2, ty + targetSize/2 + gap, targetSize, barThickness
        ctx.fillRect(tx - targetSize / 2, ty + targetSize / 2 + gap, targetSize, barThickness);
        // Thanh TRÁI: tx - targetSize/2 - gap - barThickness, ty - targetSize/2, barThickness, targetSize
        ctx.fillRect(tx - targetSize / 2 - gap - barThickness, ty - targetSize / 2, barThickness, targetSize);
        // Thanh PHẢI: tx + targetSize/2 + gap, ty - targetSize/2, barThickness, targetSize
        ctx.fillRect(tx + targetSize / 2 + gap, ty - targetSize / 2, barThickness, targetSize);

        // --- D. Vẽ Mắt Lành (Player) ---
        ctx.fillStyle = this.colors.right; // Đỏ cho mắt lành
        const px = this.playerPos.x - playerSize / 2;
        const py = this.playerPos.y - playerSize / 2;
        ctx.fillRect(px, py, playerSize, playerSize);
    }

    /**
     * Kết thúc game sau khi hoàn thành 10 cấp độ
     * Hiển thị overlay báo cáo lâm sàng + nút chuyển sang Module 3
     */
    _endGame() {
        // --- Tính toán kích thước Pixel cuối cùng ---
        const finalSizePx = Math.max(30, this.baseSize - (this.level - 1) * 10);

        // --- Quy đổi sang Góc thị giác (Visual Angle - Độ) ---
        const visualAngleDeg = this.pixelsToVisualAngle(finalSizePx);

        // --- Đóng gói sessionMetrics trước khi stop ---
        this.sessionMetrics.level = this.level;
        this.sessionMetrics.customData = { finalSizePx: finalSizePx, visualAngleDeg: visualAngleDeg };
        this.finishSession();

        this.canvas.style.cursor = 'default';
        this.stop();
        const overlayId = 'shape-alignment-end-overlay';

        // Xóa overlay cũ nếu có
        const oldOverlay = document.getElementById(overlayId);
        if (oldOverlay) oldOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = overlayId;
        overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,0.95); display:flex; align-items:center; justify-content:center; flex-direction:column; color:white; text-align:center; padding:40px;';

        overlay.innerHTML = `
            <h1 style="font-size:32px; color:#34d399; margin-bottom:20px;">BÁO CÁO LÂM SÀNG: HOÀN THÀNH KHỚP KHUNG (CROWDING EFFECT)</h1>
            <div style="max-width:600px; padding:20px; border:2px solid #34d399; border-radius:12px; background:rgba(52,211,153,0.1); margin-bottom:30px;">
                <p style="font-size:18px; margin:10px 0;"><strong>Góc thị giác Foveal tối thiểu:</strong> <span style="color:#fbbf24; font-size:24px;">${visualAngleDeg.toFixed(2)}°</span></p>
                <p style="font-size:16px; margin:10px 0; color:#94a3b8;">Bạn đã hoàn thành tất cả 10 cấp độ. Khả năng tập trung foveal và chống nhiễu đám đông đã được cải thiện đáng kể.</p>
            </div>
            <button id="btn-go-module3" style="padding:15px 40px; font-size:20px; background:#3b82f6; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">Chuyển sang Module 3: Vận nhãn</button>
        `;

        document.body.appendChild(overlay);

        document.getElementById('btn-go-module3').addEventListener('click', () => {
            overlay.remove();
            document.dispatchEvent(new CustomEvent('requestLaunchModule3'));
        });
    }

    /**
     * Ghi đè stop() để dọn dẹp event listener và khôi phục con trỏ chuột
     */
    stop() {
        // Khôi phục con trỏ chuột
        this.canvas.style.cursor = 'default';

        // Dọn dẹp event listener chuột
        if (this.canvas) {
            this.canvas.removeEventListener('mousemove', this._handleMouseMove);
        }

        super.stop(); // Gọi cha: cancelAnimationFrame, remove DOM, clear SPA listener
    }
}

// Xuất module cho ES Module import
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShapeAlignmentGame };
}
