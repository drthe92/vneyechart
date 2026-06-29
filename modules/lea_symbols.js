/**
 * lea_symbols.js — LEA Symbols with Standardised 5×5 Paths
 * ========================================================
 * Module id: 'far-vision-lea'
 */

import { getOptotypeSize } from '../js/calibration.js';
import { LEA } from './optotype_paths.js';

const LOGMAR_LEVELS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2, -0.3];
const SYMBOLS_PER_ROW = 4;
const SYMBOL_KEYS = Object.keys(LEA);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
function pickSymbols() { return shuffle([...SYMBOL_KEYS]); }

const leaModule = {
  id: 'far-vision-lea',
  label: 'LEA Symbols',
  steps: LOGMAR_LEVELS,
  _symbols: pickSymbols(),

  render(index) {
    this._symbols = pickSymbols();
    const logmar = LOGMAR_LEVELS[index];
    let calib;
    const calibrator = window.__calibrator;
    if (calibrator && calibrator.ppi > 0) calib = { distanceM: calibrator.distanceM, ppi: calibrator.ppi };
    const pxSize = getOptotypeSize(logmar, calib);
    const gap = pxSize * 0.4;
    const totalWidth = pxSize * SYMBOLS_PER_ROW + gap * (SYMBOLS_PER_ROW - 1);

    const svgParts = [];
    svgParts.push(`<svg class="etdrs-chart" viewBox="0 0 ${totalWidth} ${pxSize}" width="${totalWidth}" height="${pxSize}" xmlns="http://www.w3.org/2000/svg">`);
    this._symbols.forEach((key, i) => {
      const x = i * (pxSize + gap);
      const scale = pxSize / 5;
      svgParts.push(`<g transform="translate(${x}, 0) scale(${scale})">${LEA[key]}</g>`);
    });
    svgParts.push('</svg>');

    const snellenDenom = Math.round(20 * Math.pow(10, logmar));
    svgParts.push(`<div class="etdrs-info"><span class="etdrs-labels">LogMAR <strong>${logmar.toFixed(1)}</strong> &nbsp;·&nbsp; <strong>20/${snellenDenom}</strong></span><span class="etdrs-counter">${index + 1} / ${LOGMAR_LEVELS.length}</span></div>`);

    const board = document.getElementById('display-board');
    if (board) board.innerHTML = svgParts.join('');
  },

  randomize() {
    this._symbols = pickSymbols();
    this.render(window.__state ? window.__state.stepIndex : 0);
  },
};

export default leaModule;
export { leaModule };