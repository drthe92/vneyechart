/**
 * auto_near_va.js
 * =====================================================
 * Auto Near VA (Tumbling E) — Test tự động đo thị lực nhìn gần cơ bản (40cm).
 *
 * Thuật toán: Hybrid Staircase (Fast Descent → Bức tường 3 lỗi)
 * - Không giới hạn số lượt cứng nhắc (loại bỏ total trials & reversals).
 * - Kết thúc:
 *     + Đạt 0.0 LogMAR đúng 3 lần liên tiếp.
 *     + Bức tường 3 lỗi: Sai đủ 3 lần tại cùng một mốc LogMAR (chốt ngưỡng lùi 1 bậc hoặc > 1.0).
 * - Kết quả báo cáo dạng Thị lực Thập phân (Decimal): Decimal = 10^(-LogMAR).
 */

import { getOptotypeSize } from '../js/calibration.js';
import { TUMBLING_E } from './optotype_paths.js';

// ================================================================
//  Constants
// ================================================================

const MODULE_ID = 'near-vision-auto-near-va';
const START_LOGMAR = 1.0;
const START_STEP = 0.1;
const FINE_STEP = 0.05;

/** Giới hạn thang đo LogMAR lâm sàng */
const MIN_LOGMAR = 0.0;
const MAX_LOGMAR = 1.0;

/** Khoảng cách đo cố định cho thị lực nhìn gần (40cm) */
const NEAR_DISTANCE_M = 0.4;

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

function roundLogmar(v) {
  return Math.round(v * 100) / 100;
}

function rotateE(orientation) {
  const angle = { right: 0, left: 180, up: 270, down: 90 }[orientation] || 0;
  return `<g transform="rotate(${angle}, 2.5, 2.5)">${TUMBLING_E}</g>`;
}

function crowdingBars() {
  return `
    <rect x="-1"   y="0"    width="0.5" height="5" fill="#000000"/>
    <rect x="5.5"  y="0"    width="0.5" height="5" fill="#000000"/>
    <rect x="0"    y="-1"   width="5"   height="0.5" fill="#000000"/>
    <rect x="0"    y="5.5"  width="5"   height="0.5" fill="#000000"/>
  `;
}

function formatDecimal(val) {
  if (val === null || val === undefined) return 'N/A';
  if (typeof val === 'string') return '< 1/10';
  const decimal = Math.pow(10, -val);
  const fraction = Math.round(decimal * 10);
  return `${decimal.toFixed(1)} (${fraction}/10)`;
}

// ================================================================
//  Module
// ================================================================

