/**
 * Therapeutic Menu Controller (Lazy Binding Architecture)
 * 
 * Quản lý giao diện và vòng đời 3 Game module trong khu vực Huấn luyện Thị giác:
 * - M1: Hứng hạt (CatchGame)
 * - M2: Khớp khung (ShapeAlignmentGame)
 * - M3: Vận nhãn (VergenceTrackerGame)
 */

class TherapeuticMenuController {
    constructor() {
        this.currentGame = null;
        this.workspaceContainer = null;
        this.menuContainer = null;

        this.gameModules = [
            {
                id: 'catch',
                name: 'M1: Hứng hạt',
                classRef: CatchGame,
                purpose: 'Cải thiện độ nhạy tương phản của mắt nhược thị bằng cách giảm dần tín hiệu ở mắt lành, ép não bộ xóa bỏ ám điểm ức chế.',
                instruction: 'Dùng chuột di chuyển thanh ngang để hứng các hạt màu rơi xuống.',
                target: 'Đạt 80 điểm để hoàn thành bài tập.'
            },
            {
                id: 'align',
                name: 'M2: Khớp khung',
                classRef: ShapeAlignmentGame,
                purpose: 'Rèn luyện Foveal Focus và Hiệu ứng đám đông (Crowding Effect).',
                instruction: 'YÊU CẦU LÂM SÀNG: Mắt nhược thị đeo kính Lục Lam (Cyan), mắt lành đeo kính Đỏ. Dùng chuột kéo khối đặc lọt khít vào khung rỗng và giữ yên.',
                target: 'Hoàn thành 10 cấp độ. Kích thước hình sẽ thu nhỏ dần và nhiễu (Crowding) sẽ tăng lên. Giữ khớp liên tục 2 giây để qua bàn.'
            },
            {
                id: 'vergence',
                name: 'M3: Vận nhãn',
                classRef: VergenceTrackerGame,
                purpose: 'Mở rộng biên độ vận nhãn.',
                instruction: "YÊU CẦU LÂM SÀNG: Mắt Trái đeo kính Lục Lam (Cyan), Mắt Phải đeo kính Đỏ. Tập trung nhìn vào KHỐI CHỮ NHẬT ở giữa màn hình và cố gắng giữ nó thành một khối duy nhất. BẤM PHÍM SPACE ngay khi khối chữ nhật BỊ TÁCH ĐÔI thành 2 màu xanh/đỏ riêng biệt.",
                target: 'Đo lường biên độ vận nhãn. Mục tiêu lâm sàng ở khoảng cách 50cm: Hội tụ (Base-Out) ≥ 15 Δ và Phân kỳ (Base-In) ≥ 8 Δ.'
            }
        ];

        // Bind fullscreen exit handler
        this._handleFullscreenExit = this._handleFullscreenExit.bind(this);
    }

    init() {
        this.menuContainer = document.getElementById('menu-therapeutic');
        this.workspaceContainer = document.getElementById('workspace-therapeutic');

        if (!this.menuContainer || !this.workspaceContainer) {
            return;
        }

        this.renderSidebar();

        // Listen for fullscreen exit to auto-cleanup game
        document.addEventListener('fullscreenchange', this._handleFullscreenExit);

        // ============================================================
        // ĐỊNH TUYẾN Y KHOA: Chuyển module khi đạt điểm rơi lâm sàng
        // Lắng nghe sự kiện requestLaunchModule2 từ CatchGame._endGame()
        // ============================================================
        document.addEventListener('requestLaunchModule2', () => {
            const module2 = this.gameModules.find(m => m.id === 'align');
            if (module2) {
                console.log('[Therapeutic] Kích hoạt phác đồ tiếp theo: Module 2');
                this.launchGame(module2);
            }
        }, { once: true });

        // ============================================================
        // Lắng nghe sự kiện requestLaunchModule3 từ ShapeAlignmentGame._endGame()
        // ============================================================
        document.addEventListener('requestLaunchModule3', () => {
            const module3 = this.gameModules.find(m => m.id === 'vergence');
            if (module3) {
                console.log('[Therapeutic] Kích hoạt phác đồ tiếp theo: Module 3');
                this.launchGame(module3);
            }
        }, { once: true });
    }

    /**
     * Handle fullscreen exit event: stop game, cleanup DOM, restore SPA UI
     */
    _handleFullscreenExit() {
        if (!document.fullscreenElement) {
            this.stopCurrentGame();
            this.workspaceContainer.style = '';
            this.workspaceContainer.innerHTML = '';
        }
    }

