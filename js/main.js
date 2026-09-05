/**
 * main.js — Application entry point.
 *
 * Responsibilities:
 *   - Centralised State Management
 *   - Sidebar menu click → dynamic test loading
 *   - Wire UniversalInput NEXT / PREV / BACK into active test
 *   - Initialise Settings
 */

import UniversalInput     from './controller.js';
import DisplayManager     from './settings.js';
import DisplayCalibrator  from './calibration.js';
import CreditCardCalibrator from './credit_card_calibration.js';
import etdrsChart         from '../modules/etdrs_chart.js';
import { etdrsChartFarVision } from '../modules/etdrs_chart.js';
import snellenChart       from '../modules/snellen_chart.js';
import leaModule          from '../modules/lea_symbols.js';
import landoltCModule     from '../modules/landolt_c.js';
import tumblingEModule    from '../modules/tumbling_e.js';
import autoBcvaCrowdingModule from '../modules/auto_BCVA_tumbling_e_for_amblyopia.js';
import autoDistanceVaModule from '../modules/auto_distance_va.js';
import autoNearVaModule from '../modules/auto_near_va.js';
import autoContrastEModule from '../modules/auto_contrast_e.js';
import numberChartModule  from '../modules/number_chart.js';
import hotvModule         from '../modules/hotv.js';
import aucklandLogmar     from '../modules/auckland_logmar.js';
import worth4dot          from '../modules/worth4dot.js';
import astigmatism        from '../modules/astigmatism.js';
import amslerGrid from '../modules/retina_amsler.js';
import ishiharaTest from '../modules/retina_ishihara.js';
import pelliRobson from '../modules/retina_pelli_robson.js';

// ----- Near vision modules -----
import nearLogmarModule   from '../modules/near_logmar.js';
import nearNpointModule   from '../modules/near_npoint.js';
import nearLeaModule      from '../modules/near_lea.js';

// ----- Neuro-ophthalmology modules -----
import neuroOknModule from '../modules/neuro_okn.js';
import redDesatModule from '../modules/red_desat.js';
import duochromeModule from '../modules/duochrome_test.js';
import jccSimulationModule from '../modules/astigmatism_jcc.js';
import stereoAnaglyphModule from '../modules/stereo_anaglyph.js';
import autoStereoRandomDotModule from '../modules/auto_stereo_random_dot.js';
import schoberTestModule from '../modules/schober_test.js';
import dynamicFixationModule from '../modules/dynamic_fixation.js';
import hidingHeidiModule from '../modules/hiding_heidi.js';
import dynamicVergence from '../modules/dynamic_vergence.js';

// ----- Maddox Grid (Heterophoria) -----
import { MaddoxGridModule } from '../modules/maddox_grid_module.js';

// ================================================================
//  State Management
// ================================================================

const state = {
  /** Currently active test ID (matches menu item `data-test`). */
  currentTest: 'far-vision-etdrs',

  /** Ordered list of steps for the active test. */
  steps: [],

  /** Index into `steps`. */
  stepIndex: 0,

  /** Navigation history stack for BACK support. */
  history: [],
};

/**
 * Reset test state and load new steps.
 * @param {string} testId
 * @param {Array}  steps
 */
function loadTest(testId, steps) {
  // Cleanup previous module (e.g., OKN render loop)
  const prevMod = getTestModule(state.currentTest);
  if (prevMod && typeof prevMod.cleanup === 'function') {
    prevMod.cleanup();
  }

  // Ensure UniversalInput is always resumed when loading a test
  // Modules should NOT have their own conflicting event handlers
  if (universalInput) {
    universalInput.resume();
  }

  state.history.push({ test: state.currentTest, index: state.stepIndex });
  state.currentTest = testId;
  state.steps       = steps;
  state.stepIndex   = 0;
  renderStep();
}

/**
 * Advance to the next step (NEXT).
 */
function nextStep() {
  if (state.steps.length === 0) return;
  if (state.stepIndex < state.steps.length - 1) {
    state.stepIndex++;
    renderStep();
  }
}

/**
 * Go back to the previous step (PREV).
 */
function prevStep() {
  if (state.steps.length === 0) return;
  if (state.stepIndex > 0) {
    state.stepIndex--;
    renderStep();
  }
}

/**
 * Shuffle — randomise letters/symbols, keep current LogMAR.
 * Gọi mod.randomize() nếu module hỗ trợ, fallback renderStep().
 */
function shuffleStep() {
  if (state.steps.length === 0) return;
  const mod = getTestModule(state.currentTest);
  if (mod && typeof mod.randomize === 'function') {
    mod.randomize();
  } else {
    renderStep();
  }
}

/**
 * Navigate back (BACK) — restore previous test from history.
 */
function back() {
  if (state.history.length === 0) return;
  const prev = state.history.pop();
  state.currentTest = prev.test;
  state.stepIndex   = prev.index;
  const test = getTestModule(state.currentTest);
  state.steps = test ? test.steps : [];

  // Resume UniversalInput when returning to previous module
  if (universalInput) {
    if (test && test.customControls === true) {
      // Previous module also has custom controls - keep suspended
      universalInput.suspend();
    } else {
      // Previous module uses standard controls - resume UniversalInput
      universalInput.resume();
    }
  }

  renderStep();
  highlightMenuItem(state.currentTest);
}

// ================================================================
//  Combo Test Engine — Chuỗi 4 bài test định kỳ (Nhược thị)
// ================================================================

const COMBO_TEST_IDS = [
  'far-vision-auto-distance-va',
  'near-vision-auto-near-va',
  'retina-auto-contrast-e',
  'binocular-auto-stereo-random-dot'
];

window.__comboQueue = null;
window.__comboResults = {};

/**
 * Bóc tách giá trị số (parseFloat) từ clinical_metrics theo danh sách key.
 */
function _parseFloatMetric(metrics, keys) {
  for (const k of keys) {
    if (metrics && metrics[k] !== undefined && metrics[k] !== null) {
      const v = parseFloat(String(metrics[k]));
      if (!isNaN(v)) return v;
    }
  }
  return null;
}

/**
 * Thu thập chỉ số số học từ từng bài test vào __comboResults (7 thông số OD/OS + Stereo).
 */
function collectComboResult(detail) {
  if (!window.__comboResults) window.__comboResults = {};
  const metrics = detail.clinical_metrics || {};
  const type = detail.test_type;

  if (type === 'Auto Distance VA') {
    const od = _parseFloatMetric(metrics, ['OD (Mắt phải)']);
    const os = _parseFloatMetric(metrics, ['OS (Mắt trái)']);
    if (od !== null) window.__comboResults.distance_OD = od;
    if (os !== null) window.__comboResults.distance_OS = os;
  } else if (type === 'Auto Near VA') {
    const od = _parseFloatMetric(metrics, ['OD (Thị lực nhìn gần mắt phải)']);
    const os = _parseFloatMetric(metrics, ['OS (Thị lực nhìn gần mắt trái)']);
    if (od !== null) window.__comboResults.near_OD = od;
    if (os !== null) window.__comboResults.near_OS = os;
  } else if (type === 'Auto Contrast E') {
    const od = _parseFloatMetric(metrics, ['OD (Mắt phải)']);
    const os = _parseFloatMetric(metrics, ['OS (Mắt trái)']);
    if (od !== null) window.__comboResults.contrast_OD = od;
    if (os !== null) window.__comboResults.contrast_OS = os;
  } else if (type === 'Auto Stereo Random Dot') {
    // 'Có (100 giây cung)' → 100 ; 'Không đạt (Trượt 800 arcsec)' → 800
    const m = String(metrics['Stereo (Hình nổi)'] || '').match(/(\d+)\s*giây cung/);
    window.__comboResults.stereo = m ? parseInt(m[1], 10) : 800;
  }
}

/**
 * Đóng gói record EMR tập trung "Combo Đánh Giá Nhược Thị"
 * khi bài cuối (Stereo) hoàn thành & queue rỗng.
 */
function persistComboRecord() {
  if (!window.__comboResults) return;
  const durationSeconds = Math.round((Date.now() - (window.__comboStartTime || Date.now())) / 1000) || 0;
  const comboRecord = {
    id: Date.now().toString(),
    timestamp: Date.now(),
    gameName: 'Combo Đánh Giá Nhược Thị',
    durationSeconds: durationSeconds,
    metrics: { customData: window.__comboResults },
    opticalSettings: 'N/A'
  };
  if (window.examSessionManager && typeof window.examSessionManager.addTherapyRecord === 'function') {
    const ok = window.examSessionManager.addTherapyRecord(comboRecord);
    if (!ok) {
      console.warn('[Combo] Chưa có phiên khám đang mở — record Combo chưa được ghi vào EMR.');
    }
    // Refresh Notification Banner: chốt chặng đã đổi → chuyển trạng thái "Đánh giá lại sau Y phiên"
    if (typeof window.examSessionManager.updateComboBanner === 'function') {
      window.examSessionManager.updateComboBanner();
    }
  } else {
    console.error('[Combo] Không tìm thấy ExamSessionManager.');
  }
}

/**
 * Hủy combo an toàn (khi thoát ngang / chọn menu khác).
 */
function cancelCombo() {
  window.__comboQueue = null;
}

/**
 * Bắt đầu Combo: Master Lobby trước khi vào bài đầu tiên.
 */
function startCombo() {
  window.__comboQueue = [...COMBO_TEST_IDS];
  window.__comboResults = {};
  window.__comboStartTime = Date.now();
  renderComboMasterLobby();
}

/**
 * Master Lobby UI — danh sách chuẩn bị trước khi vào test đầu tiên.
 */
