/* sw.js — Service Worker cho PWA Vision EMR
 * Chiến lược: Network First, Fallback to Cache (luôn ưu tiên phiên bản mới nhất,
 * dùng cache khi mất mạng). Dữ liệu EMR bệnh nhân nằm ở localStorage nên SW
 * chỉ chịu trách nhiệm phần tải UI (App Shell + tài nguyên tĩnh).
 */

const CACHE_NAME = 'vision-emr-cache-v2';

/* App Shell + tài nguyên tĩnh thiết yếu (đường dẫn tương đối với gốc trang) */
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',

  /* CSS */
  '/css/style.css',
  '/css/style_new.css',
  '/css/credit_card_calibration.css',
  '/css/exam_session.css',

  /* JS lõi (App Shell) */
  '/js/main.js',
  '/js/controller.js',
  '/js/settings.js',
  '/js/calibration.js',
  '/js/credit_card_calibration.js',
  '/js/settings_store.js',
  '/js/firebase_config.js',
  '/js/exam_session_manager.js',
  '/js/dashboard_controller.js',

  /* Modules auto_* (khám tự động) */
  '/modules/auto_BCVA_tumbling_e_for_amblyopia.js',
  '/modules/auto_distance_va.js',
  '/modules/auto_near_va.js',
  '/modules/auto_contrast_e.js',
  '/modules/auto_stereo_random_dot.js',

  /* Modules khám (Diagnostic) */
  '/modules/etdrs_chart.js',
  '/modules/snellen_chart.js',
  '/modules/lea_symbols.js',
  '/modules/landolt_c.js',
  '/modules/tumbling_e.js',
  '/modules/number_chart.js',
  '/modules/hotv.js',
  '/modules/auckland_logmar.js',
  '/modules/worth4dot.js',
  '/modules/astigmatism.js',
  '/modules/astigmatism_jcc.js',
  '/modules/retina_amsler.js',
  '/modules/retina_ishihara.js',
  '/modules/retina_pelli_robson.js',
  '/modules/near_logmar.js',
  '/modules/near_npoint.js',
  '/modules/near_lea.js',
  '/modules/neuro_okn.js',
  '/modules/red_desat.js',
  '/modules/duochrome_test.js',
  '/modules/stereo_anaglyph.js',
  '/modules/schober_test.js',
  '/modules/dynamic_fixation.js',
  '/modules/hiding_heidi.js',
  '/modules/dynamic_vergence.js',
  '/modules/maddox_grid_module.js',
  '/modules/distance_va.js',

  /* Modules phụ trợ (transitive dependencies) */
  '/modules/drthe_optotype_loader.js',
  '/modules/optotype_paths.js',
  '/modules/retina_subs.js',
  '/modules/crosstalk.js',

  /* Modules Huấn luyện thị giác (Therapeutic) */
  '/modules/therapeutic_menu_controller.js',
  '/modules/binocular_game_engine.js',
  '/modules/anti_suppression_catch.js',
  '/modules/shape_alignment.js',
  '/modules/vergence_tracker_game.js',
  '/modules/saccadic_tracking_game.js',
  '/modules/rds_therapy_game.js',
  '/modules/divergence_therapy_game.js',
  '/modules/convergence_therapy_game.js',
  '/modules/cam_visual_stimulator_game.js',
  '/modules/anti_crowding_game.js',
  '/modules/red_cone_stimulator_game.js',
  '/modules/okn_stimulation_game.js',
  '/modules/gabor_perceptual_learning_game.js',
  '/modules/dichoptic_pursuit_game.js',

  /* Thư viện CDN (để UI hoạt động đầy đủ khi offline) */
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

/* Sự kiện install — Pre-caching App Shell */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .catch(() => {
        /* Bỏ qua các đường dẫn không tồn tại: cache từng file độc lập,
           URL lỗi không làm hỏng toàn bộ quá trình cài đặt. */
        return caches.open(CACHE_NAME).then((cache) =>
          Promise.allSettled(urlsToCache.map((url) => cache.add(url)))
        );
      })
      .then(() => {
        /* Cập nhật cần được người dùng cấp phép (xem sự kiện message SKIP_WAITING),
           KHÔNG tự động skipWaiting để tránh làm đứt gãy phiên khám đang diễn ra. */
      })
  );
});

/* Sự kiện activate — Dọn dẹp cache cũ không khớp CACHE_NAME hiện tại */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* Sự kiện fetch — Chiến lược Network First, Fallback to Cache */
self.addEventListener('fetch', (event) => {
  /* Chỉ xử lý yêu cầu GET */
  if (event.request.method !== 'GET') return;

  event.respondWith(
    /* Ưu tiên mạng: luôn lấy code/phiên bản mới nhất */
    fetch(event.request)
      .then((response) => response)
      .catch(() => {
        /* Mất mạng → quay lại bộ đệm */
        return caches.match(event.request).then((cached) => {
          /* Điều hướng tới URL chưa cache → hiển thị trang offline thân thiện */
          if (event.request.mode === 'navigate') {
            return cached || caches.match('/offline.html');
          }
          return cached;
        });
      })
  );
});

/* Tín hiệu cấp phép cập nhật từ trang (người dùng bấm "Tải lại" trong Update Toast) */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});