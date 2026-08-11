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
        createUI();
        bindEvents();
        setupVisionTestListener();
        setupGlobalHotkey();
        restoreSession();
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
        startExamBtn.className = 'exam-btn start-exam-btn';
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
        endExamBtn.className = 'exam-btn end-exam-btn';
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
                            <input type="text" id="patient-name" name="patient-name" required>
                        </div>
                        <div class="form-group">
                            <label for="patient-age">Tuổi:</label>
                            <input type="number" id="patient-age" name="patient-age" min="0" max="150" required>
                        </div>
                        <div class="form-group checkbox-group">
                            <label>
                                <input type="checkbox" id="anonymous-check">
                                <span>Khám ẩn danh</span>
                            </label>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="exam-btn submit-btn">Bắt đầu khám</button>
                            <button type="button" class="exam-btn cancel-btn">Hủy</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(startExamModal);

        // Bind modal events
        const closeBtn = startExamModal.querySelector('.exam-modal-close');
        const cancelBtn = startExamModal.querySelector('.cancel-btn');
        const form = startExamModal.querySelector('#start-exam-form');
        const anonymousCheck = startExamModal.querySelector('#anonymous-check');
        const nameInput = startExamModal.querySelector('#patient-name');
        const ageInput = startExamModal.querySelector('#patient-age');

        closeBtn.addEventListener('click', () => hideModal(startExamModal));
        cancelBtn.addEventListener('click', () => hideModal(startExamModal));

        anonymousCheck.addEventListener('change', function() {
            if (this.checked) {
                nameInput.value = 'Ẩn danh';
                ageInput.value = 'N/A';
                nameInput.disabled = true;
                ageInput.disabled = true;
            } else {
                nameInput.value = '';
                ageInput.value = '';
                nameInput.disabled = false;
                ageInput.disabled = false;
            }
        });

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const patientName = nameInput.value.trim();
            const patientAge = ageInput.value.trim();

            if (!patientName) {
                alert('Vui lòng nhập tên bệnh nhân');
                return;
            }

            startExam(patientName, patientAge);
            hideModal(startExamModal);
            form.reset();
            nameInput.disabled = false;
            ageInput.disabled = false;
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
     * Helper: Generate report HTML for both Modal View and Print
     * @param {boolean} isPrintMode - true for print layout, false for modal layout
     * @returns {string}
     */
    function generateReportHTML(isPrintMode) {
        const exam = window.__currentExam;
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
                        <tr><td class="label">Họ và tên:</td><td>${exam.patientName}</td></tr>
                        <tr><td class="label">Tuổi:</td><td>${exam.patientAge}</td></tr>
                        <tr><td class="label">Ngày khám:</td><td>${formattedDate}</td></tr>
                    </table>
                </div>
                <div class="print-results">
                    <h3>KẾT QUẢ CÁC BÀI TEST</h3>
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
                        <tr><td class="label">Họ và tên:</td><td>${exam.patientName}</td></tr>
                        <tr><td class="label">Tuổi:</td><td>${exam.patientAge}</td></tr>
                        <tr><td class="label">Ngày khám:</td><td>${formattedDate} ${formattedTime || ''}</td></tr>
                    </table>
                </div>
                <div class="report-results">
                    <h4>Kết quả các bài test</h4>
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

        if (isPrintMode) {
            html += `
                </div>
                <div class="print-footer">
                    <p>--- HẾT ---</p>
                    <p><em>Báo cáo được tạo tự động bởi Hệ thống Khám Mắt</em></p>
                </div>
            </div>
            `;
        } else {
            html += '</div>';
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
            startExamBtn.addEventListener('click', () => showModal(startExamModal));
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
    function startExam(patientName, patientAge) {
        window.__currentExam = {
            patientName: patientName,
            patientAge: patientAge,
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
            examStatusText.innerHTML = `👤 ${window.__currentExam.patientName} - ${window.__currentExam.patientAge} (Đang khám)`;
        }
    }

    /**
     * Show report in modal view ("Chỉ xem kết quả")
     */
    function showReportModal() {
        if (!window.__currentExam) return;

        const reportContent = document.getElementById('report-content');
        if (!reportContent) return;

        // Generate and inject report HTML using shared helper
        reportContent.innerHTML = generateReportHTML(false);

        // Change button text to "Đóng & Hoàn Tất Khám"
        const resetBtn = document.getElementById('reset-session-btn');
        if (resetBtn) {
            resetBtn.textContent = 'Đóng & Hoàn Tất Khám';
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
    function exportPDF() {
        if (!window.__currentExam) return;

        // Check if html2pdf library is loaded
        if (typeof html2pdf === 'undefined') {
            console.error('[ExamSessionManager] html2pdf library not loaded');
            showToast('Lỗi: Thư viện xuất PDF chưa được tải');
            return;
        }

        // Generate report HTML using shared helper (print mode)
        const element = document.createElement('div');
        element.innerHTML = generateReportHTML(true);
        element.style.padding = '20px';
        element.style.color = '#000';
        element.style.fontFamily = "'Times New Roman', serif";
        element.style.backgroundColor = '#fff';

        // Create safe filename from patient name and date
        const date = new Date(window.__currentExam.startTime);
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const safeName = window.__currentExam.patientName
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

    // Reset session
    function resetSession() {
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

    // ===== HELPER: Safe Zone for Modal Input =====

    /**
     * Protect modal form inputs from global hotkey listeners.
     * Uses capture phase to stop propagation BEFORE global listeners receive the event.
     * @param {HTMLElement} modalElement - The modal container element
     */
    function allowTypingInModal(modalElement) {
        if (!modalElement) return;

        const stopGlobalHotkeys = (e) => {
            const tagName = e.target.tagName.toUpperCase();
            // If user is typing in Input, Textarea, or Select
            if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
                // Only stop propagation outward - NEVER preventDefault() to preserve typing
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

            localStorage.setItem(CLINIC_SETTINGS_KEY, JSON.stringify(settings));
            hideModal(clinicSettingsModal);
            showToast('Đã lưu cài đặt phòng khám');
        } catch (e) {
            console.error('[ClinicSettings] Failed to save settings:', e);
            showToast('Lỗi: Không thể lưu cài đặt');
        }
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
        settingsBtn.className = 'exam-btn settings-btn';
        settingsBtn.setAttribute('title', 'Cài đặt phòng khám');
        settingsBtn.innerHTML = '⚙️';

        // Insert before fullscreen button to preserve existing events
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            navbarHeader.insertBefore(settingsBtn, fullscreenBtn);
        } else {
            navbarHeader.appendChild(settingsBtn);
        }

        // Bind settings button click
        settingsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            openClinicSettingsModal();
        });

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

    /**
     * Open Clinic Settings Modal and auto-fill existing data
     */
    function openClinicSettingsModal() {
        console.log('[ClinicSettings] Opening modal...');
        const settings = loadClinicSettings();
        const form = document.getElementById('clinic-settings-form');
        if (!form) return;

        // Auto-fill fields
        form.querySelector('#clinic-name').value = settings?.clinicName || '';
        form.querySelector('#doctor-name').value = settings?.doctorName || '';
        form.querySelector('#address').value = settings?.address || '';
        form.querySelector('#logo-base64').value = settings?.logo || '';

        // Show preview if logo exists
        const previewImg = document.getElementById('logo-preview');
        if (previewImg && settings?.logo) {
            previewImg.src = settings.logo;
            previewImg.style.display = 'block';
        } else if (previewImg) {
            previewImg.style.display = 'none';
        }

        showModal(clinicSettingsModal);
    }

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

})();