function renderComboMasterLobby() {
  const board = document.getElementById('display-board');
  if (!board) return;

  board.innerHTML = `
    <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;padding:32px;box-sizing:border-box;text-align:center;">
      <h1 style="margin:0 0 8px; font-size:1.6em; color:#111;">🔬 Combo Test — Nhược thị (4 bài)</h1>
      <p style="max-width:680px; margin:4px 0; color:#333; line-height:1.6;">Trước khi bắt đầu, vui lòng chuẩn bị:</p>
      <ul style="list-style:none; padding:0; margin:16px 0; text-align:left; max-width:560px; width:100%;">
        <li style="padding:10px 14px; margin:6px 0; background:#f0f6ff; border:1px solid #cfe0f5; border-radius:8px; color:#333;">
          <strong>1️⃣ Hiệu chuẩn khoảng cách thẻ tín dụng</strong> — mở Settings → Hiệu chuẩn thẻ tín dụng (85.6mm)
        </li>
        <li style="padding:10px 14px; margin:6px 0; background:#f0f6ff; border:1px solid #cfe0f5; border-radius:8px; color:#333;">
          <strong>2️⃣ Điều khiển TV / Người hỗ trợ</strong> — trả lời bằng phím mũi tên (↑ ↓ ← →)
        </li>
        <li style="padding:10px 14px; margin:6px 0; background:#f0f6ff; border:1px solid #cfe0f5; border-radius:8px; color:#333;">
          <strong>3️⃣ Kính Anaglyph Xanh-Đỏ</strong> — dùng cho bài Stereo Random Dot cuối cùng (Mắt phải kính ĐỎ)
        </li>
      </ul>
      <div style="display:flex; gap:12px; margin-top:16px;">
        <button id="combo-start-btn" style="padding:12px 32px; font-size:1.05em; cursor:pointer; border:none; border-radius:8px; background:#0056b3; color:#fff;">
          ▶ Bắt đầu bài 1: Auto Distance VA
        </button>
        <button id="combo-cancel-btn" style="padding:12px 24px; font-size:1.05em; cursor:pointer; border:1px solid #999; border-radius:8px; background:#fff; color:#555;">
          Hủy
        </button>
      </div>
    </div>
  `;

  const startBtn = board.querySelector('#combo-start-btn');
  if (startBtn) startBtn.addEventListener('click', () => advanceCombo());

  const cancelBtn = board.querySelector('#combo-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      cancelCombo();
      const mod = getTestModule(state.currentTest);
      state.steps = mod ? mod.steps : [];
      renderStep();
    });
  }
}

/**
 * Chuyển sang bài tiếp theo trong queue (tự động sau khi đóng Result Modal).
 */
function advanceCombo() {
  if (!window.__comboQueue || window.__comboQueue.length === 0) {
    window.__comboQueue = null;
    return;
  }
  const nextId = window.__comboQueue.shift();
  const mod = getTestModule(nextId);
  if (!mod) {
    window.__comboQueue = null;
    return;
  }

  // Auto‑switch calibrator distance theo nhóm test
  if (nextId.startsWith('near-vision-')) {
    const cal = window.__calibrator;
    if (cal && cal.distanceM > 0.5) cal.applyNearVisionPreset();
  } else if (nextId.startsWith('far-vision-')) {
    const cal = window.__calibrator;
    if (cal && cal.distanceM < 0.5) cal.applyDistanceVisionPreset();
  }

  highlightMenuItem(nextId);
  loadTest(nextId, mod.steps);

  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.add('sidebar-hidden');
}

// ================================================================
//  Test Module Registry
// ================================================================

const testModules = {};

/**
 * Register a test module.
 * @param {Object} mod  Must have { id, label, steps, render() }
 */
function registerTestModule(mod) {
  testModules[mod.id] = mod;
}

/**
 * Get a test module by ID.
 * @param {string} id
 * @returns {Object|undefined}
 */
function getTestModule(id) {
  return testModules[id];
}

// ================================================================
//  Test module registrations
// ================================================================

// ----- Far‑vision sub‑modules (accordion) -----
registerTestModule(etdrsChartFarVision);   // id: 'far-vision'
registerTestModule(etdrsChart);            // id: 'far-vision-etdrs'
registerTestModule(snellenChart);          // id: 'far-vision-snellen'
registerTestModule(leaModule);             // id: 'far-vision-lea'

// New standardised optotype modules
registerTestModule(landoltCModule);        // id: 'far-vision-landolt'
registerTestModule(tumblingEModule);       // id: 'far-vision-tumbling-e'
registerTestModule(autoBcvaCrowdingModule); // id: 'far-vision-auto-bcva-crowding'
registerTestModule(autoDistanceVaModule);    // id: 'far-vision-auto-distance-va'
registerTestModule(autoNearVaModule);        // id: 'near-vision-auto-near-va'
registerTestModule(numberChartModule);      // id: 'far-vision-numbers'
registerTestModule(aucklandLogmar);         // id: 'far-vision-auckland'

// ----- Other modules -----
registerTestModule(hotvModule);            // id: 'far-vision-hotv'
registerTestModule(worth4dot);             // id: 'binocular'
registerTestModule(astigmatism);           // id: 'astigmatism'
registerTestModule(stereoAnaglyphModule);  // id: 'binocular-stereo'
registerTestModule(autoStereoRandomDotModule); // id: 'binocular-auto-stereo-random-dot'

// ----- Retina sub‑modules -----
registerTestModule(amslerGrid);            // id: 'retina-amsler'
registerTestModule(ishiharaTest);          // id: 'retina-ishihara'
registerTestModule(pelliRobson);           // id: 'retina-pelli-robson'
registerTestModule(autoContrastEModule);   // id: 'retina-auto-contrast-e'

// ----- Near‑vision sub‑modules (accordion) -----
registerTestModule(nearLogmarModule);      // id: 'near-vision-logmar'
registerTestModule(nearNpointModule);      // id: 'near-vision-npoint'
registerTestModule(nearLeaModule);         // id: 'near-vision-lea'

// ----- Neuro‑ophthalmology sub‑modules (accordion) -----
registerTestModule(redDesatModule);        // id: 'neuro-red-desat'
registerTestModule(neuroOknModule);        // id: 'neuro-okn'
registerTestModule(duochromeModule);       // id: 'neuro-duochrome'

registerTestModule(jccSimulationModule);   // id: 'jcc-simulation'

// ----- Schober Test (Heterophoria) -----
registerTestModule(schoberTestModule);     // id: 'schober-heterophoria'

// ----- Dynamic Fixation Target (Pediatric) -----
registerTestModule(dynamicFixationModule); // id: 'dynamic-fixation'

// ----- Hiding Heidi (Pediatric Face Contrast Test) -----
registerTestModule(hidingHeidiModule);     // id: 'hiding-heidi'

// ----- Dynamic Vergence (Specialized Test) -----
registerTestModule(dynamicVergence);      // id: 'dynamic-vergence'

// ----- Maddox Grid (Heterophoria / AC-A) -----
// 3-Priority Calibration Data Pipeline:
//   Priority 1: Credit Card Calibration (localStorage 'vision-therapy-cc-pxpermm')
//   Priority 2: DisplayCalibrator (window.__calibrator.pxPerMm)
//   Priority 3: Hardcoded fallback (3.78 px/mm)
const _getMaddoxCalibration = () => {
    const savedPPM = localStorage.getItem('vision-therapy-cc-pxpermm');
    return {
        pixelsPerMm: savedPPM ? parseFloat(savedPPM) : (window.__calibrator?.pxPerMm || 3.78)
    };
};

const maddoxGridModule = {
    id: 'maddox-grid',
    label: 'Maddox Grid (Heterophoria)',
    steps: ['ready'],
    _instance: null,

    render() {
        if (this._instance && this._instance.isRunning) return;
        const cal = _getMaddoxCalibration();
        this._instance = new MaddoxGridModule(cal);
        this._instance.start();
    },

    cleanup() {
        if (this._instance && this._instance.isRunning) {
            this._instance.stop();
        }
    },

    randomize() {
        // No-op for Maddox Grid — no shuffle needed
    }
};

registerTestModule(maddoxGridModule);

// ----- Fallback modules -----
const DEFAULT_STEPS = ['▲', '▶', '●', '◆', '★', '⬟'];

function makeModule(id, label, steps = DEFAULT_STEPS) {
  return {
    id,
    label,
    steps,
    render(idx) {
      const board = document.getElementById('display-board');
      if (!board) return;
      const step = this.steps[idx];
      board.innerHTML = `
        <div class="test-symbol">${step}</div>
        <div class="test-label">${label}</div>
        <div class="test-counter">${idx + 1} / ${this.steps.length}</div>
      `;
    },
  };
}

registerTestModule(makeModule('accommodation',  'Điều tiết',        ['⬤', '◉', '◎', '○', '◌', '⋅']));

// ================================================================
//  Render
// ================================================================

function renderStep() {
  const mod = getTestModule(state.currentTest);
  if (!mod) return;

  const board = document.getElementById('display-board');
  if (board) {
    board.style.background = '';
    board.style.color = '';
  }

  if (state.stepIndex >= mod.steps.length) state.stepIndex = mod.steps.length - 1;
  if (state.stepIndex < 0) state.stepIndex = 0;

  mod.render(state.stepIndex);
}

// ================================================================
//  Sidebar Menu
// ================================================================

function highlightMenuItem(testId) {
  document.querySelectorAll('.menu-item').forEach(el => {
    el.classList.toggle('active', el.dataset.test === testId);
  });
}

