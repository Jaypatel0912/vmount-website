// White-background removal for cycle photos, run in the browser on /cycles.
// Same method as scripts/remove-bg.py:
//  1. White connected to the photo's edge is background (thin white links cut first,
//     so frame lettering touching a shine line is not swallowed).
//  2. Enclosed white wider than a letter stroke (frame triangles, gaps between
//     spokes) is background.
//  3. Thin enclosed white surrounded mostly by background (between crossing
//     spokes) is background.
//  4. Slivers near a wheel hub (found from the cluster of spoke gaps) are background.
//  5. Light halo and the floor shadow under the tyres are removed, and edge pixels
//     are un-mixed from white so no white outline remains.
// White lettering on the frame (VMOUNT etc.) is kept.
// Pure function (no DOM), so it also runs in Node for testing.

export type RawImage = { data: Uint8ClampedArray | Uint8Array; width: number; height: number };

const isWhite = (mn: number, mx: number) => mn > 212 && mx - mn < 32;

/** 4-connected labelling of mask pixels. Returns labels (0 = none) and count. */
function label(mask: Uint8Array, w: number, h: number) {
  const lab = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let n = 0;
  for (let p0 = 0; p0 < w * h; p0++) {
    if (!mask[p0] || lab[p0]) continue;
    n++;
    let top = 0;
    stack[top++] = p0;
    lab[p0] = n;
    while (top) {
      const p = stack[--top];
      const x = p % w;
      if (x > 0 && mask[p - 1] && !lab[p - 1]) (lab[p - 1] = n), (stack[top++] = p - 1);
      if (x < w - 1 && mask[p + 1] && !lab[p + 1]) (lab[p + 1] = n), (stack[top++] = p + 1);
      if (p >= w && mask[p - w] && !lab[p - w]) (lab[p - w] = n), (stack[top++] = p - w);
      if (p < w * (h - 1) && mask[p + w] && !lab[p + w]) (lab[p + w] = n), (stack[top++] = p + w);
    }
  }
  return { lab, n };
}

/** City-block distance from every pixel to the nearest mask pixel (exact for 4-neighbour dilation). */
function l1Distance(mask: Uint8Array, w: number, h: number) {
  const INF = 1 << 29;
  const d = new Int32Array(w * h);
  for (let p = 0; p < w * h; p++) d[p] = mask[p] ? 0 : INF;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (x > 0 && d[p - 1] + 1 < d[p]) d[p] = d[p - 1] + 1;
      if (y > 0 && d[p - w] + 1 < d[p]) d[p] = d[p - w] + 1;
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const p = y * w + x;
      if (x < w - 1 && d[p + 1] + 1 < d[p]) d[p] = d[p + 1] + 1;
      if (y < h - 1 && d[p + w] + 1 < d[p]) d[p] = d[p + w] + 1;
    }
  return d;
}

const dilate = (mask: Uint8Array, w: number, h: number, r: number) => {
  const d = l1Distance(mask, w, h);
  const out = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) out[p] = d[p] <= r ? 1 : 0;
  return out;
};

const erode = (mask: Uint8Array, w: number, h: number, r: number) => {
  const inv = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) inv[p] = mask[p] ? 0 : 1;
  const d = l1Distance(inv, w, h);
  const out = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const x = p % w;
    const y = (p / w) | 0;
    const edge = Math.min(x + 1, y + 1, w - x, h - y);
    out[p] = mask[p] && d[p] > r && edge > r ? 1 : 0;
  }
  return out;
};

/** Exact Euclidean distance from each mask pixel to the nearest non-mask pixel. */
function edt(mask: Uint8Array, w: number, h: number) {
  const INF = 1e20;
  const f = new Float64Array(Math.max(w, h));
  const d1 = new Float64Array(Math.max(w, h));
  const v = new Int32Array(Math.max(w, h));
  const z = new Float64Array(Math.max(w, h) + 1);
  const g = new Float64Array(w * h);
  const pass = (n: number) => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      d1[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
  };
  // columns (pad with background outside the image)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = mask[y * w + x] ? INF : 0;
    pass(h);
    for (let y = 0; y < h; y++) g[y * w + x] = d1[y];
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x];
    pass(w);
    for (let x = 0; x < w; x++) out[y * w + x] = mask[y * w + x] ? Math.sqrt(d1[x]) : 0;
  }
  return out;
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const percentile = (a: number[], q: number) => {
  const s = [...a].sort((x, y) => x - y);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};

