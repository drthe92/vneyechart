import BinocularGameEngine from './binocular_game_engine.js';

// [M7 CHUẨN LÂM SÀNG] Tốc độ quay đĩa lưới CAM theo y văn:
// 1.5 – 2 vòng/phút (RPM). Quy đổi sang radian/giây:
//   ω (rad/s) = (2 * RPM * Math.PI) / 60  →  0.157 – 0.209 rad/s
const M7_DEFAULT_RPM = 2;      // vòng/phút chuẩn lâm sàng (≈ 0.209 rad/s)
const M7_MIN_RPM = 0.5;        // rào an toàn: không quay quá chậm
const M7_MAX_RPM = 5;          // rào an toàn: chống đột quỵ thị giác/quang động

// Bảng độ khó 10 mức (M7_LEVELS) — gamify giống M1/M2/M4/M9/M10/M12:
// Level càng cao → RPM tăng dần (tới rào an toàn 5), sọc hẹp dần (High SF),
// cue đỏ hiển thị ngắn dần, khoảng cách giữa các cue ngắn dần, ngưỡng phản xạ
// tối đa để qua màn (maxReactionMs) khắt khe hơn.
const M7_LEVELS = [
    { level: 1,  rpm: 0.5, stripeWidth: 60, cueDurationMs: 1200, gapMinMs: 2500, gapRangeMs: 1000, maxReactionMs: 1100 },
    { level: 2,  rpm: 1.0, stripeWidth: 55, cueDurationMs: 1100, gapMinMs: 2400, gapRangeMs: 1000, maxReactionMs: 1000 },
    { level: 3,  rpm: 1.5, stripeWidth: 50, cueDurationMs: 1000, gapMinMs: 2200, gapRangeMs: 1000, maxReactionMs: 900  },
    { level: 4,  rpm: 2.0, stripeWidth: 45, cueDurationMs: 1000, gapMinMs: 2000, gapRangeMs: 1000, maxReactionMs: 850  },
    { level: 5,  rpm: 2.5, stripeWidth: 40, cueDurationMs: 900,  gapMinMs: 1800, gapRangeMs: 1000, maxReactionMs: 800  },
    { level: 6,  rpm: 3.0, stripeWidth: 36, cueDurationMs: 800,  gapMinMs: 1600, gapRangeMs: 1000, maxReactionMs: 750  },
    { level: 7,  rpm: 3.5, stripeWidth: 32, cueDurationMs: 700,  gapMinMs: 1400, gapRangeMs: 1000, maxReactionMs: 700  },
    { level: 8,  rpm: 4.0, stripeWidth: 28, cueDurationMs: 600,  gapMinMs: 1200, gapRangeMs: 1000, maxReactionMs: 600  },
    { level: 9,  rpm: 4.5, stripeWidth: 24, cueDurationMs: 500,  gapMinMs: 1000, gapRangeMs: 1000, maxReactionMs: 500  },
    { level: 10, rpm: 5.0, stripeWidth: 20, cueDurationMs: 400,  gapMinMs: 800,  gapRangeMs: 800,  maxReactionMs: 400  }
];

