/**
 * schober_test.js — Schober Test for Heterophoria (Latent Strabismus)
 *
 * Thuật toán: Nền Trắng - Trừ Màu (Subtractive Color)
 * - Nền: Trắng (#FFFFFF) để tương thích màn hình phổ thông.
 * - Cô lập thị giác: Ẩn TOÀN BỘ giao diện (HUD, Menu) khi test.
 * - Kính Đỏ (Mắt Phải) nhìn mục tiêu Lục lam (#66FFFF).
 * - Kính Xanh (Mắt Trái) nhìn mục tiêu Đỏ (#FF6666).
 *
 * Tính toán Lăng kính (Prism Diopter):
 * Δ = Displacement (cm) / Distance (m)
 *
 * Module id = 'schober-heterophoria'
 */

// ================================================================
//  Constants
// ================================================================

const TARGET_RIGHT_EYE = '#66FFFF'; // Cyan (Mắt phải đeo kính Đỏ nhìn)
const TARGET_LEFT_EYE = '#FF6666';  // Red (Mắt trái đeo kính Xanh nhìn)
const BG_COLOR = '#FFFFFF';

const CROSSHAIR_SIZE = 30;
const MOVEMENT_STEP = 1; // Độ phân giải dịch chuyển (1px)

// ================================================================
//  Schober Test Module
// ================================================================

