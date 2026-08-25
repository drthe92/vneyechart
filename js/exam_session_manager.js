/**
 * Exam Session Manager Module
 * Quản lý phiên khám cho ứng dụng nhãn khoa
 * Tác giả: ZooCode AI
 * Phiên bản: 1.0.0
 */

(function() {
    'use strict';

    // LocalStorage key for auto-save
    const SESSION_STORAGE_KEY = 'vision_therapy_active_session';

    // LocalStorage key for clinic settings
    const CLINIC_SETTINGS_KEY = 'vision_clinic_settings';

    // LocalStorage key for exam history (EMR History Viewer)
    const EMR_HISTORY_KEY = 'vision_emr_history_v1';

    // LocalStorage key for anaglyph color calibration
    const CALIBRATION_KEY = 'vision_color_calibration';

    // Global calibrated colors (default: soft Red and Cyan for anaglyph)
    window.__anaglyphColors = { red: '#FF4D4D', cyan: '#4DFFFF' };

    // Color calibration palettes - 8 shades from dark to light
    const CALIBRATION_PALETTES = {
        red: ['#FF4D4D', '#FF6666', '#FF8080', '#FF9999', '#FFB3B3', '#FFCCCC', '#FFE0E0', '#FFF0F0'],
        cyan: ['#4DFFFF', '#66FFFF', '#80FFFF', '#99FFFF', '#B3FFFF', '#CCFFFF', '#E0FFFF', '#F0FFFF']
    };

    // Available test names for manual entry datalist
    const TEST_NAMES_LIST = [
        'Schober Heterophoria',
        'Dynamic Fusional Vergence',
        'Dynamic Fixation Stability',
        'Preferential Looking Heidi',
        'LogMAR Distance VA',
        'ETDRS Distance VA',
        'Snellen Chart',
        'Number Chart',
        'Landolt C',
        'HOTV Letters',
        'Tumbling E',
        'Sloan Letters',
        'Lea Symbols Circle',
        'Lea Symbols Heart',
        'Lea Symbols House',
        'Lea Symbols Square',
        'Ishihara Color Test',
        'Pelli-Robson Contrast',
        'Duochrome Test',
        'JCC (Jackson Cross Cylinder)',
        'Astigmatism (JCC Simulation)',
        'Worth 4 Dot',
        'Crosstalk 3D',
        'Red Desaturation',
        'Retina Amsler',
        'Neuro OKN',
        'Near LogMAR',
        'Near Lea Symbols',
        'Near N-Point',
        'Auckland LogMAR'
    ];

    // Manual Entry Modal elements reference
    let manualEntryModal = null;
    let manualFab = null;

    // Clinic Settings Modal element reference
    let clinicSettingsModal = null;

    // History Modal element reference
    let historyModal = null;


    // Global exam state
    window.__currentExam = null;

    // DOM Elements (will be initialized)
    let examContainer = null;
    let startExamBtn = null;
    let examStatusText = null;
    let endExamBtn = null;
    let startExamModal = null;
    let endExamModal = null;
    let reportModal = null;
    let printContainer = null;
    let toastContainer = null;

    // Initialize the module
    function init() {
        loadColorCalibration();
        createUI();
        bindEvents();
        setupVisionTestListener();
        setupGlobalHotkey();
        restoreSession();
    }

    /**
     * Load color calibration from localStorage and apply to CSS variables
     */
    function loadColorCalibration() {
        try {
            const data = localStorage.getItem(CALIBRATION_KEY);
            if (data) {
                const calibrated = JSON.parse(data);
                if (calibrated.red) {
                    window.__anaglyphColors.red = calibrated.red;
                }
                if (calibrated.cyan) {
                    window.__anaglyphColors.cyan = calibrated.cyan;
                }
            }
        } catch (e) {
            console.error('[ColorCalibration] Failed to load calibration:', e);
        }

        // Apply to CSS custom properties
        document.documentElement.style.setProperty('--calibrated-red', window.__anaglyphColors.red);
        document.documentElement.style.setProperty('--calibrated-cyan', window.__anaglyphColors.cyan);
    }

    // Create all UI elements
    function createUI() {
        // Create exam container in navbar
        const navbarHeader = document.getElementById('sidebar-header');
        if (!navbarHeader) {
            console.error('Navbar header not found');
            return;
        }

        // Create exam session container
        examContainer = document.createElement('div');
        examContainer.id = 'exam-session-container';
        examContainer.className = 'exam-session-container';

        // Start Exam Button
        startExamBtn = document.createElement('button');
        startExamBtn.id = 'start-exam-btn';
        // nav-btn: đăng ký với thuật toán điều hướng bàn phím 2D trong main.js (updateMenuFocus)
        startExamBtn.className = 'exam-btn start-exam-btn nav-btn';
        startExamBtn.innerHTML = 'Bắt đầu khám';
        examContainer.appendChild(startExamBtn);

        // Exam status (hidden by default)
        const statusContainer = document.createElement('div');
        statusContainer.id = 'exam-status-container';
        statusContainer.className = 'exam-status-container';
        statusContainer.style.display = 'none';

        examStatusText = document.createElement('span');
        examStatusText.id = 'exam-status-text';
        examStatusText.className = 'exam-status-text';
        statusContainer.appendChild(examStatusText);

        endExamBtn = document.createElement('button');
        endExamBtn.id = 'end-exam-btn';
        // nav-btn: nút này thay thế start-exam-btn khi phiên khám đang chạy,
        // cũng cần tham gia điều hướng bàn phím 2D
        endExamBtn.className = 'exam-btn end-exam-btn nav-btn';
        endExamBtn.innerHTML = 'Kết thúc khám';
        statusContainer.appendChild(endExamBtn);

        examContainer.appendChild(statusContainer);

        // Insert before fullscreen button
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            navbarHeader.insertBefore(examContainer, fullscreenBtn);
        } else {
            navbarHeader.appendChild(examContainer);
        }

        // Create Start Exam Modal
        createStartExamModal();

        // Create End Exam Modal
        createEndExamModal();

        // Create Report Modal
        createReportModal();

        // Create Print Container
        createPrintContainer();

        // Create Toast Container
        createToastContainer();

        // Create Floating Action Button
        createManualSaveFab();

        // Create Manual Entry Modal
        createManualEntryModal();

        // Create Clinic Settings UI (defensive - wrapped in try/catch)
        try {
            createClinicSettingsUI();
        } catch (e) {
            console.error('[ExamSessionManager] Failed to create Clinic Settings UI:', e);
        }

        // Create History Viewer UI (defensive - wrapped in try/catch)
        try {
            createHistoryViewerUI();
        } catch (e) {
            console.error('[ExamSessionManager] Failed to create History Viewer UI:', e);
        }
    }


    // Create Start Exam Modal
    function createStartExamModal() {
        startExamModal = document.createElement('div');
        startExamModal.id = 'start-exam-modal';
        startExamModal.className = 'exam-modal';
        startExamModal.innerHTML = `
            <div class="exam-modal-content">
                <div class="exam-modal-header">
                    <h3>Bắt đầu phiên khám</h3>
                    <button class="exam-modal-close">&times;</button>
                </div>
                <div class="exam-modal-body">
                    <form id="start-exam-form">
                        <div class="form-group">
                            <label for="patient-name">Họ và Tên:</label>
                            <input type="text" id="patient-name" name="patient-name" required placeholder="VD: Nguyễn Văn B" tabindex="1">
                        </div>
                        <div class="form-group">
                            <label for="patient-yob">Năm sinh:</label>
                            <input type="number" id="patient-yob" name="patient-yob" min="1900" max="2099" placeholder="VD: 1990" required tabindex="2">
                        </div>
                        <div class="form-group checkbox-group">
                            <label>
                                <input type="checkbox" id="anonymous-check" tabindex="3">
                                <span>Khám ẩn danh</span>
                            </label>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="exam-btn submit-btn" tabindex="4">Bắt đầu khám</button>
                            <button type="button" class="exam-btn cancel-btn" tabindex="5">Hủy</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(startExamModal);

        // Put modal in Safe Zone - protect Tab, Space keys from global hotkey conflict
        allowTypingInModal(startExamModal);

        // Bind modal events
        const closeBtn = startExamModal.querySelector('.exam-modal-close');
        const cancelBtn = startExamModal.querySelector('.cancel-btn');
        const form = startExamModal.querySelector('#start-exam-form');
        const anonymousCheck = startExamModal.querySelector('#anonymous-check');
        const nameInput = startExamModal.querySelector('#patient-name');
        const yobInput = startExamModal.querySelector('#patient-yob');
        const submitBtn = startExamModal.querySelector('.submit-btn');

        closeBtn.addEventListener('click', () => hideModal(startExamModal));
        cancelBtn.addEventListener('click', () => hideModal(startExamModal));

        // Anonymous checkbox logic: disable patient-yob when checked
        anonymousCheck.addEventListener('change', function() {
            if (this.checked) {
                nameInput.value = 'Ẩn danh';
                yobInput.value = '';
                nameInput.disabled = true;
                yobInput.disabled = true;
            } else {
                nameInput.value = '';
                yobInput.value = '';
                nameInput.disabled = false;
                yobInput.disabled = false;
            }
        });

        // Enter key listener for quick submit on inputs AND submit button
        const handleEnterSubmit = function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                // Trigger form submit programmatically
                form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        };
        
        // Add modal-level keydown handler for Enter key on ANY element (including submit button)
        // This uses capture phase to intercept BEFORE UniversalInput catches it
        const modalKeydownHandler = function(e) {
            // Allow Tab to pass through naturally for focus management
            if (e.key === 'Tab') {
                return; // Let browser handle tab order naturally
            }
            
            // Handle Enter key on any element - trigger form submit
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                // Trigger form submit programmatically
                form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        };
        startExamModal.addEventListener('keydown', modalKeydownHandler, true);

        nameInput.addEventListener('keydown', handleEnterSubmit);
        yobInput.addEventListener('keydown', handleEnterSubmit);

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const patientName = nameInput.value.trim();
            const patientYOB = yobInput.value.trim();

            if (!patientName) {
                alert('Vui lòng nhập tên bệnh nhân');
                nameInput.focus();
                return;
            }

            startExam(patientName, patientYOB);
            hideModal(startExamModal);
            form.reset();
            nameInput.disabled = false;
            yobInput.disabled = false;
        });

        // Close on backdrop click
        startExamModal.addEventListener('click', function(e) {
            if (e.target === startExamModal) {
                hideModal(startExamModal);
            }
        });
    }

    // Create End Exam Modal
    function createEndExamModal() {
        endExamModal = document.createElement('div');
        endExamModal.id = 'end-exam-modal';
        endExamModal.className = 'exam-modal';
        endExamModal.innerHTML = `
            <div class="exam-modal-content">
                <div class="exam-modal-header">
                    <h3>Kết thúc phiên khám</h3>
                    <button class="exam-modal-close">&times;</button>
                </div>
                <div class="exam-modal-body">
                    <p>Bạn muốn thực hiện hành động nào?</p>
                    <div class="form-actions">
                        <button type="button" class="exam-btn print-btn" id="print-report-btn">In Hồ Sơ</button>
                        <button type="button" class="exam-btn export-pdf-btn" id="btn-export-pdf">Xuất PDF</button>
                        <button type="button" class="exam-btn view-btn" id="view-results-btn">Chỉ xem kết quả</button>
                        <button type="button" class="exam-btn cancel-btn">Hủy</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(endExamModal);

        // Bind events
        const closeBtn = endExamModal.querySelector('.exam-modal-close');
        const cancelBtn = endExamModal.querySelector('.cancel-btn');
        const printBtn = endExamModal.querySelector('#print-report-btn');
        const exportPdfBtn = endExamModal.querySelector('#btn-export-pdf');
        const viewBtn = endExamModal.querySelector('#view-results-btn');

        closeBtn.addEventListener('click', () => hideModal(endExamModal));
        cancelBtn.addEventListener('click', () => hideModal(endExamModal));

        printBtn.addEventListener('click', function() {
            hideModal(endExamModal);
            printReport();
        });

        exportPdfBtn.addEventListener('click', function() {
            hideModal(endExamModal);
            exportPDF();
        });

        viewBtn.addEventListener('click', function() {
            hideModal(endExamModal);
            showReportModal();
        });

        // Close on backdrop click
        endExamModal.addEventListener('click', function(e) {
            if (e.target === endExamModal) {
                hideModal(endExamModal);
            }
        });
    }

    // Create Report Modal
    function createReportModal() {
        reportModal = document.createElement('div');
        reportModal.id = 'report-modal';
        reportModal.className = 'exam-modal';
        reportModal.innerHTML = `
            <div class="exam-modal-content report-modal-content">
                <div class="exam-modal-header">
                    <h3>Kết quả phiên khám</h3>
                    <button class="exam-modal-close">&times;</button>
                </div>
                <div class="exam-modal-body">
                    <div id="report-content"></div>
                    <div class="form-actions">
                        <button type="button" class="exam-btn reset-btn" id="reset-session-btn">Đóng và Reset Phiên</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(reportModal);

        // Bind events
        const closeBtn = reportModal.querySelector('.exam-modal-close');
        const resetBtn = reportModal.querySelector('#reset-session-btn');

        closeBtn.addEventListener('click', function() {
            hideModal(reportModal);
            resetSession();
        });

        resetBtn.addEventListener('click', function() {
            hideModal(reportModal);
            resetSession();
        });

        // Close on backdrop click
        reportModal.addEventListener('click', function(e) {
            if (e.target === reportModal) {
                hideModal(reportModal);
                resetSession();
            }
        });
    }

    // Create Print Container
    function createPrintContainer() {
        printContainer = document.createElement('div');
        printContainer.id = 'print-report-container';
        printContainer.className = 'print-report-container';
        printContainer.style.display = 'none';
        document.body.appendChild(printContainer);
    }

    /**
     * Helper: Safely parse clinical_metrics object to readable string
     * @param {object|string|null} metrics
     * @returns {string}
     */
    function formatClinicalMetrics(metrics) {
        if (!metrics || metrics === 'N/A') return 'N/A';
        if (typeof metrics === 'object') {
            return Object.entries(metrics)
                .map(([key, value]) => `${key}: ${value}`)
                .join('<br>');
        }
        return String(metrics);
    }

    /**
     * Global function to refresh all active test views with new anaglyph colors.
     * Called after saveClinicSettings() updates window.__anaglyphColors.
     */
    window.refreshTestViews = function() {
        // Schober Test: check if canvas is visible on DOM
        const schoberCanvas = document.getElementById('schober-canvas');
        if (schoberCanvas && schoberCanvas.offsetParent !== null && typeof SchoberTestRender === 'function') {
            SchoberTestRender();
        }

        // Worth 4 Dot: check if SVG container is visible
        const worthSvg = document.querySelector('.worth4dot-svg');
        if (worthSvg && typeof Worth4DotRender === 'function') {
            Worth4DotRender();
        }

        // Stereo Anaglyph: check if canvas is visible
        const stereoCanvas = document.getElementById('stereo-canvas');
        if (stereoCanvas && stereoCanvas.offsetParent !== null && typeof StereoAnaglyphRefresh === 'function') {
            StereoAnaglyphRefresh();
        }

        // Dynamic Vergence: check if layers exist
        const redLayer = document.getElementById('dv-red-layer');
        const cyanLayer = document.getElementById('dv-cyan-layer');
        if (redLayer && cyanLayer && typeof DynamicVergenceRefresh === 'function') {
            DynamicVergenceRefresh();
        }

        // Dynamic Fixation: check if fixation container exists
        const dfContainer = document.getElementById('dynamic-fixation-container');
        if (dfContainer && dfContainer.offsetParent !== null && typeof DynamicFixationRefresh === 'function') {
            DynamicFixationRefresh();
        }

        console.log('[refreshTestViews] All active test views refreshed with new anaglyph colors.');
    };

    /**
     * Helper: Generate report HTML for both Modal View and Print
     * @param {boolean} isPrintMode - true for print layout, false for modal layout
     * @returns {string}
     */
    /**
     * Helper: Generate report HTML for both Modal View and Print
     * @param {boolean} isPrintMode - true for print layout, false for modal layout
     * @param {Object|null} examData - Optional exam data object. Defaults to window.__currentExam
     * @returns {string}
     */
    function generateReportHTML(isPrintMode, examData = null) {
        const exam = examData || window.__currentExam;
        const startDate = new Date(exam.startTime);
        
        let formattedDate, formattedTime;
        if (isPrintMode) {
            formattedDate = startDate.toLocaleDateString('vi-VN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } else {
            formattedDate = startDate.toLocaleDateString('vi-VN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            formattedTime = startDate.toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        // Build patient info rows (supports both old format with patientYOB and legacy format without)
        const patientYOB = exam.patientYOB || 'N/A';
        const patientAge = exam.patientAge || 'N/A';
        let patientInfoRows = '';
        
        if (isPrintMode) {
            patientInfoRows = `
                <tr><td class="label">Họ và tên:</td><td>${exam.patientName}</td></tr>
                <tr><td class="label">Năm sinh:</td><td>${patientYOB}${patientYOB !== 'N/A' && patientAge !== 'N/A' ? ' (' + patientAge + ' tuổi)' : ''}</td></tr>
                <tr><td class="label">Ngày khám:</td><td>${formattedDate}</td></tr>
            `;
        } else {
            patientInfoRows = `
                <tr><td class="label">Họ và tên:</td><td>${exam.patientName}</td></tr>
                <tr><td class="label">Năm sinh:</td><td>${patientYOB}${patientYOB !== 'N/A' && patientAge !== 'N/A' ? ' (' + patientAge + ' tuổi)' : ''}</td></tr>
                <tr><td class="label">Ngày khám:</td><td>${formattedDate} ${formattedTime || ''}</td></tr>
            `;
        }

        let html = '';

        if (isPrintMode) {
            // Print mode HTML structure
            html += `<div class="print-report">`;

            // Inject clinic header if settings exist
            const clinicHeader = generateClinicHeaderHTML();
            if (clinicHeader) {
                html += clinicHeader;
            }

            html += `
                <div class="print-header">
                    <h1>PHÒNG KHÁM NHÃN KHOA</h1>
                    <h2>BÁO CÁO KẾT QUẢ KHÁM MẮT</h2>
                </div>
                <div class="print-patient-info">
                    <h3>THÔNG TIN BỆNH NHÂN</h3>
                    <table class="print-table">
                        ${patientInfoRows}
                    </table>
                </div>
                <div class="print-results">
                    <!-- PHẦN I: KHÁM & CHẨN ĐOÁN -->
                    <h3 style="font-size: 18px; font-weight: bold; color: #1e293b; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #10b981;">PHẦN I: KHÁM & CHẨN ĐOÁN</h3>
            `;
        } else {
            // Modal view HTML structure
            // Inject clinic header if settings exist
            const clinicHeader = generateClinicHeaderHTML();
            if (clinicHeader) {
                html += `<div class="clinic-report-header-wrapper">${clinicHeader}</div>`;
            }

            html += `
                <div class="report-patient-info">
                    <h4>Thông tin bệnh nhân</h4>
                    <table class="report-table">
                        ${patientInfoRows}
                    </table>
                </div>
                <div class="report-results">
                    <!-- PHẦN I: KHÁM & CHẨN ĐOÁN -->
                    <h4 style="font-size: 16px; font-weight: bold; color: #1e293b; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #10b981;">PHẦN I: KHÁM & CHẨN ĐOÁN</h4>
            `;
        }

        if (exam.results.length === 0) {
            html += '<p>Chưa có kết quả bài test nào.</p>';
        } else {
            if (isPrintMode) {
                html += `
                    <table class="print-table results-table">
                        <thead>
                            <tr><th>STT</th><th>Tên bài test</th><th>Kết quả lâm sàng</th></tr>
                        </thead>
                        <tbody>
                `;
            } else {
                html += `
                    <table class="report-table results-table">
                        <thead>
                            <tr><th>STT</th><th>Tên bài test</th><th>Kết quả lâm sàng</th><th>Thời gian</th></tr>
                        </thead>
                        <tbody>
                `;
            }

            exam.results.forEach((result, index) => {
                const resultTime = new Date(result.timestamp);
                const timeStr = resultTime.toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                const metricsStr = formatClinicalMetrics(result.clinical_metrics);

                if (isPrintMode) {
                    html += `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${result.test_type}</td>
                            <td>${metricsStr}</td>
                        </tr>
                    `;
                } else {
                    html += `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${result.test_type}</td>
                            <td>${metricsStr}</td>
                            <td>${timeStr}</td>
                        </tr>
                    `;
                }
            });

            html += '</tbody></table>';
        }

        // ================================================================
        //  UNIFIED REPORT: Add PART I header & PART II Therapy Section
        //  Position: After results table, before footer
        // ================================================================
        
        if (isPrintMode) {
            html += `
                </div>
                <!-- PHẦN I: KHÁM & CHẨN ĐOÁN - Header already added above results table -->
                
                <!-- PHẦN II: HUẤN LUYỆN PHÂN THỊ (DICHOPTIC THERAPY) -->
                <div class="therapy-report-section" style="margin-top: 30px; page-break-inside: avoid;">
                    <h3 style="font-size: 18px; font-weight: bold; color: #1e293b; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #3b82f6;">PHẦN II: HUẤN LUYỆN PHÂN THỊ (DICHOPTIC THERAPY)</h3>
                    ${window.generateTherapyReportHTML ? window.generateTherapyReportHTML(exam.patientId || '') : '<p style="font-style: italic; color: #64748b;">Không có dữ liệu huấn luyện.</p>'}
                </div>
                
                <div class="print-footer">
                    <p>--- HẾT ---</p>
                    <p><em>Báo cáo được tạo tự động bởi Hệ thống Khám Mắt</em></p>
                </div>
            </div>
            `;
        } else {
            html += `
                </div>
                <!-- PHẦN I: KHÁM & CHẨN ĐOÁN - Header already added above results table -->
                
                <!-- PHẦN II: HUẤN LUYỆN PHÂN THỊ (DICHOPTIC THERAPY) -->
                <div class="therapy-report-section" style="margin-top: 30px;">
                    <h4 style="font-size: 16px; font-weight: bold; color: #1e293b; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #3b82f6;">PHẦN II: HUẤN LUYỆN PHÂN THỊ (DICHOPTIC THERAPY)</h4>
                    ${window.generateTherapyReportHTML ? window.generateTherapyReportHTML(exam.patientId || '') : '<p style="font-style: italic; color: #64748b;">Không có dữ liệu huấn luyện.</p>'}
                </div>
            </div>
            `;
        }

        return html;
    }

    /**
     * Save current exam session to localStorage for auto-recovery
     */
    function saveSession() {
        if (window.__currentExam) {
            try {
                localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(window.__currentExam));
            } catch (e) {
                console.warn('Failed to save session to localStorage:', e);
            }
        }
    }

    /**
     * Restore exam session from localStorage on page load/reload
     */
    function restoreSession() {
        try {
            const savedData = localStorage.getItem(SESSION_STORAGE_KEY);
            if (savedData) {
                const exam = JSON.parse(savedData);
                if (exam && exam.patientName && exam.startTime) {
                    window.__currentExam = exam;
                    console.log('[ExamSessionManager] Restored active session:', exam.patientName);
                    
                    // Restore UI to "in-exam" state
                    updateExamUI();
                    
                    // Show warning toast
                    showToast(`Đã khôi phục phiên khám: ${exam.patientName}`);
                }
            }
        } catch (e) {
            console.error('[ExamSessionManager] Failed to restore session:', e);
            localStorage.removeItem(SESSION_STORAGE_KEY);
        }
    }

    // Create Toast Container
    function createToastContainer() {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // Create Floating Action Button (FAB) for manual save
    function createManualSaveFab() {
        manualFab = document.createElement('button');
        manualFab.id = 'manual-save-fab';
        manualFab.className = 'manual-save-fab';
        manualFab.setAttribute('title', 'Lưu kết quả thủ công');
        manualFab.innerHTML = '<span class="fab-icon">💾</span><span class="fab-text">Lưu kết quả</span>';
        document.body.appendChild(manualFab);

        manualFab.addEventListener('click', handleManualSaveFabClick);
    }

    // Create Manual Entry Modal
    function createManualEntryModal() {
        // Build datalist options from TEST_NAMES_LIST
        const datalistOptions = TEST_NAMES_LIST.map(name => `<option value="${name}">`).join('\n            ');

        manualEntryModal = document.createElement('div');
        manualEntryModal.id = 'manual-entry-modal';
        manualEntryModal.className = 'exam-modal';
        manualEntryModal.setAttribute('role', 'dialog');
        manualEntryModal.setAttribute('aria-modal', 'true');
        manualEntryModal.innerHTML = `
            <div class="exam-modal-content manual-entry-modal-content">
                <div class="exam-modal-header">
                    <h3>Ghi Nhận Kết Quả Lâm Sàng</h3>
                    <button class="exam-modal-close" type="button" tabindex="0">&times;</button>
                </div>
                <div class="exam-modal-body">
                    <form id="manual-entry-form" class="manual-entry-form" novalidate>
                        <div class="form-row">
                            <div class="form-col">
                                <div class="form-group">
                                    <label for="manual-test-name">Tên bài test / Khám chức năng:</label>
                                    <input type="text" id="manual-test-name" list="test-names-list" placeholder="Nhập hoặc chọn tên bài test..." required autocomplete="off" tabindex="0">
                                    <datalist id="test-names-list">
                                        ${datalistOptions}
                                    </datalist>
                                </div>
                            </div>
                            <div class="form-col">
                                <div class="form-group">
                                    <label>Kết quả / Thông số:</label>
                                    <div class="result-input-group">
                                        <div class="result-input-row">
                                            <span class="eye-label">Mắt phải (OD):</span>
                                            <textarea id="manual-result-od" rows="1" placeholder="VD: 20/20, PLANO..." maxlength="200" tabindex="0"></textarea>
                                        </div>
                                        <div class="result-input-row">
                                            <span class="eye-label">Mắt trái (OS):</span>
                                            <textarea id="manual-result-os" rows="1" placeholder="VD: 20/25, -0.50D..." maxlength="200" tabindex="0"></textarea>
                                        </div>
                                        <div class="result-input-row">
                                            <span class="eye-label">Khác:</span>
                                            <textarea id="manual-result-other" rows="1" placeholder="Ghi chú thêm (tự do)..." maxlength="500" tabindex="0"></textarea>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="exam-btn submit-btn-gradient" tabindex="0">Lưu & Ghi nhận</button>
                            <button type="button" class="exam-btn cancel-btn" id="manual-entry-cancel" tabindex="0">Hủy</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(manualEntryModal);

        // Bind modal events
        const closeBtn = manualEntryModal.querySelector('.exam-modal-close');
        const cancelBtn = manualEntryModal.querySelector('#manual-entry-cancel');
        const form = manualEntryModal.querySelector('#manual-entry-form');

        closeBtn.addEventListener('click', () => hideModal(manualEntryModal));
        cancelBtn.addEventListener('click', () => {
            hideModal(manualEntryModal);
            resetManualEntryForm();
        });

        form.addEventListener('submit', handleManualEntrySubmit);

        // Prevent modal backdrop from capturing keyboard events
        manualEntryModal.addEventListener('keydown', function(e) {
            // Allow Tab to pass through naturally for focus management
            if (e.key === 'Tab') {
                // Do nothing - let browser handle tab order naturally
                return;
            }
            // Close on Escape key
            if (e.key === 'Escape') {
                e.preventDefault();
                hideModal(manualEntryModal);
                resetManualEntryForm();
            }
        });

        // Close on backdrop click (only when clicking the overlay, not content)
        manualEntryModal.addEventListener('click', function(e) {
            if (e.target === manualEntryModal) {
                hideModal(manualEntryModal);
                resetManualEntryForm();
            }
        });

        // Focus first input when modal opens
        const originalShowModal = showModal;
        const _showManualEntry = function(modal) {
            if (modal === manualEntryModal) {
                originalShowModal(modal);
                // Focus first input after modal is visible
                setTimeout(() => {
                    const firstInput = document.getElementById('manual-test-name');
                    if (firstInput) firstInput.focus();
                }, 100);
            } else {
                originalShowModal(modal);
            }
        };
        // Override showModal temporarily for this modal
        window._showManualEntry = _showManualEntry;

        // Protect form inputs from global hotkey listeners
        allowTypingInModal(manualEntryModal);
    }

    // Handle FAB click event
    function handleManualSaveFabClick() {
        if (!window.__currentExam) {
            showToast('Vui lòng bấm \'Bắt đầu khám\' trước khi lưu kết quả');
            return;
        }

        // Try to auto-detect module and save
        const autoSaved = tryAutoDetectAndSave();
        if (!autoSaved) {
            // Open manual entry modal with focus on first input
            if (window._showManualEntry) {
                window._showManualEntry(manualEntryModal);
            } else {
                showModal(manualEntryModal);
            }
        }
    }

    // Try to auto-detect current module and trigger its internal save
    function tryAutoDetectAndSave() {
        // Check for Schober test canvas
        const schoberCanvas = document.getElementById('schober-canvas');
        if (schoberCanvas && schoberCanvas.offsetParent !== null) {
            // Trigger SchoberTest save if available
            if (window.SchoberTest && window.SchoberTest.prototype?.saveResults) {
                window.SchoberTest.prototype.saveResults.call(window.SchoberInstance);
                return true;
            }
        }

        // Check for Dynamic Vergence
        const dvContainer = document.getElementById('dynamic-vergence-container');
        if (dvContainer && dvContainer.offsetParent !== null) {
            if (window.DynamicVergence && window.DynamicVergence.prototype?.saveResults) {
                window.DynamicVergence.prototype.saveResults.call(window.DynamicVergenceInstance);
                return true;
            }
        }

        // Check for Dynamic Fixation
        const dfContainer = document.getElementById('dynamic-fixation-container');
        if (dfContainer && dfContainer.offsetParent !== null) {
            if (window.DynamicFixation && window.DynamicFixation.prototype?.saveResults) {
                window.DynamicFixation.prototype.saveResults.call(window.DynamicFixationInstance);
                return true;
            }
        }

        // No matching module detected
        return false;
    }

    // Handle manual entry form submit
    function handleManualEntrySubmit(e) {
        e.preventDefault();

        const testNameInput = document.getElementById('manual-test-name');
        const resultOD = document.getElementById('manual-result-od');
        const resultOS = document.getElementById('manual-result-os');
        const resultOther = document.getElementById('manual-result-other');

        const testNameValue = testNameInput.value.trim();
        const odValue = resultOD.value.trim();
        const osValue = resultOS.value.trim();
        const otherValue = resultOther.value.trim();

        // Validate: at least one right-side input must be filled
        if (!odValue && !osValue && !otherValue) {
            showToast('Vui lòng điền ít nhất một trường kết quả (Mắt phải, Mắt trái, hoặc Khác)');
            return;
        }

        // Build clinical_metrics object
        const clinicalMetrics = {};
        if (odValue) clinicalMetrics['OD (Mắt phải)'] = odValue;
        if (osValue) clinicalMetrics['OS (Mắt trái)'] = osValue;
        if (otherValue) clinicalMetrics['Khác'] = otherValue;

        // Create payload
        const payload = {
            test_type: testNameValue,
            is_manual_entry: true,
            clinical_metrics: clinicalMetrics
        };

        // Dispatch visionTestCompleted event
        const event = new CustomEvent('visionTestCompleted', {
            detail: payload,
            bubbles: true
        });
        document.dispatchEvent(event);

        // Close modal
        hideModal(manualEntryModal);

        // Show toast notification
        showToast(`Đã lưu kết quả ${testNameValue}`);

        // Play beep sound if available
        if (typeof playBeepSound === 'function') {
            playBeepSound();
        }

        // Reset form
        resetManualEntryForm();
    }

    // Reset manual entry form fields
    function resetManualEntryForm() {
        const testNameInput = document.getElementById('manual-test-name');
        const resultOD = document.getElementById('manual-result-od');
        const resultOS = document.getElementById('manual-result-os');
        const resultOther = document.getElementById('manual-result-other');

        if (testNameInput) testNameInput.value = '';
        if (resultOD) resultOD.value = '';
        if (resultOS) resultOS.value = '';
        if (resultOther) resultOther.value = '';
    }

    // Bind event listeners
    function bindEvents() {
        if (startExamBtn) {
            startExamBtn.addEventListener('click', () => {
                showModal(startExamModal);
                // Auto-focus into patient name input after modal opens
                setTimeout(() => {
                    const nameInput = document.getElementById('patient-name');
                    if (nameInput) {
                        nameInput.focus();
                    }
                }, 100);
            });
        }

        if (endExamBtn) {
            endExamBtn.addEventListener('click', () => showModal(endExamModal));
        }
    }

    // Setup vision test completed listener
    function setupVisionTestListener() {
        window.addEventListener('visionTestCompleted', function(event) {
            if (!window.__currentExam) {
                console.warn('No active exam session');
                return;
            }

            const testResult = event.detail || {};
            testResult.timestamp = Date.now();
            testResult.test_type = testResult.test_type || 'Unknown Test';

            window.__currentExam.results.push(testResult);

            // Auto-save session after adding new result
            saveSession();

            // Show toast notification
            showToast(`Đã lưu kết quả ${testResult.test_type}`);
        });
    }

    // ===== GLOBAL HOTKEY FOR MANUAL SAVE =====
    let _boundGlobalHotkey = null;

    /**
     * Setup global keyboard shortcut (Ctrl+Space or F2) to trigger manual save.
     * Uses capture phase to intercept before other modules consume the key.
     */
    function setupGlobalHotkey() {
        _boundGlobalHotkey = function(e) {
            // Only react to keydown (not repeat/hold)
            if (e.repeat) return;

            const isCtrlSpace = e.ctrlKey && (e.key === ' ' || e.code === 'Space');
            const isF2 = e.key === 'F2' || e.code === 'F2';

            if (isCtrlSpace || isF2) {
                e.preventDefault();
                e.stopPropagation();

                if (!window.__currentExam) {
                    showToast('Vui lòng bấm \'Bắt đầu khám\' trước khi lưu kết quả');
                    return;
                }

                // Call FAB handler which auto-detects or opens modal
                handleManualSaveFabClick();

                // Auto-focus first input after modal opens
                setTimeout(() => {
                    const testNameInput = document.getElementById('manual-test-name');
                    if (testNameInput && manualEntryModal && manualEntryModal.style.display === 'flex') {
                        testNameInput.focus();
                    }
                }, 100);
            }
        };

        // Use capture phase to intercept BEFORE UniversalInput (controller.js) consumes Enter
        document.addEventListener('keydown', _boundGlobalHotkey, true);
    }

    /**
     * Cleanup global hotkey listener.
     */
    function cleanupGlobalHotkey() {
        if (_boundGlobalHotkey) {
            document.removeEventListener('keydown', _boundGlobalHotkey, true);
            _boundGlobalHotkey = null;
        }
    }

    // Start exam
    function startExam(patientName, patientYOB) {
        // Calculate age from Year of Birth
        const age = patientYOB && !isNaN(parseInt(patientYOB))
            ? (new Date().getFullYear() - parseInt(patientYOB))
            : 'N/A';

        // Generate a unique patientId for this exam session (used for therapy report lookup)
        // Format: PATIENTNAME_YOB_TIMESTAMP for uniqueness
        const safeName = (patientName || 'UNKNOWN').replace(/[^a-zA-Z0-9À-ỹ\s]/g, '').trim().replace(/\s+/g, '_');
        const patientId = `${safeName}_${patientYOB || 'NOYOB'}_${Date.now()}`;

        window.__currentExam = {
            patientName: patientName,
            patientYOB: patientYOB || 'N/A',
            patientAge: age,
            patientId: patientId,
            startTime: Date.now(),
            results: []
        };

        // Auto-save session
        saveSession();

        // Update UI
        updateExamUI();

        // Enter fullscreen
        enterFullscreen();
    }

    // Update exam UI
    function updateExamUI() {
        if (!window.__currentExam) return;

        const statusContainer = document.getElementById('exam-status-container');
        if (statusContainer) {
            statusContainer.style.display = 'flex';
        }

        if (startExamBtn) {
            startExamBtn.style.display = 'none';
        }

        if (examStatusText) {
            const exam = window.__currentExam;
            examStatusText.innerHTML = `👤 ${exam.patientName} - SN: ${exam.patientYOB || 'N/A'} (Đang khám)`;
        }
    }

    /**
     * Show report in modal view ("Chỉ xem kết quả")
     * @param {Object|null} examData - Optional exam data object. Defaults to window.__currentExam
     * @param {boolean} isFromHistory - True if viewing from history (prevents saveToHistory on close)
     */
    function showReportModal(examData = null, isFromHistory = false) {
        const exam = examData || window.__currentExam;
        if (!exam) return;

        // Temporarily replace current exam for rendering
        const originalExam = window.__currentExam;
        window.__currentExam = exam;

        const reportContent = document.getElementById('report-content');
        if (!reportContent) {
            window.__currentExam = originalExam;
            return;
        }

        // Generate and inject report HTML using shared helper
        reportContent.innerHTML = generateReportHTML(false, exam);

        // Get the reset button and remove old listeners before adding new ones
        const resetBtn = document.getElementById('reset-session-btn');
        if (resetBtn) {
            // Clone and replace to remove all event listeners
            const newResetBtn = resetBtn.cloneNode(true);
            resetBtn.parentNode.replaceChild(newResetBtn, resetBtn);

            if (isFromHistory === true) {
                // History mode: Just close modal, NO resetSession
                newResetBtn.textContent = 'Đóng';
                newResetBtn.addEventListener('click', function() {
                    hideModal(reportModal);
                    // Restore original exam state
                    window.__currentExam = originalExam;
                });
            } else {
                // Normal mode: Close and reset session
                newResetBtn.textContent = 'Đóng & Hoàn Tất Khám';
                newResetBtn.addEventListener('click', function() {
                    hideModal(reportModal);
                    resetSession();
                });
            }
        }

        showModal(reportModal);
    }

    /**
     * Print report ("In Hồ Sơ")
     * Creates div, appends to body, waits 300ms for repaint, then calls window.print()
     * Uses window.onafterprint to cleanup and reset session
     */
    function printReport() {
        if (!window.__currentExam) return;

        // Generate report HTML using shared helper
        const reportHTML = generateReportHTML(true);

        // Create/Update print container and append to body
        printContainer.innerHTML = reportHTML;
        printContainer.style.display = 'block';
        document.body.appendChild(printContainer);

        // Wait 300ms for browser to repaint DOM before printing
        setTimeout(() => {
            window.print();
        }, 300);
    }

    // Hook into window.onafterprint for cleanup after print dialog closes
    if (typeof window !== 'undefined') {
        window.onafterprint = function() {
            // Remove print container from DOM
            if (printContainer && printContainer.parentNode) {
                printContainer.parentNode.removeChild(printContainer);
            }
            // Reset session after print completes
            resetSession();
        };
    }

    /**
     * Export report as PDF file using html2pdf.js
     * Creates a temporary element, renders it to PDF, and triggers download
     */
    /**
     * Export report as PDF file using html2pdf.js
     * @param {Object|null} examData - Optional exam data object. Defaults to window.__currentExam
     */
    function exportPDF(examData = null) {
        const exam = examData || window.__currentExam;
        if (!exam) return;

        // Check if html2pdf library is loaded
        if (typeof html2pdf === 'undefined') {
            console.error('[ExamSessionManager] html2pdf library not loaded');
            showToast('Lỗi: Thư viện xuất PDF chưa được tải');
            return;
        }

        // Generate report HTML using shared helper (print mode)
        const element = document.createElement('div');
        element.innerHTML = generateReportHTML(true, exam);
        element.style.padding = '20px';
        element.style.color = '#000';
        element.style.fontFamily = "'Times New Roman', serif";
        element.style.backgroundColor = '#fff';

        // Create safe filename from patient name and date
        const date = new Date(exam.startTime);
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const safeName = exam.patientName
            .replace(/[^a-z0-9A-Z_À-ỹ]/gi, '_')
            .replace(/\s+/g, '_');
        const filename = `Kham_Mat_${safeName}_${dateStr}.pdf`;

        // PDF configuration
        const opt = {
            margin:       10,
            filename:     filename,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Show loading toast
        showToast('Đang tạo file PDF...');

        // Generate and save PDF
        html2pdf().set(opt).from(element).save().then(() => {
            showToast('Đã tải xuống file PDF thành công');
        }).catch((err) => {
            console.error('[ExamSessionManager] PDF export failed:', err);
            showToast('Lỗi: Không thể tạo file PDF');
        });
    }

    /**
     * Save current exam to local EMR history
     * Now includes therapy_records — saves if either clinical tests OR therapy data exist
     */
    function saveToHistory(exam) {
        // Safety check: only save if we have valid exam data
        const hasTests = exam && exam.results && exam.results.length > 0;
        const hasTherapy = exam && exam.therapy_records && exam.therapy_records.length > 0;

        if (!hasTests && !hasTherapy) {
            console.warn('[ExamSessionManager] Chon luu vao lich su: Phiem khom trong (khong co lam sang hoac thuan luyen).');
            return;
        }

        try {
            let history = localStorage.getItem(EMR_HISTORY_KEY);
            history = history ? JSON.parse(history) : [];
            
            // Add to beginning of array
            history.unshift({ ...exam, viewedAt: null });
            
            // Memory protection: remove oldest if > 200 items
            if (history.length > 200) {
                history.pop();
            }
            
            localStorage.setItem(EMR_HISTORY_KEY, JSON.stringify(history));
            console.log('[ExamSessionManager] Saved to EMR history. Total records:', history.length);
        } catch (e) {
            console.error('[ExamSessionManager] Failed to save to history:', e);
        }
    }

    // Reset session
    function resetSession() {
        // Save completed exam to history BEFORE clearing
        // Now includes therapy_records — saves if either clinical tests OR therapy data exist
        const hasTests = window.__currentExam && window.__currentExam.results && window.__currentExam.results.length > 0;
        const hasTherapy = window.__currentExam && window.__currentExam.therapy_records && window.__currentExam.therapy_records.length > 0;

        if (!hasTests && !hasTherapy) {
            console.warn('[ExamSessionManager] Chon reset: Phiem kham trong (khong co lam sang hoac thuan luyen).');
        } else {
            saveToHistory(window.__currentExam);
        }

        // Exit fullscreen
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => {
                console.error('Error exiting fullscreen:', err);
            });
        }

        // Clear exam data
        window.__currentExam = null;

        // Remove saved session from localStorage
        try {
            localStorage.removeItem(SESSION_STORAGE_KEY);
        } catch (e) {
            console.warn('Failed to remove session from localStorage:', e);
        }

        // Reset UI
        const statusContainer = document.getElementById('exam-status-container');
        if (statusContainer) {
            statusContainer.style.display = 'none';
        }

        if (startExamBtn) {
            startExamBtn.style.display = 'inline-block';
        }

        if (examStatusText) {
            examStatusText.innerHTML = '';
        }
    }

    // Enter fullscreen
    function enterFullscreen() {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => {
                console.error('Error entering fullscreen:', err);
            });
        }
    }

    // Show modal
    function showModal(modal) {
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    // Hide modal
    function hideModal(modal) {
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Show toast notification
    function showToast(message) {
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        toastContainer.appendChild(toast);

        // Trigger animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Remove after 2 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 2000);
    }


    // ===== EMR HISTORY VIEWER MODULE =====

    /**
     * Format timestamp to Vietnamese date string (dd/mm/yyyy HH:MM)
     * @param {number} timestamp - Unix timestamp in milliseconds
     * @returns {string}
     */
    function formatHistoryDate(timestamp) {
        const date = new Date(timestamp);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    /**
     * Create History Viewer UI (Button + Modal)
     */
    function createHistoryViewerUI() {
        const navbarHeader = document.getElementById('sidebar-header');
        if (!navbarHeader) {
            console.warn('[EMRHistory] Navbar header not found');
            return;
        }

        const historyBtn = document.createElement('button');
        historyBtn.id = 'history-viewer-btn';
        // nav-btn: đăng ký với thuật toán điều hướng bàn phím 2D trong main.js (updateMenuFocus)
        historyBtn.className = 'exam-btn history-btn nav-btn';
        historyBtn.setAttribute('title', 'Kho bệnh án');
        historyBtn.innerHTML = '\uD83D\uDDC2\uFE0F';

        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            navbarHeader.insertBefore(historyBtn, fullscreenBtn);
        } else {
            navbarHeader.appendChild(historyBtn);
        }

        historyBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            openHistoryModal();
        });

        historyModal = document.createElement('div');
        historyModal.id = 'history-modal';
        historyModal.className = 'exam-modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'exam-modal-content history-modal-content';
        modalContent.style.maxWidth = '900px';
        modalContent.style.width = '94%';

        const modalHeader = document.createElement('div');
        modalHeader.className = 'exam-modal-header';
        const headerH3 = document.createElement('h3');
        headerH3.textContent = '\uD83D\uDCCB Kho Benh An';
        const headerClose = document.createElement('button');
        headerClose.className = 'exam-modal-close';
        headerClose.type = 'button';
        headerClose.innerHTML = '&times;';
        modalHeader.appendChild(headerH3);
        modalHeader.appendChild(headerClose);

        const modalBody = document.createElement('div');
        modalBody.className = 'exam-modal-body history-modal-body';

        // Create search container with export button wrapper
        const searchWrapper = document.createElement('div');
        searchWrapper.className = 'search-export-wrapper';
        searchWrapper.style.cssText = 'display: flex; gap: 10px; align-items: center; margin-bottom: 8px;';

        const searchContainer = document.createElement('div');
        searchContainer.className = 'history-search-container';
        searchContainer.style.cssText = 'flex: 1;';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'history-search';
        searchInput.placeholder = '\uD83D\uDD0D Tim ten benh nhan...';
        searchInput.addEventListener('input', function() {
            renderHistoryTable(this.value.trim());
        });
        searchContainer.appendChild(searchInput);

        // Export CSV Button
        const exportCsvBtn = document.createElement('button');
        exportCsvBtn.id = 'btn-export-csv';
        exportCsvBtn.className = 'exam-btn export-csv-btn';
        exportCsvBtn.textContent = '\uD83D\uDCCA Xuất Excel';
        exportCsvBtn.setAttribute('title', 'Xuất dữ liệu lịch sử ra file CSV (Excel)');
        exportCsvBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            exportHistoryToCSV();
        });

        searchWrapper.appendChild(searchContainer);
        searchWrapper.appendChild(exportCsvBtn);

        const resultsCount = document.createElement('div');
        resultsCount.id = 'history-results-count';
        resultsCount.style.cssText = 'font-size: 13px; color: var(--gray-500); margin-top: 8px; font-weight: 500;';
        searchWrapper.appendChild(resultsCount);

        // Record count info (current/200)
        const recordCountInfo = document.createElement('div');
        recordCountInfo.id = 'history-record-count-info';
        recordCountInfo.style.cssText = 'font-size: 12px; color: var(--gray-400); margin-top: 4px; font-style: italic;';
        searchWrapper.appendChild(recordCountInfo);

        const tableContainer = document.createElement('div');
        tableContainer.id = 'history-table-container';
        tableContainer.className = 'history-table-container';
        tableContainer.style.cssText = 'margin-top: 16px; border: 1px solid var(--gray-200); border-radius: var(--radius-md); overflow: auto; max-height: 500px; box-shadow: var(--shadow-sm);';

        const table = document.createElement('table');
        table.id = 'history-table';
        table.className = 'history-table';
        table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 13.5px;';

        const thead = document.createElement('thead');
        thead.style.cssText = 'position: sticky; top: 0; z-index: 10;';
        const theadRow = document.createElement('tr');
        theadRow.style.cssText = 'background: linear-gradient(180deg, var(--exam-primary) 0%, #1d4ed8 100%);';
        ['Ngay kham', 'Benh nhan', 'Nam sinh', 'Thao tac'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            th.style.cssText = 'padding: 12px 14px; text-align: left; font-weight: 600; font-size: 12.5px; letter-spacing: 0.04em; text-transform: uppercase; color: white; border: none;';
            if (text === 'Thao tac') {
                th.style.textAlign = 'center';
                th.style.width = '140px';
            }
            theadRow.appendChild(th);
        });
        thead.appendChild(theadRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        tbody.id = 'history-tbody';
        tbody.style.cssText = 'background: white;';
        table.appendChild(tbody);
        tableContainer.appendChild(table);

        const emptyState = document.createElement('div');
        emptyState.id = 'history-empty-state';
        emptyState.style.cssText = 'text-align: center; padding: 40px 20px; color: var(--gray-400); font-style: italic; display: none;';
        emptyState.textContent = 'Chua co benh an nao trong lich su.';

        const formActions = document.createElement('div');
        formActions.className = 'form-actions';
        formActions.style.marginTop = '20px';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'exam-btn cancel-btn';
        closeBtn.textContent = 'Dong';
        closeBtn.addEventListener('click', function() {
            hideModal(historyModal);
        });
        formActions.appendChild(closeBtn);

        modalBody.appendChild(searchWrapper);
        modalBody.appendChild(tableContainer);
        modalBody.appendChild(emptyState);
        modalBody.appendChild(formActions);

        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        historyModal.appendChild(modalContent);

        headerClose.addEventListener('click', function() {
            hideModal(historyModal);
        });

        historyModal.addEventListener('click', function(e) {
            if (e.target === historyModal) {
                hideModal(historyModal);
            }
        });

        document.body.appendChild(historyModal);
        allowTypingInModal(historyModal);
        renderHistoryTable();
    }

    /**
     * Open History Modal and render table
     */
    function openHistoryModal() {
        renderHistoryTable();
        showModal(historyModal);
    }

    /**
     * Render history table with optional search filter
     * @param {string} searchTerm - Optional search term
     */
    function renderHistoryTable(searchTerm = '') {
        try {
            let history = localStorage.getItem(EMR_HISTORY_KEY);
            history = history ? JSON.parse(history) : [];

            const tbody = document.getElementById('history-tbody');
            const emptyState = document.getElementById('history-empty-state');
            const resultsCount = document.getElementById('history-results-count');

            if (!tbody) return;

            let filtered = history;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filtered = history.filter(exam => 
                    exam.patientName && exam.patientName.toLowerCase().includes(term)
                );
            }

            if (resultsCount) {
                resultsCount.textContent = filtered.length === history.length
                    ? `Hien thi tat ca: ${history.length} benh an`
                    : `Tim thay: ${filtered.length} / ${history.length} benh an`;
            }

            // Update record count info (current/200)
            const recordCountInfo = document.getElementById('history-record-count-info');
            if (recordCountInfo) {
                recordCountInfo.textContent = 'Dang hien thi: ' + history.length + '/200 ban ghi';
            }

            tbody.innerHTML = '';

            if (filtered.length === 0) {
                if (emptyState) {
                    emptyState.style.display = 'block';
                    emptyState.textContent = searchTerm 
                        ? `Khong tim thay benh an nao phu hop với "${searchTerm}"`
                        : 'Chua co benh an nao trong lich su.';
                }
                return;
            }

            if (emptyState) {
                emptyState.style.display = 'none';
            }

            filtered.forEach((exam, index) => {
                const tr = document.createElement('tr');
                tr.style.cssText = 'transition: background var(--transition-fast);';
                tr.addEventListener('mouseenter', function() {
                    this.style.background = 'var(--primary-light)';
                });
                tr.addEventListener('mouseleave', function() {
                    this.style.background = index % 2 === 0 ? 'white' : 'var(--gray-50)';
                });

                const tdDate = document.createElement('td');
                tdDate.textContent = formatHistoryDate(exam.startTime);
                tdDate.style.cssText = 'padding: 11px 14px; border-bottom: 1px solid var(--gray-100); color: var(--gray-600); white-space: nowrap;';
                tr.appendChild(tdDate);

                const tdName = document.createElement('td');
                tdName.textContent = exam.patientName || 'N/A';
                tdName.style.cssText = 'padding: 11px 14px; border-bottom: 1px solid var(--gray-100); color: var(--gray-800); font-weight: 600;';
                tr.appendChild(tdName);

                const tdYOB = document.createElement('td');
                const yob = exam.patientYOB || 'N/A';
                const age = exam.patientAge || 'N/A';
                // Display "1990 (36 tuổi)" format if both available, otherwise just show what we have
                if (yob !== 'N/A' && age !== 'N/A') {
                    tdYOB.textContent = `${yob} (${age} tuổi)`;
                } else {
                    tdYOB.textContent = yob;
                }
                tdYOB.style.cssText = 'padding: 11px 14px; border-bottom: 1px solid var(--gray-100); color: var(--gray-600);';
                tr.appendChild(tdYOB);

                const tdActions = document.createElement('td');
                tdActions.style.cssText = 'padding: 11px 14px; border-bottom: 1px solid var(--gray-100); text-align: center; white-space: nowrap;';

                const actionsWrapper = document.createElement('div');
                actionsWrapper.style.cssText = 'display: flex; gap: 8px; justify-content: center;';

                const viewBtn = document.createElement('button');
                viewBtn.className = 'history-action-btn view-history-btn';
                viewBtn.innerHTML = '\uD83D\uDC41\uFE0F Xem';
                viewBtn.setAttribute('title', 'Xem chi tiet');
                viewBtn.style.cssText = 'padding: 6px 12px; border: 1px solid var(--gray-300); border-radius: var(--radius-sm); background: white; color: var(--gray-700); font-size: 12px; font-weight: 600; cursor: pointer; transition: all var(--transition-fast); font-family: inherit;';
                viewBtn.addEventListener('mouseenter', function() {
                    this.style.background = 'var(--primary-light)';
                    this.style.borderColor = 'var(--exam-primary)';
                    this.style.color = 'var(--exam-primary)';
                });
                viewBtn.addEventListener('mouseleave', function() {
                    this.style.background = 'white';
                    this.style.borderColor = 'var(--gray-300)';
                    this.style.color = 'var(--gray-700)';
                });
                viewBtn.addEventListener('click', function() {
                    hideModal(historyModal);
                    showReportModal(exam, true);
                });
                actionsWrapper.appendChild(viewBtn);

                const pdfBtn = document.createElement('button');
                pdfBtn.className = 'history-action-btn pdf-history-btn';
                pdfBtn.innerHTML = '\uD83D\uDCC4 PDF';
                pdfBtn.setAttribute('title', 'Xuat PDF');
                pdfBtn.style.cssText = 'padding: 6px 12px; border: 1px solid var(--gray-300); border-radius: var(--radius-sm); background: white; color: var(--gray-700); font-size: 12px; font-weight: 600; cursor: pointer; transition: all var(--transition-fast); font-family: inherit;';
                pdfBtn.addEventListener('mouseenter', function() {
                    this.style.background = 'var(--teal-light)';
                    this.style.borderColor = 'var(--exam-teal)';
                    this.style.color = 'var(--exam-teal)';
                });
                pdfBtn.addEventListener('mouseleave', function() {
                    this.style.background = 'white';
                    this.style.borderColor = 'var(--gray-300)';
                    this.style.color = 'var(--gray-700)';
                });
                pdfBtn.addEventListener('click', function() {
                    exportPDF(exam);
                });
                actionsWrapper.appendChild(pdfBtn);

                tdActions.appendChild(actionsWrapper);
                tr.appendChild(tdActions);
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error('[EMRHistory] Failed to render history table:', e);
            showToast('Loi: Khong the tai danh sach benh an');
        }
    }


    // ===== EXPORT CSV FUNCTION =====
    /**
     * Export exam history to CSV file with UTF-8 BOM for Excel compatibility
     */
    function exportHistoryToCSV() {
        try {
            var history = localStorage.getItem(EMR_HISTORY_KEY);
            history = history ? JSON.parse(history) : [];

            if (!history || history.length === 0) {
                showToast('Khong co du lieu de xuat');
                return;
            }

            // Initialize CSV content with UTF-8 BOM and header row
            var csvContent = "\uFEFF" + "Ngay Kham,Ten Benh Nhan,Nam sinh (Tuoi),Ket Qua Lam Sang\n";

            // Process each exam record
            var i, exam, result, idx, testName, metrics, resultParts, clinicalResults, formattedDate, patientName, patientAge, row;
            
            for (i = 0; i < history.length; i++) {
                exam = history[i];

                // Helper to escape cell values for CSV safety
                function escapeCell(value) {
                    if (value === null || value === undefined) {
                        return '';
                    }
                    var str = String(value);
                    if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
                        return '"' + str.replace(/"/g, '""') + '"';
                    }
                    return str;
                }

                // Format date
                formattedDate = formatHistoryDate(exam.startTime);

                // Patient info
                patientName = exam.patientName || 'N/A';
                const patientYOB = exam.patientYOB || 'N/A';
                const patientAge = exam.patientAge || 'N/A';
                // Combine YOB and age for display: "1990 (36 tuổi)"
                patientAge = (patientYOB !== 'N/A' && patientAge !== 'N/A')
                    ? patientYOB + ' (' + patientAge + ' tuổi)'
                    : patientYOB;

                // Flatten clinical results
                clinicalResults = 'N/A';
                if (exam.results && exam.results.length > 0) {
                    resultParts = [];
                    for (idx = 0; idx < exam.results.length; idx++) {
                        result = exam.results[idx];
                        testName = result.test_type || ('Test ' + (idx + 1));
                        metrics = result.clinical_metrics || {};

                        if (typeof metrics === 'object' && Object.keys(metrics).length > 0) {
                            var metricEntries = Object.entries(metrics);
                            var metricsStr = '';
                            var m;
                            for (m = 0; m < metricEntries.length; m++) {
                                if (m > 0) metricsStr += ', ';
                                metricsStr += metricEntries[m][0] + ': ' + metricEntries[m][1];
                            }
                            resultParts.push('[' + testName + '] ' + metricsStr);
                        } else if (typeof metrics === 'string' && metrics !== 'N/A') {
                            resultParts.push('[' + testName + '] ' + metrics);
                        } else {
                            resultParts.push('[' + testName + ']');
                        }
                    }
                    clinicalResults = resultParts.join(' | ');
                }

                // Build CSV row
                row = [
                    escapeCell(formattedDate),
                    escapeCell(patientName),
                    escapeCell(patientAge),
                    escapeCell(clinicalResults)
                ].join(',');

                csvContent += row + '\n';
            }

            // Create Blob with UTF-8 encoding
            var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

            // Create hidden anchor for download
            var link = document.createElement('a');
            var url = URL.createObjectURL(blob);
            var now = new Date();
            var dateStr = now.getFullYear() +
                String(now.getMonth() + 1).padStart(2, '0') +
                String(now.getDate()).padStart(2, '0') + '_' +
                String(now.getHours()).padStart(2, '0') +
                String(now.getMinutes()).padStart(2, '0') +
                String(now.getSeconds()).padStart(2, '0');
            var filename = 'Thong_Ke_Kham_Mat_' + dateStr + '.csv';

            link.href = url;
            link.download = filename;
            link.style.display = 'none';

            // Append, click, cleanup
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast('Da tai xuong file Excel (' + history.length + ' ban ghi)');
        } catch (e) {
            console.error('[ExamSessionManager] CSV export failed:', e);
            showToast('Loi: Khong the tao file CSV');
        }
    }
    // ===== END EXPORT CSV FUNCTION =====

    // ===== HELPER: Safe Zone for Modal Input =====

    /**
     * Protect modal form inputs from global hotkey listeners.
     * Uses capture phase to stop propagation BEFORE global listeners receive the event.
     * Also protects Tab/Shift+Tab navigation and Enter key on buttons.
     * @param {HTMLElement} modalElement - The modal container element
     */
    function allowTypingInModal(modalElement) {
        if (!modalElement) return;

        const stopGlobalHotkeys = (e) => {
            // Allow Escape/Backspace to bubble up so main.js can close the modal
            if (e.key === 'Escape' || e.key === 'Backspace') return;
            const tagName = e.target.tagName.toUpperCase();
            // If user is typing in Input, Textarea, Select, or Button
            if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON') {
                // Stop propagation outward - NEVER preventDefault() to preserve native behavior
                e.stopPropagation();
            }
        };

        modalElement.addEventListener('keydown', stopGlobalHotkeys, true);
        modalElement.addEventListener('keyup', stopGlobalHotkeys, true);
        modalElement.addEventListener('keypress', stopGlobalHotkeys, true);
    }

    // ===== CLINIC SETTINGS MODULE =====

    /**
     * Helper: Compress image file using canvas to avoid LocalStorage overflow
     * @param {File} file - Image file from input
     * @param {number} maxWidth - Maximum width in pixels
     * @param {number} quality - JPEG quality (0-1)
     * @param {Function} callback - callback(compressedBase64String)
     */
    function compressImage(file, maxWidth, quality, callback) {
        try {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Scale down to maxWidth
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Export as compressed JPEG
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality || 0.8);
                    callback(compressedDataUrl);
                };
                img.onerror = function() {
                    console.error('[ClinicSettings] Failed to load image for compression');
                    callback(null);
                };
                img.src = e.target.result;
            };
            reader.onerror = function() {
                console.error('[ClinicSettings] Failed to read file');
                callback(null);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error('[ClinicSettings] Compression error:', err);
            callback(null);
        }
    }

    /**
     * Load clinic settings from localStorage
     * @returns {Object|null} Settings object or null
     */
    function loadClinicSettings() {
        try {
            const data = localStorage.getItem(CLINIC_SETTINGS_KEY);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('[ClinicSettings] Failed to load settings:', e);
        }
        return null;
    }

    /**
     * Save clinic settings to localStorage
     */
    function saveClinicSettings() {
        try {
            const settingsForm = document.getElementById('clinic-settings-form');
            if (!settingsForm) return;

            const clinicName = settingsForm.querySelector('#clinic-name').value.trim();
            const doctorName = settingsForm.querySelector('#doctor-name').value.trim();
            const address = settingsForm.querySelector('#address').value.trim();
            const logoData = settingsForm.querySelector('#logo-base64').value;

            const settings = {
                clinicName: clinicName,
                doctorName: doctorName,
                address: address,
                logo: logoData || ''
            };

            // Save calibration colors from active swatches
            const selectedRed = document.querySelector('.palette-row.red .color-swatch.active')?.dataset.color || '#FF0000';
            const selectedCyan = document.querySelector('.palette-row.cyan .color-swatch.active')?.dataset.color || '#00FFFF';

            window.__anaglyphColors = { red: selectedRed, cyan: selectedCyan };
            localStorage.setItem(CALIBRATION_KEY, JSON.stringify(window.__anaglyphColors));

            document.documentElement.style.setProperty('--calibrated-red', selectedRed);
            document.documentElement.style.setProperty('--calibrated-cyan', selectedCyan);

            localStorage.setItem(CLINIC_SETTINGS_KEY, JSON.stringify(settings));
            hideModal(clinicSettingsModal);
            showToast('Đã lưu cài đặt phòng khám');

            // Refresh all test views with new anaglyph colors
            if (typeof refreshTestViews === 'function') {
                refreshTestViews();
            }
        } catch (e) {
            console.error('[ClinicSettings] Failed to save settings:', e);
            showToast('Lỗi: Không thể lưu cài đặt');
        }
    }

    /**
     * Create Calibration Section (Red/Cyan color palettes for anaglyph filter calibration)
     * Returns a DOM element to be appended into the clinic settings form.
     */
    function createCalibrationSection() {
        const section = document.createElement('div');
        section.className = 'calibration-section';
        section.style.cssText = 'margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--gray-200);';

        const calTitle = document.createElement('h4');
        calTitle.style.cssText = 'margin: 0 0 5px 0; font-size: 14px; color: var(--gray-800); font-weight: 700;';
        calTitle.textContent = 'Hiệu chuẩn màng lọc khử xuyên âm (Khuyên dùng)';
        section.appendChild(calTitle);

        const calDesc = document.createElement('p');
        calDesc.style.cssText = 'font-size: 12px; color: var(--gray-500); margin: 0 0 15px 0;';
        calDesc.textContent = 'Chọn ô màu biến mất hoàn toàn khi nhìn qua kính lọc tương ứng.';
        section.appendChild(calDesc);

        // Helper function to create palette rows
        const createPalette = (type, titleStr, colorArray) => {
            const wrapper = document.createElement('div');
            const label = document.createElement('span');
            label.style.cssText = 'font-size: 13px; color: var(--gray-600); font-weight: 600; min-width: 60px;';
            label.textContent = titleStr;

            const row = document.createElement('div');
            row.className = `palette-row ${type}`;
            row.style.cssText = 'display: flex; gap: 10px; margin-bottom: 15px; align-items: center;';

            colorArray.forEach(color => {
                const swatch = document.createElement('div');
                swatch.className = 'color-swatch';
                swatch.dataset.color = color;
                swatch.dataset.type = type;
                swatch.style.cssText = 'width: 40px; height: 40px; border-radius: 4px; cursor: pointer; transition: transform 0.2s, border 0.2s, box-shadow 0.2s; border: 1px solid #ccc; background-color: ' + color + ';';

                swatch.addEventListener('click', () => {
                    row.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                    swatch.classList.add('active');
                });
                row.appendChild(swatch);
            });

            const rowWrapper = document.createElement('div');
            rowWrapper.style.cssText = 'display: flex; align-items: center;';
            rowWrapper.appendChild(label);
            rowWrapper.appendChild(row);

            wrapper.appendChild(rowWrapper);
            section.appendChild(wrapper);
        };

        createPalette('red', 'Đỏ:', CALIBRATION_PALETTES.red);
        createPalette('cyan', 'Lục Lam:', CALIBRATION_PALETTES.cyan);

        return section;
    }

    /**
     * Create Clinic Settings Modal and Settings Button
     */
    function createClinicSettingsUI() {
        // --- Create Settings Button (⚙️) ---
        const navbarHeader = document.getElementById('sidebar-header');
        if (!navbarHeader) {
            console.warn('[ClinicSettings] Navbar header not found');
            return;
        }

        const settingsBtn = document.createElement('button');
        settingsBtn.id = 'clinic-settings-btn';
        // nav-btn: đăng ký với thuật toán điều hướng bàn phím 2D trong main.js (updateMenuFocus)
        settingsBtn.className = 'exam-btn settings-btn nav-btn';
        settingsBtn.setAttribute('title', 'Cài đặt phòng khám');
        settingsBtn.innerHTML = '⚙️';

        // Insert before fullscreen button to preserve existing events
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            navbarHeader.insertBefore(settingsBtn, fullscreenBtn);
        } else {
            navbarHeader.appendChild(settingsBtn);
        }

        // Note: Settings button click is now handled by Global Event Delegation (see bottom of file)

        // --- Create Clinic Settings Modal ---
        clinicSettingsModal = document.createElement('div');
        clinicSettingsModal.id = 'clinic-settings-modal';
        clinicSettingsModal.className = 'exam-modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'exam-modal-content clinic-settings-modal-content';

        // Header
        const modalHeader = document.createElement('div');
        modalHeader.className = 'exam-modal-header';
        const headerH3 = document.createElement('h3');
        headerH3.textContent = 'Cài đặt Phòng khám';
        const headerClose = document.createElement('button');
        headerClose.className = 'exam-modal-close';
        headerClose.type = 'button';
        headerClose.innerHTML = '&times;';
        modalHeader.appendChild(headerH3);
        modalHeader.appendChild(headerClose);

        // Body
        const modalBody = document.createElement('div');
        modalBody.className = 'exam-modal-body';

        const form = document.createElement('form');
        form.id = 'clinic-settings-form';

        // Clinic Name Input
        const group1 = document.createElement('div');
        group1.className = 'form-group';
        const label1 = document.createElement('label');
        label1.setAttribute('for', 'clinic-name');
        label1.textContent = 'Tên phòng khám / Cơ sở y tế:';
        const input1 = document.createElement('input');
        input1.type = 'text';
        input1.id = 'clinic-name';
        input1.name = 'clinic-name';
        input1.placeholder = 'VD: Phòng Khám Mắt Quốc Tế';
        group1.appendChild(label1);
        group1.appendChild(input1);

        // Doctor Name Input
        const group2 = document.createElement('div');
        group2.className = 'form-group';
        const label2 = document.createElement('label');
        label2.setAttribute('for', 'doctor-name');
        label2.textContent = 'Tên Bác sĩ / Kỹ thuật viên:';
        const input2 = document.createElement('input');
        input2.type = 'text';
        input2.id = 'doctor-name';
        input2.name = 'doctor-name';
        input2.placeholder = 'VD: BS. Nguyễn Văn A';
        group2.appendChild(label2);
        group2.appendChild(input2);

        // Address Input
        const group3 = document.createElement('div');
        group3.className = 'form-group';
        const label3 = document.createElement('label');
        label3.setAttribute('for', 'address');
        label3.textContent = 'Địa chỉ:';
        const input3 = document.createElement('input');
        input3.type = 'text';
        input3.id = 'address';
        input3.name = 'address';
        input3.placeholder = 'VD: 123 Đường Lê Lợi, Quận 1, TP.HCM';
        group3.appendChild(label3);
        group3.appendChild(input3);

        // Logo Upload Input
        const group4 = document.createElement('div');
        group4.className = 'form-group';
        const label4 = document.createElement('label');
        label4.setAttribute('for', 'logo-upload');
        label4.textContent = 'Upload Logo (PNG/JPEG):';
        const input4 = document.createElement('input');
        input4.type = 'file';
        input4.id = 'logo-upload';
        input4.name = 'logo-upload';
        input4.accept = 'image/png, image/jpeg';
        group4.appendChild(label4);
        group4.appendChild(input4);

        // Hidden input for base64 logo data
        const logoBase64Input = document.createElement('input');
        logoBase64Input.type = 'hidden';
        logoBase64Input.id = 'logo-base64';
        logoBase64Input.name = 'logo-base64';
        group4.appendChild(logoBase64Input);

        // Logo Preview
        const previewGroup = document.createElement('div');
        previewGroup.className = 'logo-preview-group';
        const previewLabel = document.createElement('span');
        previewLabel.className = 'logo-preview-label';
        previewLabel.textContent = 'Xem trước logo:';
        const previewImg = document.createElement('img');
        previewImg.id = 'logo-preview';
        previewImg.className = 'logo-preview';
        previewImg.alt = 'Logo preview';
        previewImg.style.display = 'none';
        previewGroup.appendChild(previewLabel);
        previewGroup.appendChild(previewImg);

        // Form Actions
        const formActions = document.createElement('div');
        formActions.className = 'form-actions';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'exam-btn save-settings-btn';
        saveBtn.textContent = 'Lưu Cài Đặt';
        saveBtn.addEventListener('click', saveClinicSettings);

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'exam-btn cancel-btn';
        cancelBtn.textContent = 'Hủy';
        cancelBtn.addEventListener('click', function() {
            hideModal(clinicSettingsModal);
        });

        formActions.appendChild(saveBtn);
        formActions.appendChild(cancelBtn);

        // Assemble form
        form.appendChild(group1);
        form.appendChild(group2);
        form.appendChild(group3);
        form.appendChild(group4);
        form.appendChild(previewGroup);
        form.appendChild(createCalibrationSection());
        form.appendChild(formActions);

        // Handle logo file upload with compression
        input4.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file type
            if (!['image/png', 'image/jpeg'].includes(file.type)) {
                showToast('Chỉ chấp nhận file PNG hoặc JPEG');
                e.target.value = '';
                return;
            }

            // Validate file size (max 5MB before compression)
            if (file.size > 5 * 1024 * 1024) {
                showToast('File quá lớn. Tối đa 5MB');
                e.target.value = '';
                return;
            }

            // Compress and set base64
            compressImage(file, 300, 0.8, function(compressedDataUrl) {
                if (compressedDataUrl) {
                    logoBase64Input.value = compressedDataUrl;
                    previewImg.src = compressedDataUrl;
                    previewImg.style.display = 'block';
                    showToast('Đã nén và xem trước logo thành công');
                } else {
                    showToast('Lỗi: Không thể xử lý hình ảnh');
                    e.target.value = '';
                }
            });
        });

        // Close button handler
        headerClose.addEventListener('click', function() {
            hideModal(clinicSettingsModal);
        });

        // Backdrop click handler
        clinicSettingsModal.addEventListener('click', function(e) {
            if (e.target === clinicSettingsModal) {
                hideModal(clinicSettingsModal);
            }
        });

        // Assemble modal
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalBody.appendChild(form);

        clinicSettingsModal.appendChild(modalContent);

        // Append modal to body
        document.body.appendChild(clinicSettingsModal);

        // Protect form inputs from global hotkey listeners
        allowTypingInModal(clinicSettingsModal);
    }

