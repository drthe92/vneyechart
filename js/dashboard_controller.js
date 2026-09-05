let chartInstances = [];
let dynamicSeries = {};

// Nhãn hiển thị thân thiện cho các chỉ số lâm sàng (Metric Key -> Tiếng Việt)
const METRIC_LABELS = {
    finalDivergenceDiopter: 'Dự trữ Hợp thị Phân kỳ NFV (Δ)',
    finalConvergenceDiopter: 'Dự trữ Hợp thị Hội tụ PFV (Δ)',
    maxDiopter: 'Mức Diop tối đa (Δ)',
    targetDiopter: 'Mục tiêu Diop (Δ)',
    totalStrikes: 'Số lần vỡ hình',
    finalAlpha: 'Ngưỡng tương phản (C-Ratio)',
    visualAngleDeg: 'Góc thị giác (độ)',
    avgBaseOut: 'Hội tụ BO (Δ)',
    avgBaseIn: 'Phân kỳ BI (Δ)',
    avgLatencyMs: 'Phản xạ (ms)',
    finalArcsec: 'Stereoacuity (Arcsec)',
    accuracyRate: 'Tỷ lệ chính xác (%)',
    avgReactionTimeMs: 'Phản xạ trung bình (ms)',
    accuracy: 'Chính xác (%)',
    trackingAccuracy: 'Chính xác bám đuôi (%)',
    finalLogCS: 'LogCS',
    level: 'Level đạt được',
    completionRate: 'Tỷ lệ hoàn thành (%)'
};

// Tên hiển thị cho từng Module
const MODULE_LABELS = {
    1: 'M1 - Hứng hạt (Anti-suppression)',
    2: 'M2 - Khớp khung (Flat Fusion)',
    3: 'M3 - Vận nhãn (Vergence Tracker)',
    4: 'M4 - Vận nhãn nhanh (Saccadic)',
    5: 'M5 - Thị giác nổi (RDS)',
    6: 'M6 - Tập Phân Kỳ (Divergence)',
    7: 'M7 - Kích thích CAM (Monocular)',
    8: 'M8 - Khử chen chúc (Anti-Crowding)',
    9: 'M9 - Kích thích nón hoàng điểm (RED-Cone)',
    10: 'M10 - Kích thích phản xạ OKN',
    11: 'M11 - Học tri giác Gabor',
    12: 'M12 - Bám đuôi phân thị (Smooth Pursuit)',
    13: 'M13 - Tập Hội Tụ (Convergence)'
};

// Cấu hình layout biểu đồ theo từng Module
// - 'prism': Biểu đồ đường đa mảng — PFV (Base-Out) & NFV (Base-In) cùng trục Diopter
// - 'level': Biểu đồ kết hợp — Cột Level (trục 1) + Đường Tỷ lệ hoàn thành % (trục 2)
// - 'score': Biểu đồ Điểm số kèm Tooltip chi tiết (Thời lượng, Số lần vỡ hình...)
const MODULE_GROUPS = {
    3: { type: 'prism', series: [
        { key: 'avgBaseOut', label: 'PFV - Hội tụ (Base-Out)' },
        { key: 'avgBaseIn', label: 'NFV - Phân kỳ (Base-In)' }
    ]},
    6: { type: 'prism', series: [
        { key: 'finalDivergenceDiopter', label: 'NFV - Phân kỳ (Base-In)' },
        { key: 'maxDiopter', label: 'Mức Diop tối đa' }
    ]},
    13: { type: 'prism', series: [
        { key: 'finalConvergenceDiopter', label: 'PFV - Hội tụ (Base-Out)' },
        { key: 'maxDiopter', label: 'Mức Diop tối đa' }
    ]},
    12: {
        type: 'level',
        bar: { key: 'level', label: 'Level đạt được' },
        line: { key: 'completionRate', label: 'Tỷ lệ hoàn thành (%)' }
    },
    1: { type: 'score', primary: 'finalAlpha', label: 'Ngưỡng tương phản dung hợp (C-Ratio)' },
    2: { type: 'score', primary: 'visualAngleDeg', label: 'Góc thị giác (độ)' },
    4: { type: 'score', primary: 'avgLatencyMs', label: 'Thời gian phản xạ (ms)' },
    5: { type: 'score', primary: 'finalArcsec', label: 'Stereoacuity (Arcsec)' },
    7: { type: 'score', primary: 'accuracyRate', label: 'Tỷ lệ chính xác (%)' },
    8: { type: 'score', primary: 'accuracy', label: 'Chính xác (%)' },
    9: { type: 'score', primary: 'accuracy', label: 'Chính xác (%)' },
    10: { type: 'score', primary: 'avgReactionTimeMs', label: 'Phản xạ trung bình (ms)' },
    11: { type: 'score', primary: 'finalLogCS', label: 'LogCS' },
    // Combo Đánh Giá Nhược Thị — biểu đồ đa trục 3 Y (Thị lực / Tương phản / Hình nổi)
    'Combo Đánh Giá Nhược Thị': { type: 'combo' }
};

const CHART_COLORS = ['#00e676', '#ff7043', '#4da6ff', '#fbbf24', '#c084fc', '#22d3ee'];

