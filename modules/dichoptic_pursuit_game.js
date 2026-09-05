/**
 * Module 12: Dichoptic Smooth Pursuit (Bám đuôi phân thị — Smooth Pursuit)
 *
 * Huấn luyện cử động nhãn cầu theo vết (Smooth Pursuit) kết hợp triệt tiêu
 * ức chế vỏ não qua môi trường phân thị (Anaglyph Đỏ - Lục Lam).
 *
 * Cơ chế:
 * - Một đường ray (Path) màu Đỏ uốn lượn theo hàm lượng giác trôi dọc màn hình.
 * - Mục tiêu (Tàu) màu Lục Lam bị khóa cứng tọa độ Y ở nửa dưới màn hình.
 * - Người dùng điều khiển tọa độ X của Tàu bằng chuột / vuốt cảm ứng.
 * - Với globalCompositeOperation = 'lighter', giao điểm Đỏ + Lục Lam phát sáng Trắng
 *   (kích thích hợp thị phân thị: mắt phải thấy Đỏ, mắt trái thấy Lục Lam).
 * - Mỗi frame đánh giá: Tàu có nằm trong băng đường ray không?
 *     + Trong  -> inBoundsFrames++ (bám đuôi đúng)
 *     + Ngoài  -> outOfBoundsHits++, viền nháy đỏ, tiếng báo lỗi.
 */

import BinocularGameEngine from './binocular_game_engine.js';

// ============================================================
// BẢNG ĐỘ KHÓ 10 MỨC (M12) — Smooth Pursuit Dichoptic
// widthPx    : Độ rộng đường ray (Rộng → Rất hẹp)
// speedF     : Tốc độ cuộn (Chậm → Siêu nhanh)
// amplitudePx: Độ uốn lượn (Thoải → Sâu)
// waveform   : 'sine' = uốn lượn chữ S mềm;
//              'zigzag' = zic-zac gắt (đảo chiều liên tục)
// ============================================================
const M12_LEVELS = [
    { level: 1,  widthPx: 160, speedF: 0.45, amplitudePx: 20,  waveform: 'sine' },
    { level: 2,  widthPx: 150, speedF: 0.55, amplitudePx: 40,  waveform: 'sine' },
    { level: 3,  widthPx: 140, speedF: 0.70, amplitudePx: 60,  waveform: 'sine' },
    { level: 4,  widthPx: 120, speedF: 0.90, amplitudePx: 100, waveform: 'sine' },
    { level: 5,  widthPx: 105, speedF: 1.10, amplitudePx: 130, waveform: 'sine' },
    { level: 6,  widthPx: 90,  speedF: 1.30, amplitudePx: 160, waveform: 'sine' },
    { level: 7,  widthPx: 75,  speedF: 1.60, amplitudePx: 140, waveform: 'zigzag' },
    { level: 8,  widthPx: 62,  speedF: 1.90, amplitudePx: 170, waveform: 'zigzag' },
    { level: 9,  widthPx: 50,  speedF: 2.20, amplitudePx: 190, waveform: 'zigzag' },
    { level: 10, widthPx: 40,  speedF: 2.60, amplitudePx: 200, waveform: 'zigzag' }
];

class DichopticPursuitGame extends BinocularGameEngine {
    /**
     * Khởi tạo Smooth Pursuit
     * Thiết lập màu phân thị, mảng đường ray, trạng thái đánh giá.
     */
    constructor() {
        super();

        // --- Tên game cho EMR identification (M12) ---
        this.gameName = 'M12: Bám đuôi phân thị (Dichoptic Smooth Pursuit)';

        // --- Màu sắc phân thị (Anaglyph) ---
        // Nền đen tuyệt đối, Đường ray Đỏ, Mục tiêu Lục Lam.
        this.bgColor = '#000000';
        this.pathColor = '#FF0000';   // Đường ray (Mắt phải)
        this.shipColor = '#00FFFF';   // Mục tiêu / Tàu (Mắt trái)
        this.glowColor = '#FFFFFF';   // Màu giao điểm (khi dùng 'lighter')

        // --- Mảng tọa độ X của đường ray dọc theo trục Y ---
        // Được duy trì & cập nhật mỗi frame thay vì vẽ lại đa giác từ đầu.
        this.pathXArray = [];
        this.pathStep = 3; // Bước lấy mẫu (px) khi dựng đa giác băng đường ray

        // --- Trạng thái mục tiêu (Tàu) ---
        this.targetX = 0;
        this.targetY = 0; // Khóa cứng ở nửa dưới màn hình (thiết lập trong start)

        // --- Thông số động (ghi đè bởi Lobby theo Level) ---
        this.level = 1;           // Cấp độ hiện tại (Level 1..10)
        this.frequency = 0.022;   // Tần số lượng giác (rad/px)
        this.amplitudePx = 110;   // Biên độ uốn lượn (px)
        this.pathWidthPx = 80;    // Độ rộng băng đường ray (px)
        this.speedFactor = 1.0;   // Tốc độ trôi (rad/s cho timeOffset)
        this.waveform = 'sine';   // Dạng sóng: 'sine' (chữ S) | 'zigzag' (zic-zac)
        this.durationMs = 90000; // Thời lượng cố định (90s = 1.5 phút)

        // --- Trạng thái đánh giá ---
        this.totalFrames = 0;
        this.inBoundsFrames = 0;
        this.outOfBoundsHits = 0;

        // --- Hiệu ứng nháy viền đỏ khi chệch hướng ---
        this._flashUntil = 0;
        this._lastErrorSound = 0;

        // --- Thời gian ---
        this._timeOffset = 0;
        this._endTime = 0;
    }

