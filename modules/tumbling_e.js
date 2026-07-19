/**
 * tumbling_e.js — Tumbling E with Standardised 5×5 Path
 * ======================================================
 * Module id: 'far-vision-tumbling-e'
 * Xoay 4 hướng: phải / trái / trên / dưới
 */

import { getOptotypeSize } from '../js/calibration.js';
import { TUMBLING_E } from './optotype_paths.js';

const LOGMAR_LEVELS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2, -0.3];
const ORIENTATIONS = ['right', 'left', 'up', 'down'];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

function rotate(path, orientation) {
  const angle = { right: '0', left: '180', up: '270', down: '90' }[orientation] || '0';
  return `<g transform="rotate(${angle}, 2.5, 2.5)">${path}</g>`;
}

const tumblingEModule = {
  id: 'far-vision-tumbling-e',
  label: 'Tumbling E',
  steps: LOGMAR_LEVELS,
  _orientation: 'right',

  render(index) {
    this._orientation = shuffle([...ORIENTATIONS])[0];
    const logmar = LOGMAR_LEVELS[index];
    let calib;
    const calibrator = window.__calibrator;
    if (calibrator && calibrator.ppi > 0) calib = { distanceM: calibrator.distanceM, ppi: calibrator.ppi };
    const pxSize = getOptotypeSize(logmar, calib);

    const parts = [];
    parts.push(`<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;width:100%;height:60vh;">`);
    parts.push(`<svg viewBox="0 0 5 5" width="${pxSize}" height="${pxSize}" xmlns="http://www.w3.org/2000/svg">${rotate(TUMBLING_E, this._orientation)}</svg>`);
    parts.push('</div>');

    // Note: the on-screen direction indicator (Hướng: Trái/Phải/Trên/Dưới)
    // was removed per request — the E still rotates, only the text label
    // is no longer shown to the patient.
    const snellenDenom = Math.round(20 * Math.pow(10, logmar));
    parts.push(`<div class="etdrs-info"><span class="etdrs-labels">LogMAR <strong>${logmar.toFixed(1)}</strong> &nbsp;·&nbsp; <strong>20/${snellenDenom}</strong></span><span class="etdrs-counter">${index+1}/${LOGMAR_LEVELS.length}</span></div>`);

    const board = document.getElementById('display-board');
    if (board) board.innerHTML = parts.join('');
  },

  randomize() {
    this._orientation = shuffle([...ORIENTATIONS])[0];
    this.render(window.__state ? window.__state.stepIndex : 0);
  },
};

export default tumblingEModule;
export { tumblingEModule, LOGMAR_LEVELS };