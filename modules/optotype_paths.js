/**
 * optotype_paths.js — Standardised Optotype Paths (5×5 MAR Grid)
 * =============================================================
 *
 * Mỗi optotype nằm trong viewBox "0 0 5 5", stroke‑width = 1.
 * Quy ước lâm sàng:
 *   - LEA, Landolt, Tumbling: fill="#000000" stroke="none" (nét đặc)
 *   - Sloan, HOTV: fill="none" stroke="#000000" stroke-width="1"
 *     stroke-linecap="square" stroke-linejoin="miter"
 *
 * Dùng trong chart modules: scale = pxSize / 5.
 */

// ================================================================
//  Barrier 3 — Sub‑pixel SVG rendering hints
// ----------------------------------------------------------------
//  Straight‑stroke letters (H, N, Z, K, V, T) should snap to the
//  pixel grid → use crispEdges. Curved letters (C, O, S, D, R)
//  need antialiasing → use geometricPrecision. Without an explicit
//  shape‑rendering the browser defaults to "auto" which blurs
//  straight strokes on scaled‑up optotypes.
// ================================================================

export const SR_STRAIGHT = 'shape-rendering="crispEdges"';
export const SR_CURVE    = 'shape-rendering="geometricPrecision"';

// ================================================================
//  SLOAN LETTERS (10 ký tự, stroke‑based)
// ================================================================

export const SLOAN = {
  C: `<path d="M 4.5,1.5 A 2,2 0 0 0 2.5,0.5 A 2,2 0 0 0 0.5,2.5 A 2,2 0 0 0 2.5,4.5 A 2,2 0 0 0 4.5,3.5" fill="none" stroke="#000000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" ${SR_CURVE}/>`,

  D: `<path d="M 0.5,0.5 L 2.5,0.5 A 2,2 0 0 1 4.5,2.5 A 2,2 0 0 1 2.5,4.5 L 0.5,4.5 Z" fill="none" stroke="#000000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" ${SR_CURVE}/>`,

  H: `<path d="M 0.5,0.5 L 0.5,4.5 M 4.5,0.5 L 4.5,4.5 M 0.5,2.5 L 4.5,2.5" fill="none" stroke="#000000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" ${SR_STRAIGHT}/>`,

  K: `<path d="M 0.5,0.5 L 0.5,4.5 M 4.5,0.5 L 0.5,2.5 M 1.5,2.5 L 4.5,4.5" fill="none" stroke="#000000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" ${SR_STRAIGHT}/>`,

  N: `<path d="M 0.5,4.5 L 0.5,0.5 L 4.5,4.5 L 4.5,0.5" fill="none" stroke="#000000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" ${SR_STRAIGHT}/>`,

  O: `<path d="M 2.5,0.5 A 2,2 0 1 1 2.49,0.5 Z" fill="none" stroke="#000000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" ${SR_CURVE}/>`,

  R: `<path d="M 0.5,4.5 L 0.5,0.5 L 2.5,0.5 A 1.25,1.25 0 0 1 2.5,3 L 0.5,3 M 2.5,3 L 4.5,4.5" fill="none" stroke="#000000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" ${SR_CURVE}/>`,

  S: `<path d="M 4.5,1.5 A 2,1 0 0,0 2.5,0.5 A 2,1 0 0,0 0.5,1.5 C 0.5,2.5 4.5,2.5 4.5,3.5 A 2,1 0 0,1 2.5,4.5 A 2,1 0 0,1 0.5,3.5" fill="none" stroke="#000000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" ${SR_CURVE}/>`,

  V: `<path d="M 0.5,0.5 L 2.5,4.5 L 4.5,0.5" fill="none" stroke="#000000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" ${SR_STRAIGHT}/>`,

  Z: `<path d="M 0.5,0.5 L 4.5,0.5 L 0.5,4.5 L 4.5,4.5" fill="none" stroke="#000000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" ${SR_STRAIGHT}/>`,
};

