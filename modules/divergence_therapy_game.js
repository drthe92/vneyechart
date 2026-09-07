import BinocularGameEngine from './binocular_game_engine.js';

// [A4] Kích thước thanh hợp thị theo GÓC THỊ GIÁC tuyệt đối (arcsec) —
// quy đổi sang px bằng this.arcsecToPixels() của Engine, thay cho
// kích thước cứng 60x150px (trôi tỷ lệ vật lý khi đổi màn hình).
const M6_BAR_WIDTH_ARCSEC = 6480;   // ~1.8° chiều ngang thanh hợp thị
const M6_BAR_HEIGHT_ARCSEC = 16200; // ~4.5° chiều dọc thanh hợp thị

// Bảng độ khó 10 mức (M6_LEVELS) — gamify giống M1/M2/M4/M5/M7/M8/M9/M10/M11/M12:
// Level càng cao → mức lăng kính phân kỳ (Base-In) đích càng lớn,
// leo dốc mượt từ 2 Δ (Level 1) lên 8 Δ (Level 10) — đúng chuẩn lâm sàng M6.
const M6_LEVELS = [
    { level: 1,  targetDiopter: 2.0 },
    { level: 2,  targetDiopter: 2.7 },
    { level: 3,  targetDiopter: 3.3 },
    { level: 4,  targetDiopter: 4.0 },
    { level: 5,  targetDiopter: 4.7 },
    { level: 6,  targetDiopter: 5.3 },
    { level: 7,  targetDiopter: 6.0 },
    { level: 8,  targetDiopter: 6.7 },
    { level: 9,  targetDiopter: 7.3 },
    { level: 10, targetDiopter: 8.0 }
];

// CƠ CHẾ MỚI M6 — Test liên tục 1 lần:
// 1. 2 khối bắt đầu HỢP NHẤT thành 1 hình, tách dần đều 0.5 Δ/giây
//    đến MỤC TIÊU ĐIỀU TRỊ (Δ của Level), rồi giữ nguyên mức đích.
// 2. ĐẠT = duy trì hợp thị ở mức đích đủ 20 giây.
// 3. Tương tác (SPACE/chạm) TRƯỚC mốc ĐẠT → nghỉ 5s, khởi động lại từ đầu.
//    Tương tác SAU mốc ĐẠT → QUA MÀN, mở khóa Level kế tiếp.
// 4. Không tương tác 1 phút kể từ ĐẠT → hộp thoại 3 lựa chọn kết quả quan sát.
const M6_RAMP_SPEED = 0.5;        // vận tốc tách đều (Δ/giây)
const M6_HOLD_PASS_MS = 20000;    // 20 giây duy trì mức đích = ĐẠT
const M6_PASS_TIMEOUT_MS = 60000; // 1 phút chờ tương tác sau ĐẠT
const M6_REST_MS = 5000;          // 5 giây nghỉ khi vỡ sớm

class DivergenceTherapyGame extends BinocularGameEngine {
    constructor() {
        super();
        this.gameName = 'M6: Tập Phân Kỳ';
        this.state = 'RAMPING'; // RAMPING | HOLDING | PASSED_WAIT | RESTING | ENDED

        this.level = 1;                  // Cấp độ hiện tại (1..10) — gamify
        this.currentDiopter = 0;         // Độ tách hiện tại (0 = hình hợp nhất)
        this.targetDiopter = 8;          // Mục tiêu điều trị (Δ của Level / bác sĩ chỉ định)

        this.holdStartTime = 0;          // Thời điểm bắt đầu giữ mức đích
        this.passedAt = 0;               // Mốc ĐẠT (giữ đích đủ 20 giây)
        this.earlyBreaks = 0;            // Số lần vỡ sớm (làm lại từ đầu)
        this.flashAlpha = 0;             // Viền xanh chớp tại mốc ĐẠT

        this.stateStartTime = 0;
        this.totalPlayTime = 0;
        this.gameStartTime = 0;

        // [A4] Kích thước vật lý thanh hợp thị (px thực tế theo hiệu chuẩn)
        this._updateBarPhysicalSize();

        this._spaceHandler = (e) => {
            if (e.code === 'Space') this._handleBreak();
        };
        // Hỗ trợ cảm ứng: chạm màn hình = báo tách đôi (tương đương SPACE)
        this._pointerHandler = (e) => {
            e.preventDefault();
            this._handleBreak();
        };
        // ESC: thoát game ngay lập tức (dừng phiên, dọn canvas, về Lobby)
        // — không phụ thuộc thoát fullscreen native của trình duyệt
        this._escHandler = (e) => {
            if (e.key === 'Escape' && this._running) {
                e.preventDefault();
                if (typeof window.closeTherapyModule === 'function') {
                    window.closeTherapyModule();
                } else {
                    this._requestExit();
                }
            }
        };
    }

