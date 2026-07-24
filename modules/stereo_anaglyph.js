/**
 * stereo_anaglyph.js — Stereo Random-Dot Test (Anaglyph)
 * 
 * Bản chất quang học: Tạo nhiễu RDS tĩnh. Tách kênh Đỏ (Red) và Xanh-Lục (Cyan).
 * Dịch chuyển tọa độ không gian của một hình khối trung tâm để tạo sự sai biệt võng mạc (Retinal Disparity).
 */

class StereoRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!this.gl) {
      console.error("WebGL không được hỗ trợ.");
      return;
    }

    // Biến số Lâm sàng
    this.arcsecSteps = [400, 200, 100, 50, 40, 20];
    this.currentStep = 0;
    this.shapeType = 1; // 1: Hình Tròn, 2: Hình Vuông, 3: Tam giác
    this.dotSize = 3.0; // Kích thước hạt nhiễu (pixel)

    this._initWebGL();
    
    // Kiểm tra nếu WebGL khởi tạo thất bại
    if (!this.program) {
      console.error("Không thể khởi tạo WebGL program.");
      return;
    }
    
    this._boundKeydown = this._onKeydown.bind(this);
    this._boundResize = this._onResize.bind(this);
  }

  _initWebGL() {
    const gl = this.gl;

    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_uv = a_position * 0.5 + 0.5;
      }
    `;

    // Shader tạo Random Dot Stereogram (RDS) theo kênh Đỏ/Cyan
    const fsSource = `
      precision highp float;
      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform float u_disparity_px;
      uniform float u_dot_size;
      uniform int u_shape;

      // Hàm băm (Hash function) tạo nhiễu ngẫu nhiên siêu tốc
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) > 0.5 ? 1.0 : 0.0;
      }

      // Xác định pixel có nằm trong hình khối (ẩn) không
      bool inShape(vec2 uv) {
        vec2 p = uv - 0.5; // Đưa tâm về (0,0)
        // Cân bằng tỷ lệ khung hình
        p.x *= u_resolution.x / u_resolution.y; 
        
        if (u_shape == 1) { // Hình tròn
          return length(p) < 0.25;
        } else if (u_shape == 2) { // Hình vuông
          return abs(p.x) < 0.2 && abs(p.y) < 0.2;
        } else if (u_shape == 3) { // Tam giác
          return (p.y > -0.2) && (p.y < 0.2 - abs(p.x) * 1.732);
        }
        return false;
      }

      void main() {
        // Pixel hóa tọa độ để tạo macro-dots (hạt nhiễu lớn)
        vec2 st = floor(gl_FragCoord.xy / u_dot_size);
        
        // Chuẩn hóa Disparity về không gian pixel (chia đôi cho 2 mắt)
        float shift = (u_disparity_px / u_dot_size) * 0.5;

        // Kênh Đỏ (Mắt trái)
        vec2 st_red = st;
        if (inShape(v_uv)) st_red.x += shift;
        float r = hash(st_red);

        // Kênh Cyan (Mắt phải)
        vec2 st_cyan = st;
        if (inShape(v_uv)) st_cyan.x -= shift;
        float gb = hash(st_cyan);

        gl_FragColor = vec4(r, gb, gb, 1.0);
      }
    `;

    this.program = this._createProgram(vsSource, fsSource);
    if (!this.program) return;
    gl.useProgram(this.program);

    this.posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1,  1,-1,  -1,1,
      -1,1,   1,-1,   1,1
    ]), gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    this.uLocs = {
      resolution: gl.getUniformLocation(this.program, "u_resolution"),
      disparityPx: gl.getUniformLocation(this.program, "u_disparity_px"),
      dotSize: gl.getUniformLocation(this.program, "u_dot_size"),
      shape: gl.getUniformLocation(this.program, "u_shape")
    };
  }

  _createProgram(vsSource, fsSource) {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    
    // Kiểm tra lỗi biên dịch vertex shader
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('Vertex shader compilation error:', gl.getShaderInfoLog(vs));
      gl.deleteShader(vs);
      return null;
    }
    this.vs = vs;
    
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    
    // Kiểm tra lỗi biên dịch fragment shader
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('Fragment shader compilation error:', gl.getShaderInfoLog(fs));
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return null;
    }
    this.fs = fs;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    
    // Kiểm tra lỗi linking program
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return null;
    }
    
    return prog;
  }

  start() {
    this._resizeCanvas();
    window.addEventListener('resize', this._boundResize);
    document.addEventListener('keydown', this._boundKeydown);
    this.renderFrame();
  }

  stop() {
    window.removeEventListener('resize', this._boundResize);
    document.removeEventListener('keydown', this._boundKeydown);
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
    
    // Đọc dữ liệu hiệu chuẩn từ localStorage
    const ccPxPerMm = parseFloat(localStorage.getItem('vision-therapy-cc-pxpermm'));
    
    if (!ccPxPerMm || isNaN(ccPxPerMm) || ccPxPerMm <= 0) {
      console.warn("Chưa có dữ liệu hiệu chuẩn từ localStorage (ccPxPerMm).");
      // Hiển thị thông báo yêu cầu hiệu chuẩn
      this._showCalibrationWarning();
      return;
    }

    const arcsec = this.arcsecSteps[this.currentStep];
    const dpr = window.devicePixelRatio || 1;
    
    // Khoảng cách lâm sàng mặc định: 3 mét
    const distanceM = 3.0;

    // Toán học quang học: Arcsec -> mm -> Pixel
    const radians = (arcsec / 3600.0) * (Math.PI / 180.0);
    const distanceMm = distanceM * 1000.0;
    const disparityMm = Math.tan(radians) * distanceMm;
    const disparityPx = disparityMm * ccPxPerMm * dpr;

    // Tính toán kích thước hạt nhiễu động dựa trên góc thị giác 4 arcminutes
    const dotRadians = (4.0 / 60.0) * (Math.PI / 180.0); // 4 arcminutes to radians
    const dotSizeMm = Math.tan(dotRadians) * distanceMm;
    let dotSizePx = dotSizeMm * ccPxPerMm * dpr;
    // Đảm bảo dotSizePx tối thiểu bằng 1.0
    dotSizePx = Math.max(dotSizePx, 1.0);

    gl.uniform2f(this.uLocs.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uLocs.disparityPx, disparityPx);
    gl.uniform1f(this.uLocs.dotSize, dotSizePx);
    gl.uniform1i(this.uLocs.shape, this.shapeType);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this._updateHUD(arcsec, disparityPx);
  }

  _showCalibrationWarning() {
    const hud = document.getElementById('stereo-hud');
    if (hud) {
      hud.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; color: #d32f2f;">⚠️ Cần hiệu chuẩn màn hình</div>
        <div style="font-size: 14px; margin-top: 8px; color: #555;">
          Module Stereo Anaglyph yêu cầu dữ liệu hiệu chuẩn để tính toán chính xác.<br><br>
          Vui lòng thực hiện hiệu chuẩn màn hình trước khi sử dụng:
          <ul style="margin-top: 8px; padding-left: 20px;">
            <li>Sử dụng thẻ tín dụng (85.6mm)</li>
            <li>Hoặc nhập kích thước màn hình</li>
          </ul>
          <button id="goto-calibration-btn" style="
            margin-top: 16px;
            padding: 10px 20px;
            font-size: 14px;
            font-weight: 600;
            color: white;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
          " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.3)'"
             onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.2)'">
            🔧 Đi đến trang Hiệu chuẩn ngay
          </button>
        </div>
      `;
      
      // Attach event listener to the calibration button
      const calibBtn = document.getElementById('goto-calibration-btn');
      if (calibBtn) {
        calibBtn.addEventListener('click', () => {
          // Use the globally exposed CreditCardCalibrator instance
          if (window.__ccCal && typeof window.__ccCal.showModal === 'function') {
            window.__ccCal.showModal();
          } else {
            console.warn('CreditCardCalibrator not available. Falling back to DisplayCalibrator.');
            if (window.__calibrator && typeof window.__calibrator.showModal === 'function') {
              window.__calibrator.showModal();
            }
          }
        });
      }
    }
  }

  _updateHUD(arcsec, px) {
    const hud = document.getElementById('stereo-hud');
    if (hud) {
      const shapeNames = {1: 'Tròn', 2: 'Vuông', 3: 'Tam giác'};
      hud.innerHTML = `
        <div style="font-size: 20px; font-weight: bold; color: #333;">Độ phân giải nổi khối: <span style="color: #0056b3;">${arcsec} arcsec</span></div>
        <div style="font-size: 14px; margin-top: 6px; color: #555;">Hình mục tiêu hiện tại: <strong>${shapeNames[this.shapeType]}</strong></div>
        <div style="font-size: 12px; margin-top: 2px; color: #888;">Độ lệch vi thể: ${px.toFixed(2)} px</div>
      `;
    }
  }

  _onKeydown(e) {
    if (e.target.tagName === 'INPUT') return;
    let updated = false;

    switch (e.key) {
      case 'ArrowUp': // Tăng độ khó (Giảm arcsec)
        if (this.currentStep < this.arcsecSteps.length - 1) { this.currentStep++; updated = true; }
        break;
      case 'ArrowDown': // Giảm độ khó (Tăng arcsec)
        if (this.currentStep > 0) { this.currentStep--; updated = true; }
        break;
      case 'ArrowLeft':
      case 'ArrowRight': // Thay đổi hình khối (Khám ép buộc lựa chọn - Forced Choice)
        this.shapeType = this.shapeType >= 3 ? 1 : this.shapeType + 1;
        updated = true;
        break;
    }
    
    if (updated) {
      e.preventDefault();
      requestAnimationFrame(() => this.renderFrame());
    }
  }
}

