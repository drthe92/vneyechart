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
        // Không cho phép chạy phác đồ nếu chưa hiệu chuẩn (yêu cầu nghiêm ngặt).
        if (!calibration.pixelsPerMm || !calibration.viewingDistanceCm) {
            throw new Error("[LỖI Y KHOA NGHIÊM TRỌNG]: Vui lòng hiệu chuẩn phần cứng màn hình (Pixel/mm) và Khoảng cách khám trước khi khởi chạy phác đồ.");
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
        // Responsive 100% Container: canvas luôn tràn khít #workspace-therapeutic
        this.workspaceContainer.style.position = 'relative';

        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        this.canvas.style.zIndex = '999';

        this.workspaceContainer.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');

        // --- [B5] Nút thoát ảo cho thiết bị cảm ứng (Touch) ---
        // Nằm đè lên Canvas góc trên-phải, z-index cao hơn canvas (999).
        // Gọi stop() → Engine tự đóng gói dữ liệu EMR dở dang (cờ interrupted).
        this._createExitButton();

        // --- RESPONSIVE 100% CONTAINER ---
        // Gán giá trị THỰC từ container (không còn kích thước cứng 1920x1080/16:9).
        // Scale Lock 1:1 (không DPR, không kéo giãn) → vật thể hình tròn luôn tròn.
        this.width = 0;
        this.height = 0;
        this.cx = 0;
        this.cy = 0;
        this._engineReady = false;   // Chặn hook onResize() chạy khi subclass chưa khởi tạo xong
        this._resizeCanvas();
        this._engineReady = true;

        // --- Lắng nghe Resize (Auto-center) ---
        // Debounce bằng requestAnimationFrame; khi cửa sổ đổi kích thước,
        // cập nhật lại canvas + tâm màn hình (cx, cy) cho toàn bộ subclass.
        this._resizeQueued = false;
        this.resizeHandler = () => {
            if (this._resizeQueued) return;
            this._resizeQueued = true;
            requestAnimationFrame(() => {
                this._resizeQueued = false;
                this._resizeCanvas();
            });
        };
        window.addEventListener('resize', this.resizeHandler);

        // --- Render loop ---
        this._running = false;
        this._boundUpdate = this._updateLoop.bind(this);

        // --- [A2] Chống thất thoát EMR: đánh dấu phiên đã báo cáo chưa ---
        this._sessionFinished = false;

        // --- [A1] Delta-time: mốc timestamp frame trước (ms) ---
        this._lastFrameTs = 0;
        this.dt = 0;
    }

    /**
     * [B5] Tạo nút "✖ Thoát" ảo đè lên Canvas (góc trên-phải).
     * Phục vụ thiết bị Touch không có bàn phím (ESC). Kích thước 48x48px
     * đủ lớn cho ngón tay, z-index 1100 > canvas (999).
     * @private
     */
    _createExitButton() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Thoát bài tập');
        btn.textContent = '✖';
        btn.style.cssText = [
            'position:absolute', 'top:10px', 'right:10px',
            'width:48px', 'height:48px',
            'z-index:1100',
            'background:rgba(15,23,42,0.55)', 'color:#ffffff',
            'border:2px solid rgba(255,255,255,0.4)', 'border-radius:50%',
            'font-size:22px', 'line-height:1',
            'cursor:pointer', 'touch-action:manipulation',
            '-webkit-user-select:none', 'user-select:none'
        ].join(';');

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._requestExit();
        });

        this.workspaceContainer.appendChild(btn);
        this.exitButton = btn;
    }

    /**
     * [B5] Yêu cầu thoát sớm từ nút ảo:
     * stop() sẽ tự dispatch bản ghi EMR dở dang (cờ interrupted),
     * sau đó rời fullscreen để Controller dọn workspace.
     * @private
     */
    _requestExit() {
        if (this._running) {
            this.stop();
        }
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
    }

    /**
     * Đọc dữ liệu hiệu chuẩn từ localStorage
     * [SCALE LOCK] Ưu tiên Credit-Card Calibration (localStorage);
     * nếu chưa có, fallback về nguồn PPI y khoa toàn cục window.__calibrator
     * (DisplayCalibrator) — KHÔNG tạo kích thước cứng riêng cho game.
     * @returns {{ pixelsPerMm: number, viewingDistanceCm: number }}
     * @private
     */
    _loadCalibrationFromStorage() {
        const result = { pixelsPerMm: 0, viewingDistanceCm: 0 };
        const ccPxPerMm = localStorage.getItem('vision-therapy-cc-pxpermm');
        if (ccPxPerMm && parseFloat(ccPxPerMm) > 0) result.pixelsPerMm = parseFloat(ccPxPerMm);
        // [CỰ LY GẦN] MỌI game huấn luyện (M1-M13) chơi ở cự ly gần — fallback
        // phải đọc cấu hình Nhìn Gần vĩnh viễn (vision_distance_near_m, mặc định
        // 0.4m = 40cm), KHÔNG đọc key legacy 'vision-therapy-calibrate-distance-m'
        // (key này đang giữ khoảng cách "active cuối cùng" — có thể là Nhìn Xa 4m).
        const nearM = localStorage.getItem('vision_distance_near_m');
        if (nearM && parseFloat(nearM) > 0) result.viewingDistanceCm = parseFloat(nearM) * 100;

        // Fallback: hiệu chuẩn toàn cục (khớp thứ tự ưu tiên trong main.js)
        if (typeof window !== 'undefined' && window.__calibrator) {
            const cal = window.__calibrator;
            // [CỰ LY GẦN] distanceM "đang hoạt động" trên window.__calibrator:
            // main.js / startTherapyModule() / _startFullscreenGame() đều ép
            // distanceM = distanceNearM (mặc định 40cm) trước khi khởi tạo game
            // M1-M13 — vì MỌI game huấn luyện đều chơi ở cự ly gần.
            if (cal.distanceM > 0) {
                result.viewingDistanceCm = cal.distanceM * 100;
            }
            if (!result.pixelsPerMm && cal.pxPerMm > 0) {
                result.pixelsPerMm = cal.pxPerMm;
            }
            if (!result.pixelsPerMm && cal.ppi > 0) {
                result.pixelsPerMm = cal.ppi / 25.4; // PPI → px/mm (MM_PER_INCH)
            }
            if (!result.viewingDistanceCm && cal.distanceNearM > 0) {
                result.viewingDistanceCm = cal.distanceNearM * 100;
            }
        }
        return result;
    }

    /**
     * [SCALE LOCK] Hệ số co giãn CSS của canvas (pixel vật lý / pixel nội tại).
     * Canvas được khóa tỷ lệ 1:1 với container (canvas.width == clientWidth)
     * nên hệ số luôn == 1 — đảm bảo các hệ số vật lý (pixelsPerMm / ppi)
     * không bị bóp méo theo trục khi màn hình đổi kích thước/tỷ lệ.
     * @returns {{ x: number, y: number }}
     */
    _canvasScale() {
        if (!this.canvas || !this.canvas.clientWidth || !this.canvas.width) return { x: 1, y: 1 };
        return {
            x: this.canvas.clientWidth / this.canvas.width,
            y: this.canvas.clientHeight / this.canvas.height
        };
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
        const scaleX = this._canvasScale().x; // Scale Lock: khử co giãn CSS (== 1 khi canvas khớp container)
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
        const scaleX = this._canvasScale().x; // Scale Lock
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
        const scaleX = this._canvasScale().x; // Scale Lock
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
        const scaleX = this._canvasScale().x; // Scale Lock
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
        const scaleX = this._canvasScale().x; // Scale Lock
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
        // [P#5] Re-entrancy guard: nếu đã chạy thì không khởi tạo lại (tránh nhân
        // bản listener onWorkspaceChanged / SPA, rò rỉ trạng thái khi gọi start() 2 lần).
        if (this._running) {
            console.warn('[BinocularGameEngine] start() bị gọi khi đang chạy — bỏ qua để tránh leak listener.');
            return;
        }

        this.sessionMetrics.startTime = Date.now();
        this._running = true;

        // [A1] Reset đồng hồ Delta-time + cờ báo cáo EMR cho phiên mới
        this._lastFrameTs = 0;
        this._sessionFinished = false;

        this._boundUpdate();

        // Lắng nghe SPA workspace change event
        this._boundSpaListener = this._handleSpaChange.bind(this);
        document.addEventListener('onWorkspaceChanged', this._boundSpaListener);
    }

    /**
     * Phát ra CustomEvent để EMR system tự lưu trữ dữ liệu
     * Không gọi this.stop() hoặc render UI tại đây
     * [A2] Đánh dấu _sessionFinished để stop() không ghi đè bản ghi hoàn chỉnh
     */
    finishSession() {
        this._sessionFinished = true;
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
     * [A2] Đóng gói dữ liệu dở dang khi phiên bị ngắt giữa chừng
     * (nút ✖, ESC/fullscreen exit, chuyển workspace) — đảm bảo EMR
     * luôn nhận được bản ghi với cờ metrics.interrupted = true.
     * @private
     */
    _finishInterrupted() {
        this.sessionMetrics.interrupted = true;
        this.sessionMetrics.endReason = 'interrupted';
        this.finishSession();
    }

    /**
     * Dừng render loop và dọn dẹp
     */
    stop() {
        // [CHỐNG TRẮNG MÀN] Idempotent: nếu phiên đã kết thúc (finishSession)
        // và engine đã dừng, mọi lần stop() sau (vd stopCurrentGame() gọi lại
        // trên fullscreenchange) đều no-op — bảo vệ subclass không truy cập
        // canvas đã bị _forceClean() xóa.
        if (!this._running && this._sessionFinished) return;

        // [A2] Chống thất thoát dữ liệu EMR:
        // Nếu phiên đang chạy mà chưa từng finishSession() → tự đóng gói
        // dữ liệu dở dang với cờ interrupted = true trước khi hủy.
        if (this._running && !this._sessionFinished) {
            this._finishInterrupted();
        }

        this._running = false;
        if (this._animationFrameId) {
            cancelAnimationFrame(this._animationFrameId);
        }

        // Dọn dẹp resize listener (debounce rAF sẽ tự bỏ qua vì canvas đã rời DOM)
        this._resizeQueued = false;
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

        // [B5] Xóa nút thoát ảo khỏi DOM
        if (this.exitButton && this.exitButton.parentNode) {
            this.exitButton.parentNode.removeChild(this.exitButton);
        }

        // ===== [TỬ HUYẾT 2] FORCE CLEAN: triệt tiêu rò rỉ trạng thái toàn cục =====
        // Gọi ngay cả khi subclass throw ở trên → đảm bảo không còn rác trạng thái
        // (Event Listener / Timer / biến window) gây nhiễu vật lý cho game sau.
        try {
            this._forceClean();
        } catch (err) {
            console.error('[BinocularGameEngine] Lỗi trong _forceClean:', err);
        }
    }

    /**
     * [TỬ HUYẾT 2] Dọn dẹp bắt buộc mọi rò rỉ trạng thái toàn cục khi kết thúc phiên.
     * Được gọi cuối hàm stop() (bọc trong try/catch).
     * Mục tiêu: chuyển M1 → M4 (hoặc bất kỳ module nào) không để lại:
     *  - Event Listener gắn trên window/document (phím ESC/SPACE, mousemove...)
     *  - Timer / Interval (setInterval setStatus, setTimeout trễ...)
     *  - Biến toàn cục window.currentTherapy trỏ tới instance cũ
     *  - Tham chiếu bộ nhớ tạm (canvas/ctx/calibration) gây duplicate listener
     * @private
     */
    _forceClean() {
        // 1) Hủy mọi Timer / Interval đã đăng ký qua helper của engine
        if (Array.isArray(this._timers)) {
            this._timers.forEach(t => {
                clearTimeout(t);
                clearInterval(t);
            });
            this._timers = [];
        }
        // 1b) Timer interval thường gặp ở một số subclass (vd rds_therapy_game)
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
        // 1c) Bất kỳ rAF phụ nào không phải vòng lặp chính
        if (this._rafId && this._rafId !== this._animationFrameId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }

        // 2) Gỡ bỏ các listener phím (ESC / SPACE) gắn trên window mà subclass lưu ref.
        //    Quét theo TÊN HANDLER phổ biến để chống nhân bản listener khi đổi game.
        const keyHandlerProps = ['handleSpacebar', '_spaceHandler', '_onKeyDown', '_escHandler', '_handleEsc', '_boundKeydown'];
        keyHandlerProps.forEach(prop => {
            if (typeof this[prop] === 'function') {
                window.removeEventListener('keydown', this[prop]);
                document.removeEventListener('keydown', this[prop]);
            }
        });

        // 3) Xóa tham chiếu phiên trị liệu toàn cục nếu đang trỏ về instance này
        if (window.currentTherapy === this) window.currentTherapy = null;

        // 4) Giải phóng bộ nhớ tạm — ngăn vật lý game trước rò rỉ sang game sau
        this.sessionMetrics = null;
        this.calibration = null;
        this.canvas = null;
        this.ctx = null;
        this.exitButton = null;
        this.colors = null;
    }

    /**
     * [TỬ HUYẾT 2] Đăng ký Timer/Interval an toàn — subclass GHI ĐÈ nên dùng helper này
     * thay vì gọi trực tiếp setInterval/setTimeout, để _forceClean tự hủy khi stop().
     * @returns {number} id của timer (để clear thủ công nếu cần)
     */
    _trackTimer(fn, delay, asInterval = false) {
        if (!Array.isArray(this._timers)) this._timers = [];
        const id = asInterval ? setInterval(fn, delay) : setTimeout(fn, delay);
        this._timers.push(id);
        return id;
    }

    /**
     * [TỬ HUYẾT 2] Đăng ký listener trên window/document an toàn — _forceClean sẽ tự gỡ.
     * (Dùng cho subclass muốn bắt ESC/SPACE một cách phòng thủ tuyệt đối.)
     */
    _trackGlobalListener(target, type, handler, opts) {
        target.addEventListener(type, handler, opts);
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
     * [RESPONSIVE 100% CONTAINER + AUTO-CENTER]
     * Đồng bộ canvas với kích thước THỰC của #workspace-therapeutic:
     * - canvas.width  = container.clientWidth
     * - canvas.height = container.clientHeight
     * - Cập nhật tâm màn hình this.cx / this.cy → mọi subclass tự căn giữa lại
     * - Gọi hook onResize() để subclass di dời vật thể đang cache tọa độ
     *
     * [SCALE LOCK]: Không nhân DPR, không ép tỷ lệ cố định → canvas luôn khớp
     * 1:1 với CSS box. Nhờ đó các hệ số vật lý (pixelsPerMm / __calibrator.ppi)
     * không bị bóp méo (distortion) khi màn hình đổi tỷ lệ.
     */
    _resizeCanvas() {
        if (!this.canvas || !this.workspaceContainer) return;

        const rect = this.workspaceContainer.getBoundingClientRect();
        const w = Math.max(1, this.workspaceContainer.clientWidth
            || Math.round(rect.width) || window.innerWidth || 0);
        const h = Math.max(1, this.workspaceContainer.clientHeight
            || Math.round(rect.height) || window.innerHeight || 0);

        if (this.canvas.width !== w) this.canvas.width = w;
        if (this.canvas.height !== h) this.canvas.height = h;

        // Kích thước logic (không DPR) + tâm màn hình dùng chung cho 13 module
        this.width = w;
        this.height = h;
        this.cx = w / 2;
        this.cy = h / 2;

        // Auto-center: thông báo subclass có vật thể cache tọa độ tuyệt đối
        if (this._engineReady && typeof this.onResize === 'function') {
            this.onResize(w, h, this.cx, this.cy);
        }
    }

    /**
     * [AUTO-CENTER] Hook được gọi sau mỗi lần canvas đổi kích thước.
     * Subclass ghi đè để di dời vật thể đã cache (VD: thanh hứng M1 sát đáy).
     * @param {number} w  - Chiều rộng canvas mới (px)
     * @param {number} h  - Chiều cao canvas mới (px)
     * @param {number} cx - Tâm ngang mới (px)
     * @param {number} cy - Tâm dọc mới (px)
     */
    onResize(w, h, cx, cy) {
        // Mặc định không làm gì (subclass override)
    }

    /**
     * Render loop nội bộ
     * Gọi update(dt) → render() mỗi frame
     *
     * [A1] VẬT LÝ THỜI GIAN THỰC (Delta-time):
     * - dt = (timestamp - lastTimestamp) / 1000 (giây) từ rAF
     * - Clamp tối đa 0.1s: chống nhảy khung khi tab ẩn / máy giật lag
     * - Frame đầu tiên: mặc định 1/60s
     * → Tốc độ vật tiêu đồng nhất trên mọi refresh rate (60Hz/144Hz)
     */
    _updateLoop(timestamp) {
        if (!this._running) return;

        let dt = this._lastFrameTs ? (timestamp - this._lastFrameTs) / 1000 : 0;
        this._lastFrameTs = timestamp;
        if (!(dt > 0)) dt = 1 / 60;
        if (dt > 0.1) dt = 0.1;
        this.dt = dt;

        this.update(dt);
        this.render();

        this._animationFrameId = requestAnimationFrame(this._boundUpdate);
    }

    /**
     * Phương thức con ghi đè: Cập nhật logic game mỗi frame
     * Mặc định: không làm gì (subclass override)
     * @param {number} dt - Delta-time (giây) từ vòng lặp Engine [A1]
     */
    update(dt = 0) {
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
