/**
 * dynamic_vergence.js — Dynamic Fusional Vergence Test (Anaglyph)
 *
 * Thuật toán: Nền Trắng - Trừ Màu (Subtractive Color)
 * - Nền: Trắng (#FFFFFF)
 * - Kính Đỏ (Mắt Phải) nhìn mục tiêu Lục lam (#66FFFF)
 * - Kính Xanh (Mắt Trái) nhìn mục tiêu Đỏ (#FF6666)
 * - CSS mix-blend-mode: multiply tạo Khóa dung hợp (#666666) khi 2 kênh đè lên nhau.
 *
 * Toán học Lăng kính chuẩn:
 * 1Δ = độ lệch 1 cm ở khoảng cách 1 mét.
 * Độ lệch vật lý (mm) = Prism * 10 * Distance (m).
 *
 * Module id = 'dynamic-vergence'
 */

// ================================================================
//  Constants
// ================================================================

/**
 * Dynamic color getters for anaglyph tests.
 * Uses window.__anaglyphColors if available, falls back to clinical defaults.
 */
function getDynamicVergenceRightEyeColor() {
    return (window.__anaglyphColors?.cyan || '#4DFFFF');
}

function getDynamicVergenceLeftEyeColor() {
    return (window.__anaglyphColors?.red || '#FF4D4D');
}

const RECORD_STEPS = ['blur', 'break', 'recovery'];
const TEST_LETTERS = ['E', 'T', 'V'];

// ================================================================
//  Dynamic Vergence Module
// ================================================================

