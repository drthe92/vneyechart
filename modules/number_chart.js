/**
 * number_chart.js — Bảng thử thị lực nhìn xa dùng chữ số 0–9.
 * ==========================================================================
 * Sử dụng optotype từ generated/drthe_optotype/numbers (SVG 500×500).
 * Module id: 'far-vision-numbers'
 *
 * Cấu trúc đồng bộ với snellen_chart.js:
 *   1. Optotype lấy từ generated/drthe_optotype/numbers (SVG 500×500).
 *   2. Hiển thị đầy đủ các hàng 20/200 → 20/10.
 *   3. Chia 2 phần (nửa trên / nửa dưới), chuyển đổi bằng chuột & phím
 *      (tận dụng app:next / app:prev của UniversalInput, giống các bảng khác).
 *   4. Vạch đỏ đánh dấu hàng 20/40, vạch xanh đánh dấu hàng 20/20.
 *      Vạch CHỈ là đoạn ngắn ở hai cạnh ngoài (cột thông tin), kéo dài
 *      một phần vào phía trong để dễ nhìn, KHÔNG cắt ngang qua ký tự.
 *   5. Số lượng optotype mỗi hàng ≤ 5.
 *   6. Khoảng cách giữa hai optotype = đúng một chiều rộng optotype
 *      (spacing = optotypeWidth + gap = px + px = 2·px).
 */

import { getOptotypeSize } from '../js/calibration.js';
import { loadOptotype, DR_THE_VIEWBOX } from './drthe_optotype_loader.js';

// 10 chữ số 0–9 (khớp với file trong generated/drthe_optotype/numbers)
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Đầy đủ các hàng 20/200 → 20/10 (yêu cầu 2). Mỗi hàng ≤ 5 optotype (yêu cầu 5).
// LogMAR = log10(X/20); decimal = 20/X.
const ALL_ROWS = [
  { snellen: '20/200', logmar: 1.00,  count: 1, decimal: '0.10' },
  { snellen: '20/100', logmar: 0.70,  count: 2, decimal: '0.20' },
  { snellen: '20/70',  logmar: 0.54,  count: 3, decimal: '0.29' },
  { snellen: '20/50',  logmar: 0.40,  count: 4, decimal: '0.40' },
  { snellen: '20/40',  logmar: 0.30,  count: 5, decimal: '0.50', marker: 'red'  },
  { snellen: '20/32',  logmar: 0.204, count: 5, decimal: '0.625' },
  { snellen: '20/25',  logmar: 0.097, count: 5, decimal: '0.80' },
  { snellen: '20/20',  logmar: 0.00,  count: 5, decimal: '1.00', marker: 'blue' },
  { snellen: '20/16',  logmar: -0.097, count: 5, decimal: '1.25' },
  { snellen: '20/13',  logmar: -0.187, count: 5, decimal: '1.54' },
  { snellen: '20/10',  logmar: -0.301, count: 5, decimal: '2.00' },
];

// Chia 2 phần: nửa trên (20/200→20/40) và nửa dưới (20/32→20/10) — yêu cầu 3
const PARTS = [
  ALL_ROWS.slice(0, 5),
  ALL_ROWS.slice(5),
];

const VB_W = 1000;
const LABEL_X = 20;
const DECIMAL_X = 980;
const MARKER_LEN = 36;    // đoạn vạch ở sát cạnh ngoài (ngoài nhãn)
const MARKER_INNER = 70;  // đoạn vạch kéo dài vào phía trong để dễ nhìn
const MARKER_W = 4;       // độ dày vạch

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
function pickDigits(n) {
  const pool = shuffle([...DIGITS]);
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
}

