/**
 * MaddoxGridModule — Module đo tiếp tuyến (Tangent Scale) cho thử nghiệm Que Maddox
 * 
 * Quy trình khám khép kín: Lobby -> Khám Xa (6m) -> Khám Gần (40cm) -> Tính AC/A
 * Vẽ điểm sáng trung tâm và lưới tọa độ lăng kính (Prism Diopter Grid) trên Canvas.
 * Bệnh nhân nhìn qua que Maddox và báo vị trí vạch sáng cắt ngang các con số
 * để đo độ lác (strabismus).
 * 
 * Sử dụng:
 *   const calibration = JSON.parse(localStorage.getItem('calibration'));
 *   const module = new MaddoxGridModule(calibration);
 *   module.start();
 *   // ...
 *   module.stop();
 */

class MaddoxGridModule {
    /**
     * Constructor — MaddoxGridModule
     *
     * Optical Calibration Contract (2026-08-17 Audit):
     *   calibration.pixelsPerMm  — Physical PPM from CreditCardCalibration
     *   calibration.viewingDistanceM — Default exam distance in meters
     *
     * Prism Diopter Formula:
     *   1 PD = 10mm × D(meters) at distance D
     *   1_PD_Pixel = 10 × D × PPM
     */
    constructor(calibrationData) {
        this.canvas = null;
        this.ctx = null;
        
        // Normalize calibration input: support both old (viewingDistanceCm)
        // and new (viewingDistanceM) formats for backward compatibility.
        const raw = calibrationData || {};
        const ppm = raw.pixelsPerMm || 3.78;
        const distM = raw.viewingDistanceM || (raw.viewingDistanceCm ? raw.viewingDistanceCm / 100 : 4);
        
        this.calibration = {
            pixelsPerMm: ppm,
            viewingDistanceM: distM
        };
        
        this.isRunning = false;
        this._animationFrameId = null;
        
        // ================================================================
        // INTERNAL STATE: Class-level properties for authoritative mode tracking
        // Using 'this.' ensures click handler always reads current state
        // ================================================================
        this.isFarMode = true;   // Default: Far vision mode (6m)
        this._hdValue = null;    // Far phoria (H_d) — Xa
        this._hnValue = null;    // Near phoria (H_n) — Gần
        
        // Layout components
        this.wrapper = null;
        this.sidebar = null;
        
        // Current exam distance in MILLIMETERS (used by UI dropdowns)
        // Default: 6m far vision exam
        this.currentDistance = 6000; // mm (= 6m)
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._buildLayout();
        this._bindEvents();
        
        // Task 3 Fix: Ẩn nút "Lưu Kết Quả" toàn cục của Zone 2 để tránh chồng chéo
        // với nút "LƯU KẾT QUẢ" trong HUD của Maddox Grid
        const globalSaveBtn = document.getElementById('btn-save-result');
        if (globalSaveBtn) {
            globalSaveBtn.style.display = 'none';
        }
        
        // Kích hoạt render lần đầu
        setTimeout(() => { this.resize(); }, 100);

        // Auto-focus ô IPD ngay khi module mở (dùng polling helper an toàn)
        this._startPollingFocus('maddox-ipd', '[MaddoxGrid] Đã auto-focus vào ô IPD', '[MaddoxGrid] Lỗi: Không tìm thấy ô IPD');

        this._renderLoop();
    }

    stop() {
        this.isRunning = false;
        
        // Task 3 Fix: Hiển thị lại nút "Lưu Kết Quả" toàn cục khi đóng Maddox Grid
        const globalSaveBtn = document.getElementById('btn-save-result');
        if (globalSaveBtn) {
            globalSaveBtn.style.display = '';
        }
        
        // Dọn dẹp global key listener
        if (this._globalKeyHandler) {
            window.removeEventListener('keydown', this._globalKeyHandler);
            this._globalKeyHandler = null;
        }
        
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
        window.removeEventListener('resize', this._resizeBound);
        if (this._animationFrameId) {
            cancelAnimationFrame(this._animationFrameId);
            this._animationFrameId = null;
        }
        
        // Quay về màn hình chính (nếu EMR Core cung cấp API)
        if (typeof window.loadTest === 'function') {
            window.loadTest('dashboard');
        }
    }