    renderSidebar() {
        this.menuContainer.innerHTML = '';

        const isCalibrated = window.__anaglyphColors && window.__anaglyphColors.red;

        for (const module of this.gameModules) {
            const btn = document.createElement('button');
            btn.textContent = module.name;

            btn.style.width = '100%';
            btn.style.marginBottom = '10px';
            btn.style.padding = '15px';
            btn.style.border = 'none';
            btn.style.borderRadius = '8px';
            btn.style.textAlign = 'center';
            btn.style.fontSize = '14px';
            btn.style.fontWeight = '500';
            btn.style.cursor = 'pointer';

            if (!isCalibrated) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
                btn.title = 'Chống chỉ định: Cần hiệu chuẩn kính';
                btn.style.backgroundColor = '#e0e0e0';
                btn.style.color = '#999';
            } else {
                btn.onclick = () => this.launchGame(module);
                btn.onmouseover = () => btn.style.backgroundColor = '#e8f4fc';
                btn.onmouseout = () => btn.style.backgroundColor = '#f5f5f5';
                btn.style.backgroundColor = '#f5f5f5';
            }

            this.menuContainer.appendChild(btn);
        }
    }

    stopCurrentGame() {
        if (this.currentGame) {
            this.currentGame.stop();
            this.currentGame = null;
        }
    }

    /**
     * Launch game with Lobby (Instruction) screen before entering fullscreen
     * @param {Object} module - Game module object with metadata
     */
    launchGame(module) {
        // A. Stop any running game and clean workspace
        this.stopCurrentGame();
        this.workspaceContainer.innerHTML = '';

        console.log("[Therapeutic] Request launch module:", module.name);

        // B. Render Lobby (Instruction) interface
        this._renderLobby(module);
    }

    /**
     * Render the Lobby/Instruction screen for a game
     * @param {Object} module - Game module with metadata
     */
    _renderLobby(module) {
        // Nếu là module M1 (CatchGame), hiển thị nội dung lâm sàng đặc thù
        let clinicalContent = '';
        if (module.id === 'catch') {
            clinicalContent = `
                <div style="max-width: 700px; margin: 20px auto; text-align: left;">
                    <div style="padding: 20px; border: 2px solid #3b82f6; border-radius: 8px; background: rgba(59, 130, 246, 0.1); margin-bottom: 20px;">
                        <p style="font-size: 18px; color: #60a5fa; font-weight: bold; margin: 0 0 10px 0;">📋 QUY ĐỊNH LÂM SÀNG:</p>
                        <p style="font-size: 16px; color: white; margin: 0;">YÊU CẦU LÂM SÀNG: Xác định mắt nhược thị. Nếu vật thể rơi màu <span style="color: #ef4444; font-weight: bold;">ĐỎ</span>, hãy đeo kính <span style="color: #06b6d4; font-weight: bold;">LỤC LAM (Cyan)</span> cho mắt nhược thị. Mắt lành đeo kính <span style="color: #ef4444; font-weight: bold;">ĐỎ</span>.</p>
                    </div>

                    <div style="padding: 20px; border: 2px solid #10b981; border-radius: 8px; background: rgba(16, 185, 129, 0.1); margin-bottom: 20px;">
                        <p style="font-size: 18px; color: #34d399; font-weight: bold; margin: 0 0 10px 0;">🎯 MỤC TIÊU ĐIỀU TRỊ:</p>
                        <p style="font-size: 16px; color: white; margin: 0;">Mục đích: Cải thiện độ nhạy tương phản của mắt nhược thị bằng cách giảm dần tín hiệu ở mắt lành, ép não bộ xóa bỏ ám điểm ức chế.</p>
                    </div>

                    <div style="padding: 20px; border: 2px solid #f59e0b; border-radius: 8px; background: rgba(245, 158, 11, 0.1); margin-bottom: 20px;">
                        <p style="font-size: 18px; color: #fbbf24; font-weight: bold; margin: 0 0 10px 0;">📜 LUẬT CHƠI:</p>
                        <ul style="font-size: 16px; color: white; margin: 0; padding-left: 20px;">
                            <li>Hứng trúng: <strong style="color: #10b981;">+1 điểm</strong></li>
                            <li>Hứng trượt: <strong style="color: #ef4444;">-1 điểm</strong></li>
                            <li>Bài tập kết thúc khi đạt <strong style="color: #fbbf24;">30 điểm</strong></li>
                        </ul>
                    </div>
                </div>
            `;
        } else {
            clinicalContent = `
                <div style="max-width: 600px; margin: 20px auto;">
                    <p style="font-size: 18px; color: #94a3b8; margin-bottom: 15px;"><strong>Mục đích:</strong> ${module.purpose}</p>
                    <p style="font-size: 18px; margin-bottom: 15px;"><strong>Hướng dẫn:</strong> ${module.instruction}</p>
                    <p style="font-size: 18px; color: #fbbf24; margin-bottom: 15px;"><strong>Mục tiêu:</strong> ${module.target}</p>
                </div>
            `;
        }

        const distM = parseFloat(localStorage.getItem('vision-therapy-calibrate-distance-m')) || 0.5;
        const distCm = Math.round(distM * 100);
        
        const lobbyHtml = `
            <div style="position: fixed; inset: 0; z-index: 9998; background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px; overflow-y: auto;">
                <h1 style="font-size: 36px; margin-bottom: 10px;">${module.name}</h1>
                
                <div style="padding: 10px; background: #fee2e2; border-left: 4px solid #ef4444; color: #991b1b; font-weight: bold; margin-bottom: 15px; max-width: 600px;">⚠️ YÊU CẦU BẮT BUỘC: Bệnh nhân ngồi cách màn hình chính xác ${distCm} cm.</div>
                
                ${clinicalContent}
                
                <div style="margin-top: 20px; padding: 15px; border: 2px solid #ef4444; border-radius: 8px; background: rgba(239, 68, 68, 0.1);">
                    <p style="font-size: 20px; color: #ef4444; font-weight: bold; margin: 0;">⚠ CẢNH BÁO: Đeo kính Đỏ-Lục Lam trước khi chơi</p>
                </div>
                
                <button id="btn-start-fullscreen" style="padding: 15px 30px; font-size: 20px; margin-top: 30px; cursor: pointer; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: bold;">BẮT ĐẦU (FULLSCREEN)</button>
            </div>
        `;

        this.workspaceContainer.innerHTML = lobbyHtml;

        // Attach fullscreen + game start handler
        const startBtn = document.getElementById('btn-start-fullscreen');
        if (startBtn) {
            startBtn.onclick = () => this._startFullscreenGame(module);
        }
    }

    /**
     * Enter fullscreen mode, apply CSS overrides, and start the game
     * @param {Object} module - Game module with classRef
     */
    _startFullscreenGame(module) {
        // Request fullscreen on workspace container
        this.workspaceContainer.requestFullscreen().catch(err => {
            console.warn("[Therapeutic] Fullscreen request failed:", err);
        });

        // Force CSS for workspace: full viewport, white background, cover all UI
        this.workspaceContainer.style.cssText = 'width: 100vw; height: 100vh; background: #FFFFFF; position: fixed; inset: 0; z-index: 9999;';

        // Remove Lobby
        this.workspaceContainer.innerHTML = '';

        // Initialize and start game
        try {
            this.currentGame = new module.classRef();
            
            this.currentGame.start();
            console.log(`[Therapeutic] Started ${module.name} successfully`);
        } catch (error) {
            console.error("[LỖI ENGINE NGHIÊM TRỌNG]:", error);
            alert("Không thể khởi động bài tập. Vui lòng xem Console.");
        }
    }
}

