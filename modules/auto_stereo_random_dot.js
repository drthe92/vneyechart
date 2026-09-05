/**
 * auto_stereo_random_dot.js
 * =====================================================
 * Auto Stereo Random Dot (Anaglyph) — Đo ngưỡng thị giác hình nổi tự động (40cm).
 *
 * - RDS (Canvas 2D): nhiễu ngẫu nhiên, hình mục tiêu ẩn giữa các chấm.
 * - Đảo ngược kênh màu: MẮT PHẢI (OD) = Kính ĐỎ, MẮT TRÁI (OS) = Kính XANH.
 * - Hybrid Staircase đảo ngược theo ARCSEC_STEPS, Bức tường 3 lỗi.
 * - Click trúng hình trong 15 giây = Đúng, ngược lại (trượt / hết giờ) = Sai.
 */

// ================================================================
//  Constants
// ================================================================

const MODULE_ID = 'binocular-auto-stereo-random-dot';
const ARCSEC_STEPS = [800, 600, 400, 200, 100, 60, 40];
const NEAR_DISTANCE_M = 0.4;
const RESPONSE_TIMEOUT_MS = 15000;
const HIT_RADIUS_PX = 100;

const SHAPES = [
  { name: 'Tròn', draw: (x, y, cx, cy, r) => {
      const dx = x - cx, dy = y - cy;
      return (dx * dx + dy * dy) <= r * r;
    } },
  { name: 'Vuông', draw: (x, y, cx, cy, r) => {
      return Math.abs(x - cx) <= r && Math.abs(y - cy) <= r;
    } },
  { name: 'Tam giác', draw: (x, y, cx, cy, r) => {
      const ax = cx, ay = cy - r;
      const bx = cx - r * 0.9, by = cy + r * 0.7;
      const dx = cx + r * 0.9, dy = cy + r * 0.7;
      const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
      const d2 = (x - dx) * (by - dy) - (bx - dx) * (y - dy);
      const d3 = (x - ax) * (dy - ay) - (dx - ax) * (y - ay);
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
      return !(hasNeg && hasPos);
    } },
];

// ================================================================
//  Helpers
// ================================================================

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cellHash(gx, gy) {
  let n = (gx * 374761393 + gy * 668265263) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  n = (n ^ (n >>> 16)) >>> 0;
  return (n % 1000) / 1000 > 0.5 ? 1 : 0;
}

// Noise liên tục (bilinear) — giữ độ lệch dưới mức 1 cell (sub-pixel)
function sampleNoise(gx, gy) {
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = gx - x0, fy = gy - y0;
  const v00 = cellHash(x0, y0), v10 = cellHash(x0 + 1, y0);
  const v01 = cellHash(x0, y0 + 1), v11 = cellHash(x0 + 1, y0 + 1);
  const v0 = v00 + (v10 - v00) * fx;
  const v1 = v01 + (v11 - v01) * fx;
  return v0 + (v1 - v0) * fy;
}

// ================================================================
//  Hướng dẫn bằng âm thanh (Tiếng Việt)
// ================================================================

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[Speak] Lỗi phát âm thanh:', err);
  }
}

// ================================================================
//  Module
// ================================================================

