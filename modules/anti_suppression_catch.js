/**
 * Module 1: Anti-suppression Catch (Hứng hạt) - Adaptive Staircase Edition
 * 
 * Trò chơi huấn luyện thị giác hai mắt (Dichoptic):
 * - Hạt màu (Left Eye): Rơi từ trên xuống, kích thích mắt trái (Alpha = 1.0 cố định)
 * - Thanh hứng (Right Eye): Di chuyển ngang bằng chuột, kích thích mắt phải (Alpha thay đổi)
 * - Thuật toán Cầu thang Thích ứng (Adaptive Staircase): Điều chỉnh tương phản mắt lành
 * 
 * Cơ chế tương phản (Contrast Mechanism):
 * - Khi HỨNG TRÚNG (Collision): Giảm healthyAlpha (tăng độ khó) → Math.max(0.1, alpha - 0.05)
 * - Khi HỨNG TRƯỢT (Miss): Tăng healthyAlpha (giảm độ khó) → Math.min(1.0, alpha + 0.1)
 * - Alpha của thanh hứng được áp dụng qua ctx.globalAlpha trước khi vẽ
 * 
 * Kế thừa từ BinocularGameEngine để tái sử dụng:
 * - Ràng buộc y khoa: Kiểm tra anaglyph colors, canvas setup
 * - Môi trường quang học: super.render() tạo nền trắng + viền đen khóa dung hợp
 * - Quản lý bộ nhớ: start/stop lifecycle
 */

import BinocularGameEngine from './binocular_game_engine.js';

class CatchGame extends BinocularGameEngine {
    /**
     * Khởi tạo trò chơi Catch với cơ chế Cầu thang Thích ứng
     * Sử dụng mảng drops (thay vì particles) và paddle (thay vì catcher)
     */
    constructor() {
        super(); // Khởi tạo cha: kiểm tra anaglyphColors, tạo canvas, bind event SPA

        // --- Tên game cho EMR identification ---
        this.gameName = 'M1: Hứng hạt (Anti-suppression)';

        // --- Cấu hình điểm số và mục tiêu ---
        this.score = 0;                    // Điểm số hiện tại
        this.targetScore = 30;             // Điểm mục tiêu để hoàn thành bài tập
        this.hits = 0;                     // Số lần hứng trúng
        this.misses = 0;                   // Số lần hứng trượt
        this.startTime = Date.now();       // Thời gian bắt đầu (ms)
        this.gameOver = false;             // Cờ kết thúc bài tập

        // --- Cơ chế Cầu thang Thích ứng (Adaptive Staircase) ---
        // healthyAlpha: Độ trong suốt của thanh hứng (mắt lành)
        // Bắt đầu ở 1.0 (đầy đủ tương phản), giảm dần khi người chơi thành công
        this.healthyAlpha = 1.0;

        // --- Vật thể rơi: Mảng drops (thay vì particles) ---
        // Mỗi drop là hình chữ nhật {x, y, width, height} dành cho mắt nhược thị
        this.drops = [];

        // --- Thanh hứng: paddle (thay vì catcher) ở đáy màn hình ---
        this.paddle = {
            x: 0,                          // Cập nhật theo chuột trong update()
            y: this.canvas.height - 40,    // Cố định sát đáy màn hình
            width: 100,                    // Chiều rộng thanh hứng
            height: 20                     // Chiều cao thanh hứng
        };

        // --- Biến đếm thời gian sinh hạt (time-based spawning) ---
        this.lastSpawnTime = Date.now();   // Lần sinh hạt cuối cùng (ms)
        this.spawnInterval = 1000;         // 1 hạt / 1 giây

        // --- Tọa độ chuột hiện tại để căn giữa paddle ---
        this._mouseX = this.canvas.width / 2;

        // --- Sự kiện chuột: Điều khiển thanh hứng ngang màn hình ---
        this.handleMouseMove = this._handleMouseMove.bind(this);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);

