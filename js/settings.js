/**
 * DisplayManager — Quản lý hiển thị bằng CSS filter.
 *
 * Cung cấp 3 preset hiển thị:
 *   - 'standard'     (Mặc định)
 *   - 'highContrast' (Tương phản cao)
 *   - 'lowGlare'     (Giảm chói, giảm độ sáng)
 *
 * Preset được lưu vào localStorage và tự động khôi phục khi load lại trang.
 * Khi click icon Settings trên Sidebar, hiện modal nhỏ để chọn preset.
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

    /** @type {HTMLDivElement|null} */
    this._modalOverlay = null;

    /** @private */
    this._boundKeydown = this._onModalKeydown.bind(this);

    /** @private Custom footer action (vd: mở modal hiệu chỉnh) */
    this._footerActions = [];

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

  /**
   * Thêm một nút hành động vào footer của modal settings.
   * @param {string}   label    Nội dung nút
   * @param {Function} callback Hàm gọi khi click
   */
  addFooterAction(label, callback) {
    this._footerActions.push({ label, callback });
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

    console.log(
      `%c[DisplayManager]%c ${preset.label}  —  ${preset.filter}`,
      'color:#4a90d9; font-weight:700;',
      'color:#555; font-weight:400;'
    );

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

  // ================================================================
  //  Modal
  // ================================================================

  /**
   * Gắn sự kiện click cho Settings button trên Sidebar.
   * Gọi hàm này sau khi DOM sẵn sàng.
   */
  wireSettingsButton() {
    const btn = document.getElementById('settings-btn');
    if (!btn) {
      console.warn('[DisplayManager] #settings-btn not found in DOM.');
      return;
    }
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showModal();
    });
  }

  /**
   * Hiển thị modal chọn preset.
   */
  showModal() {
    // Chỉ tạo một modal duy nhất
    if (this._modalOverlay) return;

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'settings-modal-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hideModal();
    });

    // Modal box
    const box = document.createElement('div');
    box.className = 'settings-modal-box';

    // Header
    const header = document.createElement('div');
    header.className = 'settings-modal-header';
    header.innerHTML = '<span class="settings-modal-title">Cài đặt hiển thị</span>';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'settings-modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Đóng');
    closeBtn.addEventListener('click', () => this.hideModal());
    header.appendChild(closeBtn);
    box.appendChild(header);

    // Preset list
    const list = document.createElement('div');
    list.className = 'settings-preset-list';

    Object.values(PRESETS).forEach((preset) => {
      const isActive = preset.key === this.currentPreset;
      const item = document.createElement('button');
      item.className = `settings-preset-btn${isActive ? ' active' : ''}`;
      item.dataset.preset = preset.key;

      item.innerHTML = `
        <span class="settings-preset-icon">${preset.icon}</span>
        <span class="settings-preset-info">
          <span class="settings-preset-label">${preset.label}</span>
          <span class="settings-preset-desc">${preset.description}</span>
        </span>
        <span class="settings-preset-check">${isActive ? '✓' : ''}</span>
      `;

      item.addEventListener('click', () => {
        this.applyPreset(preset.key);
        this._updateModalSelection();
      });

      list.appendChild(item);
    });

    box.appendChild(list);

    // -- Footer actions --
    if (this._footerActions.length > 0) {
      const footer = document.createElement('div');
      footer.className = 'settings-modal-footer';
      this._footerActions.forEach((action) => {
        const btn = document.createElement('button');
        btn.className = 'settings-modal-footer-btn';
        btn.textContent = action.label;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          action.callback();
        });
        footer.appendChild(btn);
      });
      box.appendChild(footer);
    }

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    this._modalOverlay = overlay;

    // Đóng modal bằng phím Escape
    document.addEventListener('keydown', this._boundKeydown);

    // Focus vào modal để accessibility
    requestAnimationFrame(() => box.focus?.());
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
    if (e.key === 'Escape') {
      this.hideModal();
    }
  }

  /** @private */
  _updateModalSelection() {
    if (!this._modalOverlay) return;
    const btns = this._modalOverlay.querySelectorAll('.settings-preset-btn');
    btns.forEach((btn) => {
      const isActive = btn.dataset.preset === this.currentPreset;
      btn.classList.toggle('active', isActive);
      const check = btn.querySelector('.settings-preset-check');
      if (check) check.textContent = isActive ? '✓' : '';
    });
  }

  /**
   * Dọn dẹp: ẩn modal nếu đang mở.
   */
  destroy() {
    this.hideModal();
  }
}

// ================================================================
//  Export
// ================================================================
export default DisplayManager;
export { DisplayManager, PRESETS };