/**
 * retina_amsler.js — Amsler Grid Module
 * ========================================
 *
 * Standalone module for Amsler Grid test.
 * id: 'retina-amsler'
 */

// ================================================================
//  Amsler Grid Module
// ================================================================

const amslerGrid = {
  id: 'retina-amsler',
  label: 'Amsler Grid',
  steps: [0],

  /** Whether we are in dark‑mode (black bg, white lines). */
  _darkMode: true,
  _keyHandler: null,
  _wheelHandler: null,

  render() {
    const board = document.getElementById('display-board');
    if (!board) return;

    // Clean up old handlers
    this.destroy();

    board.innerHTML = `
      <div class="amsler-wrapper">
        <div class="amsler-toolbar">
          <span class="amsler-mode-label">${this._darkMode ? 'Nền đen / Kẻ trắng' : 'Nền trắng / Kẻ đen'}</span>
          <button class="amsler-toggle-btn" id="amslerToggleBtn" title="Chuyển đổi tương phản">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2v20M2 12h20"/>
            </svg>
            Chuyển đổi
          </button>
          <span class="amsler-hint">(Phím cách / Con lăn chuột)</span>
        </div>
        <div class="amsler-canvas-wrapper">
          <canvas id="amslerCanvas" class="amsler-canvas"></canvas>
        </div>
      </div>
    `;

    this._drawGrid();
    this._wireEvents();
  },

  _drawGrid() {
    const canvas = document.getElementById('amslerCanvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    const size = Math.min(container.clientWidth, container.clientHeight, 600);

    // Barrier 2: Device Pixel Ratio — back the canvas with device pixels
    // so lines stay crisp on Retina / 4K (otherwise the browser upscales a
    // 1× CSS-px buffer and the grid looks blurry).
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width  = size + 'px';
    canvas.style.height = size + 'px';

    const ctx = canvas.getContext('2d');
    // Draw in CSS-px coordinates; the scale maps them to device pixels.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg  = this._darkMode ? '#000000' : '#FFFFFF';
    const fg  = this._darkMode ? '#FFFFFF' : '#000000';

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Grid lines — 20 × 20 cells.
    // Barrier 3 (canvas sub-pixel): snap to half-pixel so a 1px stroke
    // lands on a single device row instead of straddling two (grey blur).
    const cells = 20;
    const step  = size / cells;
    ctx.strokeStyle = fg;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    for (let i = 0; i <= cells; i++) {
      const pos = Math.floor(i * step) + 0.5;
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
    }
    ctx.stroke();

    // Fixation dot at centre
    const cx = size / 2;
    const cy = size / 2;
    const dotRadius = Math.max(3, size * 0.012);

    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(cx, cy, dotRadius, 0, 2 * Math.PI);
    ctx.fill();
  },

  _wireEvents() {
    document.getElementById('amslerToggleBtn')?.addEventListener('click', () => this._toggle());

    // Mouse wheel toggles on canvas
    const canvas = document.getElementById('amslerCanvas');
    if (canvas) {
      this._wheelHandler = (e) => {
        e.preventDefault();
        this._toggle();
      };
      canvas.addEventListener('wheel', this._wheelHandler, { passive: false });
    }

    // Barrier 2: redraw on viewport / DPR change so the grid never blurs
    // after a window resize or moving the window to another monitor.
    this._resizeHandler = () => this._drawGrid();
    window.addEventListener('resize', this._resizeHandler);
    if (window.matchMedia) {
      this._dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      this._dprQueryHandler = () => this._drawGrid();
      // Some browsers support addEventListener on MediaQueryList; fall back to addListener.
      if (this._dprQuery.addEventListener) {
        this._dprQuery.addEventListener('change', this._dprQueryHandler);
      } else if (this._dprQuery.addListener) {
        this._dprQuery.addListener(this._dprQueryHandler);
      }
    }
  },

  _toggle() {
    this._darkMode = !this._darkMode;
    this.render();
  },

  cleanup() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (this._wheelHandler) {
      const canvas = document.getElementById('amslerCanvas');
      if (canvas) canvas.removeEventListener('wheel', this._wheelHandler);
      this._wheelHandler = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this._dprQuery && this._dprQueryHandler) {
      if (this._dprQuery.removeEventListener) {
        this._dprQuery.removeEventListener('change', this._dprQueryHandler);
      } else if (this._dprQuery.removeListener) {
        this._dprQuery.removeListener(this._dprQueryHandler);
      }
      this._dprQuery = null;
      this._dprQueryHandler = null;
    }
  },

  /** @deprecated Use cleanup() instead */
  destroy() {
    this.cleanup();
  },

  randomize() {
    // Toggle dark mode - this is the SHUFFLE action for Amsler Grid
    this._darkMode = !this._darkMode;
    this.render();
  },

  /**
   * Ensure cleanup is called when module is destroyed
   */
  destroy() {
    this.cleanup();
    // Force remove any keyboard handlers that might be attached to document
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  },
};

export default amslerGrid;
export { amslerGrid };
