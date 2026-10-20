// Draws festival posters on a <canvas>. Everything here is free: the festive art is
// drawn in code (or the festival's own background image is used), and the real bike
// photos, logo, prices and contact details are placed on top.

export type PosterSize = "square" | "story" | "wide";

export const SIZES: Record<PosterSize, { w: number; h: number; label: string; hint: string }> = {
  square: { w: 1080, h: 1080, label: "Instagram post", hint: "1080 × 1080" },
  story: { w: 1080, h: 1920, label: "Story / WhatsApp status", hint: "1080 × 1920" },
  wide: { w: 1920, h: 1080, label: "Wide banner", hint: "1920 × 1080 — website, Facebook, shop TV" },
};

export type PosterBike = { name: string; img: HTMLImageElement; price: number; offerPrice: number };

export type DesignId = "royal" | "midnight" | "sunrise" | "brand";

type Design = {
  name: string;
  desc: string;
  bg: [string, string, string];
  rangoli: boolean;
  toran: boolean;
  diyas: boolean;
  fireworks: boolean;
  stripes: boolean;
  gold: [string, string, string];
  badge: string;
};

export const DESIGNS: Record<DesignId, Design> = {
  royal: {
    name: "Royal Diwali",
    desc: "Maroon and gold with rangoli, diyas and a marigold toran",
    bg: ["#6a1a22", "#2e0812", "#110307"],
    rangoli: true, toran: true, diyas: true, fireworks: false, stripes: false,
    gold: ["#fff3c4", "#f7c04a", "#e08a12"],
    badge: "#e8233b",
  },
  midnight: {
    name: "Midnight Fireworks",
    desc: "Deep night-blue sky with golden fireworks",
    bg: ["#1d2a5c", "#0d1433", "#05070f"],
    rangoli: false, toran: false, diyas: false, fireworks: true, stripes: false,
    gold: ["#fff6d6", "#ffd36b", "#f0a01c"],
    badge: "#ff3d6e",
  },
  sunrise: {
    name: "Festive Sunrise",
    desc: "Saffron to magenta glow with a mandala and toran",
    bg: ["#c2410c", "#7c1d4f", "#2a0a24"],
    rangoli: true, toran: true, diyas: false, fireworks: false, stripes: false,
    gold: ["#fffbe6", "#ffe08a", "#ffb020"],
    badge: "#16a34a",
  },
  brand: {
    name: "VMount Bold",
    desc: "Black and orange brand style that suits any occasion",
    bg: ["#2a1a0c", "#121212", "#070707"],
    rangoli: false, toran: false, diyas: false, fireworks: false, stripes: true,
    gold: ["#ffffff", "#ffc27a", "#f7941d"],
    badge: "#f7941d",
  },
};

/** Design used by the drawing helpers for the poster being drawn. */
let D: Design = DESIGNS.royal;

export type PosterInput = {
  size: PosterSize;
  design: DesignId;
  /** "greeting" posters show the bikes and message with no prices. */
  mode?: "offer" | "greeting";
  /** Text inside the burst badge, e.g. "SAVE" + "Rs 2,500", or "FLAT" + "15% OFF". */
  badge?: { top: string; value: string } | null;
  greeting: string;
  greetingLocal?: string;
  headline: string;
  subline: string;
  extras?: string;
  until: string;
  bikes: PosterBike[];
  logo: HTMLImageElement;
  background?: HTMLImageElement | null;
  brandName: string;
  phone: string;
  location: string;
};

