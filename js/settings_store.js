/**
 * settings_store.js — Lớp lưu trữ cấu hình BẢN ĐỊA (local-only).
 *
 * Nguyên tắc: MỌI dữ liệu chỉ nằm trên đúng trình duyệt/máy đang dùng.
 * KHÔNG đẩy cấu hình hay dữ liệu lên Firestore — tránh việc người dùng/máy
 * này bị tái sử dụng cấu hình của người dùng/máy kia.
 *
 * Cơ chế 2 lớp:
 *   1. localStorage — nguồn chính.
 *   2. Cookie dự phòng (hạn 1 năm) — CHỈ cho khóa cấu hình nhỏ (CONFIG_KEYS),
 *      chống dọn storage riêng lẻ; heal() tự khôi phục localStorage từ cookie
 *      khi thiếu.
 *
 * LƯU Ý: Khóa dữ liệu phiên/lịch sử bệnh nhân KHÔNG vào cookie (riêng tư +
 * giới hạn 4KB) — chỉ ghi localStorage như hành vi gốc của app.
 */

(function () {
  'use strict';

  /** Các khóa cấu hình nhỏ (được phép backup qua cookie) */
  const CONFIG_KEYS = [
    'vision-therapy-calibrate-distance-m',
    'vision_distance_far_m',
    'vision_distance_near_m',
    'vision-therapy-cc-pxpermm',
    'vision-therapy-display-preset',
    'vision_clinic_settings',
    'vision_color_calibration',
  ];

  const COOKIE_PREFIX = 'vt_cfg_';
  const COOKIE_EXPIRY_DAYS = 365;
  const COOKIE_PATH = '/';

  function getLocalStorage() {
    try { return window.localStorage; } catch (e) { return null; }
  }

  function setCookie(key, value) {
    try {
      const expires = new Date();
      expires.setDate(expires.getDate() + COOKIE_EXPIRY_DAYS);
      document.cookie =
        COOKIE_PREFIX + encodeURIComponent(key) + '=' + encodeURIComponent(value) +
        '; expires=' + expires.toUTCString() +
        '; path=' + COOKIE_PATH +
        '; SameSite=Lax';
    } catch (e) { /* cookie không khả dụng (file://, bị chặn...) — bỏ qua */ }
  }

  function clearCookie(key) {
    try {
      document.cookie =
        COOKIE_PREFIX + encodeURIComponent(key) + '=' +
        '; expires=Thu, 01 Jan 1970 00:00:00 GMT' +
        '; path=' + COOKIE_PATH;
    } catch (e) { /* ignore */ }
  }

  function getCookie(key) {
    try {
      const prefix = COOKIE_PREFIX + encodeURIComponent(key) + '=';
      const parts = document.cookie.split(';');
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (part.indexOf(prefix) === 0) {
          return decodeURIComponent(part.substring(prefix.length));
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  const SettingsStore = {

    /** Ghi cấu hình: localStorage + cookie dự phòng (nếu thuộc CONFIG_KEYS). */
    set(key, value) {
      const ls = getLocalStorage();
      if (ls) {
        try { ls.setItem(key, value); } catch (e) { /* quota — bỏ qua */ }
      }
      if (CONFIG_KEYS.indexOf(key) !== -1) {
        setCookie(key, value);
      }
    },

    /** Đọc: localStorage trước, fallback cookie dự phòng (chỉ khóa cấu hình). */
    get(key) {
      const ls = getLocalStorage();
      if (ls) {
        try {
          const v = ls.getItem(key);
          if (v !== null && v !== undefined) return v;
        } catch (e) { /* ignore */ }
      }
      if (CONFIG_KEYS.indexOf(key) !== -1) return getCookie(key);
      return null;
    },

    /** Xóa: localStorage + cookie tương ứng (nếu thuộc CONFIG_KEYS). */
    remove(key) {
      const ls = getLocalStorage();
      if (ls) {
        try { ls.removeItem(key); } catch (e) { /* ignore */ }
      }
      if (CONFIG_KEYS.indexOf(key) !== -1) {
        clearCookie(key);
      }
    },

    /**
     * Tự phục hồi cục bộ: nếu localStorage bị xóa (dọn storage) mà cookie
     * dự phòng còn → khôi phục ngược lại localStorage.
     * @returns {string[]} danh sách khóa đã khôi phục
     */
    heal() {
      const ls = getLocalStorage();
      if (!ls) return [];
      const restored = [];
      for (let i = 0; i < CONFIG_KEYS.length; i++) {
        const key = CONFIG_KEYS[i];
        try {
          if (ls.getItem(key) === null) {
            const backup = getCookie(key);
            if (backup !== null) {
              ls.setItem(key, backup);
              restored.push(key);
            }
          }
        } catch (e) { /* ignore */ }
      }
      if (restored.length > 0) {
        console.warn('[SettingsStore] Đã khôi phục cấu hình từ cookie:', restored);
      }
      return restored;
    },
  };

  // Tự phục hồi ngay khi script load (trước mọi module đọc cấu hình)
  SettingsStore.heal();

  window.SettingsStore = SettingsStore;
})();