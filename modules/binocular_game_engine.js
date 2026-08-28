/**
 * BinocularGameEngine — Base class cho tất cả Game module phân thị (Dichoptic)
 * 
 * Cung cấp:
 * - Kiểm tra Anaglyph colors (window.__anaglyphColors)
 * - Canvas setup với kích thước workspace-therapeutic
 * - Render loop (requestAnimationFrame)
 * - super.render(): nền trắng + viền đen peripheral lock
 * - SPA event listener để cleanup khi chuyển workspace
 */

class BinocularGameEngine {
    /**
     * Khởi tạo Engine
     * Kiểm tra anaglyph colors, tạo canvas, bắt đầu render loop
     */
    constructor() {
        // --- Tên game cho EMR identification ---
        this.gameName = 'Unknown Game';

        // --- Chỉ số đo lường phiên trị liệu ---
        this.sessionMetrics = { startTime: null, score: 0, level: 1, hits: 0, misses: 0, customData: {} };

        // --- HỆ QUY CHIẾU LĂNG KÍNH Y KHOA (Prism Diopter - Δ) ---
        // Đọc dữ liệu hiệu chuẩn từ localStorage (khớp với credit_card_calibration.js & calibration.js)
        const calibration = this._loadCalibrationFromStorage();

        // Bẫy lỗi: Bắt buộc phải có dữ liệu hiệu chuẩn màn hình và khoảng cách khám.
        // Nếu thiếu, dùng giá trị lâm sàng mặc định (96 DPI ≈ 3.78 px/mm, cách xem 0.5m)
        // để game vẫn chạy được trong môi trường dev/test, kèm cảnh báo rõ ràng.
        if (!calibration.pixelsPerMm || !calibration.viewingDistanceCm) {
            console.warn(
                "[CẢNH BÁO Y KHOA]: Thiếu hiệu chuẩn phần cứng (Pixel/mm hoặc Khoảng cách khám). " +
                "Đang dùng giá trị mặc định (96 DPI, 0.5m) — kết quả đo có thể không chính xác. " +
                "Hãy chạy hiệu chuẩn màn hình trước khi dùng lâm sàng."
            );
            if (!calibration.pixelsPerMm) calibration.pixelsPerMm = 96 / 25.4; // ≈ 3.7795 px/mm
            if (!calibration.viewingDistanceCm) calibration.viewingDistanceCm = 50; // 0.5m = 50cm
        }
        // Gán đối tượng hiệu chuẩn toàn cục vào instance
        this.calibration = calibration;

        // Trạng thái Vergence Demand mặc định (không lăng kính, không lệch pixel)
        this.vergenceDemand = { delta: 0, direction: 'BO', pixelOffset: 0 };

        // --- Rào cản y khoa: Bắt buộc hiệu chuẩn Anaglyph colors ---
        if (typeof window !== 'undefined' && window.__anaglyphColors) {
            this.colors = {
                left: window.__anaglyphColors.red || '#FF0000',
                right: window.__anaglyphColors.cyan || '#00FFFF',
                lock: '#000000'
            };
        } else {
            // Fallback màu mặc định nếu chưa hiệu chuẩn
            this.colors = {
                left: '#FF0000',
                right: '#00FFFF',
                lock: '#000000'
            };
        }

        // --- Tạo canvas động trong workspace-therapeutic ---
        this.workspaceContainer = document.getElementById('workspace-therapeutic');
        if (!this.workspaceContainer) {
            console.error('[BinocularGameEngine] #workspace-therapeutic not found in DOM');
            return;
        }

        this.canvas = document.createElement('canvas');

        // --- Tiêm CSS nội tuyến ép buộc hiển thị ---
        this.workspaceContainer.style.position = 'relative';

        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '999';

        this.workspaceContainer.appendChild(this.canvas);

        // --- Cập nhật độ phân giải nội tại (Resolution) ---
        this.canvas.width = this.workspaceContainer.clientWidth || window.innerWidth;
        this.canvas.height = this.workspaceContainer.clientHeight || window.innerHeight;

        this.ctx = this.canvas.getContext('2d');

        // --- Resize handler để đồng bộ canvas khi đổi kích thước màn hình/Fullscreen ---
        this.resizeHandler = () => {
            if (this.canvas && this.workspaceContainer) {
                this.canvas.width = this.workspaceContainer.clientWidth;
                this.canvas.height = this.workspaceContainer.clientHeight;
                this.ctx = this.canvas.getContext('2d');
            }
        };
        window.addEventListener('resize', this.resizeHandler);

        // --- Render loop ---
        this._running = false;
        this._boundUpdate = this._updateLoop.bind(this);
    }

