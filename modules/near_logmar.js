/**
 * near_logmar.js — Near Vision LogMAR Chart (40 cm)
 * ===================================================
 *
 * Module id: 'near-vision-logmar'
 *
 * Hiển thị bảng LogMAR cho thị lực nhìn gần ở khoảng cách 40 cm.
 * - Toàn bộ các hàng được hiển thị đồng thời (giống thẻ thị lực gần thật).
 * - Mỗi hàng 5 ký tự Sloan, gap giữa các chữ = chiều rộng chữ.
 * - Gap giữa các hàng = chiều cao hàng nhỏ hơn liền kề (triệt tiêu crowding effect).
 * - Điều hướng bước nhảy 0.1 log unit.
 * - Hỗ trợ: cô lập hàng, cô lập 1 ký tự + Crowding bars.
 *
 * Khoảng cách cố định: 40 cm (0.4 m).
 * Chiều cao vật lý ký tự được tính từ bảng thông số chuẩn ở 40 cm.
 */

import { getActiveNearDistanceM } from '../js/calibration.js';
import { SLOAN } from './optotype_paths.js';

// ================================================================
//  Constants
// ================================================================

/** Khoảng cách tham chiếu của bảng chuẩn (mét) — dùng khi chưa có calibrator */
const REFERENCE_DISTANCE_M = 0.4;

/** Giá trị LogMAR cho từng hàng (từ to → nhỏ) */
const LOGMAR_LEVELS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2];

/** Chiều cao vật lý ký tự (mm) ở 40 cm, tương ứng với từng mức LogMAR */
const PHYSICAL_HEIGHT_MM = {
  1.0: 5.818,
  0.9: 4.621,
  0.8: 3.671,
  0.7: 2.916,
  0.6: 2.316,
  0.5: 1.840,
  0.4: 1.461,
  0.3: 1.161,
  0.2: 0.922,
  0.1: 0.733,
  0.0: 0.582,
  [-0.1]: 0.462,
  [-0.2]: 0.367,
};

const LETTERS_PER_ROW = 5;
const LETTER_KEYS = Object.keys(SLOAN);

/** Các chế độ hiển thị */
const DISPLAY_MODE = {
  FULL: 'full',           // Toàn bộ bảng
  ROW: 'row',             // Chỉ 1 hàng
  SINGLE: 'single',       // Chỉ 1 ký tự + crowding bars
};

// ================================================================
//  Helpers
// ================================================================

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pick5() {
  return shuffle([...LETTER_KEYS]).slice(0, LETTERS_PER_ROW);
}

/**
 * Lấy PPI từ calibrator (hoặc ước lượng).
 * Khoảng cách Nhìn Gần lấy từ helper chung getActiveNearDistanceM()
 * (js/calibration.js) — main.js đã chuyển distanceM theo nhóm test.
 * @returns {{ ppi: number, pxPerMm: number, distanceM: number }}
 */
function getCalibration() {
  const distanceM = getActiveNearDistanceM();
  const calibrator = window.__calibrator;
  if (calibrator && calibrator.ppi > 0) {
    return { ppi: calibrator.ppi, pxPerMm: calibrator.pxPerMm, distanceM };
  }
  // Fallback: ước lượng PPI
  // Dùng CSS pixels — trình duyệt tự ánh xạ sang physical px
  const w = window.screen.width;
  const h = window.screen.height;
  const diagPx = Math.sqrt(w * w + h * h);
  const ppi = diagPx / 24; // giả định 24 inch, số thực
  return { ppi, pxPerMm: ppi / 25.4, distanceM };
}

/**
 * Chiều cao vật lý (mm) của ký tự tại khoảng cách khám đang active.
 * Bảng chuẩn PHYSICAL_HEIGHT_MM được đo ở 40 cm nên scale tuyến tính theo
 * tỷ lệ khoảng cách: height(D) = height(40cm) × D / 0.4.
 * @param {number} logmar
 * @param {number} distanceM
 * @returns {number}
 */
function physicalHeightMm(logmar, distanceM) {
  return PHYSICAL_HEIGHT_MM[logmar] * (distanceM / REFERENCE_DISTANCE_M);
}