        // Hỗ trợ touch device (di chuyển ngón tay để trượt thanh hứng)
        this.handleTouchMove = this._handleTouchMove.bind(this);
        this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    }

    /**
     * Cập nhật logic vật lý, điểm số và thuật toán Cầu thang Thích ứng
     * Bao gồm: sinh hạt theo thời gian, cập nhật paddle theo chuột, va chạm AABB
     */
    update() {
        if (this.gameOver) return;

        // 1. Kiểm tra điều kiện kết thúc: Đạt điểm mục tiêu
        if (this.score >= this.targetScore) {
            this._endGame();
            return;
        }

        // 2. Cập nhật lại bounding rect của canvas (để xử lý resize cửa sổ)
        this._canvasRect = this.canvas.getBoundingClientRect();

        // 3. Sinh hạt mới theo khoảng thời gian (1 giây/hạt)
        const now = Date.now();
        if (now - this.lastSpawnTime > this.spawnInterval) {
            this.drops.push({
                x: Math.random() * (this.canvas.width - 30), // Vị trí ngang ngẫu nhiên
                y: -30,                                        // Bắt đầu từ trên mép màn hình
                width: 30,                                     // Kích thước hạt vuông
                height: 30
            });
            this.lastSpawnTime = now; // Reset thời gian sinh
        }

        // 4. Cập nhật vị trí paddle theo tọa độ chuột (căn giữa chuột)
        this.paddle.x = Math.max(0, Math.min(this._mouseX - this.paddle.width / 2, this.canvas.width - this.paddle.width));

        // 5. Duyệt ngược mảng drops để xử lý động học và va chạm (tránh lỗi index khi splice)
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];

            // --- Động học: Cho hạt rơi xuống (tăng trục y) ---
            d.y += 3; // Tốc độ rơi cố định 3 px/frame (@ 60fps ≈ 180 px/s)

            // --- AABB Collision Detection: Va chạm drop ↔ paddle ---
            // Kiểm tra giao cắt giữa hình chữ nhật drop và hình chữ nhật paddle
            if (
                d.x < this.paddle.x + this.paddle.width &&     // Ranh trái drop < Ranh phải paddle
                d.x + d.width > this.paddle.x &&               // Ranh phải drop > Ranh trái paddle
                d.y < this.paddle.y + this.paddle.height &&    // Ranh trên drop < Ranh dưới paddle
                d.y + d.height > this.paddle.y                  // Ranh dưới drop > Ranh trên paddle
            ) {
                // ============================================
                // HỨNG TRÚNG (Collision Success)
                // ============================================
                this.score += 1;           // Cộng 1 điểm
                this.hits += 1;            // Tăng bộ đếm trúng

                // TĂNG ĐỘ KHÓ: Giảm tương phản mắt lành
                // Công thức: healthyAlpha = max(0.1, healthyAlpha - 0.05)
                // Giảm 5% tương phản mỗi lần trúng, giới hạn dưới 10%
                this.healthyAlpha = Math.max(0.1, this.healthyAlpha - 0.05);

                // Cắt hạt khỏi mảng
                this.drops.splice(i, 1);
                continue;
            }

            // ============================================
            // HỨNG TRƯỢT (Miss - Hạt rơi quá mép dưới)
            // ============================================
            if (d.y > this.canvas.height) {
                this.score = Math.max(0, this.score - 1);  // Trừ 1 điểm (không âm)
                this.misses += 1;                            // Tăng bộ đếm trượt

                // GIẢM ĐỘ KHÓ: Tăng tương phản mắt lành
                // Công thức: healthyAlpha = min(1.0, healthyAlpha + 0.1)
                // Tăng 10% tương phản mỗi lần trượt, giới hạn trên 100%
                this.healthyAlpha = Math.min(1.0, this.healthyAlpha + 0.1);

                // Cắt hạt khỏi mảng
                this.drops.splice(i, 1);
            }
        }
    }

    /**
     * Kết thúc bài tập: Tính toán thống kê và hiển thị overlay kết quả
     */
    _endGame() {
        this.gameOver = true;

        // --- Đóng gói sessionMetrics trước khi stop ---
        this.sessionMetrics.score = this.score;
        this.sessionMetrics.hits = this.hits;
        this.sessionMetrics.misses = this.misses;
        this.sessionMetrics.customData = { finalAlpha: this.healthyAlpha };
        this.finishSession();

        // Hiện lại chuột để bệnh nhân có thể click nút chuyển Module
        this.canvas.style.cursor = 'default';

        // Dừng game ngay lập tức
        this.stop();

        // ============================================
        // TÍNH TOÁN THỐNG KÊ
        // ============================================
        
        // Thời gian chơi (giây)
        const timeSec = Math.round((Date.now() - this.startTime) / 1000);

        // Tổng số lần thử
        const totalAttempts = this.hits + this.misses;

        // Tỷ lệ chính xác (%)
        const hitRate = totalAttempts > 0 ? Math.round((this.hits / totalAttempts) * 100) : 0;

        // Ngưỡng tương dung hợp (C-Ratio): healthyAlpha cuối cùng
        const cRatio = this.healthyAlpha.toFixed(2);

        // ============================================
        // TẠO OVERLAY KẾT QUẢ
        // ============================================
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 10000;
            background: rgba(15, 23, 42, 0.95);
            color: white;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            text-align: center; padding: 30px;
            font-family: 'Segoe UI', Arial, sans-serif;
        `;

        overlay.innerHTML = `
            <h1 style="font-size: 32px; color: #10b981; margin-bottom: 20px;">
                ✅ BÁO CÁO LÂM SÀNG: ĐÃ ĐẠT MỤC TIÊU ĐIỀU TRỊ
            </h1>

            <div style="max-width: 600px; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 25px; margin-bottom: 25px;">
                <p style="font-size: 20px; margin: 8px 0;"><strong>⏱ Thời gian:</strong> ${timeSec} giây</p>
                <p style="font-size: 20px; margin: 8px 0;"><strong>🎯 Hứng trúng:</strong> <span style="color: #10b981;">${this.hits}</span></p>
                <p style="font-size: 20px; margin: 8px 0;"><strong>❌ Hứng trượt:</strong> <span style="color: #ef4444;">${this.misses}</span></p>
                <p style="font-size: 20px; margin: 8px 0;"><strong>📊 Tỷ lệ chính xác:</strong> <span style="color: #fbbf24;">${hitRate}%</span></p>
                <p style="font-size: 20px; margin: 8px 0;"><strong>🔬 Ngưỡng tương phản dung hợp (C-Ratio):</strong> <span style="color: #60a5fa;">${cRatio}</span></p>
            </div>

            <button id="btn-next-module" style="
                padding: 15px 40px; font-size: 18px; cursor: pointer;
                background: #3b82f6; color: white; border: none; border-radius: 8px;
                font-weight: bold; transition: background 0.3s;
            ">Chuyển sang Module 2: Khớp khung</button>
        `;

        // Thêm overlay vào body
        document.body.appendChild(overlay);

        // Sự kiện hover cho nút
        const nextBtn = document.getElementById('btn-next-module');
        nextBtn.onmouseover = () => nextBtn.style.background = '#2563eb';
        nextBtn.onmouseout = () => nextBtn.style.background = '#3b82f6';

        // ============================================
        // SỰ KIỆN CHUYỂN MODULE
        // ============================================
        nextBtn.onclick = () => {
            // Xóa overlay
            document.body.removeChild(overlay);

            // Phát sự kiện CustomEvent để Controller chuyển sang Module 2
            const module2Event = new CustomEvent('requestLaunchModule2', {
                detail: { fromGame: 'CatchGame' }
            });
            window.dispatchEvent(module2Event);
        };
    }

    /**
     * Xử lý sự kiện di chuyển chuột → cập nhật vị trí paddle
     * @param {MouseEvent} e
     */
    _handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this._mouseX = e.clientX - rect.left;
    }

    /**
     * Xử lý sự kiện swipe trên thiết bị cảm ứng
     * @param {TouchEvent} e
     */
    _handleTouchMove(e) {
        if (e.touches.length === 0) return;
        const rect = this.canvas.getBoundingClientRect();
        this._mouseX = e.touches[0].clientX - rect.left;
    }

    /**
     * Render đồ họa trò chơi
     * BẮT BUỘC gọi super.render() đầu tiên để đảm bảo môi trường quang học an toàn:
     *   - Nền trắng (#FFFFFF): Subtractive color mixing cho Anaglyph
     *   - Viền đen (#000000): Peripheral Binocular Lock – khóa dung hợp ngoại vi
     */
    render() {
        // A. Môi trường quang học an toàn (nền trắng + viền đen)
        super.render();

        const ctx = this.ctx;

        // Đảm bảo composite operation về mặc định (source-over)
        ctx.globalCompositeOperation = 'source-over';

        // ============================================
        // HIỂN THỊ HUD (Heads-Up Display)
        // ============================================
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.textBaseline = 'top';

        // Hiển thị điểm số: "Điểm số: X / 30"
        ctx.fillText(`Điểm số: ${this.score} / 30`, 15, 18);

        // Vẽ text mờ hướng dẫn thoát toàn màn hình (góc trên bên phải)
        ctx.fillStyle = 'rgba(150, 150, 150, 0.5)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'right';
        ctx.fillText('Nhấn ESC để thoát toàn màn hình', this.canvas.width - 20, 18);
        // Reset textAlign về mặc định
        ctx.textAlign = 'left';

        // Hiển thị mức tương phản mắt lành: "Tương phản mắt lành: YY%"
        const contrastPercent = Math.round(this.healthyAlpha * 100);
        ctx.fillText(`Tương phản mắt lành: ${contrastPercent}%`, 15, 48);

        // ============================================
        // VẼ MẮT NHƯỢC THỊ (Hạt rơi – Left Eye)
        // Alpha luôn cố định ở 1.0 (không thay đổi theo staircase)
        // ============================================
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = this.colors.left; // Màu mắt trái (đỏ trong anaglyph)

        for (const d of this.drops) {
            ctx.fillRect(d.x, d.y, d.width, d.height);
        }

        // ============================================
        // VẼ MẮT LÀNH (Thanh hứng – Right Eye)
        // Alpha thay đổi theo thuật toán Cầu thang Thích ứng
        // healthyAlpha: 1.0 (đầy đủ) → giảm dần khi người chơi thành công
        // ============================================
        ctx.globalAlpha = this.healthyAlpha;
        ctx.fillStyle = this.colors.right; // Màu mắt phải (cyan trong anaglyph)
        ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
    }

    /**
     * Ghi đè stop() để dọn dẹp event listener chuột & touch
     * Đảm bảo không rò rỉ bộ nhớ khi chuyển không gian làm việc
     */
    stop() {
        // Hiện lại chuột khi force stop
        if (this.canvas) {
            this.canvas.style.cursor = 'default';
            this.canvas.removeEventListener('mousemove', this.handleMouseMove);
            this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        }
        super.stop(); // Gọi cha: cancelAnimationFrame, remove DOM, clear SPA listener
    }

    /**
     * Ghi đè start() để ẩn chuột khi bắt đầu chơi
     */
    start() {
        super.start();
        // Ẩn con trỏ chuột khi vào fullscreen gameplay
        this.canvas.style.cursor = 'none';
    }
}

// Xuất module cho ES Module import
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CatchGame };
}

export default CatchGame;

