/**
 * Module 5: RDSTherapyGame — Huấn luyện Thị giác nổi Toàn thể (Global Stereopsis Training)
 * 
 * Random Dot Stereogram (RDS) với cơ chế Adaptive Disparity:
 * - Bắt đầu với Disparity lớn (1200 arcsec) để tạo Stereo-Lock nhanh
 * - Giảm dần độ khó (×0.75) khi người chơi trúng đích
 * - Tăng lại độ khó (×1.5) khi người chơi trượt
 * - Kết thúc sau 3 phút hoặc đạt 30 Hits
 * - Lưu avgTherapyArcsec (trung bình 5 lần khó nhất) vào customData
 */

class RDSTherapyGame extends BinocularGameEngine {
    /**
     * Khởi tạo Game Logic RDS Therapy
     */
    constructor() {
        super();

        // --- Tên game cho EMR identification ---
        this.gameName = 'M5: Huấn luyện Thị giác nổi (RDS)';

        // --- Cấu hình Disadaptive Difficulty ---
        this.currentArcsec = 1200;       // Bắt đầu rất dễ (Stereo-Lock nhanh)
        this.minArcsec = 20;             // Ngưỡng khó nhất
        this.maxArcsec = 2000;           // Ngưỡng dễ nhất
        this.history = [];               // Mảng lưu các mốc Arcsec đã trúng

        // --- Cấu hình mục tiêu ẩn (Hình vuông nổi) ---
        // KHÔNG gọi _randomizeTargetPosition() ở đây — trì hoãn đến khi Canvas có kích thước vật lý
        this.targetRect = { x: 0, y: 0, size: 120 };

        // --- Cache Noise ngẫu nhiên — 2 layer trong suốt (Cyan/Red) cho phân thị hai mắt ---
        this.noiseCanvasRight = null;    // Cyan (Mắt phải nhìn)
        this.noiseCanvasLeft = null;     // Red (Mắt trái nhìn)
        this.NOISE_RESOLUTION = 4;       // 1 pixel noise mỗi 4px canvas (tối ưu hiệu năng)

        // --- Trạng thái trò chơi ---
        this.hits = 0;
        this.misses = 0;
        this.maxHits = 30;
        this.gameDurationMs = 3 * 60 * 1000; // 3 phút
        this.isRunning = false;

        // --- Clinical optimization states ---
        this.consecutiveMinHits = 0; // Đếm số lần trúng liên tiếp ở ngưỡng nhỏ nhất
        this.lastSpawnTime = 0;      // Thời điểm mục tiêu xuất hiện lần cuối

        // --- Micro-Biofeedback state ---
        this.flashAlpha = 0; // Alpha cho hiệu ứng viền xanh lá chớp sáng

        // --- Timer interval ID ---
        this._timerInterval = null;

        // --- Sự kiện click chuột ---
        this._clickHandler = this._handleClick.bind(this);
    }

    /**
     * Bắt đầu game
     * Gọi super.start(), lắng nghe click
     */
    start() {
        super.start();
        this.isRunning = true;
        this.sessionMetrics.startTime = Date.now();
        this.lastSpawnTime = Date.now();

        // Lắng nghe sự kiện click trên canvas
        this.canvas.addEventListener('click', this._clickHandler);

        // Bắt đầu timer đếm ngược
        this._startTimer();
    }

    /**
     * Dừng game
     * Xóa event listener, dừng timer, gọi super.stop()
     */
    stop() {
        this.isRunning = false;
        this.canvas.removeEventListener('click', this._clickHandler);
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
        super.stop();
    }

    /**
     * Khởi tạo 2 OffscreenCanvas riêng biệt cho phân thị hai mắt (Cyan/Red)
     * @param {number} w - Chiều rộng canvas nội tại
     * @param {number} h - Chiều cao canvas nội tại
     */
    _initNoiseCache(w, h) {
        this.noiseCanvasRight = document.createElement('canvas'); // Cyan
        this.noiseCanvasRight.width = w; this.noiseCanvasRight.height = h;
        this.noiseCanvasLeft = document.createElement('canvas'); // Red
        this.noiseCanvasLeft.width = w; this.noiseCanvasLeft.height = h;
        this._regenerateNoisePixels();
    }