const GOLD = "#f7c04a";
const GOLD_LIGHT = "#ffe6a8";
const CREAM = "#f8e2c4";
const DISPLAY = '"Space Grotesk", system-ui, sans-serif';
const BODY = 'Inter, system-ui, sans-serif';
const GUJARATI = '"Mukta Vaani", "Noto Sans Gujarati", sans-serif';
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** Small seeded random generator so the sparkles look the same every time. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Text that shrinks to fit maxWidth (up to maxLines lines). Returns the y below the block. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { size: number; min?: number; weight?: number; family?: string; color: string | CanvasGradient; maxWidth: number; maxLines?: number; align?: CanvasTextAlign; lineHeight?: number },
) {
  const { weight = 700, family = DISPLAY, maxLines = 2, align = "center", lineHeight = 1.05 } = opts;
  let size = opts.size;
  let lines: string[] = [];
  for (; size >= (opts.min ?? opts.size * 0.55); size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    lines = wrap(ctx, text, opts.maxWidth);
    if (lines.length <= maxLines) break;
  }
  ctx.fillStyle = opts.color;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * lineHeight));
  return y + lines.length * size * lineHeight;
}

function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, bw: number, bh: number) {
  const s = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  return { w, h };
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * s;
  const ih = img.naturalHeight * s;
  ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

// ---------- festive artwork ----------

function drawRangoli(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
  const rings = [
    { r: 1, n: 28, len: 0.22, w: 0.075, color: "rgba(247,192,74,0.30)" },
    { r: 0.76, n: 20, len: 0.26, w: 0.1, color: "rgba(255,122,26,0.30)" },
    { r: 0.5, n: 14, len: 0.24, w: 0.1, color: "rgba(232,69,122,0.30)" },
    { r: 0.28, n: 10, len: 0.18, w: 0.08, color: "rgba(255,213,107,0.35)" },
  ];
  ctx.save();
  ctx.translate(cx, cy);
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      ctx.save();
      ctx.rotate((i / ring.n) * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(0, -R * (ring.r - ring.len / 2), R * ring.w * 0.5, R * ring.len * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = ring.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,230,168,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * R * 1.05, Math.sin(a) * R * 1.05, R * 0.012, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,230,168,0.5)";
    ctx.fill();
  }
  ctx.restore();
}

function drawSparkles(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < 150; i++) {
    const x = r() * w;
    const y = r() * h;
    const s = 1 + r() * 3.2;
    ctx.globalAlpha = 0.25 + r() * 0.6;
    ctx.shadowColor = "#ffb347";
    ctx.shadowBlur = 14;
    ctx.fillStyle = r() > 0.3 ? "#ffd56b" : "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawToran(ctx: CanvasRenderingContext2D, w: number, top: number) {
  const n = Math.round(w / 40);
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return { x: t * w, y: top + Math.sin(t * Math.PI * 4) ** 2 * 34 };
  });
  ctx.save();
  ctx.strokeStyle = "#c98b2a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  pts.forEach((p, i) => {
    if (i % 2) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(i % 4 === 1 ? 0.15 : -0.15);
      ctx.fillStyle = "#2f8f3a";
      ctx.beginPath();
      ctx.ellipse(0, 24, 8, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = i % 4 === 0 ? "#f7941d" : "#ffc21a";
      ctx.beginPath();
      ctx.arc(p.x, p.y + 10, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c2410c";
      ctx.beginPath();
      ctx.arc(p.x, p.y + 10, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
}

function drawDiya(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  // glow
  const glow = ctx.createRadialGradient(x, y - s * 0.7, 0, x, y - s * 0.7, s * 1.6);
  glow.addColorStop(0, "rgba(255,180,70,0.45)");
  glow.addColorStop(1, "rgba(255,180,70,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - s * 1.8, y - s * 2.4, s * 3.6, s * 3.6);
  // flame
  const fl = ctx.createRadialGradient(x, y - s * 0.35, 0, x, y - s * 0.6, s * 0.7);
  fl.addColorStop(0, "#fffbe6");
  fl.addColorStop(0.45, "#ffd34d");
  fl.addColorStop(1, "#ff7a1a");
  ctx.fillStyle = fl;
  ctx.shadowColor = "#ff9a2a";
  ctx.shadowBlur = s * 0.8;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.25);
  ctx.bezierCurveTo(x + s * 0.32, y - s * 0.75, x + s * 0.28, y - s * 0.3, x, y - s * 0.15);
  ctx.bezierCurveTo(x - s * 0.28, y - s * 0.3, x - s * 0.32, y - s * 0.75, x, y - s * 1.25);
  ctx.fill();
  ctx.shadowBlur = 0;
  // bowl
  const bowl = ctx.createLinearGradient(0, y - s * 0.1, 0, y + s * 0.6);
  bowl.addColorStop(0, "#e2672a");
  bowl.addColorStop(1, "#7a250b");
  ctx.fillStyle = bowl;
  ctx.beginPath();
  ctx.moveTo(x - s, y - s * 0.1);
  ctx.quadraticCurveTo(x, y + s * 0.85, x + s, y - s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.1, s, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFireworks(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const r = rng(seed);
  const colors = ["#ffd36b", "#ff7ab6", "#7ad7ff", "#ffb04a", "#c4a7ff"];
  const bursts = Math.round((w * h) / 260000) + 3;
  ctx.save();
  for (let b = 0; b < bursts; b++) {
    const cx = 80 + r() * (w - 160);
    const cy = 60 + r() * h * 0.55;
    const R = 70 + r() * 110;
    const color = colors[b % colors.length];
    const rays = 26 + Math.floor(r() * 10);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + r() * 0.1;
      const len = R * (0.7 + r() * 0.3);
      const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(1, color);
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.2;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * len * 0.25, cy + Math.sin(a) * len * 0.25);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * len, cy + Math.sin(a) * len, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawStripes(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const off = i * 46;
    ctx.fillStyle = "#f7941d";
    ctx.globalAlpha = 0.12 + i * 0.04;
    ctx.beginPath();
    ctx.moveTo(w - 380 + off, 0);
    ctx.lineTo(w - 350 + off, 0);
    ctx.lineTo(w - 650 + off, h);
    ctx.lineTo(w - 680 + off, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.font = `700 ${Math.round(Math.min(w, h) * 0.3)}px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(247,148,29,0.18)";
  ctx.lineWidth = 3;
  ctx.strokeText("VMOUNT", w / 2, h * 0.5);
  ctx.restore();
}

function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(38, 38, w - 76, h - 76);
  ctx.globalAlpha = 1;
  ctx.fillStyle = GOLD;
  for (const [x, y] of [
    [24, 24],
    [w - 24, 24],
    [24, h - 24],
    [w - 24, h - 24],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-11, -11, 22, 22);
    ctx.restore();
  }
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, p: PosterInput, w: number, h: number, focus: { x: number; y: number; r: number }) {
  if (p.background) {
    drawCover(ctx, p.background, w, h);
    // darken the edges so text stays readable on any photo
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0.15)");
    v.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const g = ctx.createRadialGradient(focus.x, focus.y, 0, focus.x, focus.y, Math.max(w, h) * 0.8);
  g.addColorStop(0, D.bg[0]);
  g.addColorStop(0.5, D.bg[1]);
  g.addColorStop(1, D.bg[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (D.stripes) drawStripes(ctx, w, h);
  if (D.fireworks) drawFireworks(ctx, w, h, w * 3 + h);
  if (D.rangoli) drawRangoli(ctx, focus.x, focus.y, focus.r);
  drawSparkles(ctx, w, h, w * 7 + h);
  if (D.toran) drawToran(ctx, w, 0);
}

// ---------- content blocks ----------

function drawBrand(ctx: CanvasRenderingContext2D, p: PosterInput, x: number, y: number, size: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.clip();
  ctx.drawImage(p.logo, x, y, size, size);
  ctx.restore();
  ctx.font = `700 ${size * 0.34}px ${DISPLAY}`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(p.brandName, x + size + 18, y + size * 0.4);
  ctx.font = `500 ${size * 0.2}px ${BODY}`;
  ctx.fillStyle = CREAM;
  ctx.fillText("Passion for Cycling", x + size + 18, y + size * 0.74);
}

function goldGradient(ctx: CanvasRenderingContext2D, y: number, h: number) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, D.gold[0]);
  g.addColorStop(0.55, D.gold[1]);
  g.addColorStop(1, D.gold[2]);
  return g;
}

function drawBikeWithGlow(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, bw: number, bh: number) {
  ctx.save();
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, bw * 0.55);
  glow.addColorStop(0, "rgba(255,226,170,0.55)");
  glow.addColorStop(0.6, "rgba(255,160,60,0.18)");
  glow.addColorStop(1, "rgba(255,160,60,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cx - bw, cy - bh, bw * 2, bh * 2);
  // ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.filter = "blur(14px)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + bh * 0.44, bw * 0.42, bh * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = "none";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  drawContain(ctx, img, cx, cy, bw, bh);
  ctx.restore();
}

function drawSaveBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, badge: PosterInput["badge"]) {
  if (!badge) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.18);
  ctx.beginPath();
  const spikes = 18;
  for (let i = 0; i <= spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * 0.86 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.fillStyle = D.badge;
  ctx.shadowColor = D.badge;
  ctx.shadowBlur = 24;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${r * 0.3}px ${BODY}`;
  ctx.fillText(badge.top, 0, -r * 0.24, r * 1.5);
  ctx.font = `700 ${r * 0.38}px ${DISPLAY}`;
  ctx.fillText(badge.value, 0, r * 0.16, r * 1.6);
  ctx.restore();
}

/** Struck-through price above a gold price pill. Returns the pill's bottom y. */
function drawPrice(ctx: CanvasRenderingContext2D, b: PosterBike, cx: number, y: number, scale: number) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  if (b.offerPrice >= b.price) y -= 36 * scale; // no saving: just the price pill
  ctx.font = `500 ${26 * scale}px ${BODY}`;
  ctx.fillStyle = CREAM;
  const mrp = b.offerPrice < b.price ? `MRP ${inr.format(b.price)}` : "";
  ctx.fillText(mrp, cx, y);
  if (mrp) {
    const mw = ctx.measureText(mrp).width;
    ctx.strokeStyle = "#ff5a5a";
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - mw / 2 - 4, y + 15 * scale);
    ctx.lineTo(cx + mw / 2 + 4, y + 15 * scale);
    ctx.stroke();
  }

  ctx.font = `700 ${50 * scale}px ${DISPLAY}`;
  const label = inr.format(b.offerPrice);
  const pw = ctx.measureText(label).width + 56 * scale;
  const ph = 72 * scale;
  const py = y + 40 * scale;
  roundRect(ctx, cx - pw / 2, py, pw, ph, ph / 2);
  const g = ctx.createLinearGradient(0, py, 0, py + ph);
  g.addColorStop(0, "#ffe08a");
  g.addColorStop(1, "#f0a01c");
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(247,192,74,0.5)";
  ctx.shadowBlur = 24;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#3a0b16";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, py + ph / 2 + 2 * scale);
  ctx.restore();
  return py + ph;
}

function drawChip(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, size: number, maxWidth: number) {
  ctx.save();
  ctx.font = `600 ${size}px ${BODY}`;
  let label = text;
  while (ctx.measureText(label).width > maxWidth - size * 2 && label.length > 8) label = label.slice(0, -2);
  if (label !== text) label = label.trimEnd() + "…";
  const w = ctx.measureText(label).width + size * 2;
  const h = size * 2.1;
  roundRect(ctx, cx - w / 2, y, w, h, h / 2);
  ctx.fillStyle = "rgba(247,192,74,0.16)";
  ctx.fill();
  ctx.strokeStyle = "rgba(247,192,74,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = GOLD_LIGHT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, y + h / 2 + 1);
  ctx.restore();
  return y + h;
}

function drawFooter(ctx: CanvasRenderingContext2D, p: PosterInput, x: number, y: number, w: number, h: number) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 20);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fill();
  ctx.strokeStyle = "rgba(247,192,74,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${h * 0.27}px ${DISPLAY}`;
  ctx.fillText(`Call / WhatsApp ${p.phone}`, x + w / 2, y + h * 0.36, w - 40);
  ctx.fillStyle = CREAM;
  ctx.font = `500 ${h * 0.18}px ${BODY}`;
  const line2 = p.mode === "greeting" ? `${p.location} · ${p.brandName}` : `${p.location} · Offer till ${p.until} · T&C apply`;
  ctx.fillText(line2, x + w / 2, y + h * 0.72, w - 40);
  ctx.restore();
}

// ---------- layouts ----------

function drawHeader(ctx: CanvasRenderingContext2D, p: PosterInput, cx: number, top: number, maxWidth: number, scale: number, align: CanvasTextAlign = "center") {
  let y = top;
  if (p.greetingLocal) {
    ctx.save();
    ctx.shadowColor = "rgba(255,170,60,0.7)";
    ctx.shadowBlur = 30;
    y = fitText(ctx, p.greetingLocal, cx, y, { size: 74 * scale, family: GUJARATI, color: "#ffd56b", maxWidth, maxLines: 1, align, lineHeight: 1.25 });
    ctx.restore();
  }
  ctx.save();
  ctx.font = `600 ${24 * scale}px ${BODY}`;
  ctx.fillStyle = "#ffb86b";
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillText(`${p.greeting.toUpperCase()}  ·  ${p.brandName.toUpperCase()}`, cx, y + 4 * scale);
  ctx.restore();
  y += 46 * scale;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 16;
  y = fitText(ctx, p.headline, cx, y, { size: 96 * scale, color: goldGradient(ctx, y, 190 * scale), maxWidth, maxLines: 2, align });
  ctx.restore();
  y = fitText(ctx, p.subline, cx, y + 14 * scale, { size: 34 * scale, weight: 500, family: BODY, color: CREAM, maxWidth, maxLines: 2, align, lineHeight: 1.3 });
  return y;
}

function layoutSquare(ctx: CanvasRenderingContext2D, p: PosterInput, w: number, h: number) {
  drawBackground(ctx, p, w, h, { x: w / 2, y: 600, r: 360 });
  drawFrame(ctx, w, h);
  drawBrand(ctx, p, 70, 92, 92);
  drawHeader(ctx, p, w / 2, 196, w - 160, 0.8);
  const main = p.bikes[0];
  if (main) {
    drawBikeWithGlow(ctx, main.img, w / 2, 598, 660, 290);
    drawSaveBadge(ctx, w - 170, 500, 78, p.badge);
    ctx.font = `700 32px ${DISPLAY}`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(main.name, w / 2, 752);
    drawPrice(ctx, main, w / 2, 792, 0.78);
  }
  if (D.diyas) drawDiya(ctx, 125, 868, 32);
  if (D.diyas) drawDiya(ctx, w - 125, 868, 32);
  if (p.extras) drawChip(ctx, `🎁 ${p.extras}`, w / 2, 896, 19, w - 360);
  drawFooter(ctx, p, 70, 950, w - 140, 80);
}

function layoutStory(ctx: CanvasRenderingContext2D, p: PosterInput, w: number, h: number) {
  drawBackground(ctx, p, w, h, { x: w / 2, y: 930, r: 460 });
  drawFrame(ctx, w, h);
  drawBrand(ctx, p, 80, 120, 110);
  const headerEnd = drawHeader(ctx, p, w / 2, 280, w - 160, 1);
  const [main, ...rest] = p.bikes;
  if (main) {
    const cy = Math.max(940, headerEnd + 250);
    drawBikeWithGlow(ctx, main.img, w / 2, cy, 880, 420);
    drawSaveBadge(ctx, w - 185, cy - 150, 96, p.badge);
    ctx.font = `700 44px ${DISPLAY}`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(main.name, w / 2, cy + 205);
    drawPrice(ctx, main, w / 2, cy + 258, 0.95);
  }
  const small = rest.slice(0, 2);
  const top = 1350;
  small.forEach((b, i) => {
    const cx = small.length === 1 ? w / 2 : w / 2 + (i ? 235 : -235);
    roundRect(ctx, cx - 215, top, 430, 305, 26);
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fill();
    ctx.strokeStyle = "rgba(247,192,74,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
    drawBikeWithGlow(ctx, b.img, cx, top + 100, 370, 170);
    ctx.font = `700 30px ${DISPLAY}`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(b.name, cx, top + 190, 400);
    ctx.font = `500 22px ${BODY}`;
    ctx.fillStyle = CREAM;
    if (b.offerPrice < b.price) ctx.fillText(`MRP ${inr.format(b.price)}`, cx, top + 230);
    ctx.font = `700 34px ${DISPLAY}`;
    ctx.fillStyle = "#ffd56b";
    ctx.fillText(inr.format(b.offerPrice), cx, top + 258);
  });
  const chipY = small.length ? 1675 : 1400;
  if (D.diyas) drawDiya(ctx, 130, chipY + 28, 34);
  if (D.diyas) drawDiya(ctx, w - 130, chipY + 28, 34);
  if (p.extras) drawChip(ctx, `🎁 ${p.extras}`, w / 2, chipY, 24, w - 380);
  drawFooter(ctx, p, 80, h - 172, w - 160, 106);
}

function layoutWide(ctx: CanvasRenderingContext2D, p: PosterInput, w: number, h: number) {
  drawBackground(ctx, p, w, h, { x: 1380, y: 520, r: 470 });
  drawFrame(ctx, w, h);
  drawBrand(ctx, p, 90, 100, 100);
  const left = 100;
  const colW = 780;
  let y = drawHeader(ctx, p, left, 250, colW, 0.95, "left");
  const main = p.bikes[0];
  if (p.extras) {
    ctx.font = `600 24px ${BODY}`;
    const chipW = Math.min(colW, ctx.measureText(`🎁 ${p.extras}`).width + 48);
    y = drawChip(ctx, `🎁 ${p.extras}`, left + chipW / 2, y + 30, 24, colW) + 10;
  }
  if (main) {
    drawBikeWithGlow(ctx, main.img, 1380, 500, 860, 520);
    drawSaveBadge(ctx, 1730, 270, 100, p.badge);
    ctx.font = `700 42px ${DISPLAY}`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(main.name, 1380, 770);
    drawPrice(ctx, main, 1380, 822, 0.95);
  }
  if (D.diyas) drawDiya(ctx, 160, 905, 36);
  if (D.diyas) drawDiya(ctx, 270, 905, 28);
  drawFooter(ctx, p, 360, 860, 820, 120);
}

/** Main bike in front, up to two more behind it on either side. */
function drawLineup(ctx: CanvasRenderingContext2D, bikes: PosterBike[], cx: number, cy: number, bw: number, bh: number) {
  const [main, ...rest] = bikes;
  const sides = rest.slice(0, 2);
  sides.forEach((b, i) => {
    const dir = sides.length === 1 ? 1 : i ? 1 : -1;
    ctx.save();
    ctx.globalAlpha = 0.88;
    drawBikeWithGlow(ctx, b.img, cx + dir * bw * 0.36, cy - bh * 0.06, bw * 0.62, bh * 0.62);
    ctx.restore();
  });
  if (main) drawBikeWithGlow(ctx, main.img, cx, cy + bh * 0.04, bw * 0.78, bh * 0.78);
}

function drawSignature(ctx: CanvasRenderingContext2D, p: PosterInput, x: number, y: number, size: number, align: CanvasTextAlign) {
  ctx.save();
  ctx.font = `600 ${size}px ${BODY}`;
  ctx.fillStyle = "#ffb86b";
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillText(`— Team ${p.brandName}`, x, y);
  ctx.restore();
  return y + size * 1.4;
}

function layoutSquareGreeting(ctx: CanvasRenderingContext2D, p: PosterInput, w: number, h: number) {
  drawBackground(ctx, p, w, h, { x: w / 2, y: 610, r: 380 });
  drawFrame(ctx, w, h);
  drawBrand(ctx, p, 70, 92, 92);
  drawHeader(ctx, { ...p, subline: "" }, w / 2, 196, w - 160, 0.8);
  drawLineup(ctx, p.bikes, w / 2, 612, 900, 380);
  fitText(ctx, p.subline, w / 2, 800, {
    size: 30, min: 22, weight: 500, family: BODY, color: CREAM, maxWidth: w - 220, maxLines: p.extras ? 2 : 3, lineHeight: 1.35,
  });
  if (D.diyas) drawDiya(ctx, 125, 880, 32);
  if (D.diyas) drawDiya(ctx, w - 125, 880, 32);
  if (p.extras) drawChip(ctx, `✨ ${p.extras}`, w / 2, 896, 19, w - 360);
  drawFooter(ctx, p, 70, 950, w - 140, 80);
}

function layoutStoryGreeting(ctx: CanvasRenderingContext2D, p: PosterInput, w: number, h: number) {
  drawBackground(ctx, p, w, h, { x: w / 2, y: 980, r: 470 });
  drawFrame(ctx, w, h);
  drawBrand(ctx, p, 80, 120, 110);
  const headerEnd = drawHeader(ctx, { ...p, subline: "" }, w / 2, 300, w - 160, 1);
  const cy = Math.max(980, headerEnd + 330);
  drawLineup(ctx, p.bikes, w / 2, cy, 1000, 560);
  let y = fitText(ctx, p.subline, w / 2, cy + 300, {
    size: 40, min: 28, weight: 500, family: BODY, color: CREAM, maxWidth: w - 200, maxLines: 4, lineHeight: 1.35,
  });
  y = drawSignature(ctx, p, w / 2, y + 22, 30, "center");
  if (D.diyas) drawDiya(ctx, 130, 1700, 34);
  if (D.diyas) drawDiya(ctx, w - 130, 1700, 34);
  if (p.extras) drawChip(ctx, `✨ ${p.extras}`, w / 2, Math.max(y + 16, 1660), 24, w - 380);
  drawFooter(ctx, p, 80, h - 172, w - 160, 106);
}

function layoutWideGreeting(ctx: CanvasRenderingContext2D, p: PosterInput, w: number, h: number) {
  drawBackground(ctx, p, w, h, { x: 1340, y: 520, r: 470 });
  drawFrame(ctx, w, h);
  drawBrand(ctx, p, 90, 100, 100);
  const left = 100;
  const colW = 700;
  let y = drawHeader(ctx, { ...p, subline: "" }, left, 250, colW, 0.95, "left");
  y = fitText(ctx, p.subline, left, y + 10, {
    size: 34, min: 24, weight: 500, family: BODY, color: CREAM, maxWidth: colW, maxLines: 4, align: "left", lineHeight: 1.35,
  });
  y = drawSignature(ctx, p, left, y + 16, 26, "left");
  if (p.extras) {
    ctx.font = `600 22px ${BODY}`;
    const chipW = Math.min(colW, ctx.measureText(`✨ ${p.extras}`).width + 44);
    drawChip(ctx, `✨ ${p.extras}`, left + chipW / 2, Math.min(y + 18, 790), 22, colW);
  }
  drawLineup(ctx, p.bikes, 1340, 520, 760, 520);
  if (D.diyas) drawDiya(ctx, 160, 905, 36);
  if (D.diyas) drawDiya(ctx, 270, 905, 28);
  drawFooter(ctx, p, 360, 860, 820, 120);
}

export function drawPoster(canvas: HTMLCanvasElement, p: PosterInput) {
  const { w, h } = SIZES[p.size];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  D = DESIGNS[p.design] ?? DESIGNS.royal;
  ctx.clearRect(0, 0, w, h);
  const greeting = p.mode === "greeting";
  if (p.size === "square") (greeting ? layoutSquareGreeting : layoutSquare)(ctx, p, w, h);
  else if (p.size === "story") (greeting ? layoutStoryGreeting : layoutStory)(ctx, p, w, h);
  else (greeting ? layoutWideGreeting : layoutWide)(ctx, p, w, h);
}

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

export async function loadPosterFonts() {
  await Promise.all(
    [`700 80px ${DISPLAY}`, `500 30px ${BODY}`, `600 30px ${BODY}`, `700 30px ${BODY}`, `700 70px ${GUJARATI}`].map((f) =>
      document.fonts.load(f, "Diwali શુભ ₹").catch(() => undefined),
    ),
  );
}
