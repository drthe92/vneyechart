/**
 * Module 4: Saccadic Tracking Game (Trắc nghiệm vận nhãn nhanh)
 *
 * Trò chơi đo lường thời gian phản xạ (Saccadic Latency) và độ chính xác
 * của vận nhãn đồng bộ qua môi trường phân thị (Dichoptic).
 *
 * Cơ chế:
 * - Mục tiêu xuất hiện ngẫu nhiên tại vị trí X, Y trên canvas
 * - Màu mục tiêu 50/50: mắt trái (left) hoặc mắt phải (right)
 * - Người dùng click vào mục tiêu càng nhanh càng tốt
 * - Ghi nhận latency cho mỗi lần hit và tính trung bình sau maxHits lần
 * - Hiển thị overlay kết quả: Xanh nếu avgLatency <= 400ms, Đỏ nếu > 400ms
 */

import BinocularGameEngine from './binocular_game_engine.js';

// ============================================================
// BẢNG ĐỘ KHÓ 10 MỨC (M4) — nguồn chân lý cấu hình độ khó
// [A4] sizeDeg : Đường kính mục tiêu theo GÓC THỊ GIÁC tuyệt đối (°)
//   — quy đổi sang px thực tế bằng this.arcsecToPixels() của Engine
//   theo hiệu chuẩn màn hình (kích thước vật lý không đổi giữa các máy).
// distance : 'short' = mọc gần chấm cũ (quanh trung tâm)
//            'medium' = bán kính mở rộng nửa màn hình
//            'full'   = ngẫu nhiên toàn màn hình (nhảy chéo góc)
//            'cross'  = bắt buộc vắt chéo từ mép này sang mép kia
// timeLimitMs: Thời gian chờ tối đa mỗi mục tiêu (hết giờ = 1 Miss).
//              Infinity = chờ vô hạn (Chặng 1 — chưa tạo áp lực thời gian)
// ============================================================
const M4_LEVELS = [
    { level: 1,  sizeDeg: 4.5, distance: 'short',  timeLimitMs: Infinity },
    { level: 2,  sizeDeg: 3.6, distance: 'medium', timeLimitMs: Infinity },
    { level: 3,  sizeDeg: 2.7, distance: 'full',   timeLimitMs: Infinity },
    { level: 4,  sizeDeg: 2.7, distance: 'full',   timeLimitMs: 3000 },
    { level: 5,  sizeDeg: 2.7, distance: 'full',   timeLimitMs: 2000 },
    { level: 6,  sizeDeg: 1.8, distance: 'full',   timeLimitMs: 2000 },
    { level: 7,  sizeDeg: 1.8, distance: 'cross',  timeLimitMs: 1500 },
    { level: 8,  sizeDeg: 1.2, distance: 'cross',  timeLimitMs: 1200 },
    { level: 9,  sizeDeg: 0.9, distance: 'full',   timeLimitMs: 1000 },
    { level: 10, sizeDeg: 0.9, distance: 'cross',  timeLimitMs: 800 }
];

const M4_DISTANCE_LABELS = {
    short: 'Gần (quanh trung tâm)',
    medium: 'Nửa màn hình',
    full: 'Toàn màn hình',
    cross: 'Vắt chéo (mép đối diện)'
};

class SaccadicTrackingGame extends BinocularGameEngine {
    /**
     * Khởi tạo game Saccadic Tracking
     * Thiết lập trạng thái ban đầu: hits, maxHits, latencies, currentTarget
     */
    constructor() {
        super();

        // --- Tên game cho EMR identification ---
        this.gameName = 'M4: Vận nhãn nhanh (Saccadic)';

        // --- Trạng thái trò chơi ---
        this.hits = 0;
        this.misses = 0;              // Số lần trượt (mục tiêu hết thời gian chờ)
        this.maxHits = 20;
        this.latencies = [];
        this.currentTarget = null;
        this.spawnTime = 0;
        this.level = 1;               // Cấp độ hiện tại (1..10) — gamify
        this.targetLifetimeMs = Infinity; // Thời gian chờ mỗi mục tiêu (ms); Infinity = vô hạn — set theo bảng M4_LEVELS

        // --- Kích thước mục tiêu vật lý: 5mm trên màn hình (trước khi áp Level) ---
        // [A4] Dùng hệ số hiệu chuẩn của Engine (pixelsPerMm) + Scale Lock,
        // không còn hardcode 3.78.
        const pixelsPerMm = this.calibration.pixelsPerMm;
        const cssScaleFactor = this.canvas ? this.canvas.width / this.canvas.clientWidth : 1;
        this.targetRadius = 5 * pixelsPerMm * cssScaleFactor;

        // --- Padding an toàn để mục tiêu nằm gọn trong viền canvas ---
        this.padding = this.targetRadius + 20;
    }

