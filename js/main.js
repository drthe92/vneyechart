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
import numberChartModule  from '../modules/number_chart.js';
import hotvModule         from '../modules/hotv.js';
import aucklandLogmar     from '../modules/auckland_logmar.js';
import worth4dot          from '../modules/worth4dot.js';
import astigmatism        from '../modules/astigmatism.js';
import { amslerGrid, ishiharaTest, pelliRobson } from '../modules/retina_subs.js';

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
import schoberTestModule from '../modules/schober_test.js';
import dynamicFixationModule from '../modules/dynamic_fixation.js';
import hidingHeidiModule from '../modules/hiding_heidi.js';
import dynamicVergence from '../modules/dynamic_vergence.js';

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

  // Handle UniversalInput suspend/resume based on module's customControls flag
  const newMod = getTestModule(testId);
  if (universalInput) {
    if (newMod && newMod.customControls === true) {
      // Module uses custom controls - suspend UniversalInput
      universalInput.suspend();
      console.log(`[Main] Suspended UniversalInput for module: ${testId}`);
    } else {
      // Module uses standard controls - resume UniversalInput
      universalInput.resume();
      console.log(`[Main] Resumed UniversalInput for module: ${testId}`);
    }
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
      console.log(`[Main] Back: Keeping UniversalInput suspended for module: ${state.currentTest}`);
    } else {
      // Previous module uses standard controls - resume UniversalInput
      universalInput.resume();
      console.log(`[Main] Back: Resumed UniversalInput for module: ${state.currentTest}`);
    }
  }

  renderStep();
  highlightMenuItem(state.currentTest);
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
registerTestModule(numberChartModule);      // id: 'far-vision-numbers'
registerTestModule(aucklandLogmar);         // id: 'far-vision-auckland'

// ----- Other modules -----
registerTestModule(hotvModule);            // id: 'far-vision-hotv'
registerTestModule(worth4dot);             // id: 'binocular'
registerTestModule(astigmatism);           // id: 'astigmatism'
registerTestModule(stereoAnaglyphModule);  // id: 'binocular-stereo'

// ----- Retina sub‑modules -----
registerTestModule(amslerGrid);            // id: 'retina-amsler'
registerTestModule(ishiharaTest);          // id: 'retina-ishihara'
registerTestModule(pelliRobson);           // id: 'retina-pelli-robson'

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
      if (!testId || testId === state.currentTest) return;

      const mod = getTestModule(testId);
      if (!mod) return;

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

  // New keyboard/mouse triggers for sidebar toggle
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.toggle('sidebar-hidden');
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (e.button === 4) { // Forward mouse button (button 4)
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.toggle('sidebar-hidden');
    }
  });

  document.addEventListener('mousemove', (e) => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    // Show sidebar when mouse enters bottom-right 30x30px corner
    if (e.clientX > window.innerWidth - 30 && e.clientY > window.innerHeight - 30) {
      sidebar.classList.remove('sidebar-hidden');
    }
  });
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
  displayManager.wireSettingsButton();
  window.__displayManager = displayManager;
  return displayManager;
}

// ================================================================
//  Display Calibrator
// ================================================================

let calibrator = null;

function setupCalibrator() {
  calibrator = new DisplayCalibrator({ autoLoad: true });
  displayManager.addFooterAction('🔧 Hiệu chỉnh màn hình', () => {
    displayManager.hideModal();
    setTimeout(() => calibrator.showModal(), 200);
  });
  // Rào cản #1: Hiệu chuẩn vật lý bằng thẻ tín dụng (chính xác nhất)
  const ccCal = new CreditCardCalibrator({ calibrator });
  displayManager.addFooterAction('💳 Hiệu chuẩn thẻ tín dụng (85.6mm)', () => {
    // Mở trực tiếp — không qua settings, không setTimeout mong manh.
    ccCal.showModal();
  });

  // Nút riêng trên header sidebar — mở trực tiếp, không cần qua settings.
  // Đảm bảo DOM đã load xong
  function setupCCButton() {
    const ccBtn = document.getElementById('cc-calib-btn');
    if (ccBtn) {
      console.log('[Main] Credit card button found, adding event listener');
      ccBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('[Main] Credit card button clicked');
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
  return calibrator;
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

  // Listen for visionTestCompleted event to resume UniversalInput
  document.addEventListener('visionTestCompleted', (e) => {
    console.log('[Main] visionTestCompleted event received, resuming UniversalInput');
    if (universalInput) {
      universalInput.resume();
    }
  });

  // Load default test
  const mod = getTestModule(state.currentTest);
  if (mod) {
    state.steps = mod.steps;
    renderStep();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { state, loadTest, nextStep, prevStep, back, registerTestModule, testModules };