const dynamicVergence = {
  id: 'dynamic-vergence',
  label: 'Biên độ Hợp thị Động',
  customControls: true, 
  steps: ['test'],

  _board: null,
  _redLayer: null,   
  _cyanLayer: null,  

  _currentPrism: 0,
  _direction: 'BO', // 'BO' (Base-Out/Quy tụ) hoặc 'BI' (Base-In/Phân kỳ)
  
  _stepIndex: 0,
  _results: {},

  _boundKeydown: null,
  _boundWheel: null,

  _calcChannelOffset() {
    const cal = window.__calibrator;
    if (!cal || cal.pxPerMm <= 0) return 0;

    const distanceM = cal.distanceM > 0 ? cal.distanceM : 1.0; 
    
    // 1 Prism (Δ) = 10mm lệch tại 1m
    const totalDeviationMm = this._currentPrism * 10 * distanceM;
    const totalDeviationPx = totalDeviationMm * cal.pxPerMm;
    
    return totalDeviationPx / 2; // Chia đôi lượng tịnh tiến cho 2 mắt
  },

  _updateLayers() {
    if (!this._redLayer || !this._cyanLayer) return;

    const offset = this._calcChannelOffset();

    if (this._direction === 'BO') {
      this._redLayer.style.transform = `translateX(${-offset}px)`;
      this._cyanLayer.style.transform = `translateX(${offset}px)`;
    } else {
      this._redLayer.style.transform = `translateX(${offset}px)`;
      this._cyanLayer.style.transform = `translateX(${-offset}px)`;
    }
  },

  _initDOM() {
    const cal = window.__calibrator;
    const distanceM = (cal && cal.distanceM > 0) ? cal.distanceM : 1.0;

    this._board.innerHTML = '';
    this._board.style.backgroundColor = '#FFFFFF';
    this._board.style.position = 'relative';
    this._board.style.overflow = 'hidden';

    // --- KHU VỰC THỊ GIÁC (CANVAS) ---
    const layersContainer = document.createElement('div');
    layersContainer.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 320px; bottom: 0;
      display: flex; align-items: center; justify-content: center;
      background: #FFFFFF;
    `;

    this._redLayer = document.createElement('div');
    this._redLayer.style.cssText = `
      position: absolute; display: flex; flex-direction: column;
      align-items: center; gap: 30px; font-family: 'Arial', sans-serif;
      font-weight: 900; font-size: 100px; color: ${getDynamicVergenceRightEyeColor()};
      mix-blend-mode: multiply; pointer-events: none; transition: transform 0.1s linear;
    `;

    this._cyanLayer = document.createElement('div');
    this._cyanLayer.style.cssText = `
      position: absolute; display: flex; flex-direction: column;
      align-items: center; gap: 30px; font-family: 'Arial', sans-serif;
      font-weight: 900; font-size: 100px; color: ${getDynamicVergenceLeftEyeColor()};
      mix-blend-mode: multiply; pointer-events: none; transition: transform 0.1s linear;
    `;

    TEST_LETTERS.forEach(letter => {
      const spanR = document.createElement('div'); spanR.textContent = letter; spanR.style.lineHeight = '1';
      const spanC = document.createElement('div'); spanC.textContent = letter; spanC.style.lineHeight = '1';
      this._redLayer.appendChild(spanR);
      this._cyanLayer.appendChild(spanC);
    });

    layersContainer.appendChild(this._redLayer);
    layersContainer.appendChild(this._cyanLayer);
    this._board.appendChild(layersContainer);

    // --- KHU VỰC ĐIỀU KHIỂN (RIGHT SIDEBAR HUD) ---
    const sidebar = document.createElement('div');
    sidebar.id = 'dv-sidebar';
    sidebar.style.cssText = `
      position: absolute; top: 0; right: 0; width: 320px; height: 100%;
      box-sizing: border-box; background: rgba(255,255,255,0.95);
      border-left: 1px solid #ddd; box-shadow: -4px 0 15px rgba(0,0,0,0.05);
      padding: 25px 20px; font-family: sans-serif; color: #333;
      display: flex; flex-direction: column; z-index: 10; overflow-y: auto;
    `;

    sidebar.innerHTML = `
      <div style="border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 15px;">
        <div style="font-size: 14px; font-weight: 600; color: #666; margin-bottom: 4px; text-transform: uppercase;">Lăng Kính (Prism)</div>
        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
          <div style="font-size: 42px; font-weight: bold; color: #0056b3; line-height: 1;" id="dv-prism-val">0Δ</div>
          <div style="font-size: 13px; color: #555; font-weight: 600; background: #f1f2f6; padding: 4px 8px; border-radius: 4px;">
            Khoảng cách: <strong>${distanceM}m</strong>
          </div>
        </div>
      </div>

      <div style="flex-grow: 1;">
        <div style="font-size: 14px; font-weight: bold; color: #555; margin-bottom: 12px;">KẾT QUẢ ĐO LƯỜNG:</div>
        
        <div style="margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #f1c40f;">
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: 600;">Điểm Mờ (Blur):</span>
            <span id="dv-res-blur" style="font-weight: bold; color: #555;">--</span>
          </div>
          <div style="font-size: 11px; color: #7f8c8d; margin-top: 4px; line-height: 1.3;">Hình bắt đầu nhòe (Bệnh nhân mất khả năng dung hợp tinh vi).</div>
        </div>
        
        <div style="margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #e74c3c;">
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: 600;">Điểm Vỡ (Break):</span>
            <span id="dv-res-break" style="font-weight: bold; color: #555;">--</span>
          </div>
          <div style="font-size: 11px; color: #7f8c8d; margin-top: 4px; line-height: 1.3;">Thấy 2 hình tách rời (Mất hoàn toàn dung hợp thô, xuất hiện song thị).</div>
        </div>
        
        <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #2ecc71;">
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: 600;">Phục Hồi (Rec):</span>
            <span id="dv-res-recovery" style="font-weight: bold; color: #555;">--</span>
          </div>
          <div style="font-size: 11px; color: #7f8c8d; margin-top: 4px; line-height: 1.3;">Gộp lại thành 1 hình (Vỏ não phục hồi trạng thái dung hợp).</div>
        </div>

        <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px;">
          <div style="font-size: 12px; font-weight: bold; color: #666; margin-bottom: 8px;">BẢNG ĐIỀU KHIỂN</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; gap: 8px;">
              <button id="btn-dec-prism" style="flex: 1; padding: 8px; border: 1px solid #ccc; background: #fff; border-radius: 4px; cursor: pointer; font-weight: bold; color: #333; transition: background 0.2s;">◀ Giảm Prism</button>
              <button id="btn-inc-prism" style="flex: 1; padding: 8px; border: 1px solid #ccc; background: #fff; border-radius: 4px; cursor: pointer; font-weight: bold; color: #333; transition: background 0.2s;">Tăng Prism ▶</button>
            </div>
            <button id="btn-toggle-dir" style="padding: 8px; border: 1px solid #ccc; background: #e9ecef; border-radius: 4px; cursor: pointer; font-weight: 600; color: #c0392b; transition: background 0.2s;" title="Nhấp để đảo ngược chiều Lăng kính">
              [Space] Đổi: Đáy Ngoài (BO)
            </button>
            <button id="btn-record-step" style="padding: 10px; border: none; background: #0056b3; color: white; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              [Enter] Ghi nhận: Điểm Mờ
            </button>
          </div>
        </div>
      </div>

      <button id="dv-save-btn" style="
        width: 100%; padding: 14px; font-size: 15px; font-weight: bold;
        background: #28a745; color: white; border: none; border-radius: 8px;
        cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.15); display: none; margin-top: 15px;
      ">Lưu & Hoàn thành</button>
      
      <button id="dv-reset-btn" style="
        width: 100%; padding: 10px; font-size: 13px; font-weight: 600;
        background: transparent; color: #666; border: 1px solid #ccc; border-radius: 8px;
        cursor: pointer; margin-top: 10px;
      ">Làm lại từ đầu</button>
    `;

    this._board.appendChild(sidebar);

    // Gắn sự kiện Click cho các nút Điều khiển
    document.getElementById('btn-dec-prism').addEventListener('click', () => this._adjustPrism(-1));
    document.getElementById('btn-inc-prism').addEventListener('click', () => this._adjustPrism(1));
    document.getElementById('btn-toggle-dir').addEventListener('click', () => this._toggleDirection());
    document.getElementById('btn-record-step').addEventListener('click', () => this._recordStep());
    
    // Các nút chức năng
    document.getElementById('dv-save-btn').addEventListener('click', () => this._dispatchResult());
    document.getElementById('dv-reset-btn').addEventListener('click', () => this._resetTest());
  },

  _updateHUD() {
    const pVal = document.getElementById('dv-prism-val');
    const toggleBtn = document.getElementById('btn-toggle-dir');
    const recordBtn = document.getElementById('btn-record-step');
    
    if (pVal) pVal.textContent = `${this._currentPrism}Δ`;
    if (toggleBtn) {
      toggleBtn.textContent = this._direction === 'BO' ? '[Space] Đổi: Đáy Ngoài (BO)' : '[Space] Đổi: Đáy Trong (BI)';
      toggleBtn.style.color = this._direction === 'BO' ? '#c0392b' : '#2980b9';
    }

    const blurEl = document.getElementById('dv-res-blur');
    const breakEl = document.getElementById('dv-res-break');
    const recEl = document.getElementById('dv-res-recovery');
    const saveBtn = document.getElementById('dv-save-btn');

    if (blurEl) blurEl.textContent = this._results.blur !== undefined ? `${this._results.blur}Δ` : '--';
    if (breakEl) breakEl.textContent = this._results.break !== undefined ? `${this._results.break}Δ` : '--';
    if (recEl) recEl.textContent = this._results.recovery !== undefined ? `${this._results.recovery}Δ` : '--';

    // Cập nhật trạng thái nút Ghi nhận dựa trên Step hiện tại
    if (recordBtn) {
      if (this._stepIndex === 0) recordBtn.textContent = '[Enter] Ghi nhận: Điểm Mờ';
      else if (this._stepIndex === 1) recordBtn.textContent = '[Enter] Ghi nhận: Điểm Vỡ';
      else if (this._stepIndex === 2) recordBtn.textContent = '[Enter] Ghi nhận: Phục Hồi';
      else {
        recordBtn.textContent = 'Đã hoàn tất đo lường';
        recordBtn.style.background = '#6c757d'; // Xám đi khi xong
        recordBtn.style.cursor = 'not-allowed';
      }
    }

    // Hiển thị nút Lưu khi đã ghi nhận đủ 3 bước
    if (this._stepIndex >= RECORD_STEPS.length && saveBtn) {
      saveBtn.style.display = 'block';
    }
  },

  _adjustPrism(delta) {
    if (this._stepIndex >= RECORD_STEPS.length) return; // Khóa điều khiển lăng kính nếu đã đo xong
    this._currentPrism = Math.max(0, this._currentPrism + delta);
    this._updateLayers();
    this._updateHUD();
  },

  _toggleDirection() {
    this._direction = this._direction === 'BO' ? 'BI' : 'BO';
    this._currentPrism = 0; 
    this._updateLayers();
    this._updateHUD();
  },

  _recordStep() {
    if (this._stepIndex >= RECORD_STEPS.length) return;
    
    const stepName = RECORD_STEPS[this._stepIndex];
    this._results[stepName] = this._currentPrism;
    this._stepIndex++;
    this._updateHUD();
  },

  _resetTest() {
    this._currentPrism = 0;
    this._stepIndex = 0;
    this._results = {};
    const saveBtn = document.getElementById('dv-save-btn');
    const recordBtn = document.getElementById('btn-record-step');
    
    if (saveBtn) saveBtn.style.display = 'none';
    if (recordBtn) {
      recordBtn.style.background = '#0056b3';
      recordBtn.style.cursor = 'pointer';
    }
    
    this._updateLayers();
    this._updateHUD();
  },

  _dispatchResult() {
    const payload = {
      test_type: 'Dynamic_Fusional_Vergence',
      direction: this._direction,
      clinical_metrics: {
        blur: this._results.blur !== undefined ? this._results.blur : null,
        break: this._results.break !== undefined ? this._results.break : null,
        recovery: this._results.recovery !== undefined ? this._results.recovery : null
      }
    };

    const event = new CustomEvent('visionTestCompleted', { detail: payload, bubbles: true });
    document.dispatchEvent(event);
    this._resetTest();
  },

  _showCalibrationWarning() {
    this._board.innerHTML = `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f8f9fa;">
        <div style="text-align: center; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); max-width: 500px;">
          <h2 style="color: #d32f2f; margin-bottom: 15px;">⚠️ Yêu Cầu Hiệu Chuẩn</h2>
          <p style="color: #555; line-height: 1.6;">Bài test Hợp thị Động yêu cầu đo lường kích thước pixel (PPD) và khoảng cách khám để tính toán chính xác lượng Lăng kính (Prism Diopters).</p>
        </div>
      </div>
    `;
  },

  _onKeydown(e) {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this._adjustPrism(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this._adjustPrism(1);
        break;
      case ' ': 
        e.preventDefault();
        this._toggleDirection();
        break;
      case 'Enter':
        e.preventDefault();
        this._recordStep();
        break;
    }
  },

  _onWheel(e) {
    e.preventDefault();
    if (e.deltaY < 0) this._adjustPrism(1);
    else this._adjustPrism(-1);
  },

  render(idx) {
    this._board = document.getElementById('display-board');
    if (!this._board) return;

    const cal = window.__calibrator;
    if (!cal || cal.pxPerMm <= 0) {
      this._showCalibrationWarning();
      return;
    }

    this._initDOM();
    this._updateLayers();
    this._updateHUD();

    this._boundKeydown = this._onKeydown.bind(this);
    this._boundWheel = this._onWheel.bind(this);

    document.addEventListener('keydown', this._boundKeydown);
    // Lưu ý: Cờ { passive: false } giúp ngăn trình duyệt cuộn trang khi lăn chuột
    document.addEventListener('wheel', this._boundWheel, { passive: false });
  },

  cleanup() {
    if (this._boundKeydown) document.removeEventListener('keydown', this._boundKeydown);
    if (this._boundWheel) document.removeEventListener('wheel', this._boundWheel);

    this._boundKeydown = null;
    this._boundWheel = null;
    this._redLayer = null;
    this._cyanLayer = null;
    
    if (this._board) {
      this._board.innerHTML = '';
      this._board.style.backgroundColor = '';
    }
  },
};

export default dynamicVergence;