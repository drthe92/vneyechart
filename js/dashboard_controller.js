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
 * Ép kiểu giá trị EMR sang số thập phân (type casting) trước khi đẩy vào Chart.js.
 * - number        → giữ nguyên (nếu hữu hạn)
 * - '1.0 (10/10)' → 1.0  (lấy số đầu tiên)
 * - '< 1/10' / '> 1.0' → 0 (dưới ngưỡng đo lường)
 * - 'Có (100 giây cung)' → 100 ; 'Không đạt (Trượt 800 arcsec)' → 800
 * - 'N/A' / rỗng  → null (bỏ điểm, Chart.js tạo gap)
 */
function _coerceNumeric(val) {
    if (typeof val === 'number') return isFinite(val) ? val : null;
    if (typeof val !== 'string') return null;
    const s = String(val).trim();
    if (!s) return null;
    const upper = s.toUpperCase();
    if (upper === 'N/A' || upper === 'NA') return null;
    if (upper.includes('TRƯỢT')) return 800;
    if (s.includes('giây cung')) {
        const m = s.match(/(\d+)\s*giây cung/);
        return m ? parseInt(m[1], 10) : 800;
    }
    // Dưới/trên ngưỡng đo lường ('< 1/10', '> 1.0') → quy về 0
    if (s.startsWith('<') || s.startsWith('>')) return 0;
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

/** Loại bỏ series chưa đủ 2 phiên (không vẽ được đường biểu đồ) */
function _pruneShortSeries() {
    for (const key in dynamicSeries) {
        if (dynamicSeries[key].dataPoints.length < 2) {
            delete dynamicSeries[key];
        }
    }
}

/**
 * PWA OFFline-FIRST: đọc EMR từ localStorage (emr_patient_sessions) trước.
 * - Lọc session thuộc currentPatientId.
 * - Ghi nhận timestamp local theo từng series để chống trùng lặp khi merge Firebase.
 */
function _loadLocalEmr(patientId, localTimestampsBySeries) {
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

    // 1. LOCAL-FIRST: nạp dữ liệu lưu trên máy — hoạt động cả khi mất mạng
    _loadLocalEmr(patientId, localTimestampsBySeries);

    // 2. FIREBASE: merge nếu có kết nối; offline → giữ nguyên dữ liệu local
    if (!window.db) {
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

window.renderDashboard = function(moduleKey) {
    const container = document.getElementById('dashboard-charts');
    if (!container) return;

    _destroyCharts();
    container.innerHTML = '';

    const moduleId = moduleKey || _getSelectedModuleId();
    if (!moduleId) {
        _showEmpty('Chưa có dữ liệu. Vui lòng hoàn thành ít nhất 2 phiên tập của một bài tập để xem biểu đồ tiến triển.');
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
    const defs = [
        { key: 'distance_OD', kind: 'va', axis: 'y-va', color: '#00e676', dash: [], label: 'Thị lực Xa OD (Decimal)' },
        { key: 'distance_OS', kind: 'va', axis: 'y-va', color: '#00e676', dash: [5, 5], label: 'Thị lực Xa OS (Decimal)' },
        { key: 'near_OD', kind: 'va', axis: 'y-va', color: '#4da6ff', dash: [], label: 'Thị lực Gần OD (Decimal)' },
        { key: 'near_OS', kind: 'va', axis: 'y-va', color: '#4da6ff', dash: [5, 5], label: 'Thị lực Gần OS (Decimal)' },
        { key: 'contrast_OD', kind: 'cs', axis: 'y-cs', color: '#ff7043', dash: [], label: 'Tương phản OD (%)' },
        { key: 'contrast_OS', kind: 'cs', axis: 'y-cs', color: '#ff7043', dash: [5, 5], label: 'Tương phản OS (%)' },
        { key: 'stereo', kind: 'stereo', axis: 'y-stereo', color: '#fbbf24', dash: [], label: 'Hình nổi (Arcsec)' }
    ];

    const usable = defs
        .map(d => ({ def: d, series: seriesList.find(s => s.metricKey === d.key) }))
        .filter(x => x.series);

    if (usable.length === 0) {
        _showEmpty('Combo Đánh Giá Nhược Thị: Chưa đủ dữ liệu chỉ số để vẽ biểu đồ.');
        return;
    }

    const canvas = _createChartCard(`${groupLabel} — Thị lực / Tương phản / Hình nổi (Multi-axis)`);
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
            spanGaps: false
        };
    });

    const chart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                'y-va': {
                    position: 'left',
                    min: 0,
                    max: 1.0,
                    title: { display: true, text: 'Thị lực (Decimal)', color: CHART_COLORS[0] },
                    grid: { color: 'rgba(255, 255, 255, 0.06)' },
                    ticks: { color: CHART_COLORS[0] }
                },
                'y-cs': {
                    position: 'right',
                    min: 0,
                    max: 100,
                    reverse: true,
                    title: { display: true, text: 'Tương phản (%)', color: '#ff7043' },
                    grid: { color: 'rgba(255, 255, 255, 0.06)' },
                    ticks: { color: '#ff7043', callback: (v) => v + '%' }
                },
                'y-stereo': {
                    position: 'right',
                    min: 40,
                    max: 800,
                    reverse: true,
                    offset: true,
                    title: { display: true, text: 'Hình nổi (Arcsec)', color: '#fbbf24' },
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#fbbf24' }
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
                    padding: 10,
                    callbacks: {
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
                    }
                }
            }
        }
    });
    chartInstances.push(chart);
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