// ============================================================
// Auto-Mount (Active Polling for SPA Race Condition)
// ============================================================

// Khởi tạo instance global
window.therapeuticMenu = new TherapeuticMenuController();

// Active Polling: Kiểm tra DOM mỗi 200ms, tối đa 25 chu kỳ (5 giây)
(function autoMountTherapeutic() {
    let cycles = 0;
    const maxCycles = 25;
    const pollInterval = 200;

    const mountCheck = setInterval(() => {
        cycles++;

        const menuEl = document.getElementById('menu-therapeutic');
        const workspaceEl = document.getElementById('workspace-therapeutic');

        // Kiểm tra DOM tồn tại VÀ đã hiển thị thật (offsetParent !== null)
        if (menuEl && workspaceEl && menuEl.offsetParent !== null && workspaceEl.offsetParent !== null) {
            window.therapeuticMenu.init();
            console.log('[Therapeutic] Mount thành công');
            clearInterval(mountCheck);
            return;
        }

        // Giới hạn 25 chu kỳ (5 giây) — chống rò rỉ bộ nhớ
        if (cycles >= maxCycles) {
            console.warn('[Therapeutic] Không tìm thấy DOM sau 5 giây. Hủy auto-mount.');
            clearInterval(mountCheck);
        }
    }, pollInterval);
})();

// SPA Event Listener: Xử lý chuyển đổi workspace qua lại
document.addEventListener('onWorkspaceChanged', (e) => {
    if (e.detail.toWorkspace === 'therapeutic') {
        window.therapeuticMenu.init();
    } else {
        window.therapeuticMenu.stopCurrentGame();
    }
});
