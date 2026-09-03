/**
 * dynamic_fixation.js — Dynamic Fixation Target for Pediatric Ophthalmology
 *
 * Clinical module to attract central fixation in children, assisting
 * ophthalmologists in performing Cover Test (strabismus examination).
 *
 * State Machine Workflow:
 *   Phase 1: Pre-test Guide (Modal with instructions)
 *   Phase 2: Active Test (Zero distraction - only animated star)
 *   Phase 3: Post-test Grading (CSM: Central, Steady, Maintained)
 *
 * Features:
 *   - Black background (#000000)
 *   - Animated star target at center (rotation + subtle scaling)
 *   - Physical size calculation using ccPxPerMm from localStorage (1.5 cm target)
 *   - Space/Left-click: random color change + beep sound (Phase 2)
 *   - Enter/Right-click: transition to grading (Phase 2 → 3)
 *   - CSM grading with keyboard shortcuts (C, S, M)
 *   - Web Audio API for beep generation (no external files)
 *   - Proper cleanup() to prevent memory leaks
 *
 * Module id = 'dynamic-fixation'
 */

// ================================================================
//  Constants
// ================================================================

const DYNAMIC_FIXATION_BG_COLOR = '#000000';

/** LocalStorage key for ccPxPerMm (must match calibration.js) */
const CC_PX_PER_MM_KEY = 'vision-therapy-cc-pxpermm';

/** LocalStorage key to hide guide */
const HIDE_GUIDE_KEY = 'hide-fixation-guide';

/** Target physical size in cm (for fovea stimulation) */
const TARGET_SIZE_CM = 1.5;

/** Fallback pixel size when calibration data is not available */
const FALLBACK_SIZE_PX = 60;

/** Animation rotation speed (degrees per frame) */
const ROTATION_SPEED = 0.5;

/** Animation scale pulse amplitude */
const PULSE_AMPLITUDE = 0.08;

/** Animation pulse speed (cycles per second) */
const PULSE_SPEED = 0.8;

/** Available colors for random selection */
const TARGET_COLORS = ['#FF0000', '#FFFF00', '#0000FF']; // Red, Yellow, Blue

// ================================================================
//  Dynamic Fixation Module
// ================================================================

