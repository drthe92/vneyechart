/**
 * Module 1: Anti-suppression Catch (Hứng hạt)
 * 
 * Trò chơi huấn luyện thị giác hai mắt (Dichoptic):
 * - Hạt màu (Left Eye): Rơi từ trên xuống, kích thích mắt trái
 * - Thanh hứng (Right Eye): Di chuyển ngang bằng chuột, kích thích mắt phải
 * - Mục tiêu: Ngăn ngừa ức chế mắt (suppression) bằng cách duy trì hoạt động đồng thời hai mắt
 * 
 * Kế thừa từ BinocularGameEngine để tái sử dụng:
 * - Ràng buộc y khoa: Kiểm tra anaglyph colors, canvas setup
 * - Môi trường quang học: super.render() tạo nền trắng + viền đen khóa dung hợp
 * - Quản lý bộ nhớ: start/stop lifecycle
 */

class CatchGame extends BinocularGameEngine {
    /**
     * Khởi tạo trò chơi Catch
     * Thiết lập vật thể rơi (hạt màu left-eye) và thanh hứng (right-eye)
     */
    constructor() {
        super(); // Khởi tạo cha: kiểm tra anaglyphColors, tạo canvas, bind event SPA

        // --- Cấu hình trò chơi ---
        this.score = 0;              // Điểm số (hứng trúng hạt)
        this.spawnRate = 45;         // Tần suất tạo hạt mới (mỗi 45 frames ≈ 0.75s @ 60fps)
        this.frameCount = 0;         // Đếm frame để trigger spawn

        // --- Vật thể rơi: Mảng hạt màu left-eye (đỏ) ---
        this.particles = [];

        // --- Thanh hứng: Right-eye (cyan) ở đáy màn hình ---
        this.catcher = {
            x: this.canvas.width / 2 - 60,   // Căn giữa ban đầu
            y: this.canvas.height - 40,       // Cách đáy 40px
            width: 120,                        // Chiều rộng thanh hứng
            height: 20                         // Chiều cao thanh hứng
        };

        // --- Sự kiện chuột: Điều khiển thanh hứng ngang màn hình ---
        this.handleMouseMove = this._handleMouseMove.bind(this);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);

        // Hỗ trợ touch device (di chuyển ngón tay để trượt thanh hứng)
        this.handleTouchMove = this._handleTouchMove.bind(this);
        this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    }

    /**
     * Xử lý sự kiện di chuyển chuột → cập nhật vị trí thanh hứng
     * Giới hạn trong biên canvas để không bị tràn ra ngoài
     * @param {MouseEvent} e
     */
    _handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        this.catcher.x = Math.max(0, Math.min(mouseX - this.catcher.width / 2, this.canvas.width - this.catcher.width));
    }

    /**
     * Xử lý sự kiện swipe trên thiết bị cảm ứng
     * @param {TouchEvent} e
     */
    _handleTouchMove(e) {
        if (e.touches.length === 0) return;
        const rect = this.canvas.getBoundingClientRect();
        const touchX = e.touches[0].clientX - rect.left;
        this.catcher.x = Math.max(0, Math.min(touchX - this.catcher.width / 2, this.canvas.width - this.catcher.width));
    }

    /**
     * Tạo hạt mới ngẫu nhiên ở mép trên màn hình
     * Hạt có kích thước và tốc độ rơi khác nhau để tăng độ thách thức
     */
    _spawnParticle() {
        const size = 18 + Math.random() * 16; // Kích thước: 18–34px
        this.particles.push({
            x: Math.random() * (this.canvas.width - size), // Vị trí ngang ngẫu nhiên
            y: -size,                                        // Bắt đầu từ trên mép màn hình
            size: size,                                      // Kích thước hạt
            speed: 2 + Math.random() * 2.5                  // Tốc độ rơi: 2–4.5 px/frame
        });
    }

    /**
     * Cập nhật logic vật lý và điểm số
     * Được subclass ghi đè hoàn toàn từ BinocularGameEngine.update()
     */
    update() {
        this.frameCount++;

        // 1. Tạo hạt mới theo chu kỳ spawnRate
        if (this.frameCount % this.spawnRate === 0) {
            this._spawnParticle();
        }

        // 2. Duyệt ngược mảng để xử lý (tránh lỗi index khi splice)
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Cập nhật tọa độ Y (rơi xuống)
            p.y += p.speed;

            // --- AABB Collision Detection: Va chạm hạt ↔ thanh hứng ---
            if (
                p.x < this.catcher.x + this.catcher.width &&     // Ranh trái hạt < Ranh phải thanh
                p.x + p.size > this.catcher.x &&                 // Ranh phải hạt > Ranh trái thanh
                p.y < this.catcher.y + this.catcher.height &&    // Ranh trên hạt < Ranh dưới thanh
                p.y + p.size > this.catcher.y                     // Ranh dưới hạt > Ranh trên thanh
            ) {
                // Hứng trúng: cộng điểm + xóa hạt khỏi mảng
                this.score++;
                this.particles.splice(i, 1);
                continue;
            }

            // Xóa hạt nếu rơi ra khỏi dưới màn hình (không được hứng)
            if (p.y > this.canvas.height) {
                this.particles.splice(i, 1);
            }
        }
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

        // B. Vẽ thanh hứng (Right Eye – màu cyan)
        ctx.fillStyle = this.colors.right;
        ctx.fillRect(this.catcher.x, this.catcher.y, this.catcher.width, this.catcher.height);

        // C. Vẽ các hạt rơi (Left Eye – màu đỏ)
        ctx.fillStyle = this.colors.left;
        for (const p of this.particles) {
            ctx.beginPath();
            ctx.arc(
                p.x + p.size / 2,           // Tâm X
                p.y + p.size / 2,           // Tâm Y
                p.size / 2,                 // Bán kính
                0,                          // Góc bắt đầu
                Math.PI * 2                 // Góc kết thúc (full circle)
            );
            ctx.fill();
        }

        // D. Hiển thị điểm số (màu đen – cả hai mắt cùng nhìn thấy, không phân biệt mắt)
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(`Điểm: ${this.score}`, 15, 18);
    }

    /**
     * Ghi đè stop() để dọn dẹp event listener chuột & touch
     * Đảm bảo không rò rỉ bộ nhớ khi chuyển không gian làm việc
     */
    stop() {
        // Dọn dẹp event listener trước khi unmount canvas
        if (this.canvas) {
            this.canvas.removeEventListener('mousemove', this.handleMouseMove);
            this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        }
        super.stop(); // Gọi cha: cancelAnimationFrame, remove DOM, clear SPA listener
    }
}

// Xuất module cho ES Module import
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CatchGame };
}