window.addEventListener('DOMContentLoaded', () => {
    // 1. Định vị các nút chuẩn sẵn có trên giao diện
    const ccBtn = document.getElementById('cc-calib-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');

    // 2. Tạo nút Biểu đồ (Top Menu Icon) nếu chưa có
    let topBtn = document.getElementById('top-dashboard-btn');
    if (!topBtn) {
        topBtn = document.createElement('button');
        topBtn.innerHTML = '📊';
        topBtn.id = 'top-dashboard-btn';
        // nav-btn: đăng ký với thuật toán điều hướng bàn phím 2D trong main.js
        // (getMenuItems lọc .menu-item, .nav-btn) — nếu thiếu, icon này không
        // thể chọn được bằng 4 phím mũi tên trên topmenu.
        topBtn.className = 'nav-btn';
        topBtn.title = 'Biểu đồ Tiến triển';
        
        topBtn.style.cssText = `
            background: rgba(77, 166, 255, 0.1); 
            color: #4da6ff; 
            border: 1px solid #4da6ff;
            width: 44px;
            height: 44px;
            padding: 0;
            border-radius: 8px; 
            font-size: 20px;
            cursor: pointer; 
            margin-left: 10px;
            display: inline-flex;
            justify-content: center;
            align-items: center;
            transition: all 0.2s;
        `;
        topBtn.onmouseover = () => topBtn.style.background = 'rgba(77, 166, 255, 0.2)';
        topBtn.onmouseout = () => topBtn.style.background = 'rgba(77, 166, 255, 0.1)';
        
        topBtn.onclick = () => {
            if (!localStorage.getItem("currentPatientId")) {
                alert("Vui lòng 'Bắt đầu khám' (Đăng nhập) để có thể tải dữ liệu biểu đồ.");
                return;
            }
            window.openDashboard();
        };
    }

    // 3. Sắp xếp đúng trật tự: Hiệu chuẩn thẻ tín dụng -> Toàn màn hình -> Cụm phòng khám & Biểu đồ.
    //    Nút Biểu đồ nằm CUỐI cụm chức năng phòng khám (sau khám/cài đặt/lịch sử),
    //    neo vào #sidebar-title để không nhảy lên trước cụm.
    const navbarHeader = document.getElementById('sidebar-header');
    if (navbarHeader) {
        navbarHeader.insertBefore(topBtn, navbarHeader.querySelector('#sidebar-title'));
    }

    // 3b. Nút Documents — mở trang chính của Docs, đặt NGAY SAU nút Biểu đồ.
    //     Mang class .nav-btn để tham gia điều hướng bàn phím 2D như các icon khác.
    let docsBtn = document.getElementById('docs-btn');
    if (!docsBtn) {
        docsBtn = document.createElement('button');
        docsBtn.innerHTML = '📄';
        docsBtn.id = 'docs-btn';
        docsBtn.className = 'nav-btn';
        docsBtn.title = 'Tài liệu hướng dẫn (Docs)';
        docsBtn.setAttribute('aria-label', 'Tài liệu hướng dẫn (Docs)');
        docsBtn.style.cssText = `
            background: rgba(77, 166, 255, 0.1);
            color: #4da6ff;
            border: 1px solid #4da6ff;
            width: 44px;
            height: 44px;
            padding: 0;
            border-radius: 8px;
            font-size: 20px;
            cursor: pointer;
            margin-left: 10px;
            display: inline-flex;
            justify-content: center;
            align-items: center;
            transition: all 0.2s;
        `;
        docsBtn.onmouseover = () => docsBtn.style.background = 'rgba(77, 166, 255, 0.2)';
        docsBtn.onmouseout = () => docsBtn.style.background = 'rgba(77, 166, 255, 0.1)';
        docsBtn.onclick = () => {
            window.open('https://dev.matcauvong.com/docs/index.html', '_blank', 'noopener');
        };
    }
    if (navbarHeader) {
        navbarHeader.insertBefore(docsBtn, navbarHeader.querySelector('#sidebar-title'));
    }
});

window.openDashboard = async function() {
    document.getElementById('progress-dashboard-modal').style.display = 'block';
    await fetchFirebaseData();
    buildModuleDropdown();
    window.renderDashboard();
};

window.closeDashboard = function() {
    document.getElementById('progress-dashboard-modal').style.display = 'none';
};

// Tương thích ngược với các lời gọi renderChart() cũ
window.renderChart = function() {
    window.renderDashboard();
};

/**
 * Giá trị Decimal tối thiểu dùng cho các kết quả thị lực cực thấp định tính
 * (Bóng bàn tay / Đếm ngón tay / dưới ngưỡng đo) — đủ nhỏ để vẽ sát đáy trục
 * Thị lực Decimal nhưng KHÔNG phải 0 (tránh hiểu lầm là mù tuyệt đối) và không
 * bao giờ là NaN (tránh crash biểu đồ).
 */
const LOW_VA_DECIMAL = 0.05;

/**
 * Ép kiểu giá trị EMR sang số thập phân (type casting) trước khi đẩy vào Chart.js.
 * Xử lý đặc thù chuỗi lâm sàng Việt Nam để biểu đồ KHÔNG bao giờ văng lỗi NaN:
 * - number        → giữ nguyên (nếu hữu hạn)
 * - '1.0 (10/10)' → 1.0  (lấy số đầu tiên)
 * - '< 1/10' / '< 0.1' → 0.05 (dưới ngưỡng đo lường, giữ điểm hiển thị cực thấp)
 * - 'Bóng bàn tay' / 'Đếm ngón tay' (CF/HM) → 0.05 (Decimal an toàn)
 * - 'Có (100 giây cung)' → 100 ; 'Không đạt (Trượt 800 arcsec)' → 800
 * - '> 1.0' → 1.0 (trần Thị lực Decimal, thị lực tốt nhất)
 * - 'N/A' / rỗng / không thể parse → null (bỏ điểm, Chart.js tạo gap)
 */