function setupSidebar() {
  // Flat menu: every .menu-item is a top‑level chart selector.
  document.querySelectorAll('.menu-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const testId = el.dataset.test;
      if (!testId) return;

      // Clicking the currently active test: just close the menu to reveal
      // the running test without resetting its progress.
      if (testId === state.currentTest) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('sidebar-hidden');
        return;
      }

      const mod = getTestModule(testId);
      if (!mod) return;

      // Thoát ngang combo → hủy queue an toàn
      cancelCombo();

      // Auto‑switch calibrator distance for near vision tests (40 cm)
      if (testId && (testId.startsWith('near-vision-'))) {
        const cal = window.__calibrator;
        if (cal) {
          if (cal.distanceM > 0.5) {
            cal.applyNearVisionPreset();
          }
        }
      } else if (testId && (testId.startsWith('far-vision-'))) {
        const cal = window.__calibrator;
        if (cal) {
          if (cal.distanceM < 0.5) {
            cal.applyDistanceVisionPreset();
          }
        }
      }

      highlightMenuItem(testId);
      loadTest(testId, mod.steps);

      // Rút gọn: ẩn menu sau khi chọn xong bảng thị lực, chỉ hiện vùng đo.
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.add('sidebar-hidden');
    });
  });

  // Centralised sidebar toggle helper
  function toggleSidebar(forceShow) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (forceShow === true) {
      sidebar.classList.remove('sidebar-hidden');
      // Enable module switching when menu is visible
      if (universalInput) {
        universalInput.enableModuleSwitching();
      }
    } else if (forceShow === false) {
      sidebar.classList.add('sidebar-hidden');
      // Disable module switching when menu is hidden
      if (universalInput) {
        universalInput.disableModuleSwitching();
      }
    } else {
      sidebar.classList.toggle('sidebar-hidden');
      // Toggle module switching based on menu visibility
      if (universalInput) {
        if (sidebar.classList.contains('sidebar-hidden')) {
          universalInput.disableModuleSwitching();
        } else {
          universalInput.enableModuleSwitching();
        }
      }
    }
  }

  // Persistent bottom-left toggle button — click to show/hide menu
  const toggleBtn = document.getElementById('menu-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSidebar();
    });
  }

  // ---- Menu keyboard navigation state ----
  let menuFocusIndex = -1;
  // Mọi nút trên topmenu (sidebar-header) phải nằm trong danh sách này thì mới
  // chọn được bằng 4 phím điều hướng. querySelectorAll không trả phần tử trùng,
  // nên thêm [data-nav] làm lưới an toàn cho các nút tạo động chưa có .nav-btn.
  const getMenuItems = () => Array.from(
    document.querySelectorAll('.menu-item, .module-card, .nav-btn, [data-nav]')
  );

  function updateMenuFocus() {
    // Guard Clause: nếu có Modal đang mở (exam-modal hiển thị hoặc nội dung modal
    // đã được tối ưu hóa đang hiện trên màn hình), cấm hệ thống menu nền tự động
    // cập nhật hoặc giành lại focus.
    const openExamModal = document.querySelector(
      '.exam-modal[style*="display: flex"], .exam-modal[style*="display: block"]'
    );
    if (openExamModal) return;
    const openOptimizedModal = Array.from(document.querySelectorAll('.modal-optimized'))
      .find((el) => el.isConnected && el.offsetParent !== null);
    if (openOptimizedModal) return;

    const items = getMenuItems();
    items.forEach((el, i) => {
      el.classList.toggle('menu-focus', i === menuFocusIndex);
      // Add visual feedback for nav buttons
      if (el.classList.contains('nav-btn')) {
        el.style.outline = i === menuFocusIndex ? '3px solid var(--sidebar-accent)' : '';
        el.style.outlineOffset = i === menuFocusIndex ? '2px' : '';
      }
    });
    const focused = items[menuFocusIndex];
    if (focused) {
      focused.scrollIntoView({ behavior: 'smooth', block: 'center' });
      focused.focus();
    }
  }

  function isMenuVisible() {
    const sidebar = document.getElementById('sidebar');
    return sidebar && !sidebar.classList.contains('sidebar-hidden');
  }

  // ---- 2D Spatial Navigation helper ----
  // Finds the element geometrically closest to items[currentIndex] in the given
  // direction ('up' | 'down' | 'left' | 'right') using getBoundingClientRect().
  // Returns the new index, or -1 if no candidate lies in that direction.
  function findClosestElementInDirection(currentIndex, direction, items) {
    if (currentIndex < 0 || currentIndex >= items.length) return -1;

    const currentRect = items[currentIndex].getBoundingClientRect();
    const currentCx = currentRect.left + currentRect.width / 2;
    const currentCy = currentRect.top + currentRect.height / 2;

    // Small tolerance (px) so elements aligned edge-to-edge still count
    const EPSILON = 4;

    let bestIndex = -1;
    let bestDist = Infinity;

    items.forEach((el, i) => {
      if (i === currentIndex) return;

      // Skip invisible/hidden elements (zero-size rects)
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      // Directional filter: element must lie strictly in the pressed direction
      let inDirection = false;
      // Left/Right chỉ được phép di chuyển trong cùng một dải hàng (row).
      // Chặn việc chọn nhảy lên topmenu (sidebar-header) khi đang ở dòng 1.
      const verticalOverlap = (a, b) => a.top < b.bottom && a.bottom > b.top;
      switch (direction) {
        case 'up':
          inDirection = rect.bottom <= currentRect.top + EPSILON;
          break;
        case 'down':
          inDirection = rect.top >= currentRect.bottom - EPSILON;
          break;
        case 'left':
          inDirection = rect.right <= currentRect.left + EPSILON && verticalOverlap(rect, currentRect);
          break;
        case 'right':
          inDirection = rect.left >= currentRect.right - EPSILON && verticalOverlap(rect, currentRect);
          break;
      }
      if (!inDirection) return;

      // Geometric distance between element centers
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - currentCx;
      const dy = cy - currentCy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    });

    return bestIndex;
  }

  // ================================================================
  //  Hybrid D-Pad Navigation for Popups / Modals (Remote-friendly)
  // ================================================================

  // ---- Focus Restoration state ----
  // Lưu phần tử (thường là nút trên menu chính) đang được focus NGAY TRƯỚC khi
  // một Modal mở ra, để có thể trả lại focus + tái lập vòng outline xanh
  // (.menu-focus) đúng vị trí điều hướng cũ khi Modal đóng.
  let lastFocusedElementBeforeModal = null;

  /**
   * Trả focus về phần tử đã lưu trước khi Modal mở (Focus Restoration).
   * - Gọi .focus() lên phần tử cũ để trình duyệt đặt lại vị trí focus.
   * - Nếu phần tử thuộc menu chính, đồng bộ menuFocusIndex và gọi
   *   updateMenuFocus() để class .menu-focus + outline xanh hiển thị lại mượt mà,
   *   giúp điều hướng Trái/Phải tiếp tục không bị đứt đoạn.
   * - Cuối cùng reset biến trạng thái về null.
   */
  function restoreFocusAfterModalClose() {
    const el = lastFocusedElementBeforeModal;
    lastFocusedElementBeforeModal = null;
    if (!el || !el.isConnected || typeof el.focus !== 'function') return;
    el.focus();
    // Tái lập đúng trạng thái điều hướng menu (class .menu-focus + outline)
    const items = getMenuItems();
    const idx = items.indexOf(el);
    if (idx !== -1 && idx !== menuFocusIndex) {
      menuFocusIndex = idx;
      updateMenuFocus();
    } else if (idx !== -1) {
      // Vẫn gọi để đảm bảo outline được vẽ lại nhất quán sau khi modal đóng
      updateMenuFocus();
    }
  }

  // Selectors that identify every popup/modal used across the project.
  // Fullscreen overlays created by game modules are also detected below from
  // their inline position/inset styles, so they receive the same keyboard UX.
  const MODAL_SELECTOR = [
    '.exam-modal',
    '.settings-modal-overlay',
    '.calib-modal-overlay',
    '.cc-modal-overlay',
    '.okn-warning-overlay',
    '.custom-modal',
    '.modal',
    '[id$="-modal"]',
    '#global-result-modal'
  ].join(', ');

  /**
   * Modal visibility check. Focusable children use the stricter layout check
   * below; the modal itself may be a zero-size test double in unit tests.
   */
  function isModalVisible(modal) {
    if (!modal || !modal.isConnected) return false;
    const style = window.getComputedStyle(modal);
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0';
  }

  /** Detect fullscreen overlays that do not carry a modal class or id. */
  function isFullscreenOverlay(element) {
    if (!element || !element.getAttribute) return false;
    const inlineStyle = element.getAttribute('style') || '';
    const style = window.getComputedStyle(element);
    const position = style.position || '';
    const hasInset = /\binset\s*:\s*0(?:px)?\b/i.test(inlineStyle);
    const hasViewportSize =
      /\bwidth\s*:\s*100vw\b/i.test(inlineStyle) &&
      /\bheight\s*:\s*100vh\b/i.test(inlineStyle);

    if (position === 'fixed' && (hasInset || hasViewportSize)) return true;

    // Dynamic fixation uses an absolute 100% overlay inside the test board.
    const isAbsoluteBoardOverlay =
      position === 'absolute' &&
      /\btop\s*:\s*0(?:px)?\b/i.test(inlineStyle) &&
      /\bleft\s*:\s*0(?:px)?\b/i.test(inlineStyle) &&
      /\bwidth\s*:\s*100%\b/i.test(inlineStyle) &&
      /\bheight\s*:\s*100%\b/i.test(inlineStyle) &&
      Number.parseInt(style.zIndex, 10) >= 1000;

    return isAbsoluteBoardOverlay;
  }

  /** Return modal roots, including dynamically-created fullscreen overlays. */
  function getModalCandidates() {
    const candidates = [];
    const seen = new Set();
    const add = (element) => {
      if (element && !seen.has(element)) {
        seen.add(element);
        candidates.push(element);
      }
    };

    document.querySelectorAll(MODAL_SELECTOR).forEach(add);
    document.querySelectorAll('[style*="position"]').forEach((element) => {
      if (isFullscreenOverlay(element)) add(element);
    });
    return candidates;
  }

  /**
   * Quét DOM tìm Modal đang hiển thị.
   * Một Modal được coi là "active" nếu nó khớp MODAL_SELECTOR và đang hiển thị
   * trên màn hình (display !== 'none' hoặc có class .active).
   * @returns {HTMLElement|null}
   */
  function getActiveModal() {
    let activeModal = null;
    let activeZIndex = -Infinity;

    getModalCandidates().forEach((el) => {
      if (!isModalVisible(el)) return;
      const zIndex = Number.parseInt(window.getComputedStyle(el).zIndex, 10);
      const normalizedZIndex = Number.isFinite(zIndex) ? zIndex : 0;
      if (!activeModal || normalizedZIndex >= activeZIndex) {
        activeModal = el;
        activeZIndex = normalizedZIndex;
      }
    });

    return activeModal;
  }

  /**
   * Find the scrollable panel without ever putting the optimization class on
   * a fullscreen backdrop. A single anonymous child is the common structure
   * used by dynamically-created game result overlays.
   */
  function getModalContentElement(modal) {
    if (!modal) return null;

    const contentSelector =
      '.exam-modal-content, .settings-modal-box, .calib-modal-box, ' +
      '.cc-modal-box, .okn-warning-box, .modal-content, .custom-modal-content';
    if (typeof modal.matches === 'function' && modal.matches(contentSelector)) {
      return modal;
    }

    const knownContent = modal.querySelector(contentSelector);
    if (knownContent) return knownContent;

    const isOverlayRoot = typeof modal.matches === 'function' && modal.matches(
      '.exam-modal, .settings-modal-overlay, .calib-modal-overlay, ' +
      '.cc-modal-overlay, .okn-warning-overlay, .custom-modal, .modal'
    );
    if (!isOverlayRoot && !isFullscreenOverlay(modal)) return modal;

    const directChildren = Array.from(modal.children);
    if (directChildren.length === 1) return directChildren[0];

    // An overlay without a panel still needs a bounded scrolling surface.
    // Wrap only its children, leaving the overlay itself fullscreen.
    if (isFullscreenOverlay(modal) && directChildren.length > 1) {
      if (modal.__modalUxContent && modal.__modalUxContent.isConnected) {
        return modal.__modalUxContent;
      }

      const content = document.createElement('div');
      content.className = 'modal-optimized';
      directChildren.forEach((child) => content.appendChild(child));
      modal.appendChild(content);
      modal.__modalUxContent = content;
      return content;
    }

    return modal;
  }

  /** A visible element must have layout before it can participate in Tab order. */
  function isVisibleFocusableElement(element) {
    if (!element || !isModalVisible(element)) return false;
    return element.offsetWidth > 0 || element.offsetHeight > 0;
  }

  /**
   * Kiểm tra phần tử có phải ô nhập văn bản hay không.
   * Với các ô này, ArrowLeft/ArrowRight phải được trả lại cho trình duyệt
   * để di chuyển con trỏ text (caret).
   */
  function isTextInput(el) {
    return !!el && el.tagName === 'INPUT' &&
      ['text', 'number', 'password', 'search', 'tel', 'email', 'url'].includes(el.type);
  }

  /**
   * Focus Trap: chỉ lấy các phần tử focusable BÊN TRONG modal đang mở,
   * chặn hoàn toàn việc điều hướng lọt ra ngoài menu chính.
   */
  function getFocusableItems(modal) {
    if (!modal) return [];
    const selector =
      'button:not([disabled]), a, ' +
      'input:not([type="hidden"]):not([disabled]), ' +
      'select:not([disabled]), textarea:not([disabled]), ' +
      '[tabindex]:not([tabindex="-1"])';
    return Array.from(modal.querySelectorAll(selector)).filter(isVisibleFocusableElement);
  }

  /** Focus vào một item trong modal + cuộn nhẹ để đảm bảo nhìn thấy. */
  function focusModalItem(items, index) {
    const el = items[index];
    if (!el) return;
    el.focus({ preventScroll: true });
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    // Đặt caret về cuối chuỗi với ô nhập văn bản (trải nghiệm remote tốt hơn)
    if (isTextInput(el) && typeof el.setSelectionRange === 'function') {
      try {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      } catch (_) { /* input type number không hỗ trợ — bỏ qua */ }
    }
  }

  /**
   * Đóng modal hiện tại theo cách "tự nhiên" nhất:
   * ưu tiên click nút đóng/hủy có sẵn (để chạy đúng logic dọn dẹp của từng modal),
   * nếu không tìm thấy thì ẩn trực tiếp.
   */
  function closeActiveModal(modal) {
    if (!modal) return;
    const closeSelectors = [
      '.close-btn',
      '.exam-modal-close',
      '.settings-modal-close',
      '.calib-modal-close',
      '.cc-modal-close',
      '[data-dismiss="modal"]',
      '.modal-close',
      '.cancel-btn',
      '.close',
      '.btn-close',
      '.btn-secondary',
      '[aria-label="Close"]',
      '[aria-label="Đóng"]'
    ];
    for (const sel of closeSelectors) {
      const btn = modal.querySelector(sel);
      if (btn && isVisibleFocusableElement(btn)) {
        btn.click();
        // Modal đã được đóng thành công qua nút đóng/hủy của chính nó
        // → trả focus về phần tử trên menu trước khi modal mở ra
        restoreFocusAfterModalClose();
        return;
      }
    }
    // Fallback: ẩn TRIỆT ĐỂ modal...
    modal.classList.remove('active');
    modal.style.display = 'none';
    // ...và cả overlay cha (lớp phủ nền đen) nếu modal là con của overlay
    const parent = modal.parentElement;
    if (parent && parent !== document.body) {
      const isOverlay =
        /overlay/i.test(parent.className) ||
        window.getComputedStyle(parent).position === 'fixed';
      if (isOverlay) {
        parent.classList.remove('active');
        parent.style.display = 'none';
      }
    }
    // Modal đã ẩn triệt để → trả focus về phần tử trên menu trước khi modal mở
    restoreFocusAfterModalClose();
  }

  /** Locate the real close action for a modal, including inline legacy buttons. */
  function getModalCloseButton(modal) {
    if (!modal) return null;
    const selectors = [
      '.close-btn',
      '.exam-modal-close',
      '.settings-modal-close',
      '.calib-modal-close',
      '.cc-modal-close',
      '[data-dismiss="modal"]',
      '.modal-close',
      '.cancel-btn',
      '.close',
      '.btn-close',
      '.btn-secondary',
      '[aria-label="Close"]',
      '[aria-label="Đóng"]',
      '[data-close]'
    ];

    for (const selector of selectors) {
      const button = modal.querySelector(selector);
      if (button && isModalVisible(button)) return button;
    }

    const legacyClose = Array.from(modal.querySelectorAll('button, [role="button"]'))
      .find((button) => {
        if (!isModalVisible(button)) return false;
        const text = `${button.textContent || ''} ${button.getAttribute('aria-label') || ''} ${button.getAttribute('onclick') || ''}`;
        return /close|đóng|hủy|huỷ|cancel/i.test(text);
      });
    if (legacyClose) return legacyClose;

    // The global result dialog has one confirmation button which closes it.
    if (modal.id === 'global-result-modal') {
      return Array.from(modal.querySelectorAll('button')).find(isModalVisible) || null;
    }
    return null;
  }

  /**
   * Shared modal keyboard behavior. Return immediately for text editing so
   * Enter keeps textarea newlines and native form submission intact.
   */
  function handleModalUXKeydown(e, modal) {
    if (!modal || !isModalVisible(modal)) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      const closeButton = getModalCloseButton(modal);
      if (closeButton) {
        closeButton.click();
      } else {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      restoreFocusAfterModalClose();
      return;
    }

    if (e.key === 'Tab') {
      const items = getFocusableItems(modal);
      if (items.length === 0) return;

      const currentIndex = items.indexOf(document.activeElement);
      const shouldWrapForward = !e.shiftKey && currentIndex === items.length - 1;
      const shouldWrapBackward = e.shiftKey && (currentIndex === 0 || currentIndex === -1);
      const focusIndex = e.shiftKey ? items.length - 1 : 0;

      if (currentIndex === -1 || shouldWrapForward || shouldWrapBackward) {
        e.preventDefault();
        e.stopPropagation();
        items[shouldWrapBackward ? items.length - 1 : focusIndex].focus();
      }
      return;
    }

    if (e.key !== 'Enter') return;

    const target = e.target;
    // Guard must stay before any click/preventDefault logic.
    if (
      target &&
      (target.tagName === 'TEXTAREA' ||
        (target.tagName === 'INPUT' && ['text', 'number'].includes(target.type)) ||
        isTextInput(target))
    ) return;

    const action = target && typeof target.closest === 'function'
      ? target.closest('button, a, input[type="checkbox"], input[type="radio"], input[type="button"], input[type="submit"], input[type="reset"]')
      : null;
    if (!action || !modal.contains(action) || action.disabled) return;

    e.preventDefault();
    e.stopPropagation();
    action.click();
  }

  /**
   * Public modal enhancement utility. It is intentionally idempotent so a
   * modal can call it every time it is shown without stacking listeners.
   * @param {HTMLElement} modalElement
   * @returns {HTMLElement|null}
   */
  window.enhanceModalUX = function enhanceModalUX(modalElement) {
    if (!modalElement || typeof modalElement.querySelectorAll !== 'function') return null;

    const modalContent = getModalContentElement(modalElement);
    if (modalContent) modalContent.classList.add('modal-optimized');

    if (!modalElement.__modalUxKeydownHandler) {
      modalElement.__modalUxKeydownHandler = (e) => handleModalUXKeydown(e, modalElement);
      modalElement.addEventListener('keydown', modalElement.__modalUxKeydownHandler, true);
    }

    if (modalElement.__modalUxFocusTimer) {
      window.clearTimeout(modalElement.__modalUxFocusTimer);
      modalElement.__modalUxFocusTimer = null;
    }
    if (modalElement.__modalUxFocusPoller) {
      window.clearInterval(modalElement.__modalUxFocusPoller);
      modalElement.__modalUxFocusPoller = null;
    }

    const firstInput = Array.from(modalElement.querySelectorAll(
      'input:not([type="hidden"]):not([disabled]):not([type="checkbox"]):not([type="radio"]), ' +
      'textarea:not([disabled])'
    )).find(isVisibleFocusableElement);

    if (firstInput) {
      const currentActive = document.activeElement;
      if (
        currentActive &&
        currentActive !== document.body &&
        currentActive !== document.documentElement &&
        !modalElement.contains(currentActive) &&
        typeof currentActive.focus === 'function'
      ) {
        lastFocusedElementBeforeModal = currentActive;
      }
    }

    return modalElement;
  };

  /**
   * Xử lý phím khi một Modal đang mở (Hybrid algorithm):
   *  - Escape / Backspace (nút Back trên remote) → đóng modal.
   *  - Enter / OK → do enhanceModalUX xử lý click nút hoặc submit native.
   *  - Nếu đang focus <input type="text|number|password">:
   *      + ArrowLeft / ArrowRight → bỏ qua (trình duyệt di chuyển caret).
   *      + ArrowUp / ArrowDown    → nhảy tới item liền trước / liền sau (1D).
   *  - Nếu đang focus button / checkbox / select...:
   *      + Dùng findClosestElementInDirection (thuật toán 2D) theo cả 4 hướng.
   */
  function handleModalKeydown(e, modal) {
    // ---- Escape / Back (remote) → đóng modal ----
    if (e.key === 'Escape' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      closeActiveModal(modal);
      return;
    }

    // ---- Action keys: để hành vi native click nút / submit form ----
    // LƯU Ý: KHÔNG dùng e.keyCode === 18 (Alt) để mô phỏng Enter/OK,
    // tránh xung đột với tổ hợp hệ thống như Alt + Tab.
    if (
      e.key === 'Enter' || e.key === ' ' || e.key === 'OK' ||
      e.key === 'Accept'
    ) {
      return;
    }

    const items = getFocusableItems(modal);
    if (items.length === 0) return;

    let direction = null;
    if (e.key === 'ArrowUp') direction = 'up';
    else if (e.key === 'ArrowDown') direction = 'down';
    else if (e.key === 'ArrowLeft') direction = 'left';
    else if (e.key === 'ArrowRight') direction = 'right';
    if (!direction) return;

    const active = document.activeElement;
    const currentIndex = items.indexOf(active);

    // Chưa focus vào đâu trong modal → bắt đầu từ phần tử đầu tiên
    if (currentIndex === -1) {
      e.preventDefault();
      focusModalItem(items, 0);
      return;
    }

    // ---- Nhánh 1: Text input → hybrid 1D (chỉ Up/Down), Left/Right cho caret ----
    if (isTextInput(active)) {
      if (direction === 'left' || direction === 'right') {
        return; // Trả quyền cho trình duyệt di chuyển con trỏ text
      }
      e.preventDefault();
      const next = direction === 'down' ? currentIndex + 1 : currentIndex - 1;
      if (next >= 0 && next < items.length) {
        focusModalItem(items, next);
      }
      return;
    }

    // ---- Nhánh 2: Button / checkbox / select... → thuật toán 2D ----
    e.preventDefault();
    const newIndex = findClosestElementInDirection(currentIndex, direction, items);
    if (newIndex !== -1) {
      focusModalItem(items, newIndex);
    }
  }

  /**
   * Auto-focus: ngay khi một Modal hiện lên (DOM thay đổi hoặc style/class đổi),
   * tự động focus vào ô nhập liệu đầu tiên (ưu tiên) hoặc nút bấm đầu tiên.
   * Người dùng không cần click chuột lần đầu khi dùng remote.
   */
  function initModalAutoFocus() {
    let scheduled = false;
    const enhanceActiveModal = () => {
      scheduled = false;
      const modal = getActiveModal();
      if (modal && typeof window.enhanceModalUX === 'function') {
        window.enhanceModalUX(modal);
      }
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(enhanceActiveModal);
      } else {
        setTimeout(enhanceActiveModal, 0);
      }
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    schedule();

    // Run before document-level remote/menu handlers, including for overlays
    // whose focused element is not covered by the legacy modal selectors.
    document.addEventListener('keydown', (e) => {
      const modal = getActiveModal();
      if (modal) handleModalUXKeydown(e, modal);
    }, true);
  }

  // Keyboard: Backquote (`) / Tilde (~) / Home / ContextMenu to toggle menu.
  // Tab, Enter and Escape are handled by enhanceModalUX while a modal is open.
  // When menu is visible: Arrow keys navigate, Enter/OK selects
  initModalAutoFocus();

  document.addEventListener('keydown', (e) => {
    // ---- Hybrid D-Pad Navigation: khi một Modal đang mở, toàn bộ phím mũi tên
    // bị "bẫy focus" bên trong Modal đó, không cho lọt ra ngoài menu chính.
    // (Riêng phím backquote/tilde vẫn cho phép toggle menu.)
    const isMenuToggleKey =
      e.key === '`' || e.key === '~' || e.key === 'Home' || e.key === 'ContextMenu';
    const activeModal = getActiveModal();
    if (activeModal && !isMenuToggleKey) {
      handleModalKeydown(e, activeModal);
      return; // Chặn mọi xử lý điều hướng menu phía dưới
    }

    // Allow Enter and Space to work normally when any exam modal is open
    const startExamModal = document.getElementById('start-exam-modal');
    const manualEntryModal = document.getElementById('manual-entry-modal');
    const isInStartExamModal = startExamModal && startExamModal.style.display === 'flex';
    const isInManualModal = manualEntryModal && manualEntryModal.style.display === 'flex';
    const isInAnyExamModal = isInStartExamModal || isInManualModal;

    if ((e.key === 'Enter' || e.key === ' ') && isInAnyExamModal) {
      return; // Let browser handle Enter/Space for form submission in exam modals
    }

    // Toggle sidebar with backquote/tilde key (both Shift states for stability)
    if (e.key === '`' || e.key === '~' || e.key === 'Home' || e.key === 'ContextMenu') {
      e.preventDefault();
      toggleSidebar();
      if (isMenuVisible()) {
        menuFocusIndex = 0;
        updateMenuFocus();
      }
      return;
    }

    // Keyboard navigation only when menu is visible
    if (isMenuVisible()) {
      const items = getMenuItems();
      if (items.length === 0) return;

      // ---- Action keys: OK / Accept / Enter / Space / keyCode 18 ----
      // These only click the currently focused item; they never move focus.
      const isActionKey =
        e.key === 'OK' ||
        e.key === 'Accept' ||
        e.key === 'Enter' ||
        e.key === ' ';

      if (isActionKey) {
        e.preventDefault();
        const focused = items[menuFocusIndex];
        if (focused) {
          focused.click();
          // If it's a nav button, trigger its action
          if (focused.dataset.nav === 'settings') {
            // Trigger settings
            const settingsBtn = document.getElementById('settings-btn');
            if (settingsBtn) settingsBtn.click();
          } else if (focused.dataset.nav === 'calibration') {
            // Trigger calibration
            const calibBtn = document.getElementById('cc-calib-btn');
            if (calibBtn) calibBtn.click();
          } else if (focused.dataset.nav === 'fullscreen') {
            // Trigger fullscreen
            const fsBtn = document.getElementById('fullscreen-btn');
            if (fsBtn) fsBtn.click();
          }
        }
        return;
      }

      // ---- Tab / Shift+Tab: move to next / previous item in DOM order ----
      if (e.key === 'Tab') {
        e.preventDefault();
        if (menuFocusIndex === -1) {
          menuFocusIndex = 0;
          updateMenuFocus();
          return;
        }
        const step = e.shiftKey ? -1 : 1;
        menuFocusIndex = (menuFocusIndex + step + items.length) % items.length;
        updateMenuFocus();
        return;
      }

      // ---- Arrow keys: 2D spatial navigation ----
      let direction = null;
      if (e.key === 'ArrowUp') direction = 'up';
      else if (e.key === 'ArrowDown') direction = 'down';
      else if (e.key === 'ArrowLeft') direction = 'left';
      else if (e.key === 'ArrowRight') direction = 'right';

      if (direction) {
        e.preventDefault();
        // If nothing is focused yet, start at the first element
        if (menuFocusIndex === -1) {
          menuFocusIndex = 0;
          updateMenuFocus();
          return;
        }
        const newIndex = findClosestElementInDirection(menuFocusIndex, direction, items);
        if (newIndex !== -1) {
          menuFocusIndex = newIndex;
          updateMenuFocus();
        }
      }
    }
  });

  // Mouse: Forward button (button 4) to toggle menu
  // Air mouse / universal remote: Backward button (button 3) to toggle menu
  document.addEventListener('mouseup', (e) => {
    if (e.button === 4 || e.button === 3) {
      e.preventDefault();
      toggleSidebar();
      if (isMenuVisible()) {
        menuFocusIndex = 0;
        updateMenuFocus();
      }
    }
  });

  // Also intercept mousedown for these buttons to suppress browser back/forward nav
  document.addEventListener('mousedown', (e) => {
    if (e.button === 4 || e.button === 3) {
      e.preventDefault();
    }
  }, true);

  // Fallback: auxclick fires on some browsers for non-primary mouse buttons
  document.addEventListener('auxclick', (e) => {
    if (e.button === 4 || e.button === 3) {
      e.preventDefault();
      toggleSidebar();
      if (isMenuVisible()) {
        menuFocusIndex = 0;
        updateMenuFocus();
      }
    }
  });

  // Mouse: hover bottom-left corner to reveal menu
  document.addEventListener('mousemove', (e) => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    // Show sidebar when mouse enters bottom-left 120x120px corner
    if (e.clientX < 120 && e.clientY > window.innerHeight - 120) {
      sidebar.classList.remove('sidebar-hidden');
    }
  });

  // ---- Fullscreen toggle button (top-right of sidebar header) ----
  const fsBtn = document.getElementById('fullscreen-btn');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.();
      }
    });
  }
}