    resize() {
        if (!this.canvas || !this.wrapper) return;
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    _renderLoop() {
        if (!this.isRunning) return;
        this.render();
        this._animationFrameId = requestAnimationFrame(() => this._renderLoop());
    }

    /**
     * Xây dựng Layout Wrapper với 2 cột: Form/HUD (trái) và Canvas (phải)
     */
    _buildLayout() {
        // 1. Wrapper tràn viền đen tuyệt đối
        this.wrapper = document.createElement('div');
        // z-index: 40 — đủ cao để che nội dung display-board, nhưng thấp hơn sidebar menu
        // để menu có thể trượt lên đè trên nền đen của Maddox khi mở (~).
        this.wrapper.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000000; z-index: 40; overflow: hidden;';
        
        // 2. Canvas trải rộng 100% không gian
        // z-index: 10 — thấp hơn wrapper, pointer-events: auto chỉ trên canvas để bắt click vẽ lưới
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10; pointer-events: auto;';
        this.wrapper.appendChild(this.canvas);
        
        // 3. Nút Đóng (Tối giản)
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕ ĐÓNG (ESC)';
        closeBtn.style.cssText = 'position: absolute; top: 15px; right: 20px; z-index: 10; background: rgba(0, 0, 0, 0.5); color: #7f1d1d; border: 1px solid #450a0a; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;';
        closeBtn.onclick = () => this.stop();
        this.wrapper.appendChild(closeBtn);

        // 4. HUD Thả nổi góc dưới phải (Siêu tối)
        this.sidebar = document.createElement('div');
        this.sidebar.style.cssText = 'position: absolute; bottom: 20px; right: 20px; width: 250px; padding: 12px; background: rgba(5, 5, 5, 0.85); border: 1px solid #1f2937; border-radius: 8px; display: flex; flex-direction: column; gap: 8px; z-index: 10; backdrop-filter: blur(2px); box-shadow: 0 4px 12px rgba(0,0,0,0.8);';
        
        this.sidebar.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f2937; padding-bottom: 6px;">
                <h2 style="color: #4b5563; font-size: 12px; margin: 0; letter-spacing: 1px;">MADDOX GRID</h2>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label style="font-size: 11px; color: #6b7280;">IPD (mm):</label>
                    <input type="number" id="maddox-ipd" tabindex="1" style="width: 70px; background:#000; color:#9ca3af; border:1px solid #374151; padding:4px; border-radius:4px; font-size:12px; text-align:center;">
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <select id="sel-far-dist" tabindex="2" style="background:#000; color:#3b82f6; border:1px solid #1e3a8a; padding:3px; border-radius:4px; font-size:11px; cursor:pointer; width: 100px;">
                        <option value="600">Xa (6m)</option>
                        <option value="500">Xa (5m)</option>
                        <option value="400">Xa (4m)</option>
                        <option value="300">Xa (3m)</option>
                    </select>
                    <button id="btn-mode-far" tabindex="2" style="background: #1e3a8a; color: #bfdbfe; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px;">Bật Lưới Xa</button>
                </div>
                <input type="number" step="0.5" id="maddox-hd" tabindex="3" placeholder="H_d: Eso (+), Exo (-)" style="background:#000; color:#9ca3af; border:1px solid #374151; padding:5px; border-radius:4px; font-size:12px;">
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <select id="sel-near-dist" tabindex="4" style="background:#000; color:#10b981; border:1px solid #064e3b; padding:3px; border-radius:4px; font-size:11px; cursor:pointer; width: 100px;">
                        <option value="40">Gần (40cm)</option>
                        <option value="30">Gần (30cm)</option>
                        <option value="50">Gần (50cm)</option>
                        <option value="60">Gần (60cm)</option>
                    </select>
                    <button id="btn-mode-near" tabindex="4" style="background: #111827; color: #4b5563; border: 1px solid #1f2937; padding: 3px 7px; border-radius: 4px; cursor: pointer; font-size: 10px;">Bật Lưới Gần</button>
                </div>
                <input type="number" step="0.5" id="maddox-hn" tabindex="5" placeholder="H_n: Eso (+), Exo (-)" style="background:#000; color:#9ca3af; border:1px solid #374151; padding:5px; border-radius:4px; font-size:12px;">
            </div>

            <div style="margin-top: 4px; padding-top: 8px; border-top: 1px solid #1f2937;">
                <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 11px; color: #4b5563;">AC/A: </span>
                    <span id="maddox-aca-result" style="font-size: 14px; color: #10b981; font-weight: bold;">--</span>
                </div>
                <button id="btn-submit-maddox" tabindex="6" style="width: 100%; background: #064e3b; color: #6ee7b7; border: 1px solid #047857; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">LƯU KẾT QUẢ</button>
            </div>
        `;
        
        this.wrapper.appendChild(this.sidebar);
        
        const parent = document.getElementById('display-board') || document.body;
        parent.appendChild(this.wrapper);
        
        this.ctx = this.canvas.getContext('2d');
        this._bindEvents();
        
        setTimeout(() => { this.resize(); }, 100);
    }

    /**
     * TASK 8 FIX: Bulletproof Auto-Focus với Polling Mechanism
     * Lặp truy vấn DOM mỗi 100ms để đảm bảo element tồn tại thật sự rồi mới focus.
     *
     * @param {string} targetId - ID của thẻ input cần focus (maddox-hd hoặc maddox-hn)
     * @param {string} successLog - Message log khi focus thành công
     * @param {string} errorLog - Message log khi timeout không tìm thấy element
     * @private
     */
    _startPollingFocus(targetId, successLog, errorLog) {
        let attempts = 0;
        const maxAttempts = 10; // Timeout sau 1 giây (10 * 100ms)
        const pollInterval = 100;

        const tryFocus = setInterval(() => {
            const targetInput = document.getElementById(targetId);

            if (targetInput) {
                clearInterval(tryFocus);
                window.requestAnimationFrame(() => {
                    targetInput.focus();
                });
            }

            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(tryFocus);
                console.error(errorLog);
            }
        }, pollInterval);
    }

    /**
     * Quản lý sự kiện: click canvas, chuyển mode, submit form
     */
    _bindEvents() {
        // KEYBOARD ISOLATION (Task 2 Fix):
        // Chỉ chặn stopPropagation cho các phím INPUT thực sự trong sidebar
        // (Tab navigation, Enter submit, số nhập IPD/Hd/Hn).
        // KHÔNG chặn các phím hệ thống: ~, ESC, H, P, R, Tab (để UniversalInput xử lý).
        this.sidebar.addEventListener('keydown', (e) => {
            const systemKeys = ['Escape', '~', '`', 'Tab', 'Home', 'ContextMenu', 'h', 'H', 'p', 'P', 'r', 'R'];
            if (systemKeys.includes(e.key)) {
                // Không gọi stopPropagation — để sự kiện lọt lên UniversalInput
                return;
            }
            // Chỉ ngăn input field keys (số, enter, arrow) lọt ra ngoài
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                e.stopPropagation();
            }
        });
        
        // Phím tắt toàn cục (chỉ ESC)
        this._globalKeyHandler = (e) => {
            // Bỏ qua các event do code tự phát ra (tránh lặp vô hạn)
            if (!e.isTrusted) return;

            if (e.key === 'Escape' && this.isRunning) {
                this.stop();
            }
            // KHÔNG xử lý Tab ở đây — để UniversalInput (controller.js) quản lý
        };
        window.addEventListener('keydown', this._globalKeyHandler);
        
        // Xử lý Click trên Canvas để ghi nhận độ lác
        // SỬ DỤNG this.isFarMode (class-level) thay vì local closure variable
        // để đảm bảo click handler luôn đọc trạng thái MỚI NHẤT
        this._clickHandler = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            const cx = this.canvas.width / 2;
            
            // ================================================================
            // OPTICAL FORMULA (Audit Fix 2026-08-17):
            // 1 PD = 10mm × D(meters) at distance D
            // Pixel conversion: 1_PD_Pixel = 10 × D × PPM
            //
            // this.currentDistance is stored in MILLIMETERS.
            // distMeters = currentDistance / 1000
            // 1_PD_Pixel = 10 × (currentDistance/1000) × PPM
            //            = (currentDistance/100) × PPM
            // ================================================================
            const distMeters = this.currentDistance / 1000;
            const ppm = this.calibration.pixelsPerMm || 3.78;
            const pixelsPerPrism = 10 * distMeters * ppm;
            
            const dx = clickX - cx;
            // Nội suy (Quy ước: Lệch phải -> Đó là Eso (+), Mắt Phải đặt Maddox)
            const prismValue = Math.round((dx / pixelsPerPrism) * 2) / 2;
            
            // RẼ NHÁNH RÕ RÀNG: Sử dụng class-level this.isFarMode
            if (this.isFarMode) {
                // CHỈ xử lý cho Lưới Xa — KHÔNG ảnh hưởng H_n
                const hdInput = document.getElementById('maddox-hd');
                if (hdInput) hdInput.value = prismValue;
                this._hdValue = prismValue;
            } else {
                // CHỈ xử lý cho Lưới Gần — KHÔNG ảnh hưởng H_d
                const hnInput = document.getElementById('maddox-hn');
                if (hnInput) hnInput.value = prismValue;
                this._hnValue = prismValue;
            }
            this._showClickFeedback(clickX, clickY, prismValue);
        };
        this.canvas.addEventListener('click', this._clickHandler);
        
        // Bind resize handler để remove later
        this._resizeBound = this.resize.bind(this);
        window.addEventListener('resize', this._resizeBound);

        // Nút chuyển chế độ Xa — cập nhật class-level this.isFarMode
        document.getElementById('btn-mode-far').onclick = () => {
            this.isFarMode = true;
            // Dropdown value is in cm (600 = 6m), convert to mm internally
            this.currentDistance = parseInt(document.getElementById('sel-far-dist').value) * 10;
            
            const btnFar = document.getElementById('btn-mode-far');
            btnFar.style.background = '#1e3a8a'; btnFar.style.color = '#bfdbfe'; btnFar.style.border = 'none';
            
            const btnNear = document.getElementById('btn-mode-near');
            btnNear.style.background = '#111827'; btnNear.style.color = '#4b5563'; btnNear.style.border = '1px solid #1f2937';
            
            this.render();
            
            // TASK 8 FIX: Bulletproof Auto-Focus với Polling Mechanism
            // Thay vì setTimeout mù quáng, polling kiểm tra DOM tồn tại thật sự rồi mới focus
            this._startPollingFocus('maddox-hd', '[MaddoxGrid] Đã ép focus thành công vào ô H_d (Xa)', '[MaddoxGrid] LỖI: Không tìm thấy ID maddox-hd để focus!');
        };
        
        // Nút chuyển chế độ Gần — cập nhật class-level this.isFarMode
        document.getElementById('btn-mode-near').onclick = () => {
            this.isFarMode = false;
            // Dropdown value is in cm (40 = 40cm), convert to mm internally
            this.currentDistance = parseInt(document.getElementById('sel-near-dist').value) * 10;
            
            const btnNear = document.getElementById('btn-mode-near');
            btnNear.style.background = '#064e3b'; btnNear.style.color = '#a7f3d0'; btnNear.style.border = 'none';
            
            const btnFar = document.getElementById('btn-mode-far');
            btnFar.style.background = '#111827'; btnFar.style.color = '#4b5563'; btnFar.style.border = '1px solid #1f2937';
            
            this.render();
            
            // TASK 8 FIX: Bulletproof Auto-Focus với Polling Mechanism
            this._startPollingFocus('maddox-hn', '[MaddoxGrid] Đã ép focus thành công vào ô H_n (Gần)', '[MaddoxGrid] LỖI: Không tìm thấy ID maddox-hn để focus!');
        };
        
        // TASK 5 FIX: Đảm bảo nút "Bật Lưới Xa" và "Bật Lưới Gần" nhận phím Enter
        // e.preventDefault() ngăn trình duyệt giữ focus ở nút bấm sau khi click
        document.getElementById('btn-mode-far').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Khóa hành vi mặc định —防止 focus giật lại nút
                e.target.click();
            }
        });
        document.getElementById('btn-mode-near').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Khóa hành vi mặc định —防止 focus giật lại nút
                e.target.click();
            }
        });
        
        // Auto-update khi đổi select box
        document.getElementById('sel-far-dist').onchange = () => { if(isFarMode) document.getElementById('btn-mode-far').click(); };
        document.getElementById('sel-near-dist').onchange = () => { if(!isFarMode) document.getElementById('btn-mode-near').click(); };

        // ================================================================
        // TASK: ISOLATE H_d AND H_n INPUT FIELDS
        // Attach independent input listeners to prevent cross-contamination.
        // Each field updates ONLY its own internal state — no shared refs.
        // ================================================================
        const hdInput = document.getElementById('maddox-hd');
        const hnInput = document.getElementById('maddox-hn');

        // H_d (Xa/Far) — chỉ cập nhật state cho H_d
        if (hdInput) {
            hdInput.addEventListener('input', (e) => {
                // Chỉ cho phép số hợp lệ, loại bỏ ký tự lạ
                let val = e.target.value;
                // Cho phép dấu trừ, dấu thập phân, số
                if (!/^[-+]?[0-9]*\.?[0-9]*$/.test(val)) {
                    e.target.value = val.replace(/[^0-9.\-+]/g, '');
                }
                // State nội bộ riêng cho H_d
                this._hdValue = parseFloat(e.target.value) || null;
            });
        }

        // H_n (Gần/Near) — chỉ cập nhật state cho H_n, ĐỘC LẬP với H_d
        if (hnInput) {
            hnInput.addEventListener('input', (e) => {
                // Chỉ cho phép số hợp lệ, loại bỏ ký tự lạ
                let val = e.target.value;
                // Cho phép dấu trừ, dấu thập phân, số
                if (!/^[-+]?[0-9]*\.?[0-9]*$/.test(val)) {
                    e.target.value = val.replace(/[^0-9.\-+]/g, '');
                }
                // State nội bộ riêng cho H_n — TÁCH BIỆT hoàn toàn với H_d
                this._hnValue = parseFloat(e.target.value) || null;
            });
        }

        // Nút Lưu và Tính toán AC/A
        // SỬ DỤNG internal state (this._hdValue, this._hnValue) làm nguồn chính
        // để đảm bảo H_d và H_n hoạt động ĐỘC LẬP, không bị cross-contamination
        document.getElementById('btn-submit-maddox').onclick = () => {
            const ipd_mm = parseFloat(document.getElementById('maddox-ipd').value);
            
            // Ưu tiên internal state, fallback về DOM value nếu chưa có
            const hd = this._hdValue !== undefined ? this._hdValue : parseFloat(document.getElementById('maddox-hd').value);
            const hn = this._hnValue !== undefined ? this._hnValue : parseFloat(document.getElementById('maddox-hn').value);
            
            // Dropdown values: far = meters × 100 (600 = 6m), near = cm (40 = 40cm)
            const farDistMeters = parseInt(document.getElementById('sel-far-dist').value) / 100;
            const nearDistMeters = parseInt(document.getElementById('sel-near-dist').value) / 100;
            
            if (!ipd_mm || isNaN(hd) || isNaN(hn)) {
                alert("Vui lòng nhập đủ IPD, H_d và H_n");
                return;
            }
            
            // Accommodation demand in Diopters: D = 1/distance(m)
            const dFar = 1 / farDistMeters;
            const dNear = 1 / nearDistMeters;
            const deltaD = dNear - dFar;
            
            if (deltaD === 0) {
                alert("Khoảng cách xa và gần không được trùng nhau");
                return;
            }
            
            // AC/A Ratio formula:
            // AC/A = IPD(cm) + (Near Phoria - Far Phoria) / ΔDiopter
            const ipd_cm = ipd_mm / 10;
            const aca = ipd_cm + ((hn - hd) / deltaD);
            const acaRounded = Math.round(aca * 10) / 10;
            
            document.getElementById('maddox-aca-result').innerText = `${acaRounded} Δ/D`;
            
            // Phát sự kiện lưu tương thích EMR Core (Omni-Payload)
            // Lưu khoảng cách chuẩn hóa: farDistM (mét), nearDistCm (cm)
            const farDistCm = farDistMeters * 100;
            const nearDistCm = nearDistMeters * 100;
            
            const eventData = {
                testId: 'maddox-grid',
                id: 'maddox-grid',
                name: 'AC/A (via Maddox Heterophoria)',
                gameName: 'AC/A (via Maddox Heterophoria)',
                result: `AC/A: ${acaRounded} Δ/D`,
                clinical_metrics: {
                    acaRatio: acaRounded,
                    ipd: ipd_mm,
                    phoriaDist: hd,
                    phoriaNear: hn,
                    farDistM: farDistMeters,
                    nearDistM: nearDistMeters,
                    farDistCm: farDistCm,
                    nearDistCm: nearDistCm
                },
                testName: 'AC/A (via Maddox Heterophoria)',
                results: {
                    phoriaDist: hd,
                    phoriaNear: hn,
                    acaRatio: acaRounded,
                    ipd: ipd_mm,
                    farDistM: farDistMeters,
                    nearDistM: nearDistMeters,
                    farDistCm,
                    nearDistCm
                }
            };
            
            // Dispatch cả window và document để tương thích chéo EMR
            window.dispatchEvent(new CustomEvent('visionTestCompleted', { detail: eventData }));
            document.dispatchEvent(new CustomEvent('visionTestCompleted', { detail: eventData }));
            
            // Phản hồi UI
            const btn = document.getElementById('btn-submit-maddox');
            btn.innerHTML = 'ĐÃ LƯU KẾT QUẢ ✓';
            btn.style.background = '#059669';
            setTimeout(() => { btn.innerHTML = 'TÍNH AC/A & LƯU'; btn.style.background = '#10b981'; }, 2000);
        };
    }

    /**
     * Vẽ điểm sáng trung tâm và lưới tọa độ lăng kính
     */
    render() {
        if (!this.ctx || !this.canvas?.width) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        // Nền đen tuyệt đối để điểm sáng nổi bật
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);

        // ================================================================
        // OPTICAL FORMULA (Audit Fix 2026-08-17):
        // 1 Prism Diopter (PD) = Lệch 10mm ở khoảng cách 1 mét
        // Tại khoảng cách D mét: 1 PD = 10 × D (mm)
        // Quy đổi sang pixel màn hình: 1_PD_Pixel = 10 × D × PPM
        //
        // this.currentDistance lưu trong MILLIMETERS
        // distMeters = currentDistance / 1000
        // 1_PD_Pixel = 10 × (currentDistance/1000) × PPM
        // ================================================================
        const distMeters = this.currentDistance / 1000;
        const ppm = this.calibration.pixelsPerMm || 3.78;
        const pixelsPerPrism = 10 * distMeters * ppm;

        // Vẽ lưới và số (Màu đỏ sẫm để không lóa)
        ctx.strokeStyle = '#ef4444';
        ctx.fillStyle = '#ef4444';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 1;

        // Trục X (Đo lác ngang) & Trục Y (Đo lác đứng)
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(w, cy);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, h);
        ctx.stroke();

        // Vạch chia độ (Tick marks) — mỗi vạch = 1 PD
        const maxPrismsX = Math.floor(cx / pixelsPerPrism);
        const maxPrismsY = Math.floor(cy / pixelsPerPrism);
        const maxPrisms = Math.max(maxPrismsX, maxPrismsY);

        for (let i = 1; i <= maxPrisms; i++) {
            const offset = i * pixelsPerPrism;

            // Vạch trục X
            if (i <= maxPrismsX) {
                ctx.beginPath();
                ctx.moveTo(cx + offset, cy - 10);
                ctx.lineTo(cx + offset, cy + 10);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(cx - offset, cy - 10);
                ctx.lineTo(cx - offset, cy + 10);
                ctx.stroke();

                // Chỉ in số chẵn để chống rối mắt
                if (i % 2 === 0) {
                    ctx.fillText(i.toString(), cx + offset, cy + 25);
                    ctx.fillText(i.toString(), cx - offset, cy + 25);
                }
            }

            // Vạch trục Y
            if (i <= maxPrismsY) {
                ctx.beginPath();
                ctx.moveTo(cx - 10, cy + offset);
                ctx.lineTo(cx + 10, cy + offset);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(cx - 10, cy - offset);
                ctx.lineTo(cx + 10, cy - offset);
                ctx.stroke();

                if (i % 2 === 0) {
                    ctx.fillText(i.toString(), cx + 25, cy + offset);
                    ctx.fillText(i.toString(), cx + 25, cy - offset);
                }
            }
        }

        // Hiển thị khoảng cách hiện tại (tính từ mm sang m)
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 14px Arial';
        const distDisplayM = Math.round(distMeters * 10) / 10;
        const distanceLabel = distMeters >= 1 ? `NHÌN XA (${distDisplayM}m)` : `NHÌN GẦN (${Math.round(distMeters * 100)}cm)`;
        ctx.fillText(distanceLabel, cx, 20);

        // Vẽ nguồn sáng trung tâm (Kích thước động theo khoảng cách khám)
        const isFar = distMeters >= 1; // Nội suy: Xa (>=1m) vs Gần (<1m)
        const outerRadius = isFar ? 11 : 6;
        const innerRadius = isFar ? 5 : 2;
        const blurAmount = isFar ? 30 : 12;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = blurAmount;
        ctx.fill();
        
        // Bồi thêm lớp lõi tâm điểm
        ctx.beginPath();
        ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
    }

    /**
     * Hiển thị visual feedback tại điểm click
     */
    _showClickFeedback(x, y, value) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = '#4ade80'; // Xanh lá báo thành công
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`${value > 0 ? '+' : ''}${value} Δ`, x, y - 15);
        ctx.restore();
        
        // Xóa feedback sau 1 giây bằng cách render lại grid
        setTimeout(() => {
            if (this.isRunning) this.render();
        }, 1000);
    }

    /**
     * Cập nhật dữ liệu hiệu chuẩn động
     */
    updateCalibration(calibrationData) {
        this.calibration = { ...this.calibration, ...calibrationData };
    }
}

// ES Module named export (for import { MaddoxGridModule } from '...')
export { MaddoxGridModule };

// Fallback for non-ESM environments
if (typeof window !== 'undefined') {
    window.MaddoxGridModule = MaddoxGridModule;
}
