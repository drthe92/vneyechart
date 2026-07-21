/**
 * astigmatism_jcc.js — Mô phỏng Trụ chéo Jackson (JCC) qua WebGL
 *
 * Bản chất quang học: Áp dụng Convolution Filter có hướng trên GPU 
 * để mô phỏng sự giãn nở của khoảng Sturm trên võng mạc.
 *
 * Điều khiển:
 * - Chuột: Click trực tiếp vào Canvas để lật kính (Option 1 / Option 2). Dùng nút trên HUD để chỉnh trục ±5°.
 * - Bàn phím: [1] / [2] để lật kính, [Left] / [Right] xoay trục, [Up] / [Down] tăng/giảm công suất.
 */

class JCCRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!this.gl) {
      console.error("Trình duyệt không hỗ trợ WebGL.");
      return;
    }

    // Biến số Lâm sàng
    this.baseAxis = 90; // Trục cơ sở ban đầu (độ)
    this.isOption2 = false; // Trạng thái lật kính (1 hoặc 2)
    this.blurPower = 2.0; // Biên độ nhòe (tương đương công suất JCC)
    this.optotypeSize = 150; // Kích thước thị tiêu mô phỏng

    this._initWebGL();
    this._createOptotypeTexture();
    this._boundKeydown = this._onKeydown.bind(this);
    this._boundCanvasClick = this._onCanvasClick.bind(this);
    this._boundResize = this._onResize.bind(this);
  }

  _initWebGL() {
    const gl = this.gl;

    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform sampler2D u_image;
      uniform vec2 u_resolution;
      uniform float u_angle;
      uniform float u_blur_amount;
      varying vec2 v_texCoord;

      void main() {
        float rad = u_angle * 3.14159265359 / 180.0;
        vec2 dir = vec2(cos(rad), sin(rad));
        
        vec4 sum = vec4(0.0);
        float totalSamples = 31.0;

        for(float i = -15.0; i <= 15.0; i++) {
          vec2 offset = dir * (i * u_blur_amount) / u_resolution;
          sum += texture2D(u_image, v_texCoord + offset);
        }
        
        gl_FragColor = sum / totalSamples;
      }
    `;

    this.program = this._createProgram(vsSource, fsSource);
    gl.useProgram(this.program);

    const posBuffer = gl.createBuffer();
    this.posBuffer = posBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1, 0,1,   1,-1, 1,1,   -1,1, 0,0,
      -1,1,  0,0,   1,-1, 1,1,   1,1,  1,0
    ]), gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(this.program, "a_position");
    const texCoordLoc = gl.getAttribLocation(this.program, "a_texCoord");

    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 16, 8);

    this.uLocs = {
      resolution: gl.getUniformLocation(this.program, "u_resolution"),
      angle: gl.getUniformLocation(this.program, "u_angle"),
      blurAmount: gl.getUniformLocation(this.program, "u_blur_amount")
    };
  }

  _createProgram(vsSource, fsSource) {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    this.vs = vs;
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    this.fs = fs;
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    return prog;
  }

  _createOptotypeTexture() {
    const gl = this.gl;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 512;
    offCanvas.height = 512;
    const ctx = offCanvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(256, 256, this.optotypeSize, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(256, 256, this.optotypeSize * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillRect(256, 256 - this.optotypeSize*0.2, this.optotypeSize + 10, this.optotypeSize*0.4);

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  start() {
    this._resizeCanvas();
    document.addEventListener('keydown', this._boundKeydown);
    this.canvas.addEventListener('click', this._boundCanvasClick);
    window.addEventListener('resize', this._boundResize);
    this.renderFrame();
  }

  stop() {
    document.removeEventListener('keydown', this._boundKeydown);
    this.canvas.removeEventListener('click', this._boundCanvasClick);
    window.removeEventListener('resize', this._boundResize);
  }

  _onResize() {
    this._resizeCanvas();
    requestAnimationFrame(() => this.renderFrame());
  }

  _resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  renderFrame() {
    const gl = this.gl;
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Tinh chỉnh Trục (Axis Refinement): Trục nhòe (âm) chéo 45 độ so với trục cơ sở
    // isOption2 = false (Option 1): Nhòe ở +45 độ (Ngược chiều kim đồng hồ)
    // isOption2 = true  (Option 2): Nhòe ở -45 độ (Cùng chiều kim đồng hồ)
    const axisOffset = this.isOption2 ? -45 : 45;
    const currentAngle = this.baseAxis + axisOffset;

    gl.uniform2f(this.uLocs.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uLocs.angle, currentAngle);
    gl.uniform1f(this.uLocs.blurAmount, this.blurPower * (window.devicePixelRatio || 1));

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this._updateHUD();
  }

  _updateHUD() {
    const hud = document.getElementById('jcc-hud');
    if (hud) {
      hud.innerHTML = `
        <div style="font-size: 20px; font-weight: bold; color: ${this.isOption2 ? '#dc3545' : '#0056b3'}">
          Lựa chọn: ${this.isOption2 ? '2' : '1'}
        </div>
        
        <!-- Cụm điều khiển Công suất -->
        <div style="font-size: 14px; color: #333; margin-top: 10px; display: flex; align-items: center; gap: 8px;">
          Công suất mô phỏng: <strong>${this.blurPower.toFixed(1)}</strong>
          <button id="jcc-btn-power-minus" style="padding: 2px 10px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px;">-</button>
          <button id="jcc-btn-power-plus" style="padding: 2px 10px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px;">+</button>
        </div>

        <!-- Cụm điều khiển Trục (Color-Coded cho chuẩn Trụ Âm) -->
        <div style="font-size: 14px; margin-top: 10px; display: flex; align-items: center; gap: 8px;">
          Trục cơ sở: <strong style="font-size: 16px;">${this.baseAxis}°</strong>
        </div>
        <div style="display: flex; gap: 6px; margin-top: 6px;">
          <!-- Nút Xoay Lựa chọn 1 (Màu Xanh) -->
          <button id="jcc-btn-axis-plus" style="padding: 4px 8px; cursor: pointer; border: 2px solid #0056b3; color: #0056b3; border-radius: 4px; background: #f0f7ff; font-weight: bold;" title="Bệnh nhân chọn 1 -> Xoay theo Lựa chọn 1">
            +5° ↺ (Chọn 1)
          </button>
          <!-- Nút Xoay Lựa chọn 2 (Màu Đỏ) -->
          <button id="jcc-btn-axis-minus" style="padding: 4px 8px; cursor: pointer; border: 2px solid #dc3545; color: #dc3545; border-radius: 4px; background: #fff0f0; font-weight: bold;" title="Bệnh nhân chọn 2 -> Xoay theo Lựa chọn 2">
            -5° ↻ (Chọn 2)
          </button>
        </div>
        
        <div style="margin-top: 12px;">
          <button id="jcc-btn-flip" style="width: 100%; padding: 8px 12px; cursor: pointer; background: #333; color: #fff; border: none; border-radius: 4px; font-weight: bold;">
            Lật Kính (1 / 2)
          </button>
        </div>
      `;

      // 2. Gắn sự kiện chống lan truyền (stopPropagation) cho các nút
      document.getElementById('jcc-btn-flip').onclick = (e) => {
        e.stopPropagation();
        this.isOption2 = !this.isOption2;
        requestAnimationFrame(() => this.renderFrame());
      };
      
      document.getElementById('jcc-btn-axis-minus').onclick = (e) => {
        e.stopPropagation();
        this.baseAxis = (this.baseAxis - 5 + 180) % 180;
        requestAnimationFrame(() => this.renderFrame());
      };
      
      document.getElementById('jcc-btn-axis-plus').onclick = (e) => {
        e.stopPropagation();
        this.baseAxis = (this.baseAxis + 5) % 180;
        requestAnimationFrame(() => this.renderFrame());
      };

      // 3. Logic điều khiển Công suất mới
      document.getElementById('jcc-btn-power-minus').onclick = (e) => {
        e.stopPropagation();
        this.blurPower = Math.max(0.0, this.blurPower - 0.5);
        requestAnimationFrame(() => this.renderFrame());
      };
      
      document.getElementById('jcc-btn-power-plus').onclick = (e) => {
        e.stopPropagation();
        this.blurPower = Math.min(10.0, this.blurPower + 0.5);
        requestAnimationFrame(() => this.renderFrame());
      };
    }
  }

  _onCanvasClick() {
    this.isOption2 = !this.isOption2;
    requestAnimationFrame(() => this.renderFrame());
  }

  _onKeydown(e) {
    if (e.target.tagName === 'INPUT') return;
    
    let updated = false;
    switch (e.key) {
      case '1':
        this.isOption2 = false;
        updated = true;
        break;
      case '2':
        this.isOption2 = true;
        updated = true;
        break;
      case 'ArrowLeft':
        this.baseAxis = (this.baseAxis - 5 + 180) % 180;
        updated = true;
        break;
      case 'ArrowRight':
        this.baseAxis = (this.baseAxis + 5) % 180;
        updated = true;
        break;
      case 'ArrowUp':
        this.blurPower = Math.min(10.0, this.blurPower + 0.5);
        updated = true;
        break;
      case 'ArrowDown':
        this.blurPower = Math.max(0.0, this.blurPower - 0.5);
        updated = true;
        break;
    }
    
    if (updated) {
      e.preventDefault();
      requestAnimationFrame(() => this.renderFrame());
    }
  }
}

const jccModule = {
  id: 'jcc-simulation',
  label: 'Mô phỏng JCC (WebGL)',
  steps: ['jcc'],
  _renderer: null,

  render(idx) {
    const board = document.getElementById('display-board');
    if (!board) return;

    // Cleanup previous renderer if exists
    if (this._renderer) {
      this.cleanup();
    }

    board.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%; background: #fff;">
        <canvas id="jcc-canvas" style="width: 100%; height: 100%; display: block; cursor: pointer;" title="Click để lật kính"></canvas>
        <div id="jcc-hud" style="position: absolute; top: 20px; left: 20px; background: rgba(255,255,255,0.95); padding: 15px; border-radius: 8px; border: 1px solid #ccc; font-family: sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>
        <div style="position: absolute; bottom: 20px; left: 20px; color: #888; font-family: sans-serif; font-size: 13px; background: rgba(255,255,255,0.8); padding: 6px 10px; border-radius: 4px;">
          <strong>Hướng dẫn:</strong> Click trực tiếp vào màn hình hoặc bấm phím [1]/[2] để lật kính. Mũi tên Trái/Phải để xoay trục.
        </div>
      </div>
    `;

    const canvas = board.querySelector('#jcc-canvas');
    this._renderer = new JCCRenderer(canvas);
    this._renderer.start();
  },

  cleanup() {
    if (this._renderer) {
      this._renderer.stop();
      const gl = this._renderer.gl;
      
      // Detach and delete shaders
      gl.detachShader(this._renderer.program, this._renderer.vs);
      gl.detachShader(this._renderer.program, this._renderer.fs);
      gl.deleteShader(this._renderer.vs);
      gl.deleteShader(this._renderer.fs);
      
      // Delete buffer
      gl.deleteBuffer(this._renderer.posBuffer);
      
      // Delete program and texture
      gl.deleteProgram(this._renderer.program);
      gl.deleteTexture(this._renderer.texture);
      
      this._renderer = null;
    }
  }
};

export default jccModule;
export { jccModule };
