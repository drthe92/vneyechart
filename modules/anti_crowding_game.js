/**
 * Module 8: Anti-Crowding Tracker (Khử hiện tượng chen chúc)
 *
 * Mục tiêu lâm sàng: Kích thích vỏ não bóc tách tín hiệu (Noise exclusion),
 * chống hiện tượng chen chúc (Crowding Effect) ở mắt nhược thị.
 *
 * BẮT BUỘC ĐƠN NHÃN (Monocular): Bịt/che mắt lành, chỉ để mắt nhược thị quan sát.
 * Không sử dụng kính phân thị (Anaglyph). Nền trắng xám (#f8fafc).
 *
 * Kế thừa BinocularGameEngine để tái sử dụng:
 * - Ràng buộc y khoa: Kiểm tra hiệu chuẩn phần cứng (pixelsPerMm, viewingDistanceCm)
 * - Quản lý bộ nhớ: start/stop lifecycle, SPA workspace change listener
 *
 * Gameplay:
 * - Chữ Tumbling E ĐEN (#000000) ở trung tâm.
 * - 4 chữ Tumbling E XÁM ĐẬM (#475569) ở 4 hướng làm Flankers (nhiễu).
 * - Khoảng cách S (tâm E chính -> tâm E phụ) = Sratio * T, T = kích thước E.
 * - Khởi đầu Sratio = 2.5, giới hạn tối thiểu Sratio = 1.1.
 * - Cầu thang 2-Down / 1-Up:
 *     + Đúng 2 lần liên tiếp: Sratio -= 0.2
 *     + Sai 1 lần:           Sratio += 0.3 (luôn kẹp >= 1.1)
 * - Tương tác: 4 phím mũi tên (Arrow keys) hoặc Vuốt (Touch Swipe).
 * - Cố định 40 lượt/phiên.
 */

import BinocularGameEngine from './binocular_game_engine.js';

class AntiCrowdingGame extends BinocularGameEngine {
    constructor() {
        super(); // Khởi tạo cha: kiểm tra hiệu chuẩn, tạo canvas, bind SPA listener

        // --- Tên game cho EMR identification ---
        this.gameName = 'M8: Khử hiện tượng chen chúc (Anti-Crowding)';

        // ============================================================
        // CẤU HÌNH ĐƠN NHÃN (Monocular) — Vô hiệu hóa hoàn toàn Anaglyph
        // Không dùng màu Đỏ/Lục Lam. Chỉ đen / xám đậm trên nền trắng xám.
        // ============================================================
        this.colors = {
            center: '#000000',   // Chữ E chính (Đen)
            flanker: '#475569',  // Chữ E phụ / Flanker (Xám đậm)
            lock: '#475569',     // Viền khóa ngoại vi (Xám đậm)
            bg: '#f8fafc'        // Nền trắng xám
        };

        // --- Hằng số lâm sàng ---
        this.TOTAL_TRIALS = 40;          // Cố định 40 lượt/phiên
        this.MIN_SRATIO = 1.1;           // Giới hạn tối thiểu (gần nhất)
        this.START_SRATIO = 2.5;         // Khởi đầu
        this.STEP_DOWN = 0.2;            // Đúng 2 lần: S -= 0.2*T
        this.STEP_UP = 0.3;              // Sai 1 lần: S += 0.3*T

        // --- Trạng thái phiên ---
        this.trialIndex = 0;             // Lượt hiện tại (1..40)
        this.correctAnswers = 0;
        this._consecutiveCorrect = 0;
        this.Sratio = this.START_SRATIO;
        this._minSratio = this.START_SRATIO;

        // --- Cấu hình từ Lobby (mặc định) ---
        this._sizeFactor = 0.12;         // T = sizeFactor * min(canvasW, canvasH)
        this._displayMs = 0;             // 0 = không giới hạn; >0 = giới hạn hiển thị

        // --- Trạng thái lượt chơi ---
        this.state = 'WAITING_INPUT';    // 'WAITING_INPUT' | 'FEEDBACK_DELAY'
        this._centralRotation = 0;       // Hướng hở của E chính (0=phải,90=xuống,180=trái,270=lên)
        this._flankerRotations = [0, 0, 0, 0]; // [Trên, Dưới, Trái, Phải]
        this._answerDir = 'right';
        this._trialStart = 0;
        this._feedbackUntil = 0;
        this._endAfterFeedback = false;
        this._lastCorrect = false;

        // --- Sự kiện bàn phím ---
        this._onKeyDown = (e) => {
            const map = {
                'ArrowUp': 'up', 'ArrowDown': 'down',
                'ArrowLeft': 'left', 'ArrowRight': 'right'
            };
            if (map[e.key]) {
                e.preventDefault();
                this._handleInput(map[e.key]);
            }
        };

        // --- Sự kiện Touch Swipe ---
        this._touchStartX = 0;
        this._touchStartY = 0;
        this._touchStartY2 = 0;
        this._onTouchStart = (e) => {
            if (e.touches.length === 0) return;
            this._touchStartX = e.touches[0].clientX;
            this._touchStartY = e.touches[0].clientY;
        };
        this._onTouchEnd = (e) => {
            if (e.changedTouches.length === 0) return;
            const dx = e.changedTouches[0].clientX - this._touchStartX;
            const dy = e.changedTouches[0].clientY - this._touchStartY;
            const THRESH = 24; // ngưỡng vuốt (px)
            if (Math.abs(dx) < THRESH && Math.abs(dy) < THRESH) return;
            let dir;
            if (Math.abs(dx) > Math.abs(dy)) {
                dir = dx > 0 ? 'right' : 'left';
            } else {
                dir = dy > 0 ? 'down' : 'up';
            }
            this._handleInput(dir);
        };
    }

