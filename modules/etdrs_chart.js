/**
 * etdrs_chart.js — ETDRS Chart (LogMAR) with Standardised 5×5 Paths
 * ================================================================
 *
 * Module id: 'far-vision-etdrs'
 */

import { getOptotypeSize } from '../js/calibration.js';
import { SLOAN } from './optotype_paths.js';

const LOGMAR_LEVELS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2, -0.3];
const LETTERS_PER_ROW = 5;
const LETTER_KEYS = Object.keys(SLOAN);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pick5() { return shuffle([...LETTER_KEYS]).slice(0, LETTERS_PER_ROW); }

const etdrsChart = {
  id: 'far-vision-etdrs',
  label: 'ETDRS',
  steps: LOGMAR_LEVELS,
  _letters: pick5(),

  render(index) {
    this._letters = pick5();
    const logmar = LOGMAR_LEVELS[index];
    let calib;
    const calibrator = window.__calibrator;
    if (calibrator && calibrator.ppi > 0) calib = { distanceM: calibrator.distanceM, ppi: calibrator.ppi };
    const pxSize = getOptotypeSize(logmar, calib);

    const parts = [];
    // Use fixed 5 letters but ensure they don't overflow by setting max-width
    const lettersToShow = this._letters;
    
    parts.push(`<div style="display:flex;flex-direction:row;justify-content:center;align-items:center;gap:${pxSize * 0.15}px;width:100%;height:60vh;flex-wrap:wrap;justify-content:space-around;max-width:100%;overflow:hidden;box-sizing:border-box;">`);

    lettersToShow.forEach((letter) => {
      parts.push(`<svg viewBox="0 0 5 5" width="${pxSize}" height="${pxSize}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;flex-shrink:0;">${SLOAN[letter]}</svg>`);
    });

    parts.push('</div>');

    const snellenDenom = Math.round(20 * Math.pow(10, logmar));
    const decimalAcuity = Math.pow(10, -logmar);
    parts.push(`
      <div style="position:absolute;bottom:30px;right:30px;font-family:'Segoe UI',system-ui,sans-serif;color:#333;font-size:1.2rem;background:rgba(255,255,255,0.95);padding:20px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);border:1px solid #e0e0e0;backdrop-filter:blur(4px);">
        <div style="font-weight:700;margin-bottom:12px;font-size:1rem;color:#666;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #eee;padding-bottom:8px;">Kết quả thị lực</div>
        <div style="display:grid;grid-template-columns:120px auto;gap:10px 16px;align-items:center;">
          <span style="color:#666;">LogMAR:</span> <strong style="font-size:1.4rem;color:#000;">${logmar.toFixed(1)}</strong>
          <span style="color:#666;">Snellen (ft):</span> <strong style="font-size:1.4rem;color:#0056b3;">20/${snellenDenom}</strong>
          <span style="color:#666;">Hệ thập phân:</span> <strong style="font-size:1.4rem;color:#28a745;">${decimalAcuity.toFixed(2)}</strong>
        </div>
      </div>`);

    const board = document.getElementById('display-board');
    if (board) board.innerHTML = parts.join('');
  },

  randomize() {
    this._letters = pick5();
    const idx = window.__state ? window.__state.stepIndex : 0;
    this.render(idx);
  },
};

const etdrsChartFarVision = { ...etdrsChart, id: 'far-vision', label: 'Thị lực nhìn xa' };

export default etdrsChart;
export { etdrsChart, etdrsChartFarVision, LOGMAR_LEVELS, SLOAN };