/**
 * Chuyển chiều cao vật lý (mm) → pixel dựa trên PPI hiện tại.
 * @param {number} heightMm
 * @param {number} pxPerMm
 * @returns {number}
 */
function mmToPx(heightMm, pxPerMm) {
  return heightMm * pxPerMm;
}

// ================================================================
//  Crowding bars SVG
// ================================================================

/**
 * Tạo crowding bars xung quanh 1 ký tự đơn lẻ.
 * Bốn thanh: trên, dưới, trái, phải — cách ký tự đúng bằng stroke width.
 * @param {number} pxSize Kích thước ký tự (pixel)
 * @returns {string} SVG fragment
 */
function renderCrowdingBars(pxSize) {
  const barThickness = pxSize / 10;
  const gap = pxSize; // khoảng cách từ ký tự đến bar = chiều rộng ký tự
  const barLength = pxSize * 1.5;

  return `
    <rect x="${-gap - barLength}" y="${(pxSize - barThickness) / 2}" width="${barLength}" height="${barThickness}" fill="#000"/>
    <rect x="${pxSize + gap}" y="${(pxSize - barThickness) / 2}" width="${barLength}" height="${barThickness}" fill="#000"/>
    <rect x="${(pxSize - barLength) / 2}" y="${-gap - barThickness}" width="${barLength}" height="${barThickness}" fill="#000"/>
    <rect x="${(pxSize - barLength) / 2}" y="${pxSize + gap}" width="${barLength}" height="${barThickness}" fill="#000"/>
  `;
}

// ================================================================
//  Main SVG Chart Builder
// ================================================================

/**
 * Xây dựng toàn bộ bảng LogMAR (full chart) trong một SVG duy nhất.
 * @param {number} highlightIndex Index của hàng được highlight (-1 = không)
 * @param {Array[]} lettersMatrix Ma trận chữ [rowIdx][letterIdx]
 * @param {Object} calib { ppi, pxPerMm }
 * @returns {string} SVG hoàn chỉnh
 */
function buildFullChart(highlightIndex, lettersMatrix, calib) {
  const { pxPerMm, distanceM } = calib;

  // Tính kích thước pixel cho từng hàng (scale theo khoảng cách đang active)
  const rowPxSizes = LOGMAR_LEVELS.map((logmar) =>
    mmToPx(physicalHeightMm(logmar, distanceM), pxPerMm)
  );

  // Tính chiều rộng mỗi hàng
  // Mỗi chữ: pxSize × pxSize, gap giữa chữ = pxSize
  // Tổng: 5*pxSize + 4*pxSize = 9*pxSize
  const rowWidths = rowPxSizes.map((s) => s * LETTERS_PER_ROW + (s * (LETTERS_PER_ROW - 1)));

  // Tính chiều cao tổng + toạ độ Y cho từng hàng
  // Gap giữa các hàng = chiều cao của hàng nhỏ hơn (hàng dưới)
  const rowY = [];
  let currentY = 0;
  for (let i = 0; i < LOGMAR_LEVELS.length; i++) {
    rowY.push(currentY);
    if (i < LOGMAR_LEVELS.length - 1) {
      // Gap = height của hàng dưới (nhỏ hơn)
      currentY += rowPxSizes[i] + rowPxSizes[i + 1];
    } else {
      currentY += rowPxSizes[i];
    }
  }

  const svgHeight = currentY;
  const svgWidth = Math.max(...rowWidths);

  // Tính toán margin-bottom bổ sung cho alignment
  const totalHeight = svgHeight + rowPxSizes[rowPxSizes.length - 1] * 0.5;

  const parts = [];
  parts.push(
    `<svg class="near-logmar-chart" viewBox="0 0 ${svgWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">`
  );

  for (let i = 0; i < LOGMAR_LEVELS.length; i++) {
    const pxSize = rowPxSizes[i];
    const y = rowY[i];
    const isHighlighted = i === highlightIndex;
    const isDimmed = highlightIndex >= 0 && !isHighlighted;
    const letters = lettersMatrix[i] || pick5();

    // Tính tổng chiều rộng hàng để căn giữa
    const rowWidth = pxSize * LETTERS_PER_ROW + pxSize * (LETTERS_PER_ROW - 1);
    const xOffset = (svgWidth - rowWidth) / 2;
    const scale = pxSize / 5;

    // Group cho hàng
    const opacity = isDimmed ? 0.2 : 1.0;
    parts.push(`<g opacity="${opacity}">`);

    letters.forEach((letter, li) => {
      const x = xOffset + li * (pxSize + pxSize); // gap = pxSize (bằng chiều rộng chữ)
      parts.push(
        `<g transform="translate(${x}, ${y}) scale(${scale})">${SLOAN[letter]}</g>`
      );
    });

    // Highlight border nếu đang active
    if (isHighlighted && highlightIndex >= 0) {
      parts.push(
        `<rect x="${xOffset - pxSize * 0.2}" y="${y - pxSize * 0.2}" width="${rowWidth + pxSize * 0.4}" height="${pxSize + pxSize * 0.4}" fill="none" stroke="#4a90d9" stroke-width="${pxSize / 20}" rx="${pxSize / 10}" stroke-dasharray="${pxSize / 5},${pxSize / 5}"/>`
      );
    }

    // LogMAR label bên phải
    const fontSize = rowPxSizes[0] * 0.35;
    parts.push(
      `<text x="${svgWidth - 4}" y="${y + pxSize * 0.7}" text-anchor="end" font-family="monospace" font-size="${fontSize}" fill="${isDimmed ? '#ccc' : '#aaa'}">${LOGMAR_LEVELS[i].toFixed(1)}</text>`
    );

    parts.push('</g>');

    // Vạch phân cách nhẹ giữa các hàng
    if (i < LOGMAR_LEVELS.length - 1) {
      const nextY = y + pxSize + rowPxSizes[i + 1];
      const sepY = y + pxSize + rowPxSizes[i + 1] / 2;
      parts.push(
        `<line x1="${svgWidth * 0.05}" y1="${sepY}" x2="${svgWidth * 0.95}" y2="${sepY}" stroke="#eee" stroke-width="0.5" stroke-dasharray="4,4"/>`
      );
    }
  }

  parts.push('</svg>');
  return parts.join('');
}

