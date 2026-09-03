/**
 * red_desat.js — Red Desaturation Test (Bão hoà màu đỏ)
 * =======================================================
 *
 * Module id: 'neuro-red-desat'
 *
 * Cơ sở lâm sàng:
 *   Phát hiện suy giảm dẫn truyền sợi trục thị thần kinh (Optic Neuritis).
 *   Mắt bệnh nhìn màu đỏ nhạt hơn (desaturated) so với mắt lành do tổn thương đường dẫn truyền parvocellular.
 *
 * Kỹ thuật:
 *   - Canvas 2D rendering
 *   - Tọa độ màu HSV: Hue=0° (đỏ), Saturation=[0..100]%, Value=100%
 *   - Nền xám trung tính RGB(128,128,128) triệt tiêu contrast glare
 *   - Phân loại mắt kiểm tra (OD/OS) để đối chiếu
 *   - Slider + phím ↑↓ điều chỉnh saturation, bước nhảy 1%
 *   - Lưu kết quả → log JSON đồng bộ EMR
 */

// ================================================================
//  HSV → RGB Conversion (standard algorithm)
// ================================================================

function hsvToRgb(h, s, v) {
  const sNorm = s / 100;
  const vNorm = v / 100;
  const c = vNorm * sNorm;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;

  if (hp >= 0 && hp < 1) { r1 = c; g1 = x; b1 = 0; }
  else if (hp >= 1 && hp < 2) { r1 = x; g1 = c; b1 = 0; }
  else if (hp >= 2 && hp < 3) { r1 = 0; g1 = c; b1 = x; }
  else if (hp >= 3 && hp < 4) { r1 = 0; g1 = x; b1 = c; }
  else if (hp >= 4 && hp < 5) { r1 = x; g1 = 0; b1 = c; }
  else if (hp >= 5 && hp < 6) { r1 = c; g1 = 0; b1 = x; }

  const m = vNorm - c;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function rgbToCss(r, g, b) {
  return `rgb(${r}, ${g}, ${b})`;
}

// ================================================================
//  Constants
// ================================================================

const NEUTRAL_GRAY = '#808080';
const SATURATION_STEP = 1; 
const MIN_SATURATION = 0;
const MAX_SATURATION = 100;

// ================================================================
//  Red Desaturation Module
// ================================================================

const redDesatModule = {
  id: 'neuro-red-desat',
  label: 'Bão hoà màu đỏ',
  steps: [0],

  _saturation: 100,
  _hue: 0,
  _value: 100,
  _results: [],
  _canvas: null,
  _ctx: null,
  _ppi: 96,

  // ================================================================
  //  Render
  // ================================================================

  render() {
    const board = document.getElementById('display-board');
    if (!board) return;

    const cal = window.__calibrator;
    this._ppi = (cal && cal.ppi > 0) ? cal.ppi : 96;

    board.innerHTML = `
      <div class="red-desat-container" style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;padding:20px;">
        <canvas id="red-desat-canvas" class="red-desat-canvas" style="max-width:100%;max-height:100%;"></canvas>

        <div class="red-desat-controls">
          <div class="red-desat-btn-row" style="margin-bottom: 12px; font-weight: bold;">
            <label style="cursor:pointer;">
              <input type="radio" name="eye-laterality" value="OD" checked> Mắt phải (OD)
            </label>
            <label style="margin-left: 20px; cursor:pointer;">
              <input type="radio" name="eye-laterality" value="OS"> Mắt trái (OS)
            </label>
          </div>

          <div class="red-desat-slider-row">
            <span class="red-desat-label">Độ bão hoà:</span>
            <button class="red-desat-btn-up" id="red-desat-btn-up">▲</button>
            <input type="range" id="red-desat-slider"
                   min="${MIN_SATURATION}" max="${MAX_SATURATION}" step="1"
                   value="${this._saturation}" />
            <button class="red-desat-btn-down" id="red-desat-btn-down">▼</button>
            <span class="red-desat-value" id="red-desat-value">${this._saturation}%</span>
          </div>

          <div class="red-desat-btn-row">
            <button class="red-desat-btn" id="red-desat-save">💾 Lưu kết quả</button>
            <button class="red-desat-btn" id="red-desat-reset">⟳ Đặt lại 100%</button>
          </div>
        </div>

        <div class="red-desat-result-panel" id="red-desat-result-panel">
          <div class="red-desat-result-title">Kết quả</div>
          <div class="red-desat-result-row">
            <span>Bão hoà:</span>
            <strong id="red-desat-result-sat" style="color:#c0392b;">${this._saturation}%</strong>
          </div>
          <div class="red-desat-result-row">
            <span>Hue:</span>
            <strong>0° (Đỏ)</strong>
          </div>
          <div class="red-desat-result-row">
            <span>RGB:</span>
            <strong id="red-desat-result-rgb">—</strong>
          </div>
          <div class="red-desat-result-divider"></div>
          <div class="red-desat-result-row">
            <span>Số lần lưu:</span>
            <strong id="red-desat-log-count">0</strong>
          </div>
        </div>

        <div class="red-desat-clinical-info">
          <strong>Chỉ định:</strong> Tầm soát bệnh lý thị thần kinh (Optic Neuritis), chèn ép giao thoa thị giác.<br/>
          <strong>Chống chỉ định chẩn đoán viêm thị thần kinh:</strong> Nếu chênh lệch bão hòa OD/OS <= 25% không kèm dấu hiệu khác.<br/>
          ⚠ Ngưỡng cảnh báo lâm sàng: <strong>< 75%</strong> (hoặc chênh lệch OD/OS > 25%).
        </div>
      </div>
    `;

    this._canvas = document.getElementById('red-desat-canvas');
    this._ctx = this._canvas ? this._canvas.getContext('2d') : null;

    this._wireControls();
    this._resizeCanvas();
    this._drawStimulus();
  },

  // ================================================================
  //  Canvas sizing & Drawing
  // ================================================================

  _resizeCanvas() {
    if (!this._canvas) return;
    const container = this._canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const size = Math.min(rect.width * 0.9, rect.height * 0.8);
    this._canvas.width = size;
    this._canvas.height = size;
    this._canvas.style.width = size + 'px';
    this._canvas.style.height = size + 'px';
  },

  _drawStimulus() {
    if (!this._ctx || !this._canvas) return;

    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;

    ctx.fillStyle = NEUTRAL_GRAY;
    ctx.fillRect(0, 0, w, h);

    const margin = w * 0.05;
    const stimSize = w - 2 * margin;

    const rgb = hsvToRgb(this._hue, this._saturation, this._value);
    const fillColor = rgbToCss(rgb.r, rgb.g, rgb.b);

    const x = margin;
    const y = margin;
    // Increase the stimulus size to better fill the available space
    const radius = stimSize * 0.15;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + stimSize - radius, y);
    ctx.quadraticCurveTo(x + stimSize, y, x + stimSize, y + radius);
    ctx.lineTo(x + stimSize, y + stimSize - radius);
    ctx.quadraticCurveTo(x + stimSize, y + stimSize, x + stimSize - radius, y + stimSize);
    ctx.lineTo(x + radius, y + stimSize);
    ctx.quadraticCurveTo(x, y + stimSize, x, y + stimSize - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const rgbEl = document.getElementById('red-desat-result-rgb');
    if (rgbEl) rgbEl.textContent = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

    const satEl = document.getElementById('red-desat-result-sat');
    if (satEl) satEl.textContent = `${this._saturation}%`;

    const valEl = document.getElementById('red-desat-value');
    if (valEl) valEl.textContent = `${this._saturation}%`;

    const slider = document.getElementById('red-desat-slider');
    if (slider) slider.value = this._saturation;
  },

  // ================================================================
  //  Controls Wiring
  // ================================================================

  _wireControls() {
    const slider = document.getElementById('red-desat-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        this._saturation = parseInt(e.target.value, 10);
        this._drawStimulus();
      });
    }

    const upBtn = document.getElementById('red-desat-btn-up');
    if (upBtn) {
      upBtn.addEventListener('click', () => {
        this._saturation = Math.min(MAX_SATURATION, this._saturation + SATURATION_STEP);
        this._drawStimulus();
      });
      // Also support touch events for mobile devices
      upBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this._saturation = Math.min(MAX_SATURATION, this._saturation + SATURATION_STEP);
        this._drawStimulus();
      });
    }

    const downBtn = document.getElementById('red-desat-btn-down');
    if (downBtn) {
      downBtn.addEventListener('click', () => {
        this._saturation = Math.max(MIN_SATURATION, this._saturation - SATURATION_STEP);
        this._drawStimulus();
      });
      // Also support touch events for mobile devices
      downBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this._saturation = Math.max(MIN_SATURATION, this._saturation - SATURATION_STEP);
        this._drawStimulus();
      });
    }

    const saveBtn = document.getElementById('red-desat-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this._saveResult();
      });
    }

    const resetBtn = document.getElementById('red-desat-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this._saturation = 100;
        this._drawStimulus();
      });
    }

    this._boundKeydown = this._onKeydown.bind(this);
    document.addEventListener('keydown', this._boundKeydown);
  },

  _onKeydown(e) {
    switch (e.key) {
      case 'ArrowUp':
        this._saturation = Math.min(MAX_SATURATION, this._saturation + SATURATION_STEP);
        this._drawStimulus();
        e.preventDefault();
        break;
      case 'ArrowDown':
        this._saturation = Math.max(MIN_SATURATION, this._saturation - SATURATION_STEP);
        this._drawStimulus();
        e.preventDefault();
        break;
      case 'ArrowRight':
        this._saturation = Math.min(MAX_SATURATION, this._saturation + SATURATION_STEP * 5);
        this._drawStimulus();
        e.preventDefault();
        break;
      case 'ArrowLeft':
        this._saturation = Math.max(MIN_SATURATION, this._saturation - SATURATION_STEP * 5);
        this._drawStimulus();
        e.preventDefault();
        break;
      case 's':
      case 'S':
        this._saveResult();
        e.preventDefault();
        break;
      case 'r':
      case 'R':
        this._saturation = 100;
        this._drawStimulus();
        e.preventDefault();
        break;
    }
  },

  // ================================================================
  //  Save Result
  // ================================================================

  _saveResult() {
    const timestamp = new Date().toISOString();
    
    const eyeRadio = document.querySelector('input[name="eye-laterality"]:checked');
    const laterality = eyeRadio ? eyeRadio.value : 'Unknown';

    const entry = {
      timestamp,
      eye: laterality,
      saturation: this._saturation,
      hue: this._hue,
      value: this._value,
    };

    this._results.push(entry);

    const countEl = document.getElementById('red-desat-log-count');
    if (countEl) countEl.textContent = this._results.length;

    const saveBtn = document.getElementById('red-desat-save');
    if (saveBtn) {
      saveBtn.textContent = `✅ Đã lưu (${laterality})`;
      saveBtn.style.background = '#28a745';
      saveBtn.style.color = '#fff';
      setTimeout(() => {
        saveBtn.textContent = '💾 Lưu kết quả';
        saveBtn.style.background = '';
        saveBtn.style.color = '';
      }, 1200);
    }
  },

  // ================================================================
  //  Cleanup
  // ================================================================

  cleanup() {
    if (this._boundKeydown) {
      document.removeEventListener('keydown', this._boundKeydown);
      this._boundKeydown = null;
    }
    this._canvas = null;
    this._ctx = null;
  },

  randomize() {
    // No-op for this module
  },
};

export default redDesatModule;
export { redDesatModule, hsvToRgb };