    /**
     * Tái tạo mảng pixel trong suốt màu Cyan (phải) và Đỏ (trái)
     * Nền transparent, dot trắng/opaque khi isDot = true
     */
    _regenerateNoisePixels() {
        if (!this.noiseCanvasRight || !this.noiseCanvasLeft) return;
        const w = this.noiseCanvasRight.width;
        const h = this.noiseCanvasRight.height;
        const ctxR = this.noiseCanvasRight.getContext('2d');
        const ctxL = this.noiseCanvasLeft.getContext('2d');
        const imgR = ctxR.createImageData(w, h);
        const imgL = ctxL.createImageData(w, h);
        
        for (let i = 0; i < imgR.data.length; i += 4) {
            const isDot = Math.random() > 0.5;
            if (isDot) {
                // Cyan (Mắt phải nhìn) - Bọc trên nền trong suốt
                imgR.data[i] = 0; imgR.data[i+1] = 255; imgR.data[i+2] = 255; imgR.data[i+3] = 255;
                // Đỏ (Mắt trái nhìn) - Bọc trên nền trong suốt
                imgL.data[i] = 255; imgL.data[i+1] = 0; imgL.data[i+2] = 0; imgL.data[i+3] = 255;
            } else {
                imgR.data[i+3] = 0; // Transparent
                imgL.data[i+3] = 0; // Transparent
            }
        }
        ctxR.putImageData(imgR, 0, 0);
        ctxL.putImageData(imgL, 0, 0);
    }

    /**
     * Random vị trí mục tiêu trong vùng an toàn của canvas
     * Giữ margin 150px so với viền để mục tiêu không bị cắt
     * @param {number} canvasW - Chiều rộng logic của canvas
     * @param {number} canvasH - Chiều cao logic của canvas
     */
    _randomizeTargetPosition(canvasW, canvasH) {
        const margin = 150;
        const w = canvasW || this.canvas?.clientWidth || window.innerWidth;
        const h = canvasH || this.canvas?.clientHeight || window.innerHeight;
        this.targetRect.x = margin + Math.random() * (w - margin * 2);
        this.targetRect.y = margin + Math.random() * (h - margin * 2);
    }

