/**
 * auto_BCVA_tumbling_e_for_amblyopia.js
 * =====================================================
 * Auto BCVA with Crowding — Đánh giá thị lực nhìn xa tối đa (BCVA)
 * chuyên biệt cho NHƯỢC THỊ, phát hiện Hiệu ứng đám đông (Crowding).
 * 
 * Thuật toán: Hybrid Staircase (Fast Descent → Bức tường 3 lỗi)
 * - Không giới hạn số lượt cứng nhắc (loại bỏ total trials & reversals).
 * - Kết thúc Phase 1: 
 *     + Đạt 0.0 LogMAR đúng 3 lần liên tiếp.
 *     + Bức tường 3 lỗi: Sai đủ 3 lần tại cùng một mốc LogMAR (chốt ngưỡng lùi 1 bậc hoặc > 1.0).
 * - Kết thúc Phase 2:
 *     + Chạm target (giảm 2 dòng so với Phase 1) → DƯƠNG TÍNH (+).
 *     + Bức tường 3 lỗi hoặc chạm đỉnh 1.0 (sai 3 lần) → ÂM TÍNH (-).
 */

import { getOptotypeSize } from '../js/calibration.js';
import { TUMBLING_E } from './optotype_paths.js';

// ================================================================
//  Constants
// ================================================================

const MODULE_ID = 'far-vision-auto-bcva-crowding';
const START_LOGMAR = 0.6;
const START_STEP = 0.1;
const FINE_STEP = 0.05;

/** Giới hạn thang đo LogMAR lâm sàng */
const MIN_LOGMAR = 0.0;
const MAX_LOGMAR = 1.0;

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

// ================================================================
//  Module
// ================================================================