// ================================================================
//  UniversalInput Wiring
// ================================================================

/** @type {UniversalInput|null} - Global reference to UniversalInput instance */
let universalInput = null;

function setupInput() {
  universalInput = new UniversalInput({ logToConsole: true });

  document.addEventListener('app:next', () => nextStep());
  document.addEventListener('app:prev', () => prevStep());
  document.addEventListener('app:back', () => back());
  document.addEventListener('app:shuffle', () => shuffleStep());

  universalInput.attach();
  return universalInput;
}

// ================================================================
//  Display Manager
// ================================================================

let displayManager = null;

function setupDisplay() {
  displayManager = new DisplayManager({
    targetSelector: '#app',
    autoApply: true,
  });
  window.__displayManager = displayManager;

  // Nút Bánh răng trên Sidebar Header → mở thẳng màn hình "Hiệu chỉnh thước đo"
  // (không còn Menu Popup "Cài đặt hiển thị" trung gian nào nữa).
  function setupSettingsButton() {
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.__calibrator && typeof window.__calibrator.showModal === 'function') {
          window.__calibrator.showModal();
        } else {
          console.error('[Main] window.__calibrator is not initialized!');
        }
      });
    } else {
      console.error('[Main] Settings button (#settings-btn) not found in DOM!');
    }
  }

  // Đợi DOM ready nếu cần
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSettingsButton);
  } else {
    setupSettingsButton();
  }

  return displayManager;
}

