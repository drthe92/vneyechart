/**
 * duochrome_test.js — Duochrome (Bichrome) Test
 * ===============================================
 *
 * Module id: 'neuro-duochrome'
 *
 * Màn hình chia đôi: Trái = Đỏ (#FF0000), Phải = Xanh (#00FF00).
 * Hiển thị bảng thị lực Snellen với 4 dòng từ 20/100 đến 20/40.
 * Mỗi nửa chỉ hiển thị 4 dòng, không có nút điều khiển — chỉ thuần bảng thị lực.
 *
 * Sử dụng các hàng Snellen: 20/100, 20/70, 20/50, 20/40
 */

import { SLOAN } from './optotype_paths.js';

// ================================================================
//  Constants
// ================================================================

const RED_BG   = '#FF0000';
const GREEN_BG = '#00FF00';

const SLOAN_LETTERS = Object.keys(SLOAN);

/** 4 hàng Snellen: [nhãn, logmar, số chữ] */
 const SNELLEN_LEVELS = [
   { label: '20/100', logmar: 0.70, count: 2 },
   { label: '20/70',  logmar: 0.54, count: 3 },
   { label: '20/50',  logmar: 0.40, count: 4 },
   { label: '20/40',  logmar: 0.30, count: 5 },
 ];

// ================================================================
//  Module
// ================================================================

const duochromeModule = {
  id: 'neuro-duochrome',
  label: 'Duochrome Test',
  steps: [0],

  _chartData: [],

  // ================================================================
  //  Render
  // ================================================================

  render() {
    const board = document.getElementById('display-board');
    if (!board) return;

    this._generateChartData();
    const rowsHtml = this._buildRowsHtml();

    board.innerHTML = `
      <style>
        .duo-container {
          display: flex;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        .duo-half {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          position: relative;
          overflow: hidden;
        }
        .duo-red { background: ${RED_BG}; }
        .duo-green { background: ${GREEN_BG}; }
        .duo-label {
          position: absolute;
          top: 12px;
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 2px;
          color: rgba(255,255,255,0.25);
          user-select: none;
          text-transform: uppercase;
        }
        .duo-chart {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .duo-row {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .duo-row svg {
          display: block;
        }
        .duo-chart {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }
        .duo-row {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
        }
      </style>
      <div class="duo-container">
        <div class="duo-half duo-red">
          <div class="duo-label">ĐỎ</div>
          <div class="duo-chart">${rowsHtml}</div>
        </div>
        <div class="duo-half duo-green">
          <div class="duo-label">XANH</div>
          <div class="duo-chart">${rowsHtml}</div>
        </div>
      </div>
    `;
  },

  // ================================================================
  //  Chart Data
  // ================================================================

  /**
   * Sinh dữ liệu Sloan ngẫu nhiên cho 4 hàng.
   * @private
   */
  _generateChartData() {
    this._chartData = SNELLEN_LEVELS.map((level) => {
      const shuffled = [...SLOAN_LETTERS].sort(() => Math.random() - 0.5);
      const letters = [];
      for (let i = 0; i < level.count; i++) {
        letters.push(shuffled[i % shuffled.length]);
      }
      return { ...level, letters };
    });
  },

  /**
   * Xây dựng HTML cho 4 hàng chữ.
   * @returns {string}
   * @private
   */
  _buildRowsHtml() {
    const cal = window.__calibrator;
    let html = '';

    for (let i = 0; i < this._chartData.length; i++) {
      const row = this._chartData[i];

      // Kích thước chữ (px) từ calibration
      let pxSize = 60;
      if (cal && typeof cal.getOptotypeSize === 'function' && cal.distanceM > 0) {
        pxSize = cal.getOptotypeSize(row.logmar);
      } else {
        pxSize = 90 - i * 18;
      }

      // Khoảng cách giữa các chữ = chiều rộng chữ
      const gap = pxSize;

      // Khoảng cách giữa các hàng = chiều cao hàng dưới (nhỏ hơn)
      let rowGap = pxSize * 0.8;
      if (i < this._chartData.length - 1) {
        const nextRow = this._chartData[i + 1];
        if (cal && typeof cal.getOptotypeSize === 'function' && cal.distanceM > 0) {
          rowGap = cal.getOptotypeSize(nextRow.logmar) * 0.9;
        }
      }

      // Tổng chiều rộng hàng
      const rowWidth = pxSize * row.letters.length + gap * (row.letters.length - 1);
      // Đảm bảo chiều rộng không quá lớn
      const maxWidth = 800;
      const finalWidth = Math.min(rowWidth, maxWidth);
      const finalGap = gap * (finalWidth / rowWidth);

      html += `<div class="duo-row" style="margin-bottom:${rowGap}px;">`;
      html += `<svg viewBox="0 0 ${finalWidth} ${pxSize}" width="${finalWidth}" height="${pxSize}" xmlns="http://www.w3.org/2000/svg">`;

      row.letters.forEach((letter, li) => {
        const path = SLOAN[letter];
        if (!path) return;
        const x = li * (pxSize + gap);
        const scale = pxSize / 5;
        html += `<g transform="translate(${x}, 0) scale(${scale})">${path}</g>`;
      });

      html += `</svg>`;
      html += `</div>`;
    }

    return html;
  },

  // ================================================================
  //  Cleanup & Randomize
  // ================================================================

  cleanup() {
    this._chartData = [];
  },

  randomize() {
    this.render();
  },
};

// ================================================================
//  Export
// ================================================================
export default duochromeModule;
export { duochromeModule };