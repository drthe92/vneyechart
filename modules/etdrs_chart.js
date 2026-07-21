/**
 * etdrs_chart.js — ETDRS Chart (LogMAR) with Real Sloan Optotype Paths
 * ================================================================
 *
 * Sử dụng các ký tự Sloan thực tế từ đường dẫn
 *   generated/drthe_optotype/sloan/{A,C,D,H,K,N,O,R,S,T,V,Z}.svg
 * (viewBox 0 0 500 500, fill="#000000") thông qua drthe_optotype_loader.
 *
 * Module id: 'far-vision-etdrs'
 */

import { getOptotypeSize } from '../js/calibration.js';
import { loadOptotype, DR_THE_VIEWBOX } from './drthe_optotype_loader.js';

const LOGMAR_LEVELS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2, -0.3];
const LETTERS_PER_ROW = 5;
// 10 ký tự Sloan chuẩn (A có sẵn trong thư mục nhưng không dùng trong bài chuẩn)
const SLOAN_KEYS = ['C', 'D', 'H', 'K', 'N', 'O', 'R', 'S', 'T', 'V', 'Z'];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pick5() { return shuffle([...SLOAN_KEYS]).slice(0, LETTERS_PER_ROW); }

const etdrsChart = {
  id: 'far-vision-etdrs',
  label: 'ETDRS',
  steps: LOGMAR_LEVELS,
  _letters: pick5(),
  _paths: {}, // cache path theo ký tự

  async _ensurePaths(letters) {
    const missing = letters.filter((l) => !this._paths[l]);
    if (missing.length === 0) return;
    await Promise.all(missing.map(async (l) => {
      this._paths[l] = await loadOptotype('sloan', l);
    }));
  },

  async render(index) {
    this._letters = pick5();
    const logmar = LOGMAR_LEVELS[index];
    let calib;
    const calibrator = window.__calibrator;
    if (calibrator && calibrator.ppi > 0) calib = { distanceM: calibrator.distanceM, ppi: calibrator.ppi };
    const pxSize = getOptotypeSize(logmar, calib);

    await this._ensurePaths(this._letters);

    // Khoảng cách giữa các ký tự = đúng chiều rộng mỗi ký tự (pxSize)
    const gap = pxSize;

    const snellenDenom = Math.round(20 * Math.pow(10, logmar));
    const decimalAcuity = Math.pow(10, -logmar);

    const board = document.getElementById('display-board');

    // Hàm build hàng với n ký tự đầu tiên
    const buildRow = (n) => {
      const row = [];
      row.push(`<div style="display:flex;flex-direction:row;flex-wrap:nowrap;justify-content:center;align-items:center;gap:${gap}px;width:100%;max-width:100%;overflow:hidden;box-sizing:border-box;">`);
      this._letters.slice(0, n).forEach((letter) => {
        const path = this._paths[letter] || '';
        row.push(`<svg viewBox="${DR_THE_VIEWBOX}" width="${pxSize}" height="${pxSize}" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">${path}</svg>`);
      });
      row.push('</div>');
      return row.join('');
    };

    // Chèn tạm hàng đủ 5 chữ để đo chiều rộng thực tế
    if (board) {
      board.innerHTML = buildRow(this._letters.length) + `
        <div style="position:absolute;bottom:30px;right:30px;font-family:'Segoe UI',system-ui,sans-serif;color:#333;font-size:1.2rem;background:rgba(255,255,255,0.95);padding:20px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);border:1px solid #e0e0e0;backdrop-filter:blur(4px);">
          <div style="font-weight:700;margin-bottom:12px;font-size:1rem;color:#666;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #eee;padding-bottom:8px;">Kết quả thị lực</div>
          <div style="display:grid;grid-template-columns:120px auto;gap:10px 16px;align-items:center;">
            <span style="color:#666;">LogMAR:</span> <strong style="font-size:1.4rem;color:#000;">${logmar.toFixed(1)}</strong>
            <span style="color:#666;">Snellen (ft):</span> <strong style="font-size:1.4rem;color:#0056b3;">20/${snellenDenom}</strong>
            <span style="color:#666;">Hệ thập phân:</span> <strong style="font-size:1.4rem;color:#28a745;">${decimalAcuity.toFixed(2)}</strong>
          </div>
        </div>`;

      // Đo: nếu hàng nhảy sang dòng 2 (scrollWidth > clientWidth) thì cắt bớt chữ
      const rowEl = board.querySelector('div');
      const avail = board.clientWidth;
      let n = this._letters.length;
      // chiều rộng 1 chữ = pxSize, khoảng cách giữa = gap; tổng = n*pxSize + (n-1)*gap
      while (n > 1 && (n * pxSize + (n - 1) * gap) > avail) {
        n--;
      }
      // Nếu cần ít hơn số chữ hiện tại, build lại hàng
      if (n < this._letters.length) {
        board.innerHTML = buildRow(n) + `
          <div style="position:absolute;bottom:30px;right:30px;font-family:'Segoe UI',system-ui,sans-serif;color:#333;font-size:1.2rem;background:rgba(255,255,255,0.95);padding:20px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);border:1px solid #e0e0e0;backdrop-filter:blur(4px);">
            <div style="font-weight:700;margin-bottom:12px;font-size:1rem;color:#666;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #eee;padding-bottom:8px;">Kết quả thị lực</div>
            <div style="display:grid;grid-template-columns:120px auto;gap:10px 16px;align-items:center;">
              <span style="color:#666;">LogMAR:</span> <strong style="font-size:1.4rem;color:#000;">${logmar.toFixed(1)}</strong>
              <span style="color:#666;">Snellen (ft):</span> <strong style="font-size:1.4rem;color:#0056b3;">20/${snellenDenom}</strong>
              <span style="color:#666;">Hệ thập phân:</span> <strong style="font-size:1.4rem;color:#28a745;">${decimalAcuity.toFixed(2)}</strong>
            </div>
          </div>`;
      }
    }
  },

  async randomize() {
    this._letters = pick5();
    const idx = window.__state ? window.__state.stepIndex : 0;
    await this.render(idx);
  },
};

const etdrsChartFarVision = { ...etdrsChart, id: 'far-vision', label: 'Thị lực nhìn xa' };

export default etdrsChart;
export { etdrsChart, etdrsChartFarVision, LOGMAR_LEVELS };
