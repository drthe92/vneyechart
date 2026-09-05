/**
 * near_npoint.js — Near Vision N-points Reading Chart (40 cm)
 * ===========================================================
 *
 * Module id: 'near-vision-npoint'
 *
 * Đánh giá chức năng đọc cho người lão thị (Presbyopia).
 * Sử dụng phông chữ Times New Roman ở các cỡ N-point khác nhau.
 * Mỗi cấp độ hiển thị một đoạn văn ngắn (20-30 từ) từ kho dữ liệu văn học.
 *
 * Quy đổi kích thước:
 *   1 point = 1/72 inch ≈ 0.3528 mm
 *   Chiều cao vật lý (mm) = N * 0.3528
 *   Pixel = Chiều cao (mm) × (PPI / 25.4)
 */

import { getActiveNearDistanceM } from '../js/calibration.js';

// ================================================================
//  Constants
// ================================================================

/** Cấp độ N-point: [N-value, tên hiển thị, ứng dụng lâm sàng] */
const NPOINT_LEVELS = [
  { n: 18, label: 'N18', desc: 'Nhìn kém sâu',     heightMm: 6.35 },
  { n: 14, label: 'N14', desc: 'Kém',               heightMm: 4.94 },
  { n: 12, label: 'N12', desc: 'Sách trẻ em',       heightMm: 4.23 },
  { n: 10, label: 'N10', desc: 'Báo chí thông thường', heightMm: 3.53 },
  { n:  8, label: 'N8',  desc: 'Sách tra cứu / Hợp đồng', heightMm: 2.82 },
  { n:  6, label: 'N6',  desc: 'Ngưỡng đọc bình thường',  heightMm: 2.12 },
  { n:  5, label: 'N5',  desc: 'Thị lực gần hoàn hảo',    heightMm: 1.76 },
];

/** Khoảng cách tham chiếu của bảng chuẩn (mét) — dùng khi chưa có calibrator */
const REFERENCE_DISTANCE_M = 0.4;

/** Số lượng đoạn văn tối đa lưu trong lịch sử để tránh lặp lại */
const MAX_HISTORY = 10;

// ================================================================
//  Paragraph Database
//  (Các trích đoạn văn học Việt Nam ít phổ biến — 20-30 từ)
// ================================================================