/**
 * Xây dựng chế độ hiển thị 1 hàng đơn lẻ.
 * @param {number} rowIndex
 * @param {string[]} letters 5 chữ cái
 * @param {Object} calib
 * @returns {string} SVG
 */
function buildSingleRow(rowIndex, letters, calib) {
  const { pxPerMm, distanceM } = calib;
  const logmar = LOGMAR_LEVELS[rowIndex];
  const pxSize = mmToPx(physicalHeightMm(logmar, distanceM), pxPerMm);
  const rowWidth = pxSize * LETTERS_PER_ROW + pxSize * (LETTERS_PER_ROW - 1);
  const scale = pxSize / 5;

  const parts = [];
  parts.push(
    `<svg class="near-logmar-isolated" viewBox="0 0 ${rowWidth} ${pxSize * 2}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">`
  );

  letters.forEach((letter, li) => {
    const x = li * (pxSize + pxSize);
    parts.push(
      `<g transform="translate(${x}, ${pxSize * 0.5}) scale(${scale})">${SLOAN[letter]}</g>`
    );
  });

  parts.push('</svg>');
  return parts.join('');
}

/**
 * Xây dựng chế độ hiển thị 1 ký tự đơn + crowding bars.
 * @param {number} rowIndex
 * @param {string} letter 1 chữ cái
 * @param {boolean} showBars Có hiển thị crowding bars không
 * @param {Object} calib
 * @returns {string} SVG
 */
