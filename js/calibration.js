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
 *   - named:   debugPrintSizes (console diagnostic table)
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
    console.log(
      `%c[DisplayCalibrator]%c ${this.ppi.toFixed(2)} PPI  |  ${this.distanceM}m`,
      'color:#4a90d9; font-weight:700;',
      'color:#555; font-weight:400;'
    );
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
    console.log(
      `%c[DisplayCalibrator]%c Near Vision preset — 0.4m, ${this.ppi.toFixed(2)} PPI`,
      'color:#4a90d9; font-weight:700;',
      'color:#555; font-weight:400;'
    );
  }

  /**
   * Áp dụng preset mặc định cho thị lực nhìn xa (4 m).
   */
  applyDistanceVisionPreset() {
    this.setDistance(4);
    console.log(
      `%c[DisplayCalibrator]%c Distance Vision preset — 4m, ${this.ppi.toFixed(2)} PPI`,
      'color:#4a90d9; font-weight:700;',
      'color:#555; font-weight:400;'
    );
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
//  Debug: debugPrintSizes()
// ================================================================

/**
 * In bảng đối chiếu kích thước vật lý (mm) và pixel tương ứng
 * cho các hàng từ LogMAR 1.0 đến -0.3 ở các khoảng cách khám
 * 3 mét, 5 mét và 6 mét.
 *
 * Gọi từ Console: `debugPrintSizes()` hoặc `window.__debugPrintSizes()`
 */
function debugPrintSizes() {
  const distances = [3, 5, 6]; // mét
  const logmarLevels = [];
  for (let l = 1.0; l >= -0.35; l = Math.round((l - 0.1) * 100) / 100) {
    logmarLevels.push(l);
  }

  // Lấy PPI hiện tại
  let ppi = 96;
  let ppiSource = 'fallback (96)';
  try {
    const calib = _loadCalibFromStorage();
    if (calib && calib.ppi > 0) {
      ppi = calib.ppi;
      ppiSource = 'calibrated';
    } else {
      ppi = _estimatePPI();
      ppiSource = 'estimated';
    }
  } catch (e) {
    ppi = _estimatePPI();
    ppiSource = 'estimated (error fallback)';
  }

  const dpr = window.devicePixelRatio || 1;
  const pxPerMm = ppi / MM_PER_INCH;

  console.log(
    `%c══════════════════════════════════════════════════════════════`,
    'color:#4a90d9; font-weight:700;'
  );
  console.log(
    `%c🔬 Vision Therapy — Optotype Size Diagnostic Table`,
    'color:#4a90d9; font-weight:700; font-size:1.1em;'
  );
  console.log(
    `%cPPI: ${ppi.toFixed(2)} (${ppiSource})  |  devicePixelRatio: ${dpr}  |  px/mm: ${pxPerMm.toFixed(4)}`,
    'color:#555;'
  );
  console.log(
    `%cCông thức: h_mm = D_mm × tan(5' × 10^LogMAR)  |  px = h_mm × (PPI / 25.4)`,
    'color:#888; font-style:italic;'
  );
  console.log(
    `%c══════════════════════════════════════════════════════════════`,
    'color:#4a90d9; font-weight:700;'
  );

  // Header
  const headerCols = ['LogMAR', 'Snellen', "Angle(')"];
  distances.forEach((d) => {
    headerCols.push(`${d}m mm`);
    headerCols.push(`${d}m px`);
  });

  const rows = [headerCols];

  logmarLevels.forEach((logmar) => {
    const arcminutes = ARC_MINUTES_BASELINE * Math.pow(10, logmar);
    const snellenDenom = Math.round(20 * Math.pow(10, logmar));
    const row = [
      logmar.toFixed(1),
      `20/${snellenDenom}`,
      arcminutes.toFixed(2),
    ];

    distances.forEach((d) => {
      const distanceMm = d * 1000;
      const radians = (arcminutes / 60) * (Math.PI / 180);
      const heightMm = distanceMm * Math.tan(radians);
      const heightPx = heightMm * pxPerMm;
      row.push(heightMm.toFixed(4));
      row.push(heightPx.toFixed(2));
    });

    rows.push(row);
  });

  // Tính độ rộng cột
  const colWidths = headerCols.map((_, ci) =>
    Math.max(...rows.map((r) => String(r[ci]).length))
  );

  // In từng dòng
  const sepLine = '─'.repeat(colWidths.reduce((a, b) => a + b + 3, 0));

  console.log(`%c${sepLine}`, 'color:#ccc;');
  // Header
  const headerStr = headerCols
    .map((c, i) => String(c).padStart(colWidths[i]))
    .join(' │ ');
  console.log(`%c${headerStr}`, 'color:#000; font-weight:700;');
  console.log(`%c${sepLine}`, 'color:#ccc;');

  // Data rows
  rows.slice(1).forEach((row, ri) => {
    const logmar = parseFloat(row[0]);
    // Highlight các mốc quan trọng
    let color = '#333';
    if (logmar === 0.0) color = '#0056b3'; // 20/20
    else if (logmar === 0.3) color = '#28a745'; // 20/40
    else if (logmar === 1.0) color = '#dc3545'; // 20/200

    const rowStr = row
      .map((c, i) => String(c).padStart(colWidths[i]))
      .join(' │ ');
    console.log(`%c${rowStr}`, `color:${color};`);
  });

  console.log(`%c${sepLine}`, 'color:#ccc;');
  console.log(
    `%c✅ Kết luận: Kích thước pixel là số thực (float), không clamp, không làm tròn.`,
    'color:#28a745; font-weight:700;'
  );
  console.log(
    `%c   Sub-pixel rendering của trình duyệt sẽ xử lý phần thập phân.`,
    'color:#28a745;'
  );

  // Trả về object để có thể dùng programmatically
  const result = {
    ppi,
    ppiSource,
    devicePixelRatio: dpr,
    pxPerMm,
    distances,
    rows: rows.slice(1).map((r) => ({
      logmar: parseFloat(r[0]),
      snellen: r[1],
      arcminutes: parseFloat(r[2]),
      sizes: distances.reduce((acc, d, di) => {
        acc[`${d}m`] = {
          mm: parseFloat(r[3 + di * 2]),
          px: parseFloat(r[4 + di * 2]),
        };
        return acc;
      }, {}),
    })),
  };

  return result;
}

// Gắn vào window để gọi từ Console
if (typeof window !== 'undefined') {
  window.__debugPrintSizes = debugPrintSizes;
}

// ================================================================
//  Export
// ================================================================
export default DisplayCalibrator;
export { DisplayCalibrator, getOptotypeSize, debugPrintSizes };
