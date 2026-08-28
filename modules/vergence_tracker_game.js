/**
 * Module 3: Vergence Tracker Game (Trắc nghiệm theo dõi vận nhãn ngang)
 * 
 * Trò chơi đo lường khả năng hội tụ (Base-Out/Crossed) và phân kỳ (Base-In/Uncrossed):
 * - Bar 1 (Left Eye): Thanh dọc màu mắt trái (Luc Lam/Cyan cho mắt nhược thị)
 * - Bar 2 (Right Eye): Thanh dọc màu mắt phải (Đỏ cho mắt lành)
 * - splitDistance tăng dần khiến 2 bar tách xa nhau theo hướng mode hiện tại
 * - Người dùng bấm SPACEBAR khi mất dung hợp → ghi nhận break point
 * - Thực hiện 4 lượt: 2 lượt Base-Out (Hội tụ) và 2 lượt Base-In (Phân kỳ)
 * - Áp dụng thủ thuật Central Check (Chữ E trắng) để chống ức chế luân phiên
 */

import BinocularGameEngine from './binocular_game_engine.js';

class VergenceTrackerGame extends BinocularGameEngine {
    /**
     * Khởi tạo trò chơi Vergence Tracker
     * Thiết lập trạng thái ban đầu: round=1, mode=Base-Out, splitDistance=0
     */
    constructor() {
        super();

        // --- Tên game cho EMR identification ---
        this.gameName = 'M3: Vận nhãn (Vergence Tracker)';

        // --- Trạng thái trò chơi ---
        this.round = 1;
        this.maxRounds = 4;
        this.mode = 'Base-Out'; // Bắt đầu bằng Hội tụ
        this.splitDistance = 0;
        this.speed = 0.15; // Tách 0.15px mỗi frame (Giảm tốc độ để mắt tái dung hợp)
        this.isPaused = true; // Trạng thái nghỉ ban đầu
        this.pauseFrames = 120; // 120 frames (2 giây ở 60fps) để bắt đầu game
        this.results = { BO: [], BI: [] }; // Mảng lưu kết quả

        // --- Cấu hình thực thể ---
        this.barWidth = 60; // Kích thước 60x150px
        this.barHeight = 150;

        // --- Sự kiện bàn phím: Lắng nghe Spacebar ---
        this.handleSpacebar = (e) => { if (e.code === 'Space') this._recordBreakPoint(); };
    }

    /**
     * Bắt đầu trò chơi
     * Gọi super.start(), ẩn chuột, lắng nghe sự kiện bàn phím
     */
    start() {
        super.start();
        this.canvas.style.cursor = 'none';
        window.addEventListener('keydown', this.handleSpacebar);
    }

    /**
     * Dừng trò chơi
     * Loại bỏ event listener, hiện lại chuột, gọi super.stop()
     */
    stop() {
        window.removeEventListener('keydown', this.handleSpacebar);
        this.canvas.style.cursor = 'default';
        super.stop();
    }

    /**
     * Ghi nhận điểm đứt gãy và xử lý chuyển vòng
     * - Lưu kết quả vào mảng results.BO hoặc results.BI
     * - Tăng round, đổi mode, reset splitDistance
     * - Nếu vượt quá maxRounds, gọi _endGame()
     */
    _recordBreakPoint() {
        // Chuyển đổi khoảng cách đứt gãy sang Lăng kính
        const breakPointDelta = this.pixelsToDiopter(this.splitDistance * 2);

        // Lưu kết quả theo mode hiện tại
        if (this.mode === 'Base-Out') {
            this.results.BO.push(breakPointDelta);
        } else {
            this.results.BI.push(breakPointDelta);
        }

        // Xử lý chuyển vòng
        this.round++;

        // Kiểm tra kết thúc game
        if (this.round > this.maxRounds) {
            this._endGame();
            return;
        }

        // Đổi mode
        this.mode = (this.mode === 'Base-Out') ? 'Base-In' : 'Base-Out';

        // Reset khoảng cách
        this.splitDistance = 0;

        // Kích hoạt trạng thái nghỉ để mắt tái dung hợp khi chuyển vòng
        this.isPaused = true;
        this.pauseFrames = 120;
    }

    /**
     * Cập nhật logic trò chơi
     * Tăng khoảng cách tách bar mỗi frame
     */
    update() {
        if (this.isPaused) {
            this.pauseFrames--;
            if (this.pauseFrames <= 0) {
                this.isPaused = false;
            }
            return; // Bỏ qua việc tăng khoảng cách
        }
        this.splitDistance += this.speed;
    }

