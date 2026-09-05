/**
 * credit_card_calibration.js — Hiệu chuẩn quy mô vật lý bằng thẻ tín dụng.
 *
 * Rào cản kỹ thuật #1: Hiệu chuẩn Quy mô Vật lý (Physical Scale Calibration)
 * ---------------------------------------------------------------------------
 * Thay vì tin tưởng window.screen (chỉ trả về CSS pixels, sai lệch trên
 * màn hình Retina/High-DPI), module này yêu cầu người dùng đặt một thẻ
 * tín dụng chuẩn (85.6 mm × 53.98 mm) lên màn hình, sau đó kéo thanh
 * trượt cho đến khi hình chữ nhật ảo khớp kích thước thẻ. Từ đó tính
 * chính xác:
 *
 *     pxPerMm = sliderPixels / 85.6
 *     ppi     = pxPerMm × 25.4
 *
 * Kết quả được đẩy ngược vào DisplayCalibrator để getOptotypeSize() trả
 * về kích thước thị giác đúng trên mọi thiết bị.
 *
 * Export:
 *   - default: CreditCardCalibrator class
 */

const CREDIT_CARD_WIDTH_MM = 85.6;
const CREDIT_CARD_HEIGHT_MM = 53.98;
const CC_STORAGE_KEY = 'vision-therapy-cc-pxpermm';

class CreditCardCalibrator {
  /**
   * @param {Object} [options]
   * @param {DisplayCalibrator} [options.calibrator] Instance DisplayCalibrator để đẩy kết quả.
   */
  constructor(options = {}) {
    this.calibrator = options.calibrator || null;
    this._overlay = null;
    this._pxPerMm = 0;
    this._boundKeydown = this._onKeydown.bind(this);

    // Tự khôi phục nếu đã từng hiệu chuẩn
    try {
      const saved = localStorage.getItem(CC_STORAGE_KEY);
      if (saved) this._pxPerMm = parseFloat(saved);
    } catch (e) { /* ignore */ }
  }

  /** @returns {number} pixel/mm vật lý (số thực) */
  get pxPerMm() { return this._pxPerMm; }

  /** @returns {number} PPI vật lý (số thực) */
  get ppi() { return this._pxPerMm * 25.4; }

