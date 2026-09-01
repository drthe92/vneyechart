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
    11: { type: 'score', primary: 'finalLogCS', label: 'LogCS' }
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

    // 3. Sắp xếp đúng trật tự: Căn chỉnh thẻ tín dụng -> Toàn màn hình -> Nhóm quản lý phòng khám & Biểu đồ
    if (fullscreenBtn && fullscreenBtn.parentNode) {
        fullscreenBtn.parentNode.insertBefore(topBtn, fullscreenBtn.nextSibling);
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

async function fetchFirebaseData() {
    const patientId = localStorage.getItem("currentPatientId");
    if (!patientId || !window.db) return;

    try {
        const snapshot = await window.db.collection("Patients")
                                        .doc(patientId)
                                        .collection("Sessions")
                                        .orderBy("timestamp", "asc")
                                        .get();
        
        dynamicSeries = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.timestamp) return;

            const dateMs = data.timestamp.toDate
                ? data.timestamp.toDate().getTime()
                : new Date(data.timestamp).getTime();
            if (isNaN(dateMs)) return;

            const dateStr = new Date(dateMs).toLocaleDateString('vi-VN');
            const gName = data.gameName || "Bài tập";
            const durationSec = Number(data.durationSeconds) || 0;

            const metricSource = (data.metrics && typeof data.metrics === 'object') ? data.metrics : {};
            const sessionMetrics = {};
            for (const [key, val] of Object.entries(metricSource)) {
                if (typeof val === 'number') {
                    sessionMetrics[key] = val;
                }
            }

            for (const [key, val] of Object.entries(sessionMetrics)) {
                const seriesKey = `${gName}_${key}`;
                if (!dynamicSeries[seriesKey]) {
                    const mNo = _moduleNumberFromGameName(gName);
                    dynamicSeries[seriesKey] = {
                        gameName: gName,
                        metricKey: key,
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
                s.labels.push(dateStr);
                s.dataPoints.push(val);
                s.timestamps.push(dateMs);
                s.durations.push(durationSec);
                s.sessionMetrics.push({ ...sessionMetrics });
            }
        });

        for (const key in dynamicSeries) {
            if (dynamicSeries[key].dataPoints.length < 2) {
                delete dynamicSeries[key];
            }
        }
    } catch (error) {
        console.error("Lỗi tải dữ liệu biểu đồ:", error);
    }
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