const autoStereoRandomDotModule = {
  id: MODULE_ID,
  label: 'Auto Stereo Random Dot',
  customControls: true,
  steps: ['test'],

  // ----- Trạng thái -----
  _state: 'intro',
  _currentIndex: 0,
  _mistakesMap: {},           // { 0: 1, 2: 3, ... }
  _shapeType: 0,
  _cx: 0,
  _cy: 0,
  _timer: null,
  _lastTouchAt: 0,
  _boundClick: null,
  _boundTouchEnd: null,
  _resultText: null,

  render(_idx) {
    this._state = 'intro';
    this._currentIndex = 0;
    this._mistakesMap = {};
    this._resultText = null;
    this._renderIntro();
  },

  cleanup() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    const canvas = document.getElementById('auto-stereo-canvas');
    if (canvas) {
      if (this._boundClick) canvas.removeEventListener('click', this._boundClick);
      if (this._boundTouchEnd) canvas.removeEventListener('touchend', this._boundTouchEnd);
    }
    this._boundClick = null;
    this._boundTouchEnd = null;
  },

  _renderIntro() {
    const board = document.getElementById('display-board');
    if (!board) return;

    board.innerHTML = `
      <div class="bcva-intro" style="display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; height:100%; padding:32px; box-sizing:border-box;">
        <h1 style="margin:0 0 8px; font-size:1.6em; color:#111;">🔬 Auto Stereo Random Dot (40cm)</h1>
        <p style="max-width:640px; margin:4px 0; color:#333; line-height:1.7;">
          Bài test 2 mắt đánh giá thị giác hình nổi. Yêu cầu <strong>MẮT PHẢI đeo kính ĐỎ</strong>,
          <strong>MẮT TRÁI đeo kính XANH</strong>. Vui lòng tinh chỉnh kính lọc màu trên thanh Top Menu
          (Settings) trước khi khám.
        </p>
        <button id="bcva-start-btn" style="margin-top:24px; padding:12px 36px; font-size:1.05em; cursor:pointer; border:none; border-radius:8px; background:#0056b3; color:#fff;">
          ▶ Bắt đầu
        </button>
      </div>
    `;
    const btn = board.querySelector('#bcva-start-btn');
    if (btn) btn.addEventListener('click', () => this._startTest());

    // Đọc hướng dẫn đeo kính bằng giọng nói tiếng Việt
    speak('Vui lòng đeo kính đỏ cho mắt phải, kính xanh cho mắt trái. Sau đó nhấn bắt đầu.');
  },

  _startTest() {
    this._currentIndex = 0;
    this._mistakesMap = {};
    this._state = 'test';
    this._nextTrial();
  },

  _nextTrial() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._randomizeTarget();
    this._renderTrial();
  },

  _randomizeTarget() {
    const board = document.getElementById('display-board');
    let maxW = 800, maxH = 600;
    if (board) {
      const rect = board.getBoundingClientRect();
      maxW = Math.max(rect.width, 200);
      maxH = Math.max(rect.height, 200);
    }
    const margin = HIT_RADIUS_PX + 20;
    const shapes = shuffle([0, 1, 2]);
    this._shapeType = shapes[0];
    this._cx = margin + Math.random() * Math.max(1, maxW - margin * 2);
    this._cy = margin + Math.random() * Math.max(1, maxH - margin * 2);
  },

  _renderTrial() {
    const board = document.getElementById('display-board');
    if (!board) return;

    const arcsec = ARCSEC_STEPS[this._currentIndex];
    const shapeName = SHAPES[this._shapeType].name;
    const wrongCount = this._mistakesMap[this._currentIndex] || 0;

    board.innerHTML = `
      <div style="position:relative; width:100%; height:100%; background:#FFFFFF;">
        <canvas id="auto-stereo-canvas" style="width:100%; height:100%; display:block; cursor:pointer;"></canvas>
        <div style="position:absolute; top:16px; left:16px; background:rgba(255,255,255,.92); padding:10px 14px; border-radius:8px; border:1px solid #ddd; font-size:0.9em; color:#333;">
          <strong>Mức hiện tại:</strong> <span style="color:#0056b3;">${arcsec} arcsec</span><br>
          <strong>Hình:</strong> ${shapeName} &nbsp;|&nbsp; <strong>Sai tại mức này:</strong> ${wrongCount}/3
        </div>
        <div style="position:absolute; bottom:16px; left:50%; transform:translateX(-50%); background:rgba(255,255,255,.92); padding:8px 16px; border-radius:8px; border:1px solid #ddd; font-size:0.85em; color:#555; white-space:nowrap;">
          Click vào hình nổi trong <strong>15 giây</strong> — Mắt phải: kính ĐỎ · Mắt trái: kính XANH
        </div>
      </div>
    `;

    const canvas = board.querySelector('#auto-stereo-canvas');
    if (!canvas) return;

    // Hiển thị text loading tạm thời — tránh block UI
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#666';
    ctx.font = '20px Arial';
    ctx.fillText('Đang tạo hình nổi...', 20, 40);

    setTimeout(() => {
      this._renderRDS(canvas);
    }, 15);

    this._boundClick = (e) => this._onCanvasClick(e);
    this._boundTouchEnd = (e) => this._onCanvasTouchEnd(e);
    canvas.addEventListener('click', this._boundClick);
    canvas.addEventListener('touchend', this._boundTouchEnd);

    // BẮT BUỘC clearTimeout trước khi đặt timer mới
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      this._handleResponse(false);
    }, RESPONSE_TIMEOUT_MS);
  },

  _renderRDS(canvas) {
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width));
    canvas.height = Math.max(1, Math.round(rect.height));

    // PPI ưu tiên từ Credit-card calibration
    let ppi = 96;
    const ccPxPerMm = parseFloat(localStorage.getItem('vision-therapy-cc-pxpermm'));
    if (!isNaN(ccPxPerMm) && ccPxPerMm > 0) {
      ppi = ccPxPerMm * 25.4;
    } else if (window.__calibrator && window.__calibrator.ppi > 0) {
      ppi = window.__calibrator.ppi;
    }

    // Độ lệch pixel: Δx = (arcsec/3600) × (π/180) × (0.4×1000) × (ppi/25.4)
    const arcsec = ARCSEC_STEPS[this._currentIndex];
    const deltaXPx = (arcsec / 3600) * (Math.PI / 180) * (NEAR_DISTANCE_M * 1000) * (ppi / 25.4);

    // Kích thước hạt nhiễu: 4 arcmin tại 40cm
    const cellPx = Math.max(1.5, (4 / 60) * (Math.PI / 180) * (NEAR_DISTANCE_M * 1000) * (ppi / 25.4));
    const halfShiftCells = (deltaXPx / 2) / cellPx;

    const cols = Math.ceil(canvas.width / cellPx);
    const rows = Math.ceil(canvas.height / cellPx);
    const shape = SHAPES[this._shapeType].draw;

    // Bộ đệm ImageData — nền trắng, Alpha = 255
    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;
    data.fill(255);

    // Bounding Box: chỉ dò hình trong vùng bán kính (+ độ lệch 2 bên)
    const minX = this._cx - HIT_RADIUS_PX - deltaXPx;
    const maxX = this._cx + HIT_RADIUS_PX + deltaXPx;
    const minY = this._cy - HIT_RADIUS_PX;
    const maxY = this._cy + HIT_RADIUS_PX;

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const x = gx * cellPx + cellPx / 2;
        const y = gy * cellPx + cellPx / 2;

        // 1. Kiểm tra Bounding Box trước khi tính toán Shape
        // OD (Mắt phải - kính ĐỎ): vẽ bằng mực CYAN (giảm Red).
        // Hướng nổi ra ngoài (Crossed): OD dò điểm chạm ảnh dịch PHẢI (+).
        const inBoundsOD = (x + deltaXPx / 2 >= minX && x + deltaXPx / 2 <= maxX && y >= minY && y <= maxY);
        const hitOD = inBoundsOD ? shape(x + deltaXPx / 2, y, this._cx, this._cy, HIT_RADIUS_PX) : false;
        const odVal = sampleNoise(hitOD ? gx + halfShiftCells : gx, gy);

        // OS (Mắt trái - kính XANH): vẽ bằng mực ĐỎ (giảm Green, Blue).
        // Hướng nổi ra ngoài (Crossed): OS dò điểm chạm ảnh dịch TRÁI (-).
        const inBoundsOS = (x - deltaXPx / 2 >= minX && x - deltaXPx / 2 <= maxX && y >= minY && y <= maxY);
        const hitOS = inBoundsOS ? shape(x - deltaXPx / 2, y, this._cx, this._cy, HIT_RADIUS_PX) : false;
        const osVal = sampleNoise(hitOS ? gx - halfShiftCells : gx, gy);

        if (odVal < 0.05 && osVal < 0.05) continue;

        // 2. Tính toán pixel vùng hiển thị
        const pxStart = Math.floor(gx * cellPx);
        const pyStart = Math.floor(gy * cellPx);
        const pxEnd = Math.min(canvas.width, Math.ceil((gx + 1) * cellPx));
        const pyEnd = Math.min(canvas.height, Math.ceil((gy + 1) * cellPx));

        // 3. Giả lập Multiply Blending trực tiếp trên kênh RGB
        // OD (Mực Cyan): Giảm Red. OS (Mực Red): Giảm Green, Blue.
        const r = Math.max(0, Math.min(255, Math.round(255 * (1 - odVal))));
        const gb = Math.max(0, Math.min(255, Math.round(255 * (1 - osVal))));

        // 4. Ghi trực tiếp vào mảng 1D (Cực nhanh)
        for (let py = pyStart; py < pyEnd; py++) {
          for (let px = pxStart; px < pxEnd; px++) {
            const idx = (py * canvas.width + px) * 4;
            // data[idx + 3] (Alpha) đã là 255
            data[idx] = Math.min(data[idx], r);         // R
            data[idx + 1] = Math.min(data[idx + 1], gb); // G
            data[idx + 2] = Math.min(data[idx + 2], gb); // B
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  },

  _getPointerPos(e) {
    const canvas = document.getElementById('auto-stereo-canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  },

  _onCanvasClick(e) {
    // Tránh double-fire click sau touchend
    if (Date.now() - this._lastTouchAt < 500) return;
    this._handlePointer(e);
  },

  _onCanvasTouchEnd(e) {
    this._lastTouchAt = Date.now();
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    this._handlePointer({ clientX: touch.clientX, clientY: touch.clientY });
  },

  _handlePointer(e) {
    if (this._state !== 'test') return;
    const pos = this._getPointerPos(e);
    if (!pos) return;

    const shape = SHAPES[this._shapeType].draw;
    const hit = shape(pos.x, pos.y, this._cx, this._cy, HIT_RADIUS_PX);
    this._handleResponse(hit);
  },

  _handleResponse(correct) {
    if (this._state !== 'test') return;

    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }

    const idx = this._currentIndex;

    if (correct) {
      // Đạt mức khó nhất (40 arcsec) → hoàn thành
      if (idx >= ARCSEC_STEPS.length - 1) {
        this._finishTest();
        return;
      }
      this._currentIndex++;
    } else {
      // BỨC TƯỜNG 3 LỖI tại cùng một mức
      this._mistakesMap[idx] = (this._mistakesMap[idx] || 0) + 1;
      if (this._mistakesMap[idx] >= 3) {
        this._finishTest();
        return;
      }
      if (idx > 0) this._currentIndex--;
    }

    this._nextTrial();
  },

  _finishTest() {
    this._state = 'done';
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this.cleanup();

    const idx = this._currentIndex;
    if (idx === 0) {
      this._resultText = 'Không đạt (Trượt 800 arcsec)';
    } else {
      this._resultText = `Có (${ARCSEC_STEPS[idx]} giây cung)`;
    }

    const payload = {
      test_type: 'Auto Stereo Random Dot',
      is_manual_entry: false,
      clinical_metrics: {
        'Stereo (Hình nổi)': this._resultText
      }
    };

    document.dispatchEvent(new CustomEvent('visionTestCompleted', { detail: payload, bubbles: true }));

    const board = document.getElementById('display-board');
    if (!board) return;
    board.innerHTML = `
      <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;text-align:center;">
        <h2 style="color:#111;">✅ Hoàn thành bài test</h2>
        <p><strong>Stereo (Hình nổi):</strong> ${this._resultText}</p>
      </div>
    `;
  },
};

export default autoStereoRandomDotModule;
export { autoStereoRandomDotModule };