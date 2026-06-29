/**
 * retina_subs.js — Retina (Võng mạc) Sub‑modules
 * =================================================
 *
 * Contains 3 sub‑modules:
 *   1. Amsler Grid        — id: 'retina-amsler'
 *   2. Ishihara Test      — id: 'retina-ishihara'
 *   3. Pelli‑Robson Test  — id: 'retina-pelli-robson'
 */

import { SLOAN } from './optotype_paths.js';

// ================================================================
//  Constants
// ================================================================

/** Sloan letters used in Pelli‑Robson (10 letters). */
const SLOAN_KEYS = ['C', 'D', 'H', 'K', 'N', 'O', 'R', 'S', 'V', 'Z'];

/** Number of triplets in a standard Pelli‑Robson chart. */
const NUM_TRIPLETS = 16;

/** LogCS values: 0.00, 0.15, 0.30, … 2.25 */
const LogCS_VALUES = Array.from({ length: NUM_TRIPLETS }, (_, i) => +(i * 0.15).toFixed(2));

/** Ishihara image files (sorted alphabetically). */
const ISHIHARA_FILES = [
  'Ishihara_12.svg',
  'Ishihara_2.svg',
  'Ishihara_6.png',
  'Ishihara_74.svg',
  'ishihara_42.png',
  'ishihara_45.jpg',
  'ishihara_97.jpg',
  'shihara_3.jpg',
];

// ================================================================
//  Helpers
// ================================================================

/** Fisher–Yates shuffle. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick n random letters from SLOAN_KEYS. */
function pickLetters(n) {
  return shuffle([...SLOAN_KEYS]).slice(0, n);
}

/**
 * Compute 8‑bit gray value for a given LogCS.
 *
 * Weber Contrast C = 10^(-LogCS)
 * Letter luminance  L = L_bg * (1 - C)
 * On 8‑bit sRGB: gray = 255 × (1 - C)  where white = 255.
 *
 * @param {number} logcs
 * @returns {number} gray value 0‑255
 */
function logcsToGray(logcs) {
  const weber = Math.pow(10, -logcs);
  const gray  = Math.round(255 * (1 - weber));
  return Math.max(0, Math.min(255, gray));
}

/**
 * Build an inline SVG for a Sloan letter at a given gray value.
 * The stroke colour is set so the letter blends toward the white
 * background as LogCS increases (Weber contrast).
 *
 * @param {string} letter  Sloan key
 * @param {number} pxSize  rendered size in px
 * @param {number} gray    RGB gray value 0‑255
 * @returns {string} SVG markup
 */
function sloanSvg(letter, pxSize, gray) {
  const hex  = `rgb(${gray},${gray},${gray})`;
  const path = SLOAN[letter];
  if (!path) return '';
  const styled = path.replace(/stroke="#000000"/g, `stroke="${hex}"`);
  return `<svg viewBox="0 0 5 5" width="${pxSize}" height="${pxSize}" xmlns="http://www.w3.org/2000/svg">${styled}</svg>`;
}

// ================================================================
//  1. Amsler Grid
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
    canvas.width  = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    const bg  = this._darkMode ? '#000000' : '#FFFFFF';
    const fg  = this._darkMode ? '#FFFFFF' : '#000000';

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Grid lines — 20 × 20 cells
    const cells = 20;
    const step  = size / cells;
    ctx.strokeStyle = fg;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    for (let i = 0; i <= cells; i++) {
      const pos = i * step;
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

    // Keyboard: Space toggles
    this._keyHandler = (e) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        this._toggle();
      }
    };
    document.addEventListener('keydown', this._keyHandler);

    // Mouse wheel toggles on canvas
    const canvas = document.getElementById('amslerCanvas');
    if (canvas) {
      this._wheelHandler = (e) => {
        e.preventDefault();
        this._toggle();
      };
      canvas.addEventListener('wheel', this._wheelHandler, { passive: false });
    }
  },

  _toggle() {
    this._darkMode = !this._darkMode;
    this.render();
  },

  destroy() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (this._wheelHandler) {
      const canvas = document.getElementById('amslerCanvas');
      if (canvas) canvas.removeEventListener('wheel', this._wheelHandler);
      this._wheelHandler = null;
    }
  },

  randomize() {
    this._darkMode = !this._darkMode;
    this.render();
  },
};

