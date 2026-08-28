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
        this.maxHits = 20;
        this.latencies = [];
        this.currentTarget = null;
        this.spawnTime = 0;

        // --- Kích thước mục tiêu vật lý: 5mm trên màn hình ---
        const pixelsPerMm = this.calibration?.pixelsPerMm || 3.78;
        const cssScaleFactor = this.canvas ? this.canvas.width / this.canvas.clientWidth : 1;
        this.targetRadius = 5 * pixelsPerMm * cssScaleFactor;

        // --- Padding an toàn để mục tiêu nằm gọn trong viền canvas ---
        this.padding = this.targetRadius + 20;
    }

    /**
     * Bắt đầu game
     * Gọi super.start(), thêm event listener click, spawn target đầu tiên
     */
    start() {
        super.start();
        this.canvas.style.cursor = 'crosshair';

        // Thêm event listener click trên canvas
        this._boundClickHandler = this._handleClick.bind(this);
        this.canvas.addEventListener('click', this._boundClickHandler);

        // Spawn mục tiêu đầu tiên
        this._spawnTarget();
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
     * Spawn mục tiêu mới tại vị trí ngẫu nhiên
     * - Tọa độ X, Y nằm gọn trong viền canvas (cách lề padding)
     * - Màu ngẫu nhiên: 50% left (mắt trái), 50% right (mắt phải)
     * - Ghi nhận thời gian spawn
     * @private
     */
    _spawnTarget() {
        const maxX = this.canvas.width - this.padding;
        const maxY = this.canvas.height - this.padding;

        this.currentTarget = {
            x: this.padding + Math.random() * (maxX - this.padding),
            y: this.padding + Math.random() * (maxY - this.padding),
            color: Math.random() < 0.5 ? this.colors.left : this.colors.right
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

        ctx.fillText(`Mục tiêu: ${this.hits}/${this.maxHits} | Độ trễ trung bình: ${avgLatency} ms`, 20, 20);

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

        // 3. Nhận diện thiết bị & Ngưỡng lâm sàng theo định luật Fitts
        const isTouchDevice = navigator.maxTouchPoints > 0;
        const deviceLabel = isTouchDevice ? 'Cảm ứng' : 'Chuột';
        const threshold = isTouchDevice ? 500 : 900;

        // 4. Ghi nhận vào customData gửi cho EMR Core
        this.sessionMetrics.customData = {
            totalHits: this.hits,
            avgLatencyMs: avgLatency,
            deviceType: deviceLabel
        };
        this.finishSession();

        // 5. Đánh giá ĐẠT / CHƯA ĐẠT
        const isPassed = avgLatency > 0 && avgLatency <= threshold;
        const evalColor = isPassed ? '#4ade80' : '#f87171'; // Xanh : Đỏ
        const evalText = isPassed ? 'ĐẠT (Bình thường)' : 'CHƯA ĐẠT (Cần cải thiện)';

        // 6. Dừng game & Render Overlay
        this.stop();
        this.canvas.style.cursor = 'default';

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; inset: 0; z-index: 2147483647; background: #0f172a; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif;';

        overlay.innerHTML = `
            <div style="background: #1e293b; border-radius: 12px; padding: 30px; max-width: 600px; width: 90%; box-shadow: 0 4px 24px rgba(0,0,0,0.5);">
                <h2 style="text-align: center; color: #38bdf8; margin: 0 0 20px 0; font-size: 24px;">KẾT QUẢ VẬN NHÃNH NHANH (SACCADIC)</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="border: 1px solid #475569; border-radius: 8px; padding: 15px; text-align: center;">
                        <p style="color: #94a3b8; margin: 0 0 8px 0; font-size: 14px;">Tổng số mục tiêu</p>
                        <p style="font-size: 28px; color: #f87171; margin: 0; font-weight: bold;">${this.hits}/${this.maxHits}</p>
                    </div>
                    <div style="border: 1px solid #475569; border-radius: 8px; padding: 15px; text-align: center;">
                        <p style="color: #94a3b8; margin: 0 0 8px 0; font-size: 14px;">Độ trễ trung bình</p>
                        <p style="font-size: 28px; color: #f87171; margin: 0; font-weight: bold;">${avgLatency} ms</p>
                    </div>
                </div>
                <div style="background: rgba(100, 116, 139, 0.1); border: 1px solid #64748b; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
                    <p style="color: #94a3b8; margin: 0 0 5px 0; font-size: 13px;">Độ lệch chuẩn: <b>${stdDev} ms</b></p>
                    <p style="color: #94a3b8; margin: 0; font-size: 13px;">Mục tiêu lâm sàng (${deviceLabel}): <b>≤ ${threshold} ms</b></p>
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
                    document.exitFullscreen().catch(e => console.log(e));
                }
                overlay.remove();
                console.log('[Saccadic] Hoàn thành phác đồ điều trị.');
            };
        }
    }
}

// Xuất module cho ES Module import
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SaccadicTrackingGame };
}

export default SaccadicTrackingGame;
