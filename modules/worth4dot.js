/**
 * worth4dot.js — Worth 4 Dot (W4D) Binocular Fusion Test Module.
 *
 * Hiển thị 4 hình tròn SVG theo hình thoi:
 *   - Trên:   Đỏ   (#FF0000)
 *   - Trái:   Xanh (#00FF00)
 *   - Phải:   Xanh (#00FF00)
 *   - Dưới:   Trắng (#FFFFFF)
 *
 * Nền display-board chuyển thành đen tuyền (#000000).
 * NEXT  → thu nhỏ khoảng cách (mô phỏng góc thị giác hẹp hơn).
 * PREV  → phóng to khoảng cách.
 *
 * Module id = 'binocular' (thay thế default).
 */

// ================================================================
//  Constants
// ================================================================

/**
 * 10 mức spacing (giảm dần), mô phỏng test ở các góc thị giác
 * khác nhau nhằm đánh giá kích thước ám điểm ức chế.
 *
 * Giá trị là khoảng cách từ tâm đến mỗi dot (đơn vị viewBox 1000×1000).
 */
const SPACING_STEPS = [400, 360, 320, 280, 240, 200, 160, 120, 80, 40];

/** Bán kính mỗi chấm tròn (viewBox units). */
const DOT_RADIUS = 28;

/** Tâm viewBox 1000×1000. */
const CX = 500;
const CY = 500;

// ================================================================
//  Worth 4 Dot Module
// ================================================================

const worth4dot = {
  id: 'binocular',
  label: 'Chức năng hai mắt',
  steps: SPACING_STEPS,

  /**
   * Render 4 chấm tròn tại mức spacing `index`.
   * @param {number} index
   */
  render(index) {
    const spacing = SPACING_STEPS[index];

    // 4 chấm tròn hình thoi
    const dots = [
      { x: CX,           y: CY - spacing, fill: '#FF0000', aria: 'Đỏ' },
      { x: CX - spacing, y: CY,           fill: '#00FF00', aria: 'Xanh lá' },
      { x: CX + spacing, y: CY,           fill: '#00FF00', aria: 'Xanh lá' },
      { x: CX,           y: CY + spacing, fill: '#FFFFFF', aria: 'Trắng' },
    ];

    // Xây SVG
    const circles = dots.map((d) =>
      `<circle cx="${d.x}" cy="${d.y}" r="${DOT_RADIUS}" fill="${d.fill}"/>`
    ).join('');

    const svg = `
      <svg class="worth4dot-svg" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
        ${circles}
      </svg>
    `;

    // Thông tin spacing
    const info = `
      <div class="worth4dot-info">
        <span class="worth4dot-labels">Khoảng cách: <strong>${spacing}</strong></span>
        <span class="worth4dot-counter">${index + 1} / ${SPACING_STEPS.length}</span>
      </div>
    `;

    const board = document.getElementById('display-board');
    if (board) {
      board.style.background = '#000000';
      board.innerHTML = svg + info;
    }
  },
};

// ================================================================
//  Export
// ================================================================
export default worth4dot;
export { SPACING_STEPS, worth4dot };