    /**
     * Khởi chạy game với cấu hình từ Lobby
     * @param {Object} config - { targetSize: 'Lớn'|'Vừa'|'Nhỏ', displayTime: 'unlimited'|'2000' }
     */
    start(config = {}) {
        // Cấu hình kích thước vật tiêu (T)
        const targetSize = (config && config.targetSize) ? config.targetSize : 'Vừa';
        this._sizeFactor = (
            targetSize === 'Lớn' ? 0.18 :
            targetSize === 'Nhỏ' ? 0.08 : 0.12
        );

        // Cấu hình thời gian hiển thị
        const displayTime = (config && config.displayTime) ? config.displayTime : 'unlimited';
        this._displayMs = (
            displayTime === '2000' ? 2000 : 0
        );

        // Reset trạng thái phiên
        this.trialIndex = 0;
        this.correctAnswers = 0;
        this._consecutiveCorrect = 0;
        this.Sratio = this.START_SRATIO;
        this._minSratio = this.START_SRATIO;
        this._endAfterFeedback = false;

        // Bắt đầu render loop
        super.start();

        // Gắn sự kiện
        window.addEventListener('keydown', this._onKeyDown);
        if (this.canvas) {
            this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: true });
            this.canvas.addEventListener('touchend', this._onTouchEnd, { passive: true });
        }

        // Khởi tạo lượt đầu
        this._nextTrial();
    }

    /**
     * Chuyển sang lượt tiếp theo (hoặc kết thúc nếu đủ 40 lượt)
     */
    _nextTrial() {
        if (this.trialIndex >= this.TOTAL_TRIALS) {
            this.endGame();
            return;
        }

        this.trialIndex += 1;

        // Hướng hở ngẫu nhiên của E chính (4 hướng)
        const rotations = [0, 90, 180, 270];
        this._centralRotation = rotations[Math.floor(Math.random() * 4)];
        this._answerDir = this._rotationToDir(this._centralRotation);

        // Flankers: mỗi chữ phụ nhận hướng ngẫu nhiên (tạo nhiễu chen chúc)
        this._flankerRotations = rotations.map(() => rotations[Math.floor(Math.random() * 4)]);

        this._trialStart = performance.now();
        this.state = 'WAITING_INPUT';
    }

    /**
     * Chuyển góc quay (độ) sang hướng hở của chữ E
     * Quy ước: E chuẩn mở sang phải; xoay clockwise theo canvas.
     *   0   -> phải, 90  -> xuống, 180 -> trái, 270 -> lên
     */
    _rotationToDir(rot) {
        const r = ((Math.round(rot) % 360) + 360) % 360;
        if (r === 0) return 'right';
        if (r === 90) return 'down';
        if (r === 180) return 'left';
        return 'up';
    }

    /**
     * Xử lý đầu vào từ bàn phím / vuốt
     * @param {string} dir - 'up' | 'down' | 'left' | 'right'
     */
    _handleInput(dir) {
        if (!this._running) return;
        if (this.state !== 'WAITING_INPUT') return; // Bỏ qua trong lúc phản hồi

        this._processAnswer(dir);
    }

    /**
     * Đánh giá câu trả lời và cập nhật thuật toán Cầu thang
     * @param {string|null} dir - Hướng trả lời, null = quá hạn (sai)
     */
    _processAnswer(dir) {
        const isCorrect = (dir === this._answerDir);
        this._lastCorrect = isCorrect;

        if (isCorrect) {
            this.correctAnswers += 1;
            this._consecutiveCorrect += 1;
            // 2-Down: Đúng 2 lần liên tiếp -> thu hẹp khoảng cách
            if (this._consecutiveCorrect >= 2) {
                this.Sratio -= this.STEP_DOWN;
                this._consecutiveCorrect = 0;
            }
            this._playTone(880, 'sine', 0.12); // ting (đúng)
        } else {
            this._consecutiveCorrect = 0;
            // 1-Up: Sai 1 lần -> nới rộng khoảng cách
            this.Sratio += this.STEP_UP;
            this._playTone(160, 'square', 0.18); // buzzer (sai)
        }

        // Luôn kẹp Sratio >= giới hạn tối thiểu
        if (this.Sratio < this.MIN_SRATIO) this.Sratio = this.MIN_SRATIO;

        // Cập nhật khoảng cách hẹp nhất đã đạt được
        if (this.Sratio < this._minSratio) this._minSratio = this.Sratio;

        // Vào trạng thái phản hồi, sau đó load lượt mới
        this.state = 'FEEDBACK_DELAY';
        this._feedbackUntil = performance.now() + 600;

        if (this.trialIndex >= this.TOTAL_TRIALS) {
            this._endAfterFeedback = true;
        }
    }

    /**
     * Cập nhật logic mỗi frame
     */
    update() {
        if (!this._running) return;

        const now = performance.now();

        if (this.state === 'FEEDBACK_DELAY') {
            if (now >= this._feedbackUntil) {
                if (this._endAfterFeedback) {
                    this.endGame();
                } else {
                    this._nextTrial();
                }
            }
            return;
        }

        // Chế độ giới hạn thời gian hiển thị: quá hạn = sai (không trả lời)
        if (this._displayMs > 0 && this.state === 'WAITING_INPUT') {
            if (now - this._trialStart > this._displayMs) {
                this._processAnswer(null);
            }
        }
    }

    /**
     * Phát âm thanh phản hồi (ting / buzzer) qua WebAudio
     */
    _playTone(freq, type, duration) {
        try {
            if (!this._audioCtx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return;
                this._audioCtx = new AC();
            }
            const ctx = this._audioCtx;
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
     * Hàm helper vẽ chữ Tumbling E có thể tái sử dụng
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x - Tọa độ tâm X
     * @param {number} y - Tọa độ tâm Y
     * @param {number} size - Kích thước (chiều cao) chữ E
     * @param {number} rotation - Góc quay (độ), E chuẩn mở sang phải
     * @param {string} color - Màu vẽ
     */
    _drawTumblingE(ctx, x, y, size, rotation, color) {
        const t = size / 5; // độ dày nét
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.fillStyle = color;

        // Thân đứng (bên trái)
        ctx.fillRect(-size / 2, -size / 2, t, size);
        // Tay ngang trên
        ctx.fillRect(-size / 2 + t, -size / 2, size / 2, t);
        // Tay ngang giữa
        ctx.fillRect(-size / 2 + t, -t / 2, size / 2, t);
        // Tay ngang dưới
        ctx.fillRect(-size / 2 + t, size / 2 - t, size / 2, t);

        ctx.restore();
    }

    /**
     * Render đồ họa — ÉP ĐƠN NHÃN (Monocular)
     * Vô hiệu hóa hoàn toàn bộ lọc Anaglyph. Nền trắng xám (#f8fafc).
     */
    render() {
        if (!this._running || !this.ctx) return;

        const ctx = this.ctx;

        // Reset các thuộc tính rò rỉ
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        const cw = this.canvas.width;
        const ch = this.canvas.height;

        // A. Nền trắng xám (đơn nhãn, không Anaglyph)
        ctx.fillStyle = this.colors.bg;
        ctx.fillRect(0, 0, cw, ch);

        // B. Viền khóa ngoại vi (giữ định thị) — Xám đậm
        ctx.strokeStyle = this.colors.lock;
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, cw - 8, ch - 8);

        // C. Kích thước E động theo canvas (xử lý resize mượt)
        const T = this._sizeFactor * Math.min(cw, ch);
        const S = this.Sratio * T; // Khoảng cách tâm->tâm

        const cx = cw / 2;
        const cy = ch / 2;

        // Flankers (4 hướng): Trên, Dưới, Trái, Phải
        const positions = [
            { x: cx, y: cy - S, rot: this._flankerRotations[0] }, // Trên
            { x: cx, y: cy + S, rot: this._flankerRotations[1] }, // Dưới
            { x: cx - S, y: cy, rot: this._flankerRotations[2] }, // Trái
            { x: cx + S, y: cy, rot: this._flankerRotations[3] }  // Phải
        ];
        for (const p of positions) {
            this._drawTumblingE(ctx, p.x, p.y, T, p.rot, this.colors.flanker);
        }

        // E chính (trung tâm) — Đen
        this._drawTumblingE(ctx, cx, cy, T, this._centralRotation, this.colors.center);

        // D. HUD
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillText(`Lượt: ${this.trialIndex} / ${this.TOTAL_TRIALS}`, 18, 18);
        ctx.fillText(`Đúng: ${this.correctAnswers}`, 18, 48);

        ctx.textAlign = 'right';
        ctx.fillText(`Khoảng cách S: ${(this.Sratio).toFixed(2)} × T`, cw - 18, 18);
        ctx.textAlign = 'left';

        // E. Phản hồi ĐÚNG / SAI
        if (this.state === 'FEEDBACK_DELAY') {
            ctx.textAlign = 'center';
            ctx.font = 'bold 64px Arial, sans-serif';
            ctx.fillStyle = this._lastCorrect ? '#16a34a' : '#dc2626';
            ctx.fillText(this._lastCorrect ? 'ĐÚNG' : 'SAI', cx, cy - T - 90);
            ctx.textAlign = 'left';
        }

        // F. Hướng dẫn (ẩn trong lúc chơi để tránh nhiễu)
        if (this.state === 'WAITING_INPUT') {
            ctx.textAlign = 'center';
            ctx.font = '16px Arial, sans-serif';
            ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
            ctx.fillText('Trả lời hướng hở của chữ E giữa (Phím mũi tên / Vuốt)', cx, ch - 40);
            ctx.textAlign = 'left';
        }
    }

    /**
     * Kết thúc phiên: Đóng gói payload EMR và báo cáo
     */
    endGame() {
        if (!this._running) return;

        const accuracy = this.trialIndex > 0
            ? (this.correctAnswers / this.trialIndex) * 100
            : 0;

        // Đóng gói customData theo đặc tả
        this.sessionMetrics.customData = {
            totalTrials: this.TOTAL_TRIALS,
            correctAnswers: this.correctAnswers,
            accuracy: accuracy,
            minimumSpacingReached: `${this._minSratio.toFixed(2)} × T`,
            finalSpacing: `${this.Sratio.toFixed(2)} × T`
        };
        this.sessionMetrics.hits = this.correctAnswers;
        this.sessionMetrics.misses = this.TOTAL_TRIALS - this.correctAnswers;

        this.finishSession();
        this.stop();
    }

    /**
     * Ghi đè stop() để dọn dẹp sự kiện bàn phím & touch
     */
    stop() {
        window.removeEventListener('keydown', this._onKeyDown);
        if (this.canvas) {
            this.canvas.removeEventListener('touchstart', this._onTouchStart);
            this.canvas.removeEventListener('touchend', this._onTouchEnd);
        }
        super.stop();
    }
}

// Xuất toàn cục cho menu controller (classRef dạng chuỗi)
if (typeof window !== 'undefined') {
    window.AntiCrowdingGame = AntiCrowdingGame;
}

export default AntiCrowdingGame;