// ================================================================
//  Display Calibrator
// ================================================================

let calibrator = null;

function setupCalibrator() {
  calibrator = new DisplayCalibrator({ autoLoad: true });
  // Rào cản #1: Hiệu chuẩn vật lý bằng thẻ tín dụng (chính xác nhất)
  const ccCal = new CreditCardCalibrator({ calibrator });

  // Nút riêng trên header sidebar — mở trực tiếp, không cần qua settings.
  // Đảm bảo DOM đã load xong
  function setupCCButton() {
    const ccBtn = document.getElementById('cc-calib-btn');
    if (ccBtn) {
      ccBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.__ccCal) {
          window.__ccCal.showModal();
        } else {
          console.error('[Main] window.__ccCal is not initialized!');
        }
      });
    } else {
      console.error('[Main] Credit card button (#cc-calib-btn) not found in DOM!');
    }
  }
  
  // Đợi DOM ready nếu cần
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupCCButton);
  } else {
    setupCCButton();
  }

  window.__calibrator = calibrator;
  window.__ccCal = ccCal;  // Expose for cross-module access (e.g., stereo_anaglyph warning)

  // Tự động khôi phục (hydrate) PPI từ hiệu chuẩn thẻ tín dụng khi tải lại trang
  const savedCcPxPerMm = localStorage.getItem('vision-therapy-cc-pxpermm');
  if (savedCcPxPerMm) {
    const savedPpi = parseFloat(savedCcPxPerMm) * 25.4;
    if (!isNaN(savedPpi) && savedPpi > 0) {
      window.__calibrator.ppi = savedPpi;
      window.__calibrator.pxPerMm = parseFloat(savedCcPxPerMm);
    }
  }

  return calibrator;
}