    /**
     * [A4] Quy đổi kích thước thanh hợp thị từ góc thị giác (arcsec)
     * sang px thực tế bằng hệ số hiệu chuẩn của Engine (arcsecToPixels).
     * Kích thước vật lý giữ nguyên khi đổi màn hình / resize cửa sổ.
     * @private
     */
    _updateBarPhysicalSize() {
        this.barWidth = Math.max(24, Math.round(this.arcsecToPixels(M6_BAR_WIDTH_ARCSEC)));
        this.barHeight = Math.max(40, Math.round(this.arcsecToPixels(M6_BAR_HEIGHT_ARCSEC)));
    }

    /**
     * Ánh xạ Level (1..10) → Mức lăng kính phân kỳ đích (Δ).
     * @param {number|string} level - Cấp độ người dùng chọn (mặc định 1)
     * @returns {number} Level hợp lệ (clamp 1..10)
     */
    _applyLevel(level) {
        const lvl = Math.max(1, Math.min(10, parseInt(level, 10) || 1));
        const cfg = M6_LEVELS.find(l => l.level === lvl) || M6_LEVELS[0];
        this.level = lvl;
        this.targetDiopter = cfg.targetDiopter;
        return lvl;
    }

    start(config = {}) {
        console.info('[M6] Bản v4 — tách dần 0.5Δ/s → giữ đích 20s = ĐẠT');
        console.info('[M6] Config nhận được từ Lobby:', JSON.stringify(config));
        super.start();
        window.addEventListener('keydown', this._spaceHandler);
        window.addEventListener('keydown', this._escHandler);
        if (this.canvas) {
            this.canvas.addEventListener('pointerdown', this._pointerHandler);
        }

        // Khởi tạo AudioContext sớm (sau cử chỉ click của người dùng) để
        // âm thanh phản hồi Đạt mức / Vỡ hợp thị hoạt động ngay từ đầu phiên
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) {
                this._audioCtx = new AC();
                if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
            }
        } catch (e) { /* im lặng */ }

        // --- Chế độ MẶC ĐỊNH: Level (Lobby chọn cấp độ, chặn level chưa mở khóa) ---
        // --- Chế độ NÂNG CAO: CHỈ kích hoạt khi bác sĩ bật toggle "Cấu hình nâng cao"
        //     (advanced='on') trong Lobby. KHÔNG tự suy diễn từ startDiopter/targetDiopter
        //     để tránh Lobby cũ (chưa có level picker) làm game rơi vào nhánh tăng dần cũ. ---
        const isAdvanced = !!(config && String(config.advanced) === 'on');
        this._isAdvancedMode = isAdvanced;
        console.info(isAdvanced ? '[M6] ►► CHẾ ĐỘ NÂNG CAO (toggle đang BẬT trong Lobby!)' : '[M6] ► CHẾ ĐỘ LEVEL (mặc định)');

        this.level = 1;
        if (!isAdvanced) {
            // Level mode: level từ Lobby, hoặc fallback Level cao nhất đã mở khóa
            const lvl = (config && config.level != null && String(config.level) !== '')
                ? config.level
                : ((typeof window.getTherapyMaxLevel === 'function')
                    ? window.getTherapyMaxLevel('M6')
                    : (parseInt(localStorage.getItem('vision-therapy-m6-max-level') || '1', 10) || 1));
            this._applyLevel(lvl);
            console.info(`[M6] Chế độ Level ${this.level} — mục tiêu ${this.targetDiopter} Δ (tách 0.5Δ/s → giữ đích 20s)`);
        } else {
            // Legacy: cấu hình thủ công mức lăng kính (bác sĩ chỉ định Δ)
            const domStart = document.getElementById('m6-start') || document.querySelector('[data-start-diopter]');
            const domTarget = document.getElementById('m6-target') || document.querySelector('[data-target-diopter]');
            this.targetDiopter = config.targetDiopter || (domTarget ? parseInt(domTarget.value) : 8);
            console.info(`[M6] Chế độ nâng cao (bác sĩ chỉ định Δ): mục tiêu ${this.targetDiopter} Δ`);
        }

        // Reset trạng thái phiên
        this.currentDiopter = 0;
        this.earlyBreaks = 0;
        this.flashAlpha = 0;
        this.holdStartTime = 0;
        this.passedAt = 0;
        this._resultPromptShown = false;

        this.canvas.style.cursor = 'none';
        this.gameStartTime = Date.now();
        this._setState('RAMPING');
    }

    stop() {
        const prompt = document.getElementById('m6-result-prompt');
        if (prompt && prompt.parentNode) prompt.parentNode.removeChild(prompt);
        window.removeEventListener('keydown', this._spaceHandler);
        window.removeEventListener('keydown', this._escHandler);
        if (this.canvas) {
            this.canvas.removeEventListener('pointerdown', this._pointerHandler);
        }
        super.stop();
    }

    _setState(newState) {
        this.state = newState;
        this.stateStartTime = Date.now();
    }

    // --- 2. LOGIC TƯƠNG TÁC (SPACE / CHẠM MÀN HÌNH) ---
    _handleBreak() {
        if (this.state === 'ENDED' || this.state === 'RESTING') return;

        if (this.state === 'PASSED_WAIT') {
            // Tương tác SAU mốc ĐẠT → QUA MÀN, mở khóa Level kế tiếp
            this._playTone(880, 'sine', 0.12); // Ting (đạt)
            this._endGame('ĐẠT — tương tác sau mốc giữ đích 20 giây', true);
            return;
        }

        // RAMPING / HOLDING: tương tác TRƯỚC mốc ĐẠT → nghỉ 5s rồi khởi động lại từ đầu
        this.earlyBreaks++;
        this._playTone(160, 'square', 0.18); // Buzzer (vỡ sớm)
        this.currentDiopter = 0;
        this._setState('RESTING');
    }

    update(dt = 0) {
        if (this.state === 'ENDED') return;

        const now = Date.now();
        const elapsed = now - this.stateStartTime;

        if (this.state === 'RAMPING') {
            // Tách dần đều 0.5 Δ/giây từ hình hợp nhất đến mục tiêu điều trị
            this.currentDiopter += M6_RAMP_SPEED * (dt > 0 ? dt : 0.016);
            if (this.currentDiopter >= this.targetDiopter) {
                this.currentDiopter = this.targetDiopter;
                this.holdStartTime = now;
                this._setState('HOLDING');
            }
        } else if (this.state === 'HOLDING') {
            // Giữ nguyên mức đích; ĐẠT sau 20 giây duy trì
            if (now - this.holdStartTime >= M6_HOLD_PASS_MS) {
                this.passedAt = now;
                this.flashAlpha = 1.0;      // Viền xanh chớp tại mốc ĐẠT
                this._playTone(880, 'sine', 0.12); // Ting (mốc ĐẠT)
                this._setState('PASSED_WAIT');
            }
        } else if (this.state === 'PASSED_WAIT') {
            // Không tương tác trong 1 phút kể từ ĐẠT → hộp thoại 3 lựa chọn
            if (!this._resultPromptShown && now - this.passedAt >= M6_PASS_TIMEOUT_MS) {
                this._showResultPrompt();
            }
        } else if (this.state === 'RESTING') {
            if (elapsed >= M6_REST_MS) {
                // Nghỉ xong 5s → khởi động lại từ đầu (hình hợp nhất)
                this.currentDiopter = 0;
                this._setState('RAMPING');
            }
        }

        // Fade viền xanh ĐẠT
        if (this.flashAlpha > 0) {
            this.flashAlpha -= 3 * (dt > 0 ? dt : 0.016);
            if (this.flashAlpha < 0) this.flashAlpha = 0;
        }
    }

    // --- 3. ĐỒNG HỒ VÒNG TRÒN & QUANG HỌC ---
    // [A3] Sử dụng this.diopterToPixels() kế thừa từ Engine (hệ quy chiếu
    // Prism Diopter duy nhất theo hiệu chuẩn) — đã xóa công thức tự tính
    // với hardcode 3.78 px/mm & 40cm.

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

    render() {
        super.render(); // Nền trắng an toàn
        if (this.state === 'ENDED') return;

        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        // 1. Tính toán vị trí Lăng kính Phân kỳ (Base-In)
        // Mắt Trái (Cyan) dịch phải, Mắt Phải (Đỏ) dịch trái
        // currentDiopter = 0 → 2 khối chồng khít = 1 hình hợp nhất
        const splitPx = this.diopterToPixels(this.currentDiopter) / 2;
        const leftBarX = cx + splitPx;  // Trái tiến sang Phải
        const rightBarX = cx - splitPx; // Phải tiến sang Trái

        // 2. Vẽ hai khối màu (Blend Mode)
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = this.colors.left || '#00FFFF'; // Cyan
        ctx.fillRect(leftBarX - this.barWidth/2, cy - this.barHeight/2, this.barWidth, this.barHeight);

        ctx.fillStyle = this.colors.right || '#FF0000'; // Red
        ctx.fillRect(rightBarX - this.barWidth/2, cy - this.barHeight/2, this.barWidth, this.barHeight);
        ctx.globalCompositeOperation = 'source-over';

        // 3. Viền xanh chớp tại mốc ĐẠT (Micro-Biofeedback)
        if (this.flashAlpha > 0) {
            ctx.save();
            ctx.strokeStyle = `rgba(74, 222, 128, ${this.flashAlpha})`;
            ctx.lineWidth = 15;
            ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.restore();
        }

        // 4. Text HUD tối giản — chữ ít, màu nhạt trên nền trắng (không nhiễu thị giác)
        const now = Date.now();
        let phaseText = '';
        let phaseColor = '#475569';
        if (this.state === 'RAMPING') {
            phaseText = 'Đang tách dần...';
        } else if (this.state === 'HOLDING') {
            const remainS = Math.max(0, Math.ceil((M6_HOLD_PASS_MS - (now - this.holdStartTime)) / 1000));
            phaseText = `Giữ đích: ${remainS}s / 20s`;
        } else if (this.state === 'PASSED_WAIT') {
            phaseText = '✔ ĐẠT! Bấm SPACE khi thấy hình tách đôi hoặc muốn kết thúc level';
            phaseColor = '#16a34a';
        } else if (this.state === 'RESTING') {
            const remainS = Math.max(0, Math.ceil((M6_REST_MS - (now - this.stateStartTime)) / 1000));
            phaseText = `Nghỉ ${remainS}s — làm lại từ đầu`;
            phaseColor = '#b45309';
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Dòng 1: độ tách hiện tại
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.fillText(`${this.currentDiopter.toFixed(1)} Δ`, 20, 26);

        // Dòng 2: Level / mục tiêu
        ctx.font = '13px Arial, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(this._isAdvancedMode ? `Mục tiêu ${this.targetDiopter} Δ` : `Level ${this.level}/10 · Đích ${this.targetDiopter} Δ`, 20, 56);

        // Dòng 3: pha hiện tại
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.fillStyle = phaseColor;
        ctx.fillText(phaseText, 20, 80);

        // Dòng 4: hướng dẫn mờ
        ctx.font = '12px Arial, sans-serif';
        ctx.fillStyle = 'rgba(100, 116, 139, 0.55)';
        ctx.fillText('SPACE / chạm khi tách đôi', 20, 104);

        if (this.state === 'RESTING') {
            ctx.fillStyle = 'rgba(180, 83, 9, 0.75)';
            ctx.textAlign = 'center';
            ctx.fillText('ĐANG NGHỈ NGƠI...', cx, cy - 30);
            ctx.textAlign = 'left';
        }
    }

    /**
     * Hộp thoại 3 lựa chọn sau 1 phút không tương tác kể từ mốc ĐẠT.
     * Người dùng xác nhận kết quả quan sát được trong suốt quá trình test.
     * @private
     */
    _showResultPrompt() {
        if (this._resultPromptShown || this.state !== 'PASSED_WAIT') return;
        this._resultPromptShown = true;

        const overlay = document.createElement('div');
        overlay.id = 'm6-result-prompt';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 10000;
            background: rgba(15, 23, 42, 0.95);
            color: white;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            text-align: center; padding: 30px;
            font-family: 'Segoe UI', Arial, sans-serif;
        `;

        overlay.innerHTML = `
            <h1 style="font-size: 26px; color: #4ade80; margin-bottom: 12px;">✅ HOÀN THÀNH BÀI TEST</h1>
            <p style="font-size: 16px; color: #cbd5e1; margin: 0 0 8px 0;">
                Bạn đã giữ hợp thị ở mức đích ${this.targetDiopter} Δ đủ 20 giây (ĐẠT).
            </p>
            <p style="font-size: 15px; color: #94a3b8; margin: 0 0 24px 0;">
                Hãy cho biết bạn quan sát được gì trong suốt quá trình test:
            </p>
            <div style="display:flex; flex-direction:column; gap:12px; width:100%; max-width:540px;">
                <button id="m6-prompt-single" style="padding:14px 20px; font-size:15px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px; font-weight:bold;">
                    1. Tôi thấy 1 khối hình suốt quá trình test → ĐẠT, mở khóa Level kế tiếp
                </button>
                <button id="m6-prompt-split" style="padding:14px 20px; font-size:15px; cursor:pointer; background:#f59e0b; color:white; border:none; border-radius:8px; font-weight:bold;">
                    2. Tôi thấy khối hình tách ra → đọc kỹ hướng dẫn, làm lại test (CHƯA ĐẠT)
                </button>
                <button id="m6-prompt-abandon" style="padding:14px 20px; font-size:15px; cursor:pointer; background:#64748b; color:white; border:none; border-radius:8px; font-weight:bold;">
                    3. Tôi bỏ dở test, bỏ qua phiên tập (CHƯA ĐẠT)
                </button>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('m6-prompt-single').onclick = () => {
            overlay.remove();
            this._endGame('ĐẠT — thấy 1 khối hình suốt quá trình test', true);
        };
        document.getElementById('m6-prompt-split').onclick = () => {
            overlay.remove();
            this._endGame('CHƯA ĐẠT — thấy khối hình tách ra, cần làm lại test', false);
        };
        document.getElementById('m6-prompt-abandon').onclick = () => {
            overlay.remove();
            this._endGame('CHƯA ĐẠT — bỏ dở test, bỏ qua phiên tập', false);
        };
    }

    // --- 4. KẾT THÚC VÀ LƯU BỆNH ÁN ---
    _endGame(reason, passed = false) {
        this.state = 'ENDED';
        this.totalPlayTime = Math.round((Date.now() - this.gameStartTime) / 1000);
        if (this.canvas) this.canvas.style.cursor = 'default';

        // Mức lăng kính tối đa đạt được = mục tiêu điều trị (Prism Diopters - Δ)
        const maxDiopters = this.targetDiopter;

        // --- Chế độ Level: mở khóa Level kế tiếp nếu ĐẠT và chưa phải Level tối đa ---
        // [FIX LEVEL] Đọc/ghi theo từng bệnh nhân (helper trong therapeutic_menu_controller)
        let unlockedNew = false;
        const graduated = passed && !this._isAdvancedMode && this.level >= 10;
        if (passed && !this._isAdvancedMode) {
            const maxLevel = (typeof window.getTherapyMaxLevel === 'function')
                ? window.getTherapyMaxLevel('M6')
                : (parseInt(localStorage.getItem('vision-therapy-m6-max-level') || '1', 10) || 1);
            if (this.level >= maxLevel && this.level < 10) {
                if (typeof window.setTherapyMaxLevel === 'function') {
                    window.setTherapyMaxLevel('M6', this.level + 1);
                } else {
                    localStorage.setItem('vision-therapy-m6-max-level', String(this.level + 1));
                }
                unlockedNew = true;
            }
        }

        // Lưu hệ thống Therapy theo chuẩn Engine (Firebase & LocalStorage)
        this.sessionMetrics.customData = {
            maxDiopter: maxDiopters,
            targetDiopter: this.targetDiopter,
            finalDivergenceDiopter: parseFloat(maxDiopters.toFixed(2)),
            status: reason,
            mode: this._isAdvancedMode ? 'advanced' : 'level',
            level: this._isAdvancedMode ? null : this.level,
            passed: passed,
            nextLevelUnlocked: unlockedNew,
            graduated: graduated,
            earlyBreaks: this.earlyBreaks,
            rampSpeedDiopterPerSec: M6_RAMP_SPEED,
            holdPassSeconds: M6_HOLD_PASS_MS / 1000
        };
        this.sessionMetrics.level = this._isAdvancedMode ? null : this.level;
        this.sessionMetrics.score = maxDiopters;
        this.sessionMetrics.durationSeconds = this.totalPlayTime;
        this.score = maxDiopters;
        this.finishSession();
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { DivergenceTherapyGame };

export default DivergenceTherapyGame;