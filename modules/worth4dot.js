/**
 * worth4dot.js — Worth 4 Dot (W4D) Binocular Fusion Test Module.
 *
 * Thuật toán: Nền Trắng - Trừ Màu (Subtractive Color)
 * - Nền: Trắng (#FFFFFF)
 * - Mục tiêu mắt Đỏ: Lục lam (#66FFFF) -> Kính đỏ thấy Đen, kính xanh thấy tàng hình.
 * - Mục tiêu mắt Xanh: Đỏ (#FF6666) -> Kính xanh thấy Đen, kính đỏ thấy tàng hình.
 * - Mục tiêu chung (Cả 2 mắt): Đen (#000000) -> Cả hai kính đều thấy Đen.
 *
 * Module id = 'binocular' (thay thế default).
 */

// ================================================================
//  Constants
// ================================================================

const TARGET_RED_EYE = '#66FFFF';   // Cyan
const TARGET_GREEN_EYE = '#FF6666'; // Red
const TARGET_BOTH_EYES = '#000000'; // Black

const SPACING_STEPS = [400, 360, 320, 280, 240, 200, 160, 120, 80, 40];

const CX = 500;
const CY = 500;

// ================================================================
//  Worth 4 Dot Module
// ================================================================

const worth4dot = {
  id: 'binocular',
  label: 'Chức năng hai mắt (Subtractive)',
  steps: SPACING_STEPS,

  _isInverted: false,
  _flickerTimer: null,
  _flickerPhase: 0, 
  _boundKeydown: null,

  render(index) {
    if (!this._boundKeydown) {
      this._boundKeydown = this._onKeydown.bind(this);
      document.addEventListener('keydown', this._boundKeydown);
    }

    const spacing = SPACING_STEPS[index];
    const currentRadius = spacing * 0.35;

    const showRedWhite = this._flickerPhase === 0 || this._flickerPhase === 1;
    const showGreen = this._flickerPhase === 0 || this._flickerPhase === 2;

    const topOpacity = showRedWhite ? 1 : 0;
    const bottomOpacity = showRedWhite ? 1 : 0;
    const sideOpacity = showGreen ? 1 : 0;

    const drawShape = (type, cx, cy, r, fill, opacity) => {
      const style = `fill="${fill}" opacity="${opacity}" transition="opacity 0.1s ease-in-out"`;
      switch (type) {
        case 'circle':
          return `<circle cx="${cx}" cy="${cy}" r="${r}" ${style} />`;
        case 'square':
          const s = r * 1.8;
          return `<rect x="${cx - s/2}" y="${cy - s/2}" width="${s}" height="${s}" ${style} />`;
        case 'triangle':
          const h = r * Math.sqrt(3);
          return `<polygon points="${cx},${cy - r} ${cx - r},${cy + h/2} ${cx + r},${cy + h/2}" ${style} />`;
        case 'cross':
          const t = r * 0.4;
          return `<path d="M${cx - r},${cy - t} h${r - t} v-${r - t} h${t * 2} v${r - t} h${r - t} v${t * 2} h-${r - t} v${r - t} h-${t * 2} v-${r - t} h-${r - t} z" ${style} />`;
      }
    };

    const topShape = this._isInverted ? 'triangle' : 'square';
    const topFill = this._isInverted ? TARGET_BOTH_EYES : TARGET_RED_EYE;
    
    const bottomShape = this._isInverted ? 'square' : 'triangle';
    const bottomFill = this._isInverted ? TARGET_RED_EYE : TARGET_BOTH_EYES;

    const shapesSVG = [
      drawShape(topShape, CX, CY - spacing, currentRadius, topFill, topOpacity),
      drawShape('circle', CX - spacing, CY, currentRadius, TARGET_GREEN_EYE, sideOpacity),
      drawShape('cross', CX + spacing, CY, currentRadius, TARGET_GREEN_EYE, sideOpacity),
      drawShape(bottomShape, CX, CY + spacing, currentRadius, bottomFill, bottomOpacity)
    ].join('');

    const svg = `
      <svg class="worth4dot-svg" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; display: block;">
        ${shapesSVG}
      </svg>
    `;

    const visualAngle = (2 * Math.atan(spacing / 1000) * 180 / Math.PI).toFixed(1);
    
    const flickerStatus = this._flickerTimer ? '🟢 ĐANG BẬT' : '⚪ TẮT';
    
    // Giao diện Sidebar toàn cột phải (width 300px, height 100%)
    const info = `
      <div class="worth4dot-info" style="
        position: absolute; 
        top: 0; 
        right: 0; 
        width: 210px; 
        height: 100%; 
        box-sizing: border-box; 
        color: #333; 
        font-family: sans-serif; 
        background: rgba(255,255,255,0.95); 
        padding: 30px 20px; 
        border-left: 1px solid #ddd; 
        box-shadow: -4px 0 15px rgba(0,0,0,0.05); 
        z-index: 10; 
        display: flex; 
        flex-direction: column; 
        overflow-y: auto;
      ">
        
        <div style="border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 20px;">
          <div style="font-size: 14px; font-weight: 600; color: #666; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Khoảng cách mô phỏng</div>
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span style="font-size: 32px; font-weight: bold; color: #0056b3;">${spacing}</span>
            <span style="font-size: 14px; font-weight: bold; color: #999;">[${index + 1} / ${SPACING_STEPS.length}]</span>
          </div>
          <div style="font-size: 14px; color: #555; margin-top: 4px;">Góc thị giác: <strong>${visualAngle}°</strong></div>
        </div>

        <div style="font-size: 14px; color: #444; line-height: 1.6; margin-bottom: 20px; flex-grow: 1;">
          <strong>Chỉ định:</strong> Trẻ đeo kính Đỏ/Xanh. Báo cáo <strong>số lượng</strong> và <strong>hình dạng</strong> các khối đen nhìn thấy.
          
          <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; margin-top: 20px;">
            <div style="font-size: 12px; font-weight: bold; color: #666; margin-bottom: 10px;">ĐIỀU KHIỂN BÀN PHÍM</div>
            <div style="font-size: 13px; color: #444; display: flex; flex-direction: column; gap: 10px;">
              <div><kbd style="background: #fff; border: 1px solid #ccc; padding: 3px 8px; border-radius: 4px; font-family: monospace;">Space</kbd> : Đảo kênh Đỏ/Chung</div>
              <div><kbd style="background: #fff; border: 1px solid #ccc; padding: 3px 8px; border-radius: 4px; font-family: monospace;">F</kbd> : Chế độ Cover-Uncover</div>
            </div>
          </div>
        </div>

        <button id="worth4dot-flicker-btn" style="
          width: 100%;
          padding: 14px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          background: ${this._flickerTimer ? '#28a745' : '#6c757d'};
          color: white;
          border: none;
          border-radius: 8px;
          transition: background 0.3s;
          box-shadow: 0 4px 6px rgba(0,0,0,0.15);
          margin-top: auto;
        ">${flickerStatus} - Nhấp nháy luân phiên</button>

      </div>
    `;

    const board = document.getElementById('display-board');
    if (board) {
      board.style.background = '#FFFFFF';
      board.innerHTML = svg + info;
      
      const flickerBtn = document.getElementById('worth4dot-flicker-btn');
      if (flickerBtn) {
        flickerBtn.addEventListener('click', () => {
          this.toggleFlicker();
        });
      }
    }
  },

  randomize() {
    this._isInverted = !this._isInverted;
    
    const event = new CustomEvent('worth4dot:inverted', {
      detail: { isInverted: this._isInverted }
    });
    window.dispatchEvent(event);
    
    const state = window.__state;
    if (state && typeof state.stepIndex === 'number') {
      this.render(state.stepIndex);
    }
  },

  toggleFlicker() {
    if (this._flickerTimer) {
      clearInterval(this._flickerTimer);
      this._flickerTimer = null;
      this._flickerPhase = 0; 
      const state = window.__state;
      if (state && typeof state.stepIndex === 'number') {
        this.render(state.stepIndex);
      }
    } else {
      this._flickerPhase = 1;
      this._flickerTimer = setInterval(() => {
        this._flickerPhase = this._flickerPhase === 1 ? 2 : 1;
        const state = window.__state;
        if (state && typeof state.stepIndex === 'number') {
          this.render(state.stepIndex);
        }
      }, 500);
    }
  },

  _onKeydown(e) {
    if (e.key.toLowerCase() === 'f') {
      this.toggleFlicker();
    }
  },

  cleanup() {
    if (this._flickerTimer) {
      clearInterval(this._flickerTimer);
      this._flickerTimer = null;
    }
    this._flickerPhase = 0;
    
    if (this._boundKeydown) {
      document.removeEventListener('keydown', this._boundKeydown);
      this._boundKeydown = null;
    }
  },
};

export default worth4dot;
export { SPACING_STEPS, worth4dot };