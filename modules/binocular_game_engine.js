/**
 * BinocularGameEngine — Base class cho tất cả Game module phân thị (Dichoptic)
 * 
 * Cung cấp:
 * - Kiểm tra Anaglyph colors (window.__anaglyphColors)
 * - Canvas setup với kích thước workspace-therapeutic
 * - Render loop (requestAnimationFrame)
 * - super.render(): nền trắng + viền đen peripheral lock
 * - SPA event listener để cleanup khi chuyển workspace
 */

class BinocularGameEngine {
    /**
     * Khởi tạo Engine
     * Kiểm tra anaglyph colors, tạo canvas, bắt đầu render loop
     */
    constructor() {
        // --- Rào cản y khoa: Bắt buộc hiệu chuẩn Anaglyph colors ---
        if (typeof window !== 'undefined' && window.__anaglyphColors) {
            this.colors = {
                left: window.__anaglyphColors.red || '#FF0000',
                right: window.__anaglyphColors.cyan || '#00FFFF',
                lock: '#000000'
            };
        } else {
            // Fallback màu mặc định nếu chưa hiệu chuẩn
            this.colors = {
                left: '#FF0000',
                right: '#00FFFF',
                lock: '#000000'
            };
        }

        // --- Tạo canvas động trong workspace-therapeutic ---
        this.workspaceContainer = document.getElementById('workspace-therapeutic');
        if (!this.workspaceContainer) {
            console.error('[BinocularGameEngine] #workspace-therapeutic not found in DOM');
            return;
        }

        this.canvas = document.createElement('canvas');

        // --- Tiêm CSS nội tuyến ép buộc hiển thị ---
        this.workspaceContainer.style.position = 'relative';

        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '999';

        this.workspaceContainer.appendChild(this.canvas);

        // --- Cập nhật độ phân giải nội tại (Resolution) ---
        this.canvas.width = this.workspaceContainer.clientWidth || window.innerWidth;
        this.canvas.height = this.workspaceContainer.clientHeight || window.innerHeight;

        this.ctx = this.canvas.getContext('2d');

        // --- Resize handler để đồng bộ canvas khi đổi kích thước màn hình/Fullscreen ---
        this.resizeHandler = () => {
            if (this.canvas && this.workspaceContainer) {
                this.canvas.width = this.workspaceContainer.clientWidth;
                this.canvas.height = this.workspaceContainer.clientHeight;
                this.ctx = this.canvas.getContext('2d');
            }
        };
        window.addEventListener('resize', this.resizeHandler);

        // --- Render loop ---
        this._running = false;
        this._boundUpdate = this._updateLoop.bind(this);
    }

    /**
     * Bắt đầu render loop
     */
    start() {
        this._running = true;
        this._boundUpdate();

        // Lắng nghe SPA workspace change event
        this._boundSpaListener = this._handleSpaChange.bind(this);
        document.addEventListener('onWorkspaceChanged', this._boundSpaListener);
    }

    /**
     * Dừng render loop và dọn dẹp
     */
    stop() {
        this._running = false;
        if (this._animationFrameId) {
            cancelAnimationFrame(this._animationFrameId);
        }

        // Dọn dẹp resize listener
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }

        // Xóa SPA listener
        if (this._boundSpaListener) {
            document.removeEventListener('onWorkspaceChanged', this._boundSpaListener);
        }

        // Xóa canvas khỏi DOM
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }

    /**
     * Xử lý sự kiện chuyển workspace (SPA event)
     * @param {CustomEvent} e
     */
    _handleSpaChange(e) {
        if (e.detail.toWorkspace !== 'therapeutic') {
            this.stop();
        }
    }

    /**
     * Resize canvas theo kích thước container
     */
    _resizeCanvas() {
        const rect = this.workspaceContainer.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.ctx.scale(dpr, dpr);

        // Lưu kích thước logic (không DPR)
        this.width = rect.width;
        this.height = rect.height;
    }

    /**
     * Render loop nội bộ
     * Gọi update() → render() mỗi frame
     */
    _updateLoop() {
        if (!this._running) return;

        this.update();
        this.render();

        this._animationFrameId = requestAnimationFrame(this._boundUpdate);
    }

    /**
     * Phương thức con ghi đè: Cập nhật logic game mỗi frame
     * Mặc định: không làm gì (subclass override)
     */
    update() {
        // Override trong subclass
    }

    /**
     * Phương thức con ghi đè: Render đồ họa game mỗi frame
     * BẮT BUỘC gọi super.render() đầu tiên
     */
    render() {
        // BẮT BUỘC: Reset các thuộc tính trạng thái Context bị rò rỉ từ class con
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.globalAlpha = 1.0;

        // A. TẠO MÔI TRƯỜNG QUANG HỌC: Xóa toàn màn hình và đổ nền trắng (Subtractive Color Mixing)
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // B. DUY TRÌ HỢP THỊ: Khóa dung hợp ngoại vi (Peripheral Binocular Lock)
        this.ctx.strokeStyle = this.colors.lock;
        this.ctx.lineWidth = 10;
        this.ctx.strokeRect(5, 5, this.canvas.width - 10, this.canvas.height - 10);
    }
}

// Xuất toàn cục cho các subclass kế thừa
if (typeof window !== 'undefined') {
    window.BinocularGameEngine = BinocularGameEngine;
}