function _coerceNumeric(val) {
    if (typeof val === 'number') return isFinite(val) ? val : null;
    if (typeof val !== 'string') return null;
    const s = String(val).trim();
    if (!s) return null;
    const upper = s.toUpperCase();

    // Không có giá trị → bỏ qua điểm
    if (upper === 'N/A' || upper === 'NA') return null;

    // Chuỗi lâm sàng định tính Việt Nam (thị lực cực thấp) → Decimal an toàn
    if (/BÓNG BÀN TAY|ĐẾM NGÓN TAY|COUNTING FINGERS|HAND MOVEMENT|\bCF\b|\bHM\b/.test(upper)) {
        return LOW_VA_DECIMAL;
    }

    // Trượt/Thất bại thang đo (thị lực/stereo) → 800 (ngưỡng tệ nhất của arcsec)
    if (upper.includes('TRƯỢT')) return 800;

    // Stereopsis (giây cung)
    if (s.includes('giây cung')) {
        const m = s.match(/(\d+)\s*giây cung/);
        return m ? parseInt(m[1], 10) : 800;
    }

    // Dưới ngưỡng đo lường ('< 1/10', '< 0.1') → Decimal cực thấp an toàn
    if (s.startsWith('<')) return LOW_VA_DECIMAL;
    // Trên ngưỡng đo lường ('> 1.0') → trần Decimal (thị lực tốt nhất)
    if (s.startsWith('>')) {
        const m = s.match(/-?\d+(\.\d+)?/);
        return m ? Math.min(1.0, parseFloat(m[0])) : 1.0;
    }

    const m = s.match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    const n = parseFloat(m[0]);
    return isFinite(n) ? n : null;
}


/**
 * Thêm 1 điểm dữ liệu vào dynamicSeries.
 * @param {string} gName - tên game/module
 * @param {string} metricKey - khóa chỉ số lâm sàng
 * @param {number} num - giá trị đã ép kiểu số
 * @param {number} dateMs - timestamp (ms)
 * @param {number} durationSec - thời lượng phiên (giây)
 * @param {Object} fullSessionMetrics - toàn bộ chỉ số của phiên (cho tooltip)
 */
function _appendPoint(gName, metricKey, num, dateMs, durationSec, fullSessionMetrics) {
    const seriesKey = `${gName}_${metricKey}`;
    if (!dynamicSeries[seriesKey]) {
        const mNo = _moduleNumberFromGameName(gName);
        dynamicSeries[seriesKey] = {
            gameName: gName,
            metricKey: metricKey,
            groupKey: mNo !== null ? String(mNo) : gName,
            groupLabel: mNo !== null ? (MODULE_LABELS[mNo] || `Module ${mNo}`) : gName,
            labels: [],
            dataPoints: [],
            timestamps: [],
            durations: [],
            sessionMetrics: []
        };
    }
    const s = dynamicSeries[seriesKey];
    s.labels.push(new Date(dateMs).toLocaleDateString('vi-VN'));
    s.dataPoints.push(num);
    s.timestamps.push(dateMs);
    s.durations.push(durationSec);
    s.sessionMetrics.push({ ...fullSessionMetrics });
}

/**
 * [P#1] Giữ lại các series có ≥ 1 phiên.
 * Trước đây hàm này xóa mọi series < 2 phiên → bệnh nhân hoàn thành Combo LẦN ĐẦU
 * (1 phiên) không thấy điểm nào trên biểu đồ (sai DoD "thấy điểm theo phiên vừa lưu").
 * Giờ chỉ xóa series RỖNG (0 điểm). Với 1 điểm, Chart.js vẫn vẽ được điểm nút
 * (marker) dù chưa tạo được đường nối.
 */
function _pruneShortSeries() {
    for (const key in dynamicSeries) {
        if (dynamicSeries[key].dataPoints.length < 1) {
            delete dynamicSeries[key];
        }
    }
}

/**
 * [TỰ ĐỘNG GỘP THEO NGÀY] Với mỗi chuỗi (series), gộp mọi điểm rơi vào CÙNG
 * MỘT ngày lịch (theo múi giờ local) thành ĐÚNG 1 điểm = trung bình cộng của
 * các lần đo trong ngày đó. Áp dụng CHO TẤT CẢ biểu đồ (Combo / Score / Prism /
 * Level...), không phân biệt nguồn local hay Firebase.
 * - Giữ timestamp đại diện = thời điểm đo đầu tiên trong ngày (để định vị trục X).
 * - Đếm số lần đo để có thể mở rộng tooltip ("trung bình của N lần").
 */
