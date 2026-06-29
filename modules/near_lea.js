/**
 * near_lea.js — Near Vision LEA Symbols Chart (40 cm)
 * ====================================================
 *
 * Module id: 'near-vision-lea'
 *
 * Dành cho trẻ em / bệnh nhân không biết chữ.
 * Sử dụng 4 hình vẽ LEA tiêu chuẩn: Quả táo (heart), Ngôi nhà (house),
 * Hình vuông (square), Vòng tròn (circle).
 *
 * Kích thước vật lý sử dụng chính xác bảng chiều cao của hệ LogMAR
 * (từ LogMAR 1.0 đến -0.2) ở khoảng cách 40 cm.
 *
 * Mỗi hàng 4 ký hiệu, gap giữa các ký hiệu = chiều rộng ký hiệu.
 * Hỗ trợ: cô lập hàng, cô lập 1 ký tự + Crowding bars.
 */

import { LEA } from './optotype_paths.js';

// ================================================================
//  Constants
// ================================================================

/** Khoảng cách khám (mét) */
const NEAR_DISTANCE_M = 0.4;

/** Giá trị LogMAR cho từng hàng (giống bảng LogMAR) */
const LOGMAR_LEVELS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2];

/** Chiều cao vật lý ký tự (mm) ở 40 cm — giống bảng LogMAR */
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

/** Số ký hiệu mỗi hàng (LEA tiêu chuẩn: 4) */
const SYMBOLS_PER_ROW = 4;

/** Tên các ký hiệu LEA (từ optotype_paths.js) */
const SYMBOL_KEYS = Object.keys(LEA);

