/**
 * DisplayCalibrator — Hiệu chỉnh màn hình cho Vision Therapy.
 *
 * Cho phép nhập khoảng cách khám và kích thước màn hình vật lý,
 * tính PPI (Pixel Per Inch) / mật độ điểm ảnh, và tính kích thước
 * pixel của optotype theo LogMAR dựa trên công thức góc thị giác 5 phút cung.
 *
 * Các thông số được lưu vào localStorage và tự động khôi phục.
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
  diagonalIn:  'vision-therapy-calibrate-diagonal-in',
  heightMm:    'vision-therapy-calibrate-height-mm',
  inputMode:   'vision-therapy-calibrate-input-mode',   // 'diagonal' | 'height'
  // Rào cản #1: Hiệu chuẩn vật lý bằng thẻ tín dụng (chính xác nhất).
  // Khóa này PHẢI khớp với CC_STORAGE_KEY trong credit_card_calibration.js.
  ccPxPerMm:   'vision-therapy-cc-pxpermm',
};

const DEFAULT_DISTANCE_M = 4;    // 4 mét
const DEFAULT_DIAGONAL_IN = 24;  // 24 inch màn hình desktop phổ biến

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
    const mode   = localStorage.getItem(STORAGE_KEYS.inputMode);
    const diag   = localStorage.getItem(STORAGE_KEYS.diagonalIn);
    const hMm    = localStorage.getItem(STORAGE_KEYS.heightMm);
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

    if (mode === 'height' && hMm) {
      const heightMm = parseFloat(hMm);
      if (heightMm > 0) {
        // Dùng CSS pixels — trình duyệt tự ánh xạ sang physical px
        const pxPerMm = window.screen.height / heightMm;
        ppi = pxPerMm * MM_PER_INCH; // số thực
      }
    } else if (diag) {
      const diagonal = parseFloat(diag);
      if (diagonal > 0) {
        const w = window.screen.width;
        const h = window.screen.height;
        ppi = Math.sqrt(w * w + h * h) / diagonal; // số thực
      }
    }

    if (ppi > 0) return { distanceM, ppi };
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
function _estimatePPI() {
  // Dùng CSS pixels — trình duyệt tự ánh xạ sang physical px
  const w = window.screen.width;
  const h = window.screen.height;
  const diagPx = Math.sqrt(w * w + h * h);
  return diagPx / DEFAULT_DIAGONAL_IN; // số thực
}

// ================================================================
//  DisplayCalibrator
// ================================================================

class DisplayCalibrator {
  /**
   * @param {Object} [options]
   * @param {number}  [options.distanceM=3]       Khoảng cách khám (mét)
   * @param {number}  [options.diagonalInch=24]   Đường chéo màn hình (inch)
   * @param {number}  [options.physicalHeightMm]  Chiều cao vật lý vùng hiển thị (mm)
   *                                              Nếu có, ưu tiên hơn diagonalInch
   * @param {boolean} [options.autoLoad=true]     Tự động đọc localStorage
   */
  constructor(options = {}) {
    this.distanceM        = options.distanceM        ?? DEFAULT_DISTANCE_M;
    this.diagonalInch     = options.diagonalInch     ?? DEFAULT_DIAGONAL_IN;
    this.physicalHeightMm = options.physicalHeightMm || null;

    /** 'diagonal' | 'height' */
    this._inputMode = 'diagonal';

    /** @type {number} PPI tính được (số thực) */
    this.ppi = 0;

    /** @type {number} pixel / mm (số thực) */
    this.pxPerMm = 0;

    /** @type {HTMLDivElement|null} */
    this._modalOverlay = null;

    /** @private */
    this._boundKeydown = this._onModalKeydown.bind(this);

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
      `%c[DisplayCalibrator]%c ${this.ppi.toFixed(2)} PPI  |  ${this.distanceM}m  |  ${this._inputMode === 'diagonal' ? this.diagonalInch + '″' : this.physicalHeightMm + 'mm'}`,
      'color:#4a90d9; font-weight:700;',
      'color:#555; font-weight:400;'
    );
  }

  // ================================================================
  //  Recalculate PPI
  // ================================================================

  /**
   * Tính lại PPI và pxPerMm dựa trên thông số hiện tại.
   * Gọi sau khi thay đổi distanceM / diagonalInch / physicalHeightMm.
   *
   * QUAN TRỌNG: Nhân với window.devicePixelRatio để có số pixel
   * vật lý thật trên màn hình Retina/High-DPI.
   */
  _recalculate() {
    // Dùng CSS pixels (window.screen.width/height) — trình duyệt
    // tự động ánh xạ CSS px → physical px qua devicePixelRatio.
    // Không nhân dpr vào đây vì sẽ gây double-counting.
    const w = window.screen.width;
    const h = window.screen.height;

    if (this.physicalHeightMm && this._inputMode === 'height') {
      // Dùng chiều cao vật lý (mm)
      this.pxPerMm = h / this.physicalHeightMm;
      this.ppi = this.pxPerMm * MM_PER_INCH; // số thực
    } else if (this.diagonalInch > 0) {
      // Dùng đường chéo (inch)
      const diagPx = Math.sqrt(w * w + h * h);
      this.ppi = diagPx / this.diagonalInch; // số thực
      this.pxPerMm = this.ppi / MM_PER_INCH;
    } else {
      this.ppi = 0;
      this.pxPerMm = 0;
    }
  }

  /**
   * Cập nhật khoảng cách khám (mét).
   */
  setDistance(meters) {
    this.distanceM = meters;
    this._saveToStorage();
    this._recalculate();
  }

  /**
   * Cập nhật đường chéo màn hình (inch).
   */
  setDiagonal(inches) {
    this.diagonalInch = inches;
    this._inputMode = 'diagonal';
    this.physicalHeightMm = null;
    this._saveToStorage();
    this._recalculate();
  }

  /**
   * Cập nhật chiều cao vật lý vùng hiển thị (mm).
   */
  setPhysicalHeight(mm) {
    this.physicalHeightMm = mm;
    this._inputMode = 'height';
    this._saveToStorage();
    this._recalculate();
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
   * Gọi hàm này để chuyển nhanh giữa khám xa và gần.
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
      localStorage.setItem(STORAGE_KEYS.distanceM,   String(this.distanceM));
      localStorage.setItem(STORAGE_KEYS.diagonalIn,  String(this.diagonalInch));
      localStorage.setItem(STORAGE_KEYS.inputMode,   this._inputMode);
      if (this.physicalHeightMm != null) {
        localStorage.setItem(STORAGE_KEYS.heightMm, String(this.physicalHeightMm));
      } else {
        localStorage.removeItem(STORAGE_KEYS.heightMm);
      }
    } catch (e) {
      // ignore
    }
  }

  /** @private */
  _loadFromStorage() {
    try {
      const dist  = localStorage.getItem(STORAGE_KEYS.distanceM);
      const diag  = localStorage.getItem(STORAGE_KEYS.diagonalIn);
      const mode  = localStorage.getItem(STORAGE_KEYS.inputMode);
      const hMm   = localStorage.getItem(STORAGE_KEYS.heightMm);

      if (dist)  this.distanceM = parseFloat(dist);
      if (diag)  this.diagonalInch = parseFloat(diag);
      if (mode)  this._inputMode = mode;

      if (mode === 'height' && hMm) {
        this.physicalHeightMm = parseFloat(hMm);
      }
    } catch (e) {
      // ignore
    }
  }

  // ================================================================
  //  Modal
  // ================================================================

  /**
   * Hiển thị modal hiệu chỉnh.
   */
  showModal() {
    if (this._modalOverlay) return;

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'calib-modal-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hideModal();
    });

    // Box
    const box = document.createElement('div');
    box.className = 'calib-modal-box';

    // ----- Header -----
    const header = document.createElement('div');
    header.className = 'calib-modal-header';
    header.innerHTML = '<span class="calib-modal-title">Hiệu chỉnh màn hình</span>';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'calib-modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Đóng');
    closeBtn.addEventListener('click', () => this.hideModal());
    header.appendChild(closeBtn);
    box.appendChild(header);

    // ----- Body -----
    const body = document.createElement('div');
    body.className = 'calib-modal-body';

    // -- Khoảng cách khám --
    body.appendChild(this._createFieldGroup(
      'Khoảng cách khám',
      'distance-m',
      'mét',
      this.distanceM,
      'number',
      '0.5',
      '0.5',
      '20',
      (val) => { this.distanceM = parseFloat(val); this._recalculate(); }
    ));

    // -- Đường chéo màn hình --
    body.appendChild(this._createFieldGroup(
      'Đường chéo màn hình',
      'diagonal-in',
      'inch',
      this.diagonalInch,
      'number',
      '1',
      '10',
      '100',
      (val) => { this.diagonalInch = parseFloat(val); this._inputMode = 'diagonal'; this._recalculate(); }
    ));

    // -- Chiều cao vùng hiển thị --
    body.appendChild(this._createFieldGroup(
      'Chiều cao vùng hiển thị',
      'physical-height',
      'mm',
      this.physicalHeightMm || 300,
      'number',
      '1',
      '50',
      '2000',
      (val) => { this.physicalHeightMm = parseFloat(val); this._inputMode = 'height'; this._recalculate(); }
    ));

    // -- Chiều cao màn hình vật lý (từ window.screen) --
    const screenHmm = (window.screen && window.screen.height)
      ? (window.screen.height / (this.ppi || 1) * 25.4).toFixed(1)
      : '—';
    const screenInfo = document.createElement('div');
    screenInfo.className = 'calib-screen-info';
    screenInfo.innerHTML = `Màn hình: <b>${window.screen?.width || '?'} × ${window.screen?.height || '?'} px</b> · chiều cao vật lý ≈ <b>${screenHmm} mm</b>`;
    body.appendChild(screenInfo);

    // -- Kết quả PPI --
    const result = document.createElement('div');
    result.className = 'calib-result';
    result.innerHTML = `
      <div class="calib-result-row">
        <span class="calib-result-label">Mật độ điểm ảnh (PPI)</span>
        <span class="calib-result-value">${this.ppi.toFixed(2)}</span>
      </div>
      <div class="calib-result-row">
        <span class="calib-result-label">Pixel / mm</span>
        <span class="calib-result-value">${this.pxPerMm.toFixed(4)}</span>
      </div>
      <div class="calib-result-row">
        <span class="calib-result-label">Kích thước màn hình</span>
        <span class="calib-result-value">${window.screen.width} × ${window.screen.height}</span>
      </div>
      <div class="calib-result-row">
        <span class="calib-result-label">devicePixelRatio</span>
        <span class="calib-result-value">${(window.devicePixelRatio || 1).toFixed(1)}</span>
      </div>
    `;
    body.appendChild(result);

    // -- Preset buttons --
    const presetRow = document.createElement('div');
    presetRow.className = 'calib-preset-row';
    presetRow.innerHTML = `
      <button class="calib-btn-preset" data-preset="near" title="Chuyển sang chế độ thị lực nhìn gần (40 cm)">
        📖 Nhìn gần (40 cm)
      </button>
      <button class="calib-btn-preset" data-preset="distance" title="Chuyển sang chế độ thị lực nhìn xa (4 m)">
        🌄 Nhìn xa (4 m)
      </button>
    `;
    presetRow.querySelector('[data-preset="near"]').addEventListener('click', () => {
      this.applyNearVisionPreset();
      this._rebuildModal();
    });
    presetRow.querySelector('[data-preset="distance"]').addEventListener('click', () => {
      this.applyDistanceVisionPreset();
      this._rebuildModal();
    });
    body.appendChild(presetRow);

    // -- Ghi chú --
    const note = document.createElement('p');
    note.className = 'calib-note';
    note.textContent = 'Thông số được tự động lưu và khôi phục khi load lại trang.';
    body.appendChild(note);

    box.appendChild(body);

    // ----- Footer -----
    const footer = document.createElement('div');
    footer.className = 'calib-modal-footer';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'calib-btn-save';
    saveBtn.textContent = 'Lưu & Đóng';
    saveBtn.addEventListener('click', () => {
      this._saveToStorage();
      this._recalculate();
      this.hideModal();
      console.log(
        `%c[DisplayCalibrator]%c Saved — ${this.ppi.toFixed(2)} PPI, ${this.distanceM}m`,
        'color:#4a90d9; font-weight:700;',
        'color:#555; font-weight:400;'
      );
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'calib-btn-cancel';
    cancelBtn.textContent = 'Huỷ';
    cancelBtn.addEventListener('click', () => {
      // Restore from storage
      this._loadFromStorage();
      this._recalculate();
      this.hideModal();
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    box.appendChild(footer);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this._modalOverlay = overlay;

    // Escape to close
    document.addEventListener('keydown', this._boundKeydown);
    requestAnimationFrame(() => box.focus?.());
  }

  /**
   * Xây dựng lại modal (khi chuyển chế độ nhập).
   * @private
   */
  _rebuildModal() {
    this.hideModal();
    this.showModal();
  }

  /**
   * Tạo một nhóm label + input.
   * @private
   */
  _createFieldGroup(label, id, unit, value, type, step, min, max, onChange) {
    const group = document.createElement('div');
    group.className = 'calib-field-group';

    const lbl = document.createElement('label');
    lbl.className = 'calib-field-label';
    lbl.htmlFor = `calib-${id}`;
    lbl.textContent = label;
    group.appendChild(lbl);

    const inputRow = document.createElement('div');
    inputRow.className = 'calib-field-row';

    // Dùng type="text" + inputMode="decimal" thay vì type="number"
    // để Backspace và Delete hoạt động đúng trên mọi trình duyệt
    const input = document.createElement('input');
    input.type = 'text';
    input.id = `calib-${id}`;
    input.className = 'calib-field-input';
    input.value = String(value);
    input.inputMode = 'decimal';
    input.autocomplete = 'off';

    // Cho phép: digits, dấu chấm, dấu gạch ngang, Backspace, Delete, Tab, Enter, Arrow keys
    input.addEventListener('keydown', (e) => {
      const allowed = [
        'Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End',
      ];
      if (allowed.includes(e.key)) return;  // cho phép
      if (e.ctrlKey || e.metaKey) return;   // cho phép Ctrl+C, Ctrl+V, etc.
      // Chỉ cho phép digits, dấu chấm, dấu gạch ngang
      if (!/^[\d.\-]$/.test(e.key)) {
        e.preventDefault();
      }
    });

    // Xử lý input: cập nhật giá trị khi người dùng nhập
    input.addEventListener('input', () => {
      const raw = input.value.trim();
      if (raw === '') {
        // Cho phép ô trống tạm thời (đang xóa để nhập số mới)
        return;
      }
      // Kiểm tra số hợp lệ
      const num = parseFloat(raw);
      if (!isNaN(num)) {
        onChange(String(num));
        this._updateResultDisplay();
      }
    });

    // Khi mất focus: nếu trống → khôi phục giá trị cũ; nếu có số → format lại
    input.addEventListener('blur', () => {
      const raw = input.value.trim();
      if (raw === '') {
        input.value = String(value);
        // Không gọi onChange → giữ nguyên giá trị cũ
        return;
      }
      const num = parseFloat(raw);
      if (!isNaN(num)) {
        // Format lại số (loại bỏ số 0 thừa, dấu chấm thừa)
        const clamped = Math.max(parseFloat(min) || 0, Math.min(parseFloat(max) || Infinity, num));
        const formatted = step && step.indexOf('.') !== -1
          ? clamped.toFixed(step.split('.')[1]?.length || 1)
          : String(clamped);
        input.value = formatted;
        onChange(formatted);
        this._updateResultDisplay();
      } else {
        // Khôi phục nếu không phải số
        input.value = String(value);
      }
    });

    inputRow.appendChild(input);

    const unitSpan = document.createElement('span');
    unitSpan.className = 'calib-field-unit';
    unitSpan.textContent = unit;
    inputRow.appendChild(unitSpan);

    group.appendChild(inputRow);
    return group;
  }

  /**
   * Cập nhật phần hiển thị kết quả PPI trong modal.
   * @private
   */
  _updateResultDisplay() {
    if (!this._modalOverlay) return;
    const rows = this._modalOverlay.querySelectorAll('.calib-result-row');
    if (rows.length >= 4) {
      rows[0].querySelector('.calib-result-value').textContent = this.ppi.toFixed(2);
      rows[1].querySelector('.calib-result-value').textContent = this.pxPerMm.toFixed(4);
    }
  }

  /**
   * Ẩn modal.
   */
  hideModal() {
    if (!this._modalOverlay) return;
    document.removeEventListener('keydown', this._boundKeydown);
    this._modalOverlay.remove();
    this._modalOverlay = null;
  }

  /** @private */
  _onModalKeydown(e) {
    if (e.key === 'Escape') this.hideModal();
  }

  /**
   * Dọn dẹp.
   */
  destroy() {
    this.hideModal();
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
 *
 * Bảng hiển thị:
 *   - LogMAR
 *   - Snellen (ft)
 *   - Góc thị giác (arcmin)
 *   - Chiều cao vật lý (mm) tại mỗi khoảng cách
 *   - Kích thước pixel tại mỗi khoảng cách
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