function _dayKeyOf(dateMs) {
    const d = new Date(dateMs);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function _aggregateByDay() {
    if (!dynamicSeries) return;
    for (const key in dynamicSeries) {
        const s = dynamicSeries[key];
        if (!s || !Array.isArray(s.dataPoints) || s.dataPoints.length === 0) continue;

        const buckets = new Map(); // dayKey -> { sum, count, ts, sm, durSum }
        for (let i = 0; i < s.dataPoints.length; i++) {
            const dk = _dayKeyOf(s.timestamps[i]);
            if (!buckets.has(dk)) {
                buckets.set(dk, {
                    sum: 0, count: 0,
                    ts: s.timestamps[i],
                    sm: s.sessionMetrics[i],
                    durSum: s.durations[i] || 0
                });
            }
            const b = buckets.get(dk);
            b.sum += s.dataPoints[i];
            b.count += 1;
            b.durSum += (s.durations[i] || 0);
        }

        // Không có ngày nào trùng → không cần gộp
        if (buckets.size === s.dataPoints.length) continue;

        const ordered = Array.from(buckets.values())
            .sort((a, b) => a.ts - b.ts);

        const labels = [], dataPoints = [], timestamps = [], durations = [], sessionMetrics = [];
        for (const b of ordered) {
            const avg = b.count > 0 ? b.sum / b.count : b.sum;
            labels.push(new Date(b.ts).toLocaleDateString('vi-VN'));
            dataPoints.push(avg);
            timestamps.push(b.ts);
            durations.push(b.count > 0 ? b.durSum / b.count : 0);
            sessionMetrics.push(b.sm);
        }

        s.labels = labels;
        s.dataPoints = dataPoints;
        s.timestamps = timestamps;
        s.durations = durations;
        s.sessionMetrics = sessionMetrics;
    }
}

/**
 * Ánh xạ test_id của 2 bài test thị lực (Nhìn Xa / Nhìn Gần) sang key chuỗi
 * trên trục Y Thị lực Decimal (y-va) của biểu đồ Combo.
 * - Xa  → distance_OD / distance_OS
 * - Gần → near_OD   / near_OS
 */
const VISION_TEST_ID_TO_METRIC = {
    'far-vision-tumbling-e':       { od: 'distance_OD',  os: 'distance_OS' },
    'far-vision-auto-distance-va': { od: 'distance_OD',  os: 'distance_OS' },
    'near-vision-logmar':          { od: 'near_OD',      os: 'near_OS' },
    'near-vision-auto-near-va':    { od: 'near_OD',      os: 'near_OS' }
};

/**
 * Trích xuất chỉ số thị lực (Decimal) từ 1 bản ghi có test_id thuộc nhóm thị lực
 * Xa/Gần, sau đó đẩy vào đúng Data Set của Chart.js (trục Y trái - Thị lực Decimal).
 * Gộp chung vào nhóm "Combo Đánh Giá Nhược Thị" để khớp với _renderComboChart.
 * @param {Object} rec - bản ghi (therapy_record / Firebase Session)
 * @param {number} dateMs
 * @param {number} durationSec
 * @param {Object} sessionMetrics - chỉ số đã ép kiểu của phiên (cho tooltip)
 */
function _captureVisionMetricsByTestId(rec, dateMs, durationSec, sessionMetrics) {
    if (!rec) return;
    const tid = rec.test_id;
    const map = tid && VISION_TEST_GROUPS_VISION(tid);
    if (!map) return; // Không phải bài test thị lực Xa/Gần → bỏ qua

    const cm = rec.clinical_metrics
        || (rec.metrics && rec.metrics.customData)
        || rec.metrics
        || {};
    const od = _coerceNumeric(
        cm['OD (Mắt phải)'] ?? cm['OD (Thị lực nhìn gần mắt phải)'] ?? cm.OD
    );
    const os = _coerceNumeric(
        cm['OS (Mắt trái)'] ?? cm['OS (Thị lực nhìn gần mắt trái)'] ?? cm.OS
    );
    const groupName = 'Combo Đánh Giá Nhược Thị';
    if (od !== null) _appendPoint(groupName, map.od, od, dateMs, durationSec, sessionMetrics);
    if (os !== null) _appendPoint(groupName, map.os, os, dateMs, durationSec, sessionMetrics);
    // Xoá key thô (OD/OS) khỏi sessionMetrics để vòng lặp chung không tạo series thừa
    ['OD (Mắt phải)', 'OS (Mắt trái)', 'OD (Thị lực nhìn gần mắt phải)', 'OS (Thị lực nhìn gần mắt trái)', 'OD', 'OS']
        .forEach(k => { delete sessionMetrics[k]; });
}

function VISION_TEST_GROUPS_VISION(tid) {
    return VISION_TEST_ID_TO_METRIC[tid] || null;
}


/**
 * PWA OFFline-FIRST: đọc EMR từ localStorage (emr_patient_sessions) trước.
 * - Lọc session thuộc currentPatientId.
 * - Ghi nhận timestamp local theo từng series để chống trùng lặp khi merge Firebase.
 */
function _loadLocalEmr(patientId, localTimestampsBySeries, localIds) {
    let sessions = [];
    try {
        sessions = JSON.parse(localStorage.getItem('emr_patient_sessions') || '[]');
    } catch (e) {
        sessions = [];
    }

    for (const s of sessions) {
        if (!s || s.patientId !== patientId) continue;
        const records = Array.isArray(s.therapy_records) ? s.therapy_records : [];

        for (const rec of records) {
            if (!rec || !rec.timestamp) continue;
            const dateMs = typeof rec.timestamp === 'number'
                ? rec.timestamp
                : new Date(rec.timestamp).getTime();
            if (isNaN(dateMs)) continue;

            // [P#3] Ghi nhận id bản ghi local để dedup chính xác với Firebase (không
            // phụ thuộc vào chênh lệch đồng hồ server/local).
            if (localIds && rec.id) localIds.add(rec.id);

            const gName = rec.gameName || 'Bài tập';
            const durationSec = Number(rec.durationSeconds) || 0;

            // Bản ghi local lưu metrics dạng { customData: {...} } — bóc lớp customData
            const rawMetrics = (rec.metrics && typeof rec.metrics === 'object') ? rec.metrics : {};
            const metricSource = (rawMetrics.customData && typeof rawMetrics.customData === 'object')
                ? rawMetrics.customData
                : rawMetrics;

            const sessionMetrics = {};
            for (const [key, val] of Object.entries(metricSource)) {
                const num = _coerceNumeric(val);
                if (num !== null) sessionMetrics[key] = num;
            }

            // Capture chỉ số thị lực Xa/Gần theo test_id → trục Y Decimal (y-va)
            _captureVisionMetricsByTestId(rec, dateMs, durationSec, sessionMetrics);

            for (const [key, num] of Object.entries(sessionMetrics)) {
                const seriesKey = `${gName}_${key}`;
                if (!localTimestampsBySeries.has(seriesKey)) {
                    localTimestampsBySeries.set(seriesKey, []);
                }
                localTimestampsBySeries.get(seriesKey).push(dateMs);
                _appendPoint(gName, key, num, dateMs, durationSec, sessionMetrics);
            }
        }
    }
}

async function fetchFirebaseData() {
    const patientId = localStorage.getItem("currentPatientId");
    if (!patientId) return;

    dynamicSeries = {};
    const localTimestampsBySeries = new Map();
    const localIds = new Set();

    // 1. LOCAL-FIRST: nạp dữ liệu lưu trên máy — hoạt động cả khi mất mạng
    _loadLocalEmr(patientId, localTimestampsBySeries, localIds);

    // 2. FIREBASE: merge nếu có kết nối; offline → giữ nguyên dữ liệu local
    if (!window.db) {
        _aggregateByDay();
        _pruneShortSeries();
        return;
    }

    try {
        const snapshot = await window.db.collection("Patients")
                                        .doc(patientId)
                                        .collection("Sessions")
                                        .orderBy("timestamp", "asc")
                                        .get();

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.timestamp) return;

            // [P#3] Bỏ qua bản ghi đã có trên local (cùng id) — chống trùng lặp
            // bất kể chênh lệch đồng hồ server/local (khắc phục lệch >5s).
            if (data.id && localIds.has(data.id)) return;

            const dateMs = data.timestamp.toDate
                ? data.timestamp.toDate().getTime()
                : new Date(data.timestamp).getTime();
            if (isNaN(dateMs)) return;

            const gName = data.gameName || "Bài tập";
            const durationSec = Number(data.durationSeconds) || 0;
            const metricSource = (data.metrics && typeof data.metrics === 'object') ? data.metrics : {};

            const sessionMetrics = {};
            for (const [key, val] of Object.entries(metricSource)) {
                const num = _coerceNumeric(val);
                if (num === null) continue;

                // Chống trùng: bỏ qua điểm đã có ở local (cùng series, lệch ≤ 5 giây)
                const seriesKey = `${gName}_${key}`;
                const localTs = localTimestampsBySeries.get(seriesKey) || [];
                if (localTs.some(t => Math.abs(t - dateMs) <= 5000)) continue;

                sessionMetrics[key] = num;
            }

            // Capture chỉ số thị lực Xa/Gần theo test_id → trục Y Decimal (y-va)
            _captureVisionMetricsByTestId(data, dateMs, durationSec, sessionMetrics);

            for (const [key, num] of Object.entries(sessionMetrics)) {
                _appendPoint(gName, key, num, dateMs, durationSec, sessionMetrics);
            }
        });
    } catch (error) {
        // Offline / mất mạng → vẫn vẽ biểu đồ từ dữ liệu local
        console.warn("[Dashboard] Firebase không khả dụng — hiển thị dữ liệu lưu trên máy:", error);
        if (typeof window.showGlobalToast === 'function') {
            window.showGlobalToast('Đang hiển thị dữ liệu lưu trên máy (Offline)', 'info');
        }
    }

    _aggregateByDay();
    _pruneShortSeries();
}

