/**
 * distance_va.js — ETDRS Distance VA with drthe Sloan optotypes
 * ==============================================================
 * Module id: 'far-vision'
 *
 * Sử dụng optotype Sloan từ generated/drthe_optotype/sloan (SVG 500×500)
 * thay vì path mã hóa cứng trong optotype_paths.js.
 */

import { getOptotypeSize } from '../js/calibration.js';
import { loadOptotype } from './drthe_optotype_loader.js';

const LOGMAR_LEVELS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2, -0.3];
const LETTERS_PER_ROW = 5;
// 10 chữ cái Sloan chuẩn (khớp với file trong generated/drthe_optotype/sloan)
const LETTER_KEYS = ['C', 'D', 'H', 'K', 'N', 'O', 'R', 'S', 'V', 'Z'];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
function pickRandomLetters() { return shuffle([...LETTER_KEYS]).slice(0, LETTERS_PER_ROW); }
function logmarToSnellen(logmar) { return `20/${Math.round(20 * Math.pow(10, logmar))}`; }

const distanceVATest = {
  id: 'far-vision',
  label: 'Thị lực nhìn xa',
  steps: LOGMAR_LEVELS,
  _letters: pickRandomLetters(),

  async render(index) {
    const logmar = LOGMAR_LEVELS[index];
    let calib;
    const calibrator = window.__calibrator;
    if (calibrator && calibrator.ppi > 0) calib = { distanceM: calibrator.distanceM, ppi: calibrator.ppi };
    const pxSize = getOptotypeSize(logmar, calib);
    const gap = pxSize * 0.3;
    const totalWidth = pxSize * LETTERS_PER_ROW + gap * (LETTERS_PER_ROW - 1);

    // Tải path Sloan từ drthe (async)
    const paths = {};
    await Promise.all(this._letters.map(async (letter) => {
      paths[letter] = await loadOptotype('sloan', letter);
    }));

    const svgParts = [];
    svgParts.push(`<svg class="etdrs-chart" viewBox="0 0 ${totalWidth} ${pxSize}" width="${totalWidth}" height="${pxSize}" xmlns="http://www.w3.org/2000/svg">`);

    this._letters.forEach((letter, i) => {
      const x = i * (pxSize + gap);
      const scale = pxSize / 500; // drthe viewBox 500×500
      const path = paths[letter] || '';
      if (path) {
        svgParts.push(`<g transform="translate(${x}, 0) scale(${scale})">${path}</g>`);
      }
    });

    svgParts.push('</svg>');
    svgParts.push(`<div class="etdrs-info"><span class="etdrs-labels">LogMAR <strong>${logmar.toFixed(1)}</strong> &nbsp;·&nbsp; <strong>${logmarToSnellen(logmar)}</strong></span><span class="etdrs-counter">${index + 1} / ${LOGMAR_LEVELS.length}</span></div>`);

    const board = document.getElementById('display-board');
    if (board) board.innerHTML = svgParts.join('');
  },

  randomize() {
    this._letters = pickRandomLetters();
    this.render(window.__state ? window.__state.stepIndex : 0);
  },
};

export default distanceVATest;
export { LOGMAR_LEVELS, distanceVATest };
