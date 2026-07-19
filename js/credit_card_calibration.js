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
        <span class="cc-modal-title">Hiệu chuẩn vật lý (thẻ tín dụng)</span>
        <button class="cc-modal-close" aria-label="Đóng">&times;</button>
      </div>
      <div class="cc-modal-body">
        <p class="cc-instruction">
          1. Đặt một thẻ tín dụng/chứng minh thư lên màn hình.<br/>
          2. Kéo thanh trượt bên dưới cho đến khi <b>hình chữ nhật ảo khớp
          chính xác</b> với chiều rộng thẻ (85.6&nbsp;mm).<br/>
          3. Nhấn "Xác nhận" để lưu tỷ lệ pixel/mm.
        </p>
        <div class="cc-stage">
          <div class="cc-card" id="ccCard"><span class="cc-card-label">85.6 mm</span></div>
        </div>
        <input type="range" id="ccSlider" class="cc-slider"
               min="100" max="1200" step="1" value="400" />
        <div class="cc-readout" id="ccReadout"></div>
      </div>
      <div class="cc-modal-footer">
        <button class="cc-btn-cancel">Huỷ</button>
        <button class="cc-btn-confirm">Xác nhận</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this._overlay = overlay;

    const card = box.querySelector('#ccCard');
    const slider = box.querySelector('#ccSlider');
    const readout = box.querySelector('#ccReadout');

    // Khởi tạo kích thước từ giá trị đã lưu (nếu có)
    const initPx = this._pxPerMm > 0
      ? Math.round(this._pxPerMm * CREDIT_CARD_WIDTH_MM)
      : 400;
    slider.value = initPx;
    this._applySize(card, slider.value, readout);

    slider.addEventListener('input', () => {
      this._applySize(card, slider.value, readout);
    });

    box.querySelector('.cc-modal-close')
      .addEventListener('click', () => this.hideModal());
    box.querySelector('.cc-btn-cancel')
      .addEventListener('click', () => this.hideModal());
    box.querySelector('.cc-btn-confirm').addEventListener('click', () => {
      this._confirm(parseFloat(slider.value));
      this.hideModal();
    });

    document.addEventListener('keydown', this._boundKeydown);
  }

  /** @private */
  _applySize(card, pxWidth, readout) {
    const w = parseFloat(pxWidth);
    const h = w * (CREDIT_CARD_HEIGHT_MM / CREDIT_CARD_WIDTH_MM);
    card.style.width = w + 'px';
    card.style.height = h + 'px';
    const ppm = w / CREDIT_CARD_WIDTH_MM;
    if (readout) {
      readout.textContent =
        `${w.toFixed(0)} px = ${CREDIT_CARD_WIDTH_MM} mm  →  ${ppm.toFixed(3)} px/mm  (${ (ppm * 25.4).toFixed(1) } PPI)`;
    }
  }

  /** @private */
  _confirm(pxWidth) {
    this._pxPerMm = pxWidth / CREDIT_CARD_WIDTH_MM;
    try { localStorage.setItem(CC_STORAGE_KEY, String(this._pxPerMm)); } catch (e) {}

    if (this.calibrator) {
      // Ghi đè PPI của calibrator bằng giá trị vật lý chính xác
      this.calibrator.ppi = this.ppi;
      this.calibrator.pxPerMm = this._pxPerMm;
      this.calibrator._inputMode = 'cc';
      this.calibrator._saveToStorage();
      this.calibrator._recalculate();
      console.log(
        `%c[CreditCardCalibrator]%c ${this._pxPerMm.toFixed(3)} px/mm | ${this.ppi.toFixed(1)} PPI (vật lý)`,
        'color:#27ae60;font-weight:700;', 'color:#555;'
      );
    }
  }

  hideModal() {
    if (!this._overlay) return;
    document.removeEventListener('keydown', this._boundKeydown);
    this._overlay.remove();
    this._overlay = null;
  }

  _onKeydown(e) {
    if (e.key === 'Escape') this.hideModal();
  }
}

export default CreditCardCalibrator;
export { CREDIT_CARD_WIDTH_MM, CREDIT_CARD_HEIGHT_MM };
