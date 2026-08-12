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
                purpose: 'Phá vỡ ám điểm ức chế mắt nhược thị.',
                instruction: 'Dùng chuột di chuyển thanh ngang để hứng các hạt màu rơi xuống.',
                target: 'Đạt 100 điểm để chuyển cấp.'
            },
            {
                id: 'align',
                name: 'M2: Khớp khung',
                classRef: ShapeAlignmentGame,
                purpose: 'Kiểm tra và rèn luyện dung hợp phẳng.',
                instruction: 'Dùng chuột kéo khối màu lọt khít vào khung rỗng và giữ yên.',
                target: 'Khớp chính xác liên tục trong 2 giây.'
            },
            {
                id: 'vergence',
                name: 'M3: Vận nhãn',
                classRef: VergenceTrackerGame,
                purpose: 'Mở rộng biên độ vận nhãn.',
                instruction: 'Nhìn chằm chằm vào khối giữa màn hình. BẤM PHÍM SPACE NGAY LẬP TỨC khi thấy khối màu bị TÁCH LÀM ĐÔI (song thị).',
                target: 'Đo lường điểm đứt gãy (Break point).'
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
        const lobbyHtml = `
            <div style="position: fixed; inset: 0; z-index: 9998; background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px;">
                <h1 style="font-size: 36px; margin-bottom: 10px;">${module.name}</h1>
                
                <div style="max-width: 600px; margin: 20px auto;">
                    <p style="font-size: 18px; color: #94a3b8; margin-bottom: 15px;"><strong>Mục đích:</strong> ${module.purpose}</p>
                    <p style="font-size: 18px; margin-bottom: 15px;"><strong>Hướng dẫn:</strong> ${module.instruction}</p>
                    <p style="font-size: 18px; color: #fbbf24; margin-bottom: 15px;"><strong>Mục tiêu:</strong> ${module.target}</p>
                    
                    <div style="margin-top: 30px; padding: 15px; border: 2px solid #ef4444; border-radius: 8px; background: rgba(239, 68, 68, 0.1);">
                        <p style="font-size: 20px; color: #ef4444; font-weight: bold; margin: 0;">⚠ CẢNH BÁO: Đeo kính Đỏ-Lục Lam trước khi chơi</p>
                    </div>
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