function buildModuleDropdown() {
    const select = document.getElementById('dashboard-module-select');
    if (!select) return;
    select.innerHTML = '';

    const modules = {};
    Object.values(dynamicSeries).forEach(s => {
        if (!modules[s.groupKey]) {
            modules[s.groupKey] = { label: s.groupLabel, sessions: 0 };
        }
        modules[s.groupKey].sessions = Math.max(modules[s.groupKey].sessions, s.dataPoints.length);
    });

    const keys = Object.keys(modules);
    if (keys.length === 0) {
        const opt = document.createElement('option');
        opt.text = "Chưa có bài tập nào đạt đủ ≥ 2 phiên để vẽ biểu đồ.";
        opt.value = "";
        select.appendChild(opt);
        return;
    }

    // Modules M1..M13 xếp theo số, bài tập không thuộc Module xếp cuối
    keys.sort((a, b) => {
        const na = parseInt(a, 10), nb = parseInt(b, 10);
        const sa = isNaN(na) ? 999 : na;
        const sb = isNaN(nb) ? 999 : nb;
        return sa - sb;
    });

    keys.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.text = `${modules[k].label} (${modules[k].sessions} phiên)`;
        select.appendChild(opt);
    });
}

// ================================================================
//  RENDER BIỂU ĐỒ THEO MODULE
// ================================================================

/**
 * [P#6] Chọn module có nhiều dữ liệu nhất để tự động hiển thị biểu đồ khi người
 * dùng chưa chọn module nào. Ưu tiên nhóm "Combo Đánh Giá Nhược Thị" (đánh giá
 * tổng hợp) nếu có dữ liệu, ngược lại lấy group có nhiều điểm nhất.
 * @returns {string|null}
 */
function _pickModuleWithMostData() {
    if (!dynamicSeries || Object.keys(dynamicSeries).length === 0) return null;
    const byGroup = {};
    for (const s of Object.values(dynamicSeries)) {
        byGroup[s.groupKey] = (byGroup[s.groupKey] || 0) + s.dataPoints.length;
    }
    if (byGroup['Combo Đánh Giá Nhược Thị'] && byGroup['Combo Đánh Giá Nhược Thị'] > 0) {
        return 'Combo Đánh Giá Nhược Thị';
    }
    let bestKey = null, bestCount = -1;
    for (const [k, v] of Object.entries(byGroup)) {
        if (v > bestCount) { bestCount = v; bestKey = k; }
    }
    return bestCount > 0 ? bestKey : null;
}

window.renderDashboard = function(moduleKey) {
    const container = document.getElementById('dashboard-charts');
    if (!container) return;

    _destroyCharts();
    container.innerHTML = '';

    const moduleId = moduleKey || _getSelectedModuleId();
    if (!moduleId) {
        // [P#6] Tự động chọn module có dữ liệu để bác sĩ không nhìn thấy
        // màn hình "Chưa có dữ liệu" dù thực tế đã có phiên khám.
        const best = _pickModuleWithMostData();
        if (best) {
            // Đồng bộ giá trị dropdown (nếu có) để nhất quán UI
            const select = document.getElementById('dashboard-module-select');
            if (select) select.value = best;
            return window.renderDashboard(best);
        }
        _showEmpty('Chưa có dữ liệu. Vui lòng hoàn thành ít nhất 1 phiên tập của một bài tập để xem biểu đồ tiến triển.');
        return;
    }

    const { fromMs, toMs } = _getDateRange();
    const cfg = MODULE_GROUPS[moduleId] || { type: 'score', primary: null };

    const seriesList = Object.values(dynamicSeries)
        .filter(s => s.groupKey === moduleId)
        .map(s => _filterSeriesByRange(s, fromMs, toMs))
        .filter(s => s.dataPoints.length > 0);

    if (seriesList.length === 0) {
        _showEmpty('Không có dữ liệu cho module này trong khoảng thời gian đã chọn.');
        return;
    }

    const groupLabel = seriesList[0].groupLabel || moduleId;

    if (cfg.type === 'prism') {
        _renderPrismChart(cfg, seriesList, groupLabel);
    } else if (cfg.type === 'level') {
        _renderLevelChart(cfg, seriesList, groupLabel);
    } else if (cfg.type === 'combo') {
        _renderComboChart(cfg, seriesList, groupLabel);
    } else {
        _renderScoreChart(cfg, seriesList, groupLabel);
    }

    if (chartInstances.length === 0) {
        _showEmpty('Không có dữ liệu cho module này trong khoảng thời gian đã chọn.');
    }
};