    /**
     * Ánh xạ Level (1..10) → Cấu hình độ khó theo bảng M4_LEVELS.
     * Cấu hình gồm: kích thước (góc thị giác → px thực tế), biên độ xuất hiện,
     * thời gian chờ.
     * @param {number|string} level - Cấp độ người dùng chọn (mặc định 1)
     * @returns {number} Level hợp lệ (clamp 1..10)
     */
    _applyLevel(level) {
        const lvl = Math.max(1, Math.min(10, parseInt(level, 10) || 1));
        const cfg = M4_LEVELS.find(l => l.level === lvl) || M4_LEVELS[0];
        this.level = lvl;
        // Số lượng mục tiêu: L1 = 20 → L10 = 60 (độ dài phiên)
        this.maxHits = Math.min(60, Math.max(20, Math.round(20 + (lvl - 1) * 4.44)));
        // [A4] Kích thước mục tiêu: đường kính theo góc thị giác (°) →
        // px thực tế qua arcsecToPixels (bán kính = đường kính / 2)
        const diameterPx = Math.max(20, Math.round(this.arcsecToPixels(cfg.sizeDeg * 3600)));
        this.targetRadius = diameterPx / 2;
        this.distanceMode = cfg.distance;
        this.targetLifetimeMs = cfg.timeLimitMs; // Infinity = chờ vô hạn (Chặng 1)
        // Padding an toàn để mục tiêu nằm gọn trong viền canvas
        this.padding = this.targetRadius + 20;
        // Reset tham chiếu mép trước đó (biên độ 'cross' nhảy sang mép đối diện)
        this._prevSpawnSide = null;
        return lvl;
    }

    /**
     * TIÊU CHÍ QUA MÀN ĐỘNG (DYNAMIC UNLOCK CRITERIA)
     * Siết chặt dần theo chặng phục hồi thần kinh — khen thưởng đúng giai đoạn:
     * - Chặng 1 (L1-3): Accuracy > 90%, KHÔNG giới hạn thời gian phản xạ (xây tự tin)
     * - Chặng 2 (L4-6): Accuracy > 85% VÀ Avg RT ≤ 1500ms (bắt đầu tăng tốc)
     * - Chặng 3 (L7-9): Accuracy > 85% VÀ Avg RT ≤ 1000ms (chuẩn lâm sàng)
     * - Chặng 4 (L10 - Tốt nghiệp): Accuracy > 90% VÀ Avg RT ≤ 600ms (cảm ứng) / 800ms (chuột)
     * @param {number} level - Cấp độ hiện tại (1..10)
     * @param {boolean} isTouchDevice - Thiết bị cảm ứng?
     * @returns {{accuracy: number, rtMs: number|null, label: string}} Tiêu chí qua màn
     */
    _getPassCondition(level, isTouchDevice) {
        const lvl = Math.max(1, Math.min(10, parseInt(level, 10) || 1));
        if (lvl <= 3) return { accuracy: 90, rtMs: null, label: 'Chính xác > 90% (không giới hạn thời gian)' };
        if (lvl <= 6) return { accuracy: 85, rtMs: 1500, label: 'Chính xác > 85% và phản xạ ≤ 1500ms' };
        if (lvl <= 9) return { accuracy: 85, rtMs: 1000, label: 'Chính xác > 85% và phản xạ ≤ 1000ms' };
        const rt = isTouchDevice ? 600 : 800;
        return { accuracy: 90, rtMs: rt, label: `Chính xác > 90% và phản xạ ≤ ${rt}ms (TỐT NGHIỆP)` };
    }