const schoberTest = {
  id: 'schober-heterophoria',
  label: 'Schober Test (Độ lác ẩn)',
  customControls: true,
  steps: ['test'],

  _canvas: null,
  _ctx: null,

  _offsetX: 0,
  _offsetY: 0,
  _centerX: 0,
  _centerY: 0,
  _canvasWidth: 0,
  _canvasHeight: 0,

  _isLocked: false,
  _isInverted: false, // false: Mắt Trái định thị. true: Mắt Phải định thị.
  _testActive: false, // Trạng thái Ẩn HUD để đo lường

  _boundKeydown: null,
  _boundResize: null,

  _initDOM() {
    const board = document.getElementById('display-board');
    board.innerHTML = '';
    board.style.backgroundColor = BG_COLOR;
    board.style.position = 'relative';
    board.style.overflow = 'hidden';

    // --- KHU VỰC THỊ GIÁC (CANVAS Wrapper) ---
    const canvasContainer = document.createElement('div');
    canvasContainer.id = 'schober-canvas-container';
    canvasContainer.style.cssText = `
      position: absolute; top: 0; left: 0; right: 340px; bottom: 0;
      background: ${BG_COLOR}; transition: right 0.2s ease-in-out;
    `;

    this._canvas = document.createElement('canvas');
    this._canvas.id = 'schober-canvas';
    this._canvas.style.cssText = 'display: block; width: 100%; height: 100%;';
    canvasContainer.appendChild(this._canvas);
    board.appendChild(canvasContainer);

    this._ctx = this._canvas.getContext('2d');

    // --- KHU VỰC ĐIỀU KHIỂN (SIDEBAR HUD) ---
    const cal = window.__calibrator;
    const distanceM = (cal && cal.distanceM > 0) ? cal.distanceM : 3.0;

    const sidebar = document.createElement('div');
    sidebar.id = 'schober-sidebar';
    sidebar.style.cssText = `
      position: absolute; top: 0; right: 0; width: 340px; height: 100%;
      box-sizing: border-box; background: rgba(255,255,255,0.98);
      border-left: 1px solid #ddd; box-shadow: -4px 0 15px rgba(0,0,0,0.05);
      padding: 20px; font-family: sans-serif; color: #333;
      display: flex; flex-direction: column; z-index: 10; overflow-y: auto;
    `;

    sidebar.innerHTML = `
      <div style="border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 15px;">
        <div style="font-size: 15px; font-weight: 900; color: #2c3e50; margin-bottom: 4px; text-transform: uppercase;">Schober Test (Lác Ẩn)</div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 12px; color: #c0392b; font-weight: bold;">[BẮT BUỘC]: ĐỎ MẮT PHẢI - XANH MẮT TRÁI</div>
          <div style="font-size: 13px; color: #555; font-weight: 600; background: #f1f2f6; padding: 4px 8px; border-radius: 4px;">
            K/cách: <strong>${distanceM}m</strong>
          </div>
        </div>
      </div>

      <div style="flex-grow: 1;">
        <!-- TỔNG QUAN LÂM SÀNG -->
        <div style="font-size: 12px; color: #444; line-height: 1.5; margin-bottom: 15px; padding: 12px; background: #fdfbf7; border-radius: 6px; border: 1px solid #f3e5ab; border-left: 4px solid #f1c40f;">
          <strong style="color: #d35400;">HƯỚNG DẪN KỸ THUẬT VIÊN:</strong><br>
          <strong>1.</strong> Đảm bảo môi trường tối, mắt bệnh nhân ngang tầm trung tâm màn hình.<br>
          <strong>2.</strong> Bấm <strong style="color: #2980b9;">Bắt Đầu Test</strong> để ẩn toàn bộ giao diện (tránh định thị ngoại vi).<br>
          <strong>3.</strong> Yêu cầu bệnh nhân dùng phím Mũi tên (hoặc báo kỹ thuật viên bấm) để di chuyển <strong>Chữ thập vào chính giữa Vòng tròn</strong>.<br>
          <strong>4.</strong> Bấm <strong style="color: #2980b9;">[Space]</strong> để đảo mắt định thị (phát hiện lác liệt/ức chế). Bấm <strong style="color: #2980b9;">[Enter]</strong> để chốt kết quả.
        </div>

        <button id="btn-start-test" style="
          width: 100%; padding: 12px; border: none; background: #e74c3c; color: white;
          border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;
          margin-bottom: 15px; box-shadow: 0 4px 6px rgba(231, 76, 60, 0.2); transition: background 0.2s;
        ">👁️ Bắt Đầu Test (Ẩn Giao Diện)</button>

        <div style="font-size: 13px; font-weight: bold; color: #555; margin-bottom: 8px;">KẾT QUẢ ĐO LƯỜNG (Δ):</div>
        
        <!-- TRẠNG THÁI MẮT -->
        <div style="margin-bottom: 10px; padding: 10px; background: #e8f4f8; border-radius: 6px; border: 1px solid #bce0fd;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px;">
            <span style="color: #555;">Mắt định thị (Vòng tròn):</span>
            <strong id="schober-fixing-eye" style="color: #2980b9;">MẮT TRÁI</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px;">
            <span style="color: #555;">Mắt đo lác (Chữ thập):</span>
            <strong id="schober-deviating-eye" style="color: #c0392b;">MẮT PHẢI</strong>
          </div>
        </div>

        <div style="margin-bottom: 10px; padding: 12px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #3498db;">
          <div style="font-size: 11px; color: #7f8c8d; font-weight: bold; margin-bottom: 4px;">ĐỘ LỆCH NGANG (HORIZONTAL)</div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span id="schober-prism-h" style="font-size: 20px; font-weight: bold; color: #2c3e50;">0.00Δ</span>
            <span id="schober-dir-h" style="font-size: 13px; font-weight: bold; color: #3498db;">Chính thị</span>
          </div>
        </div>
        
        <div style="margin-bottom: 10px; padding: 12px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #e67e22;">
          <div style="font-size: 11px; color: #7f8c8d; font-weight: bold; margin-bottom: 4px;">ĐỘ LỆCH ĐỨNG (VERTICAL)</div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span id="schober-prism-v" style="font-size: 20px; font-weight: bold; color: #2c3e50;">0.00Δ</span>
            <span id="schober-dir-v" style="font-size: 13px; font-weight: bold; color: #e67e22;">Chính thị</span>
          </div>
        </div>
      </div>

      <button id="btn-toggle-inv" style="
        width: 100%; padding: 10px; font-size: 13px; font-weight: bold; margin-top: 5px;
        background: #f1f2f6; color: #2c3e50; border: 1px solid #ccc; border-radius: 6px; cursor: pointer;
      ">[Space] Đảo Mắt Định Thị</button>

      <button id="btn-lock-res" style="
        width: 100%; padding: 12px; font-size: 14px; font-weight: bold;
        background: #0056b3; color: white; border: none; border-radius: 6px;
        cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 10px;
      ">Lưu & Gửi Kết Quả</button>

      <button id="schober-reset-btn" style="
        width: 100%; padding: 10px; font-size: 13px; font-weight: 600;
        background: transparent; color: #666; border: 1px solid #ccc; border-radius: 6px;
        cursor: pointer; margin-top: 10px; display: none;
      ">Đặt lại tọa độ</button>
    `;

    board.appendChild(sidebar);

    document.getElementById('btn-start-test').addEventListener('click', () => this._startTest());
    document.getElementById('btn-lock-res').addEventListener('click', () => this._lockResult());
    document.getElementById('schober-reset-btn').addEventListener('click', () => this._resetTest());
    document.getElementById('btn-toggle-inv').addEventListener('click', () => { 
      this._isInverted = !this._isInverted; 
      this._draw(); 
    });

    this._resizeCanvas();
    window.addEventListener('resize', this._boundResize);
  },

  /**
   * Bắt đầu Test: Ẩn HUD và Menu toàn cục
   * @private
   */
  _startTest() {
    this._testActive = true;
    this._isLocked = false;

    const sidebar = document.getElementById('schober-sidebar');
    const container = document.getElementById('schober-canvas-container');
    if (sidebar) sidebar.style.display = 'none';
    if (container) container.style.right = '0';

    const globalUI = document.querySelectorAll('#menu-btn, .menu, .nav, header');
    globalUI.forEach(el => {
      if (el.style) {
        el.dataset.oldDisplay = el.style.display;
        el.style.display = 'none';
      }
    });

    if (container) container.style.cursor = 'none';
    this._resizeCanvas();
  },

  /**
   * Kết thúc Test: Khôi phục HUD và Menu
   * @private
   */
  _endTest(saveResult = false) {
    this._testActive = false;

    const sidebar = document.getElementById('schober-sidebar');
    const container = document.getElementById('schober-canvas-container');
    if (sidebar) sidebar.style.display = 'flex';
    if (container) {
      container.style.right = '340px';
      container.style.cursor = 'default';
    }

    const globalUI = document.querySelectorAll('#menu-btn, .menu, .nav, header');
    globalUI.forEach(el => {
      if (el.style && el.dataset.oldDisplay !== undefined) {
        el.style.display = el.dataset.oldDisplay;
      }
    });

    this._resizeCanvas();
    if (saveResult) this._lockResult();
    else this._updateHUD();
  },

  _resizeCanvas() {
    const container = document.getElementById('schober-canvas-container');
    if (!container || !this._canvas) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this._canvas.width = rect.width * dpr;
    this._canvas.height = rect.height * dpr;
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this._canvasWidth = rect.width;
    this._canvasHeight = rect.height;
    this._centerX = rect.width / 2;
    this._centerY = rect.height / 2;

    this._draw();
  },

  _draw() {
    if (!this._ctx) return;

    const ctx = this._ctx;
    const cx = this._centerX;
    const cy = this._centerY;

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, this._canvasWidth, this._canvasHeight);

    // Kích hoạt Subtractive Blending (Trừ màu)
    ctx.globalCompositeOperation = 'multiply';

    // Nếu _isInverted = false: Mắt Trái nhìn vòng tròn (Màu Đỏ -> Kính Xanh chặn -> Trái thấy)
    // Nếu _isInverted = true: Mắt Phải nhìn vòng tròn (Màu Cyan -> Kính Đỏ chặn -> Phải thấy)
    ctx.strokeStyle = this._isInverted ? TARGET_RIGHT_EYE : TARGET_LEFT_EYE;
    ctx.lineWidth = 4;
    const outerR = Math.min(cx, cy) * 0.4;
    const innerR = Math.min(cx, cy) * 0.2;
    
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.stroke();

    // Chữ thập dành cho Mắt đo lác
    const crossX = cx + this._offsetX;
    const crossY = cy + this._offsetY;
    
    ctx.strokeStyle = this._isInverted ? TARGET_LEFT_EYE : TARGET_RIGHT_EYE;
    ctx.lineWidth = 4;
    
    ctx.beginPath();
    ctx.moveTo(crossX - CROSSHAIR_SIZE, crossY);
    ctx.lineTo(crossX + CROSSHAIR_SIZE, crossY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(crossX, crossY - CROSSHAIR_SIZE);
    ctx.lineTo(crossX, crossY + CROSSHAIR_SIZE);
    ctx.stroke();

    ctx.globalCompositeOperation = 'source-over';

    if (!this._testActive) this._updateHUD();
  },

  _updateHUD() {
    const prismH = this._calcPrismDiopter(this._offsetX);
    const prismV = this._calcPrismDiopter(this._offsetY);

    const elFixEye = document.getElementById('schober-fixing-eye');
    const elDevEye = document.getElementById('schober-deviating-eye');
    
    const elPrismH = document.getElementById('schober-prism-h');
    const elDirH = document.getElementById('schober-dir-h');
    const elPrismV = document.getElementById('schober-prism-v');
    const elDirV = document.getElementById('schober-dir-v');

    if (elFixEye) elFixEye.textContent = this._isInverted ? 'MẮT PHẢI' : 'MẮT TRÁI';
    if (elDevEye) elDevEye.textContent = this._isInverted ? 'MẮT TRÁI' : 'MẮT PHẢI';

    if (elPrismH) elPrismH.textContent = `${Math.abs(prismH).toFixed(2)}Δ`;
    if (elPrismV) elPrismV.textContent = `${Math.abs(prismV).toFixed(2)}Δ`;

    // Phân tích Không gian (Projection Law)
    const devEyeName = this._isInverted ? "Mắt Trái" : "Mắt Phải";

    if (elDirH) {
      if (Math.abs(prismH) < 0.1) {
        elDirH.textContent = "Chính thị";
        elDirH.style.color = "#27ae60";
      } else {
        // Nếu Chữ thập (ảnh) bị lệch hướng nào, nhãn cầu đang lác hướng ngược lại.
        // Bệnh nhân di chuyển chữ thập (+) theo trục X (về bên phải) -> Nhãn cầu lác ngoài.
        const isExo = (this._offsetX > 0 && !this._isInverted) || (this._offsetX < 0 && this._isInverted);
        elDirH.textContent = isExo ? `${devEyeName}: Lác Ngoài (Exo)` : `${devEyeName}: Lác Trong (Eso)`;
        elDirH.style.color = isExo ? "#3498db" : "#c0392b";
      }
    }

    if (elDirV) {
      if (Math.abs(prismV) < 0.1) {
        elDirV.textContent = "Chính thị";
        elDirV.style.color = "#27ae60";
      } else {
        // Tọa độ Y Canvas: đi xuống (+)
        // Bệnh nhân đẩy chữ thập lên trên (-) -> Nhãn cầu thực tế lác lên trên (Hyper).
        const isHyper = this._offsetY < 0; 
        elDirV.textContent = isHyper ? `${devEyeName}: Lác Lên (Hyper)` : `${devEyeName}: Lác Xuống (Hypo)`;
        elDirV.style.color = isHyper ? "#8e44ad" : "#e67e22";
      }
    }
  },

  _calcPrismDiopter(pixelOffset) {
    const cal = window.__calibrator;
    if (!cal || cal.pxPerMm <= 0) return 0;
    
    const distanceM = cal.distanceM > 0 ? cal.distanceM : 3.0; 
    const offsetMm = pixelOffset / cal.pxPerMm;
    const offsetCm = offsetMm / 10.0;
    return offsetCm / distanceM; 
  },

  _lockResult() {
    if (this._isLocked) return;
    this._isLocked = true;

    const btnLock = document.getElementById('btn-lock-res');
    const btnReset = document.getElementById('schober-reset-btn');
    const btnStart = document.getElementById('btn-start-test');

    if (btnLock) {
      btnLock.textContent = 'Đã Lưu & Gửi Kết Quả';
      btnLock.style.background = '#27ae60';
      btnLock.style.cursor = 'default';
    }
    if (btnReset) btnReset.style.display = 'block';
    if (btnStart) btnStart.style.display = 'none';

    const prismH = this._calcPrismDiopter(this._offsetX);
    const prismV = this._calcPrismDiopter(this._offsetY);

    const devEyeName = this._isInverted ? "OS" : "OD";

    const payload = {
      test_type: 'Schober_Heterophoria',
      fixing_eye: this._isInverted ? 'OD' : 'OS',
      deviating_eye: devEyeName,
      clinical_metrics: {
        horizontal_prism: parseFloat(prismH.toFixed(2)),
        vertical_prism: parseFloat(prismV.toFixed(2)),
      }
    };

    const event = new CustomEvent('visionTestCompleted', { detail: payload, bubbles: true });
    document.dispatchEvent(event);
  },

  _resetTest() {
    this._offsetX = 0;
    this._offsetY = 0;
    this._isLocked = false;
    this._testActive = false;
    
    const btnLock = document.getElementById('btn-lock-res');
    const btnReset = document.getElementById('schober-reset-btn');
    const btnStart = document.getElementById('btn-start-test');

    if (btnLock) {
      btnLock.textContent = 'Lưu & Gửi Kết Quả';
      btnLock.style.background = '#0056b3';
      btnLock.style.cursor = 'pointer';
    }
    if (btnReset) btnReset.style.display = 'none';
    if (btnStart) btnStart.style.display = 'block';

    this._draw();
  },

  _showCalibrationWarning() {
    const board = document.getElementById('display-board');
    board.innerHTML = `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f8f9fa;">
        <div style="text-align: center; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); max-width: 500px;">
          <h2 style="color: #d32f2f; margin-bottom: 15px;">⚠️ Yêu Cầu Hiệu Chuẩn</h2>
          <p style="color: #555; line-height: 1.6;">Module Schober yêu cầu đo lường kích thước pixel (PPD) và khoảng cách khám để tính toán chính xác Lăng kính (Prism Diopters).</p>
        </div>
      </div>
    `;
  },

  _onKeydown(e) {
    if (this._isLocked && e.key !== 'Escape') return;

    if (this._testActive) {
      let updated = false;
      switch (e.key) {
        case 'ArrowUp': e.preventDefault(); this._offsetY -= MOVEMENT_STEP; updated = true; break;
        case 'ArrowDown': e.preventDefault(); this._offsetY += MOVEMENT_STEP; updated = true; break;
        case 'ArrowLeft': e.preventDefault(); this._offsetX -= MOVEMENT_STEP; updated = true; break;
        case 'ArrowRight': e.preventDefault(); this._offsetX += MOVEMENT_STEP; updated = true; break;
        case ' ': 
          e.preventDefault(); 
          this._isInverted = !this._isInverted; 
          updated = true; 
          break;
        case 'Enter': 
          e.preventDefault(); 
          this._endTest(true); 
          return;
        case 'Escape': 
          e.preventDefault(); 
          this._endTest(false); 
          return;
      }
      if (updated) this._draw();
    } else {
      if (e.key === ' ') {
        e.preventDefault();
        this._isInverted = !this._isInverted;
        this._draw();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this._startTest();
      }
    }
  },

  render(idx) {
    const cal = window.__calibrator;
    if (!cal || cal.pxPerMm <= 0) {
      this._showCalibrationWarning();
      return;
    }

    this._boundResize = this._resizeCanvas.bind(this);
    this._boundKeydown = this._onKeydown.bind(this);

    this._initDOM();
    document.addEventListener('keydown', this._boundKeydown);
  },

  cleanup() {
    if (this._testActive) {
      const globalUI = document.querySelectorAll('#menu-btn, .menu, .nav, header');
      globalUI.forEach(el => {
        if (el.style && el.dataset.oldDisplay !== undefined) {
          el.style.display = el.dataset.oldDisplay;
        }
      });
    }

    if (this._boundKeydown) document.removeEventListener('keydown', this._boundKeydown);
    if (this._boundResize) window.removeEventListener('resize', this._boundResize);
    
    this._boundKeydown = null;
    this._boundResize = null;
    this._canvas = null;
    this._ctx = null;
    
    const board = document.getElementById('display-board');
    if (board) {
      board.innerHTML = '';
      board.style.backgroundColor = '';
      board.style.cursor = 'default';
    }
  },
};

export default schoberTest;