function _renderPrismChart(cfg, seriesList, groupLabel) {
    const canvas = _createChartCard(`${groupLabel} — Dự trữ Hợp thị (Prism Diopter Δ)`);

    const usable = cfg.series
        .map(seriesDef => ({ seriesDef, series: seriesList.find(s => s.metricKey === seriesDef.key) }))
        .filter(x => x.series);
    if (usable.length === 0) {
        canvas.remove();
        _showEmpty(`${groupLabel}: Chưa đủ dữ liệu chỉ số Lăng kính (PFV/NFV) để vẽ biểu đồ.`);
        return;
    }

    const { labels, aligned } = _buildTimeline(usable.map(x => x.series));

    const datasets = usable.map((x, i) => ({
        label: `${x.seriesDef.label}`,
        data: aligned[i],
        borderColor: CHART_COLORS[i % CHART_COLORS.length],
        backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '22',
        borderWidth: 3,
        pointRadius: 6,
        pointBackgroundColor: "#fff",
        pointBorderColor: CHART_COLORS[i % CHART_COLORS.length],
        pointBorderWidth: 2,
        tension: 0.3,
        spanGaps: false
    }));

    const chart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: _baseOptions('Prism Diopter (Δ)', true)
    });
    chartInstances.push(chart);
}

function _renderLevelChart(cfg, seriesList, groupLabel) {
    const canvas = _createChartCard(`${groupLabel} — Level & Tỷ lệ hoàn thành`);

    const barSeries = seriesList.find(s => s.metricKey === cfg.bar.key);
    const lineSeries = seriesList.find(s => s.metricKey === cfg.line.key);
    const present = [barSeries, lineSeries].filter(Boolean);
    if (present.length === 0) {
        canvas.remove();
        _showEmpty(`${groupLabel}: Chưa đủ dữ liệu Level / Tỷ lệ hoàn thành để vẽ biểu đồ.`);
        return;
    }

    const { labels, aligned } = _buildTimeline(present);
    const datasets = [];
    let idx = 0;

    if (barSeries) {
        datasets.push({
            type: 'bar',
            label: `${cfg.bar.label}`,
            data: aligned[idx++],
            yAxisID: 'y',
            backgroundColor: 'rgba(34, 211, 238, 0.6)',
            borderColor: '#22d3ee',
            borderWidth: 1,
            order: 2
        });
    }
    if (lineSeries) {
        datasets.push({
            type: 'line',
            label: `${cfg.line.label}`,
            data: aligned[idx++],
            yAxisID: 'y1',
            borderColor: '#fbbf24',
            backgroundColor: 'rgba(251, 191, 36, 0.12)',
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#fbbf24',
            pointBorderWidth: 2,
            tension: 0.3
        });
    }

    const chart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets },
        options: _levelOptions()
    });
    chartInstances.push(chart);
}

function _renderScoreChart(cfg, seriesList, groupLabel) {
    let primary = seriesList.find(s => s.metricKey === cfg.primary);
    if (!primary) primary = seriesList[0];

    const metricLabel = (cfg.primary && METRIC_LABELS[cfg.primary])
        ? (METRIC_LABELS[cfg.primary])
        : (METRIC_LABELS[primary.metricKey] || primary.metricKey);

    const canvas = _createChartCard(`${groupLabel} — Điểm số: ${metricLabel}`);

    const { labels, aligned } = _buildTimeline([primary]);
    const data = aligned[0];

    // Metadata theo từng mốc thời gian để hiển thị Tooltip chi tiết
    const metaByTs = new Map();
    primary.timestamps.forEach((t, i) => {
        metaByTs.set(t, { duration: primary.durations[i] || 0, metrics: primary.sessionMetrics[i] || {} });
    });
    const meta = primary.timestamps.map((t, i) => {
        const m = metaByTs.get(t) || null;
        return { idx: i, ...m };
    });

    const dataset = {
        label: metricLabel,
        data: data,
        borderColor: CHART_COLORS[0],
        backgroundColor: CHART_COLORS[0] + '22',
        borderWidth: 3,
        pointRadius: 6,
        pointBackgroundColor: '#fff',
        pointBorderColor: CHART_COLORS[0],
        pointBorderWidth: 2,
        tension: 0.3
    };

    const options = _baseOptions(null, true);
    options.plugins.tooltip.callbacks = {
        title: (items) => items.length ? items[0].label : '',
        label: (item) => {
            const v = item.parsed.y;
            if (v === null || v === undefined) return '';
            return ` ${metricLabel}: ${_fmtNum(v)}`;
        },
        afterBody: (items) => {
            if (!items.length) return [];
            const metaItem = meta[items[0].dataIndex];
            if (!metaItem) return [];
            const lines = [];
            const m = metaItem.metrics || {};
            if (metaItem.duration > 0) {
                lines.push(`Thời lượng: ${_fmtDuration(metaItem.duration)}`);
            }
            if (typeof m.totalStrikes === 'number') {
                lines.push(`Số lần vỡ hình: ${m.totalStrikes}`);
            }
            const others = [];
            for (const [k, v] of Object.entries(m)) {
                if (k === primary.metricKey || typeof v !== 'number') continue;
                others.push(`${METRIC_LABELS[k] || k}: ${_fmtNum(v)}`);
            }
            if (others.length > 0) lines.push(...others.slice(0, 8));
            return lines;
        }
    };

    const chart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets: [dataset] },
        options: options
    });
    chartInstances.push(chart);
}