    /**
     * Đánh giá đạt/không đạt theo tiêu chí động
     * @param {{accuracy: number, rtMs: number|null}} criteria - Tiêu chí của Level
     * @param {number} accuracy - Tỷ lệ trúng (%)
     * @param {number} avgRt - Độ trễ trung bình (ms)
     * @returns {boolean}
     */
    _isPassByCriteria(criteria, accuracy, avgRt) {
        if (!(accuracy > criteria.accuracy)) return false;
        return criteria.rtMs === null || (avgRt > 0 && avgRt <= criteria.rtMs);
    }

    /**
     * Bắt đầu game
     * Gọi super.start(), thêm event listener click, spawn target đầu tiên
     */
    start(config = {}) {
        // Áp dụng Level đã chọn từ Lobby trước khi khởi động
        this.level = this._applyLevel(config && config.level);
        super.start();
        this.canvas.style.cursor = 'crosshair';

        // Thêm event listener click trên canvas
        this._boundClickHandler = this._handleClick.bind(this);
        this.canvas.addEventListener('click', this._boundClickHandler);

        // Reset bộ đếm trượt cho phiên mới
        this.misses = 0;

        // Spawn mục tiêu đầu tiên
        this._spawnTarget();
    }

    /**
     * Cập nhật mỗi frame: mục tiêu hết thời gian chờ = TRƯỢT → sinh mục tiêu mới.
     * (Engine gọi update() mỗi frame — base class để trống)
     */
    update() {
        if (!this.currentTarget) return;
        // Chỉ tính hết giờ khi mục tiêu có giới hạn thời gian (Chặng 2+)
        const expiresAt = this.currentTarget.expiresAt;
        if (Number.isFinite(expiresAt) && performance.now() >= expiresAt) {
            this.misses++;
            if (this.hits >= this.maxHits) {
                this._endGame();
            } else {
                this._spawnTarget();
            }
        }
    }

    /**
     * Dừng game
     * Loại bỏ event listener click, gọi super.stop()
     */
    stop() {
        if (this.canvas && this._boundClickHandler) {
            this.canvas.removeEventListener('click', this._boundClickHandler);
        }
        this.canvas.style.cursor = 'default';
        super.stop();
    }

    /**
     * Spawn mục tiêu mới theo biên độ (distance mode) của Level:
     * - 'short' : mọc gần chấm cũ, quanh khu vực trung tâm
     * - 'medium': bán kính mở rộng nửa màn hình tính từ tâm
     * - 'full'  : ngẫu nhiên toàn màn hình (các cú nhảy chéo góc)
     * - 'cross' : bắt buộc vắt chéo — nhảy sang mép đối diện (85%)
     * Màu ngẫu nhiên: 50% left (mắt trái), 50% right (mắt phải)
     * @private
     */
    _spawnTarget() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const r = this.targetRadius;
        const p = this.padding;
        const mode = this.distanceMode || 'full';
        const prev = this.currentTarget;
        let x, y;

        if (mode === 'short') {
            // Mọc gần chấm cũ, quanh khu vực trung tâm (Lần đầu: quanh tâm)
            const cx = prev ? prev.x : w / 2;
            const cy = prev ? prev.y : h / 2;
            const maxDist = Math.min(w, h) * 0.18;
            const ang = Math.random() * Math.PI * 2;
            const dist = Math.random() * maxDist;
            x = Math.max(r + p, Math.min(w - r - p, cx + Math.cos(ang) * dist));
            y = Math.max(r + p, Math.min(h - r - p, cy + Math.sin(ang) * dist));
        } else if (mode === 'medium') {
            // Bán kính mở rộng nửa màn hình tính từ tâm
            const cx = w / 2;
            const cy = h / 2;
            const maxDist = Math.min(w, h) * 0.5;
            const ang = Math.random() * Math.PI * 2;
            const dist = Math.random() * maxDist;
            x = Math.max(r + p, Math.min(w - r - p, cx + Math.cos(ang) * dist));
            y = Math.max(r + p, Math.min(h - r - p, cy + Math.sin(ang) * dist));
        } else if (mode === 'cross') {
            // Vắt chéo: ưu tiên nhảy sang mép đối diện chấm trước đó
            const sides = ['left', 'right', 'top', 'bottom'];
            const opp = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
            let side;
            if (this._prevSpawnSide) {
                side = Math.random() < 0.85
                    ? opp[this._prevSpawnSide]
                    : sides[Math.floor(Math.random() * 4)];
            } else {
                side = sides[Math.floor(Math.random() * 4)];
            }
            this._prevSpawnSide = side;
            const band = Math.min(w, h) * 0.2; // dải 20% sát mép
            if (side === 'left') {
                x = r + p + Math.random() * band;
                y = r + p + Math.random() * (h - 2 * (r + p));
            } else if (side === 'right') {
                x = w - r - p - Math.random() * band;
                y = r + p + Math.random() * (h - 2 * (r + p));
            } else if (side === 'top') {
                y = r + p + Math.random() * band;
                x = r + p + Math.random() * (w - 2 * (r + p));
            } else {
                y = h - r - p - Math.random() * band;
                x = r + p + Math.random() * (w - 2 * (r + p));
            }
        } else {
            // 'full': ngẫu nhiên toàn màn hình
            x = r + p + Math.random() * (w - 2 * (r + p));
            y = r + p + Math.random() * (h - 2 * (r + p));
        }

