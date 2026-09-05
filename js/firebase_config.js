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
window.db = firebase.firestore();

/**
 * [TỬ HUYẾT 3] Bật IndexedDB Persistence cho Firestore.
 * Khi bác sĩ bấm "Kết thúc khám" rồi tắt trình duyệt ngay lập tức, các lệnh
 * .add()/.set() chưa kịp đẩy lên mạng sẽ được OS lưu tạm vào IndexedDB và tự
 * động đồng bộ (flush) khi có kết nối lại → không rớt một dòng EMR nào.
 * Phải gọi TRƯỚC mọi thao tác đọc/ghi Firestore khác.
 */
try {
    window.db.enableIndexedDbPersistence()
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
