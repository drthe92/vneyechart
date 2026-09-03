/**
 * neuro_okn.js — Optokinetic Nystagmus (OKN) Test (WebGL Engine)
 * ==================================================
 *
 * Module id: 'neuro-okn'
 *
 * Render sọc đen/trắng 100% contrast bằng Vanilla WebGL.
 * Khắc phục hoàn toàn sai số lượng tử hóa (quantization error) 
 * và khử răng cưa (anti-aliasing) ở tần số không gian cao (>20 cpd).
 */

// ================================================================
//  Constants
// ================================================================

const DIRECTIONS = {
  LEFT_TO_RIGHT: { id: 'LTR', label: '← Trái → Phải', glVal: 0 },
  RIGHT_TO_LEFT: { id: 'RTL', label: '→ Phải → Trái', glVal: 1 },
  UP:            { id: 'UP',  label: '↓ Dưới → Lên', glVal: 2 },
  DOWN:          { id: 'DOWN', label: '↑ Trên → Xuống', glVal: 3 },
};

const DIRECTION_KEYS = Object.keys(DIRECTIONS);

// ================================================================
//  PPD Calculation (from calibration data)
// ================================================================

/**
 * Tính PPD từ thông số calibrator và khoảng cách.
 * PPD = d × tan(π/180) × (R / W)
 */
function calculatePPD(distanceM, ppi) {
  if (!ppi || ppi <= 0) return 96.0; // fallback
  const MM_PER_INCH = 25.4;
  const pxPerMm = ppi / MM_PER_INCH;
  const oneDegMm = distanceM * 1000.0 * Math.tan(Math.PI / 180.0);
  return oneDegMm * pxPerMm;
}

function getStripeWidth(ppd, cpd) {
  if (cpd <= 0 || ppd <= 0) return 20;
  return ppd / (2.0 * cpd); // Trả về float, không làm tròn để hiển thị UI chính xác
}

// ================================================================
//  Warning Dialog (Modal HTML)
// ================================================================