// ================================================================
//  Workspace Toggle — Diagnostic / Therapeutic Switching
// ================================================================

/**
 * Current workspace: 'diagnostic' | 'therapeutic'
 */
let currentWorkspace = 'diagnostic';

/**
 * Ép UI về khu vực Khám (Diagnostic) và đảm bảo #display-board hiển thị.
 * Dùng trước khi khởi động Combo để tránh màn hình trắng khi đang ở Luyện tập.
 */
function ensureDiagnosticWorkspace() {
  if (currentWorkspace !== 'diagnostic') {
    toggleWorkspace();
  }
  // Đảm bảo DOM sẵn sàng cho việc render test chẩn đoán
  const diagnosticEl = document.getElementById('workspace-diagnostic');
  if (diagnosticEl) {
    diagnosticEl.classList.add('active');
    diagnosticEl.style.display = 'flex';
  }
  const board = document.getElementById('display-board');
  if (board) {
    board.style.display = 'block';
    board.classList.remove('hidden');
  }
}

/**
 * Toggle between Diagnostic (Phòng khám) and Therapeutic (Huấn luyện) workspaces.
 * Dispatches CustomEvent 'onWorkspaceChanged' for modules to cleanup.
 */
function toggleWorkspace() {
  const diagnosticEl = document.getElementById('workspace-diagnostic');
  const therapeuticEl = document.getElementById('workspace-therapeutic');
  const toggleBtn = document.getElementById('workspace-toggle-btn');
  
  // Menu elements for workspace switching
  const menuDiag = document.getElementById('menu-diagnostic');
  const menuTher = document.getElementById('menu-therapeutic');

  if (!diagnosticEl || !therapeuticEl || !toggleBtn) {
    console.warn('[Workspace] One or more elements not found!');
    return;
  }

  if (currentWorkspace === 'diagnostic') {
    // Switch TO Therapeutic
    // IMPORTANT: Dispatch event BEFORE changing visibility, so modules can cleanup
    document.dispatchEvent(new CustomEvent('onWorkspaceChanged', {
      detail: { fromWorkspace: 'diagnostic', toWorkspace: 'therapeutic', timestamp: Date.now() }
    }));

    // Switch main workspace area
    diagnosticEl.classList.remove('active');
    diagnosticEl.style.display = 'none';
    therapeuticEl.classList.add('active');
    therapeuticEl.style.display = 'flex';

    // Switch sidebar menu
    if (menuDiag) menuDiag.style.display = 'none';
    if (menuTher) {
      // Render lại đúng bố cục theo Phác đồ hiện tại mỗi lần chuyển sang Luyện tập
      if (typeof window.refreshTherapeuticMenu === 'function') {
        window.refreshTherapeuticMenu();
      } else {
        menuTher.style.display = 'block';
      }
    }

    // Update toggle button icon → clinic-medical (return to diagnostic)
    const icon = toggleBtn.querySelector('i');
    if (icon) {
      icon.className = 'fas fa-clinic-medical';
    }
    toggleBtn.setAttribute('title', 'Quay lại Phòng khám');
    toggleBtn.setAttribute('aria-label', 'Quay lại Phòng khám');

    currentWorkspace = 'therapeutic';

    // Lưu vết workspace để F5 khôi phục đúng tab
    try { localStorage.setItem('currentWorkspace', currentWorkspace); } catch (e) { /* ignore */ }

  } else {
    // Switch TO Diagnostic
    document.dispatchEvent(new CustomEvent('onWorkspaceChanged', {
      detail: { fromWorkspace: 'therapeutic', toWorkspace: 'diagnostic', timestamp: Date.now() }
    }));

    // Switch main workspace area
    therapeuticEl.classList.remove('active');
    therapeuticEl.style.display = 'none';
    diagnosticEl.classList.add('active');
    diagnosticEl.style.display = 'flex';

    // Switch sidebar menu
    if (menuTher) menuTher.style.display = 'none';
    if (menuDiag) menuDiag.style.display = 'grid';

    // Update toggle button icon → gamepad (go to therapeutic)
    const icon = toggleBtn.querySelector('i');
    if (icon) {
      icon.className = 'fas fa-gamepad';
    }
    toggleBtn.setAttribute('title', 'Huấn luyện thị giác');
    toggleBtn.setAttribute('aria-label', 'Chuyển đổi sang Huấn luyện thị giác');

    currentWorkspace = 'diagnostic';

    // Lưu vết workspace để F5 khôi phục đúng tab
    try { localStorage.setItem('currentWorkspace', currentWorkspace); } catch (e) { /* ignore */ }
  }
}

/**
 * Setup workspace toggle button event listener.
 * Must be called after DOM is ready.
 */
function setupWorkspaceToggle() {
  const toggleBtn = document.getElementById('workspace-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleWorkspace();
    });
  } else {
    console.warn('[Workspace] Toggle button #workspace-toggle-btn not found in DOM!');
  }
}

// ================================================================
//  Bootstrap
// ================================================================

