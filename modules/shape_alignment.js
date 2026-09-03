/**
 * Module 2: Shape Alignment Game (Khớp khung - MFBF - Monocular Fixation Binocular Fusion)
 *
 * Trò chơi huấn luyện định thị Fovea và chống nhiễu đám đông (Crowding):
 * - Target Shape (Left Eye/Cyan): Khung rỗng tĩnh, viền dày, kích thước theo Level
 * - Player Shape (Right Eye/Red): Khối đặc động, kích thước bằng target, di chuyển theo chuột
 * - Mục tiêu: Kéo khối vào khung và GIỮ YÊN đủ Hold Time để khớp khung thành công
 * - Mỗi phiên chơi 1 Level: PHẢI khớp khung 5 lần LIÊN TIẾP (không trượt giữa chừng
 *   trong lúc đang đếm ngược Hold Time) để qua màn và mở khóa Level kế tiếp.
 *
 * Bảng độ khó 10 mức (M2_LEVELS):
 * - sizePx    : Kích thước khung & khối (To 20% màn hình → Siêu nhỏ 20px)
 * - holdTimeMs: Thời gian duy trì giữ yên (1s → 3s)
 * - noise     : Độ nhiễu nền (0 = trơn, 1 = vài đốm, 2 = đốm nhấp nháy rải màn, 3 = "rừng" nhiễu động)
 */

import BinocularGameEngine from './binocular_game_engine.js';

// ============================================================
// BẢNG ĐỘ KHÓ 10 MỨC (M2)
// ============================================================
const M2_LEVELS = [
    { level: 1,  sizePx: 180, holdTimeMs: 1000, noise: 0 },
    { level: 2,  sizePx: 160, holdTimeMs: 1000, noise: 0 },
    { level: 3,  sizePx: 140, holdTimeMs: 1000, noise: 0 },
    { level: 4,  sizePx: 110, holdTimeMs: 2000, noise: 1 },
    { level: 5,  sizePx: 90,  holdTimeMs: 2000, noise: 1 },
    { level: 6,  sizePx: 70,  holdTimeMs: 2000, noise: 1 },
    { level: 7,  sizePx: 50,  holdTimeMs: 3000, noise: 2 },
    { level: 8,  sizePx: 40,  holdTimeMs: 3000, noise: 2 },
    { level: 9,  sizePx: 30,  holdTimeMs: 3000, noise: 2 },
    { level: 10, sizePx: 20,  holdTimeMs: 3000, noise: 3 }
];

const M2_NOISE_LABELS = ['Trơn', 'Vài đốm nhiễu', 'Nhiễu động rải màn', 'Rừng nhiễu động'];
const M2_PASS_STREAK = 5;    // Số lần khớp khung LIÊN TIẾP để qua màn
const M2_MAX_ATTEMPTS = 15;  // Tối đa số lần khớp trong 1 phiên (quá = CHƯA ĐẠT)