  /**
   * Hiển thị modal hiệu chuẩn thẻ tín dụng.
   */
  showModal() {
    if (this._overlay) return;

    const overlay = document.createElement('div');
    overlay.className = 'cc-modal-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hideModal();
    });

    const box = document.createElement('div');
    box.className = 'cc-modal-box';

    box.innerHTML = `
      <div class="cc-modal-header">
        <span class="cc-modal-title">Hiệu chuẩn vật lý (Thẻ tín dụng)</span>
        <button class="cc-modal-close" aria-label="Đóng">&times;</button>
      </div>
      <div class="cc-modal-body">
        <div class="cc-zoom-warning" style="background: #fff3cd; color: #856404; padding: 10px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #ffeeba;">
          ⚠️ <b>Cảnh báo quang học:</b> Đảm bảo trình duyệt đang ở mức <b>Zoom 100%</b> (Ctrl+0 / Cmd+0) trước khi hiệu chuẩn để tránh sai lệch mật độ điểm ảnh.
        </div>
        <p class="cc-instruction">
          1. Đặt thẻ tín dụng/CCCD chuẩn (85.6 mm) lên màn hình.<br/>
          2. Dùng thanh trượt, nút bấm [ - ] [ + ] hoặc <b>phím mũi tên (⬅ / ➡)</b> để khung viền ảo khớp chính xác với mép thẻ.<br/>
        </p>
        <div class="cc-stage" style="padding: 20px 0; display: flex; justify-content: center;">
          <div class="cc-card" id="ccCard" style="border: 2px solid #e74c3c; background: rgba(231, 76, 60, 0.1); box-sizing: border-box; display: flex; align-items: center; justify-content: center;">
            <span class="cc-card-label" style="color: #c0392b; font-weight: bold;">85.6 mm</span>
          </div>
        </div>
        <div class="cc-slider-container" style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
          <button id="ccBtnMinus" style="padding: 8px 16px; font-size: 1.2rem; cursor: pointer;">-</button>
          <input type="range" id="ccSlider" class="cc-slider" min="100" max="2500" step="0.5" value="400" style="flex: 1; cursor: pointer;" />
          <button id="ccBtnPlus" style="padding: 8px 16px; font-size: 1.2rem; cursor: pointer;">+</button>
        </div>
        <div class="cc-readout" id="ccReadout" style="text-align: center; font-family: monospace; font-size: 1.1em; color: #333;"></div>
      </div>
      <div class="cc-modal-footer">
        <button class="cc-btn-confirm" style="width: 100%;">Đóng & Hoàn tất</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this._overlay = overlay;

    const card = box.querySelector('#ccCard');
    const slider = box.querySelector('#ccSlider');
    const readout = box.querySelector('#ccReadout');
    const btnMinus = box.querySelector('#ccBtnMinus');
    const btnPlus = box.querySelector('#ccBtnPlus');

    // Khởi tạo kích thước từ giá trị đã lưu (nếu có)
    const initPx = this._pxPerMm > 0
      ? Math.round(this._pxPerMm * CREDIT_CARD_WIDTH_MM)
      : 400;
    slider.value = initPx;
    this._applySize(card, slider.value, readout);

    // Slider input event - real-time auto-save
    slider.addEventListener('input', () => {
      this._applySize(card, slider.value, readout);
      this._saveAndSync(parseFloat(slider.value));
    });

    // Button minus event
    btnMinus.addEventListener('click', () => {
      slider.value = Math.max(parseFloat(slider.min), parseFloat(slider.value) - 0.5);
      this._applySize(card, slider.value, readout);
      this._saveAndSync(parseFloat(slider.value));
    });

    // Button plus event
    btnPlus.addEventListener('click', () => {
      slider.value = Math.min(parseFloat(slider.max), parseFloat(slider.value) + 0.5);
      this._applySize(card, slider.value, readout);
      this._saveAndSync(parseFloat(slider.value));
    });

    // Close/Confirm buttons (data already saved in real-time)
    box.querySelector('.cc-modal-close')
      .addEventListener('click', () => this.hideModal());
    box.querySelector('.cc-btn-confirm')
      .addEventListener('click', () => this.hideModal());

    document.addEventListener('keydown', this._boundKeydown);
  }

  /** @private */
  _applySize(card, pxWidth, readout) {
    const w = parseFloat(pxWidth);
    const h = w * (CREDIT_CARD_HEIGHT_MM / CREDIT_CARD_WIDTH_MM);
    card.style.width = w + 'px';
    card.style.height = h + 'px';
    const ppm = w / CREDIT_CARD_WIDTH_MM;
    const dpr = window.devicePixelRatio || 1;
    if (readout) {
      readout.textContent =
        `${w.toFixed(0)} px = ${CREDIT_CARD_WIDTH_MM} mm  →  ${ppm.toFixed(3)} px/mm  (${ (ppm * 25.4).toFixed(1) } PPI)  |  DPR: ${dpr}`;
    }
  }

  /** @private */
  _saveAndSync(pxWidth) {
    this._pxPerMm = pxWidth / CREDIT_CARD_WIDTH_MM;
    try { localStorage.setItem(CC_STORAGE_KEY, String(this._pxPerMm)); } catch (e) {}

    // Đồng bộ ngay vào global __calibrator (kể cả khi chưa truyền instance calibrator)
    if (!window.__calibrator) window.__calibrator = {};
    window.__calibrator.ppi = this._pxPerMm * 25.4;
    window.__calibrator.pxPerMm = this._pxPerMm;

    if (this.calibrator) {
      this.calibrator.ppi = this.ppi;
      this.calibrator.pxPerMm = this._pxPerMm;
      this.calibrator._inputMode = 'cc';
      this.calibrator._saveToStorage();
      this.calibrator._recalculate();
    }
    // Trigger event để hệ thống re-render bảng thị lực ngay lập tức
    document.dispatchEvent(new CustomEvent('app:calibration_updated'));
  }

  hideModal() {
    if (!this._overlay) return;
    document.removeEventListener('keydown', this._boundKeydown);
    this._overlay.remove();
    this._overlay = null;
  }

  _onKeydown(e) {
    if (e.key === 'Escape') {
      this.hideModal();
      return;
    }
    
    if (!this._overlay) return;
    const slider = this._overlay.querySelector('#ccSlider');
    const card = this._overlay.querySelector('#ccCard');
    const readout = this._overlay.querySelector('#ccReadout');
    if (!slider || !card || !readout) return;

    const stepValue = 0.5;
    if (e.key === 'ArrowLeft') {
      slider.value = Math.max(parseFloat(slider.min), parseFloat(slider.value) - stepValue);
      this._applySize(card, slider.value, readout);
      this._saveAndSync(parseFloat(slider.value));
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      slider.value = Math.min(parseFloat(slider.max), parseFloat(slider.value) + stepValue);
      this._applySize(card, slider.value, readout);
      this._saveAndSync(parseFloat(slider.value));
      e.preventDefault();
    }
  }
}

export default CreditCardCalibrator;
export { CREDIT_CARD_WIDTH_MM, CREDIT_CARD_HEIGHT_MM };