const dynamicFixation = {
  id: 'dynamic-fixation',
  label: 'Định thị Nhi khoa',

  /** Flag to indicate this module uses custom controls and needs UniversalInput suspended */
  customControls: true,

  /** Steps array (required by framework) */
  steps: ['fixation'],

  // ===== State Machine =====
  _currentPhase: 1, // 1: Guide, 2: Test, 3: Grading

  // ===== DOM References =====
  _guideOverlay: null,
  _gradingHUD: null,

  // ===== SVG/Canvas References =====
  _svg: null,
  _star: null,
  _starGroup: null,
  _svgNS: 'http://www.w3.org/2000/svg',

  // ===== Animation State =====
  _rotation: 0,
  _scale: 1.0,
  _animFrameId: null,
  _canvasWidth: 0,
  _canvasHeight: 0,
  _targetSizePx: FALLBACK_SIZE_PX,

  // ===== Audio =====
  _audioContext: null,

  // ===== Event Handlers (for cleanup) =====
  _boundKeydown: null,
  _boundClick: null,
  _boundContextMenu: null,
  _boundResize: null,

  // ===== Grading State =====
  _csmGrades: {
    central: true,
    steady: true,
    maintained: true,
  },

  // ===== Color State =====
  _colorIndex: 0,

  /**
   * Main render entry point.
   * Called by main.js when the test is selected.
   * @param {number} idx - Step index (unused, single-screen module)
   */
  render(idx) {
    try {
      this._calculateTargetSize();
      this._initAudioContext();
      this._checkGuideAndStart();
    } catch (e) {
      console.error('[DynamicFixation] Error in render():', e);
    }
  },

  /**
   * Check if guide should be shown, then start appropriate phase.
   * @private
   */
  _checkGuideAndStart() {
    const hideGuide = localStorage.getItem(HIDE_GUIDE_KEY) === 'true';

    if (hideGuide) {
      this._startPhase2();
    } else {
      this._startPhase1();
    }
  },

  // ================================================================
  //  Phase 1: Pre-test Guide
  // ================================================================

  /**
   * Start Phase 1: Show guide modal.
   * @private
   */
  _startPhase1() {
    this._currentPhase = 1;

    const board = document.getElementById('display-board');
    if (!board) return;

    board.innerHTML = '';
    board.style.background = DYNAMIC_FIXATION_BG_COLOR;
    board.style.position = 'relative';
    board.style.overflow = 'hidden';

    // Create overlay/modal
    this._guideOverlay = document.createElement('div');
    this._guideOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      background: rgba(0, 0, 0, 0.95);
      z-index: 1000;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #1a1a1a;
      border: 2px solid #444;
      border-radius: 12px;
      padding: 40px;
      max-width: 600px;
      width: 90%;
      color: #ffffff;
      font-family: Arial, sans-serif;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;

    modal.innerHTML = `
      <h2 style="margin: 0 0 20px 0; font-size: 28px; color: #4CAF50;">
        Khám Định thị & Vi lác (Cover Test)
      </h2>
      <div style="font-size: 16px; line-height: 1.8; margin-bottom: 30px; text-align: left; padding: 0 20px;">
        <p style="margin: 10px 0;">
          <strong>Hướng dẫn:</strong>
        </p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Nhấn <strong>Space</strong> hoặc <strong>Chuột trái</strong> để đổi màu và phát âm thanh.</li>
          <li>Nhấn <strong>Enter</strong> hoặc <strong>Chuột phải</strong> để kết thúc và chấm điểm.</li>
        </ul>
      </div>
      <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 25px;">
        <input type="checkbox" id="hide-guide-checkbox" style="width: 20px; height: 20px; margin-right: 10px; cursor: pointer;">
        <label for="hide-guide-checkbox" style="font-size: 14px; cursor: pointer; color: #aaa;">
          Không hiển thị lại
        </label>
      </div>
      <button id="start-test-btn" style="
        background: #4CAF50;
        color: white;
        border: none;
        padding: 15px 40px;
        font-size: 18px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.3s;
      " onmouseover="this.style.background='#45a049'" onmouseout="this.style.background='#4CAF50'">
        Bắt đầu Test
      </button>
    `;

    this._guideOverlay.appendChild(modal);
    board.appendChild(this._guideOverlay);

    // Bind events for Phase 1
    const startBtn = document.getElementById('start-test-btn');
    const hideCheckbox = document.getElementById('hide-guide-checkbox');

    startBtn.addEventListener('click', () => {
      // Save preference if checked
      if (hideCheckbox.checked) {
        localStorage.setItem(HIDE_GUIDE_KEY, 'true');
      }
      this._startPhase2();
    });
  },

  // ================================================================
  //  Phase 2: Active Test (Zero Distraction)
  // ================================================================

  /**
   * Start Phase 2: Active test with zero UI distraction.
   * @private
   */
  _startPhase2() {
    this._currentPhase = 2;

    const board = document.getElementById('display-board');
    if (!board) return;

    // Clear everything - ZERO distraction
    board.innerHTML = '';
    board.style.background = DYNAMIC_FIXATION_BG_COLOR;
    board.style.position = 'relative';
    board.style.overflow = 'hidden';

    // Create SVG container
    this._svg = document.createElementNS(this._svgNS, 'svg');
    this._svg.setAttribute('width', '100%');
    this._svg.setAttribute('height', '100%');
    this._svg.style.position = 'absolute';
    this._svg.style.top = '0';
    this._svg.style.left = '0';
    this._svg.style.cursor = 'pointer';

    board.appendChild(this._svg);

    this._updateDimensions();
    this._createSVGTarget();
    this._bindPhase2Events();
    this._startAnimation();
  },

  /**
   * Bind events for Phase 2 (Space/Click for color, Enter/Right-click for grading).
   * @private
   */
  _bindPhase2Events() {
    // Remove any existing listeners first
    this._unbindAllEvents();

    // Keydown: Space = change color, Enter = go to grading
    this._boundKeydown = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        this._changeColor();
      } else if (e.code === 'Enter') {
        e.preventDefault();
        this._startPhase3();
      }
    };

    // Click: left click = change color
    this._boundClick = (e) => {
      e.preventDefault();
      this._changeColor();
    };

    // Right-click: contextmenu = go to grading (with preventDefault)
    this._boundContextMenu = (e) => {
      e.preventDefault();
      this._startPhase3();
    };

    // Resize handler
    this._boundResize = () => {
      this._updateDimensions();
      this._updateStarPosition();
    };

    document.addEventListener('keydown', this._boundKeydown);
    if (this._svg) {
      this._svg.addEventListener('click', this._boundClick);
      this._svg.addEventListener('contextmenu', this._boundContextMenu);
    }
    window.addEventListener('resize', this._boundResize);
  },

  /**
   * Unbind all event listeners.
   * @private
   */
  _unbindAllEvents() {
    if (this._boundKeydown) {
      document.removeEventListener('keydown', this._boundKeydown);
      this._boundKeydown = null;
    }
    if (this._boundClick && this._svg) {
      this._svg.removeEventListener('click', this._boundClick);
      this._boundClick = null;
    }
    if (this._boundContextMenu && this._svg) {
      this._svg.removeEventListener('contextmenu', this._boundContextMenu);
      this._boundContextMenu = null;
    }
    if (this._boundResize) {
      window.removeEventListener('resize', this._boundResize);
      this._boundResize = null;
    }
  },

  // ================================================================
  //  Phase 3: Post-test Grading (CSM)
  // ================================================================

  /**
   * Start Phase 3: Show CSM grading HUD.
   * @private
   */
  _startPhase3() {
    this._currentPhase = 3;

    // Stop animation
    if (this._animFrameId !== null) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }

    // Unbind Phase 2 events
    this._unbindAllEvents();

    const board = document.getElementById('display-board');
    if (!board) return;

    // Clear board
    board.innerHTML = '';
    board.style.background = DYNAMIC_FIXATION_BG_COLOR;
    board.style.position = 'relative';
    board.style.overflow = 'hidden';

    // Create grading HUD
    this._gradingHUD = document.createElement('div');
    this._gradingHUD.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(26, 26, 26, 0.95);
      border: 2px solid #4CAF50;
      border-radius: 12px;
      padding: 40px;
      min-width: 400px;
      color: #ffffff;
      font-family: Arial, sans-serif;
      text-align: center;
      z-index: 1000;
    `;

    this._gradingHUD.innerHTML = `
      <h2 style="margin: 0 0 30px 0; font-size: 24px; color: #4CAF50;">
        Chấm điểm Định thị (CSM)
      </h2>
      <div id="csm-grades" style="margin-bottom: 30px;">
        <div class="csm-item" data-criterion="central" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          margin: 10px 0;
          background: rgba(76, 175, 80, 0.2);
          border: 1px solid #4CAF50;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s;
        ">
          <span style="font-size: 18px;"><strong>C</strong>entral (Trung tâm)</span>
          <span class="csm-status" style="font-size: 24px; color: #4CAF50;">✓</span>
        </div>
        <div class="csm-item" data-criterion="steady" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          margin: 10px 0;
          background: rgba(76, 175, 80, 0.2);
          border: 1px solid #4CAF50;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s;
        ">
          <span style="font-size: 18px;"><strong>S</strong>teady (Vững)</span>
          <span class="csm-status" style="font-size: 24px; color: #4CAF50;">✓</span>
        </div>
        <div class="csm-item" data-criterion="maintained" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          margin: 10px 0;
          background: rgba(76, 175, 80, 0.2);
          border: 1px solid #4CAF50;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s;
        ">
          <span style="font-size: 18px;"><strong>M</strong>aintained (Duy trì)</span>
          <span class="csm-status" style="font-size: 24px; color: #4CAF50;">✓</span>
        </div>
      </div>
      <div style="font-size: 14px; color: #aaa; margin-bottom: 20px;">
        Nhấn phím <strong>C</strong>, <strong>S</strong>, <strong>M</strong> hoặc click để bật/tắt
      </div>
      <button id="save-grading-btn" style="
        background: #4CAF50;
        color: white;
        border: none;
        padding: 15px 40px;
        font-size: 18px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.3s;
      " onmouseover="this.style.background='#45a049'" onmouseout="this.style.background='#4CAF50'">
        Lưu kết quả
      </button>
    `;

    board.appendChild(this._gradingHUD);

    // Bind grading events
    this._bindPhase3Events();
  },

  /**
   * Bind events for Phase 3 (CSM grading).
   * @private
   */
  _bindPhase3Events() {
    // Click on CSM items to toggle
    const csmItems = document.querySelectorAll('.csm-item');
    csmItems.forEach((item) => {
      item.addEventListener('click', () => {
        const criterion = item.dataset.criterion;
        this._toggleCSMGrade(criterion);
      });
    });

    // Keyboard shortcuts: C, S, M to toggle, Enter to save
    this._boundKeydown = (e) => {
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        this._toggleCSMGrade('central');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this._toggleCSMGrade('steady');
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        this._toggleCSMGrade('maintained');
      } else if (e.code === 'Enter') {
        e.preventDefault();
        this._saveAndComplete();
      }
    };

    // Save button
    const saveBtn = document.getElementById('save-grading-btn');
    if (saveBtn) {
      this._boundClick = () => {
        this._saveAndComplete();
      };
      saveBtn.addEventListener('click', this._boundClick);
    }

    document.addEventListener('keydown', this._boundKeydown);
  },

  /**
   * Toggle CSM grade criterion.
   * @param {string} criterion - 'central', 'steady', or 'maintained'
   * @private
   */
  _toggleCSMGrade(criterion) {
    this._csmGrades[criterion] = !this._csmGrades[criterion];

    const item = document.querySelector(`[data-criterion="${criterion}"]`);
    if (item) {
      const status = item.querySelector('.csm-status');
      if (this._csmGrades[criterion]) {
        item.style.background = 'rgba(76, 175, 80, 0.2)';
        item.style.borderColor = '#4CAF50';
        status.style.color = '#4CAF50';
        status.textContent = '✓';
      } else {
        item.style.background = 'rgba(244, 67, 54, 0.2)';
        item.style.borderColor = '#F44336';
        status.style.color = '#F44336';
        status.textContent = '✗';
      }
    }
  },

  /**
   * Save results and dispatch visionTestCompleted event.
   * @private
   */
  _saveAndComplete() {
    const payload = {
      testId: this.id,
      testLabel: this.label,
      timestamp: new Date().toISOString(),
      grades: {
        central: this._csmGrades.central,
        steady: this._csmGrades.steady,
        maintained: this._csmGrades.maintained,
      },
      summary: {
        central: this._csmGrades.central ? 'PASS' : 'FAIL',
        steady: this._csmGrades.steady ? 'PASS' : 'FAIL',
        maintained: this._csmGrades.maintained ? 'PASS' : 'FAIL',
      },
    };

    // Dispatch custom event
    const event = new CustomEvent('visionTestCompleted', { detail: payload });
    document.dispatchEvent(event);

    // Cleanup
    this.cleanup();
  },

  // ================================================================
  //  Shared Methods (Phases 2 & 3)
  // ================================================================

  /**
   * Calculate target size based on calibration data.
   * @private
   */
  _calculateTargetSize() {
    try {
      const ccPxPerMmStr = localStorage.getItem(CC_PX_PER_MM_KEY);
      if (ccPxPerMmStr) {
        const ccPxPerMm = parseFloat(ccPxPerMmStr);
        if (!isNaN(ccPxPerMm) && ccPxPerMm > 0) {
          // Convert 1.5 cm to mm (15 mm), then to pixels
          this._targetSizePx = Math.round(15 * ccPxPerMm);
          return;
        }
      }
    } catch (e) {
      console.warn('[DynamicFixation] Error reading calibration data:', e);
    }

    // Fallback to default size
    this._targetSizePx = FALLBACK_SIZE_PX;
  },

  /**
   * Update canvas dimensions based on display board.
   * @private
   */
  _updateDimensions() {
    const board = document.getElementById('display-board');
    if (board) {
      this._canvasWidth = board.clientWidth;
      this._canvasHeight = board.clientHeight;
    }
  },

  /**
   * Create SVG star target at center.
   * @private
   */
  _createSVGTarget() {
    const centerX = this._canvasWidth / 2;
    const centerY = this._canvasHeight / 2;
    const size = this._targetSizePx / 2;

    // Create star path (5-pointed star)
    const starPath = this._createStarPath(0, 0, size * 0.4, size, 5);

    // Create SVG group for transformations
    const g = document.createElementNS(this._svgNS, 'g');
    g.setAttribute('transform', `translate(${centerX}, ${centerY})`);

    // Create star element
    this._star = document.createElementNS(this._svgNS, 'path');
    this._star.setAttribute('d', starPath);
    this._star.setAttribute('fill', TARGET_COLORS[this._colorIndex]);
    this._star.setAttribute('stroke', '#FFFFFF');
    this._star.setAttribute('stroke-width', '2');

    g.appendChild(this._star);
    this._svg.appendChild(g);

    // Store reference to transform group
    this._starGroup = g;
  },

  /**
   * Create SVG star path data.
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @param {number} innerRadius - Inner radius
   * @param {number} outerRadius - Outer radius
   * @param {number} points - Number of points
   * @returns {string} SVG path data
   * @private
   */
  _createStarPath(cx, cy, innerRadius, outerRadius, points) {
    let path = '';
    const angleStep = Math.PI / points;

    for (let i = 0; i < 2 * points; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = i * angleStep - Math.PI / 2; // Start from top
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);

      if (i === 0) {
        path += `M ${x} ${y} `;
      } else {
        path += `L ${x} ${y} `;
      }
    }

    path += 'Z';
    return path;
  },

  /**
   * Initialize Web Audio Context for beep sound.
   * @private
   */
  _initAudioContext() {
    try {
      if (!this._audioContext) {
        this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
    } catch (e) {
      console.warn('[DynamicFixation] Web Audio API not supported:', e);
    }
  },

  /**
   * Play beep sound using Web Audio API.
   * @private
   */
  _playBeep() {
    if (!this._audioContext) {
      this._initAudioContext();
    }

    if (!this._audioContext) return;

    try {
      // Resume audio context if suspended (autoplay policy)
      if (this._audioContext.state === 'suspended') {
        this._audioContext.resume();
      }

      const oscillator = this._audioContext.createOscillator();
      const gainNode = this._audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this._audioContext.destination);

      // Configure beep
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, this._audioContext.currentTime); // 800 Hz

      // Envelope: quick attack, short decay
      gainNode.gain.setValueAtTime(0, this._audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, this._audioContext.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, this._audioContext.currentTime + 0.15);

      oscillator.start(this._audioContext.currentTime);
      oscillator.stop(this._audioContext.currentTime + 0.15);
    } catch (e) {
      console.warn('[DynamicFixation] Error playing beep:', e);
    }
  },

  /**
   * Change target color randomly.
   * @private
   */
  _changeColor() {
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * TARGET_COLORS.length);
    } while (newIndex === this._colorIndex && TARGET_COLORS.length > 1);

    this._colorIndex = newIndex;
    if (this._star) {
      this._star.setAttribute('fill', TARGET_COLORS[this._colorIndex]);
    }

    // Play beep sound
    this._playBeep();
  },

  /**
   * Update star position to center after resize.
   * @private
   */
  _updateStarPosition() {
    if (this._starGroup) {
      const centerX = this._canvasWidth / 2;
      const centerY = this._canvasHeight / 2;
      this._starGroup.setAttribute('transform', `translate(${centerX}, ${centerY})`);
    }
  },

  /**
   * Start animation loop.
   * @private
   */
  _startAnimation() {
    const animate = () => {
      this._rotation += ROTATION_SPEED;
      if (this._rotation >= 360) {
        this._rotation -= 360;
      }

      // Pulse scale using sine wave
      const time = performance.now() / 1000;
      this._scale = 1.0 + PULSE_AMPLITUDE * Math.sin(2 * Math.PI * PULSE_SPEED * time);

      // Apply transformation
      if (this._starGroup) {
        this._starGroup.setAttribute(
          'transform',
          `translate(${this._canvasWidth / 2}, ${this._canvasHeight / 2}) rotate(${this._rotation}) scale(${this._scale})`
        );
      }

      this._animFrameId = requestAnimationFrame(animate);
    };

    this._animFrameId = requestAnimationFrame(animate);
  },

  /**
   * Cleanup function to prevent memory leaks.
   * Must clear intervals, cancel animation frames, remove event listeners,
   * and close Web AudioContext.
   */
  cleanup() {
    // Cancel animation frame
    if (this._animFrameId !== null) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }

    // Unbind all events
    this._unbindAllEvents();

    // Close Web Audio Context
    if (this._audioContext) {
      try {
        this._audioContext.close();
      } catch (e) {
        console.warn('[DynamicFixation] Error closing AudioContext:', e);
      }
      this._audioContext = null;
    }

    // Clear references
    this._star = null;
    this._starGroup = null;
    this._svg = null;
    this._guideOverlay = null;
    this._gradingHUD = null;

    // Reset state
    this._currentPhase = 1;
    this._csmGrades = {
      central: true,
      steady: true,
      maintained: true,
    };

    // Clear display board
    const board = document.getElementById('display-board');
    if (board) {
      board.innerHTML = '';
      board.style.background = '';
      board.style.position = '';
      board.style.overflow = '';
    }
  },
};

export default dynamicFixation;