const autoNearVaModule = {
  id: MODULE_ID,
  label: 'Auto Near VA',
  customControls: true,
  steps: ['test'],

  // ----- Trạng thái -----
  _state: 'intro',
  _currentLogmar: START_LOGMAR,
  _stepSize: START_STEP,
  _consecutiveCorrect: 0,
  _firstMistakeMade: false,
  _mistakesMap: {},           // { "0.50": 2, "1.00": 3, ... }
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
        <h1 style="margin:0 0 8px; font-size:1.6em; color:#111;">🔬 Auto Near VA (40cm)</h1>
        <p style="max-width:720px; margin:4px 0; color:#333; line-height:1.55;">
          Test tự động đo thị lực nhìn gần cơ bản.
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
    this._currentLogmar = START_LOGMAR;
    this._stepSize = START_STEP;
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

    const payload = {
      test_type: 'Auto Near VA',
      is_manual_entry: false,
      clinical_metrics: {
        'OD (Thị lực nhìn gần mắt phải)': formatDecimal(this._results.OD),
        'OS (Thị lực nhìn gần mắt trái)': formatDecimal(this._results.OS)
      }
    };

    document.dispatchEvent(new CustomEvent('visionTestCompleted', { detail: payload, bubbles: true }));

    const board = document.getElementById('display-board');
    if (!board) return;
    board.innerHTML = `
      <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;text-align:center;">
        <h2 style="color:#111;">✅ Hoàn thành bài test</h2>
        <p><strong>OD:</strong> ${formatDecimal(this._results.OD)}</p>
        <p><strong>OS:</strong> ${formatDecimal(this._results.OS)}</p>
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

    let calib = { distanceM: NEAR_DISTANCE_M, ppi: 96 };
    if (window.__calibrator) {
      calib.distanceM = NEAR_DISTANCE_M; // Ép cứng 40cm cho test nhìn gần
      if (window.__calibrator.ppi > 0) calib.ppi = window.__calibrator.ppi;
    }

    // Ưu tiên tuyệt đối nguồn PPI từ Credit-card calibration
    const ccPxPerMm = parseFloat(localStorage.getItem('vision-therapy-cc-pxpermm'));
    if (!isNaN(ccPxPerMm) && ccPxPerMm > 0) {
      calib.ppi = ccPxPerMm * 25.4;
    }

    const logmarDisplay = typeof this._currentLogmar === 'number' ? this._currentLogmar.toFixed(2) : String(this._currentLogmar);
    const pxSize = getOptotypeSize(this._currentLogmar, calib);
    // Bù trừ tỷ lệ viewBox (7 đơn vị) so với optotype (5 đơn vị)
    const svgPxSize = pxSize * (7 / 5);

    const svg = `
      <svg viewBox="-1 -1 7 7" width="${svgPxSize}" height="${svgPxSize}" xmlns="http://www.w3.org/2000/svg">
        ${crowdingBars()}
        ${rotateE(this._orientation)}
      </svg>`;

    board.innerHTML = `
      <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;width:100%;height:100%;">${svg}</div>
      <div style="position:absolute; right:16px; bottom:16px; font-size:0.85em; color:#666; background:rgba(255,255,255,.85); padding:6px 12px; border-radius:6px; border:1px solid #ddd;">
        ${this._currentEye} · LogMAR: ${logmarDisplay}
      </div>`;
  },

  _handleResponse(correct) {
    const testState = this._currentEye === 'OD' ? 'test_od' : 'test_os';
    if (this._state !== testState) return;

    const logmarPresented = this._currentLogmar;

    if (!correct) {
      const currentStr = logmarPresented.toFixed(2);
      this._mistakesMap[currentStr] = (this._mistakesMap[currentStr] || 0) + 1;

      // Kích hoạt bước nhảy tinh (Fine Step 0.05) ngay từ lỗi đầu tiên
      if (this._stepSize !== FINE_STEP) {
        this._stepSize = FINE_STEP;
      }
    }

    if (correct) {
      // Mức khó nhất (0.0 LogMAR): phải trả lời đúng đủ 3 lần mới hoàn thành
      if (logmarPresented === MIN_LOGMAR) {
        this._hardestCorrectCount = (this._hardestCorrectCount || 0) + 1;
        if (this._hardestCorrectCount >= 3) {
          this._results[this._currentEye] = MIN_LOGMAR;
          this._finishCurrentEye();
          return;
        }
        // Chưa đủ 3 lần → chỉ next trial, không trừ thêm LogMAR
        this._nextTrial();
        return;
      }

      if (!this._firstMistakeMade) {
        this._currentLogmar = roundLogmar(this._currentLogmar - this._stepSize);
        this._currentLogmar = Math.max(MIN_LOGMAR, Math.min(MAX_LOGMAR, this._currentLogmar));
        if (this._currentLogmar === MIN_LOGMAR) {
          this._firstMistakeMade = true;
          this._consecutiveCorrect = 0;
        }
      } else {
        this._consecutiveCorrect++;
        if (this._consecutiveCorrect === 3) {
          this._currentLogmar = roundLogmar(this._currentLogmar - this._stepSize);
          this._currentLogmar = Math.max(MIN_LOGMAR, Math.min(MAX_LOGMAR, this._currentLogmar));
          this._consecutiveCorrect = 0;
        }
      }
    } else {
      // Sai ở mức khó nhất chỉ lùi 1 mức — không reset bộ đếm _hardestCorrectCount
      const currentStr = logmarPresented.toFixed(2);

      // BỨC TƯỜNG 3 LỖI
      if (this._mistakesMap[currentStr] >= 3) {
        if (logmarPresented >= MAX_LOGMAR) {
          this._results[this._currentEye] = '> 1.0';
        } else {
          this._results[this._currentEye] = roundLogmar(logmarPresented + this._stepSize);
        }
        this._finishCurrentEye();
        return;
      }

      this._firstMistakeMade = true;
      this._currentLogmar = Math.min(MAX_LOGMAR, roundLogmar(this._currentLogmar + this._stepSize));
      this._consecutiveCorrect = 0;
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

export default autoNearVaModule;
export { autoNearVaModule };