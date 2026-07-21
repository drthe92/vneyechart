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

import { RED_BG_COMP, GREEN_BG_COMP, WHITE_COMP } from './crosstalk.js';
//  Barrier 4: raw #FF0000 / #00FF00 / #FFFFFF are replaced by
//  crosstalk-compensated primaries (see modules/crosstalk.js) so
//  Worth-4-dot fusion responses are not corrupted by panel leakage.

/**
 * 10 mức spacing (giảm dần), mô phỏng test ở các góc thị giác
 * khác nhau nhằm đánh giá kích thước ám điểm ức chế.
 *
 * Giá trị là khoảng cách từ tâm đến mỗi dot (đơn vị viewBox 1000×1000).
 */
const SPACING_STEPS = [400, 360, 320, 280, 240, 200, 160, 120, 80, 40];

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

  /** Trạng thái đảo màu Đỏ/Trắng. */
  _isInverted: false,

  /** Biến trạng thái cho tính năng nhấp nháy luân phiên. */
  _flickerTimer: null,
  _flickerPhase: 0, // 0: Bình thường, 1: Chỉ hiện Đỏ/Trắng, 2: Chỉ hiện Xanh
  _boundKeydown: null,

  /**
   * Render 4 chấm tròn tại mức spacing `index`.
   * @param {number} index
   */
  render(index) {
    // Gắn sự kiện bàn phím nếu chưa có
    if (!this._boundKeydown) {
      this._boundKeydown = this._onKeydown.bind(this);
      document.addEventListener('keydown', this._boundKeydown);
    }

    const spacing = SPACING_STEPS[index];

    // Tính bán kính động tỷ lệ thuận với spacing (30% spacing theo chuẩn quang học)
    const currentRadius = spacing * 0.35;

    // Xác định trạng thái hiển thị của các nhóm màu dựa trên Pha nhấp nháy
    const showRedWhite = this._flickerPhase === 0 || this._flickerPhase === 1;
    const showGreen = this._flickerPhase === 0 || this._flickerPhase === 2;

    const topOpacity = showRedWhite ? 1 : 0;
    const bottomOpacity = showRedWhite ? 1 : 0;
    const sideOpacity = showGreen ? 1 : 0;

    // Hàm dựng hình khối vector nội suy theo bán kính (r) với hỗ trợ opacity
    const drawShape = (type, cx, cy, r, fill, opacity) => {
      const style = `fill="${fill}" opacity="${opacity}" transition="opacity 0.1s ease-in-out"`;
      switch (type) {
        case 'circle':
          return `<circle cx="${cx}" cy="${cy}" r="${r}" ${style} />`;
        case 'square':
          // Khung bao vuông
          const s = r * 1.8;
          return `<rect x="${cx - s/2}" y="${cy - s/2}" width="${s}" height="${s}" ${style} />`;
        case 'triangle':
          // Tam giác đều
          const h = r * Math.sqrt(3);
          return `<polygon points="${cx},${cy - r} ${cx - r},${cy + h/2} ${cx + r},${cy + h/2}" ${style} />`;
        case 'cross':
          // Chữ thập vuông góc
          const t = r * 0.4; // Độ dày nét
          return `<path d="M${cx - r},${cy - t} h${r - t} v-${r - t} h${t * 2} v${r - t} h${r - t} v${t * 2} h-${r - t} v${r - t} h-${t * 2} v-${r - t} h-${r - t} z" ${style} />`;
      }
    };

    // Tích hợp logic hoán đổi vị trí Đỏ/Trắng theo biến _isInverted (Lật kính)
    const topShape = this._isInverted ? 'triangle' : 'square';
    const topFill = this._isInverted ? WHITE_COMP : RED_BG_COMP;
    
    const bottomShape = this._isInverted ? 'square' : 'triangle';
    const bottomFill = this._isInverted ? RED_BG_COMP : WHITE_COMP;

    // Build cấu trúc SVG hoàn chỉnh với 4 hình khối phân ly
    const shapesSVG = [
      drawShape(topShape, CX, CY - spacing, currentRadius, topFill, topOpacity),
      drawShape('circle', CX - spacing, CY, currentRadius, GREEN_BG_COMP, sideOpacity),
      drawShape('cross', CX + spacing, CY, currentRadius, GREEN_BG_COMP, sideOpacity),
      drawShape(bottomShape, CX, CY + spacing, currentRadius, bottomFill, bottomOpacity)
    ].join('');

    const svg = `
      <svg class="worth4dot-svg" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
        ${shapesSVG}
      </svg>
    `;

    // Tính góc thị giác (giả sử khoảng cách quan sát 40cm)
    const visualAngle = (2 * Math.atan(spacing / 1000) * 180 / Math.PI).toFixed(1);
    const angleInfo = `<span class="worth4dot-angle" style="margin-left: 15px; font-size: 18px; color: #888;">Góc: <strong>${visualAngle}°</strong></span>`;

    // Thông tin spacing + hướng dẫn đảo màu + nhấp nháy
    const flickerStatus = this._flickerTimer ? '🟢 ĐANG BẬT' : '⚪ TẮT';
    const info = `
      <div class="worth4dot-info" style="position: absolute; bottom: 20px; left: 20px; color: #fff; font-family: sans-serif;">
        <span class="worth4dot-labels" style="font-size: 18px;">Khoảng cách mô phỏng: <strong>${spacing}</strong></span>
        <span class="worth4dot-counter" style="margin-left: 15px; font-size: 18px; color: #888;">[${index + 1} / ${SPACING_STEPS.length}]</span>
        ${angleInfo}
        <div style="font-size: 12px; margin-top: 8px; color: #666;">
          [Space]: Đảo kính Đỏ/Trắng | [F]: Bật/tắt nhấp nháy
        </div>
        <button id="worth4dot-flicker-btn" style="
          margin-top: 10px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          background: ${this._flickerTimer ? '#4CAF50' : '#555'};
          color: white;
          border: none;
          border-radius: 4px;
          transition: background 0.3s;
        ">${flickerStatus} - Nhấp để bật/tắt Flicker</button>
      </div>
    `;

    const board = document.getElementById('display-board');
    if (board) {
      board.style.background = '#000000';
      board.innerHTML = svg + info;
      
      // Gắn sự kiện click cho nút Flicker
      const flickerBtn = document.getElementById('worth4dot-flicker-btn');
      if (flickerBtn) {
        flickerBtn.addEventListener('click', () => {
          this.toggleFlicker();
        });
      }
    }
  },

  /**
   * Đảo ngược màu Đỏ/Trắng (được gọi khi nhấn Space hoặc Chuột giữa).
   * Tự động render lại với stepIndex hiện tại từ module state.
   */
  randomize() {
    this._isInverted = !this._isInverted;
    
    // Phát CustomEvent để controller biết module đã đổi trạng thái
    const event = new CustomEvent('worth4dot:inverted', {
      detail: { isInverted: this._isInverted }
    });
    window.dispatchEvent(event);
    
    // Render lại với stepIndex hiện tại
    // Controller sẽ gọi render thông qua event listener hoặc state
    const state = window.__state;
    if (state && typeof state.stepIndex === 'number') {
      this.render(state.stepIndex);
    }
  },

  /**
   * Bật/tắt tính năng nhấp nháy luân phiên (Alternating Flicker).
   * Chu kỳ 500ms (1Hz) mô phỏng Cover-Uncover test chống ức chế cảm giác.
   */
  toggleFlicker() {
    if (this._flickerTimer) {
      // Tắt nhấp nháy
      clearInterval(this._flickerTimer);
      this._flickerTimer = null;
      this._flickerPhase = 0; // Khôi phục hiển thị toàn bộ
      const state = window.__state;
      if (state && typeof state.stepIndex === 'number') {
        this.render(state.stepIndex);
      }
    } else {
      // Bật nhấp nháy
      this._flickerPhase = 1;
      // Chu kỳ 500ms (1Hz luân phiên) mô phỏng Cover-Uncover test
      this._flickerTimer = setInterval(() => {
        this._flickerPhase = this._flickerPhase === 1 ? 2 : 1;
        const state = window.__state;
        if (state && typeof state.stepIndex === 'number') {
          this.render(state.stepIndex);
        }
      }, 500);
    }
  },

  /**
   * Xử lý sự kiện bàn phím cho module Worth 4 Dot.
   * @param {KeyboardEvent} e
   */
  _onKeydown(e) {
    // Bấm phím 'F' để kích hoạt nhấp nháy
    if (e.key.toLowerCase() === 'f') {
      this.toggleFlicker();
    }
  },

  /**
   * Dọn dẹp tài nguyên khi đổi Test (tránh memory leak).
   * Được gọi bởi main.js khi chuyển module khác.
   */
  cleanup() {
    // Dừng timer nhấp nháy
    if (this._flickerTimer) {
      clearInterval(this._flickerTimer);
      this._flickerTimer = null;
    }
    this._flickerPhase = 0;
    
    // Gỡ bỏ event listener
    if (this._boundKeydown) {
      document.removeEventListener('keydown', this._boundKeydown);
      this._boundKeydown = null;
    }
  },
};

// ================================================================
//  Export
// ================================================================
export default worth4dot;
export { SPACING_STEPS, worth4dot };