/** Các chế độ hiển thị */
const DISPLAY_MODE = {
  FULL: 'full',
  ROW: 'row',
  SINGLE: 'single',
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

function pick4() {
  // Sử dụng cả 4 ký hiệu, đảo thứ tự
  return shuffle([...SYMBOL_KEYS]);
}

/**
 * Lấy PPI từ calibrator.
 */
function getCalibration() {
  const calibrator = window.__calibrator;
  if (calibrator && calibrator.ppi > 0) {
    return { ppi: calibrator.ppi, pxPerMm: calibrator.pxPerMm };
  }
  // Dùng CSS pixels — trình duyệt tự ánh xạ sang physical px
  const w = window.screen.width;
  const h = window.screen.height;
  const diagPx = Math.sqrt(w * w + h * h);
  const ppi = diagPx / 24; // giả định 24 inch, số thực
  return { ppi, pxPerMm: ppi / 25.4 };
}

/**
 * Chuyển chiều cao mm → pixels.
 */
function mmToPx(heightMm, pxPerMm) {
  return heightMm * pxPerMm;
}

// ================================================================
//  Full Chart Builder
// ================================================================

/**
 * Xây dựng toàn bộ bảng LEA (full chart) trong một SVG.
 * @param {number} highlightIndex - Hàng được highlight (-1 = none)
 * @param {Array[]} symbolsMatrix - Ma trận ký hiệu
 * @param {Object} calib
 * @returns {string} SVG
 */
function buildFullChart(highlightIndex, symbolsMatrix, calib) {
  const { pxPerMm } = calib;

  const rowPxSizes = LOGMAR_LEVELS.map((logmar) =>
    mmToPx(PHYSICAL_HEIGHT_MM[logmar], pxPerMm)
  );

  // Mỗi hàng: 4 ký hiệu, gap = chiều rộng ký hiệu (pxSize)
  const rowWidths = rowPxSizes.map((s) => s * SYMBOLS_PER_ROW + s * (SYMBOLS_PER_ROW - 1));

  // Tính toạ độ Y
  const rowY = [];
  let currentY = 0;
  for (let i = 0; i < LOGMAR_LEVELS.length; i++) {
    rowY.push(currentY);
    if (i < LOGMAR_LEVELS.length - 1) {
      currentY += rowPxSizes[i] + rowPxSizes[i + 1];
    } else {
      currentY += rowPxSizes[i];
    }
  }

  const svgWidth = Math.max(...rowWidths);
  const totalHeight = currentY + rowPxSizes[rowPxSizes.length - 1] * 0.5;

  const parts = [];
  parts.push(
    `<svg class="near-lea-chart" viewBox="0 0 ${svgWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">`
  );

  for (let i = 0; i < LOGMAR_LEVELS.length; i++) {
    const pxSize = rowPxSizes[i];
    const y = rowY[i];
    const isHighlighted = i === highlightIndex;
    const isDimmed = highlightIndex >= 0 && !isHighlighted;
    const symbols = symbolsMatrix[i] || pick4();

    const rowWidth = pxSize * SYMBOLS_PER_ROW + pxSize * (SYMBOLS_PER_ROW - 1);
    const xOffset = (svgWidth - rowWidth) / 2;
    const scale = pxSize / 5;

    const opacity = isDimmed ? 0.2 : 1.0;
    parts.push(`<g opacity="${opacity}">`);

    symbols.forEach((key, li) => {
      const x = xOffset + li * (pxSize + pxSize);
      parts.push(
        `<g transform="translate(${x}, ${y}) scale(${scale})">${LEA[key]}</g>`
      );
    });

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

    if (i < LOGMAR_LEVELS.length - 1) {
      const sepY = y + pxSize + rowPxSizes[i + 1] / 2;
      parts.push(
        `<line x1="${svgWidth * 0.05}" y1="${sepY}" x2="${svgWidth * 0.95}" y2="${sepY}" stroke="#eee" stroke-width="0.5" stroke-dasharray="4,4"/>`
      );
    }
  }

  parts.push('</svg>');
  return parts.join('');
}

// ================================================================
//  Single Row Builder
// ================================================================

function buildSingleRow(rowIndex, symbols, calib) {
  const { pxPerMm } = calib;
  const logmar = LOGMAR_LEVELS[rowIndex];
  const pxSize = mmToPx(PHYSICAL_HEIGHT_MM[logmar], pxPerMm);
  const rowWidth = pxSize * SYMBOLS_PER_ROW + pxSize * (SYMBOLS_PER_ROW - 1);
  const scale = pxSize / 5;

  const parts = [];
  parts.push(
    `<svg class="near-lea-isolated" viewBox="0 0 ${rowWidth} ${pxSize * 2}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">`
  );

  symbols.forEach((key, li) => {
    const x = li * (pxSize + pxSize);
    parts.push(
      `<g transform="translate(${x}, ${pxSize * 0.5}) scale(${scale})">${LEA[key]}</g>`
    );
  });

  parts.push('</svg>');
  return parts.join('');
}

// ================================================================
//  Single Optotype Builder
// ================================================================

function buildSingleOptotype(rowIndex, symbolKey, showBars, calib) {
  const { pxPerMm } = calib;
  const logmar = LOGMAR_LEVELS[rowIndex];
  const pxSize = mmToPx(PHYSICAL_HEIGHT_MM[logmar], pxPerMm);
  const scale = pxSize / 5;

  const margin = showBars ? pxSize * 2.5 : pxSize * 0.3;
  const viewSize = pxSize + margin * 2;
  const center = viewSize / 2;

  const parts = [];
  parts.push(
    `<svg class="near-lea-single" viewBox="0 0 ${viewSize} ${viewSize}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">`
  );

  if (showBars) {
    const barThickness = pxSize / 12;
    const gap = pxSize;
    const barLength = pxSize * 1.2;
    const cx = center;
    const cy = center;

    parts.push(`<rect x="${cx - barLength / 2}" y="${cy - gap - barThickness}" width="${barLength}" height="${barThickness}" fill="#000"/>`);
    parts.push(`<rect x="${cx - barLength / 2}" y="${cy + pxSize + gap}" width="${barLength}" height="${barThickness}" fill="#000"/>`);
    parts.push(`<rect x="${cx - gap - barLength}" y="${cy + (pxSize - barThickness) / 2}" width="${barLength}" height="${barThickness}" fill="#000"/>`);
    parts.push(`<rect x="${cx + pxSize + gap}" y="${cy + (pxSize - barThickness) / 2}" width="${barLength}" height="${barThickness}" fill="#000"/>`);
  }

  parts.push(
    `<g transform="translate(${center}, ${center}) scale(${scale})">${LEA[symbolKey]}</g>`
  );

  parts.push('</svg>');
  return parts.join('');
}

// ================================================================
//  Info Panel & Toolbar
// ================================================================

function buildInfoPanel(logmar, rowIndex, totalRows, mode) {
  const decimalAcuity = Math.pow(10, -logmar);
  let modeLabel = '';
  switch (mode) {
    case DISPLAY_MODE.FULL: modeLabel = 'Toàn bảng'; break;
    case DISPLAY_MODE.ROW: modeLabel = 'Cô lập hàng'; break;
    case DISPLAY_MODE.SINGLE: modeLabel = 'Cô lập hình'; break;
  }

  return `
    <div class="near-vision-info">
      <div class="near-vision-info-row">
        <span class="near-vision-info-label">LogMAR</span>
        <strong class="near-vision-info-value">${logmar.toFixed(1)}</strong>
      </div>
      <div class="near-vision-info-row">
        <span class="near-vision-info-label">Thập phân</span>
        <strong class="near-vision-info-value">${decimalAcuity.toFixed(2)}</strong>
      </div>
      <div class="near-vision-info-row">
        <span class="near-vision-info-label">Khoảng cách</span>
        <strong class="near-vision-info-value">40 cm</strong>
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
        ${mode === DISPLAY_MODE.SINGLE ? '●' : '○'} 1 hình
      </button>
      ${mode === DISPLAY_MODE.SINGLE ? `
        <button class="near-vision-toolbar-btn" data-action="toggle-bars" title="Bật/tắt Crowding bars">
          ${showCrowdingBars ? '■' : '□'} Crowding bars
        </button>
      ` : ''}
      <button class="near-vision-toolbar-btn" data-action="shuffle" title="Đảo hình (Phím cách)">
        🔀 Đảo
      </button>
    </div>
  `;
}

// ================================================================
//  Module Definition
// ================================================================

const nearLeaModule = {
  id: 'near-vision-lea',
  label: 'LEA Symbols 40 cm',
  steps: LOGMAR_LEVELS,

  _symbolsMatrix: LOGMAR_LEVELS.map(() => pick4()),
  _displayMode: DISPLAY_MODE.FULL,
  _crowdingBars: true,

  /**
   * Render hàng hiện tại.
   * @param {number} index
   */
  render(index) {
    const board = document.getElementById('display-board');
    if (!board) return;

    const calib = getCalibration();
    const logmar = LOGMAR_LEVELS[index];
    const totalRows = LOGMAR_LEVELS.length;

    while (this._symbolsMatrix.length < totalRows) {
      this._symbolsMatrix.push(pick4());
    }

    let chartHtml = '';
    const mode = this._displayMode;

    switch (mode) {
      case DISPLAY_MODE.FULL:
        chartHtml = buildFullChart(index, this._symbolsMatrix, calib);
        break;

      case DISPLAY_MODE.ROW:
        chartHtml = buildSingleRow(
          index,
          this._symbolsMatrix[index] || pick4(),
          calib
        );
        break;

      case DISPLAY_MODE.SINGLE: {
        const symbol = (this._symbolsMatrix[index] || pick4())[0];
        chartHtml = buildSingleOptotype(
          index,
          symbol,
          this._crowdingBars,
          calib
        );
        break;
      }
    }

    board.innerHTML = [
      chartHtml,
      buildInfoPanel(logmar, index, totalRows, mode),
      buildToolbar(mode, this._crowdingBars),
    ].join('\n');

    this._wireToolbar();
  },

  /**
   * Gắn sự kiện toolbar.
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
            return;
        }

        const idx = window.__state ? window.__state.stepIndex : 0;
        this.render(idx);
      });
    });
  },

  /**
   * Đảo ký hiệu ngẫu nhiên.
   */
  randomize() {
    const idx = window.__state ? window.__state.stepIndex : 0;
    if (this._symbolsMatrix[idx]) {
      this._symbolsMatrix[idx] = pick4();
    }
    if (this._displayMode === DISPLAY_MODE.FULL) {
      this._symbolsMatrix = LOGMAR_LEVELS.map(() => pick4());
    }
    this.render(idx);
  },

  /**
   * Reset trạng thái.
   */
  reset() {
    this._symbolsMatrix = LOGMAR_LEVELS.map(() => pick4());
    this._displayMode = DISPLAY_MODE.FULL;
    this._crowdingBars = true;
  },
};

// ================================================================
//  Export
// ================================================================
export default nearLeaModule;
export { nearLeaModule, LOGMAR_LEVELS, PHYSICAL_HEIGHT_MM, DISPLAY_MODE };