const PARAGRAPHS = [
  // === Thơ cổ Việt Nam ===
  "Bước dần theo ngọn tiểu khê, lòng kìa ba động bóng chiều xa xôi. Non xa tấc đất dễ mười, mấy phen chim nhạn lẻ bạn cuối trời.",
  "Thuyền ai đậu bến sông trăng đó, chở một bầu tình xuống thế gian. Mấy độ thu sang màu áo cũ, đèn khuya le lói bóng chàng say.",
  "Vẳng nghe tiếng ốc xa đưa, nhớ người thương nhớ gió mưa tơi bời. Một gian nhà nhỏ ven đồi, ban ngày cửa đóng ban đêm khóa cài.",
  "Non cao biển rộng mấy trùng, tấm lòng sông núi vẫy vùng đó đây. Trăm năm còn lại dấu này, gửi người tri kỷ đó đây tìm về.",
  "Gió đưa cành liễu lao xao, tiếng chày như tiếng vang vào cõi mơ. Trăng nghiêng bóng xuống mái chùa, chuông huyền vọng mãi không giờ dứt tan.",
  "Nhớ xưa trận mạc chiến trường, gươm đao tung hoành khói sương mịt mù. Nay về mái tóc phong sương, gối tay nằm giữa con đường hư vô.",
  "Mai sau dù có bao giờ, xin còn một đóa hoa đưa muộn phiền. Sông dài sóng vỗ triền miên, tình đời như cánh buồm nghiêng cuối trời.",
  "Rừng thiêng nước độc đường xa, tìm đâu ra một bóng già bên sông? Mấy năm phiêu bạt ngược xuôi, nay về tay trắng nên đời long đong.",
  "Đời người mấy độ thu phong, mái đầu xanh hóa mái hồng bạc phơ. Bạn bè kẻ còn người mất, đàn xưa còn đó lời thơ dại khờ.",

  // === Văn xuôi ít phổ biến ===
  "Ngày xuân dần dần qua đi, những cánh hoa đào lác đác rụng đầy sân. Trên nền gạch cổ rêu phong, một màu xanh non mới đang ửng lên trong nắng sớm.",
  "Bà cụ ngồi lặng lẽ bên khung cửa sổ, tay cầm chiếc áo rách vá đi vá lại. Ngoài kia, cánh đồng lúa thì con gái đang thì thầm trong gió mới.",
  "Con đường đất đỏ chạy dọc theo bờ sông, hai bên là những rặng tre xanh cao vút. Thỉnh thoảng, một chiếc thuyền nan lướt nhẹ trên mặt nước phẳng lì.",
  "Khu vườn nhỏ nằm khuất sau lũy tre làng, nơi đó có một giàn hoa thiên lý già nua. Mỗi khi hè về, hương thơm tỏa ngát khắp xóm thôn yên bình.",
  "Những giọt mưa xuân lất phất bay trong gió nhẹ, vương đầy trên mái tóc người thiếu nữ. Cô khẽ rùng mình, kéo cao chiếc khăn len mỏng rồi lặng lẽ bước đi.",
  "Ánh nắng cuối ngày nhuộm vàng cả một góc trời, mặt sông lấp lánh như dát vàng. Bầy chim vội vã bay về tổ khi hoàng hôn dần buông xuống.",
  "Chiếc cầu gỗ bắc ngang con suối nhỏ đã cũ kỹ lắm rồi, những tấm ván ọp ẹp mỗi khi có người đi qua. Dòng nước vẫn chảy róc rách dưới chân cầu, mải miết và vô tình.",
  "Trong gian bếp nhỏ, bếp lửa bập bùng cháy, tỏa hơi ấm khắp căn nhà lá. Nồi cơm nghi ngút khói thơm mùi lúa mới, hòa quyện với hương khói bếp quen thuộc.",
  "Đêm về khuya, tiếng dế kêu rả rích trong vườn. Ánh trăng lọt qua kẽ lá, vẽ những hình thù kỳ lạ trên nền đất ẩm ướt sương đêm.",

  // === Thơ Đường dịch ===
  "Trước xa non biếc quanh co, sau gần nhà cỏ tiêu sơ mấy nhà. Trên trời cánh hạc lưa thưa, dưới sông sóng vỗ đón đưa thuyền về.",
  "Động đình sóng nước mênh mông, đêm thu trăng sáng như lồng gương trong. Vẳng nghe tiếng hát bên sông, một chòm cây đứng chờ trông cánh buồm.",
  "Đỉnh non mây phủ quanh năm, suối reo róc rách âm thầm đêm ngày. Khách về hái lấy vài cành, tay không mà vẫn nặng đầy ưu tư.",
  "Một mình ngồi giữa núi non, vẳng nghe tiếng suối véo von cuối khe. Trời cao mây trắng lờ mờ, lòng người thanh thản như tờ giấy tiên.",
  "Mai vàng rực rỡ trong sân, gió đưa hương ngát muôn phần tinh khôi. Xuân sang đào mận thay ngôi, chỉ còn hoa cúc giữa trời thu phong.",

  // === Ca dao tục ngữ ===
  "Trong đầm gì đẹp bằng sen, lá xanh bông trắng lại chen nhị vàng. Nhị vàng bông trắng lá xanh, gần bùn mà chẳng hôi tanh mùi bùn.",
  "Trên trời có đám mây vàng, dưới sông có một nàng tay cầm cần câu. Anh đừng nghĩ ngợi thêm sầu, bởi chưng duyên chưa gặp nhau mà thôi.",
  "Trúc xinh trúc mọc sân đình, em xinh em đứng một mình cũng xinh. Trúc xinh trúc mọc bên đình, anh xinh anh đứng một mình cũng xinh.",
  "Công cha như núi Thái Sơn, nghĩa mẹ như nước trong nguồn chảy ra. Một lòng thờ mẹ kính cha, cho tròn chữ hiếu mới là đạo con.",
  "Tay cầm bầu rượu nắng say, chân đi lảo đảo như say vì tình. Ngất ngơ cúc mọc bên đình, vẳng nghe oanh hót một mình bên tai.",
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

/**
 * Lấy PPI từ calibrator.
 * Khoảng cách Nhìn Gần lấy từ helper chung getActiveNearDistanceM()
 * (js/calibration.js) — main.js đã chuyển distanceM theo nhóm test.
 * @returns {{ ppi: number, pxPerMm: number }}
 */
function getCalibration() {
  const calibrator = window.__calibrator;
  if (calibrator && calibrator.ppi > 0) {
    return { ppi: calibrator.ppi, pxPerMm: calibrator.pxPerMm };
  }
  // Dùng CSS pixels — trình duyệt tự ánh xạ sang physical px
  const w = window.screen.width;
  const h = window.screen.height;
  const diagPx = Math.sqrt(w * w + h * h);
  const ppi = diagPx / 24; // giả định 24 inch, số thực
  return { ppi, pxPerMm: ppi / 25.4 };
}

/**
 * Chuyển chiều cao mm → pixels.
 * @param {number} heightMm
 * @param {number} pxPerMm
 * @returns {number}
 */
function mmToPx(heightMm, pxPerMm) {
  return heightMm * pxPerMm;
}

/**
 * Chọn một đoạn văn ngẫu nhiên không trùng lịch sử.
 * @param {number[]} history — mảng index đã dùng
 * @returns {{ text: string, index: number }}
 */
function pickParagraph(history) {
  const available = PARAGRAPHS.map((_, i) => i)
    .filter((i) => !history.includes(i));

  // Nếu hết đoạn mới, reset lịch sử
  const pool = available.length > 0 ? available : PARAGRAPHS.map((_, i) => i);
  const idx = pool[Math.floor(Math.random() * pool.length)];

  return { text: PARAGRAPHS[idx], index: idx };
}

// ================================================================
//  Module Definition
// ================================================================

const nearNpointModule = {
  id: 'near-vision-npoint',
  label: 'N-points 40 cm',
  steps: NPOINT_LEVELS,

  /** Lịch sử các đoạn văn đã dùng (mảng index) */
  _history: [],

  /** Đoạn văn hiện tại */
  _currentText: '',

  /** Index trong PARAGRAPHS của đoạn hiện tại */
  _currentTextIdx: -1,

  /**
   * Render cấp độ N-point hiện tại.
   * @param {number} index
   */
  render(index) {
    const board = document.getElementById('display-board');
    if (!board) return;

    const calib = getCalibration();
    const distanceM = getActiveNearDistanceM();
    const level = NPOINT_LEVELS[index];
    // Chiều cao vật lý scale theo khoảng cách đang active
    const heightMm = level.heightMm * (distanceM / REFERENCE_DISTANCE_M);
    const pxSize = mmToPx(heightMm, calib.pxPerMm);

    // Luôn chọn đoạn văn mới khi chuyển hàng (lên/xuống)
    this._pickNewParagraph();

    // Làm sạch lịch sử
    while (this._history.length > MAX_HISTORY) {
      this._history.shift();
    }

    // Font size: point = mm → inch → point (1pt = 1/72 inch) — chỉ để hiển thị thông tin
    const fontSizePt = Math.round(level.heightMm / 25.4 * 72);
    const distanceCm = (distanceM * 100).toFixed(0);

    const html = `
      <div class="near-npoint-container">
        <div class="near-npoint-text" style="
          font-family: 'Times New Roman', 'Times', serif;
          font-size: ${pxSize}px;
          line-height: 1.8;
          max-width: 90%;
          margin: 0 auto;
          color: #000;
          background: #fff;
          padding: ${pxSize * 0.5}px;
          border-radius: 4px;
          user-select: none;
        ">${this._currentText}</div>

        <div class="near-vision-info">
          <div class="near-vision-info-row">
            <span class="near-vision-info-label">Cỡ chữ</span>
            <strong class="near-vision-info-value">${level.label}</strong>
          </div>
          <div class="near-vision-info-row">
            <span class="near-vision-info-label">Chiều cao</span>
            <strong class="near-vision-info-value">${heightMm.toFixed(2)} mm</strong>
          </div>
          <div class="near-vision-info-row">
            <span class="near-vision-info-label">Font size</span>
            <strong class="near-vision-info-value">${fontSizePt} pt</strong>
          </div>
          <div class="near-vision-info-row">
            <span class="near-vision-info-label">Khoảng cách</span>
            <strong class="near-vision-info-value">${distanceCm} cm</strong>
          </div>
          <div class="near-vision-info-divider"></div>
          <div class="near-vision-info-row">
            <span class="near-vision-info-label">Ứng dụng</span>
            <strong class="near-vision-info-value" style="font-size:0.7rem;">${level.desc}</strong>
          </div>
          <div class="near-vision-info-row">
            <span class="near-vision-info-label">Cấp độ</span>
            <span class="near-vision-info-value">${index + 1}/${NPOINT_LEVELS.length}</span>
          </div>
        </div>

        <div class="near-vision-toolbar">
          <button class="near-vision-toolbar-btn" data-action="shuffle" title="Đổi đoạn văn (Phím cách)">
            🔀 Đổi đoạn
          </button>
        </div>
      </div>
    `;

    board.innerHTML = html;

    // Gắn sự kiện
    this._wireToolbar();
  },

  /**
   * Chọn đoạn văn mới từ kho dữ liệu.
   * @private
   */
  _pickNewParagraph() {
    const result = pickParagraph(this._history);
    this._currentText = result.text;
    this._currentTextIdx = result.index;
    this._history.push(result.index);
  },

  /**
   * Gắn sự kiện toolbar.
   * @private
   */
  _wireToolbar() {
    const board = document.getElementById('display-board');
    if (!board) return;

    board.querySelectorAll('.near-vision-toolbar-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'shuffle') {
          this.randomize();
        }
      });
    });
  },

  /**
   * Đổi đoạn văn ngẫu nhiên (giữ nguyên cấp độ N-point).
   */
  randomize() {
    this._pickNewParagraph();
    const idx = window.__state ? window.__state.stepIndex : 0;
    this.render(idx);
  },

  /**
   * Reset trạng thái.
   */
  reset() {
    this._history = [];
    this._currentText = '';
    this._currentTextIdx = -1;
  },
};

// ================================================================
//  Export
// ================================================================
export default nearNpointModule;
export { nearNpointModule, NPOINT_LEVELS, PARAGRAPHS };