        this.currentTarget = {
            x: x,
            y: y,
            color: Math.random() < 0.5 ? this.colors.left : this.colors.right,
            expiresAt: Number.isFinite(this.targetLifetimeMs)
                ? performance.now() + this.targetLifetimeMs  // Hết giờ = trượt
                : Infinity                                    // Chờ vô hạn (Chặng 1)
        };

        this.spawnTime = performance.now();
    }

    /**
     * Xử lý sự kiện click lên canvas
     * - Khử tỷ lệ scale CSS bằng cách nhân canvas.width / canvas.clientWidth
     * - Tính khoảng cách từ click tới currentTarget
     * - Nếu trúng: tính latency, push vào mảng, tăng hits
     * - Nếu đạt maxHits: gọi _endGame(), ngược lại spawn target mới
     * @param {MouseEvent} e
     * @private
     */
    _handleClick(e) {
        if (!this.currentTarget) return;

        // Khử tỷ lệ scale CSS
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / this.canvas.clientWidth;
        const scaleY = this.canvas.height / this.canvas.clientHeight;

        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // Tính khoảng cách từ click tới tâm mục tiêu
        const dx = clickX - this.currentTarget.x;
        const dy = clickY - this.currentTarget.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= this.targetRadius) {
            // HIT: Tính latency
            const latency = performance.now() - this.spawnTime;
            this.latencies.push(latency);
            this.hits++;

            // Kiểm tra đạt maxHits
            if (this.hits >= this.maxHits) {
                this._endGame();
            } else {
                this._spawnTarget();
            }
        }
    }

    /**
     * Render đồ họa game
     * - Gọi super.render() ở dòng 1
     * - Vẽ mục tiêu bằng arc() với màu tương ứng
     * - Vẽ dấu thập (+) màu trắng nhỏ ở tâm để kích thích định thị hoàng điểm
     * - Vẽ HUD: "Mục tiêu: hits/maxHits | Độ trễ trung bình: [avg] ms"
     * - Hiển thị profile phần cứng
     */
    render() {
        // A. Môi trường quang học an toàn (nền trắng + viền đen)
        super.render();

        const ctx = this.ctx;

        // B. Vẽ mục tiêu nếu có
        if (this.currentTarget) {
            const t = this.currentTarget;

            // Vẽ vòng tròn mục tiêu
            ctx.beginPath();
            ctx.arc(t.x, t.y, this.targetRadius, 0, Math.PI * 2);
            ctx.fillStyle = t.color;
            ctx.fill();

            // Vẽ dấu thập (+) màu trắng ở tâm
            const crossSize = this.targetRadius * 0.4;
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(t.x - crossSize, t.y);
            ctx.lineTo(t.x + crossSize, t.y);
            ctx.moveTo(t.x, t.y - crossSize);
            ctx.lineTo(t.x, t.y + crossSize);
            ctx.stroke();
        }

        // C. Vẽ HUD
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const avgLatency = this.latencies.length > 0
            ? Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length)
            : 0;

        const totalTargets = this.hits + this.misses;
        const accNow = totalTargets > 0 ? Math.round((this.hits / totalTargets) * 100) : 100;

        ctx.fillText(`Mục tiêu: ${this.hits}/${this.maxHits} | Level ${this.level} | Chính xác: ${accNow}% | Độ trễ: ${avgLatency} ms`, 20, 20);

        // Thanh đếm ngược thời gian chờ của mục tiêu hiện tại (chỉ khi có giới hạn thời gian)
        if (this.currentTarget && Number.isFinite(this.currentTarget.expiresAt)) {
            const remainMs = Math.max(0, this.currentTarget.expiresAt - performance.now());
            const remainS = (remainMs / 1000).toFixed(1);
            const pct = Math.max(0, Math.min(1, remainMs / this.targetLifetimeMs));
            ctx.fillStyle = pct < 0.3 ? '#ef4444' : '#64748b';
            ctx.fillRect(20, 72, 160 * pct, 6);
            ctx.font = '13px Arial, sans-serif';
            ctx.fillStyle = '#64748b';
            ctx.fillText(`Hết giờ sau: ${remainS}s`, 20, 84);
        }

        // Hiển thị profile phần cứng
        ctx.fillStyle = '#64748b';
        ctx.font = '12px Arial, sans-serif';
        const pxMm = this.calibration?.pixelsPerMm ? this.calibration.pixelsPerMm.toFixed(2) : 'N/A';
        const dist = this.calibration?.viewingDistanceCm || 'N/A';
        ctx.fillText(`[Hardware: ${pxMm} px/mm | Khoảng cách: ${dist} cm]`, 15, 50);

        // Text hướng dẫn mờ ở góc phải
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.font = '16px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('Click vào mục tiêu càng nhanh càng tốt | ESC để thoát', this.canvas.width - 20, 20);
    }

    /**
     * Kết thúc game và hiển thị kết quả lâm sàng
     * - Tính avgLatency
     * - Lưu customData: { totalHits, avgLatencyMs }
     * - Overlay: Xanh nếu <= 400ms, Đỏ nếu > 400ms
     * - Nút "Hoàn thành"
     * @private
     */
    _endGame() {
        // 1. Tính độ trễ trung bình (avgLatency)
        const avgLatency = this.latencies.length > 0
            ? Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length)
            : 0;

        // 2. Tính độ lệch chuẩn an toàn (Fix lỗi Infinity - dùng sample variance n-1)
        let stdDev = 0;
        if (this.latencies.length > 1) {
            const variance = this.latencies.reduce((sq, n) => sq + Math.pow(n - avgLatency, 2), 0) / (this.latencies.length - 1);
            stdDev = Math.round(Math.sqrt(variance));
        }

        // 3. Nhận diện thiết bị
        const isTouchDevice = navigator.maxTouchPoints > 0;
        const deviceLabel = isTouchDevice ? 'Cảm ứng' : 'Chuột';

        // 4. Tỷ lệ chính xác: hits / tổng mục tiêu đã xuất hiện (gồm cả trượt do hết giờ)
        const totalTargets = this.hits + this.misses;
        const accuracy = totalTargets > 0 ? (this.hits / totalTargets) * 100 : 0;

        // 5. TIÊU CHÍ QUA MÀN ĐỘNG (Dynamic Pass Condition) theo Chặng
        const criteria = this._getPassCondition(this.level, isTouchDevice);
        const isPassed = this._isPassByCriteria(criteria, accuracy, avgLatency);

        // 6. Mở khóa Level kế tiếp nếu đạt tiêu chí (Level 10 qua màn = TỐT NGHIỆP, không có Level 11)
        const LEVEL_KEY = 'vision-therapy-m4-max-level';
        const maxLevel = parseInt(localStorage.getItem(LEVEL_KEY) || '1', 10) || 1;
        let unlockedNew = false;
        const graduated = isPassed && this.level >= 10;
        if (isPassed && this.level >= maxLevel && this.level < 10) {
            localStorage.setItem(LEVEL_KEY, String(this.level + 1));
            unlockedNew = true;
        }

        // 7. Ghi nhận vào customData gửi cho EMR Core
        this.sessionMetrics.customData = {
            level: this.level,
            completionRate: accuracy,
            accuracy: accuracy,
            totalHits: this.hits,
            totalMisses: this.misses,
            avgLatencyMs: avgLatency,
            deviceType: deviceLabel,
            passCriteria: criteria.label,
            nextLevelUnlocked: unlockedNew,
            graduated: graduated
        };
        this.sessionMetrics.hits = this.hits;
        this.sessionMetrics.misses = this.misses;
        this.finishSession();

        // 8. Đánh giá ĐẠT / CHƯA ĐẠT
        const evalColor = isPassed ? '#4ade80' : '#f87171'; // Xanh : Đỏ
        let evalText = 'CHƯA ĐẠT — Chưa đạt tiêu chí qua màn của Chặng này';
        if (graduated) {
            evalText = '🏆 TỐT NGHIỆP — Hệ thần kinh vận nhãn đạt chuẩn thể thao thị giác!';
        } else if (isPassed && unlockedNew) {
            evalText = `ĐẠT — Đã mở khóa Level ${this.level + 1}!`;
        } else if (isPassed) {
            evalText = 'ĐẠT (Đã vượt tiêu chí qua màn)';
        }

        // 9. Dừng game & Render Overlay
        this.stop();
        this.canvas.style.cursor = 'default';

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; inset: 0; z-index: 2147483647; background: #0f172a; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif;';

        overlay.innerHTML = `
            <div style="background: #1e293b; border-radius: 12px; padding: 30px; max-width: 640px; width: 90%; box-shadow: 0 4px 24px rgba(0,0,0,0.5);">
                <h2 style="text-align: center; color: #38bdf8; margin: 0 0 20px 0; font-size: 24px;">KẾT QUẢ VẬN NHÃN NHANH (SACCADIC)</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="border: 1px solid #475569; border-radius: 8px; padding: 15px; text-align: center;">
                        <p style="color: #94a3b8; margin: 0 0 8px 0; font-size: 14px;">Chính xác</p>
                        <p style="font-size: 24px; color: #22d3ee; margin: 0; font-weight: bold;">${accuracy.toFixed(1)}%</p>
                        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 12px;">${this.hits} trúng / ${this.misses} trượt</p>
                    </div>
                    <div style="border: 1px solid #475569; border-radius: 8px; padding: 15px; text-align: center;">
                        <p style="color: #94a3b8; margin: 0 0 8px 0; font-size: 14px;">Độ trễ trung bình</p>
                        <p style="font-size: 24px; color: #f87171; margin: 0; font-weight: bold;">${avgLatency} ms</p>
                        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 12px;">SD: ${stdDev} ms</p>
                    </div>
                    <div style="border: 1px solid #475569; border-radius: 8px; padding: 15px; text-align: center;">
                        <p style="color: #94a3b8; margin: 0 0 8px 0; font-size: 14px;">Cấp độ</p>
                        <p style="font-size: 24px; color: #fbbf24; margin: 0; font-weight: bold;">Level ${this.level}</p>
                        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 12px;">${this.maxHits} mục tiêu</p>
                    </div>
                </div>
                <div style="background: rgba(100, 116, 139, 0.1); border: 1px solid #64748b; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
                    <p style="color: #94a3b8; margin: 0 0 5px 0; font-size: 13px;">Tiêu chí qua màn (Chặng ${this.level <= 3 ? 1 : this.level <= 6 ? 2 : this.level <= 9 ? 3 : 4}): <b style="color: #e2e8f0;">${criteria.label}</b></p>
                    <p style="color: #94a3b8; margin: 0 0 5px 0; font-size: 13px;">Cấu hình Level: Kích thước <b style="color: #e2e8f0;">${this.targetRadius * 2}px</b> | Biên độ <b style="color: #e2e8f0;">${M4_DISTANCE_LABELS[this.distanceMode] || this.distanceMode}</b> | Thời gian chờ <b style="color: #e2e8f0;">${Number.isFinite(this.targetLifetimeMs) ? (this.targetLifetimeMs / 1000) + 's' : 'Vô hạn'}</b></p>
                    <p style="color: #94a3b8; margin: 0; font-size: 13px;">Thiết bị: <b>${deviceLabel}</b> | Tổng mục tiêu phiên: <b>${this.maxHits}</b></p>
                </div>
                <div style="border: 1px solid ${evalColor}; border-radius: 8px; padding: 15px; text-align: center; margin-bottom: 20px;">
                    <p style="font-size: 18px; color: ${evalColor}; margin: 0; font-weight: bold;">${evalText}</p>
                </div>
                <div style="text-align: center;">
                    <button id="btn-finish-m4" style="padding: 12px 30px; font-size: 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">HOÀN THÀNH PHÁC ĐỒ</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const finishBtn = document.getElementById('btn-finish-m4');
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
    module.exports = { SaccadicTrackingGame };
}

export default SaccadicTrackingGame;
