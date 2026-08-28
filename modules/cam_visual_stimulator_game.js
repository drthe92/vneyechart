import BinocularGameEngine from './binocular_game_engine.js';

class CamVisualStimulatorGame extends BinocularGameEngine {
    constructor() {
        super();

        this.gameName = 'M7: Kích thích Lưới quay CAM (Monocular)';

        this.colors = { left: '#000000', right: '#FFFFFF', lock: '#000000' };

        this._angle = 0;
        this._rotationSpeed = 0.2;
        this._stripeWidth = 40;

        this._restColor = '#00C000';
        this._cueColor = '#FF0000';
        this._dotColor = this._restColor;

        this._cueActive = false;
        this._cueStartTime = 0;
        this._cueEndTime = 0;
        this._nextCueTime = 0;
        this._cueGap = () => 2000 + Math.random() * 2000;

        this.totalHits = 0;
        this.totalMisses = 0;
        this.falseAlarms = 0;
        this._reactionTimes = [];

        this._lastFrameTime = 0;
        this._gameStartTime = 0;
        this._durationMs = 60000;

        this._onKeyDown = (e) => {
            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                this._onPress();
            }
        };
        this._onPointerDown = (e) => {
            e.preventDefault();
            this._onPress();
        };
    }

    start(config = {}) {
        this._durationMs = (config && config.durationMs) ? config.durationMs : 60000;
        this._rotationSpeed = (config && config.rotationSpeed != null) ? config.rotationSpeed : 0.2;
        this._stripeWidth = (config && config.stripeWidth != null) ? config.stripeWidth : 40;

        this.totalHits = 0;
        this.totalMisses = 0;
        this.falseAlarms = 0;
        this._reactionTimes = [];
        this._cueActive = false;
        this._dotColor = this._restColor;

        this._gameStartTime = performance.now();
        this._lastFrameTime = this._gameStartTime;
        this._nextCueTime = this._gameStartTime + this._cueGap();

        super.start();

        window.addEventListener('keydown', this._onKeyDown);
        if (this.canvas) {
            this.canvas.addEventListener('pointerdown', this._onPointerDown);
        }
    }

    update(deltaTime) {
        if (!this._running) return;

        const now = performance.now();

        if (now - this._gameStartTime >= this._durationMs) {
            this.endGame();
            return;
        }

        let dtMs = deltaTime;
        if (dtMs === undefined || dtMs === null) {
            dtMs = this._lastFrameTime ? (now - this._lastFrameTime) : 16.7;
        }
        this._lastFrameTime = now;
        const dtSec = dtMs / 1000;

        this._angle = (this._angle + this._rotationSpeed * 2 * Math.PI * dtSec) % (2 * Math.PI);

        if (this._cueActive) {
            if (now >= this._cueEndTime) {
                this.totalMisses++;
                this._cueActive = false;
                this._dotColor = this._restColor;
                this._nextCueTime = now + this._cueGap();
            }
        } else {
            if (now >= this._nextCueTime) {
                this._cueActive = true;
                this._cueStartTime = now;
                this._cueEndTime = now + 1000;
                this._dotColor = this._cueColor;
            }
        }
    }

    render(ctx = this.ctx) {
        if (!this._running || !ctx) return;

        super.render();

        const cw = this.canvas.width;
        const ch = this.canvas.height;
        const cx = cw / 2;
        const cy = ch / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this._angle);
        const size = Math.max(cw, ch) * 2;
        const half = size / 2;
        const stripe = this._stripeWidth;
        ctx.fillStyle = '#000000';
        for (let x = -half; x < half; x += stripe * 2) {
            ctx.fillRect(x, -half, stripe, size);
        }
        ctx.restore();

        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, 2 * Math.PI);
        ctx.fillStyle = this._dotColor;
        ctx.fill();
    }

    _onPress() {
        if (!this._running) return;
        const now = performance.now();

        if (this._cueActive) {
            this.totalHits++;
            this._reactionTimes.push(now - this._cueStartTime);
            this._cueActive = false;
            this._dotColor = this._restColor;
            this._nextCueTime = now + this._cueGap();
        } else {
            this.falseAlarms++;
        }
    }

    endGame() {
        if (!this._running) return;

        const sumRt = this._reactionTimes.reduce((a, b) => a + b, 0);
        const avgRt = this._reactionTimes.length ? sumRt / this._reactionTimes.length : 0;
        const total = this.totalHits + this.totalMisses + this.falseAlarms;
        const accuracy = total > 0 ? this.totalHits / total : 0;

        this.sessionMetrics.customData = {
            totalHits: this.totalHits,
            totalMisses: this.totalMisses,
            falseAlarms: this.falseAlarms,
            accuracyRate: accuracy * 100,
            avgReactionTimeMs: avgRt
        };
        this.sessionMetrics.hits = this.totalHits;
        this.sessionMetrics.misses = this.totalMisses;

        this.finishSession();
        this.stop();
    }

    stop() {
        window.removeEventListener('keydown', this._onKeyDown);
        if (this.canvas) {
            this.canvas.removeEventListener('pointerdown', this._onPointerDown);
        }
        super.stop();
    }
}

if (typeof window !== 'undefined') {
    window.CamVisualStimulatorGame = CamVisualStimulatorGame;
}

export default CamVisualStimulatorGame;