// ================================================================
//  2. Ishihara Test
// ================================================================

const ishiharaTest = {
  id: 'retina-ishihara',
  label: 'Ishihara Test',
  steps: ISHIHARA_FILES,

  /** Which view mode: 'grid' or 'slider'. */
  _viewMode: 'grid',

  render(index) {
    const board = document.getElementById('display-board');
    if (!board) return;

    if (this._viewMode === 'slider') {
      board.innerHTML = this._buildSlider(index);
      this._wireSlider(index);
    } else {
      board.innerHTML = this._buildGrid();
      this._wireGrid();
    }

    // Also wire the toggle button after building DOM
    document.getElementById('ishiharaViewToggle')?.addEventListener('click', () => {
      this._viewMode = this._viewMode === 'grid' ? 'slider' : 'grid';
      this.render(this._viewMode === 'slider' ? 0 : 0);
    });
  },

  /** Build the 8‑image grid. */
  _buildGrid() {
    const parts = [];
    parts.push('<div class="ishihara-toolbar">');
    parts.push('  <span class="ishihara-mode-label">Chế độ lưới</span>');
    parts.push('  <button class="ishihara-view-toggle" id="ishiharaViewToggle">Chuyển sang Slider</button>');
    parts.push('</div>');
    parts.push('<div class="ishihara-grid">');
    this.steps.forEach((file, i) => {
      const imgPath = `generated/ishihara_color_test/${file}`;
      parts.push('  <figure class="ishihara-figure">');
      parts.push(`    <img src="${imgPath}" alt="Ishihara hình ${i + 1}" class="ishihara-img" loading="lazy" crossorigin="anonymous">`);
      parts.push(`    <figcaption class="ishihara-caption">Hình ${i + 1}</figcaption>`);
      parts.push('  </figure>');
    });
    parts.push('</div>');
    return parts.join('');
  },

  /** Build the single‑image slider view. */
  _buildSlider(index) {
    const file = this.steps[index];
    const imgPath = `generated/ishihara_color_test/${file}`;
    const parts = [];
    parts.push('<div class="ishihara-toolbar">');
    parts.push('  <span class="ishihara-mode-label">Chế độ Slider</span>');
    parts.push('  <button class="ishihara-view-toggle" id="ishiharaViewToggle">Chuyển sang Grid</button>');
    parts.push('</div>');
    parts.push('<div class="ishihara-slider">');
    parts.push('  <figure class="ishihara-figure ishihara-slider-figure">');
    parts.push(`    <img src="${imgPath}" alt="Ishihara hình ${index + 1}" class="ishihara-img ishihara-slider-img" crossorigin="anonymous">`);
    parts.push(`    <figcaption class="ishihara-caption">Hình ${index + 1} / ${this.steps.length}</figcaption>`);
    parts.push('  </figure>');
    parts.push('</div>');
    // Navigation arrows
    parts.push('<div class="ishihara-slider-nav">');
    parts.push(`  <button class="ishihara-nav-btn" id="ishiharaPrevBtn" ${index === 0 ? 'disabled' : ''}>❮ Trước</button>`);
    parts.push(`  <button class="ishihara-nav-btn" id="ishiharaNextBtn" ${index === this.steps.length - 1 ? 'disabled' : ''}>Sau ❯</button>`);
    parts.push('</div>');
    return parts.join('');
  },

  _wireGrid() {
    // The toggle is wired in render()
  },

  _wireSlider(index) {
    document.getElementById('ishiharaPrevBtn')?.addEventListener('click', () => {
      if (index > 0) {
        const newIdx = index - 1;
        const state = window.__state;
        if (state) state.stepIndex = newIdx;
        this.render(newIdx);
      }
    });
    document.getElementById('ishiharaNextBtn')?.addEventListener('click', () => {
      if (index < this.steps.length - 1) {
        const newIdx = index + 1;
        const state = window.__state;
        if (state) state.stepIndex = newIdx;
        this.render(newIdx);
      }
    });
  },

  randomize() {
    const idx = window.__state ? window.__state.stepIndex : 0;
    this.render(idx);
  },
};

// ================================================================
//  Helpers cho Pelli-Robson (Bayer Dithering)
// ================================================================

