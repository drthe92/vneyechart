/**
 * auckland_logmar.js — Bảng thị lực nhìn xa LogMAR (Auckland Optotypes)
 * ================================================================
 *
 * Sử dụng bộ optotype Auckland (thiết kế "vanishing" bằng nét vẽ mảnh)
 * từ generated/drthe_optotype/Auckland/*.svg
 *
 * Module id: 'far-vision-auckland'
 *
 * CÁCH HIỆN THỊ: mỗi bước (step) chỉ hiển thị MỘT HÀNG NGANG cô lập tại
 * mức LogMAR tương ứng — tương tự như modules/etdrs_chart.js. Điều này
 * khớp với thực tế đo thị lực trên màn hình (bảng LogMAR true-size ở
 * khoảng cách xa thường cao hơn viewport, nên trình bày từng hàng).
 *
 * ----------------------------------------------------------------
 * 1. NGUỒN THÔNG SỐ (từ module Calibration)
 * ----------------------------------------------------------------
 *    - distanceM : khoảng cách khám thực tế (mét)  → window.__calibrator.distanceM
 *    - ppi       : mật độ điểm ảnh vật lý          → window.__calibrator.ppi
 *
 *    Kích thước pixel được tính bởi getOptotypeSize() (js/calibration.js),
 *    hiện thực đúng toán học quang học cốt lõi:
 *      H_0.0(mm)      = distanceM × 1000 × tan(5/60 × π/180)
 *      Pixel_0.0      = H_0.0 / 25.4 × ppi
 *      Pixel_LogMAR   = Pixel_0.0 × 10^LogMAR
 *    (tại LogMAR 0.0 thị tiêu tạo góc thị giác chính xác 5 phút cung).
 *
 * ----------------------------------------------------------------
 * 2. QUY TẮC RENDER (chống làm mờ biên — đặc biệt với Auckland vanishing)
 * ----------------------------------------------------------------
 *    - TUYỆT ĐỐI KHÔNG dùng CSS transform: scale() hay width:% để co giãn
 *      optotype (sẽ kích hoạt anti-aliasing làm mờ biên). Không dùng flex-grow.
 *    - Tính số Pixel TUYỆT ĐỐI (số thực) rồi gán TRỰC TIẾP (inline) vào
 *      thuộc tính width / height của thẻ <svg> chứa optotype Auckland.
 *      Vector được vẽ lại (re-rasterize) đúng kích thước đích → sắc nét.
 *    - Khoảng cách ngang giữa 2 thị tiêu trong hàng = đúng chiều rộng 1 thị tiêu
 *      (gap = pxSize). Hàng được căn giữa; nếu quá rộng sẽ tự giảm số lượng
 *      optotype (chuẩn lâm sàng: hàng lớn thường có ít optotype hơn).
 *    - Tương phản cực đại: nền #FFFFFF, nét vẽ (stroke) optotype = #000000.
 *
 *    LƯU Ý Auckland: bộ này là thiết kế "vanishing" dùng <path> NÉT VẼ
 *    (stroke), KHÔNG dùng fill. Do đó ta GIỮ NGUYÊN thiết kế stroke
 *    (fill="none") và chỉ chuẩn hóa màu nét thành #000000 để vừa bảo toàn
 *    thiết kế mảnh đặc trưng, vừa đạt tương phản tối đa trên nền trắng.
 */

import { getOptotypeSize } from '../js/calibration.js';

// ================================================================
//  Constants
// ================================================================

const AUCKLAND_DIR = 'generated/drthe_optotype/Auckland/';

// 10 hình tượng Auckland (pediatric) — khớp với file trong thư mục
const AUCKLAND_SYMBOLS = [
  'butterfly', 'car', 'duck', 'flower', 'heart',
  'house', 'moon', 'rabbit', 'rocket', 'tree',
];

// Thứ tự hàng từ LỚN (1.0) ở trên xuống NHỎ (-0.3) ở dưới — chuẩn LogMAR
const LOGMAR_LEVELS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2, -0.3];

// Số thị tiêu mục tiêu mỗi hàng (chuẩn ETDRS = 5). Sẽ tự giảm nếu hàng
// quá rộng so với màn hình (hàng lớn thường có ít optotype hơn).
const TARGET_PER_ROW = 5;

// ================================================================
//  Utilities
// ================================================================

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickN(n) {
  return shuffle([...AUCKLAND_SYMBOLS]).slice(0, n);
}

function logmarToSnellen(logmar) {
  return `20/${Math.round(20 * Math.pow(10, logmar))}`;
}

// ================================================================
//  Auckland SVG loader (trích xuất viewBox + path d + stroke-width)
// ================================================================

const _aucklandCache = {};

/**
 * Tải và phân tích một file SVG Auckland.
 * @param {string} name  tên file (không đuôi), vd 'butterfly'
 * @returns {Promise<{viewBox:string, d:string, strokeWidth:number}>}
 */
