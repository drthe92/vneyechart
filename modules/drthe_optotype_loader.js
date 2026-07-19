/**
 * drthe_optotype_loader.js — Tải optotype SVG từ generated/drthe_optotype.
 *
 * Các file SVG có cấu trúc:
 *   - sloan / numbers: <svg viewBox="0 0 500 500"><g id="optotype"><path .../></g></svg>
 *   - Auckland:            <svg viewBox="0 0 500 500"><path .../></svg>  (không có <g>)
 *
 * Loader trích xuất thẻ <path> và trả về nội dung path (không gồm <svg>).
 * Kết quả được cache để không tải lại.
 */

const BASE = 'generated/drthe_optotype/';
const VIEWBOX = '0 0 500 500';

const _cache = {};

/**
 * Trích xuất path từ nội dung SVG (hỗ trợ cả có và không có <g id="optotype">).
 * @param {string} svgText
 * @returns {string} nội dung <path .../> (rỗng nếu không tìm thấy)
 */
function extractOptotypePath(svgText) {
  // Ưu tiên <g id="optotype"> ... </g>
  const gMatch = svgText.match(/<g[^>]*id="optotype"[^>]*>([\s\S]*?)<\/g>/i);
  const inner = gMatch ? gMatch[1] : svgText;
  const pathMatch = inner.match(/<path[\s\S]*?\/>/i);
  return pathMatch ? pathMatch[0] : '';
}

/**
 * Tải một optotype theo nhóm và tên.
 * @param {string} group  'numbers' | 'sloan' | 'Auckland'
 * @param {string} name   '0'..'9' | 'C' | 'butterfly' ...
 * @returns {Promise<string>} nội dung <path> (rỗng nếu lỗi)
 */
export async function loadOptotype(group, name) {
  const key = `${group}/${name}`;
  if (_cache[key] !== undefined) return _cache[key];

  try {
    const res = await fetch(`${BASE}${group}/${name}.svg`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const path = extractOptotypePath(text);
    _cache[key] = path;
    return path;
  } catch (e) {
    console.warn(`[drthe_loader] failed ${key}:`, e.message);
    _cache[key] = '';
    return '';
  }
}

/**
 * Tải nhiều optotype cùng lúc.
 * @param {Array<[group, name]>} specs
 * @returns {Promise<Object>} map "group/name" -> path
 */
export async function loadMany(specs) {
  const entries = await Promise.all(
    specs.map(async ([g, n]) => [ `${g}/${n}`, await loadOptotype(g, n) ])
  );
  return Object.fromEntries(entries);
}

export const DR_THE_VIEWBOX = VIEWBOX;
export { extractOptotypePath };