    /**
     * Đọc dữ liệu hiệu chuẩn từ localStorage
     * @returns {{ pixelsPerMm: number, viewingDistanceCm: number }}
     * @private
     */
    _loadCalibrationFromStorage() {
        const result = { pixelsPerMm: 0, viewingDistanceCm: 0 };
        const ccPxPerMm = localStorage.getItem('vision-therapy-cc-pxpermm');
        if (ccPxPerMm && parseFloat(ccPxPerMm) > 0) result.pixelsPerMm = parseFloat(ccPxPerMm);
        const distanceM = localStorage.getItem('vision-therapy-calibrate-distance-m');
        if (distanceM && parseFloat(distanceM) > 0) result.viewingDistanceCm = parseFloat(distanceM) * 100;
        return result;
    }

    /**
     * [CÔNG THỨC Y VĂN] Chuyển đổi Prism Diopter (Δ) sang Pixel trên màn hình
     *
     * Công thức: 1Δ = 1cm lệch tuyến tính ở khoảng cách 1m (100cm).
     *
     * Suy ra tại khoảng cách viewingDistanceCm (cm):
     *   LinearShift (cm) = prismDiopter * (viewingDistanceCm / 100)
     *   LinearShift (mm) = prismDiopter * (viewingDistanceCm / 100) * 10
     *   PixelOffset      = LinearShift (mm) * pixelsPerMm
     *
     * Tóm gọn:
     *   pixels = prismDiopter * (viewingDistanceCm / 100) * 10 * pixelsPerMm
     *
     * @param {number} prismDiopter - Giá trị lăng kính cần chuyển (Delta - Δ)
     * @returns {number} Số pixel tương ứng trên màn hình
     */
    // 1. Chuyển Lăng kính thành Pixel nội tại (Dùng để set logic)
    diopterToPixels(prismDiopter) {
        if (!this.calibration || !this.calibration.pixelsPerMm) return 0;
        const scaleX = this.canvas ? (this.canvas.clientWidth / this.canvas.width) : 1;
        const targetPhysicalPx = prismDiopter * (this.calibration.viewingDistanceCm / 100) * 10 * this.calibration.pixelsPerMm;
        return targetPhysicalPx / scaleX;
    }

    /**
     * [NGƯỢC] Chuyển đổi Pixel trên màn hình sang Prism Diopter (Δ)
     *
     * Công thức ngược lại từ diopterToPixels:
     *   prismDiopter = pixels / ((viewingDistanceCm / 100) * 10 * pixelsPerMm)
     *
     * @param {number} pixels - Số pixel lệch trên màn hình
     * @returns {number} Giá trị Prism Diopter (Δ) tương ứng
     */
    // 2. Chuyển Pixel nội tại thành Lăng kính thực tế (Dùng để báo cáo kết quả M3)
    pixelsToDiopter(pixels) {
        if (!this.calibration || !this.calibration.pixelsPerMm) return 0;
        const scaleX = this.canvas ? (this.canvas.clientWidth / this.canvas.width) : 1;
        const physicalPixels = pixels * scaleX;
        return physicalPixels / ((this.calibration.viewingDistanceCm / 100) * 10 * this.calibration.pixelsPerMm);
    }