async function loadAuckland(name) {
  if (_aucklandCache[name]) return _aucklandCache[name];

  const res = await fetch(`${AUCKLAND_DIR}${name}.svg`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${name}`);
  const text = await res.text();

  // viewBox (vd "0 0 41.14 41.14")
  const vbMatch = text.match(/viewBox="([^"]+)"/i);
  const viewBox = vbMatch ? vbMatch[1] : '0 0 41.14 41.14';

  // path d (bất kể thứ tự attribute)
  const dMatch = text.match(/<path\b[^>]*\bd="([^"]*)"[^>]*>/i);
  const d = dMatch ? dMatch[1] : '';

  // stroke-width (đơn vị user-space của viewBox, vd 5px)
  const swMatch = text.match(/stroke-width:\s*([\d.]+)px/i);
  const strokeWidth = swMatch ? parseFloat(swMatch[1]) : 5;

  const data = { viewBox, d, strokeWidth };
  _aucklandCache[name] = data;
  return data;
}

// ================================================================
//  Module
// ================================================================

const aucklandLogmar = {
  id: 'far-vision-auckland',
  label: 'LogMAR (Auckland)',
  steps: LOGMAR_LEVELS,

  /**
   * Render MỘT hàng ngang cô lập tại mức LogMAR LOGMAR_LEVELS[index].
   * Tương tự modules/etdrs_chart.js: căn giữa, gap = chiều rộng optotype,
   * tự giảm số lượng nếu hàng vượt ngang màn hình.
   *
   * @param {number} index  chỉ số trong LOGMAR_LEVELS
   */
  async render(index) {
    const logmar = LOGMAR_LEVELS[index];

    // --- 1. Lấy thông số Calibration ---
    let calib = null;
    const cal = window.__calibrator;
    if (cal && cal.ppi > 0) {
      calib = { distanceM: cal.distanceM, ppi: cal.ppi };
    }

    // Kích thước pixel TUYỆT ĐỐI của optotype tại mức LogMAR này
    const pxSize = getOptotypeSize(logmar, calib);

    // Khoảng cách ngang giữa 2 thị tiêu = đúng chiều rộng 1 thị tiêu
    const gap = pxSize;

    // --- 2. Chọn hình tượng ngẫu nhiên cho hàng ---
    const symbols = pickN(TARGET_PER_ROW);
    const needed = [...new Set(symbols)];
    await Promise.all(needed.map(loadAuckland));

    const snellenDenom = Math.round(20 * Math.pow(10, logmar));
    const decimalAcuity = Math.pow(10, -logmar);

    const board = document.getElementById('display-board');
    if (!board) return;

    // Nền trắng; trả board về chế độ flex căn giữa mặc định (như etdrs)
    board.style.background = '#FFFFFF';
    board.style.display = 'flex';
    board.style.position = '';
    board.style.overflow = '';

    // --- 3. Hàm build hàng với n optotype đầu tiên ---
    const buildRow = (n) => {
      const row = [];
      row.push(
        `<div style="display:flex;flex-direction:row;flex-wrap:nowrap;` +
        `justify-content:center;align-items:center;gap:${gap}px;width:100%;` +
        `max-width:100%;overflow:hidden;box-sizing:border-box;">`
      );
      symbols.slice(0, n).forEach((name) => {
        const a = _aucklandCache[name];
        if (!a || !a.d) return;
        // SVG có width/height pixel TUYỆT ĐỐI (không transform scale / width:%)
        // stroke #000000 + fill none: giữ thiết kế vanishing, tương phản cực đại.
        row.push(
          `<svg viewBox="${a.viewBox}" width="${pxSize}" height="${pxSize}" ` +
          `xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">` +
            `<path d="${a.d}" fill="none" stroke="#000000" ` +
            `stroke-width="${a.strokeWidth}" stroke-linejoin="round" ` +
            `stroke-linecap="round" stroke-miterlimit="10"/>` +
          `</svg>`
        );
      });
      row.push('</div>');
      return row.join('');
    };

    const infoPanel = `
      <div style="position:absolute;bottom:30px;right:30px;font-family:'Segoe UI',system-ui,sans-serif;color:#333;font-size:1.2rem;background:rgba(255,255,255,0.95);padding:20px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);border:1px solid #e0e0e0;backdrop-filter:blur(4px);">
        <div style="font-weight:700;margin-bottom:12px;font-size:1rem;color:#666;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #eee;padding-bottom:8px;">Kết quả thị lực</div>
        <div style="display:grid;grid-template-columns:120px auto;gap:10px 16px;align-items:center;">
          <span style="color:#666;">LogMAR:</span> <strong style="font-size:1.4rem;color:#000;">${logmar.toFixed(1)}</strong>
          <span style="color:#666;">Snellen (ft):</span> <strong style="font-size:1.4rem;color:#0056b3;">20/${snellenDenom}</strong>
          <span style="color:#666;">Hệ thập phân:</span> <strong style="font-size:1.4rem;color:#28a745;">${decimalAcuity.toFixed(2)}</strong>
        </div>
      </div>`;

    // --- 4. Chèn hàng đủ TARGET_PER_ROW để đo chiều rộng thực tế ---
    if (board) {
      board.innerHTML = buildRow(symbols.length) + infoPanel;

      // Đo: nếu hàng nhảy sang tràn ngang (tổng > clientWidth) thì cắt bớt
      const rowEl = board.querySelector('div');
      const avail = board.clientWidth;
      let n = symbols.length;
      // tổng chiều rộng = n*pxSize + (n-1)*gap  (gap = pxSize)
      while (n > 1 && (n * pxSize + (n - 1) * gap) > avail) {
        n--;
      }
      // Nếu cần ít hơn số lượng hiện tại, build lại hàng
      if (n < symbols.length) {
        board.innerHTML = buildRow(n) + infoPanel;
      }
    }
  },

  /** Đổi hình tượng ngẫu nhiên, giữ nguyên LogMAR hiện tại. */
  async randomize() {
    const idx = window.__state ? window.__state.stepIndex : 0;
    await this.render(idx);
  },

  /** Khôi phục style mặc định của board khi rời module. */
  cleanup() {
    const board = document.getElementById('display-board');
    if (!board) return;
    board.style.display = '';
    board.style.position = '';
    board.style.overflow = '';
    board.style.background = '';
  },
};

export default aucklandLogmar;
export { aucklandLogmar, LOGMAR_LEVELS, AUCKLAND_SYMBOLS };
