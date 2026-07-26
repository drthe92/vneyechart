/**
 * dynamic_vergence.js — Dynamic Fusional Vergence Test (Anaglyph)
 *
 * Lâm sàng: Đo biên độ hợp thị động (Dynamic Fusional Vergence Amplitude)
 * Kỹ thuật: Kính Anaglyph Đỏ (Mắt phải) - Xanh Cyan (Mắt trái)
 * Thuật toán: Tách kênh màu với CSS mix-blend-mode: screen
 *
 * Luồng 3 pha:
 *   Pha 1 (Intro): Hướng dẫn + Checkbox "Không hiển thị lại" (localStorage)
 *   Pha 2 (Test): Nền đen, 3-4 chữ cái tâm màn hình, điều khiển lăng kính
 *   Pha 3 (Result): Tổng kết 3 chỉ số (Blur/Break/Recovery), dispatch CustomEvent
 *
 * Điều khiển:
 *   Mũi tên Trái/Phải hoặc Cuộn chuột: Tăng/Giảm lăng kính (1Δ bước nhảy)
 *   Enter hoặc Chuột phải: Ghi nhận 3 mốc (Mờ -> Vỡ -> Phục hồi)
 *
 * Toán học Lăng kính:
 *   1Δ = 1cm độ lệch tại khoảng cách 1 mét
 *   Độ lệch pixel = (_currentPrism / 2) * 10 * ccPxPerMm
 *   Base-Out (BO): Đỏ sang Trái, Xanh sang Phải (Kích thích Quy tụ)
 *   Base-In (BI): Đỏ sang Phải, Xanh sang Trái (Kích thích Phân kỳ)
 *
 * Module id = 'dynamic-vergence'
 */

// ================================================================
//  Constants
// ================================================================

/** localStorage key for hiding intro guide */
const DYNAMIC_VERGENCE_GUIDE_KEY = 'hide-dynamic-vergence-guide';

/** Anaglyph layer colors */
const RED_CHANNEL_COLOR = '#FF0000';
const CYAN_CHANNEL_COLOR = '#00FFFF';

/** Background color during test (absolute black for zero distraction) */
const TEST_BG_COLOR = '#000000';

/** Prism step size in diopters */
const PRISM_STEP = 1;

/** Default ccPxPerMm if not found in localStorage */
const DEFAULT_CC_PX_PER_MM = 3.78; // ~96 DPI

/** Record steps for vergence test */
const RECORD_STEPS = ['blur', 'break', 'recovery'];

/** Letters displayed during test */
const TEST_LETTERS = ['E', 'T', 'V'];

/** HUD display duration in ms */
const HUD_DURATION = 1000;

// ================================================================
//  Dynamic Vergence Module
// ================================================================