/** Ma trận Bayer 4x4 dùng để dập nhiễu không gian (Spatial Dithering) */
const BAYER_MATRIX_4X4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5]
];

/**
 * Tính toán mức xám cơ sở và tỷ lệ phần dư cho Dithering
 * Weber Contrast C = 10^(-LogCS)
 */
function calculateDitheredGray(logcs) {
  const weber = Math.pow(10, -logcs);
  const exactGray = 255 * (1 - weber);
  const baseGray = Math.floor(exactGray);
  const fraction = exactGray - baseGray;
  
  return { 
    base: Math.max(0, Math.min(255, baseGray)), 
    fraction: Math.max(0, Math.min(1, fraction)) 
  };
}

/**
 * Xây dựng SVG Optotype có tích hợp bộ lọc Dithering ở cấp độ điểm ảnh
 */
function sloanDitheredSvg(letter, pxSize, logcs) {
  const path = SLOAN[letter];
  if (!path) return '';

  const { base, fraction } = calculateDitheredGray(logcs);
  const safeBase = Math.min(254, base); 
  const colorBase = `rgb(${safeBase},${safeBase},${safeBase})`;
  const colorHigh = `rgb(${safeBase + 1},${safeBase + 1},${safeBase + 1})`;
  
  // Tạo ID pattern duy nhất dựa trên giá trị LogCS
  const patternId = `dither-${logcs.toString().replace('.', '-')}`;
  
  let rects = '';
  const thresholdFactor = fraction * 16; // Chuyển đổi phần dư sang thang 16 của ma trận 4x4
  
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const isHigh = thresholdFactor > BAYER_MATRIX_4X4[y][x];
      const fill = isHigh ? colorHigh : colorBase;
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}" />`;
    }
  }

  const defs = `
    <defs>
      <pattern id="${patternId}" patternUnits="userSpaceOnUse" width="4" height="4">
        ${rects}
      </pattern>
    </defs>
  `;

  // Thay thế màu stroke tĩnh bằng pattern dither động
  const styledPath = path.replace(/stroke="#000000"/g, `stroke="url(#${patternId})"`);

  return `<svg viewBox="0 0 5 5" width="${pxSize}" height="${pxSize}" xmlns="http://www.w3.org/2000/svg">${defs}${styledPath}</svg>`;
}

// ================================================================
//  3. Pelli‑Robson Test (Contrast Sensitivity) - Paginated & Dithered
// ================================================================

