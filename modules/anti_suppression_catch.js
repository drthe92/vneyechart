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

        // --- Cấu hình Level (gamify) ---
        this.level = 1;                    // Cấp độ hiện tại (1..10)
        this.fallSpeedPxPerSec = 180;      // Vận tốc rơi (px/s) — set theo Level [A1]
        this.spawnIntervalMs = 1000;       // Khoảng sinh hạt (ms) — set theo Level
        this.dropSizePx = 30;              // Kích thước hạt (px) — set theo Level

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
        this.spawnIntervalMs = 1000;       // Khoảng sinh hạt theo Level (mặc định)

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
     * [AUTO-CENTER] Ghi đè hook onResize của Engine:
     * khi cửa sổ đổi kích thước, giữ thanh hứng luôn sát đáy màn hình mới
     * và kẹp vị trí ngang trong giới hạn canvas.
     * @param {number} w  - Chiều rộng canvas mới
     * @param {number} h  - Chiều cao canvas mới
     * @param {number} cx - Tâm ngang mới
     * @param {number} cy - Tâm dọc mới
     */
    onResize(w, h, cx, cy) {
        if (!this.paddle) return;
        this.paddle.y = Math.max(0, h - 40);
        this.paddle.x = Math.max(0, Math.min(this.paddle.x, w - this.paddle.width));
        this._mouseX = Math.max(0, Math.min(this._mouseX, w));
    }

    /**
     * Ánh xạ Level (1..10) → Thông số vật lý nội bộ.
     * Level càng cao: hạt rơi nhanh hơn, thanh hứng hẹp hơn, hạt nhỏ hơn, sinh hạt dày hơn.
     * @param {number|string} level - Cấp độ người dùng chọn (mặc định 1)
     * @returns {number} Level hợp lệ (clamp 1..10)
     */
    _applyLevel(level) {
        const lvl = Math.max(1, Math.min(10, parseInt(level, 10) || 1));
        // Tốc độ rơi: L1 = 3 px/frame (@60fps) → L10 = 7 px/frame
        // [A1] Chuẩn hóa Delta-time: chuyển sang vận tốc px/s (×60) để
        // tốc độ rơi đồng nhất trên mọi refresh rate (60Hz / 144Hz).
        const pxPerFrame = Math.min(7, Math.round((3 + (lvl - 1) * 0.45) * 10) / 10);
        this.fallSpeedPxPerSec = pxPerFrame * 60;
        // Thanh hứng: L1 = 120px → L10 = 60px
        this.paddle.width = Math.max(60, Math.round(120 - (lvl - 1) * 6.67));
        // Kích thước hạt: L1 = 34px → L10 = 20px
        this.dropSizePx = Math.max(20, Math.round(34 - (lvl - 1) * 1.56));
        // Khoảng sinh hạt: L1 = 1000ms → L10 = 500ms
        this.spawnIntervalMs = Math.max(500, 1000 - (lvl - 1) * 55);
        return lvl;
    }

    /**
     * Ghi đè start() để đọc Level từ config và áp dụng thông số vật lý tương ứng
     */
    start(config = {}) {
        this.level = this._applyLevel(config && config.level);
        super.start();
        // Ẩn con trỏ chuột khi vào fullscreen gameplay
        this.canvas.style.cursor = 'none';

        // Khởi tạo AudioContext sớm (sau cử chỉ click của người dùng) để
        // đảm bảo âm thanh phản hồi Đúng/Sai hoạt động ngay từ đầu phiên
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) {
                this._audioCtx = new AC();
                if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
            }
        } catch (e) { /* im lặng */ }
    }

    /**
     * Cập nhật logic vật lý, điểm số và thuật toán Cầu thang Thích ứng
     * Bao gồm: sinh hạt theo thời gian, cập nhật paddle theo chuột, va chạm AABB
     * @param {number} dt - Delta-time (giây) từ Engine [A1]
     */
    update(dt = 0) {
        if (this.gameOver) return;

        // 1. Kiểm tra điều kiện kết thúc: Đạt điểm mục tiêu
        if (this.score >= this.targetScore) {
            this._endGame();
            return;
        }

        // 2. Cập nhật lại bounding rect của canvas (để xử lý resize cửa sổ)
        this._canvasRect = this.canvas.getBoundingClientRect();

        // 3. Sinh hạt mới theo khoảng thời gian (dựa theo Level)
        const now = Date.now();
        if (now - this.lastSpawnTime > this.spawnIntervalMs) {
            this.drops.push({
                x: Math.random() * (this.canvas.width - 30), // Vị trí ngang ngẫu nhiên
                y: -30,                                        // Bắt đầu từ trên mép màn hình
                width: this.dropSizePx,                        // Kích thước hạt vuông theo Level
                height: this.dropSizePx
            });
            this.lastSpawnTime = now; // Reset thời gian sinh
        }

        // 4. Cập nhật vị trí paddle theo tọa độ chuột (căn giữa chuột)
        this.paddle.x = Math.max(0, Math.min(this._mouseX - this.paddle.width / 2, this.canvas.width - this.paddle.width));

        // 5. Duyệt ngược mảng drops để xử lý động học và va chạm (tránh lỗi index khi splice)
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];

            // --- Động học: Cho hạt rơi xuống (tăng trục y) ---
            // [A1] Vận tốc px/s × dt(giây) — tốc độ rơi đồng nhất 60Hz/144Hz
            d.y += this.fallSpeedPxPerSec * dt;

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
                this._playTone(880, 'sine', 0.12);   // Ting (hứng trúng +1 điểm) — pitch cao

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
                this._playTone(160, 'square', 0.18);   // Buzzer (hứng trượt -1 điểm) — pitch thấp

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

        // --- Tỷ lệ hoàn thành (completionRate) = tỷ lệ hứng trúng / tổng lần thử ---
        const totalAttempts = this.hits + this.misses;
        const completionRate = totalAttempts > 0 ? (this.hits / totalAttempts * 100) : 0;

        // --- Mở khóa Level kế tiếp nếu đạt ≥ 80% và chưa phải Level tối đa ---
        // [FIX LEVEL] Đọc/ghi theo từng bệnh nhân (helper trong therapeutic_menu_controller)
        const maxLevel = (typeof window.getTherapyMaxLevel === 'function')
            ? window.getTherapyMaxLevel('M1')
            : (parseInt(localStorage.getItem('vision-therapy-m1-max-level') || '1', 10) || 1);
        let unlockedNew = false;
        if (completionRate >= 80 && this.level >= maxLevel && this.level < 10) {
            if (typeof window.setTherapyMaxLevel === 'function') {
                window.setTherapyMaxLevel('M1', this.level + 1);
            } else {
                localStorage.setItem('vision-therapy-m1-max-level', String(this.level + 1));
            }
            unlockedNew = true;
        }
        // [TỐT NGHIỆP L10] Đồng bộ M4: vượt qua Level 10 = tốt nghiệp module
        const graduated = completionRate >= 80 && this.level >= 10;

        // --- Đóng gói sessionMetrics trước khi stop ---
        this.sessionMetrics.score = this.score;
        this.sessionMetrics.hits = this.hits;
        this.sessionMetrics.misses = this.misses;
        this.sessionMetrics.customData = {
            level: this.level,
            completionRate: completionRate,
            finalAlpha: this.healthyAlpha,
            nextLevelUnlocked: unlockedNew,
            graduated: graduated
        };
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

        // Tỷ lệ chính xác (%)
        const hitRate = totalAttempts > 0 ? Math.round((this.hits / totalAttempts) * 100) : 0;

        // Ngưỡng tương dung hợp (C-Ratio): healthyAlpha cuối cùng
        const cRatio = this.healthyAlpha.toFixed(2);

        const evalColor = completionRate >= 80 ? '#10b981' : '#f87171';
        const evalText = completionRate >= 80
            ? (graduated
                ? '🏆 TỐT NGHIỆP — Bạn đã chinh phục toàn bộ 10 Level!'
                : (unlockedNew ? `ĐẠT — Đã mở khóa Level ${this.level + 1}!` : 'ĐẠT (Hứng hạt ổn định)'))
            : 'CHƯA ĐẠT (Cần hứng trúng ≥ 80% để mở khóa Level kế tiếp)';

        // ============================================
        // TẠO OVERLAY KẾT QUẢ
        // ============================================
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 2147483001;
            background: rgba(15, 23, 42, 0.95);
            color: white;
            display: flex; flex-direction: column; align-items: center; justify-content: safe center;
            text-align: center; padding: 30px; overflow-y: auto;
            font-family: 'Segoe UI', Arial, sans-serif;
        `;

        overlay.innerHTML = `
            <h1 style="font-size: 26px; color: ${evalColor}; margin: 0 0 20px 0;">
                ✅ ${completionRate >= 80 ? 'BÁO CÁO LÂM SÀNG: ĐẠT MỤC TIÊU' : 'BÁO CÁO LÂM SÀNG: HOÀN THÀNH PHIÊN TẬP'}
            </h1>

            <div style="width: 92%; max-width: 620px; background: #1e293b; border-radius: 12px; padding: 14px 22px; margin: 0 auto 20px auto; box-sizing: border-box; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 10px 0; border-bottom: 1px dashed rgba(148, 163, 184, 0.25);"><span style="font-size: 15px; color: #94a3b8;">⭐ Cấp độ đã chinh phục</span><span style="font-size: 17px; font-weight: bold; color: #fbbf24; white-space: nowrap;">Level ${this.level}</span></div>
