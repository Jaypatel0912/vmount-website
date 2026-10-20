// Festival offer API, shared by the Netlify function (production) and the Vite
// dev server (local testing). Storage is passed in, so the same code works with
// Netlify Blobs online and with plain files on your computer.
//
//   GET    /api/festival                    published offer (public)
//   GET    /api/festival/poster/<size>      published poster image (public)
//   POST   /api/festival/login              { password } -> { token }
//   PUT    /api/festival                    publish offer + posters (needs token)
//   DELETE /api/festival                    remove the offer from the website (needs token)
import { decodeImage as decode, handleLogin, isAuthorized, json, notConfigured } from "./auth.mjs";

const SIZES = ["square", "story", "wide"];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Check and tidy the offer sent by the poster page. Returns [festival, error]. */
function cleanFestival(f) {
  if (!f || typeof f !== "object") return [null, "Missing offer details"];
  const greeting = f.mode === "greeting";
  const percent = f.discountType === "percent";
  const out = {
    mode: greeting ? "greeting" : "offer",
    id: text(f.id, 60).toLowerCase().replace(/[^a-z0-9-]/g, "-") || "festival",
    name: text(f.name, 60),
    greeting: text(f.greeting, 60),
    greetingLocal: text(f.greetingLocal, 80),
    headline: text(f.headline, 80),
    subline: text(f.subline, 300),
    start: f.start,
    end: f.end,
    appliesTo: greeting || f.appliesTo === "all" ? "all" : "selected",
    discountType: percent ? "percent" : "flat",
    discountValue: greeting ? 0 : Math.max(0, Math.min(Number(f.discountValue) || 0, percent ? 90 : 1000000)),
    extras: text(f.extras, 100),
    terms: text(f.terms, 300),
    design: text(f.design, 30) || "royal",
    bikes: !greeting && Array.isArray(f.bikes)
      ? f.bikes
          .slice(0, 100)
          .map((b) => ({ id: text(b?.id, 60), offerPrice: Math.max(0, Number(b?.offerPrice) || 0) }))
          .filter((b) => b.id)
      : [],
    posterBikes: Array.isArray(f.posterBikes) ? f.posterBikes.slice(0, 3).map((id) => text(id, 60)).filter(Boolean) : [],
  };
  if (!out.name) return [null, "Festival name is required"];
  if (!out.headline) return [null, "Headline is required"];
  if (!out.subline) return [null, greeting ? "Message is required" : "Description is required"];
  if (!isDate(out.start) || !isDate(out.end)) return [null, "Start and end dates are required"];
  if (out.end < out.start) return [null, "End date must be on or after the start date"];
  if (out.appliesTo === "selected" && !out.bikes.length) return [null, "Pick at least one cycle for the offer"];
  return [out, null];
}

const decodeImage = (dataUrl) => decode(dataUrl, MAX_IMAGE_BYTES);

export async function handleFestival(req, store, env) {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");

  // Public: the published offer (the website decides by date whether to show it)
  if (path === "/api/festival" && req.method === "GET") {
    const festival = (await store.getJSON("current")) ?? null;
    return json({ festival }, 200, {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, s-maxage=20, stale-while-revalidate=60",
    });
  }

  const poster = /^\/api\/festival\/poster\/(square|story|wide)$/.exec(path);
  if (poster && req.method === "GET") {
    const img = await store.getBytes(`poster-${poster[1]}`);
    if (!img) return new Response("Not found", { status: 404 });
    return new Response(img.data, {
      headers: { "Content-Type": img.type || "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  }

  if (path === "/api/festival/login" && req.method === "POST") return handleLogin(req, env);
  if (!env.POSTER_PASSWORD) return notConfigured();

  if (path === "/api/festival" && (req.method === "PUT" || req.method === "DELETE")) {
    if (!isAuthorized(req, env)) return json({ error: "Please log in again" }, 401);

    if (req.method === "DELETE") {
      await store.delete("current");
      for (const s of SIZES) await store.delete(`poster-${s}`);
      return json({ ok: true });
    }

    const body = await req.json().catch(() => null);
    const [festival, error] = cleanFestival(body?.festival);
    if (error) return json({ error }, 400);

    const images = {};
    for (const s of SIZES) {
      const img = decodeImage(body?.posters?.[s]);
      if (!img) return json({ error: `Poster image (${s}) is missing or too large` }, 400);
      images[s] = img;
    }
    for (const s of SIZES) await store.setBytes(`poster-${s}`, images[s].bytes, images[s].type);

    const version = Date.now();
    festival.posters = Object.fromEntries(SIZES.map((s) => [s, `/api/festival/poster/${s}?v=${version}`]));
    festival.publishedAt = new Date(version).toISOString();
    await store.setJSON("current", festival);
    return json({ festival });
  }

  return json({ error: "Not found" }, 404);
}