/**
 * Biểu đồ đa trục 3 Y cho Combo Đánh Giá Nhược Thị — 7 đường:
 * - y-va     (Trái):     Thị lực Thập phân (Xa + Gần, OD/OS), min 0, max 1.0
 * - y-cs     (Phải):     Tương phản %, min 0, max 100, reverse (đồ thị đi lên khi % giảm)
 * - y-stereo (Phải ngoài): Arcsec, min 40, max 800, reverse
 * Quy ước: OD nét liền, OS nét đứt (borderDash). Tooltip quy đổi kép Decimal↔LogMAR, %↔LogCS.
 */
function _renderComboChart(cfg, seriesList, groupLabel) {
    // Tách Combo Đánh Giá Nhược Thị thành 3 biểu đồ rời (Xa / Gần / Tương phản & Hình nổi)
    // để dễ quan sát. Mỗi tiêu chí dùng spanGaps:true → đường NỐI XUYÊN SUỐT các ngày
    // (khắc phục lỗi điểm ngày khác nhau không được nối do lệch trục thời gian chung).
    const makeVaAxes = () => ({
        'y-va': {
            position: 'left', min: 0, max: 1.0,
            title: { display: true, text: 'Thị lực (Decimal)', color: CHART_COLORS[0] },
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            ticks: { color: CHART_COLORS[0] }
        },
        x: { grid: { display: false }, ticks: { color: '#cbd5e1' } }
    });

    const groups = [
        {
            title: `${groupLabel} — Thị lực Xa (Decimal)`,
            axes: makeVaAxes(),
            defs: [
                { key: 'distance_OD', kind: 'va', axis: 'y-va', color: '#00e676', dash: [],     label: 'Thị lực Xa OD (Decimal)' },
                { key: 'distance_OS', kind: 'va', axis: 'y-va', color: '#00e676', dash: [5, 5], label: 'Thị lực Xa OS (Decimal)' }
            ]
        },
        {
            title: `${groupLabel} — Thị lực Gần (Decimal)`,
            axes: makeVaAxes(),
            defs: [
                { key: 'near_OD', kind: 'va', axis: 'y-va', color: '#4da6ff', dash: [],     label: 'Thị lực Gần OD (Decimal)' },
                { key: 'near_OS', kind: 'va', axis: 'y-va', color: '#4da6ff', dash: [5, 5], label: 'Thị lực Gần OS (Decimal)' }
            ]
        },
        {
            title: `${groupLabel} — Tương phản & Hình nổi`,
            axes: {
                'y-cs': {
                    position: 'left', min: 0, max: 100, reverse: true,
                    title: { display: true, text: 'Tương phản (%)', color: '#ff7043' },
                    grid: { color: 'rgba(255, 255, 255, 0.06)' },
                    ticks: { color: '#ff7043', callback: (v) => v + '%' }
                },
                'y-stereo': {
                    position: 'right', min: 40, max: 800, reverse: true, offset: true,
                    title: { display: true, text: 'Hình nổi (Arcsec)', color: '#fbbf24' },
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#fbbf24' }
                },
                x: { grid: { display: false }, ticks: { color: '#cbd5e1' } }
            },
            defs: [
                { key: 'contrast_OD', kind: 'cs', axis: 'y-cs', color: '#ff7043', dash: [],     label: 'Tương phản OD (%)' },
                { key: 'contrast_OS', kind: 'cs', axis: 'y-cs', color: '#ff7043', dash: [5, 5], label: 'Tương phản OS (%)' },
                { key: 'stereo', kind: 'stereo', axis: 'y-stereo', color: '#fbbf24', dash: [],  label: 'Hình nổi (Arcsec)' }
            ]
        }
    ];

    const tooltipCallbacks = {
        title: (items) => items.length ? items[0].label : '',
        label: (item) => {
            const ds = item.chart.data.datasets[item.datasetIndex];
            const v = item.parsed.y;
            if (v === null || v === undefined) return '';
            if (ds.kind === 'va') {
                if (v <= 0) return ` ${ds.label}: < 0.1 ( > 1.0 LogMAR )`;
                const logmar = -Math.log10(v);
                return ` ${ds.label}: ${v.toFixed(1)} (${logmar.toFixed(2)} LogMAR)`;
            }
            if (ds.kind === 'cs') {
                if (v <= 0) return ` ${ds.label}: 0% ( N/A LogCS )`;
                const logcs = -Math.log10(v / 100);
                return ` ${ds.label}: ${v.toFixed(1)}% (${logcs.toFixed(2)} LogCS)`;
            }
            return ` ${ds.label}: ${Math.round(v)} arcsec`;
        }
    };

    let rendered = 0;
    for (const g of groups) {
        const usable = g.defs
            .map(d => ({ def: d, series: seriesList.find(s => s.metricKey === d.key) }))
            .filter(x => x.series);
        if (usable.length === 0) continue;

        const canvas = _createChartCard(g.title);
        const { labels, aligned } = _buildTimeline(usable.map(x => x.series));

        const datasets = usable.map((x, i) => {
            let data = aligned[i];
            // CS: dữ liệu gốc là LogCS → map sang % (đường đi lên khi % giảm nhờ reverse)
            if (x.def.kind === 'cs') {
                data = data.map(v => (v === null ? null : Math.round(100 * Math.pow(10, -v) * 10) / 10));
            }
            return {
                kind: x.def.kind,
                label: x.def.label,
                data: data,
                yAxisID: x.def.axis,
                borderColor: x.def.color,
                backgroundColor: x.def.color + '22',
                borderWidth: 3,
                borderDash: x.def.dash,
                pointRadius: 6,
                pointBackgroundColor: '#fff',
                pointBorderColor: x.def.color,
                pointBorderWidth: 2,
                pointBorderDash: x.def.dash,
                tension: 0.3,
                spanGaps: true
            };
        });

        const chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: g.axes,
                plugins: {
                    legend: { labels: { color: 'white', font: { size: 13 } } },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        titleColor: '#e2e8f0',
                        bodyColor: '#cbd5e1',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: tooltipCallbacks
                    }
                }
            }
        });
        chartInstances.push(chart);
        rendered++;
    }

    if (rendered === 0) {
        _showEmpty('Combo Đánh Giá Nhược Thị: Chưa đủ dữ liệu chỉ số để vẽ biểu đồ.');
    }
}

