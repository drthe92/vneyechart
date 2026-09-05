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
  // 2 cấu hình khoảng cách độc lập: Nhìn Xa / Nhìn Gần (lưu vĩnh viễn)
  distanceFarM:  'vision_distance_far_m',
  distanceNearM: 'vision_distance_near_m',
  // Rào cản #1: Hiệu chuẩn vật lý bằng thẻ tín dụng (chính xác nhất).
  // Khóa này PHẢI khớp với CC_STORAGE_KEY trong credit_card_calibration.js.
  ccPxPerMm:   'vision-therapy-cc-pxpermm',
};

const DEFAULT_DISTANCE_M = 4;         // 4 mét (Nhìn Xa)
const DEFAULT_NEAR_DISTANCE_M = 0.4;  // 40 cm (Nhìn Gần)

/** Giới hạn an toàn lâm sàng — giá trị ngoài khoảng này bị clamp khi lưu */
const FAR_MIN_M  = 2.0;   // Nhìn Xa:  2m  – 6m
const FAR_MAX_M  = 6.0;
const NEAR_MIN_M = 0.2;   // Nhìn Gần: 0.2m – 0.8m
const NEAR_MAX_M = 0.8;

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
    const store = () => (typeof window !== 'undefined' && window.SettingsStore) || null;
    const dist   = store() ? store().get(STORAGE_KEYS.distanceM) : localStorage.getItem(STORAGE_KEYS.distanceM);
    const ccPx   = store() ? store().get(STORAGE_KEYS.ccPxPerMm) : localStorage.getItem(STORAGE_KEYS.ccPxPerMm);

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

/**
 * Khoảng cách Nhìn Gần đang active (mét) — helper dùng chung cho các
 * module Nhìn Gần (near_logmar / near_lea / near_npoint).
 *
 * main.js tự chuyển đổi window.__calibrator.distanceM theo nhóm test
 * trước khi gọi render nên giá trị active đã đúng cho bài test Nhìn Gần;
 * nếu không có, fallback về cấu hình distanceNearM rồi mới về mặc định.
 * @returns {number}
 */
function getActiveNearDistanceM() {
  if (typeof window === 'undefined' || !window.__calibrator) {
    return DEFAULT_NEAR_DISTANCE_M;
  }
  const cal = window.__calibrator;
  const active = parseFloat(cal.distanceM);
  if (!isNaN(active) && active > 0) return active;
  const near = parseFloat(cal.distanceNearM);
  if (!isNaN(near) && near > 0) return near;
  return DEFAULT_NEAR_DISTANCE_M;
}

/**
 * Toast duy nhất: delegate về window.showGlobalToast (main.js).
 * Fallback console.warn khi main.js chưa tải (chỉ phòng hờ).
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} [type]
 * @private
 */
function _notify(message, type = 'info') {
  try {
    if (typeof window !== 'undefined' && typeof window.showGlobalToast === 'function') {
      window.showGlobalToast(message, type);
      return;
    }
    console.warn('[Toast]', message);
  } catch (e) {
    console.warn('[Toast]', message);
  }
}

// ================================================================
//  DisplayCalibrator
// ================================================================