function openClinicSettingsModal() {
    console.log('[System] Settings button clicked');
    
    // 1. Tìm modal trong DOM
    let modal = document.getElementById('clinic-settings-modal') || document.querySelector('.clinic-settings-modal');

    // --- Helper: Render / cập nhật 3 nút Chế độ hiển thị (Tương phản/Độ chói) ---
    // Trạng thái active lấy từ window.__displayManager.currentPreset.
    // Click → window.__displayManager.applyPreset(key) + cập nhật style nút đang chọn.
    // Hỗ trợ CẢ HAI biến thể modal:
    //   1. Modal DOM do createClinicSettingsUI() tạo sẵn (class 'exam-modal')
    //   2. Modal HTML-string do chính hàm này khởi tạo (class 'custom-modal')
    const renderDisplayPresetButtons = () => {
        const dm = window.__displayManager;
        if (!dm || typeof dm.applyPreset !== 'function') return;

        let row = modal.querySelector('#display-preset-row');

        // Nếu modal chưa có section này (vd: modal DOM tạo sẵn lúc init)
        // → chèn Section mới vào trong <form>, ngay TRƯỚC khối .form-actions
        // (nút Lưu/Hủy) để đảm bảo thứ tự: Inputs → Hiệu chuẩn → Chế độ hiển thị → Lưu/Hủy.
        if (!row) {
            const section = document.createElement('div');
            section.className = 'display-preset-section';
            section.style.cssText = 'margin-top: 15px; border-top: 1px solid #ddd; padding-top: 15px;';
            section.innerHTML = `
                <h3 style="margin-bottom: 5px; font-size: 15px;">Chế độ hiển thị (Tương phản/Độ chói)</h3>
                <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Chọn chế độ hiển thị phù hợp. Thay đổi được áp dụng ngay lập tức cho toàn bộ ứng dụng.</p>`;
            row = document.createElement('div');
            row.id = 'display-preset-row';
            row.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
            section.appendChild(row);

            const form = modal.querySelector('#clinic-settings-form');
            const formActions = form && form.querySelector('.form-actions');

            if (form && formActions) {
                // Biến thể modal DOM (createClinicSettingsUI): chèn trước nút Lưu/Hủy
                form.insertBefore(section, formActions);
            } else if (form) {
                // Dự phòng: không tìm thấy .form-actions thì đặt cuối form
                form.appendChild(section);
            } else {
                // Biến thể modal HTML-string (custom-modal): giữ hành vi cũ
                const container =
                    modal.querySelector('.exam-modal-body') ||
                    modal.querySelector('.modal-content') ||
                    modal;
                container.appendChild(section);
            }
        }

        const presets = typeof dm.getPresets === 'function' ? dm.getPresets() : {};
        row.innerHTML = '';
        Object.values(presets).forEach((preset) => {
            const isActive = dm.currentPreset === preset.key;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.preset = preset.key;
            btn.textContent = `${preset.label} (${preset.description})`;
            const applyBtnStyle = (selected) => {
                btn.style.padding = '8px 12px';
                btn.style.borderRadius = '6px';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '13px';
                btn.style.border = selected ? '2px solid #2563eb' : '1px solid #ccc';
                btn.style.background = selected ? '#dbeafe' : '#fff';
                btn.style.color = selected ? '#1e40af' : '#333';
                btn.style.fontWeight = selected ? '700' : '400';
            };
            applyBtnStyle(isActive);
            btn.addEventListener('click', () => {
                dm.applyPreset(preset.key);
                // Cập nhật lại trạng thái active của toàn bộ nút trong nhóm
                row.querySelectorAll('button').forEach((b) => {
                    const sel = b.dataset.preset === dm.currentPreset;
                    b.style.border = sel ? '2px solid #2563eb' : '1px solid #ccc';
                    b.style.background = sel ? '#dbeafe' : '#fff';
                    b.style.color = sel ? '#1e40af' : '#333';
                    b.style.fontWeight = sel ? '700' : '400';
                });
            });
            row.appendChild(btn);
        });
    };

    // 2. NẾU CHƯA CÓ, TỰ ĐỘNG TẠO MỚI TOÀN BỘ DOM CHO MODAL CÀI ĐẶT
    if (!modal) {
        console.log('[System] Modal chưa tồn tại, đang tự động khởi tạo giao diện...');
        
        modal = document.createElement('div');
        modal.id = 'clinic-settings-modal';
        modal.className = 'custom-modal';
        modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content custom-modal-content';
        modalContent.style.cssText = 'background:#fff; padding:25px; border-radius:12px; width:500px; max-width:90%; box-shadow:0 4px 20px rgba(0,0,0,0.2); max-height:90vh; overflow-y:auto; text-align:left;';

        modalContent.innerHTML = `
            <h2 style="margin-top:0; font-size:20px; color:#111; margin-bottom:15px;">Cấu hình Phòng khám</h2>
            <form id="clinic-settings-form">
                <div style="margin-bottom:12px;">
                    <label style="display:block; font-size:13px; font-weight:600; margin-bottom:5px;">Tên phòng khám</label>
                    <input type="text" id="clinic-name" style="width:100%; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;" />
                </div>
                <div style="margin-bottom:12px;">
                    <label style="display:block; font-size:13px; font-weight:600; margin-bottom:5px;">Bác sĩ phụ trách</label>
                    <input type="text" id="doctor-name" style="width:100%; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;" />
                </div>
                <div style="margin-bottom:12px;">
                    <label style="display:block; font-size:13px; font-weight:600; margin-bottom:5px;">Địa chỉ</label>
                    <input type="text" id="address" style="width:100%; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;" />
                </div>
                <div style="margin-bottom:12px;">
                    <label style="display:block; font-size:13px; font-weight:600; margin-bottom:5px;">Logo (Base64 hoặc URL)</label>
                    <input type="text" id="logo-base64" style="width:100%; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;" />
                    
                    <!-- THÊM KHUNG PREVIEW NÀY VÀO DƯỚI INPUT -->
                    <div id="logo-preview-container" style="margin-top:8px; display:none; align-items:center;">
                        <img id="logo-preview" src="" alt="Logo Preview" style="max-height:50px; max-width:150px; object-fit:contain; border:1px solid #ddd; border-radius:4px; padding:2px;" />
                    </div>
                </div>
            </form>
            
            <div class="calibration-section" style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 15px;">
                <h3 style="margin-bottom: 5px; font-size: 15px;">Hiệu chuẩn màng lọc khử xuyên âm</h3>
                <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Chọn ô màu biến mất hoàn toàn khi nhìn qua kính lọc tương ứng.</p>
                
                <h4 style="margin: 5px 0; font-size: 13px;">Kính Đỏ (Mắt Phải)</h4>
                <div class="palette-row red" style="display: flex; gap: 8px; margin-bottom: 10px;"></div>
                
                <h4 style="margin: 5px 0; font-size: 13px;">Kính Xanh/Lục Lam (Mắt Trái)</h4>
                <div class="palette-row cyan" style="display: flex; gap: 8px; margin-bottom: 15px;"></div>
            </div>

            <!-- Section: Chế độ hiển thị (Tương phản/Độ chói) -->
            <div class="display-preset-section" style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 15px;">
                <h3 style="margin-bottom: 5px; font-size: 15px;">Chế độ hiển thị (Tương phản/Độ chói)</h3>
                <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Chọn chế độ hiển thị phù hợp. Thay đổi được áp dụng ngay lập tức cho toàn bộ ứng dụng.</p>
                <div id="display-preset-row" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                <button type="button" id="close-settings-btn" class="cancel-btn" style="padding: 8px 16px; background:#e5e7eb; border:none; border-radius:4px; cursor:pointer;">Hủy</button>
                <button type="button" id="save-settings-btn" style="padding: 8px 16px; background:#2563eb; color:#fff; border:none; border-radius:4px; cursor:pointer;">Lưu cấu hình</button>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Sinh palette màu tự động
        const renderPalettes = (type, colorArray, containerClass) => {
            const container = modal.querySelector(`.${containerClass}`);
            if (!container) return;
            colorArray.forEach(color => {
                const swatch = document.createElement('div');
                swatch.className = 'color-swatch';
                swatch.style.cssText = `width:32px; height:32px; background-color:${color}; border-radius:4px; cursor:pointer; border:1px solid #ccc; transition:transform 0.2s;`;
                swatch.dataset.color = color;
                swatch.dataset.type = type;
                swatch.addEventListener('click', () => {
                    container.querySelectorAll('.color-swatch').forEach(s => {
                        s.classList.remove('active');
                        s.style.border = '1px solid #ccc';
                        s.style.transform = 'none';
                    });
                    swatch.classList.add('active');
                    swatch.style.border = '3px solid #000';
                    swatch.style.transform = 'scale(1.1)';
                });
                container.appendChild(swatch);
            });
        };

        if (typeof CALIBRATION_PALETTES !== 'undefined') {
            renderPalettes('red', CALIBRATION_PALETTES.red, 'palette-row.red');
            renderPalettes('cyan', CALIBRATION_PALETTES.cyan, 'palette-row.cyan');
        }

        // Render 3 nút Chế độ hiển thị (Tương phản/Độ chói)
        renderDisplayPresetButtons();

        // Gắn event Đóng / Lưu
        modal.querySelector('#close-settings-btn').addEventListener('click', () => { modal.style.display = 'none'; });
        modal.querySelector('#save-settings-btn').addEventListener('click', () => {
            const form = document.getElementById('clinic-settings-form');
            if (form) {
                const settings = {
                    clinicName: form.querySelector('#clinic-name')?.value || '',
                    doctorName: form.querySelector('#doctor-name')?.value || '',
                    address: form.querySelector('#address')?.value || '',
                    logo: form.querySelector('#logo-base64')?.value || ''
                };
                if (typeof saveClinicSettings === 'function') {
                    // Dùng hàm save gốc nếu có
                    saveClinicSettings(settings);
                } else {
                    localStorage.setItem('vision_clinic_settings', JSON.stringify(settings));
                }
            }
            // Lưu màu
            const selectedRed = modal.querySelector('.palette-row.red .color-swatch.active')?.dataset.color || '#FF0000';
            const selectedCyan = modal.querySelector('.palette-row.cyan .color-swatch.active')?.dataset.color || '#00FFFF';
            window.__anaglyphColors = { red: selectedRed, cyan: selectedCyan };
            if (typeof CALIBRATION_KEY !== 'undefined') {
                localStorage.setItem(CALIBRATION_KEY, JSON.stringify(window.__anaglyphColors));
            }
            document.documentElement.style.setProperty('--calibrated-red', selectedRed);
            document.documentElement.style.setProperty('--calibrated-cyan', selectedCyan);
            
            modal.style.display = 'none';
            alert('Đã lưu cấu hình thành công!');
        });

        // Bảo vệ phím gõ
        if (typeof allowTypingInModal === 'function') {
            allowTypingInModal(modal);
        }
    }

    // 3. Ép hiển thị
    modal.style.display = 'flex';
    console.log('[System] Modal set to display: flex successfully!');

    // Làm mới trạng thái active của các nút Chế độ hiển thị theo preset hiện tại
    renderDisplayPresetButtons();

    // 4. Điền dữ liệu cũ vào form
    const settings = typeof loadClinicSettings === 'function' ? loadClinicSettings() : JSON.parse(localStorage.getItem('vision_clinic_settings') || '{}');
    const form = document.getElementById('clinic-settings-form');
    if (form && settings) {
        if (form.querySelector('#clinic-name')) form.querySelector('#clinic-name').value = settings.clinicName || settings.name || '';
        if (form.querySelector('#doctor-name')) form.querySelector('#doctor-name').value = settings.doctorName || settings.doctor || '';
        if (form.querySelector('#address')) form.querySelector('#address').value = settings.address || '';
        
        const logoVal = settings.logo || settings.logoBase64 || '';
        if (form.querySelector('#logo-base64')) {
            form.querySelector('#logo-base64').value = logoVal;
        }

        const previewImg = document.getElementById('logo-preview');
        const previewContainer = document.getElementById('logo-preview-container');
        if (previewImg && previewContainer) {
            if (logoVal) {
                previewImg.src = logoVal;
                previewContainer.style.display = 'flex';
            } else {
                previewContainer.style.display = 'none';
            }
        }
    }

    // 5. Tô sáng màu active hiện tại
    setTimeout(function() {
        const activeRed = window.__anaglyphColors?.red || '#FF0000';
        const activeCyan = window.__anaglyphColors?.cyan || '#00FFFF';

        modal.querySelectorAll('.palette-row.red .color-swatch').forEach(s => {
            const isActive = s.dataset.color === activeRed;
            s.classList.toggle('active', isActive);
            s.style.border = isActive ? '3px solid #000' : '1px solid #ccc';
            s.style.transform = isActive ? 'scale(1.1)' : 'none';
        });
        modal.querySelectorAll('.palette-row.cyan .color-swatch').forEach(s => {
            const isActive = s.dataset.color === activeCyan;
            s.classList.toggle('active', isActive);
            s.style.border = isActive ? '3px solid #000' : '1px solid #ccc';
            s.style.transform = isActive ? 'scale(1.1)' : 'none';
        });
    }, 50);
}

