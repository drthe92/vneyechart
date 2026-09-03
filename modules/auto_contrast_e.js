/**
 * auto_contrast_e.js
 * =====================================================
 * Auto Contrast (Tumbling E) — Test đánh giá độ nhạy tương phản tự động (LogCS).
 *
 * Thuật toán: Hybrid Staircase (Bức tường 3 lỗi) — biến thiên theo LogCS
 * - Khó hơn = tăng LogCS (chữ E mờ dần), dễ hơn = giảm LogCS.
 * - Kết thúc:
 *     + Đạt tối đa 1.80 LogCS (đỉnh thang đo).
 *     + Bức tường 3 lỗi: Sai đủ 3 lần tại cùng một mức → chốt mức LogCS trước đó.
 * - Kích thước chữ E cố định (tương đương LogMAR 1.0), chỉ thay đổi độ tương phản.
 * - Weber Contrast: L_target = 255 * (1 - 10^(-LogCS)).
 */

import { getOptotypeSize } from '../js/calibration.js';
import { TUMBLING_E } from './optotype_paths.js';

// ================================================================
//  Constants
// ================================================================

const MODULE_ID = 'retina-auto-contrast-e';
const START_LOGCS = 0.00;
const MIN_LOGCS = 0.00;
const MAX_LOGCS = 1.80;
const STEP = 0.15;

/** Kích thước optotype cố định theo LogMAR 1.0 (vật tiêu lớn) */
const FIXED_LOGMAR_SIZE = 1.0;

const ORIENTATIONS = {
  right: 'ArrowRight',
  left: 'ArrowLeft',
  up: 'ArrowUp',
  down: 'ArrowDown',
};

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

function roundLogCS(v) {
  return Math.round(v * 100) / 100;
}

function rotateE(orientation, fill = '#000000') {
  const angle = { right: 0, left: 180, up: 270, down: 90 }[orientation] || 0;
  return `<g transform="rotate(${angle}, 2.5, 2.5)">${TUMBLING_E.replace('#000000', fill)}</g>`;
}

// ================================================================
//  Module
// ================================================================

