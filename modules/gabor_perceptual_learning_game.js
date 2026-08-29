/**
 * Module 11: Gabor Perceptual Learning (Học tri giác mảng Gabor)
 *
 * Mục tiêu y khoa: Kích thích trực tiếp tế bào V1 bằng mảng Gabor, tăng cường
 * độ nhạy tương phản (Neuroplasticity). BẮT BUỘC ĐƠN THỊ (Bịt/che mắt lành),
 * chỉ để mắt nhược thị quan sát.
 *
 * Kế thừa BinocularGameEngine để tái sử dụng kiểm tra hiệu chuẩn & quản lý bộ nhớ.
 *
 * Gameplay (2AFC - Nhận diện hướng nghiêng):
 * - Nền xám trung tính #808080, dấu định thị chéo (+) đen ở tâm.
 * - Flash kích thích: (+) biến mất, vẽ mảng Gabor nghiêng Trái (-45°) hoặc
 *   Phải (+45°) trong flashDuration (200ms/500ms), sau đó xóa, trả lại nền xám.
 * - Bệnh nhân bấm Mũi tên Trái/Phải để trả lời.
 * - Âm thanh: Đúng -> "Ting", Sai -> "Buzzer" (Web Audio API).
 *
 * Thuật toán Cầu thang (Staircase 3-Down/1-Up):
 * - C (Contrast) bắt đầu = 1.0.
 * - Đúng 3 lần liên tiếp: C = C * 0.9 (giảm). Nếu hướng bước đổi -> tăng reversals.
 * - Sai 1 lần: C = min(1.0, C * 1.1) (tăng). Nếu hướng bước đổi -> tăng reversals.
 *
 * Đồ họa: Render Raw ImageData ma trận (size x size) tại tâm canvas theo công thức Gabor.
 */

import BinocularGameEngine from './binocular_game_engine.js';

class GaborPerceptualLearningGame extends BinocularGameEngine {
    constructor() {
        super(); // Khởi tạo cha: kiểm tra hiệu chuẩn, tạo canvas, bind SPA listener

        // --- Tên game cho EMR identification (chứa 'M11' để parse báo cáo) ---
        this.gameName = 'M11: Học tri giác Gabor (Gabor Perceptual Learning)';

        // ============================================================
        // CẤU HÌNH ĐƠN NHÃN (Monocular) — Vô hiệu hóa hoàn toàn Anaglyph.
        // Nền xám trung tính #808080; dấu định thị đen.
        // ============================================================
        this.colors = {
            bg: '#808080',
            fixation: '#000000',
            lock: '#000000'
        };

        // --- Hằng số lâm sàng ---
        this.TARGET_REVERSALS = 6;       // Dừng khi đạt đủ số đảo chiều (hội tụ)
        this.FIXATE_MIN = 400;           // Thời gian giữ dấu (+) tối thiểu (ms)
        this.FIXATE_JITTER = 400;        // Độ nhiễu thêm (ms) -> 400–800ms
        this.REACT_LIMIT_MS = 8000;      // Quá hạn phản xạ (coi như sai) (ms)

        // --- Trạng thái thuật toán Cầu thang ---
        this.currentContrast = 1.0;      // C bắt đầu = 1.0
        this._consecutiveCorrect = 0;
        this.reversals = 0;
        this._lastStepDir = null;        // 'down' | 'up'

        // --- Trạng thái phiên ---
        this.totalTrials = 0;
        this.correctAnswers = 0;
        this._reactionTimes = [];

        // --- Cấu hình từ Lobby (mặc định) ---
        this._flashMs = 200;             // 200ms hoặc 500ms

        // --- Trạng thái lượt chơi ---
        this.state = 'FIXATE';           // 'FIXATE' | 'FLASH' | 'RESPONSE'
        this._fixateUntil = 0;
        this._flashUntil = 0;
        this._responseStart = 0;
        this._gaborImg = null;
        this._gaborX = 0;
        this._gaborY = 0;
        this._stimAngle = 45;
        this._answerDir = 'right';

        // --- Sự kiện bàn phím ---
        this._onKeyDown = (e) => {
            const map = { 'ArrowLeft': 'left', 'ArrowRight': 'right' };
            if (map[e.key]) {
                e.preventDefault();
                this._handleInput(map[e.key]);
            }
        };
    }

