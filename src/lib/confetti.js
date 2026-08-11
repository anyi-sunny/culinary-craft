/**
 * Lightweight celebratory confetti — no dependencies. Spawns a fixed canvas,
 * animates ~2.6s of falling pieces in the brand palette, then removes itself.
 */
const COLORS = ["#b9663f", "#d29268", "#5f7259", "#8a4a2e", "#f7ede3", "#a97155"];

export function fireConfetti() {
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
        "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const pieces = Array.from({ length: 160 }, () => ({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.4,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        vy: 2.4 + Math.random() * 3.2,
        vx: -1.6 + Math.random() * 3.2,
        rot: Math.random() * Math.PI,
        vr: -0.12 + Math.random() * 0.24,
    }));

    const start = performance.now();
    const DURATION = 2600;

    const tick = (now) => {
        const t = now - start;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const fade = t > DURATION - 500 ? Math.max(0, (DURATION - t) / 500) : 1;
        ctx.globalAlpha = fade;
        for (const p of pieces) {
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.vr;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }
        if (t < DURATION) {
            requestAnimationFrame(tick);
        } else {
            canvas.remove();
        }
    };
    requestAnimationFrame(tick);
}