const autoContrastEModule = {
  id: MODULE_ID,
  label: 'Auto Contrast E',
  customControls: true,
  steps: ['test'],

  // ----- Trạng thái -----
  _state: 'intro',
  _currentLogCS: START_LOGCS,
  _consecutiveCorrect: 0,
  _firstMistakeMade: false,
  _mistakesMap: {},           // { "0.30": 2, "0.45": 3, ... }
  _hardestCorrectCount: 0,

  _results: { OD: null, OS: null },
  _currentEye: 'OD',
  _boundKeydown: null,

  render(_idx) {
    this._resetStaircase();
    this._state = 'intro';
    this._results = { OD: null, OS: null };
    this._currentEye = 'OD';
    this._bindKeydown();
    this._renderIntro();
  },

  cleanup() {
    if (this._boundKeydown) {
      document.removeEventListener('keydown', this._boundKeydown);
      this._boundKeydown = null;
    }
  },

  _renderIntro() {
    const board = document.getElementById('display-board');
    if (!board) return;

    board.innerHTML = `
      <div class="bcva-intro" style="display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; height:100%; padding:32px; box-sizing:border-box;">
        <h1 style="margin:0 0 8px; font-size:1.6em; color:#111;">🔬 Auto Contrast (Tumbling E)</h1>
        <p style="max-width:720px; margin:4px 0; color:#333; line-height:1.55;">
          Test đánh giá độ nhạy tương phản tự động (LogCS).
        </p>
        <button id="bcva-start-btn" style="margin-top:24px; padding:12px 36px; font-size:1.05em; cursor:pointer; border:none; border-radius:8px; background:#0056b3; color:#fff;">
          ▶ Bắt đầu
        </button>
      </div>
    `;
    const btn = board.querySelector('#bcva-start-btn');
    if (btn) btn.addEventListener('click', () => this._startTest());
  },

  _renderPrepScreen(eye) {
    this._state = eye === 'OD' ? 'prep_od' : 'prep_os';
    const board = document.getElementById('display-board');
    if (!board) return;

    const eyeLabel = eye === 'OD' ? 'Mắt Phải (OD)' : 'Mắt Trái (OS)';
    const message = eye === 'OD' ? 'Vui lòng che mắt Trái. Chuẩn bị đo Mắt Phải (OD).' : 'Vui lòng che mắt Phải. Chuẩn bị đo Mắt Trái (OS).';

    board.innerHTML = `
      <div class="bcva-prep" style="display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; height:100%; padding:32px; box-sizing:border-box;">
        <h1 style="margin:0 0 16px; font-size:1.6em; color:#111;">👁️ ${eyeLabel}</h1>
        <p style="max-width:640px; margin:0 0 24px; font-size:1.2em; color:#333; line-height:1.6;">${message}</p>
        <button id="bcva-prep-start-btn" style="padding:12px 36px; font-size:1.05em; cursor:pointer; border:none; border-radius:8px; background:#0056b3; color:#fff;">
          ▶ Bắt đầu đo
        </button>
      </div>
    `;
    const btn = board.querySelector('#bcva-prep-start-btn');
    if (btn) btn.addEventListener('click', () => this._startTest());
  },

  _resetStaircase() {
    this._currentLogCS = START_LOGCS;
    this._consecutiveCorrect = 0;
    this._firstMistakeMade = false;
    this._mistakesMap = {};
    this._hardestCorrectCount = 0;
  },

  _startTest() {
    this._resetStaircase();
    this._state = this._currentEye === 'OD' ? 'test_od' : 'test_os';
    this._nextTrial();
  },

  _finishCurrentEye() {
    if (this._currentEye === 'OD') {
      this._currentEye = 'OS';
      this._renderPrepScreen('OS');
    } else {
      this._finishTest();
    }
  },

  _finishTest() {
    this._state = 'done';

    function formatLogCS(val) {
      if (val === null || val === undefined) return 'N/A';
      const num = parseFloat(val);
      if (isNaN(num)) return val;
      const percentage = (Math.pow(10, -num) * 100).toFixed(1);
      return `${num.toFixed(2)} LogCS (~ ${percentage}%)`;
    }

    const payload = {
      test_type: 'Auto Contrast E',
      is_manual_entry: false,
      clinical_metrics: {
        'OD (Mắt phải)': formatLogCS(this._results.OD),
        'OS (Mắt trái)': formatLogCS(this._results.OS)
      }
    };

    document.dispatchEvent(new CustomEvent('visionTestCompleted', { detail: payload, bubbles: true }));

    const board = document.getElementById('display-board');
    if (!board) return;
    board.innerHTML = `
      <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;text-align:center;">
        <h2 style="color:#111;">✅ Hoàn thành bài test</h2>
        <p><strong>OD:</strong> ${formatLogCS(this._results.OD)}</p>
        <p><strong>OS:</strong> ${formatLogCS(this._results.OS)}</p>
      </div>
    `;
  },

  _nextTrial() {
    this._orientation = shuffle(Object.keys(ORIENTATIONS))[0];
    this._renderTrial();
  },

  _renderTrial() {
    const board = document.getElementById('display-board');
    if (!board) return;

    let calib = { distanceM: 4, ppi: 96 }; // Fallback mặc định
    if (window.__calibrator) {
      calib.distanceM = 4; // Ép cứng khoảng cách 4 mét
      if (window.__calibrator.ppi > 0) calib.ppi = window.__calibrator.ppi;
    }

    // Ưu tiên tuyệt đối nguồn PPI từ Credit-card calibration
    const ccPxPerMm = parseFloat(localStorage.getItem('vision-therapy-cc-pxpermm'));
    if (!isNaN(ccPxPerMm) && ccPxPerMm > 0) {
      calib.ppi = ccPxPerMm * 25.4;
    }

    // Kích thước cố định (vật tiêu lớn, LogMAR 1.0)
    const fixedPxSize = getOptotypeSize(FIXED_LOGMAR_SIZE, calib);

    // Weber Contrast: L_target = 255 * (1 - 10^(-LogCS))
    const contrast = Math.pow(10, -this._currentLogCS);
    const grayVal = Math.round(255 * (1 - contrast));
    const fillHex = `rgb(${grayVal},${grayVal},${grayVal})`;

    const svg = `
      <svg viewBox="0 0 5 5" width="${fixedPxSize}" height="${fixedPxSize}" xmlns="http://www.w3.org/2000/svg">
        ${rotateE(this._orientation, fillHex)}
      </svg>`;

    board.innerHTML = `
      <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;width:100%;height:100%;">${svg}</div>
      <div style="position:absolute; right:16px; bottom:16px; font-size:0.85em; color:#666; background:rgba(255,255,255,.85); padding:6px 12px; border-radius:6px; border:1px solid #ddd;">
        ${this._currentEye} · LogCS: ${this._currentLogCS.toFixed(2)}
      </div>`;
  },

  _handleResponse(correct) {
    const testState = this._currentEye === 'OD' ? 'test_od' : 'test_os';
    if (this._state !== testState) return;

    const logcsPresented = this._currentLogCS;

    if (correct) {
      // Mức khó nhất (1.80 LogCS): phải trả lời đúng đủ 3 lần mới hoàn thành
      if (logcsPresented === MAX_LOGCS) {
        this._hardestCorrectCount = (this._hardestCorrectCount || 0) + 1;
        if (this._hardestCorrectCount >= 3) {
          this._results[this._currentEye] = MAX_LOGCS;
          this._finishCurrentEye();
          return;
        }
        // Chưa đủ 3 lần → chỉ next trial, không tăng LogCS thêm
        this._nextTrial();
        return;
      }

      // KHÓ HƠN: tăng LogCS (chữ E mờ dần)
      this._currentLogCS = roundLogCS(this._currentLogCS + STEP);
      this._currentLogCS = Math.max(MIN_LOGCS, Math.min(MAX_LOGCS, this._currentLogCS));
    } else {
      // Sai ở mức khó nhất chỉ lùi 1 mức — không reset bộ đếm _hardestCorrectCount
      const currentStr = logcsPresented.toFixed(2);
      this._mistakesMap[currentStr] = (this._mistakesMap[currentStr] || 0) + 1;

      // BỨC TƯỜNG 3 LỖI
      if (this._mistakesMap[currentStr] >= 3) {
        // Chốt mức LogCS trước đó (dễ hơn 1 bậc)
        this._results[this._currentEye] = Math.max(MIN_LOGCS, roundLogCS(this._currentLogCS - STEP));
        this._finishCurrentEye();
        return;
      }

      // DỄ HƠN: giảm LogCS
      this._currentLogCS = Math.max(MIN_LOGCS, roundLogCS(this._currentLogCS - STEP));
    }

    this._nextTrial();
  },

  _bindKeydown() {
    if (this._boundKeydown) return;
    this._boundKeydown = (e) => {
      if (this._state === 'intro' && e.key === 'Enter') {
        e.preventDefault();
        this._renderPrepScreen('OD');
        return;
      }
      if ((this._state === 'prep_od' || this._state === 'prep_os') && e.key === 'Enter') {
        e.preventDefault();
        this._startTest();
        return;
      }
      const testState = this._currentEye === 'OD' ? 'test_od' : 'test_os';
      if (this._state !== testState) return;

      const expected = ORIENTATIONS[this._orientation];
      if (e.key === expected) {
        e.preventDefault();
        this._handleResponse(true);
      } else if (Object.values(ORIENTATIONS).includes(e.key)) {
        e.preventDefault();
        this._handleResponse(false);
      }
    };
    document.addEventListener('keydown', this._boundKeydown);
  },
};

export default autoContrastEModule;
export { autoContrastEModule };