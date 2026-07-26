/**
 * hiding_heidi.js — Pediatric Face Contrast Test (Preferential Looking)
 *
 * Clinical module implementing the Hiding Heidi test using Preferential Looking paradigm.
 * Measures contrast detection threshold in pediatric patients using Staircase algorithm.
 *
 * Features:
 *   - State machine: 'intro' -> 'test' -> 'result'
 *   - Intro screen with modal overlay and localStorage preference
 *   - 50% Gray background (#808080) during test
 *   - 4-quadrant positioning system (25%, 75% for both X and Y)
 *   - Staircase algorithm with fail counting (_failCounts)
 *   - Clinical contrast levels: 100%, 25%, 10%, 5%, 2.5%, 1.25%
 *   - Color interpolation between Black (#000000) and Background Gray (#808080)
 *   - Left Click: Child correct (decrease contrast, randomize position)
 *   - Right Click: Child incorrect (increase contrast or end test if 2 failures)
 *   - Result screen with threshold display and save button
 *   - No pink cheeks, thick strokes (16px), round linecaps
 *   - Cleanup function for proper garbage collection
 *
 * Module id = 'hiding-heidi'
 */

// ================================================================
//  Constants
// ================================================================

const HEIDI_BG_COLOR = '#808080';
const HEIDI_BLACK = '#000000';
const HEIDI_GRAY = '#808080';

/** localStorage key for hiding intro guide */
const HEIDI_GUIDE_KEY = 'hide-heidi-guide';

/** Clinical contrast levels (percent) - descending staircase */
const CONTRAST_LEVELS = [100, 25, 10, 5, 2.5, 1.25];

/** SVG face dimensions (viewBox units) */
const FACE_VIEWBOX_SIZE = 400;

/** Stroke width for SVG elements - thick for low spatial frequency */
const STROKE_WIDTH = 16;

/** Stroke linecap for rounded ends */
const STROKE_LINECAP = 'round';
const STROKE_LINEJOIN = 'round';

// ================================================================
//  Hiding Heidi Module
// ================================================================

