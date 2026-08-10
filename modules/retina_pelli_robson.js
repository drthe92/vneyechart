/**
 * retina_pelli_robson.js — Pelli-Robson Contrast Sensitivity Test Module
 * =====================================================================
 *
 * Standalone module for Pelli-Robson Test.
 * id: 'retina-pelli-robson'
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
//  Pelli‑Robson Test Module
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

    // Note: Keyboard and wheel events are now handled by UniversalInput
    // NEXT/PREV actions will be handled by the main.js event listeners
    // This module only needs button click handlers for its internal navigation
  },

  cleanup() {
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

  /** @deprecated Use cleanup() instead */
  destroy() {
    this.cleanup();
  },

  randomize() {
    this._letters = null;
    const idx = window.__state ? window.__state.stepIndex : 0;
    this.render(idx);
  },
};

export default pelliRobson;
export { pelliRobson };