    /**
     * Khởi chạy game với cấu hình từ Lobby
     * @param {Object} config - { flashDuration: '200' | '500' }
     */
    start(config = {}) {
        // Cấu hình thời gian flash
        const flashDuration = (config && config.flashDuration) ? config.flashDuration : '200';
        this._flashMs = (flashDuration === '500') ? 500 : 200;

        // Reset trạng thái phiên & cầu thang
        this.currentContrast = 1.0;
        this._consecutiveCorrect = 0;
        this.reversals = 0;
        this._lastStepDir = null;
        this.totalTrials = 0;
        this.correctAnswers = 0;
        this._reactionTimes = [];
        this._gaborImg = null;

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

        // Bắt đầu lượt đầu
        this._startTrial();
    }

    /**
     * Bắt đầu một lượt: giữ dấu định thị trong khoảng thời gian nhiễu
     */
    _startTrial() {
        this.state = 'FIXATE';
        this._gaborImg = null;
        this._fixateUntil = performance.now() + this.FIXATE_MIN + Math.random() * this.FIXATE_JITTER;
    }

    /**
     * Xử lý đầu vào từ bàn phím
     * @param {string} dir - 'left' | 'right'
     */
    _handleInput(dir) {
        if (!this._running) return;
        if (this.state !== 'RESPONSE') return; // Chỉ nhận khi đang chờ phản xạ
        this._processAnswer(dir);
    }

    /**
     * Đánh giá câu trả lời & cập nhật Cầu thang 3-Down/1-Up
     * @param {string|null} dir - Hướng trả lời, null = quá hạn (sai)
     */
    _processAnswer(dir) {
        const isCorrect = (dir === this._answerDir);

        // Thời gian phản xạ
        this._reactionTimes.push(performance.now() - this._responseStart);

        if (isCorrect) {
            this.correctAnswers += 1;
            this._consecutiveCorrect += 1;
            this._playTone(880, 'sine', 0.12);     // Ting (đúng) — pitch cao
            if (this._consecutiveCorrect >= 3) {
                this.currentContrast = this.currentContrast * 0.9; // Giảm tương phản (khó hơn)
                this._consecutiveCorrect = 0;
                this._stepDirection('down');
            }
        } else {
            this._consecutiveCorrect = 0;
            this._playTone(160, 'square', 0.18);   // Buzzer (sai) — pitch thấp
            this.currentContrast = Math.min(1.0, this.currentContrast * 1.1); // Tăng tương phản
            this._stepDirection('up');
        }

        this.totalTrials += 1;

        // Dừng khi đủ số đảo chiều (hội tụ ngưỡng)
        if (this.reversals >= this.TARGET_REVERSALS) {
            this.endGame();
        } else {
            this._startTrial();
        }
    }

    /**
     * Ghi nhận hướng bước của Cầu thang; tăng `reversals` khi đổi chiều
     * @param {'down'|'up'} dir
     */
    _stepDirection(dir) {
        if (this._lastStepDir && this._lastStepDir !== dir) {
            this.reversals += 1;
        }
        this._lastStepDir = dir;
    }

    /**
     * Cập nhật logic mỗi frame (chuyển trạng thái FIXATE -> FLASH -> RESPONSE)
     */
    update() {
        if (!this._running) return;

        const now = performance.now();

        if (this.state === 'FIXATE') {
            if (now >= this._fixateUntil) {
                // Sinh hướng nghiêng ngẫu nhiên: Trái (-45) / Phải (+45)
                this._stimAngle = (Math.random() < 0.5) ? -45 : 45;
                this._answerDir = (this._stimAngle === 45) ? 'right' : 'left';
                this._generateGabor(this._stimAngle);
                this.state = 'FLASH';
                this._flashUntil = now + this._flashMs;
            }
        } else if (this.state === 'FLASH') {
            if (now >= this._flashUntil) {
                this._gaborImg = null;       // Xóa mảng Gabor, trả lại nền xám
                this.state = 'RESPONSE';
                this._responseStart = performance.now();
            }
        } else if (this.state === 'RESPONSE') {
            // Quá hạn phản xạ -> coi như sai
            if (now - this._responseStart > this.REACT_LIMIT_MS) {
                this._processAnswer(null);
            }
        }
    }

