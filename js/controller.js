/**
 * UniversalInput — Hệ thống nhận diện tín hiệu chuẩn y khoa.
 *
 * Hỗ trợ đồng thời:
 *   - Bàn phím  (KeyboardEvent)
 *   - Chuột     (MouseEvent + WheelEvent)
 *   - Cảm ứng   (TouchEvent — swipe)
 *
 * Phát CustomEvent lên document:  'app:next' | 'app:prev' | 'app:back' | 'app:shuffle'
 * để tách biệt hoàn toàn khỏi logic module test.
 *
 * Usage:
 *   const input = new UniversalInput();
 *   input.attach();
 *   // Lắng nghe ở main.js:
 *   document.addEventListener('app:next', (e) => nextStep(e.detail.source));
 */

// ================================================================
//  Throttle utility
// ================================================================

/**
 * Tạo phiên bản throttle của hàm `fn`.
 * Trong khoảng thời gian `cooldown` (ms) hàm chỉ được gọi tối đa 1 lần.
 * Lần gọi cuối cùng trong khoảng sẽ được lưu và chạy sau khi hết cooldown.
 *
 * @param {Function} fn
 * @param {number}   cooldown  Thời gian chờ (ms)
 * @returns {Function}
 */
function throttle(fn, cooldown) {
  let lastCall = 0;
  let timeoutId = null;

  return function throttled(...args) {
    const now = Date.now();
    const remaining = cooldown - (now - lastCall);

    if (remaining <= 0) {
      // Đã đủ thời gian chờ → gọi ngay (leading edge)
      // Hủy timeout trễ (nếu có) để không gọi thừa
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      fn.apply(this, args);
    } else if (!timeoutId) {
      // Chưa đủ → lên lịch gọi ĐÚNG 1 LẦN sau khi hết cooldown (trailing edge)
      // lastCall sẽ được cập nhật tại thời điểm thực thi thực tế
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

// ================================================================
//  UniversalInput
// ================================================================

class UniversalInput {
  /**
   * @param {Object} [options]
   * @param {number} [options.swipeThreshold=50]  Pixel tối thiểu để nhận swipe.
   * @param {number} [options.wheelCooldown=250]  Throttle wheel (ms).
   * @param {boolean} [options.logToConsole=true] Log action ra console.
   */
  constructor(options = {}) {
    this.swipeThreshold = options.swipeThreshold ?? 50;
    this.wheelCooldown  = options.wheelCooldown  ?? 250;
    this.logToConsole   = options.logToConsole   ?? true;

    /** @type {'NEXT'|'PREV'|'BACK'|null} */
    this.lastAction = null;

    /** Callback cũ (optional) — giữ tương thích. */
    this.onAction = null;

    /** @type {boolean} - Flag to suspend/resume input handling */
    this.isSuspended = false;

    // --- Bound handlers ---
    this._boundKeydown      = this._onKeydown.bind(this);
    this._boundMouseDown    = this._onMouseDown.bind(this);
    this._boundContextMenu  = this._onContextMenu.bind(this);
    this._boundWheel        = throttle(this._onWheel.bind(this), this.wheelCooldown);
    this._boundTouchStart   = this._onTouchStart.bind(this);
    this._boundTouchMove    = this._onTouchMove.bind(this);
    this._boundTouchEnd     = this._onTouchEnd.bind(this);

    /** @private */
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._isAttached = false;

    // --- Gamepad support for flying mouse ---
    this._gamepadCheckInterval = null;
  }

  /**
   * Check for gamepad input (some flying mice appear as gamepads)
   * @private
   */
  _checkGamepads() {
    if (!navigator.getGamepads) return;

    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.connected) {
        for (let j = 0; j < gp.buttons.length; j++) {
          if (gp.buttons[j].pressed && gp.buttons[j].value > 0.5) {
            // Map gamepad button 0 (A) or 1 (B) to NEXT action
            if (j === 0 || j === 1) {
              this._emit('NEXT', { source: 'gamepad', button: j });
            }
          }
        }
      }
    }
  }

  /**
   * Suspend input handling - all events will be ignored until resume() is called.
   */
  suspend() {
    this.isSuspended = true;
  }

  /**
   * Resume input handling - events will be processed again.
   */
  resume() {
    this.isSuspended = false;
  }

  // ================================================================
  //  Lifecycle
  // ================================================================

  /**
   * Bắt đầu lắng nghe (gắn listener vào document / window).
   * An toàn khi gọi nhiều lần.
   */
  attach() {
    if (this._isAttached) return;
    this._isAttached = true;

    const doc = document;
    const win = window;

    // Keyboard - with capture to catch all
    doc.addEventListener('keydown', this._boundKeydown, true);

    // Mouse
    doc.addEventListener('mousedown', this._boundMouseDown);
    win.addEventListener('contextmenu', this._boundContextMenu);

    // Wheel (bỏ passive để có thể gọi e.preventDefault() chặn scroll trang)
    doc.addEventListener('wheel', this._boundWheel);

    // Touch (bỏ passive để có thể gọi e.preventDefault() chặn swipe Back/Forward)
    doc.addEventListener('touchstart', this._boundTouchStart);
    doc.addEventListener('touchmove',  this._boundTouchMove);
    doc.addEventListener('touchend',   this._boundTouchEnd);
  }

  /**
   * Dừng lắng nghe và dọn dẹp.
   */
  detach() {
    if (!this._isAttached) return;
    this._isAttached = false;

    const doc = document;
    const win = window;

    doc.removeEventListener('keydown',    this._boundKeydown);
    doc.removeEventListener('mousedown',  this._boundMouseDown);
    win.removeEventListener('contextmenu', this._boundContextMenu);
    doc.removeEventListener('wheel',      this._boundWheel);
    doc.removeEventListener('touchstart', this._boundTouchStart);
    doc.removeEventListener('touchmove',  this._boundTouchMove);
    doc.removeEventListener('touchend',   this._boundTouchEnd);
  }

  // ================================================================
  //  1. Bàn phím (KeyboardEvent)
  // ================================================================

  /**
   * @param {KeyboardEvent} e
   * @private
   */
  _onKeydown(e) {
    // 0. Kiểm tra suspend - bỏ qua nếu đang bị tạm dừng
    if (this.isSuspended) return;

    // 1. Bảo vệ nhập liệu: bỏ qua khi đang gõ trong form / editable
    //     Bỏ qua khi focus nằm trong modal (để form submit hoạt động bình thường)
    const t = e.target;
    if (
      t &&
      (t.tagName === 'INPUT' ||
       t.tagName === 'TEXTAREA' ||
       t.tagName === 'SELECT' ||
       t.isContentEditable ||
       t.tagName === 'BUTTON' ||
       t.closest('.exam-modal'))
    ) {
      return; // không xử lý phím, không gọi preventDefault()
    }

    // 2. Chặn key spam: bỏ qua mọi phím khi người dùng giữ (e.repeat)
    if (e.repeat) return;

    // 3. Handle non-standard keys by keyCode (flying mouse OK button)
    if (e.keyCode === 18 || e.keyCode === 123) {
      const keyCodeStr = e.keyCode === 18 ? '18' : '123';
      this._emit('NEXT', { source: 'keyboard', key: 'OK', keyCode: e.keyCode });
      e.preventDefault();
      return;
    }

    let action = null;

    switch (e.key) {
      // ----- NEXT -----
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
        action = 'NEXT';
        e.preventDefault();
        break;

      case 'Enter':
        action = 'NEXT';
        e.preventDefault();
        break;

      // ----- PREV -----
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        action = 'PREV';
        e.preventDefault();
        break;

      // ----- BACK -----
      case 'Escape':
      case 'Backspace':
        action = 'BACK';
        e.preventDefault();
        break;

      // ----- SHUFFLE (đổi chữ tại chỗ, giữ nguyên LogMAR) -----
      case ' ':
        action = 'SHUFFLE';
        e.preventDefault();
        break;

      default:
        return;
    }

    this._emit(action, { source: 'keyboard', key: e.key });
  }

  // ================================================================
  //  2. Chuột (MouseEvent)
  // ================================================================

  /**
   * mousedown: left button → NEXT, right button → PREV.
   * @param {MouseEvent} e
   * @private
   */
  _onMouseDown(e) {
    // Kiểm tra suspend - bỏ qua nếu đang bị tạm dừng
    if (this.isSuspended) return;

    // Bỏ qua tương tác trên button, link, input…
    const tag = e.target?.closest('button, a, input, select, textarea, [role="button"]');
    if (tag) return;

    if (e.button === 0) {
      // Chuột trái → NEXT
      this._emit('NEXT', { source: 'mouse', button: 'left' });
    } else if (e.button === 1) {
      // Chuột giữa (nút cuộn) → SHUFFLE (đổi chữ, giữ nguyên LogMAR)
      this._emit('SHUFFLE', { source: 'mouse', button: 'middle' });
    } else if (e.button === 2) {
      // Chuột phải → PREV
      this._emit('PREV', { source: 'mouse', button: 'right' });
    }
  }

  /**
   * Chặn menu chuột phải trình duyệt.
   * @param {MouseEvent} e
   * @private
   */
  _onContextMenu(e) {
    // Kiểm tra suspend - bỏ qua nếu đang bị tạm dừng
    if (this.isSuspended) return;

    e.preventDefault();
  }

  // ================================================================
  //  3. Con lăn chuột (WheelEvent) — throttle 250ms
  // ================================================================

  /**
   * wheel: cuộn xuống → NEXT, cuộn lên → PREV.
   * Đã được bọc bằng throttle() trong constructor.
   * @param {WheelEvent} e
   * @private
   */
  _onWheel(e) {
    // Kiểm tra suspend - bỏ qua nếu đang bị tạm dừng
    if (this.isSuspended) return;

    if (e.deltaY > 0) {
      this._emit('NEXT', { source: 'wheel', deltaY: e.deltaY });
    } else if (e.deltaY < 0) {
      this._emit('PREV', { source: 'wheel', deltaY: e.deltaY });
    } else {
      return; // deltaY === 0 → không chặn scroll
    }

    // Chặn trang web bị cuộn lết khi bác sĩ lăn chuột đổi test
    e.preventDefault();
  }

  // ================================================================
  //  4. Cảm ứng (TouchEvent) — swipe left / right
  // ================================================================

  /**
   * @param {TouchEvent} e
   * @private
   */
  _onTouchStart(e) {
    // Kiểm tra suspend - bỏ qua nếu đang bị tạm dừng
    if (this.isSuspended) return;

    const touch = e.changedTouches[0];
    if (!touch) return;
    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY;
  }

  /**
   * Phát hiện swipe ngang.
   * @param {TouchEvent} e
   * @private
   */
  _onTouchEnd(e) {
    // Kiểm tra suspend - bỏ qua nếu đang bị tạm dừng
    if (this.isSuspended) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - this._touchStartX;
    const dy = touch.clientY - this._touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < this.swipeThreshold || absDx < absDy) return;

    const action = dx < 0 ? 'NEXT' : 'PREV';
    this._emit(action, { source: 'touch', deltaX: dx });
  }

  /**
   * Chặn xung đột vuốt trình duyệt (Back/Forward) khi vuốt ngang.
   * Chỉ gọi preventDefault khi người dùng thực sự vuốt ngang
   * (|dx| > |dy|) để không cản trở cuộn dọc bình thường.
   * @param {TouchEvent} e
   * @private
   */
  _onTouchMove(e) {
    // Kiểm tra suspend - bỏ qua nếu đang bị tạm dừng
    if (this.isSuspended) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - this._touchStartX;
    const dy = touch.clientY - this._touchStartY;

    // Vuốt ngang → chặn trình duyệt điều hướng Back/Forward trên mobile/tablet
    if (Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
    }
  }

  // ================================================================
  //  Event Dispatching — CustomEvent
  // ================================================================

  /**
   * Phát tín hiệu: log console + dispatch CustomEvent + callback cũ.
   *
   * @param {'NEXT'|'PREV'|'BACK'|'SHUFFLE'} action
   * @param {Object} [detail={}]
   * @private
   */
  _emit(action, detail = {}) {
    this.lastAction = action;

    // 1. Console log
    if (this.logToConsole) {
      console.log(
        `%c[UniversalInput] %c${action}%c  —  ${JSON.stringify(detail)}`,
        'color:#888; font-weight:300;',
        'color:#4a90d9; font-weight:700;',
        'color:#555; font-weight:300;'
      );
    }

    // 2. Dispatch CustomEvent lên document
    const eventName = `app:${action.toLowerCase()}`;  // app:next, app:prev, app:back, app:shuffle
    document.dispatchEvent(new CustomEvent(eventName, {
      bubbles: true,
      detail: detail,
    }));

    // 3. Callback cũ (optional)
    if (typeof this.onAction === 'function') {
      this.onAction(action, detail);
    }
  }
}

// ================================================================
//  Export
// ================================================================
export default UniversalInput;
export { UniversalInput, throttle };