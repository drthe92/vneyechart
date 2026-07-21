/**
 * jcc_simulation.js — Jackson Cross Cylinder (JCC) WebGL Simulation
 * ================================================================
 * Module id: 'jcc-simulation'
 * 
 * Mô phỏng Trụ chéo Jackson (JCC) bằng WebGL (Vanilla GLSL)
 * Giả lập độ nhòe loạn thị có hướng (Directional Astigmatic Defocus)
 * Cho phép lật trục thời gian thực với convolution filter dọc theo vector trục.
 */

// ================================================================
// GLSL Shaders
// ================================================================

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_angle;
uniform float u_blur_amount;

varying vec2 v_texCoord;

void main() {
    vec2 texelSize = 1.0 / u_resolution;
    
    // Vector hướng dựa trên góc (đơn vị: radian)
    float cosTheta = cos(u_angle);
    float sinTheta = sin(u_angle);
    
    // Số mẫu convolution (N = 10 để cân bằng hiệu suất và độ mịn)
    const int N = 10;
    vec4 colorSum = vec4(0.0);
    
    // Convolution dọc theo vector (cosTheta, sinTheta)
    for (int i = -N; i <= N; i++) {
        float offset = float(i) * u_blur_amount;
        vec2 offsetVec = vec2(cosTheta * offset, sinTheta * offset) * texelSize;
        vec2 sampleCoord = v_texCoord + offsetVec;
        
        // Clamp tọa độ texture để tránh lỗi sampling
        sampleCoord = clamp(sampleCoord, 0.0, 1.0);
        
        colorSum += texture2D(u_image, sampleCoord);
    }
    
    // Trung bình cộng: 1/(2N+1)
    float divisor = float(2 * N + 1);
    gl_FragColor = colorSum / divisor;
}
`;

// ================================================================
// WebGL Utility Functions
// ================================================================

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

function createTextureFromCanvas(gl, canvas) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    // Upload canvas to texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    
    return texture;
}

// ================================================================
// Optotype Generator for JCC
// ================================================================

function createLandoltCTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Clear with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    
    // Draw Landolt C with gap on the right
    const centerX = size / 2;
    const centerY = size / 2;
    const outerRadius = size * 0.4;
    const innerRadius = size * 0.28;
    const gapAngle = Math.PI / 3; // 60 degree gap
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = (outerRadius - innerRadius);
    ctx.lineCap = 'butt';
    
    // Draw the C shape (gap on the right = -75 to 75 degrees from center right)
    ctx.beginPath();
    ctx.arc(centerX, centerY, (outerRadius + innerRadius) / 2, 
            -gapAngle / 2, 2 * Math.PI - gapAngle / 2, false);
    ctx.stroke();
    
    return canvas;
}

function createAucklandOptotypeTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Clear with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    
    // Draw a simple house shape (Auckland optotype style)
    const centerX = size / 2;
    const centerY = size / 2;
    
    ctx.fillStyle = '#000000';
    
    // House body (square)
    const houseSize = size * 0.5;
    ctx.fillRect(centerX - houseSize/2, centerY - houseSize/4, houseSize, houseSize * 0.75);
    
    // Roof (triangle)
    ctx.beginPath();
    ctx.moveTo(centerX - houseSize/2 - size*0.05, centerY - houseSize/4);
    ctx.lineTo(centerX + houseSize/2 + size*0.05, centerY - houseSize/4);
    ctx.lineTo(centerX, centerY - houseSize/2 - size*0.05);
    ctx.closePath();
    ctx.fill();
    
    return canvas;
}

// ================================================================
// JCC Simulation Module
// ================================================================

const jccSimulationModule = {
    id: 'jcc-simulation',
    label: 'JCC Simulation (Trụ chéo Jackson)',
    
    // State
    _gl: null,
    _program: null,
    _texture: null,
    _canvas: null,
    _animationFrameId: null,
    
    // JCC Parameters
    _baseAxis: 90,        // Trục cơ bản (độ)
    _flipState: 1,        // Trạng thái lật (1 hoặc 2)
    _blurAmount: 0.5,     // Biên độ nhòe (mô phỏng công suất JCC ±0.50D)
    _optotypeType: 'landolt', // Loại thị tiêu
    
    // GLSL uniform locations
    _uAngle: null,
    _uBlurAmount: null,
    _uResolution: null,
    _uImage: null,
    
    // UI Elements
    _infoDiv: null,
    _buttonContainer: null,
    
    render(index) {
        const board = document.getElementById('display-board');
        if (!board) return;
        
        // Clear board
        board.innerHTML = '';
        board.style.background = '#FFFFFF';
        
        // Create WebGL canvas
        this._canvas = document.createElement('canvas');
        this._canvas.id = 'jcc-webgl-canvas';
        this._canvas.style.width = '100%';
        this._canvas.style.height = '60vh';
        this._canvas.style.display = 'block';
        board.appendChild(this._canvas);
        
        // Create info panel
        this._createInfoPanel(board);
        
        // Create control buttons
        this._createControlButtons(board);
        
        // Initialize WebGL
        this._initWebGL();
        
        // Load texture
        this._loadTexture();
        
        // Setup event handlers
        this._setupEventHandlers();
        
        // Start render loop
        this._renderLoop();
    },
    
    _createInfoPanel(board) {
        this._infoDiv = document.createElement('div');
        this._infoDiv.className = 'jcc-info';
        this._infoDiv.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 14px;
            z-index: 100;
            pointer-events: none;
        `;
        board.style.position = 'relative';
        board.appendChild(this._infoDiv);
        this._updateInfo();
    },
    
    _createControlButtons(board) {
        this._buttonContainer = document.createElement('div');
        this._buttonContainer.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
            z-index: 100;
        `;
        
        const buttons = [
            { label: 'Lựa chọn 1 (1)', action: () => this._setFlipState(1) },
            { label: 'Lựa chọn 2 (2)', action: () => this._setFlipState(2) },
            { label: '◀ Xoay trục (-5°)', action: () => this._rotateAxis(-5) },
            { label: 'Xoay trục (+5°) ▶', action: () => this._rotateAxis(5) },
        ];
        
        buttons.forEach(btnInfo => {
            const btn = document.createElement('button');
            btn.textContent = btnInfo.label;
            btn.style.cssText = `
                padding: 10px 20px;
                font-size: 16px;
                cursor: pointer;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 5px;
                transition: background 0.2s;
            `;
            btn.onmouseenter = () => btn.style.background = '#0056b3';
            btn.onmouseleave = () => btn.style.background = '#007bff';
            btn.onclick = btnInfo.action;
            this._buttonContainer.appendChild(btn);
        });
        
        board.appendChild(this._buttonContainer);
    },
    
    _initWebGL() {
        const canvas = this._canvas;
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
            console.error('WebGL not supported');
            return;
        }
        
        this._gl = gl;
        
        // Set canvas size
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        gl.viewport(0, 0, canvas.width, canvas.height);
        
        // Create shaders and program
        const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
        this._program = createProgram(gl, vertexShader, fragmentShader);
        
        if (!this._program) return;
        
        gl.useProgram(this._program);
        
        // Get uniform locations
        this._uAngle = gl.getUniformLocation(this._program, 'u_angle');
        this._uBlurAmount = gl.getUniformLocation(this._program, 'u_blur_amount');
        this._uResolution = gl.getUniformLocation(this._program, 'u_resolution');
        this._uImage = gl.getUniformLocation(this._program, 'u_image');
        
        // Create buffer for fullscreen quad
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1,
        ]), gl.STATIC_DRAW);
        
        const positionLocation = gl.getAttribLocation(this._program, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        
        // Create buffer for texture coordinates
        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0, 0,
            1, 0,
            0, 1,
            1, 1,
        ]), gl.STATIC_DRAW);
        
        const texCoordLocation = gl.getAttribLocation(this._program, 'a_texCoord');
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
    },
    
    _loadTexture() {
        const gl = this._gl;
        if (!gl) return;
        
        // Create optotype texture
        const optotypeCanvas = this._optotypeType === 'auckland' 
            ? createAucklandOptotypeTexture(512)
            : createLandoltCTexture(512);
        
        this._texture = createTextureFromCanvas(gl, optotypeCanvas);
    },
    
    _setupEventHandlers() {
        // Keyboard events
        this._boundKeyDown = this._onKeyDown.bind(this);
        document.addEventListener('keydown', this._boundKeyDown);
    },
    
    _onKeyDown(event) {
        switch(event.key) {
            case '1':
                this._setFlipState(1);
                event.preventDefault();
                break;
            case '2':
                this._setFlipState(2);
                event.preventDefault();
                break;
            case 'ArrowLeft':
                this._rotateAxis(-5);
                event.preventDefault();
                break;
            case 'ArrowRight':
                this._rotateAxis(5);
                event.preventDefault();
                break;
        }
    },
    
    _setFlipState(state) {
        this._flipState = state;
        this._updateInfo();
        // Render loop will pick up the change automatically
    },
    
    _rotateAxis(degrees) {
        this._baseAxis += degrees;
        // Normalize to 0-180 range
        this._baseAxis = ((this._baseAxis % 180) + 180) % 180;
        this._updateInfo();
    },
    
    _getCurrentAngleRad() {
        // Tính góc hiện tại dựa trên trạng thái lật
        // Trạng thái 1: base_axis + 45°
        // Trạng thái 2: base_axis + 135°
        const offset = this._flipState === 1 ? 45 : 135;
        const angleDeg = (this._baseAxis + offset) % 180;
        return angleDeg * Math.PI / 180;
    },
    
    _updateInfo() {
        if (!this._infoDiv) return;
        
        const currentAngle = this._getCurrentAngleRad() * 180 / Math.PI;
        this._infoDiv.innerHTML = `
            <div>Trục cơ bản: <strong>${this._baseAxis.toFixed(0)}°</strong></div>
            <div>Trạng thái: <strong>Lựa chọn ${this._flipState}</strong></div>
            <div>Góc JCC: <strong>${currentAngle.toFixed(1)}°</strong></div>
            <div>Biên độ nhòe: <strong>±${this._blurAmount.toFixed(2)}D</strong></div>
            <hr style="margin: 5px 0; border-color: #555;">
            <div style="font-size: 12px;">Phím: [1][2] Lật | [←][→] Xoay trục</div>
        `;
    },
    
    _renderLoop() {
        const gl = this._gl;
        const canvas = this._canvas;
        
        if (!gl || !canvas) return;
        
        // Update resolution uniform
        gl.uniform2f(this._uResolution, canvas.width, canvas.height);
        
        // Update angle uniform (convert to radians)
        const angleRad = this._getCurrentAngleRad();
        gl.uniform1f(this._uAngle, angleRad);
        
        // Update blur amount
        gl.uniform1f(this._uBlurAmount, this._blurAmount);
        
        // Bind texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.uniform1i(this._uImage, 0);
        
        // Clear and draw
        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        // Continue render loop for real-time updates
        this._animationFrameId = requestAnimationFrame(() => this._renderLoop());
    },
    
    cleanup() {
        // Remove event listeners
        if (this._boundKeyDown) {
            document.removeEventListener('keydown', this._boundKeyDown);
        }
        
        // Stop animation loop
        if (this._animationFrameId) {
            cancelAnimationFrame(this._animationFrameId);
            this._animationFrameId = null;
        }
        
        // Clean up WebGL resources
        const gl = this._gl;
        if (gl) {
            if (this._texture) gl.deleteTexture(this._texture);
            if (this._program) gl.deleteProgram(this._program);
            this._gl = null;
        }
        
        // Clear references
        this._canvas = null;
        this._infoDiv = null;
        this._buttonContainer = null;
    },
};

export default jccSimulationModule;
export { jccSimulationModule };
