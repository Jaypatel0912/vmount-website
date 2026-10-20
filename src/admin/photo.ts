// Prepares an uploaded cycle photo in the browser: optional white-background removal
// (same method as scripts/remove-bg.py), trimming the empty edges, and resizing to WebP.
import { removeWhiteBackground } from "./cutout";

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

/** Returns a WebP data URL ready to upload. */
export async function preparePhoto(file: File, cutOut: boolean): Promise<string> {
  if (file.size > 25 * 1024 * 1024) throw new Error("This photo is very large (over 25 MB). Please use a smaller one.");
  const img = await loadFile(file);
  // Work at a moderate size so cleanup stays fast on phones
  const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  const ctx = work.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);

  let box = { x: 0, y: 0, w, h };
  if (cutOut) {
    // let the "Cleaning photo…" message paint before the heavy work
    await new Promise((r) => setTimeout(r, 30));
    const data = ctx.getImageData(0, 0, w, h);
    box = removeWhiteBackground(data);
    ctx.putImageData(data, 0, 0);
  }

  const s = Math.min(1, MAX_SIDE / Math.max(box.w, box.h));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(box.w * s));
  out.height = Math.max(1, Math.round(box.h * s));
  out.getContext("2d")!.drawImage(work, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);
  return out.toDataURL("image/webp", 0.9);
}
