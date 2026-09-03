/**
 * DisplayManager — Quản lý hiển thị bằng CSS filter.
 *
 * Cung cấp 3 preset hiển thị:
 *   - 'standard'     (Mặc định)
 *   - 'highContrast' (Tương phản cao)
 *   - 'lowGlare'     (Giảm chói, giảm độ sáng)
 *
 * Preset được lưu vào localStorage và tự động khôi phục khi load lại trang.
 *
 * LƯU Ý (Tái cấu trúc UX/UI): Class này KHÔNG còn chứa bất kỳ mã HTML/DOM nào.
 * Toàn bộ giao diện chọn preset đã được chuyển vào Modal "Cấu hình phòng khám"
 * (xem js/exam_session_manager.js → openClinicSettingsModal).
 */

// ================================================================
//  CSS Filter Presets
// ================================================================

const PRESETS = {
  standard: {
    key: 'standard',
    label: 'Standard',
    description: 'Mặc định',
    filter: 'none',
    icon: '🌞',
  },
  highContrast: {
    key: 'highContrast',
    label: 'High Contrast',
    description: 'Tương phản cao',
    filter: 'contrast(1.35) brightness(1.1) saturate(1.15)',
    icon: '🔆',
  },
  lowGlare: {
    key: 'lowGlare',
    label: 'Low Glare',
    description: 'Giảm chói, giảm độ sáng',
    filter: 'brightness(0.82) contrast(0.92) saturate(0.88)',
    icon: '🌙',
  },
};

const STORAGE_KEY = 'vision-therapy-display-preset';
const DEFAULT_PRESET = 'standard';

// ================================================================
//  DisplayManager
// ================================================================

class DisplayManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.targetSelector='#app']  Element được áp filter.
   * @param {boolean} [options.autoApply=true]          Tự động áp preset từ localStorage.
   */
  constructor(options = {}) {
    this.targetSelector = options.targetSelector || '#app';
    this.autoApply      = options.autoApply !== false;

    /** @type {string} Key của preset hiện tại. */
    this.currentPreset = DEFAULT_PRESET;

    /** @type {HTMLElement|null} */
    this._targetEl = null;

    // Auto-apply on construction
    if (this.autoApply) {
      // Wait for DOM if not ready
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
    this._targetEl = document.querySelector(this.targetSelector);
    if (!this._targetEl) {
      console.warn(`[DisplayManager] Target "${this.targetSelector}" not found.`);
      return;
    }
    this._loadFromStorage();
  }

  // ================================================================
  //  Apply Preset
  // ================================================================

  /**
   * Áp dụng một preset.
   * @param {string} presetKey  'standard' | 'highContrast' | 'lowGlare'
   * @returns {boolean}  true nếu thành công.
   */
  applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) {
      console.warn(`[DisplayManager] Unknown preset: "${presetKey}"`);
      return false;
    }

    this.currentPreset = presetKey;

    if (this._targetEl) {
      this._targetEl.style.filter = preset.filter;
      // Also apply to #main-area for more precise control
      const mainArea = document.querySelector('#main-area');
      if (mainArea) {
        mainArea.style.filter = preset.filter;
      }
    }

    // Lưu vào localStorage
    try {
      localStorage.setItem(STORAGE_KEY, presetKey);
    } catch (e) {
      // localStorage may be unavailable in some contexts
    }

    return true;
  }

  /**
   * Lấy thông tin preset hiện tại.
   * @returns {Object}
   */
  getCurrentPreset() {
    return { ...PRESETS[this.currentPreset] };
  }

  /**
   * Lấy danh sách tất cả preset.
   * @returns {Object}
   */
  getPresets() {
    return { ...PRESETS };
  }

  // ================================================================
  //  Storage
  // ================================================================

  /** @private */
  _loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && PRESETS[saved]) {
        this.applyPreset(saved);
        return;
      }
    } catch (e) {
      // ignore
    }
    // Fallback: apply default
    this.applyPreset(DEFAULT_PRESET);
  }
}

// ================================================================
//  Export
// ================================================================
export default DisplayManager;
export { DisplayManager, PRESETS };
