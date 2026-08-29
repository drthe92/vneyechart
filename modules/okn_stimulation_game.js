/**
 * Module 10: OKN Tracker (Optokinetic Nystagmus — Rung giật nhãn cầu)
 *
 * Mục tiêu y khoa: Kích thích phản xạ rung giật nhãn cầu (OKN) để phá vỡ
 * định thị ngoại tâm. BẮT BUỘC ĐƠN THỊ (Monocular): Bịt/che mắt lành,
 * chỉ để mắt nhược thị quan sát.
 *
 * Kế thừa BinocularGameEngine để tái sử dụng kiểm tra hiệu chuẩn & quản lý bộ nhớ.
 *
 * Đồ họa:
 * - Lớp Nền (Passive OKN): Sọc Đen (#000000) / Trắng (#FFFFFF) tỷ lệ 1:1,
 *   trôi vô tận 1 hướng (thuật toán Modulo).
 * - Lớp Tương tác (Active Fixation): Đốm sáng tròn Đỏ rực (#FF0000) xuất hiện
 *   ngẫu nhiên 1.5–2s (Nâng cao: trôi chậm ngược chiều sọc).
 *
 * Tương tác: Click/Chạm đốm sáng. Trúng -> "Ting" (Web Audio) + biến mất.
 * Trượt (hết giờ) -> Mất, KHÔNG có âm thanh. Hitbox bù trừ 15px cho trẻ em.
 *
 * Dữ liệu đầu ra: customData = { stripeSpeed, direction, targetsSpawned,
 * targetsHit, accuracy, avgReactionTimeMs }.
 */

import BinocularGameEngine from './binocular_game_engine.js';

class OKNStimulationGame extends BinocularGameEngine {
    constructor() {
        super(); // Khởi tạo cha: kiểm tra hiệu chuẩn, tạo canvas, bind SPA listener

        // --- Tên game cho EMR identification (chứa 'M10' để parse báo cáo) ---
        this.gameName = 'M10: Kích thích phản xạ OKN (Optokinetic Nystagmus)';

        // ============================================================
        // CẤU HÌNH ĐƠN NHÃN (Monocular) — Vô hiệu hóa hoàn toàn Anaglyph.
        // Chuẩn Đen (#000000) / Trắng (#FFFFFF) / Đỏ thuần (#FF0000).
        // ============================================================
        this.colors = {
            bg: '#000000',
            stripeWhite: '#FFFFFF',
            stripeBlack: '#000000',
            target: '#FF0000',
            hud: '#FF0000',
            lock: '#FF0000'
        };

        // --- Hằng số lâm sàng ---
        this.TOTAL_TARGETS = 30;          // Tổng số đốm sáng trong phiên
        this.MIN_LIFE_MS = 1500;          // Thời gian tồn tại tối thiểu đốm sáng
        this.MAX_LIFE_MS = 2000;          // Thời gian tồn tại tối đa đốm sáng
        this.SPAWN_GAP_MS = 600;          // Khoảng nghỉ giữa các đốm
        this.HITBOX_BONUS = 15;           // Bù trừ hitbox cho trẻ em (px)

        // --- Trạng thái phiên ---
        this.targetsSpawned = 0;
        this.targetsHit = 0;
        this._reactionTimes = [];         // ms phản xạ các lượt trúng

        // --- Cấu hình từ Lobby (mặc định) ---
        this.stripeWidth = 40;            // px (nửa chu kỳ: 1 sọc đen + 1 sọc trắng)
        this.stripeSpeed = 160;           // px/s
        this.direction = 'LTR';           // 'LTR' | 'RTL'

        // --- Trạng thái đồ họa ---
        this.offsetX = 0;                 // Dịch chuyển sọc tích lũy (px)
        this._lastTime = 0;

        // --- Trạng thái đốm sáng ---
        this._target = null;              // { x, y, r, bornAt, expiresAt, vx }
        this._nextSpawnAt = 0;            // timestamp sinh đốm tiếp theo

        // --- Sự kiện Pointer (chuột + cảm ứng) ---
        this._onPointerDown = (e) => {
            if (!this._running || !this._target) return;
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const px = (e.clientX - rect.left) * scaleX;
            const py = (e.clientY - rect.top) * scaleY;
            this._handleClick(px, py);
        };
    }