    /**
     * [CÔNG THỨC QUANG HỌC] Chuyển đổi Pixel sang Góc thị giác (Visual Angle - Độ)
     *
     * Công thức:
     *   physicalSizeMm = pixels / pixelsPerMm
     *   viewingDistanceMm = viewingDistanceCm * 10
     *   angleRadian = 2 * atan(physicalSizeMm / (2 * viewingDistanceMm))
     *   angleDegree = angleRadian * (180 / π)
     *
     * @param {number} pixels - Kích thước trên màn hình (px)
     * @returns {number} Góc thị giác tương ứng (Độ - °)
     */
    // 3. Chuyển Pixel nội tại thành Góc thị giác thực tế (Dùng để báo cáo kết quả M2)
    pixelsToVisualAngle(pixels) {
        if (!this.calibration || !this.calibration.pixelsPerMm || !this.calibration.viewingDistanceCm) return 0;
        const scaleX = this.canvas ? (this.canvas.clientWidth / this.canvas.width) : 1;
        const physicalSizeMm = (pixels * scaleX) / this.calibration.pixelsPerMm;
        const viewingDistanceMm = this.calibration.viewingDistanceCm * 10;
        const angleRadian = 2 * Math.atan(physicalSizeMm / (2 * viewingDistanceMm));
        return angleRadian * (180 / Math.PI);
    }

    /**
     * [CÔNG THỨC QUANG HỌC] Chuyển đổi Pixel sang Giây cung (Arcsec)
     *
     * Công thức:
     *   physicalSizeMm = pixels / pixelsPerMm
     *   viewingDistanceMm = viewingDistanceCm * 10
     *   angleArcsec = (physicalSizeMm / viewingDistanceMm) * (180 / π) * 3600
     *
     * @param {number} pixels - Kích thước trên màn hình (px)
     * @returns {number} Góc thị giác tương ứng (Giây cung - arcsec)
     */
    pixelsToArcsec(pixels) {
        if (!this.calibration || !this.calibration.pixelsPerMm || !this.calibration.viewingDistanceCm) return 0;
        const scaleX = this.canvas ? (this.canvas.clientWidth / this.canvas.width) : 1;
        const physicalSizeMm = (pixels * scaleX) / this.calibration.pixelsPerMm;
        const viewingDistanceMm = this.calibration.viewingDistanceCm * 10;
        return (physicalSizeMm / viewingDistanceMm) * (180 / Math.PI) * 3600;
    }

    /**
     * [CÔNG THỨC QUANG HỌC] Chuyển đổi Giây cung (Arcsec) sang Pixel vật lý trên màn hình
     *
     * Công thức ngược lại từ pixelsToArcsec:
     *   physicalSizeMm = (arcsec * viewingDistanceMm) / ((180 / π) * 3600)
     *   pixels = physicalSizeMm * pixelsPerMm
     *
     * @param {number} arcsec - Giá trị giây cung (arcsec)
     * @returns {number} Số pixel tương ứng trên màn hình
     */
    arcsecToPixels(arcsec) {
        if (!this.calibration || !this.calibration.pixelsPerMm || !this.calibration.viewingDistanceCm) return 0;
        const scaleX = this.canvas ? (this.canvas.clientWidth / this.canvas.width) : 1;
        const viewingDistanceMm = this.calibration.viewingDistanceCm * 10;
        const physicalSizeMm = (arcsec * viewingDistanceMm) / ((180 / Math.PI) * 3600);
        return (physicalSizeMm * this.calibration.pixelsPerMm) / scaleX;
    }

    /**
     * [CƠ CHẾ TÁCH HÌNH DIOPTIC - Dichoptic Separation]
     * Thiết lập độ lệch hình giữa hai mắt dựa trên hệ quy chiếu Lăng kính Y khoa.
     *
     * Hướng phân kỳ/Hội tụ được xác định bởi tham số direction:
     *
     * BO (Base-Out / Hội tụ - Convergence):
     *   - Mắt phải nhìn ra ngoài (trái), mắt trái nhìn ra ngoài (phải)
     *   - Hình mắt phải dịch sang TRÁI (-pixelOffset)
     *   - Hình mắt trái dịch sang PHẢI (+pixelOffset)
     *
     * BI (Base-In / Phân kỳ - Divergence):
     *   - Ngược lại với BO
     *   - Hình mắt phải dịch sang PHẢI (+pixelOffset)
     *   - Hình mắt trái dịch sang TRÁI (-pixelOffset)
     *
     * @param {number} prismDiopters - Giá trị lăng kính (Delta - Δ) cần thiết lập
     * @param {string} direction - Hướng lăng kính: 'BO' (Base-Out) hoặc 'BI' (Base-In). Mặc định: 'BO'
     */
    setSeparationDemand(prismDiopters, direction = 'BO') {
        // Lưu giá trị lăng kính yêu cầu
        this.vergenceDemand.delta = prismDiopters;
        // Lưu hướng phân kỳ/hội tụ
        this.vergenceDemand.direction = direction;
        // Tính toán và lưu độ lệch pixel tương ứng dựa trên hiệu chuẩn màn hình
        this.vergenceDemand.pixelOffset = this.diopterToPixels(prismDiopters);
    }

