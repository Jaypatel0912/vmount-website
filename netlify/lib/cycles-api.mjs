// Cycle catalogue API, edited on the password-protected /cycles page.
//
//   GET    /api/cycles                   saved cycle list (public), or null if never saved
//   PUT    /api/cycles                   save the whole list (needs login)
//   POST   /api/cycles/image             upload a cycle photo (needs login) -> { url }
//   GET    /api/cycles/image/<name>      a cycle photo (public)
import { randomBytes } from "node:crypto";
import { decodeImage, isAuthorized, json, notConfigured } from "./auth.mjs";

const DEFAULT_CATEGORIES = ["Mountain", "Road", "City", "Hybrid", "Electric", "Kids"];
const MAX_TYPES = 30;
const MAX_CYCLES = 300;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Validate one cycle. Returns [cycle, error]. */
function cleanCycle(c, i, CATEGORIES) {
  const where = `Cycle ${i + 1}${c?.name ? ` (${String(c.name).slice(0, 40)})` : ""}`;
  if (!c || typeof c !== "object") return [null, `${where}: invalid`];
  const id = text(c.id, 60).toLowerCase();
  const name = text(c.name, 80);
  const image = text(c.image, 300);
  const price = Math.round(Number(c.price));
  const stock = c.stock === null || c.stock === "" || c.stock === undefined ? null : Math.round(Number(c.stock));
  if (!/^[a-z0-9-]+$/.test(id)) return [null, `${where}: the ID may only use lowercase letters, numbers and dashes`];
  if (!name) return [null, `${where}: name is required`];
  if (!CATEGORIES.includes(c.category)) return [null, `${where}: choose a type (category)`];
  if (!Number.isFinite(price) || price < 0 || price > 10000000) return [null, `${where}: enter a valid price`];
  if (stock !== null && (!Number.isFinite(stock) || stock < 0 || stock > 100000)) return [null, `${where}: stock must be 0 or more`];
  if (!/^\/(images|api\/cycles\/image)\//.test(image)) return [null, `${where}: add a photo`];
  return [
    {
      id,
      name,
      category: c.category,
      price,
      image,
      color: /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : "#f7941d",
      tag: text(c.tag, 24),
      specs: Array.isArray(c.specs) ? c.specs.map((s) => text(s, 40)).filter(Boolean).slice(0, 8) : [],
      stock,
      featured: !!c.featured,
      visible: c.visible !== false,
    },
    null,
  ];
}

/** Validate the list of cycle types. Returns [types, error]. */
function cleanTypes(list) {
  if (!Array.isArray(list) || !list.length) return [null, "Add at least one cycle type"];
  if (list.length > MAX_TYPES) return [null, `At most ${MAX_TYPES} cycle types`];
  const out = [];
  const ids = new Set();
  const names = new Set();
  for (const [i, t] of list.entries()) {
    const name = text(t?.name, 40);
    const id = text(t?.id, 50).toLowerCase() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!name) return [null, `Type ${i + 1}: name is required`];
    if (!/^[a-z0-9-]+$/.test(id)) return [null, `Type "${name}": invalid ID`];
    if (ids.has(id) || names.has(name.toLowerCase())) return [null, `Two types are both called "${name}"`];
    ids.add(id);
    names.add(name.toLowerCase());
    const image = text(t?.image, 300);
    out.push({
      id,
      name,
      description: text(t?.description, 140),
      color: /^#[0-9a-fA-F]{6}$/.test(t?.color) ? t.color : "#f7941d",
      ...(text(t?.icon, 8) ? { icon: text(t.icon, 8) } : {}),
      ...(text(t?.group, 40) ? { group: text(t.group, 40) } : {}),
      ...(image && /^\/(images|api\/cycles\/image)\//.test(image) ? { image } : {}),
    });
  }
  return [out, null];
}

export async function handleCycles(req, store, env) {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");

  if (path === "/api/cycles" && req.method === "GET") {
    const saved = await store.getJSON("catalog");
    return json(saved ?? { cycles: null }, 200, {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
    });
  }

  const img = /^\/api\/cycles\/image\/([a-z0-9-]+\.(?:webp|png|jpg))$/.exec(path);
  if (img && req.method === "GET") {
    const file = await store.getBytes(`img/${img[1]}`);
    if (!file) return new Response("Not found", { status: 404 });
    return new Response(file.data, {
      headers: { "Content-Type": file.type || "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  }

  if (!env.POSTER_PASSWORD) return notConfigured();
  if (!isAuthorized(req, env)) return json({ error: "Please log in again" }, 401);

  if (path === "/api/cycles/image" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const file = decodeImage(body.dataUrl, MAX_IMAGE_BYTES);
    if (!file) return json({ error: "The photo is missing or larger than 3 MB" }, 400);
    const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
    const base = text(body.name, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cycle";
    const name = `${base}-${Date.now().toString(36)}${randomBytes(3).toString("hex")}.${ext}`;
    await store.setBytes(`img/${name}`, file.bytes, file.type);
    return json({ url: `/api/cycles/image/${name}` });
  }

  if (path === "/api/cycles" && req.method === "PUT") {
    const body = await req.json().catch(() => null);
    if (!Array.isArray(body?.cycles)) return json({ error: "Missing cycle list" }, 400);
    const previous = await store.getJSON("catalog");
    let types = previous?.types ?? null;
    if (body.types !== undefined) {
      const [clean, error] = cleanTypes(body.types);
      if (error) return json({ error }, 400);
      types = clean;
    }
    const CATEGORIES = types ? types.map((t) => t.name) : DEFAULT_CATEGORIES;
    if (body.cycles.length > MAX_CYCLES) return json({ error: `At most ${MAX_CYCLES} cycles` }, 400);
    const cycles = [];
    const ids = new Set();
    for (const [i, c] of body.cycles.entries()) {
      const [clean, error] = cleanCycle(c, i, CATEGORIES);
      if (error) return json({ error }, 400);
      if (ids.has(clean.id)) return json({ error: `Two cycles use the ID "${clean.id}"` }, 400);
      ids.add(clean.id);
      cycles.push(clean);
    }
    const saved = { cycles, types, updatedAt: new Date().toISOString() };
    await store.setJSON("catalog", saved);
    return json(saved);
  }

  return json({ error: "Not found" }, 404);
}
