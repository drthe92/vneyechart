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

  // Ensure UniversalInput is always resumed when loading a test
  // Modules should NOT have their own conflicting event handlers
  if (universalInput) {
    universalInput.resume();
    console.log(`[Main] Resumed UniversalInput for module: ${testId}`);
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

  // Centralised sidebar toggle helper
  function toggleSidebar(forceShow) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (forceShow === true) {
      sidebar.classList.remove('sidebar-hidden');
      // Enable module switching when menu is visible
      if (universalInput) {
        universalInput.enableModuleSwitching();
        console.log('[Main] Enabled module switching - menu opened');
      }
    } else if (forceShow === false) {
      sidebar.classList.add('sidebar-hidden');
      // Disable module switching when menu is hidden
      if (universalInput) {
        universalInput.disableModuleSwitching();
        console.log('[Main] Disabled module switching - menu closed');
      }
    } else {
      sidebar.classList.toggle('sidebar-hidden');
      // Toggle module switching based on menu visibility
      if (universalInput) {
        if (sidebar.classList.contains('sidebar-hidden')) {
          universalInput.disableModuleSwitching();
          console.log('[Main] Disabled module switching - menu closed');
        } else {
          universalInput.enableModuleSwitching();
          console.log('[Main] Enabled module switching - menu opened');
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
  const getMenuItems = () => Array.from(document.querySelectorAll('.menu-item, .nav-btn'));

  function updateMenuFocus() {
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
      focused.scrollIntoView({ block: 'nearest' });
      focused.focus();
    }
  }

  function isMenuVisible() {
    const sidebar = document.getElementById('sidebar');
    return sidebar && !sidebar.classList.contains('sidebar-hidden');
  }

  // Keyboard: Tab / Home / ContextMenu to toggle menu (as before)
  // When menu is visible: Arrow keys navigate, Enter/OK selects
  document.addEventListener('keydown', (e) => {
    // Allow Tab and Enter to work normally when any exam modal is open
    const startExamModal = document.getElementById('start-exam-modal');
    const manualEntryModal = document.getElementById('manual-entry-modal');
    const isInStartExamModal = startExamModal && startExamModal.style.display === 'flex';
    const isInManualModal = manualEntryModal && manualEntryModal.style.display === 'flex';
    const isInAnyExamModal = isInStartExamModal || isInManualModal;

    if (e.key === 'Tab' && isInAnyExamModal) {
      return; // Let browser handle Tab navigation in exam modals
    }

    if ((e.key === 'Enter' || e.key === ' ') && isInAnyExamModal) {
      return; // Let browser handle Enter/Space for form submission in exam modals
    }

    if (e.key === 'Tab' || e.key === 'Home' || e.key === 'ContextMenu') {
      e.preventDefault();
      toggleSidebar();
      if (isMenuVisible()) {
        menuFocusIndex = 0;
        updateMenuFocus();
      }
      return;
    }

    // Arrow-key navigation only when menu is visible
    if (isMenuVisible()) {
      const items = getMenuItems();
      if (items.length === 0) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'OK' || e.key === 'Accept' || e.key === 'Enter' || e.keyCode === 18) {
        e.preventDefault();
        if (e.key === 'OK' || e.key === 'Accept' || e.key === 'Enter' || e.keyCode === 18) {
          // OK/Accept/Enter key selects the focused item
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
        } else {
          menuFocusIndex = (menuFocusIndex + 1) % items.length;
          updateMenuFocus();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        menuFocusIndex = (menuFocusIndex - 1 + items.length) % items.length;
        updateMenuFocus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        // Enter / Space to select the focused module
        e.preventDefault();
        const focused = items[menuFocusIndex];
        if (focused) focused.click();
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
//  Workspace Toggle — Diagnostic / Therapeutic Switching
// ================================================================

/**
 * Current workspace: 'diagnostic' | 'therapeutic'
 */
let currentWorkspace = 'diagnostic';

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
      menuTher.style.display = 'flex';
      menuTher.style.alignItems = 'center';
      menuTher.style.justifyContent = 'center';
    }

    // Update toggle button icon → clinic-medical (return to diagnostic)
    const icon = toggleBtn.querySelector('i');
    if (icon) {
      icon.className = 'fas fa-clinic-medical';
    }
    toggleBtn.setAttribute('title', 'Quay lại Phòng khám');
    toggleBtn.setAttribute('aria-label', 'Quay lại Phòng khám');

    currentWorkspace = 'therapeutic';
    console.log('[Workspace] Switched to: Huấn luyện thị giác (Therapeutic)');

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
    console.log('[Workspace] Switched to: Phòng khám (Diagnostic)');
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
    console.log('[Workspace] Toggle button wired up successfully');
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

  // Listen for visionTestCompleted event to resume UniversalInput
  document.addEventListener('visionTestCompleted', (e) => {
    console.log('[Main] visionTestCompleted event received, resuming UniversalInput');
    if (universalInput) {
      universalInput.resume();
    }
  });

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
        if (success) {
            console.log('[EMR CORE] Da ban giao du lieu Game cho Manager xu ly.');
        } else {
            alert('Vui long tao phien kham truoc khi luu ket qua!');
        }
    } else {
        console.error('[EMR CORE] Khong tim thay instance cua ExamSessionManager.');
        alert('Loi he thong: Khong tim thay quan ly phiem kham. Vui long refresh trang.');
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

// ================================================================
//  Unified Report: Therapy Data Parser & Report Generator
// ================================================================

/**
 * Format clinical metrics string based on module type
 * @param {Object} metrics - The metrics object from therapy record
 * @returns {string} Formatted clinical result string
 */
function formatTherapyClinicalResult(metrics) {
    const gameName = metrics?.gameName || '';
    
    // Module 1: Contrast threshold fusion (C-Ratio)
    if (gameName === 'M1' || metrics?.moduleType === 1) {
        const alpha = metrics.customData?.finalAlpha;
        if (alpha !== undefined && alpha !== null) {
            return `Ngưỡng tương phản dung hợp (C-Ratio): ${ (alpha * 100).toFixed(0) }%`;
        }
    }
    
    // Module 2: Foveal visual angle
    if (gameName === 'M2' || metrics?.moduleType === 2) {
        const angle = metrics.customData?.visualAngleDeg;
        if (angle !== undefined && angle !== null) {
            return `Góc thị giác Foveal tối thiểu: ${ angle.toFixed(2) }°`;
        }
    }
    
    // Module 3: Vergence measurements (BO/BI)
    if (gameName === 'M3' || metrics?.moduleType === 3) {
        const bo = metrics.customData?.avgBaseOut;
        const bi = metrics.customData?.avgBaseIn;
        if (bo !== undefined && bo !== null && bi !== undefined && bi !== null) {
            return `Hội tụ (BO): ${ bo.toFixed(1) } Δ | Phân kỳ (BI): ${ bi.toFixed(1) } Δ`;
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
        let resultHTML = "";
        let statusHTML = "";
        const customData = record.metrics?.customData || {};
        const durStr = record.durationSeconds != null ? record.durationSeconds + "s" : "N/A";
        
        if (record.gameName && record.gameName.includes('M1')) {
            const cRatio = customData.finalAlpha !== undefined ? customData.finalAlpha : 1;
            const isPassed = cRatio <= 0.5; // Đạt khi C-Ratio <= 0.5
            statusHTML = isPassed ? '<span style="color:#16a34a; font-weight:bold;">ĐẠT</span>' : '<span style="color:#dc2626; font-weight:bold;">CHƯA ĐẠT</span>';
            resultHTML = `C-Ratio: <b>${(cRatio * 100).toFixed(0)}%</b> | Thời gian: <b>${durStr}</b><br>Đánh giá: ${statusHTML}`;
        }
        else if (record.gameName && record.gameName.includes('M2')) {
            const angle = customData.visualAngleDeg !== undefined ? customData.visualAngleDeg : 0;
            const isPassed = angle > 0 && angle <= 2.0; // Đạt khi Góc Foveal <= 2 độ
            statusHTML = isPassed ? '<span style="color:#16a34a; font-weight:bold;">ĐẠT</span>' : '<span style="color:#dc2626; font-weight:bold;">CHƯA ĐẠT</span>';
            resultHTML = `Góc Foveal: <b>${angle.toFixed(2)}°</b> | Thời gian: <b>${durStr}</b><br>Đánh giá: ${statusHTML}`;
        }
        else if (record.gameName && record.gameName.includes('M3')) {
            const bo = customData.avgBaseOut !== undefined ? customData.avgBaseOut : 0;
            const bi = customData.avgBaseIn !== undefined ? customData.avgBaseIn : 0;
            const isPassed = bo >= 15 && bi >= 8; // Đạt khi BO >= 15 và BI >= 8
            statusHTML = isPassed ? '<span style="color:#16a34a; font-weight:bold;">ĐẠT</span>' : '<span style="color:#dc2626; font-weight:bold;">CHƯA ĐẠT</span>';
            resultHTML = `BO: <b>${bo.toFixed(1)} Δ</b> | BI: <b>${bi.toFixed(1)} Δ</b><br>Đánh giá: ${statusHTML}`;
        }
        else if (record.gameName && record.gameName.includes('M4')) {
            const latency = customData.avgLatencyMs !== undefined ? customData.avgLatencyMs : 0;
            // Đọc thiết bị lưu từ phiên tập (fallback nhận diện hiện tại nếu dữ liệu cũ)
            const device = customData.deviceType || (navigator.maxTouchPoints > 0 ? 'Cảm ứng' : 'Chuột');
            
            // Áp dụng định luật Fitts cho ngưỡng lâm sàng
            const threshold = device === 'Cảm ứng' ? 500 : 900;
            const isPassed = latency > 0 && latency <= threshold;
            
            statusHTML = isPassed ? '<span style="color:#16a34a; font-weight:bold;">ĐẠT</span>'
                                 : '<span style="color:#dc2626; font-weight:bold;">CHƯA ĐẠT</span>';
            
            resultHTML = `Thời gian phản xạ: <b>${latency} ms</b> | Thiết bị: <b>${device}</b><br>Đánh giá: ${statusHTML}`;
        }
        else if (record.gameName && record.gameName.includes('M5')) {
            // Module 5: Global Stereopsis (RDS Therapy) — Arcsec threshold
            const finalArcsec = (customData && customData.finalArcsec) ? customData.finalArcsec : 0;
            
            // Đánh giá lâm sàng (<= 40 Arcsec là bình thường, > 40 là suy giảm)
            let statusHTML = '';
            if (finalArcsec > 0 && finalArcsec <= 40) {
                statusHTML = '<span style="color:#16a34a; font-weight:bold;">ĐẠT (Thị giác nổi hoàn hảo)</span>';
            } else if (finalArcsec > 40 && finalArcsec <= 200) {
                statusHTML = '<span style="color:#eab308; font-weight:bold;">CHƯA ĐẠT (Suy giảm nhẹ)</span>';
            } else {
                statusHTML = '<span style="color:#dc2626; font-weight:bold;">CHƯA ĐẠT (Suy giảm nặng / Mất thị giác nổi)</span>';
            }
            
            // Xử lý hiển thị an toàn nếu bệnh nhân không click trúng lần nào
            const arcsecDisplay = finalArcsec > 0 ? `${finalArcsec} Arcsec` : 'Không xác định (Fail)';
            
            resultHTML = `Ngưỡng thị giác nổi (Stereoacuity): <b style="font-size:1.1em;">${arcsecDisplay}</b> | Thời gian tập: <b>${durStr}</b><br>Đánh giá: ${statusHTML}`;
        }
        else {
            const score = record.metrics?.score || 0;
            resultHTML = `Score: <b>${score}</b>`;
        }
        
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