const numberChart = {
  id: 'far-vision-numbers',
  label: 'Chữ số (0–9)',
  steps: [0, 1], // 2 phần, chuyển đổi bằng chuột/phím — yêu cầu 3
  _partRows: PARTS.map((part) => part.map((r) => pickDigits(r.count))),

  async render(index = 0) {
    const partIndex = Math.max(0, Math.min(PARTS.length - 1, index | 0));
    const ROWS = PARTS[partIndex];
    this._partRows[partIndex] = ROWS.map((r) => pickDigits(r.count));
    const rows = this._partRows[partIndex];

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

    // Tải path số từ drthe (async)
    const specs = [];
    rows.forEach((row) => row.forEach((d) => specs.push(['numbers', d])));
    const paths = {};
    await Promise.all(specs.map(async ([g, n]) => { paths[`${g}/${n}`] = await loadOptotype(g, n); }));

    const parts = [];
    parts.push(`<svg class="etdrs-chart number-chart" viewBox="0 0 ${VB_W} ${vbH}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">`);

    let yCursor = 0;
    for (let i = 0; i < rowSizes.length; i++) {
      const { px, snellen, decimal, count, marker } = rowSizes[i];
      const scale = px / 500; // drthe viewBox 500×500
      const gap = (i < rowSizes.length - 1) ? rowSizes[i + 1].px * 0.5 : px * 0.5;

      // Vạch đánh dấu (đỏ 20/40, xanh 20/20) — đoạn ngắn sát cạnh ngoài cộng
      // với một phần kéo dài vào phía trong để dễ nhìn, NHƯNG vẫn không cắt
      // ngang qua ký tự (chỉ nằm trong vùng nhãn/thông tin hai bên).
      if (marker) {
        const my = yCursor + px * 0.5;
        const color = marker === 'red' ? '#e53935' : '#1e88e5';
        // trái: từ ngoài nhãn (LABEL_X-MARKER_LEN) kéo dài vào trong (LABEL_X+MARKER_INNER)
        parts.push(`<line x1="${LABEL_X - MARKER_LEN}" y1="${my}" x2="${LABEL_X + MARKER_INNER}" y2="${my}" stroke="${color}" stroke-width="${MARKER_W}" />`);
        // phải: từ trong (DECIMAL_X-MARKER_INNER) kéo dài ra ngoài (DECIMAL_X+MARKER_LEN)
        parts.push(`<line x1="${DECIMAL_X - MARKER_INNER}" y1="${my}" x2="${DECIMAL_X + MARKER_LEN}" y2="${my}" stroke="${color}" stroke-width="${MARKER_W}" />`);
      }

      const labelSize = Math.max(px * 0.3, 12);
      parts.push(`<text x="${LABEL_X}" y="${yCursor + px * 0.5}" font-family="'Segoe UI',system-ui,sans-serif" font-size="${labelSize}" fill="#999" dominant-baseline="middle" style="white-space:nowrap;">${snellen}</text>`);
      parts.push(`<text x="${DECIMAL_X}" y="${yCursor + px * 0.5}" font-family="'Segoe UI',system-ui,sans-serif" font-size="${labelSize}" fill="#999" text-anchor="end" dominant-baseline="middle" style="white-space:nowrap;">${decimal}</text>`);

      // Yêu cầu 6: khoảng cách giữa 2 optotype = 1 chiều rộng optotype
      // => spacing = px (optotype) + px (gap) = 2·px
      const spacing = px * 2;
      const totalW = count * spacing - px; // chiều rộng thực của hàng (bỏ gap thừa cuối)
      const startX = (VB_W - totalW) / 2;
      const digits = rows[i];

      for (let j = 0; j < count; j++) {
        const lx = startX + j * spacing;
        const path = paths[`numbers/${digits[j]}`] || '';
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
    this._partRows = PARTS.map((part) => part.map((r) => pickDigits(r.count)));
    this.render(state_stepIndex());
  },
};

// Helper: lấy stepIndex hiện tại (dùng cho randomize)
function state_stepIndex() {
  // main.js dùng state.stepIndex; truy cập an toàn qua window nếu có
  try { return (window.__state && window.__state.stepIndex) || 0; } catch (e) { return 0; }
}

export default numberChart;
export { numberChart, ALL_ROWS, PARTS, DIGITS };
