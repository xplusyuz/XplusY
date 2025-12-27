// seasons.js — 4 fasl fon animatsiyasi + auto switch (lightweight, xatosiz)
export function initSeasonalBackground(opts = {}) {
  const demoParam = opts.demoParam || "demoSeasons";
  const url = new URL(location.href);
  const isDemo = url.searchParams.get(demoParam) === "1";

  const byMonth = (m) => {
    if (m >= 2 && m <= 4) return "spring";   // Mar-May (0-index)
    if (m >= 5 && m <= 7) return "summer";   // Jun-Aug
    if (m >= 8 && m <= 10) return "autumn";  // Sep-Nov
    return "winter";                          // Dec-Feb
  };

  const setSeason = (season) => {
    const root = document.documentElement;
    const prev = root.dataset.season || "";
    if (prev === season) return;
    root.dataset.season = season;
    root.classList.add("season-swap");
    clearTimeout(setSeason._t);
    setSeason._t = setTimeout(() => root.classList.remove("season-swap"), 520);
    // notify particles engine
    if (engine) engine.setMode(season);
  };

  // ===== Canvas particles =====
  const canvas = document.createElement("canvas");
  canvas.className = "season-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });
  let W = 0, H = 0, DPR = 1;

  const resize = () => {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  };
  window.addEventListener("resize", resize, { passive: true });
  resize();

  const rand = (a, b) => a + Math.random() * (b - a);

  class Particle {
    constructor(mode) { this.reset(mode, true); }
    reset(mode, born) {
      this.mode = mode;
      this.x = rand(0, W);
      this.y = born ? rand(0, H) : -20;
      this.vx = rand(-0.4, 0.4);
      this.vy = rand(0.6, 1.6);
      this.r = rand(1.4, 4.4);
      this.rot = rand(0, Math.PI * 2);
      this.vr = rand(-0.02, 0.02);
      this.alpha = rand(0.35, 0.9);

      if (mode === "winter") { // snow
        this.vy = rand(0.7, 2.1);
        this.vx = rand(-0.6, 0.6);
        this.r = rand(1.2, 4.6);
      } else if (mode === "spring") { // petals
        this.vy = rand(0.6, 1.5);
        this.vx = rand(-0.9, 0.9);
        this.r = rand(2.0, 5.8);
      } else if (mode === "summer") { // sparkles
        this.vy = rand(0.2, 0.7);
        this.vx = rand(-0.2, 0.2);
        this.r = rand(1.0, 3.2);
        this.alpha = rand(0.25, 0.7);
      } else { // autumn leaves
        this.vy = rand(0.7, 1.9);
        this.vx = rand(-1.1, 1.1);
        this.r = rand(2.6, 6.6);
      }
    }
    step(dt) {
      const t = dt * 0.06;
      this.x += this.vx * t;
      this.y += this.vy * t;
      this.rot += this.vr * t;

      // gentle wind
      const wind = Math.sin((this.y / H) * Math.PI * 2 + performance.now() * 0.001) * 0.25;
      this.x += wind;

      if (this.x < -30) this.x = W + 30;
      if (this.x > W + 30) this.x = -30;
      if (this.y > H + 40) this.reset(this.mode, false);
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);

      if (this.mode === "winter") {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(0, 0, this.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.mode === "spring") {
        ctx.fillStyle = "rgba(255,182,193,0.95)";
        ctx.beginPath();
        ctx.ellipse(0, 0, this.r * 1.2, this.r * 0.8, 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.mode === "summer") {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.moveTo(0, -this.r);
        ctx.lineTo(this.r, 0);
        ctx.lineTo(0, this.r);
        ctx.lineTo(-this.r, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(255,165,0,0.9)";
        ctx.beginPath();
        ctx.ellipse(0, 0, this.r * 1.0, this.r * 0.6, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  class Engine {
    constructor() {
      this.mode = "winter";
      this.count = 54;
      this.items = [];
      this.last = performance.now();
      this._raf = 0;
      this.setMode(byMonth(new Date().getMonth()));
    }
    setMode(mode) {
      this.mode = mode;
      this.count = mode === "summer" ? 32 : mode === "winter" ? 68 : 54;
      while (this.items.length < this.count) this.items.push(new Particle(mode));
      while (this.items.length > this.count) this.items.pop();
      this.items.forEach(p => p.reset(mode, true));
    }
    start() {
      const tick = (now) => {
        const dt = Math.min(48, now - this.last);
        this.last = now;
        ctx.clearRect(0, 0, W, H);
        for (const p of this.items) { p.step(dt); p.draw(); }
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    }
    stop() { cancelAnimationFrame(this._raf); }
  }

  const engine = new Engine();
  engine.start();

  // initial season
  setSeason(byMonth(new Date().getMonth()));

  // auto switch:
  // - normal: check every 30 min (month-based)
  // - demo: rotate every 12s (spring->summer->autumn->winter)
  if (isDemo) {
    const order = ["spring", "summer", "autumn", "winter"];
    let idx = order.indexOf(document.documentElement.dataset.season || "spring");
    setInterval(() => {
      idx = (idx + 1) % order.length;
      setSeason(order[idx]);
    }, 12000);
  } else {
    setInterval(() => setSeason(byMonth(new Date().getMonth())), 30 * 60 * 1000);
  }
}