class DisplayCalibrator {
  /**
   * @param {Object} [options]
   * @param {number}  [options.distanceM=4]       Khoảng cách khám đang active (mét)
   * @param {number}  [options.distanceFarM=4]    Khoảng cách Nhìn Xa (mét)
   * @param {number}  [options.distanceNearM=0.4] Khoảng cách Nhìn Gần (mét)
   * @param {boolean} [options.autoLoad=true]     Tự động đọc localStorage
   */
  constructor(options = {}) {
    this.distanceM = options.distanceM ?? DEFAULT_DISTANCE_M;

    /** @type {number} Khoảng cách Nhìn Xa (mét) — lưu vĩnh viễn */
    this.distanceFarM = options.distanceFarM ?? DEFAULT_DISTANCE_M;

    /** @type {number} Khoảng cách Nhìn Gần (mét) — lưu vĩnh viễn */
    this.distanceNearM = options.distanceNearM ?? DEFAULT_NEAR_DISTANCE_M;

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
      const store = () => (typeof window !== 'undefined' && window.SettingsStore) || null;
      const ccPx = store() ? store().get(STORAGE_KEYS.ccPxPerMm) : localStorage.getItem(STORAGE_KEYS.ccPxPerMm);
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
   * Áp dụng preset cho thị lực nhìn gần.
   * Khoảng cách lấy từ cấu hình Nhìn Gần (distanceNearM), giữ nguyên PPI.
   */
  applyNearVisionPreset() {
    this.setDistance(this.distanceNearM || DEFAULT_NEAR_DISTANCE_M);
  }

  /**
   * Áp dụng preset cho thị lực nhìn xa.
   * Khoảng cách lấy từ cấu hình Nhìn Xa (distanceFarM), giữ nguyên PPI.
   */
  applyDistanceVisionPreset() {
    this.setDistance(this.distanceFarM || DEFAULT_DISTANCE_M);
  }

  /**
   * Lưu đồng thời 2 cấu hình khoảng cách độc lập (Nhìn Xa / Nhìn Gần)
   * xuống localStorage và cập nhật chính instance này (window.__calibrator).
   * @param {number} farM  Khoảng cách Nhìn Xa (mét)
   * @param {number} nearM Khoảng cách Nhìn Gần (mét)
   */
  saveDistanceSettings(farM, nearM) {
    this.distanceFarM = farM;
    this.distanceNearM = nearM;

    const persist = (key, value) => {
      try {
        if (typeof window !== 'undefined' && window.SettingsStore) {
          window.SettingsStore.set(key, String(value));
        } else {
          localStorage.setItem(key, String(value));
        }
      } catch (e) {
        // ignore
      }
    };
    persist(STORAGE_KEYS.distanceFarM, farM);
    persist(STORAGE_KEYS.distanceNearM, nearM);
  }

  // ================================================================
  //  Storage
  // ================================================================

  /** @private */
  _saveToStorage() {
    try {
      const value = String(this.distanceM);
      if (typeof window !== 'undefined' && window.SettingsStore) {
        window.SettingsStore.set(STORAGE_KEYS.distanceM, value);
      } else {
        localStorage.setItem(STORAGE_KEYS.distanceM, value);
      }
    } catch (e) {
      // ignore
    }
  }

  /** @private */
  _loadFromStorage() {
    this.loadDistanceSettings();
  }

  /**
   * Nạp toàn bộ cấu hình khoảng cách từ storage — SINGLE SOURCE OF TRUTH
   * cho việc hydrate (main.js chỉ gọi API này, không tự đọc key).
   *
   * - distanceFarM  ← 'vision_distance_far_m'  (mặc định 4.0)
   * - distanceNearM ← 'vision_distance_near_m' (mặc định 0.4)
   * - Di trú key cũ 'vision-therapy-calibrate-distance-m':
   *   >= 1m → Nhìn Xa, < 1m → Nhìn Gần (chỉ khi key mới chưa tồn tại).
   * - distanceM (active) = distanceFarM — bài test mặc định khi tải trang
   *   là Nhìn Xa; các lần chuyển test sau sẽ áp preset đúng nhóm.
   */
  loadDistanceSettings() {
    try {
      const get = (key) => (typeof window !== 'undefined' && window.SettingsStore)
        ? window.SettingsStore.get(key)
        : localStorage.getItem(key);

      const parseKey = (key, fallback) => {
        try {
          const raw = get(key);
          const v = parseFloat(raw);
          return (!isNaN(v) && v > 0) ? v : fallback;
        } catch (e) {
          return fallback;
        }
      };

      // Di trú từ key cũ (khoảng cách active cuối cùng)
      let legacyFar = null;
      let legacyNear = null;
      try {
        const legacy = parseFloat(get(STORAGE_KEYS.distanceM));
        if (!isNaN(legacy) && legacy > 0) {
          if (legacy >= 1) legacyFar = legacy;
          else legacyNear = legacy;
        }
      } catch (e) { /* ignore */ }

      this.distanceFarM = parseKey(
        STORAGE_KEYS.distanceFarM,
        legacyFar ?? this.distanceFarM ?? DEFAULT_DISTANCE_M
      );
      this.distanceNearM = parseKey(
        STORAGE_KEYS.distanceNearM,
        legacyNear ?? this.distanceNearM ?? DEFAULT_NEAR_DISTANCE_M
      );
      this.distanceM = this.distanceFarM;
    } catch (e) {
      // ignore
    }
  }

  // ================================================================
  //  Modal - Redirected to CreditCardCalibrator
  // ================================================================

  /**
   * Hiển thị modal chọn khoảng cách khám (Nhìn Xa / Nhìn Gần độc lập).
   * Footer gồm 2 nút độc lập:
   *   - "Lưu & Đóng"              : lưu 2 giá trị, đóng modal, toast xác nhận.
   *   - "Hiệu chuẩn thẻ tín dụng" : lưu 2 giá trị rồi mở modal thẻ tín dụng.
   * Cả 2 đều cross-validate (Nhìn Xa > Nhìn Gần) và phát sự kiện
   * 'calibrator:distance-settings-changed' để main.js re-render bài test
   * đang active ngay lập tức.
   */
  showModal() {
    const far = this.distanceFarM ?? DEFAULT_DISTANCE_M;
    const near = this.distanceNearM ?? DEFAULT_NEAR_DISTANCE_M;

    const overlay = document.createElement('div');
    overlay.className = 'calib-modal-overlay';
    overlay.innerHTML = `
      <div class="calib-modal-box" style="max-width: 520px;">
        <div class="calib-modal-header">
          <span class="calib-modal-title">Chọn khoảng cách khám</span>
          <button class="calib-modal-close" aria-label="Đóng">&times;</button>
        </div>
        <div class="calib-modal-body">
          <div class="calib-preset-container">
            <!-- Nhìn Xa -->
            <div class="calib-preset-group">
              <div class="calib-preset-group-title">Khoảng cách Nhìn Xa (m)</div>
              <div class="calib-field-row" style="margin-bottom: 10px;">
                <input type="number" id="calib-distance-far-input" class="calib-field-input"
                       value="${far}" step="0.1" min="${FAR_MIN_M}" max="${FAR_MAX_M}" inputmode="decimal">
                <span class="calib-field-unit">mét</span>
              </div>
              <div class="calib-preset-row">
                <button class="calib-btn-preset" data-target="far" data-distance="3" title="3 mét">3 m</button>
                <button class="calib-btn-preset" data-target="far" data-distance="4" title="4 mét">4 m</button>
                <button class="calib-btn-preset" data-target="far" data-distance="5" title="5 mét">5 m</button>
                <button class="calib-btn-preset" data-target="far" data-distance="6" title="6 mét">6 m</button>
              </div>
            </div>
            <!-- Nhìn Gần -->
            <div class="calib-preset-group" style="margin-top: 18px;">
              <div class="calib-preset-group-title">Khoảng cách Nhìn Gần (m)</div>
              <div class="calib-field-row" style="margin-bottom: 10px;">
                <input type="number" id="calib-distance-near-input" class="calib-field-input"
                       value="${near}" step="0.01" min="${NEAR_MIN_M}" max="${NEAR_MAX_M}" inputmode="decimal">
                <span class="calib-field-unit">mét</span>
              </div>
              <div class="calib-preset-row">
                <button class="calib-btn-preset" data-target="near" data-distance="0.3" title="30 cm">0.3 m</button>
                <button class="calib-btn-preset" data-target="near" data-distance="0.4" title="40 cm">0.4 m</button>
                <button class="calib-btn-preset" data-target="near" data-distance="0.5" title="50 cm">0.5 m</button>
                <button class="calib-btn-preset" data-target="near" data-distance="0.6" title="60 cm">0.6 m</button>
              </div>
            </div>
          </div>
        </div>
        <div class="calib-modal-footer" style="flex-wrap: wrap;">
          <button class="calib-btn-cancel">Huỷ</button>
          <button class="calib-btn-cc" id="calib-btn-cc">Hiệu chuẩn thẻ tín dụng</button>
          <button class="calib-btn-save">Lưu &amp; Đóng</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const farInput = overlay.querySelector('#calib-distance-far-input');
    const nearInput = overlay.querySelector('#calib-distance-near-input');
    const closeBtn = overlay.querySelector('.calib-modal-close');
    const cancelBtn = overlay.querySelector('.calib-btn-cancel');
    const saveBtn = overlay.querySelector('.calib-btn-save');
    const ccBtn = overlay.querySelector('#calib-btn-cc');
    const presetBtns = overlay.querySelectorAll('.calib-btn-preset');

    // Close handlers
    const closeModal = () => overlay.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    // ---- Active state: nút preset trùng giá trị ô input được highlight ----
    const syncPresetActive = () => {
      presetBtns.forEach(btn => {
        const target = btn.dataset.target === 'near' ? nearInput : farInput;
        const active =
          parseFloat(target.value) === parseFloat(btn.dataset.distance) &&
          !isNaN(parseFloat(target.value));
        btn.classList.toggle('active', active);
      });
    };
    farInput.addEventListener('input', syncPresetActive);
    nearInput.addEventListener('input', syncPresetActive);

    // Preset buttons — mỗi nút gán vào đúng ô (Nhìn Xa / Nhìn Gần)
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target === 'near' ? nearInput : farInput;
        target.value = btn.dataset.distance;
        syncPresetActive();
      });
    });
    syncPresetActive();

    // ---- Validation + Hard Limits (clamp tự động) ----
    const validate = (farVal, nearVal) => {
      if (isNaN(farVal) || farVal <= 0) {
        farInput.focus();
        return false;
      }
      if (isNaN(nearVal) || nearVal <= 0) {
        nearInput.focus();
        return false;
      }
      if (farVal <= nearVal) {
        _notify('Khoảng cách Nhìn Xa phải LỚN HƠN Nhìn Gần', 'error');
        return false;
      }
      return true;
    };

    // Clamp về giới hạn an toàn lâm sàng: Xa [2, 6] m, Gần [0.2, 0.8] m
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    // ---- Lưu chung cho cả 2 nút; trả về true nếu thành công ----
    const commit = () => {
      const rawFar = parseFloat(farInput.value);
      const rawNear = parseFloat(nearInput.value);

      if (isNaN(rawFar) || rawFar <= 0) {
        farInput.focus();
        return false;
      }
      if (isNaN(rawNear) || rawNear <= 0) {
        nearInput.focus();
        return false;
      }

      // Kẹp về giới hạn an toàn trước khi validation Xa > Gần
      const farVal = clamp(rawFar, FAR_MIN_M, FAR_MAX_M);
      const nearVal = clamp(rawNear, NEAR_MIN_M, NEAR_MAX_M);
      const clamped = farVal !== rawFar || nearVal !== rawNear;

      if (clamped) {
        // Phản ánh lại giá trị đã kẹp lên ô input + thông báo
        farInput.value = String(farVal);
        nearInput.value = String(nearVal);
        syncPresetActive();
        _notify(
          `Đã điều chỉnh về giới hạn an toàn lâm sàng (Xa: ${FAR_MIN_M}–${FAR_MAX_M}m, Gần: ${NEAR_MIN_M}–${NEAR_MAX_M}m)`,
          'warning'
        );
      }

      if (!validate(farVal, nearVal)) return false;

      // Giữ nguyên nhóm (Xa/Gần) đang active để bài test đang hiển thị
      // không bị đổi kích thước đột ngột sau khi lưu cấu hình mới.
      const wasNear =
        Math.abs(this.distanceM - this.distanceNearM) <=
        Math.abs(this.distanceM - this.distanceFarM);

      // Lưu cả 2 giá trị xuống localStorage + cập nhật window.__calibrator
      this.saveDistanceSettings(farVal, nearVal);
      this.setDistance(wasNear ? nearVal : farVal);

      closeModal();

      // Re-render tức thì bài test đang active theo mốc vừa lưu
      try {
        document.dispatchEvent(new CustomEvent('calibrator:distance-settings-changed'));
      } catch (e) { /* ignore */ }

      return true;
    };

    // "Lưu & Đóng": chỉ lưu + đóng, KHÔNG bị ép mở hiệu chuẩn thẻ tín dụng
    saveBtn.addEventListener('click', () => {
      if (commit()) _notify('Đã lưu khoảng cách khám', 'success');
    });

    // "Hiệu chuẩn thẻ tín dụng": lưu rồi mở modal thẻ tín dụng
    ccBtn.addEventListener('click', () => {
      if (commit() && window.__ccCal) {
        window.__ccCal.showModal();
      }
    });

    // Focus input
    setTimeout(() => farInput.focus(), 100);
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
export { DisplayCalibrator, getOptotypeSize, getActiveNearDistanceM };
