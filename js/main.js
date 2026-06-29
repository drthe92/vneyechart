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
import etdrsChart         from '../modules/etdrs_chart.js';
import { etdrsChartFarVision } from '../modules/etdrs_chart.js';
import snellenChart       from '../modules/snellen_chart.js';
import leaModule          from '../modules/lea_symbols.js';
import landoltCModule     from '../modules/landolt_c.js';
import tumblingEModule    from '../modules/tumbling_e.js';
import hotvModule         from '../modules/hotv.js';
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

// ----- Other modules -----
registerTestModule(hotvModule);            // id: 'far-vision-hotv'
registerTestModule(worth4dot);             // id: 'binocular'
registerTestModule(astigmatism);           // id: 'astigmatism'

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
  // Handle all accordions
  document.querySelectorAll('.menu-accordion').forEach(accordion => {
    const toggle = accordion.querySelector('.accordion-toggle');
    const children = accordion.querySelectorAll('.sub-item');
    let childActive = false;
    children.forEach(el => {
      if (el.dataset.test === testId) childActive = true;
    });
    toggle.classList.toggle('active', childActive);
  });
}

function setupSidebar() {
  // Accordion toggles (support multiple accordions)
  document.querySelectorAll('.menu-accordion').forEach(accordion => {
    const toggle = accordion.querySelector('.accordion-toggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        accordion.classList.toggle('expanded');
      });
    }
  });

  // Sub‑item clicks
  document.querySelectorAll('.menu-item.sub-item').forEach(el => {
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
          // Only switch if distance is > 0.5 m (i.e. currently in far vision mode)
          if (cal.distanceM > 0.5) {
            cal.applyNearVisionPreset();
          }
        }
      } else if (testId && (testId.startsWith('far-vision-') || testId === 'far-vision')) {
        // Auto‑switch to 3 m for far vision tests
        const cal = window.__calibrator;
        if (cal) {
          if (cal.distanceM < 0.5) {
            cal.applyDistanceVisionPreset();
          }
        }
      }

      highlightMenuItem(testId);
      loadTest(testId, mod.steps);
    });
  });

  // Other flat menu items
  document.querySelectorAll('.menu-item:not(.sub-item):not(.accordion-toggle)').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const testId = el.dataset.test;
      if (!testId || testId === state.currentTest) return;

      const mod = getTestModule(testId);
      if (!mod) return;

      highlightMenuItem(testId);
      loadTest(testId, mod.steps);
    });
  });
}

// ================================================================
//  UniversalInput Wiring
// ================================================================

function setupInput() {
  const input = new UniversalInput({ logToConsole: true });

  document.addEventListener('app:next', () => nextStep());
  document.addEventListener('app:prev', () => prevStep());
  document.addEventListener('app:back', () => back());
  document.addEventListener('app:shuffle', () => shuffleStep());

  input.attach();
  return input;
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
  window.__calibrator = calibrator;
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