    /**
     * [AUTO-CENTER] Khi cửa sổ đổi kích thước: neo lại Tàu ở nửa dưới
     * màn hình mới và cấp lại bộ đệm đường ray theo chiều cao mới.
     * @param {number} w  - Chiều rộng canvas mới
     * @param {number} h  - Chiều cao canvas mới
     * @param {number} cx - Tâm ngang mới
     * @param {number} cy - Tâm dọc mới
     */
    onResize(w, h, cx, cy) {
        if (this.canvas) {
            this.targetY = h * 0.75;
            this.targetX = Math.max(0, Math.min(this.targetX, w));
        }
        // [C10] Cấp lại bộ đệm đúng kích thước mới (chỉ khi thực sự thay đổi)
        if (!this.pathXArray || this.pathXArray.length !== h + 1) {
            this.pathXArray = new Array(h + 1).fill(cx);
        }
    }

    /**
     * Ánh xạ Level (1..10) → Thông số vật lý nội bộ theo bảng M12_LEVELS.
     * Level càng cao: đường ray hẹp hơn, tốc độ nhanh hơn, uốn lượn sâu hơn,
     * bắt đầu dạng zic-zac gắt từ Level 7.
     * @param {number|string} level - Cấp độ người dùng chọn (mặc định 1)
     * @returns {number} Level hợp lệ (clamp 1..10)
     */
    _applyLevel(level) {
        const lvl = Math.max(1, Math.min(10, parseInt(level, 10) || 1));
        const cfg = M12_LEVELS.find(l => l.level === lvl) || M12_LEVELS[0];
        this.pathWidthPx = cfg.widthPx;
        this.speedFactor = cfg.speedF;
        this.amplitudePx = cfg.amplitudePx;
        this.waveform = cfg.waveform;
        return lvl;
    }