// ================================================================
//  HELPERS
// ================================================================

function _baseOptions(yTitle, beginAtZero) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: beginAtZero,
                title: yTitle ? { display: true, text: yTitle, color: '#94a3b8' } : undefined,
                grid: { color: 'rgba(255, 255, 255, 0.06)' },
                ticks: { color: '#cbd5e1' }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#cbd5e1' }
            }
        },
        plugins: {
            legend: { labels: { color: 'white', font: { size: 13 } } },
            tooltip: {
                backgroundColor: '#0f172a',
                titleColor: '#e2e8f0',
                bodyColor: '#cbd5e1',
                borderColor: '#334155',
                borderWidth: 1,
                padding: 10
            }
        }
    };
}

function _levelOptions() {
    const base = _baseOptions(null, false);
    return {
        ...base,
        scales: {
            x: base.scales.x,
            y: {
                position: 'left',
                beginAtZero: true,
                ticks: { stepSize: 1, color: '#22d3ee' },
                grid: { color: 'rgba(255, 255, 255, 0.06)' },
                title: { display: true, text: 'Level đạt được', color: '#22d3ee' }
            },
            y1: {
                position: 'right',
                beginAtZero: true,
                max: 100,
                grid: { drawOnChartArea: false },
                ticks: { color: '#fbbf24', callback: (v) => v + '%' },
                title: { display: true, text: 'Tỷ lệ hoàn thành (%)', color: '#fbbf24' }
            }
        }
    };
}

function _createChartCard(title) {
    const container = document.getElementById('dashboard-charts');
    const card = document.createElement('div');
    card.className = 'dashboard-chart-card';
    card.innerHTML = `<h4>${title}</h4><div class="chart-box"><canvas></canvas></div>`;
    container.appendChild(card);
    return card.querySelector('canvas');
}

function _showEmpty(message) {
    const container = document.getElementById('dashboard-charts');
    if (!container) return;
    const p = document.createElement('p');
    p.className = 'dashboard-empty';
    p.textContent = message;
    container.appendChild(p);
}

function _destroyCharts() {
    chartInstances.forEach(c => {
        try { c.destroy(); } catch (e) { /* noop */ }
    });
    chartInstances = [];
}

function _getSelectedModuleId() {
    const select = document.getElementById('dashboard-module-select');
    return select ? select.value : '';
}

function _getDateRange() {
    const fromEl = document.getElementById('dashboard-date-from');
    const toEl = document.getElementById('dashboard-date-to');
    let fromMs = null;
    let toMs = null;
    if (fromEl && fromEl.value) {
        const d = new Date(fromEl.value + 'T00:00:00');
        if (!isNaN(d.getTime())) fromMs = d.getTime();
    }
    if (toEl && toEl.value) {
        const d = new Date(toEl.value + 'T23:59:59.999');
        if (!isNaN(d.getTime())) toMs = d.getTime();
    }
    return { fromMs, toMs };
}

function _filterSeriesByRange(series, fromMs, toMs) {
    const filtered = {
        gameName: series.gameName,
        metricKey: series.metricKey,
        groupKey: series.groupKey,
        groupLabel: series.groupLabel,
        labels: [],
        dataPoints: [],
        timestamps: [],
        durations: [],
        sessionMetrics: []
    };
    for (let i = 0; i < series.timestamps.length; i++) {
        const t = series.timestamps[i];
        if (fromMs !== null && t < fromMs) continue;
        if (toMs !== null && t > toMs) continue;
        filtered.labels.push(series.labels[i]);
        filtered.dataPoints.push(series.dataPoints[i]);
        filtered.timestamps.push(t);
        filtered.durations.push(series.durations[i] || 0);
        filtered.sessionMetrics.push(series.sessionMetrics[i] || {});
    }
    return filtered;
}

function _buildTimeline(seriesList) {
    const tsSet = new Set();
    seriesList.forEach(s => s.timestamps.forEach(t => tsSet.add(t)));
    const sorted = Array.from(tsSet).sort((a, b) => a - b);
    const labels = sorted.map(t => new Date(t).toLocaleDateString('vi-VN'));
    const aligned = seriesList.map(s => {
        const map = new Map();
        s.timestamps.forEach((t, i) => map.set(t, s.dataPoints[i]));
        return sorted.map(t => (map.has(t) ? map.get(t) : null));
    });
    return { labels, aligned };
}

function _moduleNumberFromGameName(gName) {
    const m = String(gName || '').match(/M(\d+)/);
    return m ? parseInt(m[1], 10) : null;
}

function _fmtNum(v) {
    if (typeof v !== 'number') return v;
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2);
}

function _fmtDuration(sec) {
    sec = Math.round(sec || 0);
    if (sec <= 0) return '';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m} phút ${s}s` : `${s}s`;
}