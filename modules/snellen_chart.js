/**
 * snellen_chart.js — Snellen Pyramid Chart with Standardised 5×5 Sloan Paths
 * ==========================================================================
 * Module id: 'far-vision-snellen'
 */

import { getOptotypeSize } from '../js/calibration.js';
import { SLOAN } from './optotype_paths.js';

const SLOAN_LETTERS = Object.keys(SLOAN);
const ROWS = [
  { snellen: '20/200', logmar: 1.00, count: 1, decimal: '0.10' },
  { snellen: '20/100', logmar: 0.70, count: 2, decimal: '0.20' },
  { snellen: '20/70',  logmar: 0.54, count: 3, decimal: '0.29' },
  { snellen: '20/50',  logmar: 0.40, count: 4, decimal: '0.40' },
  { snellen: '20/40',  logmar: 0.30, count: 5, decimal: '0.50' },
  { snellen: '20/30',  logmar: 0.18, count: 6, decimal: '0.67' },
  { snellen: '20/20',  logmar: 0.00, count: 8, decimal: '1.00' },
];
const VB_W = 1000;
const LABEL_X = 20;
const DECIMAL_X = 980;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
function pickLetters(n) {
  const pool = shuffle([...SLOAN_LETTERS]);
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
}

const snellenChart = {
  id: 'far-vision-snellen',
  label: 'Snellen',
  steps: [1],
  _rows: ROWS.map((r) => pickLetters(r.count)),

  render(_index) {
    this._rows = ROWS.map((r) => pickLetters(r.count));
    let calib;
    const calibrator = window.__calibrator;
    if (calibrator && calibrator.ppi > 0) calib = { distanceM: calibrator.distanceM, ppi: calibrator.ppi };

    const rowSizes = ROWS.map((r) => ({ px: getOptotypeSize(r.logmar, calib), snellen: r.snellen, decimal: r.decimal, count: r.count }));

    let vbH = 0;
    for (let i = 0; i < rowSizes.length; i++) {
      const px = rowSizes[i].px;
      vbH += px + (i < rowSizes.length - 1 ? rowSizes[i + 1].px * 0.5 : px * 0.5);
    }
    vbH = Math.max(vbH, 400);

    const parts = [];
    parts.push(`<svg class="etdrs-chart snellen-chart" viewBox="0 0 ${VB_W} ${vbH}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">`);

    let yCursor = 0;
    for (let i = 0; i < rowSizes.length; i++) {
      const { px, snellen, decimal, count } = rowSizes[i];
      const scale = px / 5;
      const gap = (i < rowSizes.length - 1) ? rowSizes[i + 1].px * 0.5 : px * 0.5;

      const labelSize = Math.max(px * 0.3, 12);
      parts.push(`<text x="${LABEL_X}" y="${yCursor + px * 0.5}" font-family="'Segoe UI',system-ui,sans-serif" font-size="${labelSize}" fill="#999" dominant-baseline="middle" style="white-space:nowrap;">${snellen}</text>`);
      parts.push(`<text x="${DECIMAL_X}" y="${yCursor + px * 0.5}" font-family="'Segoe UI',system-ui,sans-serif" font-size="${labelSize}" fill="#999" text-anchor="end" dominant-baseline="middle" style="white-space:nowrap;">${decimal}</text>`);

      const spacing = px * 1.3;
      const totalW = count * spacing;
      const startX = (VB_W - totalW) / 2;
      const letters = this._rows[i];

      for (let j = 0; j < count; j++) {
        const lx = startX + j * spacing;
        parts.push(`<g transform="translate(${lx}, ${yCursor}) scale(${scale})" style="max-width:100%;height:auto;">${SLOAN[letters[j]]}</g>`);
      }
      yCursor += px + gap;
    }
    parts.push('</svg>');

    const board = document.getElementById('display-board');
    if (board) board.innerHTML = parts.join('');
  },

  randomize() {
    this._rows = ROWS.map((r) => pickLetters(r.count));
    this.render(0);
  },
};

export default snellenChart;
export { snellenChart, ROWS, SLOAN_LETTERS };