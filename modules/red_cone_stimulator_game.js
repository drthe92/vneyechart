/**
 * Module 9: RED-Cone Stimulator (Kích thích tế bào nón hoàng điểm)
 *
 * Mục tiêu y khoa: Kích hoạt tế bào nón hoàng điểm (phương pháp Brinker-Katz).
 * BẮT BUỘC ĐƠN THỊ (Monocular): Bịt/che mắt lành, chỉ để mắt nhược thị quan sát.
 *
 * Ràng buộc Quang học (Nghiêm ngặt):
 * - Nền (Background): Đen tuyệt đối (#000000).
 * - Mục tiêu (Target): Chữ Tumbling E màu Đỏ thuần (#FF0000).
 *   Không viền, không đổ bóng, không anti-aliasing xám (dùng fillRect cứng).
 * - UI: Ẩn con trỏ chuột (canvas.style.cursor = 'none').
 *   Mọi HUD text dùng màu đỏ tối (#880000) hoặc đỏ thuần.
 *
 * Kế thừa BinocularGameEngine để tái sử dụng kiểm tra hiệu chuẩn & quản lý bộ nhớ.
 *
 * Gameplay (Tumbling E Search):
 * - Nghỉ 1 giây (màn hình đen hoàn toàn).
 * - Chữ E xuất hiện ở tọa độ ngẫu nhiên, xoay ngẫu nhiên 4 hướng.
 * - Input: 4 phím mũi tên hoặc Touch swipe.
 * - Feedback CHỈ ÂM THANH: Đúng -> "Ting" cao. Sai -> "Buzzer" thấp.
 * - Tổng cộng 40 lượt (Trials).
 *
 * Dữ liệu đầu ra: customData = { totalTrials, correctAnswers, accuracy, avgReactionTimeMs }.
 */

import BinocularGameEngine from './binocular_game_engine.js';

class RedConeStimulatorGame extends BinocularGameEngine {
    constructor() {
        super(); // Khởi tạo cha: kiểm tra hiệu chuẩn, tạo canvas, bind SPA listener

        // --- Tên game cho EMR identification (chứa 'M9' để parse báo cáo) ---
        this.gameName = 'M9: Kích thích tế bào nón hoàng điểm (RED-Cone Stimulator)';

        // ============================================================
        // CẤU HÌNH ĐƠN NHÃN (Monocular) — Vô hiệu hóa hoàn toàn Anaglyph.
        // Chuẩn màu Đen (#000000) / Đỏ thuần (#FF0000) / Đỏ tối HUD (#880000).
        // ============================================================
        this.colors = {
            bg: '#000000',       // Nền đen tuyệt đối
            target: '#FF0000',   // Chữ E đỏ thuần
            hud: '#880000',      // HUD đỏ tối
            lock: '#880000'      // (không vẽ viền, giữ cho tương thích engine)
        };

        // --- Hằng số lâm sàng ---
        this.TOTAL_TRIALS = 40;            // Cố định 40 lượt/phiên
        this.REST_MS = 1000;             // Nghỉ 1 giây (màn hình đen) giữa các lượt
        this.FEEDBACK_AUDIO_MS = 0;      // Phản hồi KHÔNG dùng hình ảnh

        // --- Trạng thái phiên ---
        this.trialIndex = 0;             // Lượt hiện tại (1..40)
        this.correctAnswers = 0;
        this._reactionTimes = [];        // ms phản xạ từng lượt

        // --- Cấu hình từ Lobby (mặc định) ---
        this._sizeFactor = 0.12;         // T = sizeFactor * min(canvasW, canvasH)
        this._displayMs = 0;             // 0 = không giới hạn; >0 = giới hạn hiển thị

        // --- Trạng thái lượt chơi ---
        this.state = 'REST';             // 'REST' | 'WAITING_INPUT'
        this._restUntil = 0;
        this._rotation = 0;              // Hướng hở của E (0=phải,90=xuống,180=trái,270=lên)
        this._answerDir = 'right';
        this._trialStart = 0;
        this._x = 0;
        this._y = 0;
        this._T = 0;

        // --- Ẩn con trỏ chuột (UI chuẩn y khoa) ---
        if (this.canvas) {
            this.canvas.style.cursor = 'none';
        }

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
     * @param {Object} config - { targetSize: 'Lớn'|'Vừa'|'Nhỏ', displayTime: 'unlimited'|'3000' }
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
            displayTime === '3000' ? 3000 : 0
        );

        // Reset trạng thái phiên
        this.trialIndex = 0;
        this.correctAnswers = 0;
        this._reactionTimes = [];

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