const hidingHeidi = {
  id: 'hiding-heidi',
  label: 'Độ nhạy tương phản (Heidi)',

  /** Flag to indicate this module uses custom controls and needs UniversalInput suspended */
  customControls: true,

  /** Steps array (required by framework) */
  steps: ['test'],

  /** Current state: 'intro', 'test', or 'result' */
  _state: 'intro',

  /** SVG element reference */
  _svg: null,

  /** Intro modal element reference */
  _introModal: null,

  /** Result modal element reference */
  _resultModal: null,

  /** Current contrast level index */
  _contrastIndex: 0,

  /** Fail counts at each contrast level */
  _failCounts: {},

  /** Current face position: 'q1', 'q2', 'q3', or 'q4' */
  _facePosition: 'q1',

  /** Final threshold value (for result screen) */
  _finalThreshold: null,

  /** Bound event handlers (for cleanup) */
  _boundKeydown: null,
  _boundContextMenu: null,
  _boundClick: null,

  /** Display board element */
  _board: null,

  /**
   * Interpolate color between gray background and black based on contrast percent.
   * @param {number} contrastPercent - Contrast level (0-100)
   * @returns {string} CSS color string
   * @private
   */
  _interpolateColor(contrastPercent) {
    const ratio = contrastPercent / 100;
    const gray = 128;
    const black = 0;
    const value = Math.round(gray + (black - gray) * ratio);
    return `rgb(${value}, ${value}, ${value})`;
  },

  /**
   * Get current contrast percent.
   * @returns {number}
   * @private
   */
  _getCurrentContrast() {
    return CONTRAST_LEVELS[this._contrastIndex];
  },

  /**
   * Create happy SVG Heidi face element designed for children.
   * Features: Thick strokes, round linecaps, big friendly features, hair tuft.
   * NO PINK CHEEKS - strictly follows interpolation color only.
   * @param {string} color - Stroke/fill color from interpolation algorithm
   * @returns {SVGElement}
   * @private
   */
  _createFaceSVG(color) {
    const svgNS = 'http://www.w3.org/2000/svg';

    // Create main SVG element
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${FACE_VIEWBOX_SIZE} ${FACE_VIEWBOX_SIZE}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.cssText = 'display: block;';

    // Define styles for thick, rounded strokes - NO CHEEKS ALLOWED
    const style = document.createElementNS(svgNS, 'style');
    style.textContent = `
      .heidi-stroke { stroke: ${color}; stroke-width: ${STROKE_WIDTH}; stroke-linecap: ${STROKE_LINECAP}; stroke-linejoin: ${STROKE_LINEJOIN}; fill: none; }
      .heidi-fill { fill: ${color}; stroke: none; }
    `;
    svg.appendChild(style);

    // Create face circle (head) - large and friendly
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', FACE_VIEWBOX_SIZE / 2);
    circle.setAttribute('cy', FACE_VIEWBOX_SIZE / 2);
    circle.setAttribute('r', 150);
    circle.setAttribute('class', 'heidi-stroke');
    svg.appendChild(circle);

    // Create hair tuft (3 curved strokes on top) - signature Heidi look
    const hairTuft1 = document.createElementNS(svgNS, 'path');
    hairTuft1.setAttribute('d', `M 160 90 Q 170 50 180 90`);
    hairTuft1.setAttribute('class', 'heidi-stroke');
    hairTuft1.setAttribute('stroke-width', '12');
    svg.appendChild(hairTuft1);

    const hairTuft2 = document.createElementNS(svgNS, 'path');
    hairTuft2.setAttribute('d', `M 190 80 Q 200 40 210 80`);
    hairTuft2.setAttribute('class', 'heidi-stroke');
    hairTuft2.setAttribute('stroke-width', '12');
    svg.appendChild(hairTuft2);

    const hairTuft3 = document.createElementNS(svgNS, 'path');
    hairTuft3.setAttribute('d', `M 220 90 Q 230 50 240 90`);
    hairTuft3.setAttribute('class', 'heidi-stroke');
    hairTuft3.setAttribute('stroke-width', '12');
    svg.appendChild(hairTuft3);

    // Create left eyebrow - curved upward (happy expression)
    const leftBrow = document.createElementNS(svgNS, 'path');
    leftBrow.setAttribute('d', `M 135 160 Q 160 140 185 160`);
    leftBrow.setAttribute('class', 'heidi-stroke');
    leftBrow.setAttribute('stroke-width', '10');
    svg.appendChild(leftBrow);

    // Create right eyebrow - curved upward (happy expression)
    const rightBrow = document.createElementNS(svgNS, 'path');
    rightBrow.setAttribute('d', `M 215 160 Q 240 140 265 160`);
    rightBrow.setAttribute('class', 'heidi-stroke');
    rightBrow.setAttribute('stroke-width', '10');
    svg.appendChild(rightBrow);

    // Create left eye - BIG round dot (Baby Schema: larger eyes = cuter)
    const leftEye = document.createElementNS(svgNS, 'circle');
    leftEye.setAttribute('cx', 160);
    leftEye.setAttribute('cy', 185);
    leftEye.setAttribute('r', 28);
    leftEye.setAttribute('class', 'heidi-fill');
    svg.appendChild(leftEye);

    // Create right eye - BIG round dot
    const rightEye = document.createElementNS(svgNS, 'circle');
    rightEye.setAttribute('cx', 240);
    rightEye.setAttribute('cy', 185);
    rightEye.setAttribute('r', 28);
    rightEye.setAttribute('class', 'heidi-fill');
    svg.appendChild(rightEye);

    // Create wide happy smiling mouth - DEEP and WIDE U-shape
    const mouth = document.createElementNS(svgNS, 'path');
    const mouthCY = 250;
    const mouthRX = 90;
    const mouthRY = 70;
    mouth.setAttribute('d', `M 110 ${mouthCY} A ${mouthRX} ${mouthRY} 0 0 1 290 ${mouthCY}`);
    mouth.setAttribute('class', 'heidi-stroke');
    mouth.setAttribute('stroke-width', '18');
    svg.appendChild(mouth);

    // Add smile lines/dimples at mouth corners
    const leftDimple = document.createElementNS(svgNS, 'path');
    leftDimple.setAttribute('d', `M 105 248 Q 100 255 105 262`);
    leftDimple.setAttribute('class', 'heidi-stroke');
    leftDimple.setAttribute('stroke-width', '8');
    svg.appendChild(leftDimple);

    const rightDimple = document.createElementNS(svgNS, 'path');
    rightDimple.setAttribute('d', `M 295 248 Q 300 255 295 262`);
    rightDimple.setAttribute('class', 'heidi-stroke');
    rightDimple.setAttribute('stroke-width', '8');
    svg.appendChild(rightDimple);

    return svg;
  },

  /**
   * Get quadrant coordinates (center point of each quadrant).
   * @returns {Object} { x: percentage, y: percentage }
   * @private
   */
  _getQuadrantCoords(quadrant) {
    switch (quadrant) {
      case 'q1': return { x: 25, y: 25 }; // Top-left
      case 'q2': return { x: 75, y: 25 }; // Top-right
      case 'q3': return { x: 25, y: 75 }; // Bottom-left
      case 'q4': return { x: 75, y: 75 }; // Bottom-right
      default: return { x: 25, y: 25 };
    }
  },

  /**
   * Position the face container to one of 4 quadrants.
   * @param {string} quadrant - 'q1', 'q2', 'q3', or 'q4'
   * @private
   */
  _positionFace(quadrant) {
    if (!this._svg) return;

    const container = this._svg.parentElement;
    if (!container) return;

    const coords = this._getQuadrantCoords(quadrant);
    container.style.left = `${coords.x}%`;
    container.style.top = `${coords.y}%`;
  },

  /**
   * Randomize face position to a DIFFERENT quadrant than current one.
   * @private
   */
  _randomizePosition() {
    const quadrants = ['q1', 'q2', 'q3', 'q4'];
    const currentIndex = quadrants.indexOf(this._facePosition);

    // Filter out current quadrant to ensure different position
    const available = quadrants.filter((_, idx) => idx !== currentIndex);

    // Randomly pick from available quadrants
    const randomIndex = Math.floor(Math.random() * available.length);
    this._facePosition = available[randomIndex];

    this._positionFace(this._facePosition);
  },

  /**
   * Update the face color based on current contrast level.
   * @private
   */
  _updateContrast() {
    if (!this._svg) return;

    const contrast = this._getCurrentContrast();
    const color = this._interpolateColor(contrast);

    // Update SVG styles - strictly use interpolated color only
    const styleEl = this._svg.querySelector('style');
    if (styleEl) {
      styleEl.textContent = `
        .heidi-stroke { stroke: ${color}; stroke-width: ${STROKE_WIDTH}; stroke-linecap: ${STROKE_LINECAP}; stroke-linejoin: ${STROKE_LINEJOIN}; fill: none; }
        .heidi-fill { fill: ${color}; stroke: none; }
      `;
    }
  },

  /**
   * Show intro screen with modal overlay.
   * @private
   */
  _showIntro() {
    console.log('[HidingHeidi] Showing intro screen');

    // Check localStorage preference
    const hideGuide = localStorage.getItem(HEIDI_GUIDE_KEY);
    if (hideGuide === 'true') {
      this._startTest();
      return;
    }

    // Set state to intro
    this._state = 'intro';

    // Clear board and set dark background
    this._board.innerHTML = '';
    this._board.style.backgroundColor = '#2a2a2a';
    this._board.style.position = 'relative';
    this._board.style.overflow = 'hidden';

    // Create modal overlay
    this._introModal = document.createElement('div');
    this._introModal.id = 'heidi-intro-modal';
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

    // Modal content with updated instructions for Staircase algorithm
    this._introModal.innerHTML = `
      <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #ffffff;">Khám Độ nhạy tương phản (Hiding Heidi)</h2>
      <div style="text-align: left; margin: 20px 0; line-height: 1.8; font-size: 16px;">
        <p><strong>Hướng dẫn thuật toán Bậc thang:</strong></p>
        <ul style="list-style: none; padding: 0;">
          <li style="margin: 10px 0;">🖱️ <strong>Chuột trái</strong>: Trẻ chỉ ĐÚNG (Chuyển vị trí, Giảm tương phản)</li>
          <li style="margin: 10px 0;">🖱️ <strong>Chuột phải</strong>: Trẻ chỉ SAI (Tăng tương phản để thử lại)</li>
          <li style="margin: 10px 0;">📊 <strong>Kết thúc</strong>: Tự động khi trẻ sai 2 lần cùng mức hoặc đạt mức thấp nhất</li>
        </ul>
      </div>
      <div style="margin: 20px 0; text-align: left;">
        <label style="cursor: pointer; font-size: 14px; color: #cccccc;">
          <input type="checkbox" id="heidi-hide-guide" style="margin-right: 8px; cursor: pointer;">
          Không hiển thị lại thông báo này
        </label>
      </div>
      <button id="heidi-start-btn" style="
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
    const startBtn = document.getElementById('heidi-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const checkbox = document.getElementById('heidi-hide-guide');
        if (checkbox && checkbox.checked) {
          localStorage.setItem(HEIDI_GUIDE_KEY, 'true');
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
   * Start the test phase with Staircase algorithm.
   * @private
   */
  _startTest() {
    console.log('[HidingHeidi] Starting test phase with Staircase algorithm');

    // Set state to test
    this._state = 'test';

    // Reset state for Staircase algorithm
    this._contrastIndex = 0;  // Start at 100%
    this._facePosition = 'q1';
    this._finalThreshold = null;

    // Initialize fail counts dictionary for all contrast levels
    this._failCounts = {};
    for (let i = 0; i < CONTRAST_LEVELS.length; i++) {
      this._failCounts[i] = 0;
    }

    console.log('[HidingHeidi] Fail counts initialized:', this._failCounts);

    // Clear board and set gray background
    this._board.innerHTML = '';
    this._board.style.backgroundColor = HEIDI_BG_COLOR;
    this._board.style.position = 'relative';
    this._board.style.overflow = 'hidden';

    // Create container for face (allows positioning in quadrants)
    const container = document.createElement('div');
    container.id = 'heidi-face-container';
    container.style.cssText = 'position: absolute; transform: translate(-50%, -50%); width: 50%; height: 50%;';
    this._board.appendChild(container);

    // Create SVG face with current contrast (100%)
    const contrast = this._getCurrentContrast();
    const color = this._interpolateColor(contrast);
    this._svg = this._createFaceSVG(color);
    container.appendChild(this._svg);

    // Randomize initial position (to a random quadrant)
    this._randomizePosition();

    // Bind event handlers
    this._boundKeydown = this._onKeydown.bind(this);
    this._boundContextMenu = this._onContextMenu.bind(this);
    this._boundClick = this._onBodyClick.bind(this);

    document.addEventListener('keydown', this._boundKeydown);
    document.addEventListener('contextmenu', this._boundContextMenu);
    document.body.addEventListener('click', this._boundClick);

    console.log('[HidingHeidi] Test started with contrast:', contrast, 'position:', this._facePosition);
  },

  /**
   * Handle body click for Staircase algorithm (left click = child correct).
   * @param {MouseEvent} e
   * @private
   */
  _onBodyClick(e) {
    // Only handle during test state and left click (button === 0)
    if (this._state !== 'test' || e.button !== 0) return;

    // Ignore clicks on modals if somehow present
    if (this._introModal && this._introModal.contains(e.target)) return;
    if (this._resultModal && this._resultModal.contains(e.target)) return;

    console.log('[HidingHeidi] Left click - Child CORRECT');

    // Reset fail count for current level
    this._failCounts[this._contrastIndex] = 0;

    // Check if at lowest level (1.25% - index 5)
    if (this._contrastIndex >= CONTRAST_LEVELS.length - 1) {
      console.log('[HidingHeidi] Reached lowest level (1.25%) - Test complete');
      this._finalThreshold = CONTRAST_LEVELS[this._contrastIndex];
      this._showResult();
      return;
    }

    // Increase difficulty: decrease contrast (move to next level)
    this._contrastIndex++;
    this._updateContrast();
    console.log('[HidingHeidi] Contrast decreased to:', this._getCurrentContrast());

    // Randomize position to a DIFFERENT quadrant
    this._randomizePosition();
    console.log('[HidingHeidi] Position changed to:', this._facePosition);
  },

  /**
   * Handle keydown events for blind controls.
   * @param {KeyboardEvent} e
   * @private
   */
  _onKeydown(e) {
    // Only handle keys during test state
    if (this._state !== 'test') return;

    switch (e.key) {
      case ' ':
      case 'Spacebar':
        // Space = same as left click (child correct)
        e.preventDefault();
        console.log('[HidingHeidi] Space - Child CORRECT');

        this._failCounts[this._contrastIndex] = 0;

        if (this._contrastIndex >= CONTRAST_LEVELS.length - 1) {
          this._finalThreshold = CONTRAST_LEVELS[this._contrastIndex];
          this._showResult();
          return;
        }

        this._contrastIndex++;
        this._updateContrast();
        this._randomizePosition();
        break;
    }
  },

  /**
   * Handle contextmenu event (right-click = child incorrect).
   * @param {MouseEvent} e
   * @private
   */
  _onContextMenu(e) {
    // Only handle during test state
    if (this._state !== 'test') return;

    e.preventDefault();
    console.log('[HidingHeidi] Right-click - Child INCORRECT');

    // Increase fail count for current level
    this._failCounts[this._contrastIndex]++;

    console.log('[HidingHeidi] Fail count for level', this._contrastIndex, ':', this._failCounts[this._contrastIndex]);

    // Check if failed 2 times at current level
    if (this._failCounts[this._contrastIndex] >= 2) {
      console.log('[HidingHeidi] 2 failures at current level - Test complete');

      // Threshold is previous level (if not at level 0)
      if (this._contrastIndex > 0) {
        this._finalThreshold = CONTRAST_LEVELS[this._contrastIndex - 1];
      } else {
        this._finalThreshold = 'Không đạt';
      }

      this._showResult();
      return;
    }

    // Decrease difficulty: increase contrast (move to previous level) to encourage child
    this._contrastIndex = Math.max(0, this._contrastIndex - 1);
    this._updateContrast();
    console.log('[HidingHeidi] Contrast increased to:', this._getCurrentContrast());

    // Randomize position to a DIFFERENT quadrant
    this._randomizePosition();
    console.log('[HidingHeidi] Position changed to:', this._facePosition);
  },

  /**
   * Show result screen with threshold display.
   * @private
   */
  _showResult() {
    console.log('[HidingHeidi] Showing result screen with threshold:', this._finalThreshold);

    // Set state to result
    this._state = 'result';

    // Hide/remove SVG face
    if (this._svg) {
      const container = this._svg.parentElement;
      if (container) {
        container.remove();
      }
      this._svg = null;
    }

    // Keep gray background
    this._board.style.backgroundColor = HEIDI_BG_COLOR;

    // Create result modal
    this._resultModal = document.createElement('div');
    this._resultModal.id = 'heidi-result-modal';
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

    // Format threshold display
    const thresholdDisplay = typeof this._finalThreshold === 'string'
      ? this._finalThreshold
      : `${this._finalThreshold}%`;

    // Modal content
    this._resultModal.innerHTML = `
      <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #ffffff;">Hoàn thành Khám</h2>
      <div style="margin: 30px 0; font-size: 20px; line-height: 1.6;">
        <p><strong>Ngưỡng độ nhạy tương phản:</strong></p>
        <p style="font-size: 36px; color: #808080; margin: 20px 0; font-weight: bold;">${thresholdDisplay}</p>
      </div>
      <button id="heidi-save-btn" style="
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
        Lưu kết quả & Kết thúc (Enter)
      </button>
    `;

    this._board.appendChild(this._resultModal);

    // Bind button click and Enter key
    const saveBtn = document.getElementById('heidi-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this._saveAndExit();
      });
    }

    // Add Enter key listener for result screen
    this._boundKeydown = this._onResultKeydown.bind(this);
    document.addEventListener('keydown', this._boundKeydown);
  },

  /**
   * Handle keydown events on result screen.
   * @param {KeyboardEvent} e
   * @private
   */
  _onResultKeydown(e) {
    if (this._state !== 'result') return;

    if (e.key === 'Enter') {
      e.preventDefault();
      this._saveAndExit();
    }
  },

  /**
   * Save result and exit.
   * @private
   */
  _saveAndExit() {
    console.log('[HidingHeidi] Saving result and exiting');

    // Prepare threshold value for JSON
    const thresholdValue = typeof this._finalThreshold === 'string'
      ? this._finalThreshold
      : this._finalThreshold;

    // Dispatch CustomEvent
    const event = new CustomEvent('visionTestCompleted', {
      detail: {
        test_type: 'Preferential_Looking_Heidi',
        eye_tested: 'OU',
        clinical_metrics: {
          contrast_threshold_percent: thresholdValue
        }
      },
      bubbles: true
    });

    document.dispatchEvent(event);

    console.log('[HidingHeidi] Dispatched visionTestCompleted with threshold:', thresholdValue);

    // Cleanup
    setTimeout(() => {
      this.cleanup();
    }, 100);
  },

  /**
   * Remove result modal from DOM.
   * @private
   */
  _removeResult() {
    if (this._resultModal) {
      this._resultModal.remove();
      this._resultModal = null;
    }
  },

  /**
   * Main render entry point.
   * Called by main.js when the test is selected.
   * @param {number} idx - Step index (unused, test is single-screen)
   */
  render(idx) {
    console.log('[HidingHeidi] render() called with idx:', idx);
    try {
      this._init();
    } catch (e) {
      console.error('[HidingHeidi] Error in _init():', e);
    }
  },

  /**
   * Initialize the test: show intro or start test directly.
   * @private
   */
  _init() {
    console.log('[HidingHeidi] _init() started');

    // Reset state
    this._state = 'intro';
    this._contrastIndex = 0;
    this._facePosition = 'q1';
    this._finalThreshold = null;

    // Get display board element
    this._board = document.getElementById('display-board');
    if (!this._board) {
      console.error('[HidingHeidi] display-board element not found');
      return;
    }

    // Show intro screen (will check localStorage and possibly skip to test)
    this._showIntro();
  },

  /**
   * Cleanup function: remove DOM elements, event listeners, reset background.
   * Called by main.js when switching tests.
   */
  cleanup() {
    console.log('[HidingHeidi] cleanup() called');

    // Remove event listeners
    if (this._boundKeydown) {
      document.removeEventListener('keydown', this._boundKeydown);
      this._boundKeydown = null;
    }

    if (this._boundContextMenu) {
      document.removeEventListener('contextmenu', this._boundContextMenu);
      this._boundContextMenu = null;
    }

    if (this._boundClick) {
      document.body.removeEventListener('click', this._boundClick);
      this._boundClick = null;
    }

    // Remove modals if present
    this._removeIntro();
    this._removeResult();

    // Remove SVG and container from DOM
    if (this._svg) {
      const container = this._svg.parentElement;
      if (container && container.parentElement) {
        container.parentElement.removeChild(container);
      } else if (this._svg.parentElement) {
        this._svg.parentElement.removeChild(this._svg);
      }
      this._svg = null;
    }

    // Reset display board
    if (this._board) {
      this._board.style.backgroundColor = '';
      this._board.style.position = '';
      this._board.style.overflow = '';
      this._board.innerHTML = '';
      this._board = null;
    }

    // Reset state
    this._state = 'intro';
    this._failCounts = {};

    console.log('[HidingHeidi] Cleanup complete');
  }
};

export default hidingHeidi;