    /**
     * Bắt đầu bộ đếm thời gian
     * Kiểm tra hết giờ mỗi giây
     */
    _startTimer() {
        this._timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.sessionMetrics.startTime;
            if (elapsed >= this.gameDurationMs || this.hits >= this.maxHits) {
                this._endGame();
            }
        }, 100);
    }

    /**
     * Render đồ họa RDS (Random Dot Stereogram)
     * Áp dụng phân thị mắt (Dichoptic Rendering) với Crossed Disparity
     */
    render() {
        // Guard Clause: Hủy render nếu DOM chưa sẵn sàng
        if (!this.canvas || !this.ctx || !this.canvas.width || !this.canvas.height) return;

        // Khởi tạo tọa độ ngẫu nhiên lần đầu sau khi Canvas đã có kích thước vật lý
        if (this.targetRect.x === 0 && this.targetRect.y === 0) {
            this._randomizeTargetPosition();
        }

        // An toàn cho Bộ đệm Nhiễu (Noise Buffer)
        const noiseW = Math.ceil(this.canvas.width / this.NOISE_RESOLUTION);
        const noiseH = Math.ceil(this.canvas.height / this.NOISE_RESOLUTION);
        if (!this.noiseCanvasRight || this.noiseCanvasRight.width !== noiseW || this.noiseCanvasRight.height !== noiseH) {
            this._initNoiseCache(noiseW, noiseH);
        }

        // A. Môi trường quang học an toàn (nền trắng + viền đen)
        super.render();

        const ctx = this.ctx;
        const scaleX = this.canvas.clientWidth / this.canvas.width;
        const scaleY = this.canvas.clientHeight / this.canvas.height;
        const targetScreenX = this.targetRect.x * scaleX;
        const targetScreenY = this.targetRect.y * scaleY;
        const targetScreenSize = this.targetRect.size * scaleX;

        // B. Vẽ Nền Noise màu Cyan (Mắt phải nhìn - Cố định)
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(
            this.noiseCanvasRight,
            0, 0, this.noiseCanvasRight.width, this.noiseCanvasRight.height,
            0, 0, this.canvas.width, this.canvas.height
        );

        // C. Vẽ Nền Noise màu Đỏ (Mắt trái nhìn) - Khoét lỗ vùng target bằng evenodd
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, this.canvas.width, this.canvas.height);
        ctx.rect(targetScreenX, targetScreenY, targetScreenSize, targetScreenSize);
        ctx.clip('evenodd');
        ctx.drawImage(
            this.noiseCanvasLeft,
            0, 0, this.noiseCanvasLeft.width, this.noiseCanvasLeft.height,
            0, 0, this.canvas.width, this.canvas.height
        );
        ctx.restore();

        // D. Phân thị vùng mục tiêu (Khối nổi)
        // Dịch chuyển Noise màu Đỏ sang PHẢI (Base-Out / Crossed Disparity) để khối hình NỔI LÊN
        const offsetPixels = Math.round(this.arcsecToPixels(this.currentArcsec));
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(targetScreenX, targetScreenY, targetScreenSize, targetScreenSize);
        ctx.clip();
        ctx.drawImage(
            this.noiseCanvasLeft,
            0, 0, this.noiseCanvasLeft.width, this.noiseCanvasLeft.height,
            offsetPixels, 0, this.canvas.width, this.canvas.height // Dịch +offsetPixels
        );
        ctx.restore();

        // E. Reset composite mode
        ctx.globalCompositeOperation = 'source-over';

        // F. Phao cứu sinh (Hint): Nhấp nháy viền mục tiêu sau 15 giây kẹt dung hợp
        const timeSinceSpawn = Date.now() - (this.lastSpawnTime || Date.now());
        if (timeSinceSpawn > 15000 && this.isRunning) {
            const hintAlpha = (Math.sin(Date.now() / 150) + 1) / 4; // Dao động 0 -> 0.5
            ctx.save();
            ctx.strokeStyle = `rgba(255, 255, 255, ${hintAlpha})`; // Viền trắng mờ để nổi trên nền nhiễu
            ctx.lineWidth = 4;
            ctx.strokeRect(targetScreenX, targetScreenY, targetScreenSize, targetScreenSize);
            ctx.restore();
        }

        // G. Render Micro-Biofeedback (Viền xanh lá chớp sáng)
        if (this.flashAlpha > 0) {
            this.ctx.save();
            this.ctx.strokeStyle = `rgba(74, 222, 128, ${this.flashAlpha})`; // Màu #4ade80
            this.ctx.lineWidth = 15;
            this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
        }
    }

    /**
     * Render HUD hiển thị thông tin game
     * - Độ khó hiện tại (Arcsec)
     - Số Hits / Misses
     - Thời gian còn lại
     - Hướng dẫn người chơi
     */
    _renderHUD(ctx) {
        const remaining = Math.max(0, this.gameDurationMs - (Date.now() - this.sessionMetrics.startTime));
        const secondsLeft = Math.ceil(remaining / 1000);
        const minutesLeft = Math.floor(secondsLeft / 60);
        const secsDisplay = secondsLeft % 60;

        // Độ khó hiện tại
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Độ khó: ${Math.round(this.currentArcsec)} arcsec`, 20, 20);

        // Số Hits
        ctx.fillText(`Hits: ${this.hits}/${this.maxHits}`, 20, 45);

        // Số Misses
        ctx.fillText(`Trượt: ${this.misses}`, 20, 70);

        // Thời gian còn lại
        ctx.fillText(`Thời gian: ${minutesLeft}:${secsDisplay.toString().padStart(2, '0')}`, 20, 95);

        // Thông tin phần cứng
        ctx.fillStyle = '#64748b';
        ctx.font = '12px Arial, sans-serif';
        const pxMm = this.calibration?.pixelsPerMm ? this.calibration.pixelsPerMm.toFixed(2) : 'N/A';
        const dist = this.calibration?.viewingDistanceCm || 'N/A';
        ctx.fillText(`[Hardware: ${pxMm} px/mm | Khoảng cách: ${dist} cm]`, 15, 115);

        // Hướng dẫn (góc phải)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.font = '14px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('Click vào hình vuông NỔI BỒNG ở giữa màn hình', this.canvas.clientWidth - 20, 20);
        ctx.fillText('ESC để thoát', this.canvas.clientWidth - 20, 42);
    }

    /**
     * Xử lý sự kiện Click chuột
     * Người chơi phải click vào vị trí hình vuông đang nổi lên
     */
    _handleClick(e) {
        if (!this.isRunning) return;

        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Chuyển đổi toạ độ mục tiêu theo CSS scale
        const scaleX = this.canvas.clientWidth / this.canvas.width;
        const scaleY = this.canvas.clientHeight / this.canvas.height;
        const targetScreenX = this.targetRect.x * scaleX;
        const targetScreenY = this.targetRect.y * scaleY;
        const targetScreenSize = this.targetRect.size * scaleX;

        // Kiểm tra click có trúng vùng target không
        const isHit = (
            clickX >= targetScreenX &&
            clickX <= targetScreenX + targetScreenSize &&
            clickY >= targetScreenY &&
            clickY <= targetScreenY + targetScreenSize
        );

        if (isHit) {
            this._handleHit();
        } else {
            this._handleMiss();
        }
    }

    /**
     * Xử lý khi TRÚNG ĐÍCH
     - Lưu currentArcsec vào history
     - Tăng độ khó: giảm arcsec × 0.75
     - Phát hiệu ứng âm thanh/visual nhỏ
     - Random vị trí mới, tái tạo noise
     */
    _handleHit() {
        this.hits++;
        this.history.push(this.currentArcsec);

        // 1. Reset bộ đếm thời gian Phao cứu sinh
        this.lastSpawnTime = Date.now();

        // 2. Logic kết thúc sớm (Early Exit)
        if (this.currentArcsec <= this.minArcsec) {
            this.consecutiveMinHits++;
        } else {
            this.consecutiveMinHits = 0;
        }
        if (this.consecutiveMinHits >= 5) {
            this._endGame();
            return; // Dừng ngay lập tức, không spawn mục tiêu mới
        }

        // Phản hồi sinh học vi mô: tiếng bíp + chớp viền xanh
        this._playSuccessBeep();
        this.flashAlpha = 1.0; // Kích hoạt chớp viền xanh

        // Tăng độ khó: giảm disparity × 0.75
        this.currentArcsec = Math.max(this.minArcsec, this.currentArcsec * 0.75);

        // Random vị trí mục tiêu mới
        if (this.canvas && this.canvas.clientWidth) {
            this._randomizeTargetPosition();
        }

        // Tái tạo noise để thay đổi pattern (giảm mỏi mắt)
        if (this.noiseCanvasRight && this.noiseCanvasLeft) {
            this._regenerateNoisePixels();
        }
    }

    /**
     * Xử lý khi TRƯỢT
     - Giảm độ khó: tăng arcsec × 1.5
     - Phát hiệu ứng visual (flash đỏ)
     */
    _handleMiss() {
        this.misses++;

        // Reset chuỗi trúng đích liên tiếp
        this.consecutiveMinHits = 0;

        // Giảm độ khó để tái lập dung hợp
        this.currentArcsec = Math.min(this.maxArcsec, this.currentArcsec * 1.5);

        // Phát hiệu ứng visual (flash đỏ)
        this._playMissEffect();
    }

    /**
     * Phát hiệu ứng flash xanh lá khi trúng đích
     */
    _playHitEffect() {
        if (!this.ctx || !this.canvas.width) return;
        const ctx = this.ctx;
        const prevFill = ctx.fillStyle;
        ctx.fillStyle = 'rgba(34, 197, 94, 0.3)'; // Green flash
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = prevFill;
    }

    /**
     * Phát hiệu ứng flash đỏ khi trượt
     */
    _playMissEffect() {
        if (!this.ctx || !this.canvas.width) return;
        const ctx = this.ctx;
        const prevFill = ctx.fillStyle;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; // Red flash
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = prevFill;
    }

    /**
     * Kết thúc game và báo cáo kết quả
     * - Tính trung bình 5 lần trúng đích khó nhất (nhỏ nhất arcsec)
     - Lưu customData.finalArcsec = avgTherapyArcsec
     - Đẩy ra HUD Overlay
     */
    _endGame() {
        this.isRunning = false;

        // A. Dọn dẹp
        if (this.canvas) {
            this.canvas.removeEventListener('click', this._clickHandler);
        }
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }

        // B. Tính toán kết quả lâm sàng
        // Sắp xếp history tăng dần (arcsec nhỏ = khó hơn)
        const sorted = [...this.history].sort((a, b) => a - b);
        // Lấy 5 lần khó nhất (hoặc ít hơn nếu chưa đủ)
        const top5 = sorted.slice(0, Math.min(5, sorted.length));
        const avgTherapyArcsec = top5.length > 0
            ? top5.reduce((sum, val) => sum + val, 0) / top5.length
            : this.currentArcsec;

        // C. Đóng gói sessionMetrics
        this.sessionMetrics.score = this.hits;
        this.sessionMetrics.hits = this.hits;
        this.sessionMetrics.misses = this.misses;
        this.sessionMetrics.customData = {
            finalArcsec: Math.round(avgTherapyArcsec),
            bestArcsec: sorted.length > 0 ? sorted[0] : null,
            totalHits: this.hits,
            totalMisses: this.misses,
            difficultyHistory: this.history
        };
        this.finishSession();

        // D. Stop engine
        super.stop();
        if (this.canvas) {
            this.canvas.style.cursor = 'default';
        }

        // E. Tạo Overlay kết quả
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; inset: 0; z-index: 2147483647; background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif;';

        // Đánh giá kết quả stereopsis
        let stereoLevel = '';
        let stereoEval = '';
        if (avgTherapyArcsec <= 40) {
            stereoLevel = 'Xuất sắc (Ultra-fine)';
            stereoEval = '<span style="color:#4ade80">Rất tốt — Thị giác nổi vượt trội</span>';
        } else if (avgTherapyArcsec <= 60) {
            stereoLevel = 'Tốt (Fine)';
            stereoEval = '<span style="color:#4ade80">ĐẠT (Bình thường)</span>';
        } else if (avgTherapyArcsec <= 100) {
            stereoLevel = 'Trung bình (Coarse)';
            stereoEval = '<span style="color:#fbbf24">ĐẠT (Yếu hơn bình thường)</span>';
        } else {
            stereoLevel = 'Kém (Stereoblindness risk)';
            stereoEval = '<span style="color:#f87171">CHƯA ĐẠT (Suy giảm thị giác nổi)</span>';
        }

        overlay.innerHTML = `
            <div style="background: #1e293b; border-radius: 12px; padding: 30px; max-width: 650px; width: 90%; box-shadow: 0 4px 24px rgba(0,0,0,0.5);">
                <h2 style="text-align: center; color: #38bdf8; margin: 0 0 20px 0; font-size: 24px;">
                    KẾT QUẢ HUẤN LUYỆN THỊ GIÁC NỔI
                </h2>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid #38bdf8; border-radius: 8px; padding: 15px; text-align: center;">
                        <p style="font-size: 14px; color: #94a3b8; margin: 0 0 8px 0;">Tổng Hits</p>
                        <p style="font-size: 28px; color: #38bdf8; margin: 0; font-weight: bold;">${this.hits}</p>
                    </div>
                    <div style="background: rgba(248, 113, 113, 0.1); border: 1px solid #f87171; border-radius: 8px; padding: 15px; text-align: center;">
                        <p style="font-size: 14px; color: #94a3b8; margin: 0 0 8px 0;">Tổng Trượt</p>
                        <p style="font-size: 28px; color: #f87171; margin: 0; font-weight: bold;">${this.misses}</p>
                    </div>
                </div>

                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin-bottom: 20px; text-align: center;">
                    <p style="font-size: 14px; color: #94a3b8; margin: 0 0 8px 0;">Ngưỡng Stereopsis Trị liệu (Avg Top 5)</p>
                    <p style="font-size: 32px; color: #10b981; margin: 0; font-weight: bold;">${Math.round(avgTherapyArcsec)} arcsec</p>
                    <p style="font-size: 14px; margin: 4px 0 0 0;">${stereoEval}</p>
                </div>

                <div style="background: rgba(100, 116, 139, 0.1); border: 1px solid #64748b; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
                    <p style="font-size: 13px; color: #94a3b8; margin: 0; line-height: 1.5;">
                        <strong>Mức độ:</strong> ${stereoLevel}<br>
                        <strong>Tốt nhất:</strong> ${sorted.length > 0 ? sorted[0] + ' arcsec' : '—'}<br>
                        <strong>Disparity cuối:</strong> ${Math.round(this.currentArcsec)} arcsec
                    </p>
                </div>

                <div style="text-align: center;">
                    <button id="btn-finish-m5" style="padding: 12px 30px; font-size: 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">HOÀN THÀNH PHÁC ĐỒ</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const finishBtn = document.getElementById('btn-finish-m5');
        if (finishBtn) {
            finishBtn.onclick = () => {
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(e => console.log(e));
                }
                overlay.remove();
                console.log('[RDS Therapy] Hoàn thành phác đồ điều trị.');
            };
        }
    }

    /**
     * Phát tiếng bíp ngắn (800Hz, 100ms) bằng Web Audio API
     * Không cần file âm thanh ngoài — tạo oscillator thuần túy
     */
    _playSuccessBeep() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // Tần số 800Hz
            
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Âm lượng nhỏ
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.1);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        } catch (e) {
            console.warn("[Biofeedback] Trình duyệt không hỗ trợ AudioContext");
        }
    }

    /**
     * Override update(): xử lý fade-out viền biofeedback mỗi frame
     */
    update() {
        if (this.flashAlpha > 0) {
            this.flashAlpha -= 0.05; // Tốc độ mờ dần (chớp trong khoảng 20 frames)
            if (this.flashAlpha < 0) this.flashAlpha = 0;
        }
    }
}

// Xuất module cho ES Module import
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RDSTherapyGame };
}

// Xuất toàn cục cho các subclass kế thừa
if (typeof window !== 'undefined') {
    window.RDSTherapyGame = RDSTherapyGame;
}
