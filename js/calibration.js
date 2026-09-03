/**
 * DisplayCalibrator — Hiệu chỉnh màn hình cho Vision Therapy.
 *
 * Đã được đơn giản hóa: Chuyển hướng hiệu chuẩn vật lý sang module
 * CreditCardCalibrator (hiệu chuẩn bằng thẻ tín dụng - nguồn dữ liệu
 * duy nhất đạt chuẩn chính xác cho các bài test thị giác).
 *
 * Export:
 *   - default: DisplayCalibrator class
 *   - named:   getOptotypeSize (standalone function)
 */

// ================================================================
//  Constants
// ================================================================

/** 5 phút cung (chuẩn LogMAR 0 = 20/20) */
const ARC_MINUTES_BASELINE = 5;

/** 1 inch = 25.4 mm */
const MM_PER_INCH = 25.4;

/** LocalStorage keys */
const STORAGE_KEYS = {
  distanceM:   'vision-therapy-calibrate-distance-m',
  // Rào cản #1: Hiệu chuẩn vật lý bằng thẻ tín dụng (chính xác nhất).
  // Khóa này PHẢI khớp với CC_STORAGE_KEY trong credit_card_calibration.js.
  ccPxPerMm:   'vision-therapy-cc-pxpermm',
};

const DEFAULT_DISTANCE_M = 4;    // 4 mét

// ================================================================
//  Core Math
// ================================================================

/**
 * Tính kích thước optotype (pixel, số thực) từ giá trị LogMAR.
 *
 * Công thức quang học chuẩn:
 *   h_mm = D_mm × tan(5' × 10^LogMAR)
 *   với D_mm = distanceM × 1000, 5' tính theo radian.
 *
 * Sau đó chuyển đổi mm → pixel:
 *   height_px = height_mm × (PPI / 25.4)
 *
 * Trả về số thực (floating-point) để tận dụng sub-pixel rendering
 * của trình duyệt. KHÔNG làm tròn, KHÔNG clamp.
 *
 * @param {number} logmarValue     Giá trị LogMAR (vd: 0, 0.1, 0.2, ..., 1.0)
 * @param {Object} [calib]         Thông số hiệu chỉnh (nếu không dùng instance)
 * @param {number} calib.distanceM Khoảng cách khám (mét)
 * @param {number} calib.ppi       Mật độ điểm ảnh (PPI, số thực)
 * @returns {number}               Kích thước optotype tính bằng pixel (số thực)
 */
function getOptotypeSize(logmarValue, calib = null) {
  // Nếu không truyền calib, tự động đọc từ localStorage
  if (!calib) {
    calib = _loadCalibFromStorage();
  }

  const distanceM = (calib && calib.distanceM) || DEFAULT_DISTANCE_M;
  const ppi       = (calib && calib.ppi)       || _estimatePPI();

  // 1. Số phút cung cho LogMAR này: 5 × 10^LogMAR
  const arcminutes = ARC_MINUTES_BASELINE * Math.pow(10, logmarValue);

  // 2. Đổi sang radian
  const radians = (arcminutes / 60) * (Math.PI / 180);

  // 3. Chiều cao vật lý (mm): D_mm × tan(θ)
  const distanceMm = distanceM * 1000;
  const heightMm = distanceMm * Math.tan(radians);

  // 4. PPI → pixel (số thực, không làm tròn)
  const pxPerMm = ppi / MM_PER_INCH;
  const heightPx = heightMm * pxPerMm;

  // Trả về số thực — KHÔNG Math.round, KHÔNG Math.max
  return heightPx;
}

/**
 * Đọc thông số hiệu chỉnh từ localStorage.
 * @returns {{ distanceM: number, ppi: number } | null}
 * @private
 */