class CamVisualStimulatorGame extends BinocularGameEngine {
    constructor() {
        super();

        this.gameName = 'M7: Kích thích Lưới quay CAM (Monocular)';

        this.colors = { left: '#000000', right: '#FFFFFF', lock: '#000000' };

        this.level = 1;                  // Cấp độ hiện tại (1..10) — gamify
        this._maxReactionMs = 1100;      // Ngưỡng phản xạ tối đa để qua màn Level

        this._angle = 0;
        // [M7] Tốc độ quay theo vòng/phút (RPM) — chuẩn lâm sàng 1.5–2 RPM.
        // Vận tốc góc rad/s được tính mỗi phiên: (2 * RPM * π) / 60.
        this._rpm = M7_DEFAULT_RPM;
        this._stripeWidth = 40;

        this._restColor = '#00C000';
        this._cueColor = '#FF0000';
        this._dotColor = this._restColor;

        this._cueActive = false;
        this._cueStartTime = 0;
        this._cueEndTime = 0;
        this._nextCueTime = 0;
        this._cueDurationMs = 1000;
        this._cueGapMinMs = 2000;
        this._cueGapRangeMs = 2000;
        this._cueGap = () => this._cueGapMinMs + Math.random() * this._cueGapRangeMs;

        this.totalHits = 0;
        this.totalMisses = 0;
        this.falseAlarms = 0;
        this._reactionTimes = [];

        this._lastFrameTime = 0;
        this._gameStartTime = 0;
        this._durationMs = 60000;

        this._onKeyDown = (e) => {
            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                this._onPress();
            }
        };
        this._onPointerDown = (e) => {
            e.preventDefault();
            this._onPress();
        };
    }

    /**
     * Ánh xạ Level (1..10) → Cấu hình độ khó theo bảng M7_LEVELS.
     * Level càng cao: đĩa CAM quay nhanh hơn, sọc hẹp hơn, cue đỏ hiển thị
     * ngắn hơn, khoảng cách giữa các cue ngắn hơn, ngưỡng phản xạ khắt khe hơn.
     * @param {number|string} level - Cấp độ người dùng chọn (mặc định 1)
     * @returns {number} Level hợp lệ (clamp 1..10)
     */
    _applyLevel(level) {
        const lvl = Math.max(1, Math.min(10, parseInt(level, 10) || 1));
        const cfg = M7_LEVELS.find(l => l.level === lvl) || M7_LEVELS[0];
        this.level = lvl;
        this._rpm = cfg.rpm;
        this._stripeWidth = cfg.stripeWidth;
        this._cueDurationMs = cfg.cueDurationMs;
        this._cueGapMinMs = cfg.gapMinMs;
        this._cueGapRangeMs = cfg.gapRangeMs;
        this._maxReactionMs = cfg.maxReactionMs;
        return lvl;
    }

    start(config = {}) {
        this._durationMs = (config && config.durationMs) ? config.durationMs : 60000;
        if (config && config.level != null) {
            // Gamify: áp dụng Level 1..10 từ Lobby (chuẩn lâm sàng, an toàn)
            this._applyLevel(config.level);
        } else {
            // Legacy: cấu hình thủ công rotationSpeed/stripeWidth
            const rpm = (config && config.rotationSpeed != null)
                ? parseFloat(config.rotationSpeed)
                : M7_DEFAULT_RPM;
            this._rpm = isNaN(rpm) ? M7_DEFAULT_RPM : Math.min(M7_MAX_RPM, Math.max(M7_MIN_RPM, rpm));
            this._stripeWidth = (config && config.stripeWidth != null) ? config.stripeWidth : 40;
            this.level = 1;
            this._cueDurationMs = 1000;
            this._cueGapMinMs = 2000;
            this._cueGapRangeMs = 2000;
            this._maxReactionMs = M7_LEVELS[0].maxReactionMs;
        }

        this.totalHits = 0;
        this.totalMisses = 0;
        this.falseAlarms = 0;
        this._reactionTimes = [];
        this._cueActive = false;
        this._dotColor = this._restColor;

        this._gameStartTime = performance.now();
        this._lastFrameTime = this._gameStartTime;
        this._nextCueTime = this._gameStartTime + this._cueGap();

        super.start();

        window.addEventListener('keydown', this._onKeyDown);
        if (this.canvas) {
            this.canvas.addEventListener('pointerdown', this._onPointerDown);
        }
    }

    update(dtSec) {
        if (!this._running) return;

        const now = performance.now();

        if (now - this._gameStartTime >= this._durationMs) {
            this.endGame();
            return;
        }

        // [A1] Engine truyền dt (GIÂY) — fallback tự đo nếu bị gọi thủ công.
        // (Trước đây biến này bị hiểu nhầm là mili-giây → đĩa quay gần như
        //  đứng yên sau khi Engine chuyển sang chuẩn Delta-time.)
        let dt = dtSec;
        if (typeof dt !== 'number' || !(dt > 0)) {
            dt = this._lastFrameTime ? (now - this._lastFrameTime) / 1000 : 1 / 60;
        }
        if (dt > 0.1) dt = 0.1; // chống nhảy khung khi tab ẩn
        this._lastFrameTime = now;

        // [M7 CHUẨN LÂM SÀNG] Vận tốc góc ω = 2π·RPM/60 (rad/s).
        // 2 RPM → 0.209 rad/s: quay chậm rãi, đều đặn, bất biến với refresh rate.
        const omegaRadPerSec = (2 * this._rpm * Math.PI) / 60;
        this._angle = (this._angle + omegaRadPerSec * dt) % (2 * Math.PI);

        if (this._cueActive) {
            if (now >= this._cueEndTime) {
                this.totalMisses++;
                this._cueActive = false;
                this._dotColor = this._restColor;
                this._nextCueTime = now + this._cueGap();
            }
        } else {
            if (now >= this._nextCueTime) {
                this._cueActive = true;
                this._cueStartTime = now;
                this._cueEndTime = now + this._cueDurationMs;
                this._dotColor = this._cueColor;
            }
        }
    }

    render(ctx = this.ctx) {
        if (!this._running || !ctx) return;

        super.render();

        const cw = this.canvas.width;
        const ch = this.canvas.height;
        const cx = cw / 2;
        const cy = ch / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this._angle);
        const size = Math.max(cw, ch) * 2;
        const half = size / 2;
        const stripe = this._stripeWidth;
        ctx.fillStyle = '#000000';
        for (let x = -half; x < half; x += stripe * 2) {
            ctx.fillRect(x, -half, stripe, size);
        }
        ctx.restore();

        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, 2 * Math.PI);
        ctx.fillStyle = this._dotColor;
        ctx.fill();

        // HUD: hiển thị Level + RPM (không nhiễu trường thị giác trung tâm)
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillText(`Level ${this.level}/10 | ${this._rpm} vòng/phút`, 12, 12);
    }

    _onPress() {
        if (!this._running) return;
        const now = performance.now();

        if (this._cueActive) {
            this.totalHits++;
            this._reactionTimes.push(now - this._cueStartTime);
            this._cueActive = false;
            this._dotColor = this._restColor;
            this._nextCueTime = now + this._cueGap();
        } else {
            this.falseAlarms++;
        }
    }

    endGame() {
        if (!this._running) return;

        const sumRt = this._reactionTimes.reduce((a, b) => a + b, 0);
        const avgRt = this._reactionTimes.length ? sumRt / this._reactionTimes.length : 0;
        const total = this.totalHits + this.totalMisses + this.falseAlarms;
        const accuracy = total > 0 ? this.totalHits / total : 0;
        const accuracyRate = accuracy * 100;

        // --- Tiêu chí qua màn theo Level: ≥ 85% chính xác VÀ phản xạ ≤ ngưỡng Level ---
        const isPassed = accuracyRate >= 85 && avgRt > 0 && avgRt <= this._maxReactionMs;

        // --- Mở khóa Level kế tiếp nếu QUA MÀN và chưa phải Level tối đa ---
        const LEVEL_KEY = 'vision-therapy-m7-max-level';
        const maxLevel = parseInt(localStorage.getItem(LEVEL_KEY) || '1', 10) || 1;
        let unlockedNew = false;
        if (isPassed && this.level >= maxLevel && this.level < 10) {
            localStorage.setItem(LEVEL_KEY, String(this.level + 1));
            unlockedNew = true;
        }

        this.sessionMetrics.customData = {
            totalHits: this.totalHits,
            totalMisses: this.totalMisses,
            falseAlarms: this.falseAlarms,
            accuracyRate: accuracyRate,
            avgReactionTimeMs: avgRt,
            rotationRpm: this._rpm,
            stripeWidth: this._stripeWidth,
            level: this.level,
            passed: isPassed,
            nextLevelUnlocked: unlockedNew
        };
        this.sessionMetrics.hits = this.totalHits;
        this.sessionMetrics.misses = this.totalMisses;

        this.finishSession();
        this.stop();
        this._showResultOverlay(accuracyRate, avgRt, isPassed, unlockedNew);
    }

    /**
     * Hiển thị overlay kết quả phiên (kèm trạng thái mở khóa Level kế tiếp)
     * @param {number} accuracyRate - Tỷ lệ chính xác (%)
     * @param {number} avgRt - Phản xạ trung bình (ms)
     * @param {boolean} isPassed - Đạt tiêu chí Level hiện tại hay không
     * @param {boolean} unlockedNew - Có mở khóa Level mới hay không
     */
    _showResultOverlay(accuracyRate, avgRt, isPassed, unlockedNew) {
        const evalColor = isPassed ? '#10b981' : '#f87171';
        const evalText = isPassed
            ? (unlockedNew ? `ĐẠT — Đã mở khóa Level ${this.level + 1}!` : `ĐẠT (Chinh phục Level ${this.level})`)
            : `CHƯA ĐẠT (Cần ≥ 85% chính xác và phản xạ ≤ ${this._maxReactionMs} ms để mở khóa Level kế tiếp)`;

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
            <h1 style="font-size: 32px; color: ${evalColor}; margin-bottom: 20px;">
                ✅ ${isPassed ? 'BÁO CÁO LÂM SÀNG: ĐẠT MỤC TIÊU' : 'BÁO CÁO LÂM SÀNG: HOÀN THÀNH PHIÊN TẬP'}
            </h1>

            <div style="max-width: 600px; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 25px; margin-bottom: 25px;">
                <p style="font-size: 20px; margin: 8px 0;"><strong>⭐ Cấp độ đã chinh phục:</strong> <span style="color: #fbbf24;">Level ${this.level}</span></p>
                <p style="font-size: 20px; margin: 8px 0;"><strong>📊 Độ chính xác:</strong> <span style="color: #22d3ee;">${accuracyRate.toFixed(1)}%</span></p>
                <p style="font-size: 20px; margin: 8px 0;"><strong>⚡ Phản xạ trung bình:</strong> <span style="color: #60a5fa;">${avgRt.toFixed(0)} ms</span></p>
                <p style="font-size: 20px; margin: 8px 0;"><strong>🌀 Đĩa CAM:</strong> <span style="color: #a78bfa;">${this._rpm} vòng/phút</span> | <strong>Sọc:</strong> <span style="color: #a78bfa;">${this._stripeWidth}px</span></p>
                <p style="font-size: 20px; margin: 8px 0;"><strong>🎯 Trúng:</strong> <span style="color: #10b981;">${this.totalHits}</span> | <strong>❌ Sót:</strong> <span style="color: #ef4444;">${this.totalMisses}</span> | <strong>⚠️ Bấm nhầm:</strong> <span style="color: #f59e0b;">${this.falseAlarms}</span></p>
            </div>

            <p style="font-size: 18px; color: ${evalColor}; margin: 0 0 20px 0; font-weight: bold;">${evalText}</p>

            <button id="btn-next-module" style="
                padding: 15px 40px; font-size: 18px; cursor: pointer;
                background: #3b82f6; color: white; border: none; border-radius: 8px;
                font-weight: bold; transition: background 0.3s;
            ">Trở về Lobby</button>
        `;

        document.body.appendChild(overlay);

        const nextBtn = document.getElementById('btn-next-module');
        nextBtn.onmouseover = () => nextBtn.style.background = '#2563eb';
        nextBtn.onmouseout = () => nextBtn.style.background = '#3b82f6';
        nextBtn.onclick = () => {
            document.body.removeChild(overlay);
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        };
    }

    stop() {
        window.removeEventListener('keydown', this._onKeyDown);
        if (this.canvas) {
            this.canvas.removeEventListener('pointerdown', this._onPointerDown);
        }
        super.stop();
    }
}

if (typeof window !== 'undefined') {
    window.CamVisualStimulatorGame = CamVisualStimulatorGame;
}

export default CamVisualStimulatorGame;