const stereoModule = {
  id: 'binocular-stereo',
  label: 'Stereo Random-Dot',
  _renderer: null,
  
  // Steps array for compatibility with main.js module system
  // Each step represents a different stereo acuity level
  steps: [400, 200, 100, 50, 40, 20],

  render(idx) {
    const board = document.getElementById('display-board');
    if (!board) return;

    // Nếu renderer đã tồn tại, chỉ cần cập nhật step và render lại
    if (this._renderer && this._renderer.gl) {
      if (typeof idx === 'number' && idx >= 0 && idx < this._renderer.arcsecSteps.length) {
        this._renderer.currentStep = idx;
        this._renderer.renderFrame();
      }
      return;
    }

    // Lần đầu tiên render, tạo mới renderer
    board.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%; background: #000;">
        <canvas id="stereo-canvas" style="width: 100%; height: 100%; display: block;"></canvas>
        <div id="stereo-hud" style="position: absolute; top: 20px; left: 20px; background: rgba(255,255,255,0.95); padding: 15px; border-radius: 8px; border: 1px solid #ccc; font-family: sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>
        <div style="position: absolute; bottom: 20px; left: 20px; background: rgba(255,255,255,0.9); padding: 10px; border-radius: 4px; font-family: sans-serif; font-size: 13px; color: #333;">
          <strong>Chỉ định Lâm sàng:</strong> Yêu cầu bệnh nhân đeo kính Đỏ/Xanh (Đỏ mắt phải/trái tùy kính).<br><br>
          <strong>Điều khiển:</strong><br>
          - <strong>[Mũi tên Lên/Xuống]:</strong> Thay đổi ngưỡng Stereo (arcsec)<br>
          - <strong>[Mũi tên Trái/Phải]:</strong> Đổi hình khối (Tròn, Vuông, Tam giác) để đối chiếu kết quả.
        </div>
      </div>
    `;

    const canvas = board.querySelector('#stereo-canvas');
    this._renderer = new StereoRenderer(canvas);
    
    // Thiết lập mức stereo ban đầu từ idx nếu cần
    if (typeof idx === 'number' && idx >= 0 && idx < this._renderer.arcsecSteps.length) {
      this._renderer.currentStep = idx;
    }
    
    this._renderer.start();
  },

  cleanup() {
    if (this._renderer) {
      this._renderer.stop();
      // Quản lý bộ nhớ VRAM chặt chẽ với null checks
      const gl = this._renderer.gl;
      if (gl) {
        // Kiểm tra program tồn tại trước khi detach shaders
        if (this._renderer.program) {
          if (this._renderer.vs) {
            gl.detachShader(this._renderer.program, this._renderer.vs);
            gl.deleteShader(this._renderer.vs);
          }
          if (this._renderer.fs) {
            gl.detachShader(this._renderer.program, this._renderer.fs);
            gl.deleteShader(this._renderer.fs);
          }
          gl.deleteProgram(this._renderer.program);
        }
        // Kiểm tra buffer tồn tại trước khi xóa
        if (this._renderer.posBuffer) {
          gl.deleteBuffer(this._renderer.posBuffer);
        }
      }
      this._renderer = null;
    }
  }
};

export default stereoModule;
export { stereoModule };