    /**
     * Bắt đầu render loop
     */
    start() {
        this.sessionMetrics.startTime = Date.now();
        this._running = true;
        this._boundUpdate();

        // Lắng nghe SPA workspace change event
        this._boundSpaListener = this._handleSpaChange.bind(this);
        document.addEventListener('onWorkspaceChanged', this._boundSpaListener);
    }

    /**
     * Phát ra CustomEvent để EMR system tự lưu trữ dữ liệu
     * Không gọi this.stop() hoặc render UI tại đây
     */
    finishSession() {
        const duration = Date.now() - (this.sessionMetrics.startTime || Date.now());
        document.dispatchEvent(new CustomEvent('onTherapeuticSessionEnd', {
            detail: {
                gameName: this.gameName,
                metrics: this.sessionMetrics,
                durationMs: duration,
                opticalSettings: this.colors,
                timestamp: new Date().toISOString()
            }
        }));
    }

    /**
     * Dừng render loop và dọn dẹp
     */
    stop() {
        this._running = false;
        if (this._animationFrameId) {
            cancelAnimationFrame(this._animationFrameId);
        }

        // Dọn dẹp resize listener
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }

        // Xóa SPA listener
        if (this._boundSpaListener) {
            document.removeEventListener('onWorkspaceChanged', this._boundSpaListener);
        }

        // Xóa canvas khỏi DOM
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }

    /**
     * Xử lý sự kiện chuyển workspace (SPA event)
     * @param {CustomEvent} e
     */
    _handleSpaChange(e) {
        if (e.detail.toWorkspace !== 'therapeutic') {
            this.stop();
        }
    }

    /**
     * Resize canvas theo kích thước container
     */
    _resizeCanvas() {
        const rect = this.workspaceContainer.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.ctx.scale(dpr, dpr);

        // Lưu kích thước logic (không DPR)
        this.width = rect.width;
        this.height = rect.height;
    }

    /**
     * Render loop nội bộ
     * Gọi update() → render() mỗi frame
     */
    _updateLoop() {
        if (!this._running) return;

        this.update();
        this.render();

        this._animationFrameId = requestAnimationFrame(this._boundUpdate);
    }

    /**
     * Phương thức con ghi đè: Cập nhật logic game mỗi frame
     * Mặc định: không làm gì (subclass override)
     */
    update() {
        // Override trong subclass
    }

    /**
     * Phương thức con ghi đè: Render đồ họa game mỗi frame
     * BẮT BUỘC gọi super.render() đầu tiên
     */
    render() {
        // BẮT BUỘC: Reset các thuộc tính trạng thái Context bị rò rỉ từ class con
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.globalAlpha = 1.0;

        // A. TẠO MÔI TRƯỜNG QUANG HỌC: Xóa toàn màn hình và đổ nền trắng (Subtractive Color Mixing)
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // B. DUY TRÌ HỢP THỊ: Khóa dung hợp ngoại vi (Peripheral Binocular Lock)
        this.ctx.strokeStyle = this.colors.lock;
        this.ctx.lineWidth = 10;
        this.ctx.strokeRect(5, 5, this.canvas.width - 10, this.canvas.height - 10);
    }
}

// Xuất toàn cục cho các subclass kế thừa
if (typeof window !== 'undefined') {
    window.BinocularGameEngine = BinocularGameEngine;
}

export default BinocularGameEngine;
