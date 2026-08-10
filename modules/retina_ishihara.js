/**
 * retina_ishihara.js — Ishihara Test Module
 * ===========================================
 *
 * Standalone module for Ishihara Color Test.
 * id: 'retina-ishihara'
 */

// ================================================================
//  Constants
// ================================================================

/** Ishihara image files (sorted alphabetically). */
const ISHIHARA_FILES = [
  'Ishihara_12.svg',
  'Ishihara_2.svg',
  'Ishihara_6.png',
  'Ishihara_74.svg',
  'ishihara_42.png',
  'ishihara_45.jpg',
  'ishihara_97.jpg',
  'shihara_3.jpg',
];

// ================================================================
//  Ishihara Test Module
// ================================================================

const ishiharaTest = {
  id: 'retina-ishihara',
  label: 'Ishihara Test',
  steps: ISHIHARA_FILES,

  /** Which view mode: 'grid' or 'slider'. */
  _viewMode: 'grid',

  render(index) {
    const board = document.getElementById('display-board');
    if (!board) return;

    if (this._viewMode === 'slider') {
      board.innerHTML = this._buildSlider(index);
      this._wireSlider(index);
    } else {
      board.innerHTML = this._buildGrid();
      this._wireGrid();
    }

    // Also wire the toggle button after building DOM
    document.getElementById('ishiharaViewToggle')?.addEventListener('click', () => {
      this._viewMode = this._viewMode === 'grid' ? 'slider' : 'grid';
      this.render(this._viewMode === 'slider' ? 0 : 0);
    });
  },

  /** Build the 8‑image grid. */
  _buildGrid() {
    const parts = [];
    parts.push('<div class="ishihara-toolbar">');
    parts.push('  <span class="ishihara-mode-label">Chế độ lưới</span>');
    parts.push('  <button class="ishihara-view-toggle" id="ishiharaViewToggle">Chuyển sang Slider</button>');
    parts.push('</div>');
    parts.push('<div class="ishihara-grid">');
    this.steps.forEach((file, i) => {
      const imgPath = `generated/ishihara_color_test/${file}`;
      parts.push('  <figure class="ishihara-figure">');
      parts.push(`    <img src="${imgPath}" alt="Ishihara hình ${i + 1}" class="ishihara-img" loading="lazy" crossorigin="anonymous">`);
      parts.push(`    <figcaption class="ishihara-caption">Hình ${i + 1}</figcaption>`);
      parts.push('  </figure>');
    });
    parts.push('</div>');
    return parts.join('');
  },

  /** Build the single‑image slider view. */
  _buildSlider(index) {
    const file = this.steps[index];
    const imgPath = `generated/ishihara_color_test/${file}`;
    const parts = [];
    parts.push('<div class="ishihara-toolbar">');
    parts.push('  <span class="ishihara-mode-label">Chế độ Slider</span>');
    parts.push('  <button class="ishihara-view-toggle" id="ishiharaViewToggle">Chuyển sang Grid</button>');
    parts.push('</div>');
    parts.push('<div class="ishihara-slider">');
    parts.push('  <figure class="ishihara-figure ishihara-slider-figure">');
    parts.push(`    <img src="${imgPath}" alt="Ishihara hình ${index + 1}" class="ishihara-img ishihara-slider-img" crossorigin="anonymous">`);
    parts.push(`    <figcaption class="ishihara-caption">Hình ${index + 1} / ${this.steps.length}</figcaption>`);
    parts.push('  </figure>');
    parts.push('</div>');
    // Navigation arrows
    parts.push('<div class="ishihara-slider-nav">');
    parts.push(`  <button class="ishihara-nav-btn" id="ishiharaPrevBtn" ${index === 0 ? 'disabled' : ''}>❮ Trước</button>`);
    parts.push(`  <button class="ishihara-nav-btn" id="ishiharaNextBtn" ${index === this.steps.length - 1 ? 'disabled' : ''}>Sau ❯</button>`);
    parts.push('</div>');
    return parts.join('');
  },

  _wireGrid() {
    // The toggle is wired in render()
  },

  _wireSlider(index) {
    document.getElementById('ishiharaPrevBtn')?.addEventListener('click', () => {
      if (index > 0) {
        const newIdx = index - 1;
        const state = window.__state;
        if (state) state.stepIndex = newIdx;
        this.render(newIdx);
      }
    });
    document.getElementById('ishiharaNextBtn')?.addEventListener('click', () => {
      if (index < this.steps.length - 1) {
        const newIdx = index + 1;
        const state = window.__state;
        if (state) state.stepIndex = newIdx;
        this.render(newIdx);
      }
    });
  },

  randomize() {
    const idx = window.__state ? window.__state.stepIndex : 0;
    this.render(idx);
  },
};

export default ishiharaTest;
export { ishiharaTest };