    /**
     * Bắt đầu game
     * Đọc cấu hình từ Lobby, khởi tạo AudioContext, gắn sự kiện pointer, chạy loop.
     * @param {Object} config - Cấu hình từ form Lobby (level)
     */
    start(config = {}) {
        // --- Ánh xạ Level → Thông số vật lý (thay thế dropdown rời rạc) ---
        this.level = this._applyLevel(config && config.level);

        // --- Thời lượng cố định: 90 giây (1.5 phút) ---
        this.durationMs = 90000;

        // --- Khóa cứng tọa độ Y của Tàu ở nửa dưới màn hình ---
        this.targetY = this.canvas.height * 0.75;
        this.targetX = this.canvas.width / 2;

        // --- Chuẩn bị mảng đường ray ---
        this.pathXArray = new Array(this.canvas.height + 1).fill(this.canvas.width / 2);

        // --- Reset trạng thái đánh giá ---
        this.totalFrames = 0;
        this.inBoundsFrames = 0;
        this.outOfBoundsHits = 0;
        this._timeOffset = 0;
        this._endTime = Date.now() + this.durationMs;

        // --- Khởi tạo AudioContext sớm (sau cử chỉ người dùng) ---
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) {
                this._audioCtx = new AC();
                if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
            }
        } catch (e) { /* im lặng */ }

        // Bắt đầu render loop
        super.start();

        // --- Gắn sự kiện điều khiển Tàu (chuột + cảm ứng) ---
        if (this.canvas) {
            this.canvas.style.cursor = 'none';
            this._boundPointerMove = this._handlePointerMove.bind(this);
            this.canvas.addEventListener('mousemove', this._boundPointerMove);
            this.canvas.addEventListener('touchmove', this._boundPointerMove, { passive: false });
            this.canvas.addEventListener('touchstart', this._boundPointerMove, { passive: false });
        }
    }

    /**
     * Dừng game & dọn dẹp sự kiện
     */
    stop() {
        if (this.canvas && this._boundPointerMove) {
            this.canvas.removeEventListener('mousemove', this._boundPointerMove);
            this.canvas.removeEventListener('touchmove', this._boundPointerMove);
            this.canvas.removeEventListener('touchstart', this._boundPointerMove);
            this.canvas.style.cursor = 'default';
        }
        super.stop();
    }

    /**
     * Xử lý di chuyển chuột / vuốt cảm ứng → cập nhật tọa độ X của Tàu
     * @param {MouseEvent|TouchEvent} e
     * @private
     */
    _handlePointerMove(e) {
        if (e.cancelable) e.preventDefault();

        // Chuẩn hóa tọa độ client (hỗ trợ Touch + Mouse)
        let clientX = 0;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
        } else if (e.clientX !== undefined) {
            clientX = e.clientX;
        }

        // Khử tỷ lệ scale CSS → tọa độ nội tại canvas
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / this.canvas.clientWidth;
        let x = (clientX - rect.left) * scaleX;

        // Giới hạn trong lề canvas
        const half = this.pathWidthPx / 2 + 6;
        x = Math.max(half, Math.min(this.canvas.width - half, x));
        this.targetX = x;
    }

    /**
     * Hàm lượng giác tính tọa độ X của đường ray tại độ cao Y
     * PathX(Y) = CanvasWidth/2 + Wave(Y, timeOffset) * Amplitude
     * - waveform 'sine'  : sin() — uốn lượn chữ S mềm mại
     * - waveform 'zigzag': sóng tam giác (asin(sin())) — zic-zac gắt, đảo chiều liên tục
     * @param {number} y - Tọa độ Y
     * @returns {number} Tọa độ X tương ứng
     */
    _pathXAt(y) {
        let wave;
        if (this.waveform === 'zigzag') {
            wave = (2 / Math.PI) * Math.asin(Math.sin(y * this.frequency + this._timeOffset));
        } else {
            wave = Math.sin(y * this.frequency + this._timeOffset);
        }
        return this.canvas.width / 2 + wave * this.amplitudePx;
    }

    /**
     * Cập nhật logic mỗi frame:
     * - Tăng timeOffset (trôi đường ray) theo Delta-time [A1]
     * - Cập nhật mảng pathXArray [C10: Buffer reuse — chỉ cấp lại khi resize]
     * - Đánh giá va chạm Tàu ↔ băng đường ray tại Y
     * - Kiểm tra hết thời lượng
     * @param {number} dt - Delta-time (giây) từ Engine
     */
    update(dt = 0) {
        const now = performance.now();

        // Trôi timeOffset: speedFactor (rad/s) × dt
        this._timeOffset += this.speedFactor * dt;

        // Cập nhật mảng tọa độ X dọc trục Y
        // [C10] Tái sử dụng bộ đệm — không cấp phát new Array() mỗi frame,
        // chỉ cấp lại khi chiều cao canvas thay đổi (resize).
        const h = this.canvas.height;
        if (!this.pathXArray || this.pathXArray.length !== h + 1) {
            this.pathXArray = new Array(h + 1);
        }
        for (let y = 0; y <= h; y++) {
            this.pathXArray[y] = this._pathXAt(y);
        }

        // --- Đánh giá va chạm tại Y của Tàu ---
        const yIdx = Math.max(0, Math.min(h, Math.round(this.targetY)));
        const pathX = this.pathXArray[yIdx];
        const halfW = this.pathWidthPx / 2;

        const inBounds = Math.abs(this.targetX - pathX) <= halfW;
        this.totalFrames++;

        if (inBounds) {
            this.inBoundsFrames++;
        } else {
            this.outOfBoundsHits++;
            // Kích hoạt nháy viền đỏ + tiếng báo lỗi (giới hạn 300ms/lần)
            this._flashUntil = now + 200;
            if (now - this._lastErrorSound > 300) {
                this._playErrorSound();
                this._lastErrorSound = now;
            }
        }

        // --- Kiểm tra hết thời lượng ---
        if (Date.now() >= this._endTime) {
            this._endGame();
        }
    }

    /**
     * Phát âm thanh báo lỗi (square wave ngắn) qua WebAudio
     * @private
     */
    _playErrorSound() {
        if (!this._audioCtx) return;
        try {
            const ctx = this._audioCtx;
            const t = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, t);
            osc.frequency.exponentialRampToValueAtTime(120, t + 0.15);
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.18);
        } catch (e) { /* im lặng */ }
    }

    /**
     * Render đồ họa mỗi frame
     * - Nền đen tuyệt đối
     * - Băng đường ray Đỏ (fill polygon từ pathXArray)
     * - Tàu Lục Lam tại (targetX, targetY)
     * - globalCompositeOperation = 'lighter' → giao điểm phát sáng Trắng
     */
    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // A. Reset trạng thái context & xóa nền đen tuyệt đối
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(0, 0, w, h);

        // B. Bật chế độ cộng sáng để giao điểm Đỏ + Lục Lam = Trắng
        ctx.globalCompositeOperation = 'lighter';

        // B1. Vẽ băng đường ray (Đỏ) từ mảng pathXArray
        const halfW = this.pathWidthPx / 2;
        const step = this.pathStep;
        ctx.beginPath();
        // Cạnh trên (trái → phải theo Y)
        for (let y = 0; y <= h; y += step) {
            const x = this.pathXArray[y] - halfW;
            if (y === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        // Cạnh dưới (phải → trái theo Y)
        for (let y = Math.floor(h / step) * step; y >= 0; y -= step) {
            const x = this.pathXArray[y] + halfW;
            ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = this.pathColor;
        ctx.fill();

        // B2. Vẽ mục tiêu (Tàu) màu Lục Lam
        const shipR = Math.max(14, this.pathWidthPx * 0.45);
        ctx.beginPath();
        ctx.arc(this.targetX, this.targetY, shipR, 0, Math.PI * 2);
        ctx.fillStyle = this.shipColor;
        ctx.fill();

        // Dấu thập trắng ở tâm Tàu để định thị hoàng điểm
        const cross = shipR * 0.5;
        ctx.strokeStyle = this.glowColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.targetX - cross, this.targetY);
        ctx.lineTo(this.targetX + cross, this.targetY);
        ctx.moveTo(this.targetX, this.targetY - cross);
        ctx.lineTo(this.targetX, this.targetY + cross);
        ctx.stroke();

        // C. Trả về source-over cho viền / HUD
        ctx.globalCompositeOperation = 'source-over';

        // C1. Viền canvas: nháy đỏ khi chệch hướng, thường là xám khóa hợp thị
        const now = performance.now();
        const flashing = now < this._flashUntil;
        ctx.strokeStyle = flashing ? '#FF0000' : '#334155';
        ctx.lineWidth = flashing ? 14 : 10;
        ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);

        // C2. HUD: thời gian còn lại + chỉ số
        const remainMs = Math.max(0, this._endTime - Date.now());
        const remainS = Math.ceil(remainMs / 1000);
        const acc = this.totalFrames > 0 ? (this.inBoundsFrames / this.totalFrames * 100) : 0;

        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Thời gian: ${remainS}s`, 24, 24);
        ctx.fillText(`Level ${this.level} | Chính xác: ${acc.toFixed(1)}%`, 24, 52);
        ctx.fillStyle = flashing ? '#f87171' : '#94a3b8';
        ctx.fillText(`Chệch hướng: ${this.outOfBoundsHits}`, 24, 80);

        ctx.fillStyle = 'rgba(226,232,240,0.5)';
        ctx.font = '15px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('Di chuyển chuột / vuốt để lái Tàu bám sát đường ray | ESC thoát', w - 24, 24);
    }

    /**
     * Kết thúc game & đóng gói dữ liệu EMR
     * @private
     */
    _endGame() {
        // 1. Tính độ chính xác bám đuôi (= tỷ lệ hoàn thành tín hiệu của Level)
        const trackingAccuracy = this.totalFrames > 0
            ? (this.inBoundsFrames / this.totalFrames * 100)
            : 0;
        const completionRate = trackingAccuracy;

        // 2. Mở khóa Level kế tiếp nếu đạt > 85% (chưa phải Level tối đa)
        const LEVEL_KEY = 'vision-therapy-m12-max-level';
        const maxLevel = parseInt(localStorage.getItem(LEVEL_KEY) || '1', 10) || 1;
        let unlockedNew = false;
        if (completionRate > 85 && this.level >= maxLevel && this.level < 10) {
            localStorage.setItem(LEVEL_KEY, String(this.level + 1));
            unlockedNew = true;
        }

        // 3. Chuỗi độ khó (ghi rõ Level đã chinh phục)
        const speedLabel = this.speedFactor <= 0.6 ? 'Chậm' : (this.speedFactor >= 1.8 ? 'Nhanh' : 'Vừa');
        const widthLabel = this.pathWidthPx >= 140 ? 'Rộng' : (this.pathWidthPx <= 40 ? 'Rất hẹp' : 'Vừa');
        const waveLabel = this.waveform === 'zigzag' ? 'Zic-zac' : (this.amplitudePx <= 60 ? 'Thoải' : 'Chữ S');
        const difficulty = `Level ${this.level} | Tốc độ: ${speedLabel} | Đường ray: ${widthLabel} | Dạng sóng: ${waveLabel} | 90s`;

        // 4. Đóng gói customData gửi cho EMR Core
        this.sessionMetrics.customData = {
            level: this.level,
            completionRate: completionRate,
            totalFrames: this.totalFrames,
            inBoundsFrames: this.inBoundsFrames,
            outOfBoundsHits: this.outOfBoundsHits,
            trackingAccuracy: trackingAccuracy,
            difficulty: difficulty,
            nextLevelUnlocked: unlockedNew
        };
        this.finishSession();

        // 5. Đánh giá lâm sàng
        const isPassed = completionRate > 85;
        const evalColor = isPassed ? '#4ade80' : '#f87171';
        const evalText = isPassed
            ? `${unlockedNew ? 'ĐẠT — Đã mở khóa Level ' + (this.level + 1) + '!' : 'ĐẠT (Bám đuôi ổn định)'}`
            : 'CHƯA ĐẠT (Cần đạt > 85% để mở khóa Level kế tiếp)';

        // 6. Dừng game
        this.stop();

        // 6. Overlay kết quả
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; inset: 0; z-index: 2147483647; background: #0f172a; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif;';

        overlay.innerHTML = `
            <div style="background: #1e293b; border-radius: 12px; padding: 30px; max-width: 620px; width: 90%; box-shadow: 0 4px 24px rgba(0,0,0,0.5);">
                <h2 style="text-align: center; color: #38bdf8; margin: 0 0 20px 0; font-size: 24px;">KẾT QUẢ BÁM ĐUÔI PHÂN THỊ (SMOOTH PURSUIT)</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="border: 1px solid #475569; border-radius: 8px; padding: 15px; text-align: center;">
                        <p style="color: #94a3b8; margin: 0 0 8px 0; font-size: 14px;">Chính xác bám đuôi</p>
                        <p style="font-size: 28px; color: #22d3ee; margin: 0; font-weight: bold;">${trackingAccuracy.toFixed(1)}%</p>
                    </div>
                    <div style="border: 1px solid #475569; border-radius: 8px; padding: 15px; text-align: center;">
                        <p style="color: #94a3b8; margin: 0 0 8px 0; font-size: 14px;">Số lần chệch hướng</p>
                        <p style="font-size: 28px; color: #f87171; margin: 0; font-weight: bold;">${this.outOfBoundsHits}</p>
                    </div>
                </div>
                <div style="background: rgba(100, 116, 139, 0.1); border: 1px solid #64748b; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
                    <p style="color: #94a3b8; margin: 0 0 5px 0; font-size: 13px;">Cấp độ đã chinh phục: <b style="color: #e2e8f0;">Level ${this.level}</b> | Tỷ lệ hoàn thành: <b style="color: #e2e8f0;">${completionRate.toFixed(1)}%</b></p>
                    <p style="color: #94a3b8; margin: 0 0 5px 0; font-size: 13px;">Tổng số khung hình: <b>${this.totalFrames}</b> | Bám đúng: <b>${this.inBoundsFrames}</b></p>
                    <p style="color: #94a3b8; margin: 0; font-size: 13px;">Cấu hình: <b>${difficulty}</b></p>
                </div>
                <div style="border: 1px solid ${evalColor}; border-radius: 8px; padding: 15px; text-align: center; margin-bottom: 20px;">
                    <p style="font-size: 18px; color: ${evalColor}; margin: 0; font-weight: bold;">${evalText}</p>
                </div>
                <div style="text-align: center;">
                    <button id="btn-finish-m12" style="padding: 12px 30px; font-size: 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">HOÀN THÀNH PHÁC ĐỒ</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const finishBtn = document.getElementById('btn-finish-m12');
        if (finishBtn) {
            finishBtn.onclick = () => {
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                }
                overlay.remove();
            };
        }
    }
}

// Xuất module cho ES Module import
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DichopticPursuitGame };
}

export default DichopticPursuitGame;
