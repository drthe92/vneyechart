/**
 * snellen_chart.js — Snellen Pyramid Chart (Sloan optotypes from drthe)
 * ==========================================================================
 * Module id: 'far-vision-snellen'
 *
 * Yêu cầu thiết kế:
 *   1. Optotype lấy từ generated/drthe_optotype/sloan (SVG 500×500).
 *   2. Vạch đỏ đánh dấu hàng 20/40, vạch xanh đánh dấu hàng 20/20.
 *   3. Số lượng optotype mỗi hàng ≤ 5.
 *   4. Khoảng cách giữa hai optotype = đúng một chiều rộng optotype
 *      (spacing = optotypeWidth + gap = px + px = 2·px).
 */

import { getOptotypeSize } from '../js/calibration.js';
import { loadOptotype, DR_THE_VIEWBOX } from './drthe_optotype_loader.js';

// 10 chữ cái Sloan chuẩn (khớp với file trong generated/drthe_optotype/sloan)
const SLOAN_LETTERS = ['C', 'D', 'H', 'K', 'N', 'O', 'R', 'S', 'V', 'Z'];

// Mỗi hàng tối đa 5 optotype (yêu cầu 3)
const ROWS = [
  { snellen: '20/200', logmar: 1.00, count: 1, decimal: '0.10' },
  { snellen: '20/100', logmar: 0.70, count: 2, decimal: '0.20' },
  { snellen: '20/70',  logmar: 0.54, count: 3, decimal: '0.29' },
  { snellen: '20/50',  logmar: 0.40, count: 4, decimal: '0.40' },
  { snellen: '20/40',  logmar: 0.30, count: 5, decimal: '0.50', marker: 'red'    },
  { snellen: '20/30',  logmar: 0.18, count: 5, decimal: '0.67' },
  { snellen: '20/20',  logmar: 0.00, count: 5, decimal: '1.00', marker: 'blue'   },
];

const VB_W = 1000;
const LABEL_X = 20;
const DECIMAL_X = 980;
const MARKER_W = 4; // độ dày vạch đánh dấu

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

  async render(_index) {
    this._rows = ROWS.map((r) => pickLetters(r.count));

    let calib;
    const calibrator = window.__calibrator;
    if (calibrator && calibrator.ppi > 0) calib = { distanceM: calibrator.distanceM, ppi: calibrator.ppi };

    const rowSizes = ROWS.map((r) => ({
      px: getOptotypeSize(r.logmar, calib),
      snellen: r.snellen,
      decimal: r.decimal,
      count: r.count,
      marker: r.marker || null,
    }));

    // Chiều cao viewBox: mỗi hàng = px (optotype) + nửa px (khoảng cách dòng)
    let vbH = 0;
    for (let i = 0; i < rowSizes.length; i++) {
      const px = rowSizes[i].px;
      vbH += px + (i < rowSizes.length - 1 ? rowSizes[i + 1].px * 0.5 : px * 0.5);
    }
    vbH = Math.max(vbH, 400);

    // Tải path Sloan từ drthe (async)
    const specs = [];
    this._rows.forEach((row) => row.forEach((ch) => specs.push(['sloan', ch])));
    const paths = {};
    await Promise.all(specs.map(async ([g, n]) => { paths[`${g}/${n}`] = await loadOptotype(g, n); }));

    const parts = [];
    parts.push(`<svg class="etdrs-chart snellen-chart" viewBox="0 0 ${VB_W} ${vbH}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">`);

    let yCursor = 0;
    for (let i = 0; i < rowSizes.length; i++) {
      const { px, snellen, decimal, count, marker } = rowSizes[i];
      const scale = px / 500; // drthe viewBox 500×500
      const gap = (i < rowSizes.length - 1) ? rowSizes[i + 1].px * 0.5 : px * 0.5;

      // Vạch đánh dấu (đỏ 20/40, xanh 20/20) — vẽ qua giữa hàng
      if (marker) {
        const my = yCursor + px * 0.5;
        const color = marker === 'red' ? '#e53935' : '#1e88e5';
        parts.push(`<line x1="0" y1="${my}" x2="${VB_W}" y2="${my}" stroke="${color}" stroke-width="${MARKER_W}" />`);
      }

      const labelSize = Math.max(px * 0.3, 12);
      parts.push(`<text x="${LABEL_X}" y="${yCursor + px * 0.5}" font-family="'Segoe UI',system-ui,sans-serif" font-size="${labelSize}" fill="#999" dominant-baseline="middle" style="white-space:nowrap;">${snellen}</text>`);
      parts.push(`<text x="${DECIMAL_X}" y="${yCursor + px * 0.5}" font-family="'Segoe UI',system-ui,sans-serif" font-size="${labelSize}" fill="#999" text-anchor="end" dominant-baseline="middle" style="white-space:nowrap;">${decimal}</text>`);

      // Yêu cầu 4: khoảng cách giữa 2 optotype = 1 chiều rộng optotype
      // => spacing = px (optotype) + px (gap) = 2·px
      const spacing = px * 2;
      const totalW = count * spacing - px; // chiều rộng thực của hàng (bỏ gap thừa cuối)
      const startX = (VB_W - totalW) / 2;
      const letters = this._rows[i];

      for (let j = 0; j < count; j++) {
        const lx = startX + j * spacing;
        const path = paths[`sloan/${letters[j]}`] || '';
        if (path) {
          parts.push(`<g transform="translate(${lx}, ${yCursor}) scale(${scale})">${path}</g>`);
        }
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
