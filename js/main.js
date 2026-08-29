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
registerTestModule(autoBcvaCrowdingModule); // id: 'far-vision-auto-bcva-crowding'
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
        console.log(`[Main] Đã cấp PPM cho Maddox Grid: ${cal.pixelsPerMm}`);
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
      switch (direction) {
        case 'up':
          inDirection = rect.bottom <= currentRect.top + EPSILON;
          break;
        case 'down':
          inDirection = rect.top >= currentRect.bottom - EPSILON;
          break;
        case 'left':
          inDirection = rect.right <= currentRect.left + EPSILON;
          break;
        case 'right':
          inDirection = rect.left >= currentRect.right - EPSILON;
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

  // Selectors that identify every popup/modal used across the project:
  //  - .exam-modal            → exam session modals (start/end/manual/report/history/clinic settings)
  //  - .settings-modal-overlay→ DisplayManager preset modal (js/settings.js)
  //  - .calib-modal-overlay   → distance-selection dialog (js/calibration.js)
  //  - .custom-modal / .modal → legacy fallbacks
  // NOTE: .cc-modal-overlay is intentionally EXCLUDED — js/credit_card_calibration.js
  // already implements its own dedicated arrow-key handling for its slider.
  const MODAL_SELECTOR = [
    '.exam-modal',
    '.settings-modal-overlay',
    '.calib-modal-overlay',
    '.custom-modal',
    '.modal'
  ].join(', ');

  /**
   * Quét DOM tìm Modal đang hiển thị.
   * Một Modal được coi là "active" nếu nó khớp MODAL_SELECTOR và đang hiển thị
   * trên màn hình (display !== 'none' hoặc có class .active).
   * @returns {HTMLElement|null}
   */
  function getActiveModal() {
    const candidates = document.querySelectorAll(MODAL_SELECTOR);
    for (const el of candidates) {
      if (!el.isConnected) continue;
      if (el.classList.contains('active')) return el;
      const style = window.getComputedStyle(el);
      if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
        return el;
      }
    }
    return null;
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
      'input:not([type="hidden"]):not([disabled]), ' +
      'select:not([disabled]), textarea:not([disabled]), ' +
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(modal.querySelectorAll(selector)).filter((el) => {
      // Loại bỏ phần tử không hiển thị (rect 0x0 hoặc display:none)
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      return true;
    });
  }

  /** Focus vào một item trong modal + cuộn nhẹ để đảm bảo nhìn thấy. */
  function focusModalItem(items, index) {
    const el = items[index];
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
      '.exam-modal-close',
      '.settings-modal-close',
      '[data-dismiss="modal"]',
      '.modal-close',
      '.cancel-btn',
      '.cc-modal-close',
      // Định danh nút đóng phổ biến bổ sung
      '.close',
      '.close-btn',
      '.btn-close',
      '.btn-secondary',
      '[aria-label="Close"]'
    ];
    for (const sel of closeSelectors) {
      const btn = modal.querySelector(sel);
      if (btn && btn.offsetParent !== null) {
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

  /**
   * Xử lý phím khi một Modal đang mở (Hybrid algorithm):
   *  - Escape / Backspace (nút Back trên remote) → đóng modal.
   *  - Enter / OK → trả lại trình duyệt (click nút đang focus / submit form).
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
    const focusIntoActiveModal = () => {
      scheduled = false;
      const modal = getActiveModal();
      if (!modal) return;
      // Đã có phần tử bên trong modal được focus → không can thiệp
      if (modal.contains(document.activeElement)) return;
      const items = getFocusableItems(modal);
      if (items.length === 0) return;
      // BẮT BUỘC lưu lại phần tử đang focus (nút trên menu chính) NGAY TRƯỚC
      // khi chuyển focus vào các ô nhập liệu bên trong modal,
      // phục vụ Focus Restoration khi modal đóng.
      const currentActive = document.activeElement;
      if (
        currentActive &&
        currentActive !== document.body &&
        currentActive !== document.documentElement &&
        !modal.contains(currentActive) &&
        typeof currentActive.focus === 'function'
      ) {
        lastFocusedElementBeforeModal = currentActive;
      }
      const target = items.find(isTextInput) || items[0];
      focusModalItem(items, items.indexOf(target));
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(focusIntoActiveModal);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  // Keyboard: Backquote (`) / Tilde (~) / Home / ContextMenu to toggle menu.
  // Tab is left entirely to the browser's native focus navigation (tab order).
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

    // Module 7: CAM Visual Stimulator (Monocular) — accuracy & reaction time
    else if (gameName.includes('M7')) {
        const acc = metrics.customData?.accuracyRate;
        const rt = metrics.customData?.avgReactionTimeMs;
        if (acc !== undefined && acc !== null && rt !== undefined && rt !== null) {
            return `Tỷ lệ chính xác: ${ acc.toFixed(0) }% | Phản xạ: ${ rt.toFixed(0) } ms`;
        }
    }

    // Module 8: Anti-Crowding Tracker (Monocular) — accuracy & narrowest spacing
    else if (gameName.includes('M8')) {
        const acc = metrics.customData?.accuracy;
        const minSpacing = metrics.customData?.minimumSpacingReached;
        if (acc !== undefined && acc !== null) {
            return `Chính xác: ${ acc.toFixed(0) }% | Khoảng cách hẹp nhất: ${ minSpacing !== undefined ? minSpacing : 'N/A' }`;
        }
    }

    // Module 9: RED-Cone Stimulator (Monocular) — accuracy & avg reaction time
    else if (gameName.includes('M9')) {
        const acc = metrics.customData?.accuracy;
        const rt = metrics.customData?.avgReactionTimeMs;
        if (acc !== undefined && acc !== null && rt !== undefined && rt !== null) {
            return `Chính xác: ${ acc.toFixed(0) }% | Phản xạ trung bình: ${ rt.toFixed(0) } ms`;
        }
    }

    // Module 10: OKN Tracker (Monocular) — accuracy & avg reaction time
    else if (gameName.includes('M10')) {
        const acc = metrics.customData?.accuracy;
        const rt = metrics.customData?.avgReactionTimeMs;
        const dir = metrics.customData?.direction;
        const spd = metrics.customData?.stripeSpeed;
        if (acc !== undefined && acc !== null && rt !== undefined && rt !== null) {
            return `Chính xác: ${ acc.toFixed(0) }% | Phản xạ trung bình: ${ rt.toFixed(0) } ms${ dir ? ` | Hướng: ${ dir }` : '' }${ spd ? ` | Tốc độ: ${ spd } px/s` : '' }`;
        }
    }

    // Module 11: Gabor Perceptual Learning (Monocular) — contrast threshold & reversals
    // TUYỆT ĐỐI KHÔNG kế thừa logic C-Ratio của Module 1; trích xuất độc lập từ customData.
    else if (gameName.includes('M11')) {
        const fc = metrics.customData?.finalContrast;
        const rev = metrics.customData?.reversals;
        if (fc !== undefined && fc !== null) {
            const revStr = (rev !== undefined && rev !== null) ? rev : 'N/A';
            return `Ngưỡng tương phản (C): ${ Number(fc).toFixed(3) } | Đảo chiều: ${ revStr }`;
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
        else if (record.gameName && record.gameName.includes('M7')) {
            const acc = customData.accuracyRate !== undefined ? customData.accuracyRate : 0;
            const rt = customData.avgReactionTimeMs !== undefined ? customData.avgReactionTimeMs : 0;
            // Đạt: Tỷ lệ chính xác >= 80% và Thời gian phản xạ <= 800ms
            const isPassed = acc >= 80 && rt <= 800;
            statusHTML = isPassed ? '<span style="color:#16a34a; font-weight:bold;">ĐẠT</span>' : '<span style="color:#dc2626; font-weight:bold;">CHƯA ĐẠT</span>';
            resultHTML = `Tỷ lệ chính xác: <b>${acc.toFixed(0)}%</b> | Phản xạ: <b>${rt.toFixed(0)} ms</b><br>Đánh giá: ${statusHTML}`;
        }
        else if (record.gameName && record.gameName.includes('M8')) {
            const acc = customData.accuracy !== undefined ? customData.accuracy : 0;
            const minSpacing = customData.minimumSpacingReached !== undefined ? customData.minimumSpacingReached : 'N/A';
            const finalSpacing = customData.finalSpacing !== undefined ? customData.finalSpacing : 'N/A';
            // Đạt: Tỷ lệ chính xác >= 75% (Ngưỡng lâm sàng khử chen chúc)
            const isPassed = acc >= 75;
            statusHTML = isPassed ? '<span style="color:#16a34a; font-weight:bold;">ĐẠT</span>' : '<span style="color:#dc2626; font-weight:bold;">CHƯA ĐẠT</span>';
            resultHTML = `Chính xác: <b>${acc.toFixed(0)}%</b> | Khoảng cách hẹp nhất: <b>${minSpacing}</b> | Khoảng cách cuối: <b>${finalSpacing}</b><br>Đánh giá: ${statusHTML}`;
        }
        else if (record.gameName && record.gameName.includes('M9')) {
            const acc = customData.accuracy !== undefined ? customData.accuracy : 0;
            const rt = customData.avgReactionTimeMs !== undefined ? customData.avgReactionTimeMs : 0;
            // Đạt: Độ chính xác >= 85% (ngưỡng lâm sàng Brinker-Katz)
            const isPassed = acc >= 85;
            statusHTML = isPassed ? '<span style="color:#16a34a; font-weight:bold;">ĐẠT</span>' : '<span style="color:#dc2626; font-weight:bold;">CHƯA ĐẠT</span>';
            resultHTML = `Chính xác: <b>${acc.toFixed(0)}%</b> | Phản xạ trung bình: <b>${rt.toFixed(0)} ms</b><br>Đánh giá: ${statusHTML}`;
        }
        else if (record.gameName && record.gameName.includes('M10')) {
            const acc = customData.accuracy !== undefined ? customData.accuracy : 0;
            const rt = customData.avgReactionTimeMs !== undefined ? customData.avgReactionTimeMs : 0;
            const dir = customData.direction || 'N/A';
            const spd = customData.stripeSpeed !== undefined ? customData.stripeSpeed : 0;
            const spawned = customData.targetsSpawned !== undefined ? customData.targetsSpawned : 0;
            const hit = customData.targetsHit !== undefined ? customData.targetsHit : 0;
            // Đạt: Độ chính xác >= 80% (ngưỡng lâm sàng OKN)
            const isPassed = acc >= 80;
            statusHTML = isPassed ? '<span style="color:#16a34a; font-weight:bold;">ĐẠT</span>' : '<span style="color:#dc2626; font-weight:bold;">CHƯA ĐẠT</span>';
            resultHTML = `Chính xác: <b>${acc.toFixed(0)}%</b> (${hit}/${spawned}) | Phản xạ trung bình: <b>${rt.toFixed(0)} ms</b> | Hướng: <b>${dir}</b> | Tốc độ: <b>${spd} px/s</b><br>Đánh giá: ${statusHTML}`;
        }
        else if (record.gameName && record.gameName.includes('M11')) {
            const fc = customData.finalContrast !== undefined ? customData.finalContrast : 1;
            const rev = customData.reversals !== undefined ? customData.reversals : 0;
            const acc = customData.accuracy !== undefined ? customData.accuracy : 0;
            const total = customData.totalTrials !== undefined ? customData.totalTrials : 0;
            const hit = customData.correctAnswers !== undefined ? customData.correctAnswers : 0;
            const rt = customData.avgReactionTimeMs !== undefined ? customData.avgReactionTimeMs : 0;
            // Đạt: ngưỡng tương phản thấp (<= 10%) và đã hội tụ (>= 4 đảo chiều)
            const isPassed = fc <= 0.1 && rev >= 4;
            statusHTML = isPassed ? '<span style="color:#16a34a; font-weight:bold;">ĐẠT</span>' : '<span style="color:#dc2626; font-weight:bold;">CHƯA ĐẠT</span>';
            resultHTML = `Ngưỡng tương phản: <b>${(fc * 100).toFixed(1)}%</b> | Đảo chiều: <b>${rev}</b> | Chính xác: <b>${acc.toFixed(0)}%</b> (${hit}/${total}) | Phản xạ: <b>${rt.toFixed(0)} ms</b><br>Đánh giá: ${statusHTML}`;
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