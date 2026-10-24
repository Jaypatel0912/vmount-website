// Sending product photos to WhatsApp.
//
// A wa.me link can only carry text, so photos go through the phone's own share menu
// (Web Share API): the customer picks WhatsApp and then the VMount chat.

const MAX_FILES = 10;

/** True when this browser can share image files (most phones; some desktops). */
export function canSharePhotos() {
  try {
    const probe = new File([new Uint8Array(1)], "probe.jpg", { type: "image/jpeg" });
    return typeof navigator.share === "function" && !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

/** Load a photo and re-encode it as a JPEG on white (WebP can arrive in WhatsApp as a sticker). */
async function toJpeg(url: string, name: string): Promise<File> {
  const blob = await (await fetch(url)).blob();
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpeg = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't prepare a photo"))), "image/jpeg", 0.88));
  const safe = name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "photo";
  return new File([jpeg], `${safe}.jpg`, { type: "image/jpeg" });
}

export type ShareResult = "shared" | "cancelled" | "unsupported";

/**
 * Open the share menu with the photos and the message.
 * The message is also copied, because some apps drop the text when several photos are shared.
 */
export async function sharePhotos(photos: { url: string; name: string }[], text: string): Promise<ShareResult> {
  if (!canSharePhotos()) return "unsupported";
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    // copying is only a convenience
  }
  const files = await Promise.all(photos.slice(0, MAX_FILES).map((p, i) => toJpeg(p.url, `${i + 1}-${p.name}`)));
  if (!navigator.canShare?.({ files })) return "unsupported";
  try {
    await navigator.share({ files, text });
    return "shared";
  } catch (err) {
    if ((err as Error).name === "AbortError") return "cancelled";
    throw err;
  }
}