const autoBcvaCrowdingModule = {
  id: MODULE_ID,
  label: 'Auto BCVA nhược thị (Crowding)',
  customControls: true,
  steps: ['test'],

  // ----- Trạng thái -----
  _state: 'intro',
  _phase: 1,
  _currentLogmar: START_LOGMAR,
  _stepSize: START_STEP,
  _consecutiveCorrect: 0,
  _firstMistakeMade: false,
  _mistakesMap: {},           // { "0.50": 2, "1.00": 3, ... }

  _phase2Target: null,
  _phase2Positive: false,
  _phase2Negative: false,

  _results: { OD: { p1: null, p2: null }, OS: { p1: null, p2: null } },
  _currentEye: 'OD',
  _boundKeydown: null,

  render(_idx) {
    this._resetStaircase();
    this._phase = 1;
    this._state = 'intro';
    this._results = { OD: { p1: null, p2: null }, OS: { p1: null, p2: null } };
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
        <h1 style="margin:0 0 8px; font-size:1.6em; color:#111;">🔬 Auto BCVA với Crowding — Nhược thị</h1>
        <p style="max-width:720px; margin:4px 0; color:#333; line-height:1.55;">
          Test chuyên sâu đánh giá thị lực nhìn xa tối đa (BCVA) và phát hiện <strong>Hiệu ứng đám đông (Crowding Phenomenon)</strong>.
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
  },

  _resetPhase2State(startLogmar) {
    this._currentLogmar = startLogmar;
    this._stepSize = FINE_STEP;
    this._consecutiveCorrect = 0;
    this._firstMistakeMade = false;
    this._mistakesMap = {};
    this._phase2Target = roundLogmar(startLogmar - 0.2);
    this._phase2Positive = false;
    this._phase2Negative = false;
  },

  _startTest() {
    this._phase = 1;
    this._resetStaircase();
    this._state = this._currentEye === 'OD' ? 'test_od' : 'test_os';
    this._nextTrial();
  },

  _startPhase2() {
    this._phase = 2;
    let startLogmar = this._logmarPhase1 === '> 1.0' ? MAX_LOGMAR : Math.max(MIN_LOGMAR, Math.min(MAX_LOGMAR, this._currentLogmar));
    this._resetPhase2State(startLogmar);
    this._nextTrial();
  },

  _finishCurrentEye() {
    this._results[this._currentEye].p1 = this._logmarPhase1;
    this._results[this._currentEye].p2 = this._logmarPhase2;

    if (this._currentEye === 'OD') {
      this._currentEye = 'OS';
      this._renderPrepScreen('OS');
    } else {
      this._finishTest();
    }
  },

  _finishTest() {
    this._state = 'done';

    function formatLogmar(val) {
      if (val === null || val === undefined) return 'N/A';
      if (typeof val === 'string') return val;
      return val.toFixed(2);
    }

    function parseLogmar(val) {
      if (typeof val === 'string') {
        if (val.startsWith('>')) return MAX_LOGMAR;
        const parsed = parseFloat(val);
        return isNaN(parsed) ? null : parsed;
      }
      return typeof val === 'number' ? val : null;
    }

    const odP1Num = parseLogmar(this._results.OD.p1);
    const odP2Num = parseLogmar(this._results.OD.p2);
    const osP1Num = parseLogmar(this._results.OS.p1);
    const osP2Num = parseLogmar(this._results.OS.p2);

    const odDiff = (odP1Num !== null && odP2Num !== null) ? roundLogmar(odP1Num - odP2Num) : null;
    const osDiff = (osP1Num !== null && osP2Num !== null) ? roundLogmar(osP1Num - osP2Num) : null;

    function buildConclusion(p1, p2, diff) {
      let phaseStr = `Phase 1: [${formatLogmar(p1)}] LogMAR`;
      phaseStr += p2 !== null && p2 !== undefined ? ` | Phase 2: [${formatLogmar(p2)}] LogMAR` : ` | Phase 2: N/A`;
      phaseStr += diff !== null ? ` | Crowding: ${diff >= 0.2 ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}` : ` | Crowding: N/A`;
      return phaseStr;
    }

    const payload = {
      test_type: 'Auto BCVA (Crowding Eval)',
      is_manual_entry: false,
      clinical_metrics: {
        'OD (Mắt phải)': buildConclusion(this._results.OD.p1, this._results.OD.p2, odDiff),
        'OS (Mắt trái)': buildConclusion(this._results.OS.p1, this._results.OS.p2, osDiff)
      }
    };

    document.dispatchEvent(new CustomEvent('visionTestCompleted', { detail: payload, bubbles: true }));

    const board = document.getElementById('display-board');
    if (!board) return;
    board.innerHTML = `
      <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;text-align:center;">
        <h2 style="color:#111;">✅ Hoàn thành bài test</h2>
        <p><strong>OD:</strong> ${buildConclusion(this._results.OD.p1, this._results.OD.p2, odDiff)}</p>
        <p><strong>OS:</strong> ${buildConclusion(this._results.OS.p1, this._results.OS.p2, osDiff)}</p>
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

    let calib = { distanceM: null, ppi: 96 };
    if (window.__calibrator) {
      // Khoảng cách do main.js cung cấp (nhóm FAR theo TEST_DISTANCE_GROUPS)
      calib.distanceM = window.__calibrator.distanceM;
      if (window.__calibrator.ppi > 0) calib.ppi = window.__calibrator.ppi;
    }

    // Ưu tiên tuyệt đối nguồn PPI từ Credit-card calibration
    const ccPxPerMm = parseFloat(localStorage.getItem('vision-therapy-cc-pxpermm'));
    if (!isNaN(ccPxPerMm) && ccPxPerMm > 0) {
      calib.ppi = ccPxPerMm * 25.4;
    }

    const logmarDisplay = typeof this._currentLogmar === 'number' ? this._currentLogmar.toFixed(2) : String(this._currentLogmar);
    const pxSize = getOptotypeSize(this._currentLogmar, calib);
    const showBars = this._phase === 1;
    // Bù trừ tỷ lệ viewBox (7 đơn vị) so với optotype (5 đơn vị)
    const svgPxSize = pxSize * (7 / 5);

    const svg = `
      <svg viewBox="-1 -1 7 7" width="${svgPxSize}" height="${svgPxSize}" xmlns="http://www.w3.org/2000/svg">
        ${showBars ? crowdingBars() : ''}
        ${rotateE(this._orientation)}
      </svg>`;

    board.innerHTML = `
      <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;width:100%;height:100%;">${svg}</div>
      <div style="position:absolute; right:16px; bottom:16px; font-size:0.85em; color:#666; background:rgba(255,255,255,.85); padding:6px 12px; border-radius:6px; border:1px solid #ddd;">
        ${this._currentEye} · Phase ${this._phase} | LogMAR: ${logmarDisplay}
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

    // ================================================================
    //  PHASE 1
    // ================================================================
    if (this._phase === 1) {
      if (correct) {
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
            if (logmarPresented === MIN_LOGMAR) {
              this._logmarPhase1 = MIN_LOGMAR;
              this._logmarPhase2 = null;
              this._finishCurrentEye();
              return;
            }
            this._currentLogmar = roundLogmar(this._currentLogmar - this._stepSize);
            this._currentLogmar = Math.max(MIN_LOGMAR, Math.min(MAX_LOGMAR, this._currentLogmar));
            this._consecutiveCorrect = 0;
          }
        }
      } else {
        const currentStr = logmarPresented.toFixed(2);

        // BỨC TƯỜNG 3 LỖI
        if (this._mistakesMap[currentStr] >= 3) {
          if (logmarPresented >= MAX_LOGMAR) {
            this._results[this._currentEye].p1 = '> 1.0';
            this._logmarPhase1 = '> 1.0';
            this._startPhase2();
          } else {
            const threshold = roundLogmar(logmarPresented + this._stepSize);
            this._logmarPhase1 = threshold;
            if (this._logmarPhase1 > 0.1) {
              this._startPhase2();
            } else {
              this._logmarPhase2 = null;
              this._finishCurrentEye();
            }
          }
          return;
        }

        this._firstMistakeMade = true;
        this._currentLogmar = Math.min(MAX_LOGMAR, roundLogmar(this._currentLogmar + this._stepSize));
        this._consecutiveCorrect = 0;
      }

      this._nextTrial();
    }

    // ================================================================
    //  PHASE 2
    // ================================================================
    else if (this._phase === 2) {
      if (this._phase2Positive || this._phase2Negative) return;

      if (correct) {
        if (!this._firstMistakeMade) {
          this._currentLogmar = roundLogmar(this._currentLogmar - this._stepSize);
          this._currentLogmar = Math.max(MIN_LOGMAR, Math.min(MAX_LOGMAR, this._currentLogmar));
        } else {
          this._consecutiveCorrect++;
          if (this._consecutiveCorrect === 3) {
            this._currentLogmar = roundLogmar(this._currentLogmar - this._stepSize);
            this._currentLogmar = Math.max(MIN_LOGMAR, Math.min(MAX_LOGMAR, this._currentLogmar));
            this._consecutiveCorrect = 0;
          }
        }
      } else {
        const currentStr = logmarPresented.toFixed(2);

        // BỨC TƯỜNG 3 LỖI PHASE 2
        if (this._mistakesMap[currentStr] >= 3) {
          this._phase2Negative = true;
          this._logmarPhase2 = logmarPresented >= MAX_LOGMAR ? '> 1.0' : roundLogmar(logmarPresented + this._stepSize);
          this._finishCurrentEye();
          return;
        }

        this._firstMistakeMade = true;
        this._currentLogmar = Math.min(MAX_LOGMAR, roundLogmar(this._currentLogmar + this._stepSize));
        this._consecutiveCorrect = 0;
      }

      if (this._currentLogmar <= this._phase2Target) {
        this._phase2Positive = true;
        this._logmarPhase2 = this._currentLogmar;
        this._finishCurrentEye();
        return;
      }

      this._nextTrial();
    }
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

export default autoBcvaCrowdingModule;
export { autoBcvaCrowdingModule };