    /**
     * Khởi chạy game với cấu hình từ Lobby
     * @param {Object} config - { stripeSize, direction, speed }
     */
    start(config = {}) {
        // Cấu hình kích thước sọc (nửa chu kỳ)
        const stripeSize = (config && config.stripeSize) ? config.stripeSize : 'Vừa';
        const sizeFactor = (
            stripeSize === 'Lớn' ? 0.09 :
            stripeSize === 'Nhỏ' ? 0.035 : 0.055
        );

        // Cấu hình hướng trôi
        this.direction = (config && config.direction === 'RTL') ? 'RTL' : 'LTR';

        // Cấu hình tốc độ sọc (px/s)
        const speed = (config && config.speed) ? config.speed : 'Vừa';
        this.stripeSpeed = (
            speed === 'Chậm' ? 90 :
            speed === 'Nhanh' ? 260 : 160
        );

        // Reset trạng thái phiên
        this.targetsSpawned = 0;
        this.targetsHit = 0;
        this._reactionTimes = [];
        this.offsetX = 0;
        this._lastTime = 0;
        this._target = null;

        // Khởi tạo AudioContext sớm (sau cử chỉ click của người dùng)
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) {
                this._audioCtx = new AC();
                if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
            }
        } catch (e) { /* im lặng */ }

        // Bắt đầu render loop
        super.start();

        // Gắn sự kiện pointer
        if (this.canvas) {
            this.canvas.addEventListener('pointerdown', this._onPointerDown);
        }

        // Lên lịch sinh đốm đầu tiên sau một chút
        this._nextSpawnAt = performance.now() + 800;
    }

    /**
     * Xử lý click/chạm vào đốm sáng
     * @param {number} px - Tọa độ x trong không gian canvas
     * @param {number} py - Tọa độ y trong không gian canvas
     */
    _handleClick(px, py) {
        if (!this._target) return;
        const dx = px - this._target.x;
        const dy = py - this._target.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Hitbox bù trừ 15px cho trẻ em
        if (dist <= this._target.r + this.HITBOX_BONUS) {
            // TRÚNG
            this.targetsHit += 1;
            const rt = performance.now() - this._target.bornAt;
            this._reactionTimes.push(rt);
            this._playTone(880, 'sine', 0.12);   // Ting (đúng) — pitch cao
            this._clearTarget();
            this._nextSpawnAt = performance.now() + this.SPAWN_GAP_MS;
        }
        // Trượt (click ngoài hitbox): KHÔNG có âm thanh, đốm vẫn tiếp tục đến hết giờ
    }

    /**
     * Sinh đốm sáng đỏ tại vị trí ngẫu nhiên, trôi chậm ngược chiều sọc
     */
    _spawnTarget() {
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        const r = Math.max(18, Math.min(cw, ch) * 0.04); // bán kính đốm sáng

        const x = r + Math.random() * (cw - 2 * r);
        const y = r + Math.random() * (ch - 2 * r);

        // Trôi ngược chiều sọc (LTR: sọc sang phải -> đốm sang trái)
        const driftSpeed = Math.min(100, this.stripeSpeed * 0.3);
        const vx = (this.direction === 'LTR') ? -driftSpeed : driftSpeed;

        const life = this.MIN_LIFE_MS + Math.random() * (this.MAX_LIFE_MS - this.MIN_LIFE_MS);
        const now = performance.now();

        this._target = { x, y, r, bornAt: now, expiresAt: now + life, vx };
        this.targetsSpawned += 1;
    }

    /**
     * Xóa đốm sáng hiện tại
     */
    _clearTarget() {
        this._target = null;
    }

    /**
     * Cập nhật logic mỗi frame
     */
    update() {
        if (!this._running) return;

        const now = performance.now();
        const dt = this._lastTime ? (now - this._lastTime) : 16;
        this._lastTime = now;

        // A. Dịch chuyển sọc (trôi vô tận)
        this.offsetX += this.stripeSpeed * (dt / 1000);

        // B. Cập nhật vị trí đốm sáng (trôi ngược chiều)
        if (this._target) {
            const cw = this.canvas.width;
            this._target.x += this._target.vx * (dt / 1000);
            // Giữ đốm nằm trong màn hình
            if (this._target.x < this._target.r) {
                this._target.x = this._target.r;
                this._target.vx = Math.abs(this._target.vx);
            } else if (this._target.x > cw - this._target.r) {
                this._target.x = cw - this._target.r;
                this._target.vx = -Math.abs(this._target.vx);
            }

            // Hết giờ -> TRƯỢT (mất, không âm thanh)
            if (now >= this._target.expiresAt) {
                this._clearTarget();
                this._nextSpawnAt = now + this.SPAWN_GAP_MS;
            }
        } else {
            // Chưa có đốm: đến giờ thì sinh đốm mới
            if (now >= this._nextSpawnAt) {
                if (this.targetsSpawned >= this.TOTAL_TARGETS) {
                    this.endGame();
                    return;
                }
                this._spawnTarget();
            }
        }
    }

    /**
     * Phát âm thanh phản hồi (ting) qua WebAudio
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
     * Render đồ họa — ÉP ĐƠN NHÃN, Nền sọc Đen/Trắng + Đốm sáng Đỏ.
     */
    render() {
        if (!this._running || !this.ctx) return;

        const ctx = this.ctx;

        // Reset các thuộc tính rò rỉ
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.imageSmoothingEnabled = false;
        ctx.shadowBlur = 0;

        // A. Nền sọc Đen/Trắng trôi vô tận (thuật toán Modulo)
        const sw = this.stripeWidth;
        let startX = (this.direction === 'LTR' ? this.offsetX : -this.offsetX) % (sw * 2);
        if (startX > 0) startX -= (sw * 2);
        let colorToggle = true;
        for (let x = startX; x < this.canvas.width; x += sw) {
            ctx.fillStyle = colorToggle ? this.colors.stripeWhite : this.colors.stripeBlack;
            ctx.fillRect(x, 0, sw, this.canvas.height);
            colorToggle = !colorToggle;
        }

        // B. Đốm sáng Đỏ rực (Active Fixation)
        if (this._target) {
            const t = this._target;
            ctx.save();
            ctx.shadowColor = this.colors.target;
            ctx.shadowBlur = 24;
            ctx.fillStyle = this.colors.target;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // C. HUD tối giản (đỏ thuần) — không gây nhiễu định thị
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = this.colors.hud;
        ctx.font = 'bold 20px monospace';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillText(`Đốm: ${this.targetsHit} / ${this.targetsSpawned}`, 16, 16);
        ctx.textAlign = 'left';
    }

    /**
     * Kết thúc phiên: Đóng gói payload EMR và báo cáo
     */
    endGame() {
        if (!this._running) return;

        const accuracy = this.targetsSpawned > 0
            ? (this.targetsHit / this.targetsSpawned) * 100
            : 0;

        const avgReactionTimeMs = this._reactionTimes.length > 0
            ? Math.round(this._reactionTimes.reduce((a, b) => a + b, 0) / this._reactionTimes.length)
            : 0;

        // Đóng gói customData theo đặc tả
        this.sessionMetrics.customData = {
            stripeSpeed: this.stripeSpeed,
            direction: this.direction,
            targetsSpawned: this.targetsSpawned,
            targetsHit: this.targetsHit,
            accuracy: accuracy,
            avgReactionTimeMs: avgReactionTimeMs
        };
        this.sessionMetrics.hits = this.targetsHit;
        this.sessionMetrics.misses = this.targetsSpawned - this.targetsHit;

        this.finishSession();
        this.stop();
    }

    /**
     * Ghi đè stop() để dọn dẹp sự kiện pointer
     */
    stop() {
        if (this.canvas) {
            this.canvas.removeEventListener('pointerdown', this._onPointerDown);
        }
        super.stop();
    }
}

// Xuất toàn cục cho menu controller (classRef dạng chuỗi)
if (typeof window !== 'undefined') {
    window.OKNStimulationGame = OKNStimulationGame;
}

export default OKNStimulationGame;