function init() {
  window.__state = state;
  window.__getTestModule = getTestModule;

  setupSidebar();
  setupInput();
  setupDisplay();
  setupCalibrator();
  setupWorkspaceToggle(); // Wire up workspace toggle button

  // ================================================================
  //  Phục hồi toàn bộ thông số hiệu chuẩn sau khi tải lại trang (F5)
  // ================================================================

  // 1. Khoảng cách đo (vision-therapy-calibrate-distance-m)
  const savedDist = localStorage.getItem('vision-therapy-calibrate-distance-m');
  if (savedDist && parseFloat(savedDist) > 0 && window.__calibrator) {
    window.__calibrator.distanceM = parseFloat(savedDist);
  }

  // 2. Màu kính Anaglyph (vision_color_calibration) — dự phòng cho __anaglyphColors
  try {
    const savedColors = localStorage.getItem('vision_color_calibration');
    if (savedColors) {
      const c = JSON.parse(savedColors);
      if (c && c.red && c.cyan) {
        window.__anaglyphColors = { red: c.red, cyan: c.cyan };
        document.documentElement.style.setProperty('--calibrated-red', c.red);
        document.documentElement.style.setProperty('--calibrated-cyan', c.cyan);
      }
    }
  } catch (e) { /* ignore */ }

  // 3. Khôi phục Workspace (Khám / Luyện tập) — không văng về mặc định
  const savedWorkspace = localStorage.getItem('currentWorkspace');
  if (savedWorkspace === 'therapeutic' && currentWorkspace === 'diagnostic') {
    toggleWorkspace();
  }

  // Listen for visionTestCompleted event to resume UniversalInput
  document.addEventListener('visionTestCompleted', (e) => {
    if (universalInput) {
      universalInput.resume();
    }
    // Combo: checkpoint (Auto Stereo Random Dot) có thể đã đổi → cập nhật banner
    if (typeof window.updateComboBanner === 'function') {
      window.updateComboBanner();
    }
    // Combo: thu thập chỉ số + hiển thị Global Result Modal giữa các bài
    if (window.__comboQueue) {
      const detail = e.detail || {};
      collectComboResult(detail);
      // Bài cuối cùng (Stereo) hoàn thành & queue rỗng → đóng gói record EMR
      if (window.__comboQueue.length === 0 && detail.test_type === 'Auto Stereo Random Dot') {
        persistComboRecord();
      }
      showComboResultModal(detail);
    }
  });

  /**
   * Hiển thị Global Result Modal cho từng bài trong Combo.
   */
  function showComboResultModal(detail) {
    const modal = document.getElementById('global-result-modal');
    if (!modal) return;
    const nameEl = document.getElementById('res-modal-name');
    const durationEl = document.getElementById('res-modal-duration');
    const scoreEl = document.getElementById('res-modal-score');
    if (nameEl) nameEl.innerText = detail.test_type || 'Combo Test';
    if (durationEl) durationEl.innerText = 'Vừa hoàn thành';
    if (scoreEl) {
      const metrics = detail.clinical_metrics || {};
      const html = Object.entries(metrics)
        .map(([k, v]) => `<div style="margin:4px 0;"><strong>${k}:</strong> ${v}</div>`)
        .join('');
      scoreEl.innerHTML = html || '-';
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    modal.style.display = 'flex';
    if (typeof window.enhanceModalUX === 'function') {
      window.enhanceModalUX(modal);
    }
  }

  // ================================================================
  //  Combo Test Engine — khởi động & chuyển tiếp tự động
  // ================================================================

  // Nút [Bắt đầu Combo] trên Notification Banner — delegation vì banner được
  // tạo động trong #menu-therapeutic bởi updateComboBanner()
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.id === 'amblyopia-combo-start-btn' ? e.target : null;
    if (!btn) return;
    // Ngăn chặn chạy combo 2 lần: disable ngay khi bấm
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';

    // Ép chuyển workspace về Khám (Diagnostic) trước khi render Master Lobby,
    // tránh kẹt màn hình trắng nếu đang đứng ở khu vực Luyện tập.
    ensureDiagnosticWorkspace();

    startCombo();
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('sidebar-hidden');
  });

  // Sau khi người dùng đóng Global Result Modal → tự động chuyển bài tiếp theo
  const _origCloseGlobalResultModal = window.closeGlobalResultModal;
  window.closeGlobalResultModal = function() {
    if (typeof _origCloseGlobalResultModal === 'function') {
      try {
        _origCloseGlobalResultModal();
      } catch (err) {
        const modal = document.getElementById('global-result-modal');
        if (modal) modal.style.display = 'none';
      }
    }
    if (window.__comboQueue && window.__comboQueue.length > 0) {
      setTimeout(advanceCombo, 150);
    } else {
      // Hết combo (đã xong bài cuối) → dọn queue an toàn
      window.__comboQueue = null;
    }
    if (typeof window.updateComboBanner === 'function') {
      window.updateComboBanner();
    }
  };

  // ================================================================
  //  Mini-EMR localStorage Integration — Therapeutic Session Logger
  //  Delegated to ExamSessionManager for unified storage management
  // ================================================================
  document.addEventListener('onTherapeuticSessionEnd', (e) => {
    // Build therapy record from event detail
    const therapyRecord = {
      id: 'THR-' + Date.now(),
      timestamp: e.detail.timestamp,
      gameName: e.detail.gameName,
      durationSeconds: Math.round(e.detail.durationMs / 1000),
      metrics: e.detail.metrics,
      opticalSettings: e.detail.opticalSettings
    };

    // Delegate to ExamSessionManager for storage
    if (window.examSessionManager && typeof window.examSessionManager.addTherapyRecord === 'function') {
        const success = window.examSessionManager.addTherapyRecord(therapyRecord);
        if (!success) {
            alert('Vui long tao phien kham truoc khi luu ket qua!');
        }
    } else {
        console.error('[EMR CORE] Khong tim thay instance cua ExamSessionManager.');
        alert('Loi he thong: Khong tim thay quan ly phiem kham. Vui long refresh trang.');
    }

    // Phát sự kiện kết thúc bài tập để Global Result Modal hiển thị
    // (Chuẩn hóa payload từ mọi game M1..M12 — chỉ hiển thị khi đã lưu thành công)
    const gameId = String(e.detail.gameName || '').match(/M\d+/);
    document.dispatchEvent(new CustomEvent('therapy_session_completed', {
        detail: {
            gameId: gameId ? gameId[0] : '',
            gameName: e.detail.gameName,
            duration: Math.round(e.detail.durationMs / 1000),
            score: (e.detail.metrics && e.detail.metrics.score) || 0,
            metrics: e.detail.metrics && e.detail.metrics.customData ? e.detail.metrics.customData : (e.detail.metrics || {})
        }
    }));
  });

  // Load default test
  const mod = getTestModule(state.currentTest);
  if (mod) {
    state.steps = mod.steps;
    renderStep();
  }

  // [DEEP LINKING ROUTER] Kiểm tra tham số URL để mở trực tiếp module từ Docs
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  const moduleId = urlParams.get('module');

  if (action === 'practice' && moduleId) {
    // 1. Chuyển sang workspace Phòng tập (nếu đang ở màn hình chẩn đoán có icon gamepad)
    const workspaceBtn = document.getElementById('workspace-toggle-btn');
    if (workspaceBtn && workspaceBtn.innerHTML.includes('fa-gamepad')) {
      workspaceBtn.click();
    }

    // 2. Trì hoãn nhẹ để DOM lưới Lobby kịp mount, sau đó bung Modal của Module
    setTimeout(() => {
      if (typeof window.startTherapyModule === 'function') {
        // Chuẩn hóa mã module: 'M01'/'M1'/'m01' → 'M1' (khớp khóa _moduleIdByM)
        let mId = String(moduleId || '').trim().toUpperCase();
        mId = mId.replace(/^M0+(\d+)$/, 'M$1');
        if (/^M\d+$/.test(mId)) {
          window.startTherapyModule(mId);
        } else {
          console.warn('[DeepLink] Mã module không hợp lệ:', moduleId);
        }
      }
    }, 300);

    // 3. Xóa query params trên thanh địa chỉ để chống kẹt luồng khi F5 (Refresh)
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({path: cleanUrl}, '', cleanUrl);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ================================================================
//  Unified Report: Therapy Data Parser & Report Generator
// ================================================================

/**
 * Format clinical metrics string based on module type
 * @param {Object} metrics - The metrics object from therapy record
 * @returns {string} Formatted clinical result string
 */
function formatTherapyClinicalResult(input) {
    // Hỗ trợ truyền cả record (có .metrics) hoặc metrics trực tiếp
    const metrics = (input && input.metrics) ? input.metrics : input;
    const gameName = metrics?.gameName || input?.gameName || '';

    // Combo Đánh Giá Nhược Thị — 7 thông số OD/OS + Stereo (KHÔNG đánh giá ĐẠT/CHƯA ĐẠT)
    if (gameName === 'Combo Đánh Giá Nhược Thị') {
        const cd = metrics?.customData || {};
        const fmtVA = (v) => (v === undefined || v === null || isNaN(v))
            ? 'N/A'
            : `${Math.round(v * 10)}/10`;
        const fmtCS = (v) => (v === undefined || v === null || isNaN(v))
            ? 'N/A'
            : v.toFixed(2);
        const fmtStereo = (v) => {
            if (v === undefined || v === null || isNaN(v)) return 'N/A';
            return v >= 800 ? 'Trượt' : `${v} giây cung`;
        };
        const duration = input.durationSeconds != null ? `${input.durationSeconds} giây` : 'N/A';
        return `Xa: OD ${fmtVA(cd.distance_OD)}, OS ${fmtVA(cd.distance_OS)} | ` +
               `Gần: OD ${fmtVA(cd.near_OD)}, OS ${fmtVA(cd.near_OS)} | ` +
               `Tương phản: OD ${fmtCS(cd.contrast_OD)}, OS ${fmtCS(cd.contrast_OS)} | ` +
               `Hình nổi: ${fmtStereo(cd.stereo)} | Thời gian: ${duration}`;
    }

    // Ưu tiên xử lý M11 (chặn rơi vào khối C-Ratio mặc định của M1)
    if (gameName && gameName.includes('M11')) {
        let logCS = metrics?.customData?.finalLogCS || 0;
        let revs = metrics?.customData?.reversals || 0;

        // Chuyển đổi LogCS sang % tương phản
        let contrastPct = (Math.pow(10, -logCS) * 100).toFixed(1);

        // Phân loại diễn giải theo mốc lâm sàng
        let interpretation = "";
        if (logCS >= 1.5) {
            interpretation = "Đạt mục tiêu nhược thị nhẹ (Tiệm cận mắt người bình thường)";
        } else if (logCS >= 1.3) {
            interpretation = "Đạt mục tiêu nhược thị trung bình";
        } else if (logCS >= 1.0) {
            interpretation = "Đạt mục tiêu nhược thị nặng";
        } else {
            interpretation = "Chưa đạt ngưỡng tối thiểu (Cần đạt ≥ 1.0 LogCS)";
        }

        return `LogCS: <b>${logCS.toFixed(2)}</b> (Tương phản: <b>${contrastPct}%</b>) | Đảo chiều: ${revs}<br><small><i>Diễn giải: ${interpretation}</i></small>`;
    }

    // Module 12: Dichoptic Smooth Pursuit — tracking accuracy & out-of-bounds
    if (gameName && gameName.includes('M12')) {
        let accuracy = metrics?.customData?.trackingAccuracy || 0;
        let outOfBounds = metrics?.customData?.outOfBoundsHits || 0;
        return `Chính xác bám đuôi: <b>${accuracy.toFixed(1)}%</b> | Chệch hướng: ${outOfBounds} lần`;
    }

    // Module 1: Contrast threshold fusion (C-Ratio)
    if (gameName.startsWith('M1:') || metrics?.moduleType === 1) {
        const alpha = metrics.customData?.finalAlpha;
        const level = metrics.customData?.level;
        if (alpha !== undefined && alpha !== null) {
            const levelStr = level !== undefined && level !== null ? ` | Level ${level}` : '';
            return `Ngưỡng tương phản dung hợp (C-Ratio): ${ (alpha * 100).toFixed(0) }%${levelStr}`;
        }
    }

    // Module 2: Foveal visual angle
    if (gameName.startsWith('M2:') || metrics?.moduleType === 2) {
        const angle = metrics.customData?.visualAngleDeg;
        const lv = metrics.customData?.level;
        const streak = metrics.customData?.streak;
        if (angle !== undefined && angle !== null) {
            return `Góc thị giác Foveal: ${ angle.toFixed(2) }°${ lv ? ` | Level ${ lv }` : '' }${ streak !== undefined ? ` | Chuỗi: ${ streak }/5` : '' }`;
        }
    }

    // Module 3: Vergence measurements (BO/BI)
    if (gameName.startsWith('M3:') || metrics?.moduleType === 3) {
        const bo = metrics.customData?.avgBaseOut;
        const bi = metrics.customData?.avgBaseIn;
        if (bo !== undefined && bo !== null && bi !== undefined && bi !== null) {
            return `Hội tụ (BO): ${ bo.toFixed(1) } Δ | Phân kỳ (BI): ${ bi.toFixed(1) } Δ`;
        }
    }

    // Module 4: Saccadic (reaction time)
    if (gameName.startsWith('M4:') || metrics?.moduleType === 4) {
        const latency = metrics.customData?.avgLatencyMs;
        const lv = metrics.customData?.level;
        if (latency !== undefined && latency !== null) {
            return `Thời gian phản xạ: ${ latency } ms${ lv ? ` | Level ${ lv }` : '' }`;
        }
    }

    // Module 5: Global Stereopsis (RDS) — Arcsec
    if (gameName.startsWith('M5:') || metrics?.moduleType === 5) {
        const finalArcsec = metrics.customData?.finalArcsec;
        if (finalArcsec !== undefined && finalArcsec !== null) {
            return `Ngưỡng thị giác nổi (Stereoacuity): ${ finalArcsec } Arcsec`;
        }
    }

    // Module 13: Convergence Therapy (M13) — Dự trữ Hợp thị Hội tụ (PFV - Positive Fusional Vergence)
    // LƯU Ý: Phải đặt TRƯỚC khối M3 vì chuỗi 'M13' chứa 'M3'
    if (gameName && gameName.includes('M13')) {
        const diopter = metrics?.customData?.finalConvergenceDiopter ?? metrics?.finalConvergenceDiopter ?? metrics?.score;
        if (diopter !== undefined && diopter !== null) {
            return `Dự trữ Hợp thị Hội tụ (PFV): <strong style="color: #00e676;">${diopter} &Delta;</strong>`;
        }
    }

    // Module 6: Divergence Therapy (M6) — Dự trữ Hợp thị Phân kỳ (NFV - Negative Fusional Vergence)
    const gameId = input?.gameId || metrics?.gameId || '';
    if (gameId === 'M6' || (gameName && gameName.includes('M6'))) {
        const diopter = metrics?.customData?.finalDivergenceDiopter ?? metrics?.finalDivergenceDiopter ?? metrics?.score;
        if (diopter !== undefined && diopter !== null) {
            return `Dự trữ Hợp thị Phân kỳ (NFV): <strong style="color: #00e676;">${diopter} &Delta;</strong>`;
        }
    }

    // Module 7: CAM Visual Stimulator (Monocular) — accuracy & reaction time
    if (gameName.includes('M7')) {
        const acc = metrics.customData?.accuracyRate;
        const rt = metrics.customData?.avgReactionTimeMs;
        if (acc !== undefined && acc !== null && rt !== undefined && rt !== null) {
            return `Tỷ lệ chính xác: ${ acc.toFixed(0) }% | Phản xạ: ${ rt.toFixed(0) } ms`;
        }
    }

    // Module 8: Anti-Crowding Tracker (Monocular) — accuracy & narrowest spacing
    if (gameName.includes('M8')) {
        const acc = metrics.customData?.accuracy;
        const minSpacing = metrics.customData?.minimumSpacingReached;
        if (acc !== undefined && acc !== null) {
            return `Chính xác: ${ acc.toFixed(0) }% | Khoảng cách hẹp nhất: ${ minSpacing !== undefined ? minSpacing : 'N/A' }`;
        }
    }

    // Module 9: RED-Cone Stimulator (Monocular) — accuracy & avg reaction time
    if (gameName.includes('M9')) {
        const acc = metrics.customData?.accuracy;
        const rt = metrics.customData?.avgReactionTimeMs;
        const lv = metrics.customData?.level;
        if (acc !== undefined && acc !== null && rt !== undefined && rt !== null) {
            return `Chính xác: ${ acc.toFixed(0) }% | Phản xạ trung bình: ${ rt.toFixed(0) } ms${ lv ? ` | Level ${ lv }` : '' }`;
        }
    }

    // Module 10: OKN Tracker (Monocular) — accuracy & avg reaction time
    if (gameName.includes('M10')) {
        const acc = metrics.customData?.accuracy;
        const rt = metrics.customData?.avgReactionTimeMs;
        const lv = metrics.customData?.level;
        if (acc !== undefined && acc !== null && rt !== undefined && rt !== null) {
            return `Chính xác: ${ acc.toFixed(0) }% | Phản xạ trung bình: ${ rt.toFixed(0) } ms${ lv ? ` | Level ${ lv }` : '' }`;
        }
    }

    // Fallback: generic score
    const score = metrics?.score;
    if (score !== undefined && score !== null) {
        return `Hoàn thành bài tập: Score ${ score }`;
    }

    return 'Hoàn thành bài tập';
}

/**
 * Generate therapy report HTML for a given patient
 * Reads therapy_records from localStorage emr_patient_sessions
 * @param {string} patientId - The patient identifier
 * @returns {string} HTML string for Part II of unified report
 */
function generateTherapyReportHTML(patientId) {
    let sessions = [];
    try {
        sessions = JSON.parse(localStorage.getItem('emr_patient_sessions') || '[]');
    } catch (e) {
        console.warn('[TherapyReport] Failed to parse emr_patient_sessions:', e);
        sessions = [];
    }
    
    const activeSession = sessions.find(s => s.patientId === patientId);
    const records = activeSession && Array.isArray(activeSession.therapy_records)
        ? activeSession.therapy_records
        : [];
    
    if (records.length === 0) {
        return `<p style="font-style: italic; color: #64748b;">Không thực hiện huấn luyện thị giác trong phiên khám này.</p>`;
    }
    
    // Build table rows
    let rowsHTML = '';
    records.forEach((record, index) => {
        // Format timestamp
        let timeStr = '-';
        if (record.timestamp) {
            try {
                const ts = new Date(record.timestamp);
                timeStr = ts.toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (e) {
                timeStr = record.timestamp;
            }
        }
        
        // Game name
        const gameName = record.gameName || '-';
        
        // Duration in seconds
        const durationSec = record.durationSeconds != null ? record.durationSeconds : '-';
        
        // === LOGIC MỚI: Parse customData & đánh giá ĐẠT/CHƯA ĐẠT ===
        // === Sử dụng hàm định dạng tập trung formatTherapyClinicalResult ===
        const clinicalResultString = formatTherapyClinicalResult(record);

        // Tính isPassed (ĐẠT/CHƯA ĐẠT) theo từng module
        const cd = record.metrics?.customData || {};
        const isComboRecord = record.gameName === 'Combo Đánh Giá Nhược Thị';
        let isPassed = false;
        if (isComboRecord) {
            // Combo là bài đánh giá tổng hợp — không xét ĐẠT/CHƯA ĐẠT
            isPassed = false;
        } else if (record.gameName.startsWith('M1:')) {
            isPassed = (cd.finalAlpha ?? 1) <= 0.5;
        } else if (record.gameName.includes('M2')) {
            // M2: QUA MÀN khi khớp khung đủ 5 lần LIÊN TIẾP (passed=true)
            isPassed = cd.passed === true;
        } else if (record.gameName.includes('M3')) {
            isPassed = (cd.avgBaseOut ?? 0) >= 15 && (cd.avgBaseIn ?? 0) >= 8;
        } else if (record.gameName.includes('M4')) {
            // TIÊU CHÍ QUA MÀN ĐỘNG M4 theo Chặng (dựa trên Level đã lưu trong customData)
            const lvl = parseInt(cd.level ?? 1, 10) || 1;
            const acc = cd.accuracy ?? 0;
            const rt = cd.avgLatencyMs ?? 0;
            const isTouch = (cd.deviceType === 'Cảm ứng')
                || (navigator.maxTouchPoints > 0 && cd.deviceType !== 'Chuột');
            if (lvl <= 3) {
                isPassed = acc > 90;
            } else if (lvl <= 6) {
                isPassed = acc > 85 && rt > 0 && rt <= 1500;
            } else if (lvl <= 9) {
                isPassed = acc > 85 && rt > 0 && rt <= 1000;
            } else {
                const t = isTouch ? 600 : 800;
                isPassed = acc > 90 && rt > 0 && rt <= t;
            }
        } else if (record.gameName.includes('M5')) {
            isPassed = (cd.finalArcsec ?? 0) > 0 && (cd.finalArcsec ?? 0) <= 40;
        } else if (record.gameName.includes('M13')) {
            isPassed = (cd.maxDiopter ?? 0) >= (cd.targetDiopter ?? 15);
        } else if (record.gameName.includes('M6')) {
            isPassed = (cd.maxDiopter ?? 0) >= (cd.targetDiopter ?? 8);
        } else if (record.gameName.includes('M7')) {
            isPassed = (cd.accuracyRate ?? 0) >= 80 && (cd.avgReactionTimeMs ?? 0) <= 800;
        } else if (record.gameName.includes('M8')) {
            isPassed = (cd.accuracy ?? 0) >= 75;
        } else if (record.gameName.includes('M9')) {
            // M9: Chính xác > 85% VÀ Phản xạ < 1200ms (nới lỏng hơn M4 — mắt lười Giai đoạn 1)
            isPassed = (cd.accuracy ?? 0) > 85 && (cd.avgReactionTimeMs ?? 0) > 0 && (cd.avgReactionTimeMs ?? 0) < 1200;
        } else if (record.gameName.includes('M10')) {
            isPassed = (cd.accuracy ?? 0) >= 80;
        } else if (record.gameName.includes('M12')) {
            // M12: Accuracy bám đuôi > 85%
            isPassed = (cd.trackingAccuracy ?? 0) > 85;
        } else if (record.gameName.includes('M11')) {
            isPassed = (cd.finalLogCS ?? 0) >= 1.0 && (cd.reversals ?? 0) >= 4;
        }

        const statusHTML = isComboRecord
            ? '<span style="color:#2563eb; font-weight:bold;">ĐÃ HOÀN THÀNH</span>'
            : (isPassed
                ? '<span style="color:#16a34a; font-weight:bold;">ĐẠT</span>'
                : '<span style="color:#dc2626; font-weight:bold;">CHƯA ĐẠT</span>');

        const resultHTML = `${clinicalResultString}<br>Đánh giá: ${statusHTML}`;
        
        rowsHTML += `
            <tr>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${ index + 1 }</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px;">${ timeStr }</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px;">${ gameName }</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${ durationSec }</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px;">${ resultHTML }</td>
            </tr>`;
    });
    
    return `
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-top: 10px;">
            <thead>
                <tr style="background-color: #f1f5f9;">
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 50px;">STT</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Thời gian</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px;">Phác đồ</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Thời lượng (giây)</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px;">Kết quả lâm sàng</th>
                </tr>
            </thead>
            <tbody>
                ${ rowsHTML }
            </tbody>
        </table>`;
}

export { state, loadTest, nextStep, prevStep, back, registerTestModule, testModules, generateTherapyReportHTML };

// Expose globally for non-module scripts (exam_session_manager.js)
if (typeof window !== 'undefined') {
    window.generateTherapyReportHTML = generateTherapyReportHTML;
}
