/**
 * astigmatism.js — Mặt số đồng hồ loạn thị (Astigmatism Sunburst Dial).
 * * Phiên bản đã hiệu chỉnh chuẩn quang học:
 * - Bề dày vạch tỷ lệ thuận với kích thước Canvas (mô phỏng góc thị giác 20/40 - 20/50).
 * - Tâm rỗng, ngăn ngừa nhòe trung tâm do cầu sai (spherical aberration).
 * - Font chữ số tối ưu hiển thị ở khoảng cách xa.
 */

// ================================================================
//  Constants
// ================================================================

/** Số vạch trên mặt đồng hồ (36 vạch × 10° = 360°). */
const NUM_LINES = 36;
const ANGLE_STEP = 360 / NUM_LINES; 
const NUM_STEPS = 36;
const ROTATION_STEPS = Array.from({ length: NUM_STEPS }, (_, i) => i * ANGLE_STEP);

/** Tỷ lệ bán kính vùng trống ở tâm. Cần đủ lớn để tách biệt các vạch hướng tâm. */
const CENTER_RADIUS_RATIO = 0.08; 

/** Khoảng cách lề cho chữ số (tỷ lệ % so với bán kính). */
const NUMBER_MARGIN_RATIO = 0.12;

/** Tỷ lệ độ dày vạch so với bán kính. Chuẩn ~1.5% - 2.0% để tương đương nét chữ 20/40 ở khoảng cách khám 6m. */
const LINE_WIDTH_RATIO = 0.018; 

// ================================================================
//  Helpers
// ================================================================

/**
 * Vẽ mặt số đồng hồ loạn thị lên canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width     Logical width
 * @param {number} height    Logical height
 * @param {number} dpr       Device pixel ratio
 * @param {number} rotation  Góc xoay (độ)
 */
function drawDial(ctx, width, height, dpr, rotation) {
  const cx = (width * dpr) / 2;
  const cy = (height * dpr) / 2;
  // Bán kính hữu dụng chừa lề
  const radius = Math.min(cx, cy) * 0.95; 
  
  // Tính toán bề dày nét vẽ chuẩn quang học (tỷ lệ với bán kính)
  const lineWidth = Math.max(1, Math.round(radius * LINE_WIDTH_RATIO));

  // ---- Nền trắng (tương phản tối đa) ----
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width * dpr, height * dpr);

  // ---- Vạch lan toả ----
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-cx, -cy);

  // Cấu hình nét vẽ đen, đầu vạch vuông góc (butt) để sắc nét
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'butt';

  const innerR = radius * CENTER_RADIUS_RATIO;
  const outerR = radius * (1 - NUMBER_MARGIN_RATIO - 0.05);

  ctx.beginPath();
  for (let i = 0; i < NUM_LINES; i++) {
    const angle = (i * ANGLE_STEP * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const x1 = cx + innerR * cos;
    const y1 = cy + innerR * sin;
    const x2 = cx + outerR * cos;
    const y2 = cy + outerR * sin;

    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();
  ctx.restore();

  // ---- Vòng tròn trung tâm (đường viền định tâm) ----
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(1, lineWidth * 0.6); // Mảnh hơn vạch chính một chút
  ctx.stroke();

  // ---- Số 1–12 (Không xoay, giữ cố định như mặt đồng hồ) ----
  ctx.fillStyle = '#000000';
  // Đảm bảo font chữ đủ lớn để nhận diện rõ ở xa
  const fontSize = Math.max(14, Math.round(radius * 0.15));
  ctx.font = `bold ${fontSize}px 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const numRadius = radius * (1 - NUMBER_MARGIN_RATIO / 2);

  for (let hour = 1; hour <= 12; hour++) {
    // 12h = -90° (Top), 3h = 0° (Right)
    const angle = ((hour * 30 - 90) * Math.PI) / 180;
    const nx = cx + numRadius * Math.cos(angle);
    const ny = cy + numRadius * Math.sin(angle);
    ctx.fillText(String(hour), nx, ny);
  }
}

// ================================================================
//  Astigmatism Module
// ================================================================

const astigmatism = {
  id: 'astigmatism',
  label: 'Trục loạn thị',
  steps: ROTATION_STEPS,
  _canvas: null,

  render(index) {
    const rotation = ROTATION_STEPS[index];
    const dpr = window.devicePixelRatio || 1;

    const board = document.getElementById('display-board');
    if (!board) return;

    let canvas = this._canvas;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'astig-canvas';
      this._canvas = canvas;
    }

    const rect = board.getBoundingClientRect();
    const logicalW = rect.width;
    const logicalH = rect.height;

    canvas.width = logicalW * dpr;
    canvas.height = logicalH * dpr;
    canvas.style.width = `${logicalW}px`;
    canvas.style.height = `${logicalH}px`;

    board.innerHTML = '';
    board.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    // Disable image smoothing để cạnh sắc nét tối đa
    ctx.imageSmoothingEnabled = false; 
    
    drawDial(ctx, logicalW, logicalH, dpr, rotation);

    const info = document.createElement('div');
    info.className = 'astig-info';
    info.style.position = 'absolute';
    info.style.bottom = '10px';
    info.style.left = '10px';
    info.style.fontFamily = 'sans-serif';
    info.innerHTML = `
      <span style="background: rgba(255,255,255,0.8); padding: 4px 8px; border-radius: 4px;">
        Xoay: <strong>${rotation}°</strong> (${index + 1}/${ROTATION_STEPS.length})
      </span>
    `;
    board.appendChild(info);
  },

  destroy() {
    if (this._canvas) {
      this._canvas.remove();
      this._canvas = null;
    }
  },
};

export default astigmatism;
export { ROTATION_STEPS, astigmatism };