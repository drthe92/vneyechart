let progressChartInstance = null;
let dynamicSeries = {};

// Nhãn hiển thị thân thiện cho các chỉ số lâm sàng (Metric Key -> Tiếng Việt)
const METRIC_LABELS = {
    finalDivergenceDiopter: 'Dự trữ Hợp thị Phân kỳ NFV (Δ)',
    finalConvergenceDiopter: 'Dự trữ Hợp thị Hội tụ PFV (Δ)',
    maxDiopter: 'Mức Diop tối đa (Δ)',
    targetDiopter: 'Mục tiêu Diop (Δ)',
    totalStrikes: 'Số lần vỡ hợp thị',
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
    finalLogCS: 'LogCS'
};

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
    buildDropdown();
    
    if(Object.keys(dynamicSeries).length > 0) {
        window.renderChart();
    } else if (progressChartInstance) {
        progressChartInstance.destroy();
        progressChartInstance = null;
    }
};

window.closeDashboard = function() {
    document.getElementById('progress-dashboard-modal').style.display = 'none';
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
            if (data.timestamp && data.metrics) {
                const dateStr = data.timestamp.toDate().toLocaleDateString('vi-VN');
                const gName = data.gameName || "Bài tập";
                
                for (const [key, val] of Object.entries(data.metrics)) {
                    if (typeof val === 'number') {
                        const seriesKey = `${gName}_${key}`;
                        if (!dynamicSeries[seriesKey]) {
                            dynamicSeries[seriesKey] = {
                                gameName: gName,
                                metricKey: key,
                                labels: [],
                                dataPoints: []
                            };
                        }
                        dynamicSeries[seriesKey].labels.push(dateStr);
                        dynamicSeries[seriesKey].dataPoints.push(val);
                    }
                }
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

function buildDropdown() {
    const select = document.getElementById('dashboard-metric-select');
    select.innerHTML = ''; 
    
    const keys = Object.keys(dynamicSeries);
    if (keys.length === 0) {
        const opt = document.createElement('option');
        opt.text = "Chưa có bài tập nào đạt đủ ≥ 2 phiên để vẽ biểu đồ.";
        opt.value = "";
        select.appendChild(opt);
        return;
    }

    keys.forEach(k => {
        const series = dynamicSeries[k];
        const opt = document.createElement('option');
        opt.value = k;
        const label = METRIC_LABELS[series.metricKey] || series.metricKey;
        opt.text = `${series.gameName} - Chỉ số: ${label} (${series.dataPoints.length} phiên)`;
        select.appendChild(opt);
    });
}

window.renderChart = function() {
    const select = document.getElementById('dashboard-metric-select');
    const seriesKey = select.value;
    if (!seriesKey || !dynamicSeries[seriesKey]) return;

    const ctx = document.getElementById('progressChart').getContext('2d');
    if (progressChartInstance) {
        progressChartInstance.destroy();
    }

    const series = dynamicSeries[seriesKey];
    const metricLabel = METRIC_LABELS[series.metricKey] || series.metricKey;

    progressChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: series.labels,
            datasets: [{
                label: `${series.gameName} - ${metricLabel}`,
                data: series.dataPoints,
                borderColor: "#00e676",
                backgroundColor: 'rgba(0, 230, 118, 0.1)',
                borderWidth: 3,
                pointRadius: 6,
                pointBackgroundColor: "#fff",
                pointBorderColor: "#00e676",
                pointBorderWidth: 2,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: false },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { labels: { color: 'white', font: { size: 14 } } }
            }
        }
    });
};