function buildSingleOptotype(rowIndex, letter, showBars, calib) {
  const { pxPerMm, distanceM } = calib;
  const logmar = LOGMAR_LEVELS[rowIndex];
  const pxSize = mmToPx(physicalHeightMm(logmar, distanceM), pxPerMm);
  const scale = pxSize / 5;

  // Vùng mở rộng để chứa crowding bars
  const margin = showBars ? pxSize * 2.5 : pxSize * 0.3;
  const viewSize = pxSize + margin * 2;
  const center = viewSize / 2;

  const parts = [];
  parts.push(
    `<svg class="near-logmar-single" viewBox="0 0 ${viewSize} ${viewSize}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">`
  );

  if (showBars) {
    const barThickness = pxSize / 12;
    const gap = pxSize;
    const barLength = pxSize * 1.2;
    const cx = center;
    const cy = center;

    // Trên
    parts.push(`<rect x="${cx - barLength / 2}" y="${cy - gap - barThickness}" width="${barLength}" height="${barThickness}" fill="#000"/>`);
    // Dưới
    parts.push(`<rect x="${cx - barLength / 2}" y="${cy + pxSize + gap}" width="${barLength}" height="${barThickness}" fill="#000"/>`);
    // Trái
    parts.push(`<rect x="${cx - gap - barLength}" y="${cy + (pxSize - barThickness) / 2}" width="${barLength}" height="${barThickness}" fill="#000"/>`);
    // Phải
    parts.push(`<rect x="${cx + pxSize + gap}" y="${cy + (pxSize - barThickness) / 2}" width="${barLength}" height="${barThickness}" fill="#000"/>`);
  }

  parts.push(
    `<g transform="translate(${center}, ${center}) scale(${scale})">${SLOAN[letter]}</g>`
  );

  parts.push('</svg>');
  return parts.join('');
}

// ================================================================
//  Info Panel
// ================================================================

function buildInfoPanel(logmar, rowIndex, totalRows, mode, distanceM) {
  const snellenDenom = Math.round(20 * Math.pow(10, logmar));
  const decimalAcuity = Math.pow(10, -logmar);
  const distanceCm = (distanceM * 100).toFixed(0);

  let modeLabel = '';
  switch (mode) {
    case DISPLAY_MODE.FULL: modeLabel = 'Toàn bảng'; break;
    case DISPLAY_MODE.ROW: modeLabel = 'Cô lập hàng'; break;
    case DISPLAY_MODE.SINGLE: modeLabel = 'Cô lập ký tự'; break;
  }

  return `
    <div class="near-vision-info">
      <div class="near-vision-info-row">
        <span class="near-vision-info-label">LogMAR</span>
        <strong class="near-vision-info-value">${logmar.toFixed(1)}</strong>
      </div>
      <div class="near-vision-info-row">
        <span class="near-vision-info-label">Snellen</span>
        <strong class="near-vision-info-value">20/${snellenDenom}</strong>
      </div>
      <div class="near-vision-info-row">
        <span class="near-vision-info-label">Thập phân</span>
        <strong class="near-vision-info-value">${decimalAcuity.toFixed(2)}</strong>
      </div>
      <div class="near-vision-info-row">
        <span class="near-vision-info-label">Khoảng cách</span>
        <strong class="near-vision-info-value">${distanceCm} cm</strong>
      </div>
      <div class="near-vision-info-divider"></div>
      <div class="near-vision-info-row">
        <span class="near-vision-info-label">Chế độ</span>
        <strong class="near-vision-info-value" style="font-size:0.7rem;">${modeLabel}</strong>
      </div>
      <div class="near-vision-info-row">
        <span class="near-vision-info-label">Hàng</span>
        <span class="near-vision-info-value">${rowIndex + 1}/${totalRows}</span>
      </div>
    </div>
  `;
}

// ================================================================
//  Toolbar
// ================================================================

function buildToolbar(mode, showCrowdingBars) {
  return `
    <div class="near-vision-toolbar">
      <button class="near-vision-toolbar-btn" data-action="mode-full" title="Toàn bảng">
        ${mode === DISPLAY_MODE.FULL ? '●' : '○'} Toàn bảng
      </button>
      <button class="near-vision-toolbar-btn" data-action="mode-row" title="Cô lập hàng">
        ${mode === DISPLAY_MODE.ROW ? '●' : '○'} 1 hàng
      </button>
      <button class="near-vision-toolbar-btn" data-action="mode-single" title="Cô lập ký tự">
        ${mode === DISPLAY_MODE.SINGLE ? '●' : '○'} 1 ký tự
      </button>
      ${mode === DISPLAY_MODE.SINGLE ? `
        <button class="near-vision-toolbar-btn" data-action="toggle-bars" title="Bật/tắt Crowding bars">
          ${showCrowdingBars ? '■' : '□'} Crowding bars
        </button>
      ` : ''}
      <button class="near-vision-toolbar-btn" data-action="shuffle" title="Đảo chữ (Phím cách)">
        🔀 Đảo
      </button>
    </div>
  `;
}

