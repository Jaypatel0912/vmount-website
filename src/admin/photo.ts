// Prepares an uploaded cycle photo in the browser: optional white-background removal,
// trimming the empty edges, and resizing to a web-friendly WebP.
// (For difficult photos, scripts/remove-bg.py gives a more careful cut-out.)

const MAX_SIDE = 1000;

function loadFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => reject(new Error("This file is not an image we can read"));
    img.src = url;
  });
}

/** Clear near-white pixels connected to the photo's edge (the studio background). */
function removeWhite(data: ImageData) {
  const { width: w, height: h, data: px } = data;
  const isWhite = (i: number) => {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const mn = Math.min(r, g, b);
    return mn > 218 && Math.max(r, g, b) - mn < 30;
  };
  const bg = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const push = (p: number) => {
    if (!bg[p] && isWhite(p * 4)) {
      bg[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (bg[p]) {
      px[i + 3] = 0;
      continue;
    }
    // Soften the edge: light pixels touching the background fade out (no white outline)
    const x = p % w;
    const touches = (x > 0 && bg[p - 1]) || (x < w - 1 && bg[p + 1]) || (p >= w && bg[p - w]) || (p < w * (h - 1) && bg[p + w]);
    if (touches) {
      const mn = Math.min(px[i], px[i + 1], px[i + 2]);
      const a = Math.max(0, Math.min(1, (245 - mn) / 120));
      if (a < 1) {
        px[i + 3] = Math.round(a * 255);
        for (let c = 0; c < 3; c++) px[i + c] = Math.max(0, Math.min(255, (px[i + c] - (1 - a) * 255) / Math.max(a, 0.05)));
      }
    }
  }
}

/** Bounding box of the visible pixels. */
function trimBox(data: ImageData) {
  const { width: w, height: h, data: px } = data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? { x: 0, y: 0, w, h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Returns a WebP data URL ready to upload. */
export async function preparePhoto(file: File, cutOut: boolean): Promise<string> {
  if (file.size > 25 * 1024 * 1024) throw new Error("This photo is very large (over 25 MB). Please use a smaller one.");
  const img = await loadFile(file);
  // Work at a moderate size so cleanup stays fast on phones
  const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  const ctx = work.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);

  let box = { x: 0, y: 0, w, h };
  if (cutOut) {
    const data = ctx.getImageData(0, 0, w, h);
    removeWhite(data);
    ctx.putImageData(data, 0, 0);
    box = trimBox(data);
  }

  const s = Math.min(1, MAX_SIDE / Math.max(box.w, box.h));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(box.w * s));
  out.height = Math.max(1, Math.round(box.h * s));
  out.getContext("2d")!.drawImage(work, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);
  return out.toDataURL("image/webp", 0.9);
}
