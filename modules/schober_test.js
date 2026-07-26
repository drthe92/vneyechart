/**
 * schober_test.js — Schober Test for Heterophoria (Latent Strabismus) Measurement
 *
 * Clinical module to measure heterophoria using prism diopter calculation.
 * Uses HTML5 Canvas 2D (no WebGL).
 *
 * Features:
 *   - Black background (#000000)
 *   - 2 concentric circles (Green #00FF00)
 *   - 1 red crosshair (#FF0000) at center, movable with arrow keys
 *   - Real-time Prism Diopter (Δ) calculation and HUD display
 *   - Enter key to lock in results and dispatch visionTestCompleted event
 *
 * Module id = 'schober-heterophoria'
 */

// ================================================================
//  Constants
// ================================================================

const SCHOBER_BG_COLOR = '#000000';
const SCHOBER_CIRCLE_COLOR = '#00FF00';
const SCHOBER_CROSSHAIR_COLOR = '#FF0000';
const SCHOBER_HUD_BG = 'rgba(0, 0, 0, 0.75)';
const SCHOBER_HUD_BORDER_DEFAULT = '#00FF00';
const SCHOBER_HUD_BORDER_LOCKED = '#00FF00';

/** LocalStorage key for ccPxPerMm (must match calibration.js) */
const CC_PX_PER_MM_KEY = 'vision-therapy-cc-pxpermm';

/** Standard testing distance for Schober test (meters) */
const SCHOBER_DISTANCE_M = 3.0;

/** Canvas center crosshair size (pixels) */
const CROSSHAIR_SIZE = 20;

/** Movement step per arrow key press (pixels) */
const MOVEMENT_STEP = 2;

// ================================================================
//  Schober Test Module
// ================================================================