// ================================================================
//  Module Definition
// ================================================================

const nearLogmarModule = {
  id: 'near-vision-logmar',
  label: 'LogMAR 40 cm',
  steps: LOGMAR_LEVELS,

  // Trạng thái nội bộ
  _lettersMatrix: LOGMAR_LEVELS.map(() => pick5()),
  _displayMode: DISPLAY_MODE.FULL,
  _crowdingBars: true,

  /**
   * Render hàng hiện tại.
   * @param {number} index — Index trong steps (tương ứng LogMAR level)
   */
  render(index) {
    const board = document.getElementById('display-board');
    if (!board) return;

    const calib = getCalibration();
    const logmar = LOGMAR_LEVELS[index];
    const totalRows = LOGMAR_LEVELS.length;

    // Đảm bảo có chữ cho mỗi hàng
    while (this._lettersMatrix.length < totalRows) {
      this._lettersMatrix.push(pick5());
    }

    let chartHtml = '';
    const mode = this._displayMode;

    switch (mode) {
      case DISPLAY_MODE.FULL:
        chartHtml = buildFullChart(index, this._lettersMatrix, calib);
        break;

      case DISPLAY_MODE.ROW:
        chartHtml = buildSingleRow(
          index,
          this._lettersMatrix[index] || pick5(),
          calib
        );
        break;

      case DISPLAY_MODE.SINGLE: {
        const letter = (this._lettersMatrix[index] || pick5())[0];
        chartHtml = buildSingleOptotype(
          index,
          letter,
          this._crowdingBars,
          calib
        );
        break;
      }
    }

    const html = [
      chartHtml,
      buildInfoPanel(logmar, index, totalRows, mode, calib.distanceM),
      buildToolbar(mode, this._crowdingBars),
    ].join('\n');

    board.innerHTML = html;

    // Gắn sự kiện cho toolbar
    this._wireToolbar();
  },

  /**
   * Gắn sự kiện cho các nút toolbar.
   * @private
   */
  _wireToolbar() {
    const board = document.getElementById('display-board');
    if (!board) return;

    board.querySelectorAll('.near-vision-toolbar-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;

        switch (action) {
          case 'mode-full':
            this._displayMode = DISPLAY_MODE.FULL;
            break;
          case 'mode-row':
            this._displayMode = DISPLAY_MODE.ROW;
            break;
          case 'mode-single':
            this._displayMode = DISPLAY_MODE.SINGLE;
            break;
          case 'toggle-bars':
            this._crowdingBars = !this._crowdingBars;
            break;
          case 'shuffle':
            this.randomize();
            return; // randomize() tự gọi render
        }

        const idx = window.__state ? window.__state.stepIndex : 0;
        this.render(idx);
      });
    });
  },

  /**
   * Đảo chữ ngẫu nhiên (giữ nguyên cấp độ LogMAR).
   */
  randomize() {
    const idx = window.__state ? window.__state.stepIndex : 0;
    // Đảo chữ ở hàng hiện tại
    if (this._lettersMatrix[idx]) {
      this._lettersMatrix[idx] = pick5();
    }
    // Nếu ở chế độ full, đảo toàn bộ bảng
    if (this._displayMode === DISPLAY_MODE.FULL) {
      this._lettersMatrix = LOGMAR_LEVELS.map(() => pick5());
    }
    this.render(idx);
  },

  /**
   * Reset trạng thái.
   */
  reset() {
    this._lettersMatrix = LOGMAR_LEVELS.map(() => pick5());
    this._displayMode = DISPLAY_MODE.FULL;
    this._crowdingBars = true;
  },
};

// ================================================================
//  Export
// ================================================================
export default nearLogmarModule;
export {
  nearLogmarModule,
  LOGMAR_LEVELS,
  PHYSICAL_HEIGHT_MM,
  DISPLAY_MODE,
  mmToPx,
  getCalibration,
};