    /**
     * Render đồ họa trò chơi
     * - Gọi super.render() ở dòng 1
     * - Vẽ Text HUD hiển thị thông tin vòng, chế độ, hướng dẫn
     * - Tính tọa độ 2 thanh dựa trên mode
     * - Vẽ 2 thanh với blend mode 'multiply'
     * - Vẽ Central Check (Chữ E trắng) ở tâm màn hình
     */
    render() {
        // A. Môi trường quang học an toàn (nền trắng + viền đen)
        super.render();

        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        // B. Vẽ Text HUD
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Vòng: ${this.round}/${this.maxRounds}`, 20, 20);

        const modeLabel = this.mode === 'Base-Out' ? 'Hội tụ (Base-Out)' : 'Phân kỳ (Base-In)';
        ctx.fillText(`Chế độ: ${modeLabel}`, 20, 50);

        // Tính Lăng kính hiện tại và hiển thị HUD
        const currentDiopters = this.pixelsToDiopter(this.splitDistance * 2);
        ctx.fillText('Nhu cầu vận nhãn: ' + currentDiopters.toFixed(1) + ' Δ', 15, 65);

        // Hiển thị thông báo trạng thái nghỉ (đang định thị)

        // Hiển thị profile phần cứng để giám sát sai số vật lý
        ctx.fillStyle = '#64748b'; // Màu xám nhạt
        ctx.font = '12px Arial, sans-serif';
        const pxMm = this.calibration?.pixelsPerMm ? this.calibration.pixelsPerMm.toFixed(2) : 'N/A';
        const dist = this.calibration?.viewingDistanceCm || 'N/A';
        ctx.fillText(`[Hardware: ${pxMm} px/mm | Khoảng cách: ${dist} cm]`, 15, 85);

        // Text hướng dẫn mờ ở góc phải
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.font = '16px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('Bấm SPACE khi khối màu tách đôi | ESC để thoát', this.canvas.width - 20, 20);

        // C. Tính tọa độ 2 thanh
        let leftBarX = cx;
        let rightBarX = cx;

        if (this.mode === 'Base-Out') {
            // Base-Out (Hội tụ): Lăng kính gốc hướng ra ngoài → Bệnh nhân phải CROSS để dung hợp
            // Mắt trái - Cyan - dịch TRÁI | Mắt phải - Đỏ - dịch PHẢI → Tách ra xa
            leftBarX = cx - this.splitDistance;
            rightBarX = cx + this.splitDistance;
        } else {
            // Base-In (Phân kỳ): Lăng kính đỉnh hướng ra ngoài → Bệnh nhân phải DIVERGE để dung hợp
            // Mắt trái - Cyan - dịch PHẢI | Mắt phải - Đỏ - dịch TRÁI → Tiến lại gần
            leftBarX = cx + this.splitDistance;
            rightBarX = cx - this.splitDistance;
        }

        // D. Vẽ 2 thanh với blend mode 'multiply'
        ctx.globalCompositeOperation = 'multiply';

        // Vẽ thanh mắt Nhược thị (Left Eye - Cyan)
        ctx.fillStyle = this.colors.left;
        ctx.fillRect(leftBarX - this.barWidth / 2, cy - this.barHeight / 2, this.barWidth, this.barHeight);

        // Vẽ thanh mắt Lành (Right Eye - Red)
        ctx.fillStyle = this.colors.right;
        ctx.fillRect(rightBarX - this.barWidth / 2, cy - this.barHeight / 2, this.barWidth, this.barHeight);

        // Đặt lại blend mode về mặc định
        ctx.globalCompositeOperation = 'source-over';

    }

    /**
     * Kết thúc game và hiển thị báo cáo lâm sàng (Bulletproof)
     * - Tính trung bình avgBO và avgBI từ this.results
     * - Đánh giá lâm sàng theo tiêu chuẩn 50cm (BO >= 100px, BI >= 50px)
     * - Tạo overlay đè lên mọi thứ với z-index tối đa
     */
    _endGame() {
        // A. Tính trung bình (mảng rỗng thì gán = 0)
        const avgBO = this.results.BO.length > 0
            ? this.results.BO.reduce((a, b) => a + b, 0) / this.results.BO.length
            : 0;
        const avgBI = this.results.BI.length > 0
            ? this.results.BI.reduce((a, b) => a + b, 0) / this.results.BI.length
            : 0;

        // --- Đóng gói sessionMetrics trước khi stop ---
        this.sessionMetrics.customData = { avgBaseOut: avgBO, avgBaseIn: avgBI };
        this.finishSession();

        // B. Đánh giá lâm sàng theo tiêu chuẩn Lăng kính mới
        const evalBO = avgBO >= 15
            ? '<span style="color:#4ade80">ĐẠT (Bình thường)</span>'
            : '<span style="color:#f87171">CHƯA ĐẠT (Suy giảm)</span>';
        const evalBI = avgBI >= 8
            ? '<span style="color:#4ade80">ĐẠT (Bình thường)</span>'
            : '<span style="color:#f87171">CHƯA ĐẠT (Suy giảm)</span>';

        // C. Thoát game - đảm bảo chuột đã hiện lại
        this.stop();
        this.canvas.style.cursor = 'default';

        // D. Tạo Overlay (Fix lỗi ẩn kết quả - cấp CSS cực mạnh)
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; inset: 0; z-index: 2147483647; background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif;';

        overlay.innerHTML = `
            <div style="background: #1e293b; border-radius: 12px; padding: 30px; max-width: 600px; width: 90%; box-shadow: 0 4px 24px rgba(0,0,0,0.5);">
                <h2 style="text-align: center; color: #38bdf8; margin: 0 0 20px 0; font-size: 24px;">BÁO CÁO KẾT QUẢ VẬN NHÃN</h2>

                <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid #38bdf8; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <p style="font-size: 16px; color: #94a3b8; margin: 0 0 8px 0;"><strong>Chi tiết từng lượt:</strong></p>
                    <p style="font-size: 15px; margin: 4px 0;">Base-Out (Hội tụ): [${this.results.BO.map(v => v.toFixed(1)).join(', ') || '—'}Δ]</p>
                    <p style="font-size: 15px; margin: 4px 0;">Base-In (Phân kỳ): [${this.results.BI.map(v => v.toFixed(1)).join(', ') || '—'}Δ]</p>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 8px; padding: 15px; text-align: center;">
                        <p style="font-size: 14px; color: #94a3b8; margin: 0 0 8px 0;">Biên độ Hội tụ (Base-Out)</p>
                        <p style="font-size: 28px; color: #10b981; margin: 0; font-weight: bold;">${avgBO.toFixed(1)}Δ</p>
                        <p style="font-size: 14px; margin: 4px 0 0 0;">${evalBO}</p>
                    </div>
                    <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; text-align: center;">
                        <p style="font-size: 14px; color: #94a3b8; margin: 0 0 8px 0;">Biên độ Phân kỳ (Base-In)</p>
                        <p style="font-size: 28px; color: #f59e0b; margin: 0; font-weight: bold;">${avgBI.toFixed(1)}Δ</p>
                        <p style="font-size: 14px; margin: 4px 0 0 0;">${evalBI}</p>
                    </div>
                </div>

                <div style="background: rgba(100, 116, 139, 0.1); border: 1px solid #64748b; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
                    <p style="font-size: 13px; color: #94a3b8; margin: 0; line-height: 1.5;">
                        <strong>Mục tiêu lâm sàng:</strong> Hội tụ (Base-Out) ≥ 15Δ | Phân kỳ (Base-In) ≥ 8Δ
                    </p>
                </div>

                <div style="text-align: center;">
                    <button id="btn-finish-m3" style="padding: 12px 30px; font-size: 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">HOÀN THÀNH PHÁC ĐỒ</button>
                </div>
            </div>
        `;

        // E. Bắt buộc gắn trực tiếp vào body để không bị SPA xóa
        document.body.appendChild(overlay);

        // F. Xử lý sự kiện nút Hoàn Thành
        const finishBtn = document.getElementById('btn-finish-m3');
        if (finishBtn) {
            finishBtn.onclick = () => {
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(e => console.log(e));
                }
                overlay.remove();
                if (this.workspace) {
                    this.workspace.innerHTML = '';
                }
                console.log('[Vergence] Hoàn thành phác đồ điều trị.');
            };
        }
    }
}

// Xuất module cho ES Module import
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VergenceTrackerGame };
}

export default VergenceTrackerGame;