const dynamicVergence = {
  id: 'dynamic-vergence',
  label: 'Biên độ Hợp thị Động',

  /** Flag to indicate this module uses custom controls and needs UniversalInput suspended */
  customControls: true,

  /** Steps array (required by framework) */
  steps: ['test'],

  /** Current state: 'intro', 'test', or 'result' */
  _state: 'intro',

  /** Display board element */
  _board: null,

  /** Intro modal element reference */
  _introModal: null,

  /** Result modal element reference */
  _resultModal: null,

  /** Anaglyph layer elements */
  _redLayer: null,
  _cyanLayer: null,

  /** Current prism value in diopters (starts at 0) */
  _currentPrism: 0,

  /** Direction: 'BO' (Base-Out) or 'BI' (Base-In) */
  _direction: 'BO',

  /** Record steps array */
  _recordSteps: RECORD_STEPS,

  /** Current step index for recording */
  _stepIndex: 0,

  /** Results object */
  _results: {},

  /** Bound event handlers (for cleanup) */
  _boundKeydown: null,
  _boundContextMenu: null,
  _boundWheel: null,

  /** HUD timeout ID */
  _hudTimeoutId: null,

  /** ccPxPerMm value from localStorage */
  _ccPxPerMm: DEFAULT_CC_PX_PER_MM,

  /**
   * Get ccPxPerMm from localStorage.
   * @returns {number}
   * @private
   */
  _getPxPerMm() {
    try {
      const stored = localStorage.getItem('ccPxPerMm');
      if (stored) {
        const val = parseFloat(stored);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch (e) {
      console.warn('[DynamicVergence] Cannot read ccPxPerMm from localStorage:', e);
    }
    return DEFAULT_CC_PX_PER_MM;
  },

  /**
   * Calculate pixel offset for one eye channel.
   * Formula: offset = (_currentPrism / 2) * 10 * ccPxPerMm
   * The /2 splits the prism between both eyes.
   * The *10 converts cm to mm (1cm = 10mm).
   * @returns {number} Pixel offset for one channel
   * @private
   */
  _calcChannelOffset() {
    return (this._currentPrism / 2) * 10 * this._ccPxPerMm;
  },

  /**
   * Update the position of anaglyph layers based on current prism.
   * Base-Out (BO): Red (right eye) shifts Left, Cyan (left eye) shifts Right
   * Base-In (BI): Red (right eye) shifts Right, Cyan (left eye) shifts Left
   * @private
   */
  _updateLayers() {
    if (!this._redLayer || !this._cyanLayer) return;

    const offset = this._calcChannelOffset();

    if (this._direction === 'BO') {
      // Base-Out: Red shifts Left (negative X), Cyan shifts Right (positive X)
      this._redLayer.style.transform = `translateX(${-offset}px)`;
      this._cyanLayer.style.transform = `translateX(${offset}px)`;
    } else {
      // Base-In: Red shifts Right (positive X), Cyan shifts Left (negative X)
      this._redLayer.style.transform = `translateX(${offset}px)`;
      this._cyanLayer.style.transform = `translateX(${-offset}px)`;
    }
  },

  /**
   * Create the anaglyph layers (Red and Cyan channels).
   * Uses CSS mix-blend-mode: screen so overlapping areas appear white.
   * @private
   */
  _createAnaglyphLayers() {
    // Container for layers
    const container = document.createElement('div');
    container.id = 'dynamic-vergence-layers';
    container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Red channel layer (for right eye with red filter)
    this._redLayer = document.createElement('div');
    this._redLayer.id = 'dynamic-vergence-red';
    this._redLayer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      mix-blend-mode: screen;
      pointer-events: none;
      z-index: 1;
    `;

    // Cyan channel layer (for left eye with cyan filter)
    this._cyanLayer = document.createElement('div');
    this._cyanLayer.id = 'dynamic-vergence-cyan';
    this._cyanLayer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      mix-blend-mode: screen;
      pointer-events: none;
      z-index: 2;
    `;

    // Create letter columns for each layer
    const redLetters = this._createLetterColumn(RED_CHANNEL_COLOR);
    const cyanLetters = this._createLetterColumn(CYAN_CHANNEL_COLOR);

    this._redLayer.appendChild(redLetters);
    this._cyanLayer.appendChild(cyanLetters);

    container.appendChild(this._redLayer);
    container.appendChild(this._cyanLayer);

    this._board.appendChild(container);
  },

  /**
   * Create a column of letters with specified color.
   * @param {string} color - CSS color string
   * @returns {HTMLElement}
   * @private
   */
  _createLetterColumn(color) {
    const column = document.createElement('div');
    column.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 40px;
      font-family: Arial, sans-serif;
      font-weight: bold;
      font-size: 120px;
      color: ${color};
      user-select: none;
    `;

    TEST_LETTERS.forEach(letter => {
      const span = document.createElement('div');
      span.textContent = letter;
      span.style.cssText = 'line-height: 1;';
      column.appendChild(span);
    });

    return column;
  },

  /**
   * Show HUD notification at corner of screen.
   * Auto-removes after HUD_DURATION ms to maintain zero distraction.
   * @param {string} text - Text to display
   * @private
   */
  _showHUD(text) {
    let hud = document.getElementById('dynamic-vergence-hud');

    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'dynamic-vergence-hud';
      hud.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 9999;
        pointer-events: none;
        transition: opacity 0.3s;
      `;
      document.body.appendChild(hud);
    }

    hud.textContent = text;

    // Reset timeout
    if (this._hudTimeoutId) {
      clearTimeout(this._hudTimeoutId);
    }

    // Auto-remove after duration
    this._hudTimeoutId = setTimeout(() => {
      this._clearHUD();
    }, HUD_DURATION);
  },

  /**
   * Clear HUD element.
   * @private
   */
  _clearHUD() {
    if (this._hudTimeoutId) {
      clearTimeout(this._hudTimeoutId);
      this._hudTimeoutId = null;
    }
    const hud = document.getElementById('dynamic-vergence-hud');
    if (hud) hud.remove();
  },

  /**
   * Show intro screen with modal overlay.
   * @private
   */
  _showIntro() {
    console.log('[DynamicVergence] Showing intro screen');

    // Check localStorage preference
    const hideGuide = localStorage.getItem(DYNAMIC_VERGENCE_GUIDE_KEY);
    if (hideGuide === 'true') {
      this._startTest();
      return;
    }

    // Set state to intro
    this._state = 'intro';

    // Clear board
    this._board.innerHTML = '';
    this._board.style.backgroundColor = '#2a2a2a';
    this._board.style.position = 'relative';
    this._board.style.overflow = 'hidden';

    // Create modal overlay
    this._introModal = document.createElement('div');
    this._introModal.id = 'dynamic-vergence-intro-modal';
    this._introModal.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(40, 40, 40, 0.95);
      border: 2px solid #808080;
      border-radius: 12px;
      padding: 40px;
      max-width: 700px;
      width: 90%;
      color: white;
      font-family: Arial, sans-serif;
      text-align: center;
      z-index: 1000;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;

    // Modal content
    this._introModal.innerHTML = `
      <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #ffffff;">Biên độ Hợp thị Động (Anaglyph)</h2>
      <div style="text-align: left; margin: 20px 0; line-height: 1.8; font-size: 16px;">
        <p><strong>Chuẩn bị:</strong></p>
        <ul style="list-style: none; padding: 0;">
          <li style="margin: 10px 0;">🔴 Đeo kính: <strong>Mắt Phải = Đỏ</strong>, <strong>Mắt Trái = Xanh</strong></li>
          <li style="margin: 10px 0;">👁️ Nhìn vào mục tiêu chữ cái ở giữa màn hình</li>
        </ul>
        <p><strong>Điều khiển:</strong></p>
        <ul style="list-style: none; padding: 0;">
          <li style="margin: 10px 0;">⬅️➡️ <strong>Mũi tên Trái/Phải</strong> hoặc <strong>Cuộn chuột</strong>: Tách hình (Tăng/Giảm Lăng kính)</li>
          <li style="margin: 10px 0;">⏎ <strong>Enter</strong> hoặc <strong>Chuột phải</strong>: Ghi nhận 3 mốc</li>
          <li style="margin: 10px 0;">📊 <strong>3 mốc</strong>: Mờ (Blur) → Vỡ (Break) → Phục hồi (Recovery)</li>
        </ul>
        <p><strong>Chỉ định lâm sàng:</strong></p>
        <ul style="list-style: none; padding: 0;">
          <li style="margin: 10px 0;">• Base-Out (BO): Kích thích Quy tụ (Convergence)</li>
          <li style="margin: 10px 0;">• Base-In (BI): Kích thích Phân kỳ (Divergence)</li>
        </ul>
      </div>
      <div style="margin: 20px 0; text-align: left;">
        <label style="cursor: pointer; font-size: 14px; color: #cccccc;">
          <input type="checkbox" id="dynamic-vergence-hide-guide" style="margin-right: 8px; cursor: pointer;">
          Không hiển thị lại thông báo này
        </label>
      </div>
      <button id="dynamic-vergence-start-btn" style="
        background: #808080;
        color: white;
        border: none;
        padding: 12px 40px;
        font-size: 18px;
        border-radius: 6px;
        cursor: pointer;
        margin-top: 10px;
        transition: background 0.2s;
      " onmouseover="this.style.background='#666666'" onmouseout="this.style.background='#808080'">
        Bắt đầu Test
      </button>
    `;

    this._board.appendChild(this._introModal);

    // Bind button click
    const startBtn = document.getElementById('dynamic-vergence-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const checkbox = document.getElementById('dynamic-vergence-hide-guide');
        if (checkbox && checkbox.checked) {
          localStorage.setItem(DYNAMIC_VERGENCE_GUIDE_KEY, 'true');
        }
        this._removeIntro();
        this._startTest();
      });
    }
  },

  /**
   * Remove intro modal from DOM.
   * @private
   */
  _removeIntro() {
    if (this._introModal) {
      this._introModal.remove();
      this._introModal = null;
    }
  },

  /**
   * Start the test phase.
   * @private
   */
  _startTest() {
    console.log('[DynamicVergence] Starting test phase');

    // Set state to test
    this._state = 'test';

    // Reset state
    this._currentPrism = 0;
    this._stepIndex = 0;
    this._results = {};

    // Read calibration value
    this._ccPxPerMm = this._getPxPerMm();
    console.log('[DynamicVergence] ccPxPerMm =', this._ccPxPerMm);

    // Clear board and set black background (zero distraction)
    this._board.innerHTML = '';
    this._board.style.backgroundColor = TEST_BG_COLOR;
    this._board.style.position = 'relative';
    this._board.style.overflow = 'hidden';

    // Create anaglyph layers
    this._createAnaglyphLayers();

    // Update layers to initial position (0 prism)
    this._updateLayers();

    // Show current prism value as HUD
    this._showHUD(`Lăng kính: ${this._currentPrism}Δ (${this._direction})`);

    // Bind event handlers
    this._boundKeydown = this._onKeydown.bind(this);
    this._boundContextMenu = this._onContextMenu.bind(this);
    this._boundWheel = this._onWheel.bind(this);

    document.addEventListener('keydown', this._boundKeydown);
    document.addEventListener('contextmenu', this._boundContextMenu);
    document.addEventListener('wheel', this._boundWheel, { passive: false });

    console.log('[DynamicVergence] Test started');
  },


  /**
   * Adjust prism value.
   * @param {number} delta - Change in prism diopters
   * @private
   */
  _adjustPrism(delta) {
    this._currentPrism = Math.max(0, this._currentPrism + delta);
    this._showHUD(`Lăng kính: ${this._currentPrism}Δ (${this._direction})`);
  },

  /**
   * Record current prism value for current step.
   * @private
   */
  _recordStep() {
    const stepName = this._recordSteps[this._stepIndex];
    this._results[stepName] = this._currentPrism;

    console.log(`[DynamicVergence] Recorded ${stepName}: ${this._currentPrism}Δ`);

    this._showHUD(`Đã ghi nhận điểm: ${stepName.toUpperCase()}`);

    this._stepIndex++;

    // Check if all 3 steps recorded
    if (this._stepIndex >= this._recordSteps.length) {
      // All steps recorded, go to result
      setTimeout(() => {
        this._showResult();
      }, HUD_DURATION);
    }
  },

  /**
   * Show result screen.
   * @private
   */
  _showResult() {
    console.log('[DynamicVergence] Showing result screen');

    // Set state to result
    this._state = 'result';

    // Clear board
    this._board.innerHTML = '';
    this._board.style.backgroundColor = '#2a2a2a';
    this._board.style.position = 'relative';
    this._board.style.overflow = 'hidden';

    // Create result modal
    this._resultModal = document.createElement('div');
    this._resultModal.id = 'dynamic-vergence-result-modal';
    this._resultModal.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(40, 40, 40, 0.95);
      border: 2px solid #808080;
      border-radius: 12px;
      padding: 40px;
      max-width: 600px;
      width: 90%;
      color: white;
      font-family: Arial, sans-serif;
      text-align: center;
      z-index: 1000;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;

    const blurVal = this._results.blur !== undefined ? this._results.blur : 'N/A';
    const breakVal = this._results.break !== undefined ? this._results.break : 'N/A';
    const recoveryVal = this._results.recovery !== undefined ? this._results.recovery : 'N/A';

    this._resultModal.innerHTML = `
      <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #ffffff;">Kết quả Biên độ Hợp thị Động</h2>
      <div style="text-align: left; margin: 20px 0; line-height: 2; font-size: 18px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #555; padding: 8px 0;">
          <span>🔵 Điểm Mờ (Blur):</span>
          <span style="font-weight: bold; color: #00FFFF;">${blurVal}Δ</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #555; padding: 8px 0;">
          <span>🔴 Điểm Vỡ (Break):</span>
          <span style="font-weight: bold; color: #FF6B6B;">${breakVal}Δ</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #555; padding: 8px 0;">
          <span>🟢 Điểm Phục hồi (Recovery):</span>
          <span style="font-weight: bold; color: #6BFF6B;">${recoveryVal}Δ</span>
        </div>
      </div>
      <p style="font-size: 14px; color: #aaaaaa; margin: 20px 0;">
        Nhấn <strong>Enter</strong> để lưu kết quả và kết thúc test.
      </p>
      <button id="dynamic-vergence-save-btn" style="
        background: #808080;
        color: white;
        border: none;
        padding: 12px 40px;
        font-size: 18px;
        border-radius: 6px;
        cursor: pointer;
        margin-top: 10px;
        transition: background 0.2s;
      " onmouseover="this.style.background='#666666'" onmouseout="this.style.background='#808080'">
        Lưu kết quả (Enter)
      </button>
    `;

    this._board.appendChild(this._resultModal);

    // Bind save button
    const saveBtn = document.getElementById('dynamic-vergence-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this._dispatchResult();
      });
    }

    // Bind Enter key for result screen
    this._boundKeydown = this._onKeydown.bind(this);
    document.addEventListener('keydown', this._boundKeydown);
  },

  /**
   * Dispatch CustomEvent with test results and cleanup.
   * @private
   */
  _dispatchResult() {
    const payload = {
      test_type: 'Dynamic_Fusional_Vergence',
      eye_tested: 'OU',
      clinical_metrics: {
        blur: this._results.blur !== undefined ? this._results.blur : null,
        break: this._results.break !== undefined ? this._results.break : null,
        recovery: this._results.recovery !== undefined ? this._results.recovery : null
      }
    };

    console.log('[DynamicVergence] Dispatching visionTestCompleted with payload:', payload);

    // Dispatch CustomEvent
    const event = new CustomEvent('visionTestCompleted', {
      detail: payload,
      bubbles: true
    });
    document.dispatchEvent(event);

    // Cleanup
    this.cleanup();
  },

  /**
   * Keydown event handler.
   * @param {KeyboardEvent} e
   * @private
   */
  _onKeydown(e) {
    if (this._state === 'intro') return;

    if (this._state === 'test') {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this._adjustPrism(-PRISM_STEP);
          this._updateLayers();
          break;

        case 'ArrowRight':
          e.preventDefault();
          this._adjustPrism(PRISM_STEP);
          this._updateLayers();
          break;

        case 'Enter':
          e.preventDefault();
          this._recordStep();
          break;

        case 'Escape':
          e.preventDefault();
          this.cleanup();
          break;
      }
    } else if (this._state === 'result') {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._dispatchResult();
      }
    }
  },


  /**
   * Context menu event handler (right click to record step).
   * @param {MouseEvent} e
   * @private
   */
  _onContextMenu(e) {
    if (this._state !== 'test') return;

    e.preventDefault();
    this._recordStep();
  },

  /**
   * Mouse wheel event handler (to adjust prism).
   * @param {WheelEvent} e
   * @private
   */
  _onWheel(e) {
    if (this._state !== 'test') return;

    e.preventDefault();

    if (e.deltaY < 0) {
      // Scroll up: increase prism
      this._adjustPrism(PRISM_STEP);
    } else {
      // Scroll down: decrease prism
      this._adjustPrism(-PRISM_STEP);
    }

    this._updateLayers();
  },

  /**
   * Render method called by framework.
   * @param {number} idx - Step index
   */
  render(idx) {
    console.log('[DynamicVergence] render() called, state:', this._state);

    this._board = document.getElementById('display-board');
    if (!this._board) {
      console.error('[DynamicVergence] display-board not found!');
      return;
    }

    // Read calibration value
    this._ccPxPerMm = this._getPxPerMm();

    // Show intro or start test directly
    this._showIntro();
  },

  /**
   * Cleanup function to remove all event listeners and DOM elements.
   * Called by framework when switching tests.
   */
  cleanup() {
    console.log('[DynamicVergence] cleanup() called');

    // Clear HUD
    this._clearHUD();

    // Remove event listeners
    if (this._boundKeydown) {
      document.removeEventListener('keydown', this._boundKeydown);
      this._boundKeydown = null;
    }

    if (this._boundContextMenu) {
      document.removeEventListener('contextmenu', this._boundContextMenu);
      this._boundContextMenu = null;
    }

    if (this._boundWheel) {
      document.removeEventListener('wheel', this._boundWheel);
      this._boundWheel = null;
    }

    // Remove DOM elements
    const layers = document.getElementById('dynamic-vergence-layers');
    if (layers) layers.remove();

    const introModal = document.getElementById('dynamic-vergence-intro-modal');
    if (introModal) introModal.remove();

    const resultModal = document.getElementById('dynamic-vergence-result-modal');
    if (resultModal) resultModal.remove();

    // Clear board
    if (this._board) {
      this._board.innerHTML = '';
      this._board.style.backgroundColor = '';
      this._board.style.position = '';
      this._board.style.overflow = '';
    }

    // Reset state
    this._state = 'intro';
    this._currentPrism = 0;
    this._stepIndex = 0;
    this._results = {};
    this._redLayer = null;
    this._cyanLayer = null;
    this._introModal = null;
    this._resultModal = null;

    console.log('[DynamicVergence] cleanup complete');
  },
};

export default dynamicVergence;