/** Removes the white background in place (alpha 0) and returns the visible bounding box. */
export function removeWhiteBackground(img: RawImage) {
  const { data: px, width: w, height: h } = img;
  const N = w * h;
  const mn = new Uint8Array(N);
  const mx = new Uint8Array(N);
  const white = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const r = px[p * 4], g = px[p * 4 + 1], b = px[p * 4 + 2];
    mn[p] = Math.min(r, g, b);
    mx[p] = Math.max(r, g, b);
    white[p] = isWhite(mn[p], mx[p]) ? 1 : 0;
  }

  // 1) Outside background, after cutting thin white links
  const opened = dilate(erode(white, w, h, 2), w, h, 2);
  for (let p = 0; p < N; p++) opened[p] &= white[p];
  const ol = label(opened, w, h);
  const borderIds = new Set<number>();
  for (let x = 0; x < w; x++) borderIds.add(ol.lab[x]), borderIds.add(ol.lab[(h - 1) * w + x]);
  for (let y = 0; y < h; y++) borderIds.add(ol.lab[y * w]), borderIds.add(ol.lab[y * w + w - 1]);
  borderIds.delete(0);
  const seed = new Uint8Array(N);
  for (let p = 0; p < N; p++) seed[p] = borderIds.has(ol.lab[p]) ? 1 : 0;
  const near = dilate(seed, w, h, 3);
  const outside = new Uint8Array(N);
  const inner = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    outside[p] = near[p] & white[p];
    inner[p] = white[p] & (outside[p] ^ 1);
  }

  // Enclosed white regions and their measurements
  const { lab, n } = label(inner, w, h);
  const OUT = n + 1;
  for (let p = 0; p < N; p++) if (outside[p]) lab[p] = OUT;
  const dt = edt(white, w, h);
  const area = new Int32Array(n + 1);
  const x0 = new Int32Array(n + 1).fill(w), x1 = new Int32Array(n + 1).fill(-1);
  const y0 = new Int32Array(n + 1).fill(h), y1 = new Int32Array(n + 1).fill(-1);
  const thick = new Float32Array(n + 1);
  for (let p = 0; p < N; p++) {
    const k = lab[p];
    if (!k || k === OUT) continue;
    const x = p % w, y = (p / w) | 0;
    area[k]++;
    if (x < x0[k]) x0[k] = x;
    if (x > x1[k]) x1[k] = x;
    if (y < y0[k]) y0[k] = y;
    if (y > y1[k]) y1[k] = y;
    if (dt[p] > thick[k]) thick[k] = dt[p];
  }

  const scale = w / 1024;
  const bg = new Uint8Array(n + 2); // per label: 1 = background
  bg[OUT] = 1;

  // 2) Wider than a letter stroke, or a long thin wedge
  for (let k = 1; k <= n; k++) {
    const longest = Math.max(x1[k] - x0[k] + 1, y1[k] - y0[k] + 1);
    if (thick[k] >= 4.5 * scale || (longest > 160 * scale && thick[k] >= 2.5)) bg[k] = 1;
  }
  const definite = new Uint8Array(N);
  for (let p = 0; p < N; p++) definite[p] = lab[p] && bg[lab[p]] ? 1 : 0;

  // 3) Thin regions mostly ringed by background (cells between crossing spokes)
  const ringBg = new Float32Array(n + 1);
  const keep: number[] = [];
  for (let k = 1; k <= n; k++) {
    if (bg[k]) continue;
    const bx0 = Math.max(x0[k] - 9, 0), bx1 = Math.min(x1[k] + 9, w - 1);
    const by0 = Math.max(y0[k] - 9, 0), by1 = Math.min(y1[k] + 9, h - 1);
    const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
    const local = new Uint8Array(bw * bh);
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) local[(y - by0) * bw + (x - bx0)] = lab[y * w + x] === k ? 1 : 0;
    const d = l1Distance(local, bw, bh);
    let ring = 0, hit = 0;
    for (let y = by0; y <= by1; y++)
      for (let x = bx0; x <= bx1; x++) {
        const dd = d[(y - by0) * bw + (x - bx0)];
        if (dd > 2 && dd <= 8) {
          ring++;
          hit += definite[y * w + x];
        }
      }
    ringBg[k] = ring ? hit / ring : 0;
    if (ringBg[k] > 0.4) bg[k] = 1;
    else keep.push(k);
  }

  // 4) Wheel hubs from clusters of spoke gaps; slivers near a hub are background
  const s2 = scale * scale;
  const center = (k: number) => [(y0[k] + y1[k] + 1) / 2, (x0[k] + x1[k] + 1) / 2];
  const findHubs = (pool: number[], grow: number, minCells: number, ringCheck: boolean) => {
    if (!pool.length) return [] as { hy: number; hx: number; r: number; count: number }[];
    const inPool = new Uint8Array(n + 1);
    for (const k of pool) inPool[k] = 1;
    const cells = new Uint8Array(N);
    for (let p = 0; p < N; p++) cells[p] = lab[p] && lab[p] <= n && inPool[lab[p]] ? 1 : 0;
    const grown = dilate(cells, w, h, grow);
    const cl = label(grown, w, h);
    const groups = new Map<number, number[]>();
    const seen = new Uint8Array(n + 1);
    for (let p = 0; p < N; p++) {
      const k = lab[p];
      if (!cells[p] || seen[k]) continue;
      seen[k] = 1;
      const c = cl.lab[p];
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c)!.push(k);
    }
    const found: { hy: number; hx: number; r: number; count: number }[] = [];
    for (const ids of groups.values()) {
      if (ids.length < minCells) continue;
      const cen = ids.map(center);
      const hy = median(cen.map((c) => c[0]));
      const hx = median(cen.map((c) => c[1]));
      const dist = cen.map(([y, x]) => Math.hypot(y - hy, x - hx));
      if (ringCheck) {
        const ang = cen.map(([y, x]) => ((Math.atan2(y - hy, x - hx) * 180) / Math.PI + 360) % 360).sort((a, b) => a - b);
        let gap = ang[0] + 360 - ang[ang.length - 1];
        for (let i = 1; i < ang.length; i++) gap = Math.max(gap, ang[i] - ang[i - 1]);
        const mean = dist.reduce((a, b) => a + b, 0) / dist.length;
        const sd = Math.sqrt(dist.reduce((a, b) => a + (b - mean) ** 2, 0) / dist.length);
        if (sd / Math.max(mean, 1) > 0.3 || gap > 120) continue;
      }
      found.push({ hy, hx, r: percentile(dist, 0.9), count: ids.length });
    }
    return found.sort((a, b) => b.count - a.count);
  };
  const bgEnclosed: number[] = [];
  for (let k = 1; k <= n; k++) if (bg[k]) bgEnclosed.push(k);
  const spokeCells = bgEnclosed.filter((k) => area[k] >= 150 * s2 && area[k] < 8000 * s2);
  const magCells = bgEnclosed.filter((k) => area[k] >= 8000 * s2 && area[k] < 60000 * s2);
  const hubs = [...findHubs(spokeCells, Math.trunc(12 * scale), 10, false), ...findHubs(magCells, Math.trunc(22 * scale), 4, true)].slice(0, 2);

  // Studio-white level of this photo (median brightness of the outside background)
  const hist = new Int32Array(256);
  let outCount = 0;
  for (let p = 0; p < N; p++) if (outside[p]) hist[mn[p]]++, outCount++;
  let bgLevel = 255;
  for (let v = 0, acc = 0; v < 256; v++) if ((acc += hist[v]) >= outCount / 2) { bgLevel = v; break; }
  const pureLevel = Math.min(250, bgLevel - 5);
  const pure = new Int32Array(n + 1);
  const sumMn = new Float64Array(n + 1);
  for (let p = 0; p < N; p++) {
    const k = lab[p];
    if (!k || k === OUT) continue;
    sumMn[k] += mn[p];
    if (mn[p] >= pureLevel) pure[k]++;
  }

  const still = new Uint8Array(n + 1); // kept white (lettering)
  for (const k of keep) {
    const [cy, cx] = center(k);
    let d = 9;
    for (const hb of hubs) d = Math.min(d, Math.hypot(cy - hb.hy, cx - hb.hx) / Math.max(hb.r, 1));
    // 4) near a hub, or 4b) as pure as the studio white: background seen through a small gap
    // (under the saddle, through chainring or brake-disc holes). Printed lettering is duller.
    const isPure = pure[k] / area[k] >= 0.5 && sumMn[k] / area[k] >= pureLevel - 7;
    if (d < 0.47 || (d < 0.85 && ringBg[k] > 0.15) || isPure) bg[k] = 1;
    else still[k] = 1;
  }

  // Background mask
  const mask = new Uint8Array(N);
  const isStill = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const k = lab[p];
    mask[p] = k && bg[k] ? 1 : 0;
    isStill[p] = k && k <= n && still[k] ? 1 : 0;
  }

  // 5a) Light halo touching the background
  const near2 = dilate(mask, w, h, 2);
  for (let p = 0; p < N; p++) if (!mask[p] && near2[p] && !isStill[p] && mn[p] > 185 && mx[p] - mn[p] < 30) mask[p] = 1;

  // 5b) Floor shadow: light grey in the bottom strip, connected to the background
  let yTop = -1, yBot = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++)
      if (!mask[y * w + x]) {
        if (yTop < 0) yTop = y;
        yBot = y;
        break;
      }
  }
  if (yTop >= 0) {
    const bandTop = Math.floor(yBot - 0.07 * (yBot - yTop));
    const stack: number[] = [];
    for (let p = 0; p < N; p++) if (mask[p]) stack.push(p);
    const light = (p: number) => ((p / w) | 0) >= bandTop && mn[p] > 105 && mx[p] - mn[p] < 28;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q < 0 || q >= N || mask[q] || !light(q)) continue;
        mask[q] = 1;
        stack.push(q);
      }
    }
  }

  // 5c) Edge band: alpha from darkness, colour un-mixed from white (no white outline)
  const band = dilate(mask, w, h, 2);
  let bx0 = w, bx1 = -1, by0 = h, by1 = -1;
  for (let p = 0; p < N; p++) {
    const i = p * 4;
    let a = 1;
    if (mask[p]) a = 0;
    else if (band[p] && !isStill[p]) {
      a = Math.max(0, Math.min(1, (245 - mn[p]) / 140));
      const s = Math.max(a, 1e-3);
      for (let c = 0; c < 3; c++) px[i + c] = Math.max(0, Math.min(255, (px[i + c] - (1 - a) * 255) / s));
    }
    px[i + 3] = Math.round(a * 255);
    if (a > 0.05) {
      const x = p % w, y = (p / w) | 0;
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
    }
  }
  return bx1 < 0 ? { x: 0, y: 0, w, h } : { x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 };
}