class ShapeAlignmentGame extends BinocularGameEngine {
    /**
     * Khởi tạo trò chơi Shape Alignment
     * Thiết lập trạng thái game, vị trí ban đầu, và event SPA
     */
    constructor() {
        super(); // Khởi tạo cha: kiểm tra anaglyphColors, tạo canvas, bind event SPA

        // --- Tên game cho EMR identification ---
        this.gameName = 'M2: Khớp khung (Flat Fusion)';

        // --- Trạng thái cấp độ (đọc từ Lobby qua config) ---
        this.level = 1;
        this.sizePx = 140;        // Kích thước khung/khối (px) — theo bảng M2_LEVELS
        this.holdTimeMs = 1000;   // Thời gian giữ yên để khớp khung (ms)
        this.noise = 0;           // Mức nhiễu nền (0..3)

        // --- Trạng thái phiên ---
        this.streak = 0;          // Số lần khớp liên tiếp hiện tại
        this.attempts = 0;        // Tổng số lần khớp đã thực hiện (giới hạn phiên)
        this.state = 'PLAYING';   // 'PLAYING' | 'ENDED'
        this.alignState = 'SEEKING'; // 'SEEKING' (chưa vào khung) | 'HOLDING' (đang đếm giữ)
        this.holdStart = 0;       // timestamp bắt đầu hold

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
     * Bắt đầu phiên ở 1 Level do Lobby truyền vào
     * @param {Object} config - { level }
     */
    start(config = {}) {
        this.level = this._applyLevel(config && config.level);
        this._randomizeTargetPosition();
        super.start();
        this.canvas.style.cursor = 'none';
    }

    /**
     * Ánh xạ Level → cấu hình bảng M2_LEVELS
     * @param {number|string} level
     * @returns {number} Level hợp lệ (clamp 1..10)
     */
    _applyLevel(level) {
        const lvl = Math.max(1, Math.min(10, parseInt(level, 10) || 1));
        const cfg = M2_LEVELS.find(l => l.level === lvl) || M2_LEVELS[0];
        this.sizePx = cfg.sizePx;
        this.holdTimeMs = cfg.holdTimeMs;
        this.noise = cfg.noise;
        return lvl;
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
     * Random vị trí target trong canvas (giữ margin an toàn 80px từ mép)
     */
    _randomizeTargetPosition() {
        const margin = 80;
        this.targetPos.x = margin + Math.random() * (this.canvas.width - margin * 2);
        this.targetPos.y = margin + Math.random() * (this.canvas.height - margin * 2);
        // Reset trạng thái khớp của bàn mới
        this.alignState = 'SEEKING';
        this.holdStart = 0;
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
     * Cập nhật logic §ước khớp khung & cơ chế Hold Time
     * - SEEKING → (player vào trong khung) → HOLDING, bắt đầu đếm giữ
     * - HOLDING → đủ holdTimeMs → khớp khung THÀNH CÔNG (streak++),
     *             sinh khung mới; chưa đủ mà ra ngoài → TRƯỢT (streak = 0)
     */
    update() {
        if (this.state !== 'PLAYING') return;

        const dist = this._euclideanDistance();
        // Dung hợp (Fusion Lock): Sai số tâm tối đa 5 pixel
        const inTarget = dist <= 5;

        if (inTarget) {
            if (this.alignState === 'SEEKING') {
                // Bắt đầu đếm giữ
                this.alignState = 'HOLDING';
                this.holdStart = performance.now();
            } else if (this.alignState === 'HOLDING') {
                // Kiểm tra đủ Hold Time → Khớp khung thành công
                if (performance.now() - this.holdStart >= this.holdTimeMs) {
                    this._onAlignComplete();
                }
            }
        } else {
            if (this.alignState === 'HOLDING') {
                // TRƯỢT giữa chừng lúc đang đếm ngược Hold → phá vỡ chuỗi liên tiếp
                this.streak = 0;
            }
            this.alignState = 'SEEKING';
            this.holdStart = 0;

            // Giới hạn thời gian mỗi bàn: phải khớp được trong 30s?
            // (Không giới hạn — chờ trẻ từ từ kiểm soát chuột)
        }
    }

    /**
     * Xử lý khi 1 lần khớp khung thành công
     * @private
     */
    _onAlignComplete() {
        this.streak += 1;
        this.attempts += 1;

        // Đạt 5 lần liên tiếp → QUA MÀN
        if (this.streak >= M2_PASS_STREAK) {
            this._endGame(true);
            return;
        }

        // Quá số lần khớp tối đa trong 1 phiên mà chưa đủ chuỗi → CHƯA ĐẠT
        if (this.attempts >= M2_MAX_ATTEMPTS) {
            this._endGame(false);
            return;
        }

        // Sang bàn mới (khung mới ở vị trí ngẫu nhiên)
        this._randomizeTargetPosition();
    }

    /**
     * Render đồ họa trò chơi
     * Áp dụng Crowding Effect: Target khung rỗng + 4 vạch nhiễu + Player khối đặc + Đốm nhiễu nền
     */
    render() {
        // Bắt buộc gọi super.render() ở dòng đầu
        super.render();
        const ctx = this.ctx;
        ctx.globalCompositeOperation = 'source-over';

        const targetSize = this.sizePx;
        const playerSize = Math.max(8, targetSize - 8); // Player nhỏ hơn 8px để lọt khít
        const gap = Math.max(4, this.sizePx * 0.15);
        const barThickness = Math.max(3, targetSize * 0.06);

        const now = performance.now();
        const progress = this.alignState === 'HOLDING'
            ? Math.min(1, (now - this.holdStart) / this.holdTimeMs)
            : 0;

        // --- A. Vẽ Đốm nhiễu nền (Crowding Noise) theo mức noise ---
        if (this.noise > 0) {
            const count = this.noise === 1 ? 6 : this.noise === 2 ? 16 : 28;
            const blinkSpeed = this.noise >= 2 ? 4 : 0.8;
            for (let i = 0; i < count; i++) {
                // Vị trí ngẫu nhiên ổn định theo seed i (không nhảy múa vị trí)
                const seed = (i * 7919) % 997;
                const nx = ((seed * 73) % (this.canvas.width - 40)) + 20;
                const ny = ((seed * 37 + i * 13) % (this.canvas.height - 40)) + 20;
                // Nhấp nháy: alpha dao động theo thời gian (nhiễu ĐỘNG)
                const alpha = this.noise === 1
                    ? 0.12
                    : 0.12 + 0.28 * (0.5 + 0.5 * Math.sin(now / 1000 * blinkSpeed + i * 1.7));
                ctx.fillStyle = `rgba(100, 100, 100, ${alpha.toFixed(3)})`;
                const dotR = this.noise === 1 ? 3 : (this.noise === 2 ? 4 : 5);
                ctx.beginPath();
                ctx.arc(nx, ny, dotR, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // --- B. Vẽ Text HUD ---
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(`Level ${this.level}/10 | Chuỗi khớp: ${this.streak}/${M2_PASS_STREAK} | Lần khớp: ${this.attempts}/${M2_MAX_ATTEMPTS}`, 15, 15);

        // Thanh tiến trình hold
        const barWidth = 200;
        const barHeight = 14;
        const barX = 15;
        const barY = 42;
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

        // Cấu hình Level đang chơi
        ctx.fillStyle = '#334155';
        ctx.font = '12px Arial, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(`Khung ${targetSize}px | Giữ ${(this.holdTimeMs / 1000).toFixed(1)}s | Nền: ${M2_NOISE_LABELS[this.noise] || 'Trơn'}`, 15, 66);

        // Hướng dẫn ESC mờ ở góc phải
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.font = '14px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('[ESC] Thoát', this.canvas.width - 15, 15);
        ctx.textAlign = 'left'; // Reset
        ctx.textBaseline = 'alphabetic';

        // --- C. Vẽ Mắt Nhược thị (Target & Flanking Bars) ---
        ctx.strokeStyle = this.colors.left; // Cyan cho mắt nhược thị
        ctx.fillStyle = this.colors.left;
        ctx.lineWidth = Math.max(3, targetSize * 0.05);

        // Tọa độ tâm Target
        const tx = this.targetPos.x;
        const ty = this.targetPos.y;

        // Vẽ Target (Khung rỗng) với cạnh targetSize, tại tâm this.targetPos
        ctx.strokeRect(tx - targetSize / 2, ty - targetSize / 2, targetSize, targetSize);

        // Vẽ 4 Thanh nhiễu (Crowding Bars)
        ctx.fillRect(tx - targetSize / 2, ty - targetSize / 2 - gap - barThickness, targetSize, barThickness);
        ctx.fillRect(tx - targetSize / 2, ty + targetSize / 2 + gap, targetSize, barThickness);
        ctx.fillRect(tx - targetSize / 2 - gap - barThickness, ty - targetSize / 2, barThickness, targetSize);
        ctx.fillRect(tx + targetSize / 2 + gap, ty - targetSize / 2, barThickness, targetSize);

        // --- D. Vẽ Mắt Lành (Player) ---
        ctx.fillStyle = this.colors.right; // Đỏ cho mắt lành
        const px = this.playerPos.x - playerSize / 2;
        const py = this.playerPos.y - playerSize / 2;
        ctx.fillRect(px, py, playerSize, playerSize);
    }

    /**
     * Kết thúc phiên (qua màn hoặc hết giới hạn lượt)
     * @param {boolean} passed - Đạt 5 lần liên tiếp?
     * @private
     */
    _endGame(passed) {
        this.state = 'ENDED';

        // Mở khóa Level kế tiếp nếu QUA MÀN và chưa phải Level tối đa
        const LEVEL_KEY = 'vision-therapy-m2-max-level';
        const maxLevel = parseInt(localStorage.getItem(LEVEL_KEY) || '1', 10) || 1;
        let unlockedNew = false;
        if (passed && this.level >= maxLevel && this.level < 10) {
            localStorage.setItem(LEVEL_KEY, String(this.level + 1));
            unlockedNew = true;
        }

        // Quy đổi kích thước → Góc thị giác (Visual Angle - Độ)
        const visualAngleDeg = this.pixelsToVisualAngle(this.sizePx);

        // Đóng gói sessionMetrics trước khi stop
        this.sessionMetrics.level = this.level;
        this.sessionMetrics.customData = {
            level: this.level,
            passed: passed,
            streak: this.streak,
            attempts: this.attempts,
            sizePx: this.sizePx,
            holdTimeMs: this.holdTimeMs,
            noiseLevel: this.noise,
            visualAngleDeg: visualAngleDeg,
            nextLevelUnlocked: unlockedNew
        };
        this.finishSession();

        this.canvas.style.cursor = 'default';
        this.stop();

        const overlayId = 'shape-alignment-end-overlay';
        const oldOverlay = document.getElementById(overlayId);
        if (oldOverlay) oldOverlay.remove();

        const evalColor = passed ? '#34d399' : '#f87171';
        const evalText = passed
            ? (unlockedNew ? `🏆 QUA MÀN — Đã mở khóa Level ${this.level + 1}!` : '🏆 QUA MÀN — Chuỗi khớp hoàn hảo!')
            : 'CHƯA ĐẠT — Chưa đủ 5 lần khớp LIÊN TIẾP (trượt làm gãy chuỗi). Hãy thử lại!';

        const overlay = document.createElement('div');
        overlay.id = overlayId;
        overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,0.95); display:flex; align-items:center; justify-content:center; flex-direction:column; color:white; text-align:center; padding:40px;';

        overlay.innerHTML = `
            <h1 style="font-size:32px; color:${evalColor}; margin-bottom:20px;">${passed ? 'BÁO CÁO LÂM SÀNG: QUA MÀN' : 'BÁO CÁO LÂM SÀNG: HOÀN THÀNH PHIÊN TẬP'}</h1>
            <div style="max-width:600px; padding:20px; border:2px solid ${evalColor}; border-radius:12px; background:rgba(52,211,153,0.08); margin-bottom:20px;">
                <p style="font-size:18px; margin:8px 0;"><strong>Level:</strong> <span style="color:#fbbf24;">${this.level}/10</span>
                <strong style="margin-left:20px;">Chuỗi khớp:</strong> <span style="color:#22d3ee;">${this.streak}/${M2_PASS_STREAK} lần liên tiếp</span>
                <strong style="margin-left:20px;">Tổng lần khớp:</strong> <span>${this.attempts}/${M2_MAX_ATTEMPTS}</span></p>
                <p style="font-size:16px; margin:8px 0;"><strong>Cấu hình:</strong> Khung ${this.sizePx}px | Giữ yên ${(this.holdTimeMs / 1000).toFixed(1)}s | Nền: ${M2_NOISE_LABELS[this.noise] || 'Trơn'}</p>
                <p style="font-size:16px; margin:8px 0; color:#94a3b8;"><strong>Góc thị giác Foveal:</strong> <span style="color:#fbbf24; font-size:20px;">${visualAngleDeg.toFixed(2)}°</span></p>
            </div>
            <p style="font-size:18px; color:${evalColor}; margin:0 0 20px 0; font-weight:bold;">${evalText}</p>
            <button id="btn-go-module3" style="padding:15px 40px; font-size:20px; background:#3b82f6; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">Trở về Lobby</button>
        `;

        document.body.appendChild(overlay);

        document.getElementById('btn-go-module3').addEventListener('click', () => {
            overlay.remove();
            // Thoát fullscreen để về lại workspace Phòng tập (Lobby)
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
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

export default ShapeAlignmentGame;