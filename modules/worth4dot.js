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

/**
 * Dynamic color getters for anaglyph tests.
 * Uses window.__anaglyphColors if available, falls back to clinical defaults.
 */
function getTargetRedEyeColor() {
    return (window.__anaglyphColors?.cyan || '#4DFFFF');
}

function getTargetGreenEyeColor() {
    return (window.__anaglyphColors?.red || '#FF4D4D');
}

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
    const topFill = this._isInverted ? TARGET_BOTH_EYES : getTargetRedEyeColor();
    
    const bottomShape = this._isInverted ? 'square' : 'triangle';
    const bottomFill = this._isInverted ? getTargetRedEyeColor() : TARGET_BOTH_EYES;

    const shapesSVG = [
      drawShape(topShape, CX, CY - spacing, currentRadius, topFill, topOpacity),
      drawShape('circle', CX - spacing, CY, currentRadius, getTargetGreenEyeColor(), sideOpacity),
      drawShape('cross', CX + spacing, CY, currentRadius, getTargetGreenEyeColor(), sideOpacity),
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
        height: calc(100% - 90px);
        border-bottom-left-radius: 12px;
        box-sizing: border-box; 
        color: #333; 
        font-family: sans-serif; 
        background: rgba(255,255,255,0.95); 
        padding: 12px 10px;
        border-left: 1px solid #ddd; 
        box-shadow: -4px 0 15px rgba(0,0,0,0.05); 
        z-index: 10; 
        display: flex; 
        flex-direction: column; 
        overflow: hidden;
      ">
        
        <div style="border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 10px;">
          <div style="font-size: 12px; font-weight: 600; color: #666; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px;">Khoảng cách mô phỏng</div>
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span style="font-size: 24px; font-weight: bold; color: #0056b3;">${spacing}</span>
            <span style="font-size: 14px; font-weight: bold; color: #999;">[${index + 1} / ${SPACING_STEPS.length}]</span>
          </div>
          <div style="font-size: 12px; color: #555; margin-top: 2px;">Góc thị giác: <strong>${visualAngle}°</strong></div>
        </div>

        <div style="font-size: 12.5px; color: #444; line-height: 1.4; margin-bottom: 8px; flex-grow: 1;">
          <strong>Chỉ định:</strong> Mắt phải đeo kính Đỏ, mắt trái đeo kính Xanh. Báo cáo <strong>số lượng</strong> và <strong>hình dạng</strong> các khối đen nhìn thấy.
          
          <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 8px; margin-top: 8px;">
            <div style="font-size: 11px; font-weight: bold; color: #666; margin-bottom: 4px;">ĐIỀU KHIỂN BÀN PHÍM</div>
            <div style="font-size: 11px; color: #444; display: flex; flex-direction: column; gap: 4px;">
              <div><kbd style="background: #fff; border: 1px solid #ccc; padding: 1px 5px; border-radius: 4px; font-family: monospace;">Space</kbd> : Đảo kênh Đỏ/Chung</div>
              <div><kbd style="background: #fff; border: 1px solid #ccc; padding: 1px 5px; border-radius: 4px; font-family: monospace;">F</kbd> : Chế độ Cover-Uncover</div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 8px;">
          <div style="font-size: 11px; font-weight: bold; color: #666; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">GHI NHẬN KẾT QUẢ</div>
          <button class="w4d-res-btn" data-res="Hợp thị (4 hình)" style="
            display: block;
            width: 100%;
            box-sizing: border-box;
            padding: 5px;
            margin-bottom: 4px;
            cursor: pointer;
            font-size: 12px;
            border: 1px solid #ccc;
            background: #fff;
            color: #28a745;
            border-radius: 4px;
            text-align: left;
          ">Hợp thị (4 hình)</button>
          <button class="w4d-res-btn" data-res="Ức chế Mắt Phải (3 hình xanh)" style="
            display: block;
            width: 100%;
            box-sizing: border-box;
            padding: 5px;
            margin-bottom: 4px;
            cursor: pointer;
            font-size: 12px;
            border: 1px solid #ccc;
            background: #fff;
            border-radius: 4px;
            text-align: left;
          ">Ức chế Mắt Phải (3 hình xanh)</button>
          <button class="w4d-res-btn" data-res="Ức chế Mắt Trái (2 hình đỏ)" style="
            display: block;
            width: 100%;
            box-sizing: border-box;
            padding: 5px;
            margin-bottom: 4px;
            cursor: pointer;
            font-size: 12px;
            border: 1px solid #ccc;
            background: #fff;
            border-radius: 4px;
            text-align: left;
          ">Ức chế Mắt Trái (2 hình đỏ)</button>
          <button class="w4d-res-btn" data-res="Song thị (5 hình)" style="
            display: block;
            width: 100%;
            box-sizing: border-box;
            padding: 5px;
            margin-bottom: 4px;
            cursor: pointer;
            font-size: 12px;
            border: 1px solid #ccc;
            background: #fff;
            border-radius: 4px;
            text-align: left;
          ">Song thị (5 hình)</button>
        </div>

        <button id="worth4dot-flicker-btn" style="
          width: 100%;
          padding: 10px;
          font-size: 12px;
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

      // Ghi nhận kết quả lâm sàng -> phát sự kiện visionTestCompleted cho EMR
      const resBtns = board.querySelectorAll('.w4d-res-btn');
      resBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const payload = {
            test_type: 'Worth 4 Dot',
            clinical_metrics: {
              'Kết quả': btn.dataset.res,
              'Khoảng cách': spacing,
              'Góc thị giác': visualAngle + '°',
              'Đảo kênh': this._isInverted ? 'Có' : 'Không'
            }
          };
          document.dispatchEvent(new CustomEvent('visionTestCompleted', { detail: payload, bubbles: true }));

          // Visual feedback: nền xanh lá nhạt trong 300ms
          const originalBg = btn.style.background;
          btn.style.background = '#d4edda';
          setTimeout(() => {
            btn.style.background = originalBg;
          }, 300);
        });
      });
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