<div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 10px 0; border-bottom: 1px dashed rgba(148, 163, 184, 0.25);"><span style="font-size: 15px; color: #94a3b8;">📊 Tỷ lệ hoàn thành</span><span style="font-size: 17px; font-weight: bold; color: #22d3ee; white-space: nowrap;">${hitRate}%</span></div>
<div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 10px 0; border-bottom: 1px dashed rgba(148, 163, 184, 0.25);"><span style="font-size: 15px; color: #94a3b8;">⏱ Thời gian</span><span style="font-size: 17px; font-weight: bold; color: #e2e8f0; white-space: nowrap;">${timeSec} giây</span></div>
<div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 10px 0; border-bottom: 1px dashed rgba(148, 163, 184, 0.25);"><span style="font-size: 15px; color: #94a3b8;">🎯 Hứng trúng</span><span style="font-size: 17px; font-weight: bold; color: #10b981; white-space: nowrap;">${this.hits}</span></div>
<div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 10px 0; border-bottom: 1px dashed rgba(148, 163, 184, 0.25);"><span style="font-size: 15px; color: #94a3b8;">❌ Hứng trượt</span><span style="font-size: 17px; font-weight: bold; color: #ef4444; white-space: nowrap;">${this.misses}</span></div>
<div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 10px 0; border-bottom: 1px dashed rgba(148, 163, 184, 0.25);"><span style="font-size: 15px; color: #94a3b8;">🔬 Ngưỡng tương phản dung hợp (C-Ratio)</span><span style="font-size: 17px; font-weight: bold; color: #60a5fa; white-space: nowrap;">${cRatio}</span></div>
            </div>

            <p style="font-size: 17px; color: ${evalColor}; margin: 0 0 20px 0; font-weight: bold;">${evalText}</p>

            <button id="btn-next-module" style="
                padding: 14px 44px; font-size: 17px; cursor: pointer;
                background: #3b82f6; color: white; border: none; border-radius: 8px;
                font-weight: bold; transition: background 0.3s;
            ">Trở về Lobby</button>
        `;

        // Thêm overlay vào body
        document.body.appendChild(overlay);

        // Sự kiện hover cho nút
        const nextBtn = document.getElementById('btn-next-module');
        nextBtn.onmouseover = () => nextBtn.style.background = '#2563eb';
        nextBtn.onmouseout = () => nextBtn.style.background = '#3b82f6';

        // ============================================
        // ĐÓNG OVERLAY: Trả người dùng về Lobby chọn bài tiếp theo
        // ============================================
        nextBtn.onclick = () => {
            // Xóa overlay
            document.body.removeChild(overlay);

            // Trở về Sảnh game (menu huấn luyện) — dùng chung closeTherapyModule:
            // dừng game nếu còn chạy, dọn canvas, thoát fullscreen và vẽ lại Lobby.
            if (typeof window.closeTherapyModule === 'function') {
                window.closeTherapyModule();
            } else {
                // Fallback an toàn: thoát fullscreen (fullscreenchange tự về Lobby)
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                }
            }
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
     * Phát âm thanh phản hồi (ting / buzzer) qua WebAudio
     * @param {number} freq - Tần số (Hz)
     * @param {string} type - Dạng sóng ('sine' | 'square')
     * @param {number} duration - Thời lượng (giây)
     */
    _playTone(freq, type, duration) {
        try {
            if (!this._audioCtx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return;
                this._audioCtx = new AC();
            }
            const ctx = this._audioCtx;
            if (ctx.state === 'suspended') ctx.resume();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration + 0.02);
        } catch (e) {
            // Im lặng nếu trình duyệt chặn audio
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
        ctx.fillText(`Điểm số: ${this.score} / 30 | Level ${this.level}`, 15, 18);

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
}

// Xuất module cho ES Module import
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CatchGame };
}

export default CatchGame;

