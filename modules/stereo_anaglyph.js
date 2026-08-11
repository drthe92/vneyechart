/**
 * stereo_anaglyph.js — Stereo Random-Dot Test (Anaglyph)
 * 
 * Bản chất quang học: Tạo nhiễu RDS tĩnh. Tách kênh Đỏ (Red) và Xanh-Lục (Cyan).
 * Sử dụng thuật toán Subtractive (Nền trắng) với mã màu bù trừ #FF6666 và #66FFFF.
 * Tịnh tiến tọa độ vật lý TRƯỚC khi tạo hạt nhiễu để bảo toàn tương quan không gian.
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

    // Test state management
    this.testMode = false;
    this.testActive = false;
    this.wrongCounts = {}; // Track wrong answers per level
    this.testHistory = []; // Store test results
    this.previousShape = 0; // Track previous shape to avoid repetition
    this.testStartTime = null;
    this.currentLevelWrongCount = 0; // Wrong count at current level
    this.touchStartX = 0;
    this.touchStartY = 0;

    this._initWebGL();
    
    if (!this.program) {
      console.error("Không thể khởi tạo WebGL program.");
      return;
    }
    
    this._boundKeydown = this._onKeydown.bind(this);
    this._boundResize = this._onResize.bind(this);
    this._boundTouchStart = this._onTouchStart.bind(this);
    this._boundTouchEnd = this._onTouchEnd.bind(this);
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

    // Shader Subtractive (Nền trắng) - Đã sửa lỗi viền một mắt (Monocular Cues)
    const fsSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_disparity_px;
      uniform float u_dot_size;
      uniform int u_shape;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) > 0.5 ? 1.0 : 0.0;
      }

      // Đổi hàm inShape để nhận tọa độ pixel vật lý thay vì v_uv
      bool inShape(vec2 px_coord) {
        vec2 p = (px_coord / u_resolution) - 0.5; 
        p.x *= u_resolution.x / u_resolution.y; 
        
        if (u_shape == 1) { return length(p) < 0.25; } 
        else if (u_shape == 2) { return abs(p.x) < 0.2 && abs(p.y) < 0.2; } 
        else if (u_shape == 3) { return (p.y > -0.2) && (p.y < 0.2 - abs(p.x) * 1.732); }
        return false;
      }

      void main() {
        float half_disp = u_disparity_px * 0.5;
        vec2 coord = gl_FragCoord.xy; // Tọa độ pixel thực tế

        // --- MẮT TRÁI (Kính Đỏ, nhìn thấy kênh Cyan #66FFFF) ---
        // Hình khối dịch sang Phải (+half_disp).
        // Ta kiểm tra xem pixel hiện tại có đang nằm đè lên hình khối đã dịch chuyển không
        vec2 coord_L = coord;
        coord_L.x -= half_disp; 
        bool is_shape_L = inShape(coord_L);
        
        // Lấy tọa độ nguồn (Source) và Đóng gói thành Macro-dot
        vec2 src_L = is_shape_L ? coord_L : coord;
        vec2 st_L = floor(src_L / u_dot_size);
        float dot_L = hash(st_L);
        float r_val = mix(1.0, 0.4, dot_L); 

        // --- MẮT PHẢI (Kính Xanh, nhìn thấy kênh Đỏ #FF6666) ---
        // Hình khối dịch sang Trái (-half_disp).
        vec2 coord_R = coord;
        coord_R.x += half_disp;
        bool is_shape_R = inShape(coord_R);
        
        vec2 src_R = is_shape_R ? coord_R : coord;
        vec2 st_R = floor(src_R / u_dot_size);
        float dot_R = hash(st_R);
        float gb_val = mix(1.0, 0.4, dot_R); 

        gl_FragColor = vec4(r_val, gb_val, gb_val, 1.0);
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
    
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('Vertex shader error:', gl.getShaderInfoLog(vs));
      gl.deleteShader(vs);
      return null;
    }
    this.vs = vs;
    
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(fs));
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return null;
    }
    this.fs = fs;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    
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
    this.canvas.addEventListener('touchstart', this._boundTouchStart);
    this.canvas.addEventListener('touchend', this._boundTouchEnd);
    this.renderFrame();
  }

  stop() {
    window.removeEventListener('resize', this._boundResize);
    document.removeEventListener('keydown', this._boundKeydown);
    this.canvas.removeEventListener('touchstart', this._boundTouchStart);
    this.canvas.removeEventListener('touchend', this._boundTouchEnd);
  }

  startTest() {
    this.testMode = true;
    this.testActive = true;
    this.currentStep = 0;
    this.wrongCounts = {};
    this.testHistory = [];
    this.currentLevelWrongCount = 0;
    this.testStartTime = new Date();
    this._randomizeShape();
    this._showInstructionScreen();
  }

  _showInstructionScreen() {
    const board = document.getElementById('display-board');
    if (!board) return;

    board.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%; background: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif;">
        <div style="max-width: 600px; padding: 40px; background: rgba(255,255,255,0.95); border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <h2 style="color: #0056b3; margin-bottom: 20px; text-align: center;">Hướng dẫn bài test Stereo</h2>
          <div style="font-size: 16px; line-height: 1.6; color: #333;">
            <p><strong>Quy trình test:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Bài test bắt đầu ở mức 400 giây cung</li>
              <li>Trẻ quan sát hình nổi và kỹ thuật viên đánh giá câu trả lời</li>
              <li><strong>Trả lời ĐÚNG:</strong> Bấm chuột trái, mũi tên phải, hoặc vuốt màn hình sang trái</li>
              <li><strong>Trả lời SAI:</strong> Bấm chuột phải, mũi tên trái, hoặc vuốt màn hình sang phải</li>
            </ul>
            <p><strong>Luật test:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Trả lời đúng → Giảm mức giây cung, random hình mới</li>
              <li>Trả lời sai → Quay lại mức trước đó (từ mức 200 trở xuống)</li>
              <li>Test kết thúc khi: 2 lần sai cùng mức HOẶC đạt mức 20 giây cung</li>
            </ul>
          </div>
          <button id="start-test-btn" style="
            display: block;
            margin: 30px auto 0;
            padding: 15px 40px;
            font-size: 18px;
            font-weight: 600;
            color: white;
            background: linear-gradient(135deg, #0056b3 0%, #004494 100%);
            border: none;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
          ">
            Bắt đầu bài test
          </button>
        </div>
      </div>
    `;

    const startBtn = document.getElementById('start-test-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this._beginTestRounds();
      });
    }
  }

  _beginTestRounds() {
    this.testActive = true;
    this._renderTestScreen();
  }

  _renderTestScreen() {
    const board = document.getElementById('display-board');
    if (!board) return;

    const arcsec = this.arcsecSteps[this.currentStep];
    const shapeNames = {1: 'Tròn', 2: 'Vuông', 3: 'Tam giác'};

    board.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%; background: #FFFFFF;">
        <canvas id="stereo-canvas" style="width: 100%; height: 100%; display: block;"></canvas>
        <div id="stereo-hud" style="position: absolute; top: 20px; left: 20px; background: rgba(255,255,255,0.95); padding: 15px; border-radius: 8px; border: 1px solid #ccc; font-family: sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="font-size: 20px; font-weight: bold; color: #333;">Mức hiện tại: <span style="color: #0056b3;">${arcsec} arcsec</span></div>
          <div style="font-size: 14px; margin-top: 6px; color: #555;">Hình: <strong>${shapeNames[this.shapeType]}</strong></div>
          <div style="font-size: 12px; margin-top: 2px; color: #888;">Sai tại mức này: ${this.currentLevelWrongCount}/2</div>
        </div>
        <div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(255,255,255,0.95); padding: 15px 25px; border-radius: 8px; font-family: sans-serif; font-size: 14px; color: #333; border: 1px solid #ddd; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <strong>Điều khiển:</strong> ← Trái (Sai) | → Phải (Đúng) | Vuốt màn hình cảm ứng
        </div>
      </div>
    `;

    const canvas = board.querySelector('#stereo-canvas');
    if (canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      this._initWebGL();
      this.start();
    }
  }

  _randomizeShape() {
    const shapes = [1, 2, 3];
    let newShape;
    do {
      newShape = shapes[Math.floor(Math.random() * shapes.length)];
    } while (newShape === this.previousShape && shapes.length > 1);
    this.previousShape = newShape;
    this.shapeType = newShape;
  }

  _handleCorrectAnswer() {
    if (!this.testActive) return;

    const arcsec = this.arcsecSteps[this.currentStep];
    this.testHistory.push({
      level: arcsec,
      shape: this.shapeType,
      result: 'correct',
      timestamp: new Date().toISOString()
    });

    // Move to next level if not at the end
    if (this.currentStep < this.arcsecSteps.length - 1) {
      this.currentStep++;
      this.currentLevelWrongCount = 0;
      this._randomizeShape();
      this._renderTestScreen();
      this.renderFrame();
    } else {
      // Reached 20 arcsec - test complete
      this._completeTest();
    }
  }

  _handleIncorrectAnswer() {
    if (!this.testActive) return;

    const arcsec = this.arcsecSteps[this.currentStep];
    this.testHistory.push({
      level: arcsec,
      shape: this.shapeType,
      result: 'incorrect',
      timestamp: new Date().toISOString()
    });

    this.currentLevelWrongCount++;

    // Check if 2 wrong at same level
    if (this.currentLevelWrongCount >= 2) {
      this._completeTest();
      return;
    }

    // Move to previous level (except for first level 400 arcsec)
    if (this.currentStep > 0) {
      this.currentStep--;
      this._randomizeShape();
    } else {
      // At 400 arcsec, just randomize shape
      this._randomizeShape();
    }
    
    this._renderTestScreen();
    this.renderFrame();
  }

  _completeTest() {
    this.testActive = false;
    const endTime = new Date();
    const duration = (endTime - this.testStartTime) / 1000;

    const results = {
      testDate: this.testStartTime.toISOString(),
      durationSeconds: duration,
      finalLevel: this.arcsecSteps[this.currentStep],
      history: this.testHistory,
      summary: this._generateSummary()
    };

    this._showResultsScreen(results);
  }

  _generateSummary() {
    const correctAnswers = this.testHistory.filter(h => h.result === 'correct').length;
    const incorrectAnswers = this.testHistory.filter(h => h.result === 'incorrect').length;
    const levelsAttempted = [...new Set(this.testHistory.map(h => h.level))];
    
    return {
      totalQuestions: this.testHistory.length,
      correctAnswers,
      incorrectAnswers,
      levelsAttempted: levelsAttempted.length,
      lowestLevelReached: Math.min(...levelsAttempted)
    };
  }

  _showResultsScreen(results) {
    const board = document.getElementById('display-board');
    if (!board) return;

    const jsonData = JSON.stringify(results, null, 2);

    board.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%; background: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif;">
        <div style="max-width: 700px; padding: 40px; background: rgba(255,255,255,0.95); border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <h2 style="color: #0056b3; margin-bottom: 20px; text-align: center;">Kết quả bài test Stereo</h2>
          
          <div style="margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 8px;">
            <p style="font-size: 16px; margin: 10px 0;"><strong>Mức thấp nhất đạt được:</strong> <span style="color: #0056b3; font-size: 20px;">${results.finalLevel} arcsec</span></p>
            <p style="font-size: 16px; margin: 10px 0;"><strong>Tổng số câu hỏi:</strong> ${results.summary.totalQuestions}</p>
            <p style="font-size: 16px; margin: 10px 0;"><strong>Đúng:</strong> <span style="color: green;">${results.summary.correctAnswers}</span> | <strong>Sai:</strong> <span style="color: red;">${results.summary.incorrectAnswers}</span></p>
            <p style="font-size: 16px; margin: 10px 0;"><strong>Thời gian:</strong> ${results.durationSeconds.toFixed(1)} giây</p>
          </div>

          <div style="margin: 20px 0;">
            <button id="download-json-btn" style="
              display: block;
              width: 100%;
              margin: 10px 0;
              padding: 12px;
              font-size: 16px;
              font-weight: 600;
              color: white;
              background: linear-gradient(135deg, #28a745 0%, #218838 100%);
              border: none;
              border-radius: 6px;
              cursor: pointer;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">
              Tải xuống dữ liệu JSON
            </button>
            <button id="restart-test-btn" style="
              display: block;
              width: 100%;
              margin: 10px 0;
              padding: 12px;
              font-size: 16px;
              font-weight: 600;
              color: white;
              background: linear-gradient(135deg, #0056b3 0%, #004494 100%);
              border: none;
              border-radius: 6px;
              cursor: pointer;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">
              Làm lại bài test
            </button>
          </div>

          <details style="margin-top: 20px;">
            <summary style="cursor: pointer; font-weight: 600; color: #0056b3;">Xem dữ liệu JSON</summary>
            <pre style="margin-top: 10px; padding: 15px; background: #f8f9fa; border-radius: 6px; overflow: auto; max-height: 300px; font-size: 12px;">${jsonData}</pre>
          </details>
        </div>
      </div>
    `;

    const downloadBtn = document.getElementById('download-json-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        this._downloadJSON(results);
      });
    }

    const restartBtn = document.getElementById('restart-test-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        this.startTest();
      });
    }
  }

  _downloadJSON(data) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stereo_test_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  _onTouchStart(e) {
    if (!this.testActive) return;
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  _onTouchEnd(e) {
    if (!this.testActive) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;

    // Minimum swipe distance
    if (Math.abs(deltaX) < 50) return;
    if (Math.abs(deltaY) > 100) return; // Too vertical

    // Right swipe (correct) or left swipe (incorrect)
    if (deltaX > 0) {
      this._handleCorrectAnswer();
    } else {
      this._handleIncorrectAnswer();
    }
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
    
    // Khai thác hệ thống Calibration tập trung thay vì localStorage trực tiếp
    const cal = window.__calibrator;
    if (!cal || cal.pxPerMm <= 0) {
      console.warn("Chưa có dữ liệu hiệu chuẩn PPD.");
      this._showCalibrationWarning();
      return;
    }

    const ccPxPerMm = cal.pxPerMm;
    const distanceM = cal.distanceM > 0 ? cal.distanceM : 3.0; // Dự phòng
    
    const arcsec = this.arcsecSteps[this.currentStep];
    const dpr = window.devicePixelRatio || 1;

    // Tính toán lượng dịch chuyển võng mạc
    const radians = (arcsec / 3600.0) * (Math.PI / 180.0);
    const distanceMm = distanceM * 1000.0;
    const disparityMm = Math.tan(radians) * distanceMm;
    const disparityPx = disparityMm * ccPxPerMm * dpr;

    // Kích thước hạt nhiễu chuẩn hóa theo góc nhìn 4 arcminutes
    const dotRadians = (4.0 / 60.0) * (Math.PI / 180.0);
    const dotSizeMm = Math.tan(dotRadians) * distanceMm;
    let dotSizePx = Math.max(dotSizeMm * ccPxPerMm * dpr, 1.0); // Không cho hạt chìm dưới 1px

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
          Module Stereo Anaglyph yêu cầu dữ liệu PPD (Pixels Per Degree) để tính toán góc lệch vi thể.<br><br>
          <button id="goto-calibration-btn" style="
            margin-top: 16px; padding: 10px 20px; font-size: 14px; font-weight: 600;
            color: white; background: linear-gradient(135deg, #0056b3 0%, #004494 100%);
            border: none; border-radius: 6px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          ">
            🔧 Mở Bảng Hiệu Chuẩn Thẻ Tín Dụng
          </button>
        </div>
      `;
      
      const calibBtn = document.getElementById('goto-calibration-btn');
      if (calibBtn) {
        calibBtn.addEventListener('click', () => {
          if (window.__ccCal && typeof window.__ccCal.showModal === 'function') {
            window.__ccCal.showModal();
          } else if (window.__calibrator && typeof window.__calibrator.showModal === 'function') {
            window.__calibrator.showModal();
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

    // Test mode key handling
    if (this.testActive) {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          this._handleCorrectAnswer();
          return;
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          this._handleIncorrectAnswer();
          return;
      }
    }

    // Manual mode key handling
    let updated = false;
    switch (e.key) {
      case 'ArrowUp':
        if (this.currentStep < this.arcsecSteps.length - 1) { this.currentStep++; updated = true; }
        break;
      case 'ArrowDown':
        if (this.currentStep > 0) { this.currentStep--; updated = true; }
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        this.shapeType = this.shapeType >= 3 ? 1 : this.shapeType + 1;
        updated = true;
        break;
      case 't':
      case 'T':
        if (!this.testActive) {
          e.preventDefault();
          this.startTest();
          return;
        }
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
  
  steps: [400, 200, 100, 50, 40, 20],

  render(idx) {
    const board = document.getElementById('display-board');
    if (!board) return;

    if (this._renderer && this._renderer.gl) {
      if (typeof idx === 'number' && idx >= 0 && idx < this._renderer.arcsecSteps.length) {
        this._renderer.currentStep = idx;
        this._renderer.renderFrame();
      }
      return;
    }

    // Đổi background sang nền Trắng (#FFFFFF) để kích hoạt chuẩn Subtractive
    board.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%; background: #FFFFFF;">
        <canvas id="stereo-canvas" style="width: 100%; height: 100%; display: block;"></canvas>
        <div id="stereo-hud" style="position: absolute; top: 20px; left: 20px; background: rgba(255,255,255,0.95); padding: 15px; border-radius: 8px; border: 1px solid #ccc; font-family: sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>
        <div style="position: absolute; bottom: 20px; left: 20px; background: rgba(255,255,255,0.95); padding: 10px; border-radius: 4px; font-family: sans-serif; font-size: 13px; color: #333; border: 1px solid #ddd;">
          <strong>Chỉ định Lâm sàng:</strong> Yêu cầu bệnh nhân đeo kính Đỏ/Xanh.<br><br>
          <strong>Điều khiển:</strong><br>
          - <strong>[Mũi tên Lên/Xuống]:</strong> Thay đổi ngưỡng Stereo (arcsec)<br>
          - <strong>[Mũi tên Trái/Phải]:</strong> Đổi hình khối (Tròn, Vuông, Tam giác) để đối chiếu kết quả.<br>
          - <strong>[Phím T]:</strong> Bắt đầu bài test tự động.
        </div>
        <button id="start-stereo-test-btn" style="
          position: absolute;
          top: 20px;
          right: 20px;
          padding: 12px 24px;
          font-size: 16px;
          font-weight: 600;
          color: white;
          background: linear-gradient(135deg, #0056b3 0%, #004494 100%);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        ">
          🎯 Bắt đầu Test Tự động
        </button>
      </div>
    `;

    const canvas = board.querySelector('#stereo-canvas');
    this._renderer = new StereoRenderer(canvas);
    
    if (typeof idx === 'number' && idx >= 0 && idx < this._renderer.arcsecSteps.length) {
      this._renderer.currentStep = idx;
    }
    
    this._renderer.start();

    // Add test button event listener
    const testBtn = board.querySelector('#start-stereo-test-btn');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        if (this._renderer) {
          this._renderer.startTest();
        }
      });
    }
  },

  cleanup() {
    if (this._renderer) {
      this._renderer.stop();
      const gl = this._renderer.gl;
      if (gl) {
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