function showWarningDialog(onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'okn-warning-overlay';

  const box = document.createElement('div');
  box.className = 'okn-warning-box';

  box.innerHTML = `
    <div class="okn-warning-title">⚠ CẢNH BÁO AN TOÀN LÂM SÀNG</div>
    <div class="okn-warning-body">
      <p class="okn-warning-danger">Chống chỉ định tuyệt đối:</p>
      <p>Khởi chạy test OKN trên bệnh nhân có tiền sử</p>
      <p class="okn-warning-danger"><strong>ĐỘNG KINH NHẠY CẢM ÁNH SÁNG</strong></p>
      <p class="okn-warning-sub">(Photosensitive epilepsy)</p>
    </div>
    <div class="okn-warning-check-row">
      <input type="checkbox" id="okn-warning-check" />
      <label for="okn-warning-check">Tôi đã đọc và hiểu cảnh báo trên.</label>
    </div>
    <div class="okn-warning-actions">
      <button class="okn-warning-btn okn-warning-btn-confirm" disabled>Xác nhận & Bắt đầu</button>
      <button class="okn-warning-btn okn-warning-btn-cancel">Huỷ</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const check = box.querySelector('#okn-warning-check');
  const confirmBtn = box.querySelector('.okn-warning-btn-confirm');
  const cancelBtn = box.querySelector('.okn-warning-btn-cancel');

  check.addEventListener('change', () => {
    confirmBtn.disabled = !check.checked;
  });

  confirmBtn.addEventListener('click', () => {
    if (!check.checked) return;
    overlay.remove();
    onConfirm();
  });

  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// ================================================================
//  OKN WebGL Renderer
// ================================================================

class WebGLOKNRenderer {
  constructor(canvas, hudElement) {
    this.canvas = canvas;
    this.hud = hudElement; // Lớp HTML Overlay thay thế cho _drawHUD của Canvas2D
    this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!this.gl) {
      alert("Trình duyệt không hỗ trợ WebGL. Tính năng OKN phân giải cao bị vô hiệu hóa.");
      return;
    }

    // === Parameters ===
    this.cpd = 2.0;                   
    this.angVelDeg = 20.0;            
    this.direction = 0; // 0: LTR, 1: RTL, 2: UP, 3: DOWN
    this.distanceM = 0.4;             
    this.ppi = 96;                    
    this._ppd = 96.0;

    // === Animation state ===
    this.running = false;
    this.paused = false;
    this._animId = null;
    this._startTime = 0;
    this._pauseTime = 0;
    this._totalPausedDuration = 0;

    this._initWebGL();
    this._boundKeydown = this._onKeydown.bind(this);
  }

  _initWebGL() {
    const gl = this.gl;

    const vsSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform float u_ppd;
      uniform float u_cpd;
      uniform float u_velPxPerSec;
      uniform float u_time;
      uniform int u_direction;

      void main() {
        float safe_cpd = max(0.1, u_cpd); 
        float stripeWidth = max(1.0, u_ppd / (2.0 * safe_cpd));
        float offset = u_time * u_velPxPerSec;
        float pos = 0.0;

        if (u_direction == 0) { // Left to Right
            pos = gl_FragCoord.x - offset;
        } else if (u_direction == 1) { // Right to Left
            pos = gl_FragCoord.x + offset;
        } else if (u_direction == 2) { // Up
            pos = gl_FragCoord.y - offset;
        } else if (u_direction == 3) { // Down
            pos = gl_FragCoord.y + offset;
        }

        // Khử răng cưa tuyệt đối: hàm step tạo tương phản 100%
        float color = step(stripeWidth, mod(pos, stripeWidth * 2.0));
        gl_FragColor = vec4(color, color, color, 1.0);
      }
    `;

    this.program = this._createProgram(vsSource, fsSource);
    gl.useProgram(this.program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1,  1,
      -1,  1,  1, -1,   1,  1,
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    this.uLocs = {
      ppd: gl.getUniformLocation(this.program, "u_ppd"),
      cpd: gl.getUniformLocation(this.program, "u_cpd"),
      velPxPerSec: gl.getUniformLocation(this.program, "u_velPxPerSec"),
      time: gl.getUniformLocation(this.program, "u_time"),
      direction: gl.getUniformLocation(this.program, "u_direction")
    };
  }

  _createProgram(vsSource, fsSource) {
    const gl = this.gl;
    const vertexShader = this._compileShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    return program;
  }

  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  setParams(params) {
    if (params.cpd != null) this.cpd = Math.max(0.5, Math.min(40, params.cpd));
    if (params.angVel != null) this.angVelDeg = Math.max(15, Math.min(40, params.angVel));
    if (params.direction != null) {
      const glVal = DIRECTIONS[params.direction]?.glVal ?? 0;
      this.direction = glVal;
      this._currentDirKey = params.direction; // For HUD
    }
    this._updateHUD();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this._ppd = calculatePPD(this.distanceM, this.ppi);
    
    this._resizeCanvas();
    
    document.addEventListener('keydown', this._boundKeydown);
    this._startTime = performance.now();
    this._totalPausedDuration = 0;

    this.hud.style.display = 'block';
    this._updateHUD();

    this._animId = requestAnimationFrame(this._loop.bind(this));
  }

  stop() {
    this.running = false;
    if (this._animId) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
    document.removeEventListener('keydown', this._boundKeydown);
    if (this.hud) this.hud.style.display = 'none';
  }

  togglePause() {
    if (!this.paused) {
      this._pauseTime = performance.now();
      this.paused = true;
    } else {
      this._totalPausedDuration += (performance.now() - this._pauseTime);
      this.paused = false;
    }
    this._updateHUD();
  }

  _resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  _loop(timestamp) {
    if (!this.running) return;
    this._animId = requestAnimationFrame(this._loop.bind(this));
    if (this.paused) return;

    const activeTime = (timestamp - this._startTime - this._totalPausedDuration) / 1000.0;
    const velPxPerSec = this._ppd * this.angVelDeg;

    const gl = this.gl;
    gl.uniform1f(this.uLocs.ppd, this._ppd);
    gl.uniform1f(this.uLocs.cpd, this.cpd);
    gl.uniform1f(this.uLocs.velPxPerSec, velPxPerSec);
    gl.uniform1f(this.uLocs.time, activeTime);
    gl.uniform1i(this.uLocs.direction, this.direction);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  _updateHUD() {
    if (!this.hud) return;
    const dirLabel = DIRECTIONS[this._currentDirKey]?.label || '';
    const status = this.paused ? ' <span style="color:#f55;">[TẠM DỪNG]</span>' : '';
    const sw = (this._ppd / (2.0 * this.cpd)).toFixed(2);
    
    this.hud.innerHTML = `
      <div style="font-size:18px; color:#FFE; font-weight:bold; margin-bottom:8px;">OKN${status} — ${dirLabel}</div>
      <div style="font-size:14px; color:#CCC;">Spatial Freq: ${this.cpd.toFixed(1)} cpd | Stripe: ${sw} px</div>
      <div style="font-size:14px; color:#CCC;">Angular Vel: ${this.angVelDeg.toFixed(1)} °/s | PPD: ${this._ppd.toFixed(1)}</div>
      <div style="font-size:14px; color:#CCC; margin-bottom:12px;">Distance: ${(this.distanceM * 1000).toFixed(0)} mm</div>
      <div style="font-size:12px; color:#888;">[ESC] Thoát &nbsp; [SPACE] Pause &nbsp; [←→] Hướng &nbsp; [↑↓] Tốc độ &nbsp; [+/-] Tần số</div>
    `;
  }

  _onKeydown(e) {
    switch (e.key) {
      case 'Escape':
        this.stop();
        if (window.__state) {
          const mod = window.__getTestModule ? window.__getTestModule(window.__state.currentTest) : null;
          if (mod) mod.render(window.__state.stepIndex);
        }
        e.preventDefault();
        break;
      case ' ':
        this.togglePause();
        e.preventDefault();
        break;
      case 'ArrowLeft':
        this.setParams({ direction: 'RIGHT_TO_LEFT' });
        e.preventDefault();
        break;
      case 'ArrowRight':
        this.setParams({ direction: 'LEFT_TO_RIGHT' });
        e.preventDefault();
        break;
      case 'ArrowUp':
        this.setParams({ angVel: this.angVelDeg + 1 });
        e.preventDefault();
        break;
      case 'ArrowDown':
        this.setParams({ angVel: this.angVelDeg - 1 });
        e.preventDefault();
        break;
      case '+':
      case '=':
        this.setParams({ cpd: this.cpd + 0.5 });
        e.preventDefault();
        break;
      case '-':
        this.setParams({ cpd: this.cpd - 0.5 });
        e.preventDefault();
        break;
    }
  }
}

// ================================================================
//  Module — OKN Test
// ================================================================

const neuroOknModule = {
  id: 'neuro-okn',
  label: 'OKN Test',
  steps: [0],

  _renderer: null,
  _canvas: null,
  _hud: null,

  render(index) {
    const board = document.getElementById('display-board');
    if (!board) return;

    if (this._renderer) {
      this._renderer.stop();
      this._renderer = null;
    }

    let distanceM = 0.4;
    let ppi = 96;
    const cal = window.__calibrator;
    if (cal && cal.ppi > 0) {
      distanceM = cal.distanceM || 0.4;
      ppi = cal.ppi;
    }

    // Thêm div .okn-hud tuyệt đối (absolute) đè lên canvas
    board.innerHTML = `
      <div class="okn-container" style="position:relative; width:100%; height:100%;">
        <div class="okn-controls" style="position:absolute; z-index:10; background:#fff; padding:20px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.1); top:50%; left:50%; transform:translate(-50%, -50%);">
          <div class="okn-controls-title" style="font-size:20px; font-weight:bold; margin-bottom:16px;">OKN Test — Optokinetic Nystagmus</div>
          <div class="okn-controls-row" style="display:flex; gap:16px; margin-bottom:12px;">
            <div class="okn-control-group">
              <label>Tần số (cpd) <span class="okn-val" id="okn-val-cpd">2.0</span></label><br>
              <input type="range" id="okn-cpd" min="0.5" max="40" step="0.5" value="2.0" />
            </div>
            <div class="okn-control-group">
              <label>Vận tốc (°/s) <span class="okn-val" id="okn-val-vel">20</span></label><br>
              <input type="range" id="okn-vel" min="15" max="40" step="1" value="20" />
            </div>
          </div>
          <div class="okn-controls-row" style="margin-bottom:12px;">
            <div class="okn-control-group">
              <label>Hướng</label><br>
              <div class="okn-dir-buttons" id="okn-dir-buttons">
                ${DIRECTION_KEYS.map((k) => `
                  <button class="okn-dir-btn ${k === 'LEFT_TO_RIGHT' ? 'active' : ''}" data-dir="${k}" style="margin:4px; padding:4px 8px;">
                    ${DIRECTIONS[k].label}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="okn-controls-row" style="display:flex; gap:16px; margin-bottom:20px;">
            <div class="okn-control-group">
              <label>Khoảng cách (cm)</label><br>
              <input type="number" id="okn-distance" value="${(distanceM * 100).toFixed(0)}" min="10" max="300" step="5" />
            </div>
            <div class="okn-control-group okn-info-display" style="background:#f5f5f5; padding:8px; border-radius:4px;">
              <label>PPD: <strong id="okn-ppd-display">—</strong></label><br>
              <label>Stripe: <strong id="okn-stripe-display">—</strong> px</label>
            </div>
          </div>
          <button class="okn-start-btn" id="okn-start-btn" style="width:100%; padding:12px; background:#0056b3; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">▶ BẮT ĐẦU OKN TEST</button>
        </div>
        
        <canvas id="okn-canvas" class="okn-canvas" style="display:none; width:100%; height:100%; background:#000;"></canvas>
        <div id="okn-hud" style="display:none; position:absolute; top:16px; left:16px; z-index:5; background:rgba(0,0,0,0.6); padding:16px; border-radius:8px; pointer-events:none;"></div>
      </div>
    `;

    this._canvas = board.querySelector('#okn-canvas');
    this._hud = board.querySelector('#okn-hud');
    this._wireControls(distanceM, ppi);
    this._updatePPDPreview(distanceM, ppi);
  },

  _wireControls(distanceM, ppi) {
    const cpdInput = document.getElementById('okn-cpd');
    const velInput = document.getElementById('okn-vel');
    const dirBtns = document.querySelectorAll('.okn-dir-btn');
    const distInput = document.getElementById('okn-distance');
    const startBtn = document.getElementById('okn-start-btn');

    if (!cpdInput || !startBtn) return;

    const updatePreview = () => {
      const cpd = parseFloat(cpdInput.value);
      const vel = parseFloat(velInput.value);
      const dist = parseFloat(distInput.value) / 100;
      const ppd = calculatePPD(dist, ppi);
      const sw = getStripeWidth(ppd, cpd);
      document.getElementById('okn-val-cpd').textContent = cpd.toFixed(1);
      document.getElementById('okn-val-vel').textContent = vel.toFixed(0);
      document.getElementById('okn-ppd-display').textContent = ppd.toFixed(1);
      document.getElementById('okn-stripe-display').textContent = sw.toFixed(2);
    };

    cpdInput.addEventListener('input', updatePreview);
    velInput.addEventListener('input', updatePreview);
    distInput.addEventListener('input', updatePreview);

    let currentDir = 'LEFT_TO_RIGHT';
    dirBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        dirBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentDir = btn.dataset.dir;
      });
    });

    startBtn.addEventListener('click', () => {
      const cpd = parseFloat(cpdInput.value);
      const vel = parseFloat(velInput.value);
      const dist = parseFloat(distInput.value) / 100;
      const dir = currentDir;

      showWarningDialog(() => {
        this._startOKN(cpd, vel, dist, dir, ppi);
      });
    });
  },

  _updatePPDPreview(distanceM, ppi) {
    const ppd = calculatePPD(distanceM, ppi);
    const cpdEl = document.getElementById('okn-cpd');
    if (cpdEl) {
      const cpd = parseFloat(cpdEl.value);
      const sw = getStripeWidth(ppd, cpd);
      document.getElementById('okn-ppd-display').textContent = ppd.toFixed(1);
      document.getElementById('okn-stripe-display').textContent = sw.toFixed(2);
    }
  },

  _startOKN(cpd, angVel, distanceM, direction, ppi) {
    const controls = document.querySelector('.okn-controls');
    if (controls) controls.style.display = 'none';

    const canvas = this._canvas;
    if (!canvas) return;

    canvas.style.display = 'block';

    const renderer = new WebGLOKNRenderer(canvas, this._hud);
    renderer.ppi = ppi;
    renderer.distanceM = distanceM;
    renderer.setParams({ cpd, angVel, direction });

    this._renderer = renderer;
    window.__oknRenderer = renderer;

    renderer.start();
  },

  cleanup() {
    if (this._renderer) {
      this._renderer.stop();
      this._renderer = null;
    }
    window.__oknRenderer = null;
  },

  randomize() {}
};

// ================================================================
//  Export
// ================================================================
export default neuroOknModule;
export { neuroOknModule, WebGLOKNRenderer, calculatePPD };