const pelliRobson = {
  id: 'retina-pelli-robson',
  label: 'Pelli‑Robson Test',
  steps: [0, 1, 2, 3], // 4 slides

  _letters: null,
  _keyHandler: null,
  _wheelHandler: null,
  _touchStartHandler: null,
  _touchEndHandler: null,

  _getLetters() {
    if (this._letters) return this._letters;
    this._letters = Array.from({ length: NUM_TRIPLETS }, () => pickLetters(3));
    return this._letters;
  },

  render(index = 0) {
    const board = document.getElementById('display-board');
    if (!board) return;

    if (index < 0) index = 0;
    if (index > 3) index = 3;
    
    const prevBtn = document.getElementById('pelliPrev');
    const nextBtn = document.getElementById('pelliNext');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.render(Math.max(0, index - 1));
      });
      prevBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.render(Math.max(0, index - 1));
      });
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.render(Math.min(3, index + 1));
      });
      nextBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.render(Math.min(3, index + 1));
      });
    }

    this.destroy();

    const letters = this._getLetters();
    const PX_SIZE = 162; 
    
    // Ma trận hiển thị tối ưu chống tràn (4 dòng x 1 cụm)
    const ROWS_PER_SLIDE = 2; 
    const TRIPLETS_PER_ROW = 2; 
    const TRIPLETS_PER_SLIDE = ROWS_PER_SLIDE * TRIPLETS_PER_ROW;

    const parts = [];

    parts.push('<div class="pelli-title">Pelli‑Robson Contrast Sensitivity Chart</div>');
    parts.push(`<div class="pelli-subtitle">Slide ${index + 1} / 4 — Cố định Tần số không gian (0.5 - 1 cpd) — Khoảng cách 0.9m</div>`);

    parts.push('<table class="pelli-table" style="margin: 0 auto; margin-top: 2vh; border-collapse: separate; border-spacing: 10px 15px;">');
    
    let startTripletIdx = index * TRIPLETS_PER_SLIDE;

    for (let row = 0; row < ROWS_PER_SLIDE; row++) {
      parts.push('<tr>');
      for (let t = 0; t < TRIPLETS_PER_ROW; t++) {
        const tripletIdx = startTripletIdx + row * TRIPLETS_PER_ROW + t;
        if (tripletIdx >= NUM_TRIPLETS) break;

        const logcs = LogCS_VALUES[tripletIdx];
        const triplet = letters[tripletIdx];

        parts.push('<td class="pelli-triplet-cell" style="padding: 10px;">');
        parts.push(`<div class="pelli-triplet" style="display: flex; gap: 20px; justify-content: center;">`);
        for (let li = 0; li < 3; li++) {
          parts.push(sloanDitheredSvg(triplet[li], PX_SIZE, logcs));
        }
        parts.push('</div>');
        parts.push(`<div class="pelli-logcs-label" style="text-align: center; margin-top: 10px; font-weight: 600; font-size: 1.1rem;">LogCS ${logcs.toFixed(2)}</div>`);
        parts.push('</td>');
      }
      parts.push('</tr>');
    }
    parts.push('</table>');

    parts.push('<div class="pelli-nav" style="text-align: center; margin-top: 20px;">');
    parts.push(`  <button class="ishihara-nav-btn" id="pelliPrev" ${index === 0 ? 'disabled' : ''}>❮ Trước</button>`);
    parts.push(`  <button class="ishihara-nav-btn" id="pelliNext" ${index === 3 ? 'disabled' : ''}>Sau ❯</button>`);
    parts.push('</div>');
    parts.push('<div style="text-align: center; margin-top: 10px; font-size: 0.85rem; color: #888;">(Hỗ trợ: Phím Mũi tên, Con lăn chuột, Vuốt cảm ứng)</div>');

    board.innerHTML = parts.join('');

    this._wireEvents(index);
  },

  _wireEvents(currentIndex) {
    const prev = () => {
      if (currentIndex > 0) {
        if (window.__state) window.__state.stepIndex = currentIndex - 1;
        this.render(currentIndex - 1);
      }
    };
    const next = () => {
      if (currentIndex < 3) {
        if (window.__state) window.__state.stepIndex = currentIndex + 1;
        this.render(currentIndex + 1);
      }
    };

    document.getElementById('pelliPrev')?.addEventListener('click', prev);
    document.getElementById('pelliNext')?.addEventListener('click', next);

    this._keyHandler = (e) => {
      if (['ArrowRight', 'ArrowDown', ' '].includes(e.key)) {
        e.preventDefault();
        next();
      } else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        prev();
      }
    };
    document.addEventListener('keydown', this._keyHandler);

    const board = document.getElementById('display-board');
    if (board) {
      this._wheelHandler = (e) => {
        e.preventDefault();
        if (e.deltaY > 0) next();
        else if (e.deltaY < 0) prev();
      };
      board.addEventListener('wheel', this._wheelHandler, { passive: false });

      let touchStartX = 0;
      this._touchStartHandler = (e) => { 
        touchStartX = e.changedTouches[0].screenX; 
      };
      this._touchEndHandler = (e) => {
        let touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 50) next();
        if (touchEndX - touchStartX > 50) prev();
      };
      board.addEventListener('touchstart', this._touchStartHandler, { passive: true });
      board.addEventListener('touchend', this._touchEndHandler, { passive: true });
    }
  },

  destroy() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    const board = document.getElementById('display-board');
    if (board) {
      if (this._wheelHandler) {
        board.removeEventListener('wheel', this._wheelHandler);
        this._wheelHandler = null;
      }
      if (this._touchStartHandler) {
        board.removeEventListener('touchstart', this._touchStartHandler);
        board.removeEventListener('touchend', this._touchEndHandler);
        this._touchStartHandler = null;
        this._touchEndHandler = null;
      }
    }
  },

  randomize() {
    this._letters = null;
    const idx = window.__state ? window.__state.stepIndex : 0;
    this.render(idx);
  },
};

// ================================================================
//  Exports
// ================================================================

export { amslerGrid, ishiharaTest, pelliRobson };
export default { amslerGrid, ishiharaTest, pelliRobson };