        // Gắn sự kiện
        window.addEventListener('keydown', this._onKeyDown);
        if (this.canvas) {
            this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: true });
            this.canvas.addEventListener('touchend', this._onTouchEnd, { passive: true });
        }

        // Bắt đầu lượt đầu (với 1s nghỉ đen)
        this._startTrial();
    }

    /**
     * Chuyển sang lượt tiếp theo (hoặc kết thúc nếu đủ 40 lượt)
     */
    _startTrial() {
        if (this.trialIndex >= this.TOTAL_TRIALS) {
            this.endGame();
            return;
        }

        this.trialIndex += 1;

        // Giai đoạn nghỉ: màn hình đen hoàn toàn 1 giây
        this.state = 'REST';
        this._restUntil = performance.now() + this.REST_MS;
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
     * Tính tọa độ ngẫu nhiên đảm bảo chữ E không bị viền canvas cắt ngang
     */
    _computeRandomPosition() {
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        const T = this._T;

        const half = T / 2;
        const pad = half + 12; // +12px để tránh viền khóa ngoại vi

        // Nếu canvas quá nhỏ, ép tâm
        if (cw - 2 * pad <= 0 || ch - 2 * pad <= 0) {
            return { x: cw / 2, y: ch / 2 };
        }

        const x = pad + Math.random() * (cw - 2 * pad);
        const y = pad + Math.random() * (ch - 2 * pad);
        return { x, y };
    }

    /**
     * Xử lý đầu vào từ bàn phím / vuốt
     * @param {string} dir - 'up' | 'down' | 'left' | 'right'
     */
    _handleInput(dir) {
        if (!this._running) return;
        if (this.state !== 'WAITING_INPUT') return; // Bỏ qua khi đang nghỉ/phản hồi
        this._processAnswer(dir);
    }

    /**
     * Đánh giá câu trả lời, phát âm thanh phản hồi (KHÔNG dùng hình ảnh)
     * @param {string|null} dir - Hướng trả lời, null = quá hạn (sai)
     */
    _processAnswer(dir) {
        const isCorrect = (dir === this._answerDir);
        if (isCorrect) {
            this.correctAnswers += 1;
            this._playTone(880, 'sine', 0.12);     // Ting (đúng) — pitch cao
        } else {
            this._playTone(160, 'square', 0.18);   // Buzzer (sai) — pitch thấp
        }

        // Tính thời gian phản xạ
        let rt;
        if (dir === null) {
            rt = this._displayMs > 0 ? this._displayMs : (performance.now() - this._trialStart);
        } else {
            rt = performance.now() - this._trialStart;
        }
        this._reactionTimes.push(rt);

        // Sang lượt tiếp theo (tự động bắt đầu 1s nghỉ đen)
        if (this.trialIndex >= this.TOTAL_TRIALS) {
            this.endGame();
        } else {
            this._startTrial();
        }
    }

    /**
     * Cập nhật logic mỗi frame
     */
    update() {
        if (!this._running) return;

        const now = performance.now();

        if (this.state === 'REST') {
            if (now >= this._restUntil) {
                // Bắt đầu hiển thị mục tiêu
                const cw = this.canvas.width;
                const ch = this.canvas.height;
                this._T = this._sizeFactor * Math.min(cw, ch);

                // Hướng hở ngẫu nhiên (4 hướng)
                const rotations = [0, 90, 180, 270];
                this._rotation = rotations[Math.floor(Math.random() * 4)];
                this._answerDir = this._rotationToDir(this._rotation);

                // Vị trí ngẫu nhiên không bị cắt viền
                const pos = this._computeRandomPosition();
                this._x = pos.x;
                this._y = pos.y;

                this._trialStart = performance.now();
                this.state = 'WAITING_INPUT';
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
     * Hàm helper vẽ chữ Tumbling E (fillRect cứng — không viền, không đổ bóng)
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x - Tọa độ tâm X
     * @param {number} y - Tọa độ tâm Y
     * @param {number} size - Kích thước (chiều cao) chữ E
     * @param {number} rotation - Góc quay (độ), E chuẩn mở sang phải
     * @param {string} color - Màu vẽ (Đỏ thuần)
     */
    _drawTumblingE(ctx, x, y, size, rotation, color) {
        const t = size / 5; // độ dày nét
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.fillStyle = color;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

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
     * Render đồ họa — ÉP ĐƠN NHÃN, Nền Đen / Mục tiêu Đỏ thuần.
     * KHÔNG vẽ hiệu ứng phản hồi hình ảnh (chỉ âm thanh).
     */
    render() {
        if (!this._running || !this.ctx) return;

        const ctx = this.ctx;

        // Reset các thuộc tính rò rỉ + tắt khử răng cưa
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.imageSmoothingEnabled = false;

        const cw = this.canvas.width;
        const ch = this.canvas.height;

        // A. Nền đen tuyệt đối (đơn nhãn, không Anaglyph)
        ctx.fillStyle = this.colors.bg;
        ctx.fillRect(0, 0, cw, ch);

        // B. Mục tiêu: chỉ hiển thị khi đang chờ phản xạ
        if (this.state === 'WAITING_INPUT') {
            this._drawTumblingE(ctx, this._x, this._y, this._T, this._rotation, this.colors.target);
        }

        // C. HUD (chữ đỏ tối, tối giản) — không gây nhiễu định thị
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = this.colors.hud;
        ctx.font = 'bold 20px monospace';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillText(`Lượt: ${this.trialIndex} / ${this.TOTAL_TRIALS}`, 16, 16);
        ctx.textAlign = 'left';
    }

    /**
     * Kết thúc phiên: Đóng gói payload EMR và báo cáo
     */
    endGame() {
        if (!this._running) return;

        const accuracy = this.trialIndex > 0
            ? (this.correctAnswers / this.trialIndex) * 100
            : 0;

        const avgReactionTimeMs = this._reactionTimes.length > 0
            ? Math.round(this._reactionTimes.reduce((a, b) => a + b, 0) / this._reactionTimes.length)
            : 0;

        // Đóng gói customData theo đặc tả
        this.sessionMetrics.customData = {
            totalTrials: this.TOTAL_TRIALS,
            correctAnswers: this.correctAnswers,
            accuracy: accuracy,
            avgReactionTimeMs: avgReactionTimeMs
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
    window.RedConeStimulatorGame = RedConeStimulatorGame;
}

export default RedConeStimulatorGame;
