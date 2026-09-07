// Phòng hờ double-execute (SW cache race / load lại trang): nếu script chạy
// 2 lần trong cùng global scope, `const provider` sẽ ném SyntaxError.
if (window.__firebaseConfigLoaded) {
  window.db = window.db || firebase.firestore();
} else {
window.__firebaseConfigLoaded = true;

const firebaseConfig = {
    apiKey: "AIzaSyCIMRsiTlvJdxwwcxeT-D9oMKcmeF1Xcac",
    authDomain: "matcauvong-app.firebaseapp.com",
    projectId: "matcauvong-app",
    storageBucket: "matcauvong-app.firebasestorage.app",
    messagingSenderId: "586794377316",
    appId: "1:586794377316:web:181f26e23a9cb7f7ce7f71",
    measurementId: "G-3T9HM7GXFV"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Đăng nhập ẩn danh ngầm: ứng dụng tự xin định danh ẩn danh từ máy chủ
// Firebase để mọi phiên đọc/ghi Firestore (EMR, level luyện tập...) hoạt
// động với quyền mặc định an toàn, không cần bệnh nhân thao tác trước.
firebase.auth().signInAnonymously().catch((error) => {
    console.error("Lỗi đăng nhập ẩn danh:", error);
});

// Khởi tạo App Check ngay sau khi initializeApp(firebaseConfig)
// Compat SDK: Provider phải được khai báo qua namespace firebase.appCheck.
self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
const provider = new firebase.appCheck.ReCaptchaEnterpriseProvider('6Leih60tAAAAAA-DwVEce4I1cB6nDsxT2CRpJjyv');
firebase.appCheck().activate(provider, true); // true = tự động làm mới token ngầm
window.db = firebase.firestore();

/**
 * [TỬ HUYẾT 3] Bật IndexedDB Persistence cho Firestore.
 * Khi bác sĩ bấm "Kết thúc khám" rồi tắt trình duyệt ngay lập tức, các lệnh
 * .add()/.set() chưa kịp đẩy lên mạng sẽ được OS lưu tạm vào IndexedDB và tự
 * động đồng bộ (flush) khi có kết nối lại → không rớt một dòng EMR nào.
 * Phải gọi TRƯỚC mọi thao tác đọc/ghi Firestore khác.
 */
try {
    // [FIX Compat SDK] Firebase v9 Compat dùng tên mới enablePersistence()
    // (không còn enableIndexedDbPersistence như v8) — tránh TypeError.
    window.db.enablePersistence()
        .then(() => {
            console.info('[Firebase] IndexedDB Persistence đã bật — Offline queue sẵn sàng.');
        })
        .catch((err) => {
            // Failures thường gặp: đã bật từ trước (multiple tabs) hoặc trình duyệt
            // không hỗ trợ IndexedDB → chỉ cảnh báo, không làm sập ứng dụng.
            if (err && err.code === 'failed-precondition') {
                console.warn('[Firebase] Persistence bỏ qua (nhiều tab cùng mở).');
            } else if (err && err.code === 'unimplemented') {
                console.warn('[Firebase] Persistence không được hỗ trợ trên trình duyệt này.');
            } else {
                console.warn('[Firebase] Không bật được Persistence:', err);
            }
        });
} catch (e) {
    console.warn('[Firebase] Lỗi khởi tạo Persistence:', e);
}
} // end if (!window.__firebaseConfigLoaded)