// ================================================================
//  LEA SYMBOLS (4 ký hiệu, fill‑based)
// ================================================================

export const LEA = {
  circle: `<path d="M 2.5,0 A 2.5,2.5 0 1,1 2.49,0 Z" fill="#000000" stroke="none"/>`,

  square: `<path d="M 0.3,0.3 L 4.7,0.3 L 4.7,4.7 L 0.3,4.7 Z" fill="#000000" stroke="none"/>`,

  house: `<path d="M 2.5,0.3 L 4.6,2.2 L 4.6,4.7 L 0.4,4.7 L 0.4,2.2 Z" fill="#000000" stroke="none"/>`,

  heart: `<path d="M 2.5,4.6 C 4,5.6 4.8,3.5 4.8,2.5 C 4.8,1 3.5,1 2.5,1.5 C 1.5,1 0.2,1 0.2,2.5 C 0.2,3.5 1,5.6 2.5,4.6 Z" fill="#000000" stroke="none"/>`,
};

// ================================================================
//  LANDOLT C (fill‑based)
// ================================================================

export const LANDOLT_C =
  `<path d="M 4.9495,3.0 A 2.5,2.5 0 1,1 4.9495,2.0 L 3.9142,2.0 A 1.5,1.5 0 1,0 3.9142,3.0 Z" fill="#000000" stroke="none"/>`;

// ================================================================
//  TUMBLING E (fill‑based)
// ================================================================

export const TUMBLING_E =
  `<path d="M 0,0 L 5,0 L 5,1 L 1,1 L 1,2 L 5,2 L 5,3 L 1,3 L 1,4 L 5,4 L 5,5 L 0,5 Z" fill="#000000" stroke="none"/>`;

// ================================================================
//  HOTV LETTERS (4 ký tự, stroke‑based)
// ================================================================

export const HOTV = {
  H: `<path d="M 0.5,0.5 L 0.5,4.5 M 4.5,0.5 L 4.5,4.5 M 0.5,2.5 L 4.5,2.5" fill="none" stroke="#000000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" ${SR_STRAIGHT}/>`,

  O: `<path d="M 2.5,0.5 A 2,2 0 1 1 2.49,0.5 Z" fill="none" stroke="#000000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" ${SR_CURVE}/>`,

  T: `<path d="M 0.5,0.5 L 4.5,0.5 M 2.5,0.5 L 2.5,4.5" fill="none" stroke="#000000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" ${SR_STRAIGHT}/>`,

  V: `<path d="M 0.5,0.5 L 2.5,4.5 L 4.5,0.5" fill="none" stroke="#000000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" ${SR_STRAIGHT}/>`,
};

// ================================================================
//  Helper: render một optotype với kích thước bất kỳ
// ================================================================

/**
 * Render optotype trong SVG viewBox 5×5, scale = pxSize / 5.
 * @param {string} pathStr  – nội dung <path> hoàn chỉnh
 * @param {number} pxSize   – kích thước hiển thị (pixel)
 * @returns {string} SVG element
 */
export function renderOptotype(pathStr, pxSize) {
  return `<svg viewBox="0 0 5 5" width="${pxSize}" height="${pxSize}" xmlns="http://www.w3.org/2000/svg">${pathStr}</svg>`;
}

/**
 * Render mảng optotype trong cùng một SVG (dùng cho Snellen chart).
 * @param {string[]} pathArray – mảng các <path> hoàn chỉnh
 * @param {number}   pxSize    – kích thước hiển thị mỗi optotype
 * @param {number}   gap       – khoảng cách giữa các optotype (đơn vị 5×5)
 * @returns {string} SVG element
 */
export function renderOptotypeRow(pathArray, pxSize, gap = 0) {
  const scale = pxSize / 5;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg">`];
  pathArray.forEach((path, i) => {
    const x = i * (pxSize + gap);
    parts.push(`<g transform="translate(${x}, 0) scale(${scale})">${path}</g>`);
  });
  parts.push('</svg>');
  return parts.join('');
}