// ===== GLOBAL EVENT DELEGATION FOR SETTINGS BUTTON =====
document.addEventListener('click', function(e) {
    // Kiểm tra xem có bấm vào nút Settings không (dựa vào class .settings-btn hoặc icon bánh răng)
    if (e.target.closest('.settings-btn') || e.target.closest('.fa-cog')) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[System] Settings button clicked via Delegation');
        openClinicSettingsModal();
    }
});

    /**
     * Generate clinic header HTML for report
     * @returns {string} Header HTML or empty string
     */
    function generateClinicHeaderHTML() {
        const settings = loadClinicSettings();
        if (!settings || (!settings.clinicName && !settings.doctorName)) {
            return '';
        }

        let html = '<div class="clinic-report-header">';
        html += '<div class="clinic-header-left">';
        if (settings.logo) {
            html += `<img src="${settings.logo}" alt="Logo" class="clinic-logo-img">`;
        }
        html += '</div>';
        html += '<div class="clinic-header-right">';
        if (settings.clinicName) {
            html += `<div class="clinic-name">${escapeHtml(settings.clinicName)}</div>`;
        }
        if (settings.address) {
            html += `<div class="clinic-address">${escapeHtml(settings.address)}</div>`;
        }
        if (settings.doctorName) {
            html += `<div class="clinic-doctor">${escapeHtml(settings.doctorName)}</div>`;
        }
        html += '</div>';
        html += '</div>';

        return html;
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text
     * @returns {string}
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ================================================================
    //  Public API — Expose ExamSessionManager methods globally
    // ================================================================
    window.examSessionManager = {
        /**
         * Add a therapy record to the current exam session — Hard-Write mode
         * Directly syncs this.currentExam into emr_patient_sessions localStorage
         * @param {Object} record - The therapy record object to add
         * @returns {boolean} True if successful, false otherwise
         */
        addTherapyRecord(record) {
            if (!window.__currentExam || !window.__currentExam.patientId) {
                console.error('[Manager] Khong co phien kham de luu ket qua Huấn luyen.');
                return false;
            }
            
            // 1. Cập nhật vào RAM hiện tại
            if (!window.__currentExam.therapy_records) {
                window.__currentExam.therapy_records = [];
            }
            window.__currentExam.therapy_records.push(record);
            
            // 2. ÉP GHI CỨNG VÀO LOCALSTORAGE (Hard-Write)
            try {
                // Lấy toàn bộ Database hiện có
                let sessions = JSON.parse(localStorage.getItem('emr_patient_sessions')) || [];
                
                // Tìm vị trí của hồ sơ hiện tại
                let index = sessions.findIndex(s => s.patientId === window.__currentExam.patientId);
                
                if (index !== -1) {
                    // Nếu đã có, ghi đè toàn bộ object hiện tại (đã chứa therapy_records mới) lên
                    sessions[index] = window.__currentExam;
                } else {
                    // Nếu chưa có (trường hợp chỉ tập mà không khám), push mới
                    sessions.push(window.__currentExam);
                }
                
                // Đóng gói và lưu lại
                localStorage.setItem('emr_patient_sessions', JSON.stringify(sessions));
                
                console.log('[Manager] Da Hard-Write ket qua thuan luyen vao Database cho:', window.__currentExam.patientId);
                return true;
            } catch (err) {
                console.error('[Manager] Loi khi ghi cung vao Database:', err);
                return false;
            }
        },

        /**
         * Get the current exam data
         * @returns {Object|null} Current exam object or null
         */
        getCurrentExam() {
            return window.__currentExam;
        }
    };

})();