function _loadCalibFromStorage() {
  try {
    const dist   = localStorage.getItem(STORAGE_KEYS.distanceM);
    const ccPx   = localStorage.getItem(STORAGE_KEYS.ccPxPerMm);

    const distanceM = dist ? parseFloat(dist) : DEFAULT_DISTANCE_M;
    let ppi = 0;

    // Rào cản #1: Hiệu chuẩn vật lý bằng thẻ tín dụng là nguồn CHÍNH XÁC NHẤT.
    // Ưu tiên cao nhất — nếu có, dùng luôn, bỏ qua ước lượng màn hình.
    if (ccPx && parseFloat(ccPx) > 0) {
      const pxPerMm = parseFloat(ccPx);
      ppi = pxPerMm * MM_PER_INCH; // số thực
      return { distanceM, ppi };
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Ước lượng PPI từ window.screen và devicePixelRatio.
 * Không chính xác bằng nhập đường chéo thực tế.
 * @returns {number} số thực
 * @private
 */
/**
 * Ước lượng PPI từ window.screen và devicePixelRatio.
 * Chỉ dùng làm mốc dự phòng (fallback) nếu chưa hiệu chuẩn thẻ tín dụng.
 * @returns {number} số thực
 * @private
 */
function _estimatePPI() {
  const w = window.screen.width;
  const h = window.screen.height;
  const diagPx = Math.sqrt(w * w + h * h);
  const FALLBACK_DIAGONAL_INCH = 24; // Màn hình desktop phổ thông
  return diagPx / FALLBACK_DIAGONAL_INCH;
}

// ================================================================
//  DisplayCalibrator
// ================================================================

class DisplayCalibrator {
  /**
   * @param {Object} [options]
   * @param {number}  [options.distanceM=4]       Khoảng cách khám (mét)
   * @param {boolean} [options.autoLoad=true]     Tự động đọc localStorage
   */
  constructor(options = {}) {
    this.distanceM = options.distanceM ?? DEFAULT_DISTANCE_M;

    /** @type {number} PPI tính được (số thực) */
    this.ppi = 0;

    /** @type {number} pixel / mm (số thực) */
    this.pxPerMm = 0;

    // Auto-load
    if (options.autoLoad !== false) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._init());
      } else {
        this._init();
      }
    }
  }

  // ================================================================
  //  Initialization
  // ================================================================

  /** @private */
  _init() {
    this._loadFromStorage();
    this._recalculate();
  }

  // ================================================================
  //  Recalculate PPI
  // ================================================================

  /**
   * Tính lại PPI và pxPerMm dựa trên thông số hiện tại.
   * Chỉ sử dụng dữ liệu từ hiệu chuẩn thẻ tín dụng (ccPxPerMm).
   */
  _recalculate() {
    try {
      const ccPx = localStorage.getItem(STORAGE_KEYS.ccPxPerMm);
      if (ccPx && parseFloat(ccPx) > 0) {
        this.pxPerMm = parseFloat(ccPx);
        this.ppi = this.pxPerMm * MM_PER_INCH; // số thực
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * Cập nhật khoảng cách khám (mét).
   */
  setDistance(meters) {
    this.distanceM = meters;
    this._saveToStorage();
  }

  // ================================================================
  //  getOptotypeSize (instance method)
  // ================================================================

  /**
   * Tính kích thước optotype (pixel, số thực) từ LogMAR,
   * dùng thông số hiệu chỉnh của instance này.
   * @param {number} logmarValue
   * @returns {number} số thực
   */
  getOptotypeSize(logmarValue) {
    return getOptotypeSize(logmarValue, {
      distanceM: this.distanceM,
      ppi: this.ppi,
    });
  }

  // ================================================================
  //  Presets
  // ================================================================

  /**
   * Áp dụng preset mặc định cho thị lực nhìn gần (40 cm).
   * Đặt khoảng cách = 0.4 m, giữ nguyên PPI hiện tại.
   */
  applyNearVisionPreset() {
    this.setDistance(0.4);
  }

  /**
   * Áp dụng preset mặc định cho thị lực nhìn xa (4 m).
   */
  applyDistanceVisionPreset() {
    this.setDistance(4);
  }

  // ================================================================
  //  Storage
  // ================================================================

  /** @private */
  _saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.distanceM, String(this.distanceM));
    } catch (e) {
      // ignore
    }
  }

  /** @private */
  _loadFromStorage() {
    try {
      const dist = localStorage.getItem(STORAGE_KEYS.distanceM);
      if (dist) this.distanceM = parseFloat(dist);
    } catch (e) {
      // ignore
    }
  }

  // ================================================================
  //  Modal - Redirected to CreditCardCalibrator
  // ================================================================

  /**
   * Hiển thị modal hiệu chuẩn.
   * Đã được đơn giản hóa: Chuyển hướng trực tiếp sang module
   * CreditCardCalibrator để hiệu chuẩn vật lý bằng thẻ tín dụng.
   * 
   * Khoảng cách khám (distanceM) phải được thiết lập trước khi gọi hàm này
   * (thông qua constructor hoặc setDistance()).
   */
  showModal() {
    // Hiển thị hộp thoại chọn khoảng cách khám trước khi mở hiệu chuẩn thẻ tín dụng
    const overlay = document.createElement('div');
    overlay.className = 'calib-modal-overlay';
    overlay.innerHTML = `
      <div class="calib-modal-box" style="max-width: 400px;">
        <div class="calib-modal-header">
          <span class="calib-modal-title">Chọn khoảng cách khám</span>
          <button class="calib-modal-close" aria-label="Đóng">&times;</button>
        </div>
        <div class="calib-modal-body">
          <p style="margin-bottom: 16px; color: #555;">Khoảng cách từ mắt đến màn hình (mét):</p>
          <div class="calib-field-group">
            <label class="calib-field-label" for="calib-distance-input">Khoảng cách (m)</label>
            <div class="calib-field-row">
              <input type="number" id="calib-distance-input" class="calib-field-input"
                     value="${this.distanceM}" step="0.1" min="0.5" max="20" inputmode="decimal">
              <span class="calib-field-unit">mét</span>
            </div>
          </div>
          <div class="calib-preset-container" style="margin-top: 16px;">
            <!-- Nhóm Nhìn gần -->
            <div class="calib-preset-group">
              <div class="calib-preset-group-title">Nhìn gần</div>
              <div class="calib-preset-row">
                <button class="calib-btn-preset" data-distance="0.3" title="30 cm">30 cm</button>
                <button class="calib-btn-preset" data-distance="0.4" title="40 cm">40 cm</button>
                <button class="calib-btn-preset" data-distance="0.5" title="50 cm">50 cm</button>
                <button class="calib-btn-preset" data-distance="0.6" title="60 cm">60 cm</button>
              </div>
            </div>
            <!-- Nhóm Nhìn xa -->
            <div class="calib-preset-group">
              <div class="calib-preset-group-title">Nhìn xa</div>
              <div class="calib-preset-row">
                <button class="calib-btn-preset" data-distance="3" title="3 mét">3 m</button>
                <button class="calib-btn-preset" data-distance="4" title="4 mét">4 m</button>
                <button class="calib-btn-preset" data-distance="5" title="5 mét">5 m</button>
                <button class="calib-btn-preset" data-distance="6" title="6 mét">6 m</button>
              </div>
            </div>
          </div>
        </div>
        <div class="calib-modal-footer">
          <button class="calib-btn-cancel">Huỷ</button>
          <button class="calib-btn-save">Tiếp tục →</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    const input = overlay.querySelector('#calib-distance-input');
    const closeBtn = overlay.querySelector('.calib-modal-close');
    const cancelBtn = overlay.querySelector('.calib-btn-cancel');
    const saveBtn = overlay.querySelector('.calib-btn-save');
    const presetBtns = overlay.querySelectorAll('.calib-btn-preset');
    
    // Close handlers
    const closeModal = () => overlay.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    
    // Preset buttons
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.dataset.distance;
      });
    });
    
    // Save and continue
    saveBtn.addEventListener('click', () => {
      const dist = parseFloat(input.value);
      if (!isNaN(dist) && dist > 0) {
        this.setDistance(dist);
        closeModal();
        // Mở hiệu chuẩn thẻ tín dụng
        if (window.__ccCal) {
          window.__ccCal.showModal();
        }
      }
    });
    
    // Focus input
    setTimeout(() => input.focus(), 100);
  }

  /**
   * Dọn dẹp (không còn modal riêng để ẩn).
   */
  destroy() {
    // CreditCardCalibrator tự quản lý modal của nó
  }
}

// ================================================================
//  Export
// ================================================================
export default DisplayCalibrator;
export { DisplayCalibrator, getOptotypeSize };