    /**
     * Sinh mảng Gabor vào ImageData (raw pixel) tại tâm canvas
     * @param {number} angle - Góc nghiêng (-45 hoặc 45 độ)
     */
    _generateGabor(angle) {
        const size = Math.max(80, Math.floor(Math.min(this.canvas.width, this.canvas.height) * 0.5));
        const halfSize = Math.floor(size / 2);
        const sigma = size / 3.5;
        const frequency = 4 / size;             // ~4 chu kỳ across
        const maskR2 = (halfSize * 0.95) * (halfSize * 0.95);

        const img = this.ctx.createImageData(size, size);
        const data = img.data;

        const thetaRadian = angle * Math.PI / 180;
        const cosT = Math.cos(thetaRadian);
        const sinT = Math.sin(thetaRadian);

        let idx = 0;
        for (let y = -halfSize; y < halfSize; y++) {
            for (let x = -halfSize; x < halfSize; x++) {
                const r2 = x * x + y * y;
                let L = 128; // Nền xám khi ngoài mặt nạ tròn
                if (r2 <= maskR2) {
                    const xPrime = x * cosT + y * sinT;
                    const yPrime = -x * sinT + y * cosT;
                    const envelope = Math.exp(-(xPrime * xPrime + yPrime * yPrime) / (2 * sigma * sigma));
                    const grating = Math.sin(2 * Math.PI * frequency * xPrime);
                    L = 128 + 127.5 * this.currentContrast * grating * envelope;
                }
                const v = Math.max(0, Math.min(255, Math.round(L)));
                data[idx++] = v;
                data[idx++] = v;
                data[idx++] = v;
                data[idx++] = 255;
            }
        }

        this._gaborImg = img;
        this._gaborX = Math.floor(this.canvas.width / 2 - halfSize);
        this._gaborY = Math.floor(this.canvas.height / 2 - halfSize);
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
     * Vẽ dấu định thị chéo (+) đen ở tâm
     */
    _drawCross(ctx, cx, cy) {
        const len = 14;
        const t = 4;
        ctx.fillStyle = this.colors.fixation;
        ctx.fillRect(cx - len, cy - t / 2, len * 2, t);
        ctx.fillRect(cx - t / 2, cy - len, t, len * 2);
    }

    /**
     * Render đồ họa — ÉP ĐƠN NHÃN, Nền xám + Gabor flash + dấu định thị.
     */
    render() {
        if (!this._running || !this.ctx) return;

        const ctx = this.ctx;

        // Reset các thuộc tính rò rỉ
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.imageSmoothingEnabled = false;

        const cw = this.canvas.width;
        const ch = this.canvas.height;
        const cx = cw / 2;
        const cy = ch / 2;

        // A. Nền xám trung tính tuyệt đối
        ctx.fillStyle = this.colors.bg;
        ctx.fillRect(0, 0, cw, ch);

        // B. Flash Gabor (không vẽ dấu + trong lúc flash)
        if (this.state === 'FLASH' && this._gaborImg) {
            ctx.putImageData(this._gaborImg, this._gaborX, this._gaborY);
        } else {
            // C. Dấu định thị (+) ở các pha chờ
            this._drawCross(ctx, cx, cy);
        }
    }

    /**
     * Kết thúc phiên: Đóng gói payload EMR và báo cáo
     */
    endGame() {
        if (!this._running) return;

        const accuracy = this.totalTrials > 0
            ? (this.correctAnswers / this.totalTrials) * 100
            : 0;

        const avgReactionTimeMs = this._reactionTimes.length > 0
            ? Math.round(this._reactionTimes.reduce((a, b) => a + b, 0) / this._reactionTimes.length)
            : 0;

        // Đóng gói customData theo đặc tả cầu thang
        this.sessionMetrics.customData = {
            finalContrast: this.currentContrast,
            reversals: this.reversals,
            totalTrials: this.totalTrials,
            correctAnswers: this.correctAnswers,
            accuracy: accuracy,
            avgReactionTimeMs: avgReactionTimeMs
        };
        this.sessionMetrics.hits = this.correctAnswers;
        this.sessionMetrics.misses = this.totalTrials - this.correctAnswers;

        this.finishSession();
        this.stop();
    }

    /**
     * Ghi đè stop() để dọn dẹp sự kiện bàn phím
     */
    stop() {
        window.removeEventListener('keydown', this._onKeyDown);
        super.stop();
    }
}

// Xuất toàn cục cho menu controller (classRef dạng chuỗi)
if (typeof window !== 'undefined') {
    window.GaborPerceptualLearningGame = GaborPerceptualLearningGame;
}

export default GaborPerceptualLearningGame;
