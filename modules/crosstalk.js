/**
 * crosstalk.js — LCD/LED channel crosstalk compensation
 * ====================================================
 *
 * Barrier 4 (8-bit limit & crosstalk):
 * With red-green anaglyph or polarized glasses, display panels leak
 * energy between the red and green channels. The "pure red" subpixel
 * excites the green sensor slightly and vice-versa, which shifts the
 * perceived equilibrium of the duochrome test and corrupts Worth-4-dot
 * fusion responses.
 *
 * We model the displayed colour as a linear mix of the *intended*
 * primaries through a 2×2 crosstalk matrix M:
 *
 *     [Rd]   [1      kRG] [Ri]
 *     [Gd] = [kGR   1  ] [Gi]
 *
 * where kRG is how much red leaks into green and kGR vice-versa.
 * To display an intended (Ri, Gi) we solve the inverse and clamp.
 *
 * Defaults are conservative, display-agnostic starting points. Expose
 * `CROSSTALK` in the calibration modal so clinicians can tune per panel.
 */

// Crosstalk coefficients (0 = ideal panel, larger = worse leakage).
export const CROSSTALK = {
  kRG: 0.06, // red → green leakage
  kGR: 0.08, // green → red leakage
};

/**
 * Compensate an intended sRGB primary for panel crosstalk.
 * @param {number} r  intended red   0–255
 * @param {number} g  intended green 0–255
 * @param {number} b  intended blue  0–255 (unchanged)
 * @returns {string}  compensated `#rrggbb`
 */
export function compensate(r, g, b, ct = CROSSTALK) {
  // Solve M⁻¹ × [r, g]ᵀ  (M = [[1, kRG],[kGR, 1]])
  const det = 1 - ct.kRG * ct.kGR;
  const rSrc = (r - ct.kRG * g) / det;
  const gSrc = (g - ct.kGR * r) / det;
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const hx = (v) => cl(v).toString(16).padStart(2, '0');
  return `#${hx(rSrc)}${hx(gSrc)}${hx(b)}`;
}

// Compensated primaries (tunable via CROSSTALK above).
export const RED_BG_COMP   = compensate(255, 0, 0);
export const GREEN_BG_COMP = compensate(0, 255, 0);
export const WHITE_COMP    = compensate(255, 255, 255);