const schoberTest = {
  id: 'schober-heterophoria',
  label: 'Schober Test (Heterophoria)',

  /** Steps array (required by framework) */
  steps: ['test'],

  /** Canvas element reference */
  _canvas: null,

  /** 2D rendering context */
  _ctx: null,

  /** Current crosshair offset from center (pixels) */
  _offsetX: 0,
  _offsetY: 0,

  /** Canvas center coordinates */
  _centerX: 0,
  _centerY: 0,

  /** Canvas dimensions */
  _canvasWidth: 0,
  _canvasHeight: 0,

  /** Test started state (Enter pressed to start) */
  _testStarted: false,

  /** Locked result state */
  _isLocked: false,

  /** Bound event handlers (for cleanup) */
  _boundKeydown: null,
  _boundClick: null,
  _boundResize: null,

  /** Cached ccPxPerMm value */
  _ccPxPerMm: null,

  /**
   * Main render entry point.
   * Called by main.js when the test is selected.
   * @param {number} idx - Step index (unused, test is single-screen)
   */
  render(idx) {
    console.log('[Schober] render() called with idx:', idx);
    try {
      this._init();
    } catch (e) {
      console.error('[Schober] Error in _init():', e);
    }
  },

  /**
   * Initialize the test: create canvas, bind events, start render loop.
   * @private
   */
  _init() {
    console.log('[Schober] _init() started');

    // Reset state
    this._offsetX = 0;
    this._offsetY = 0;
    this._testStarted = false;
    this._isLocked = false;
    this._ccPxPerMm = this._getPxPerMm();

    // Get display board element
    const board = document.getElementById('display-board');
    if (!board) {
      console.error('[Schober] display-board element not found');
      return;
    }

    console.log('[Schober] Found display-board element');

    // Clear board
    board.innerHTML = '';
    board.style.backgroundColor = SCHOBER_BG_COLOR;

    // Create canvas
    this._canvas = document.createElement('canvas');
    this._canvas.id = 'schober-canvas';
    this._canvas.style.cssText = 'display: block; width: 100%; height: 100%;';
    board.appendChild(this._canvas);

    console.log('[Schober] Canvas created and appended');

    // Get 2D context
    this._ctx = this._canvas.getContext('2d');
    if (!this._ctx) {
      console.error('[Schober] Cannot get 2D context');
      return;
    }

    console.log('[Schober] 2D context obtained');

    // Set initial canvas size
    this._resizeCanvas();

    // Bind event handlers
    this._boundKeydown = this._onKeydown.bind(this);
    this._boundClick = this._onCanvasClick.bind(this);
    this._boundResize = this._resizeCanvas.bind(this);

    document.addEventListener('keydown', this._boundKeydown);
    this._canvas.addEventListener('click', this._boundClick);
    window.addEventListener('resize', this._boundResize);

    console.log('[Schober] Event listeners added');

    // Draw initial frame
    this._draw();

    // Log calibration status
    if (this._ccPxPerMm && this._ccPxPerMm > 0) {
      console.log(`[Schober] Using ccPxPerMm = ${this._ccPxPerMm.toFixed(4)} px/mm`);
    } else {
      console.warn('[Schober] ccPxPerMm not found in localStorage. Prism calculation will be inaccurate. Please run credit card calibration first.');
    }

    console.log('[Schober] _init() completed successfully');
  },

  /**
   * Resize canvas to fill display board.
   * @private
   */
  _resizeCanvas() {
    const board = document.getElementById('display-board');
    if (!board || !this._canvas) return;

    const rect = board.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this._canvas.width = rect.width * dpr;
    this._canvas.height = rect.height * dpr;
    this._canvas.style.width = rect.width + 'px';
    this._canvas.style.height = rect.height + 'px';

    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this._canvasWidth = rect.width;
    this._canvasHeight = rect.height;
    this._centerX = rect.width / 2;
    this._centerY = rect.height / 2;

    this._draw();
  },

  /**
   * Main draw function: background, circles, crosshair, HUD.
   * @private
   */
  _draw() {
    if (!this._ctx) return;

    const ctx = this._ctx;
    const w = this._canvasWidth;
    const h = this._canvasHeight;
    const cx = this._centerX;
    const cy = this._centerY;

    // Clear canvas
    ctx.fillStyle = SCHOBER_BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Draw 2 concentric circles (green)
    this._drawConcentricCircles(ctx, cx, cy);

    // Draw red crosshair at offset position (only if test started)
    if (this._testStarted) {
      const crosshairX = cx + this._offsetX;
      const crosshairY = cy + this._offsetY;
      this._drawCrosshair(ctx, crosshairX, crosshairY);
    }

    // Draw HUD
    this._drawHUD(ctx, w, h, cx, cy);
  },

  /**
   * Draw 2 concentric circles centered on canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @private
   */
  _drawConcentricCircles(ctx, cx, cy) {
    ctx.save();
    ctx.strokeStyle = SCHOBER_CIRCLE_COLOR;
    ctx.lineWidth = 2;

    // Outer circle: 40% of smaller dimension
    const outerR = Math.min(cx, cy) * 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.stroke();

    // Inner circle: 20% of smaller dimension
    const innerR = Math.min(cx, cy) * 0.2;
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  },

  /**
   * Draw red crosshair at specified position.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - Crosshair center X
   * @param {number} y - Crosshair center Y
   * @private
   */
  _drawCrosshair(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = SCHOBER_CROSSHAIR_COLOR;
    ctx.lineWidth = 2;

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(x - CROSSHAIR_SIZE, y);
    ctx.lineTo(x + CROSSHAIR_SIZE, y);
    ctx.stroke();

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(x, y - CROSSHAIR_SIZE);
    ctx.lineTo(x, y + CROSSHAIR_SIZE);
    ctx.stroke();

    ctx.restore();
  },

  /**
   * Draw HUD overlay with real-time prism diopter values.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w - Canvas width
   * @param {number} h - Canvas height
   * @param {number} crosshairX - Current crosshair X
   * @param {number} crosshairY - Current crosshair Y
   * @private
   */
  _drawHUD(ctx, w, h, cx, cy) {
    ctx.save();

    // Only show HUD if test not started OR test is locked
    // During test (testStarted=true, isLocked=false), HUD is hidden for black screen
    if (!this._testStarted || this._isLocked) {
      // Calculate prism diopters (only if locked)
      const prismH = this._isLocked ? this._calcPrismDiopter(this._offsetX) : 0;
      const prismV = this._isLocked ? this._calcPrismDiopter(this._offsetY) : 0;

      // HUD background
      const hudW = 320;
      const hudH = this._isLocked ? 120 : 100;
      const hudX = 20;
      const hudY = 20;

      ctx.fillStyle = SCHOBER_HUD_BG;
      ctx.fillRect(hudX, hudY, hudW, hudH);

      // HUD border (green when locked, green otherwise)
      ctx.strokeStyle = this._isLocked ? SCHOBER_HUD_BORDER_LOCKED : SCHOBER_HUD_BORDER_DEFAULT;
      ctx.lineWidth = this._isLocked ? 3 : 1;
      ctx.strokeRect(hudX, hudY, hudW, hudH);

      // HUD text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px monospace';
      ctx.textBaseline = 'top';

      let lineY = hudY + 12;
      const lineH = 22;

      ctx.fillText('SCHOBER TEST — HETEROPHORIA', hudX + 12, lineY);
      lineY += lineH;

      ctx.fillText(`Khoảng cách đo: ${SCHOBER_DISTANCE_M.toFixed(1)} m`, hudX + 12, lineY);
      lineY += lineH;

      // Only show prism values if locked
      if (this._isLocked) {
        ctx.fillText(`Δ Ngang (H): ${prismH.toFixed(2)} \u0394`, hudX + 12, lineY);
        lineY += lineH;

        ctx.fillText(`Δ Đứng (V): ${prismV.toFixed(2)} \u0394`, hudX + 12, lineY);
        lineY += lineH;

        // Show pixel offset for debugging
        ctx.fillStyle = '#888888';
        ctx.font = '12px monospace';
        ctx.fillText(`Offset: (${this._offsetX}, ${this._offsetY}) px`, hudX + 12, lineY);
        lineY += 18;
      }

      // Status indicator
      if (this._isLocked) {
        ctx.fillStyle = '#00FF00';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('Đã chốt kết quả', hudX + 12, lineY);
      } else {
        ctx.fillStyle = '#FFFF00';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('Nhấn ENTER hoặc Click chuột trái để bắt đầu', hudX + 12, lineY);
      }
    }

    ctx.restore();
  },

  /**
   * Calculate Prism Diopter from pixel offset.
   * Formula: Δ = Displacement (cm) / Distance (m)
   *
   * @param {number} pixelOffset - Offset in pixels
   * @returns {number} Prism diopter value (Δ)
   * @private
   */
  _calcPrismDiopter(pixelOffset) {
    if (!this._ccPxPerMm || this._ccPxPerMm <= 0) return 0;

    // Convert pixel offset to mm
    const offsetMm = pixelOffset / this._ccPxPerMm;

    // Convert mm to cm
    const offsetCm = offsetMm / 10.0;

    // Calculate prism diopter
    const delta = offsetCm / SCHOBER_DISTANCE_M;

    return delta;
  },

  /**
   * Read ccPxPerMm from localStorage.
   * @returns {number|null} Pixels per mm, or null if not found
   * @private
   */
  _getPxPerMm() {
    try {
      const val = localStorage.getItem(CC_PX_PER_MM_KEY);
      if (val) {
        const num = parseFloat(val);
        if (!isNaN(num) && num > 0) return num;
      }
    } catch (e) {
      console.warn('[Schober] Error reading ccPxPerMm from localStorage:', e);
    }
    return null;
  },

  /**
   * Handle keyboard events.
   * @param {KeyboardEvent} e
   * @private
   */
  _onKeydown(e) {
    // If locked, only allow re-test (Escape to exit)
    if (this._isLocked) {
      if (e.key === 'Escape') {
        this.cleanup();
      }
      return;
    }

    // If test not started, only allow Enter to start
    if (!this._testStarted) {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._testStarted = true;
        this._draw();
      }
      return;
    }

    // Test started - handle movement and lock
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this._offsetY -= MOVEMENT_STEP;
        this._draw();
        break;

      case 'ArrowDown':
        e.preventDefault();
        this._offsetY += MOVEMENT_STEP;
        this._draw();
        break;

      case 'ArrowLeft':
        e.preventDefault();
        this._offsetX -= MOVEMENT_STEP;
        this._draw();
        break;

      case 'ArrowRight':
        e.preventDefault();
        this._offsetX += MOVEMENT_STEP;
        this._draw();
        break;

      case 'Enter':
        e.preventDefault();
        this._lockResult();
        break;

      default:
        // Ignore other keys
        break;
    }
  },

  /**
   * Handle canvas click events (left-click only, e.button === 0).
   * Mirrors Enter key behavior:
   * - If test not started: starts the test
   * - If test started: locks in the result
   * @param {MouseEvent} e
   * @private
   */
  _onCanvasClick(e) {
    // Only accept left-click (button === 0)
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    // If locked, ignore click (only Escape to exit)
    if (this._isLocked) return;

    // If test not started, start the test
    if (!this._testStarted) {
      this._testStarted = true;
      this._draw();
      return;
    }

    // Test started - lock in the result
    this._lockResult();
  },

  /**
   * Lock in the current result: package data and dispatch event.
   * @private
   */
  _lockResult() {
    if (this._isLocked) return;

    this._isLocked = true;

    // Calculate final prism values
    const horizontalPrism = this._calcPrismDiopter(this._offsetX);
    const verticalPrism = this._calcPrismDiopter(this._offsetY);

    // Build payload
    const payload = {
      test_type: 'Schober_Heterophoria',
      eye_tested: 'OU',
      score_primary: {
        horizontal_prism: parseFloat(horizontalPrism.toFixed(4)),
        vertical_prism: parseFloat(verticalPrism.toFixed(4)),
      },
      raw_data: {
        pixel_offset_x: this._offsetX,
        pixel_offset_y: this._offsetY,
        ccPxPerMm: this._ccPxPerMm,
        distance_m: SCHOBER_DISTANCE_M,
      },
    };

    // Dispatch custom event
    const event = new CustomEvent('visionTestCompleted', { detail: payload });
    document.dispatchEvent(event);

    console.log('[Schober] Test completed. Payload dispatched:', payload);

    // Redraw HUD to show locked state
    this._draw();
  },

  /**
   * Cleanup: remove event listeners, clear canvas.
   */
  cleanup() {
    if (this._boundKeydown) {
      document.removeEventListener('keydown', this._boundKeydown);
      this._boundKeydown = null;
    }
    if (this._boundClick) {
      if (this._canvas) {
        this._canvas.removeEventListener('click', this._boundClick);
      }
      this._boundClick = null;
    }
    if (this._boundResize) {
      window.removeEventListener('resize', this._boundResize);
      this._boundResize = null;
    }

    const board = document.getElementById('display-board');
    if (board) {
      board.innerHTML = '';
      board.style.backgroundColor = '';
    }

    this._canvas = null;
    this._ctx = null;
    this._isLocked = false;

    console.log('[Schober] Module cleaned up');
  },
};

export default schoberTest;
