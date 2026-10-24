// Product list for the standalone catalogue site, edited on its password-protected /admin page.
//
//   GET    /api/catalog                  saved products (public), or { products: null } if never saved
//   POST   /api/catalog/login            { password } -> { token }
//   PUT    /api/catalog                  save { products, groups } (needs login)
//   POST   /api/catalog/image            upload a product photo (needs login) -> { url }
//   GET    /api/catalog/image/<name>     a product photo (public)
//
// Password, in order: CATALOG_PASSWORD, then POSTER_PASSWORD (the main site's staff password), and if
// neither is set (the usual case for the separate catalogue site) the password is checked with the main
// website's own login (MAIN_SITE_URL, default https://vmount-cycle.netlify.app) — so it is always the same.
// Login tokens are signed with POSTER_SECRET, or a random key created and stored on first use.
import { randomBytes } from "node:crypto";
import { decodeImage, handleLogin, isAuthorized, json } from "./auth.mjs";

const MAIN_SITE = "https://vmount-cycle.netlify.app";

const MAX_PRODUCTS = 1000;
const MAX_GROUPS = 12;
const MAX_COLLECTIONS = 80;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const SLUG = /^[a-z0-9-]+$/;
const IMAGE = /^\/(images|api\/catalog\/image)\//;
const COLOR = /^#[0-9a-fA-F]{6}$/;

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const optionalInt = (v, max) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= max ? n : NaN;
};

/** Validate one product. Returns [product, error]. */
function cleanProduct(p, i) {
  const where = `Product ${i + 1}${p?.name ? ` (${String(p.name).slice(0, 40)})` : ""}`;
  if (!p || typeof p !== "object") return [null, `${where}: invalid`];
  const id = text(p.id, 60).toLowerCase();
  const name = text(p.name, 90);
  const image = text(p.image, 300);
  const catalogues = Array.isArray(p.catalogues) ? [...new Set(p.catalogues.map((c) => text(c, 40)).filter((c) => SLUG.test(c)))].slice(0, 10) : [];
  const price = optionalInt(p.price, 10000000);
  const stock = optionalInt(p.stock, 100000);
  if (!SLUG.test(id)) return [null, `${where}: invalid ID`];
  if (!name) return [null, `${where}: name is required`];
  if (!catalogues.length) return [null, `${where}: choose at least one collection`];
  if (Number.isNaN(price)) return [null, `${where}: enter a valid price (or leave it empty)`];
  if (Number.isNaN(stock)) return [null, `${where}: stock must be 0 or more (or empty)`];
  if (!IMAGE.test(image)) return [null, `${where}: add a photo`];
  return [
    {
      id,
      name,
      catalogues,
      image,
      specs: Array.isArray(p.specs) ? p.specs.map((s) => text(s, 60)).filter(Boolean).slice(0, 10) : [],
      tag: text(p.tag, 24),
      price,
      stock,
      visible: p.visible !== false,
    },
    null,
  ];
}

/** Validate the groups of collections. Returns [groups, error]. */
function cleanGroups(list) {
  if (!Array.isArray(list) || !list.length) return [null, "Add at least one group"];
  if (list.length > MAX_GROUPS) return [null, `At most ${MAX_GROUPS} groups`];
  const ids = new Set();
  const out = [];
  let total = 0;
  for (const [i, g] of list.entries()) {
    const title = text(g?.title, 40);
    const id = text(g?.id, 40).toLowerCase();
    if (!title) return [null, `Group ${i + 1}: name is required`];
    if (!SLUG.test(id) || ids.has(`g:${id}`)) return [null, `Group "${title}": invalid or duplicate ID`];
    ids.add(`g:${id}`);
    const catalogues = [];
    for (const c of Array.isArray(g.catalogues) ? g.catalogues : []) {
      const ct = text(c?.title, 40);
      const cid = text(c?.id, 40).toLowerCase();
      if (!ct) return [null, `${title}: every collection needs a name`];
      if (!SLUG.test(cid) || ids.has(cid)) return [null, `Collection "${ct}": invalid or duplicate ID`];
      ids.add(cid);
      const image = text(c?.image, 300);
      catalogues.push({
        id: cid,
        title: ct,
        blurb: text(c?.blurb, 80),
        color: COLOR.test(c?.color) ? c.color : "#f7941d",
        badge: text(c?.badge, 8),
        ...(image && IMAGE.test(image) ? { image } : {}),
        visible: c?.visible !== false,
      });
    }
    total += catalogues.length;
    out.push({ id, title, subtitle: text(g?.subtitle, 120), catalogues });
  }
  if (total > MAX_COLLECTIONS) return [null, `At most ${MAX_COLLECTIONS} collections`];
  return [out, null];
}

/** Key used to sign login tokens: POSTER_SECRET if set, otherwise a random one kept in storage. */
async function signingSecret(store, env) {
  if (env.POSTER_SECRET) return env.POSTER_SECRET;
  const saved = await store.getJSON("auth-secret");
  if (saved?.secret) return saved.secret;
  const secret = randomBytes(32).toString("hex");
  await store.setJSON("auth-secret", { secret });
  return secret;
}

/** Check the password with the main website's staff login, then issue this site's own token. */
async function loginWithMainSite(req, mainSite, secret) {
  const body = await req.json().catch(() => ({}));
  const pw = typeof body.password === "string" ? body.password : "";
  let r;
  try {
    r = await fetch(`${mainSite.replace(/\/+$/, "")}/api/festival/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return json({ error: "Couldn't check the password with the main VMount website — please try again" }, 502);
  }
  if (r.status === 401) return json({ error: "Wrong password" }, 401);
  if (!r.ok) return json({ error: "The main VMount website's login isn't working right now — please try again later" }, 502);
  // Correct: sign a token for this site (handleLogin compares the password with itself here)
  const again = new Request(req.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
  return handleLogin(again, { POSTER_PASSWORD: pw, POSTER_SECRET: secret });
}

export async function handleCatalog(req, store, rawEnv) {
  const password = rawEnv.CATALOG_PASSWORD || rawEnv.POSTER_PASSWORD;
  const path = new URL(req.url).pathname.replace(/\/+$/, "");

  if (path === "/api/catalog" && req.method === "GET") {
    const saved = await store.getJSON("products");
    return json(saved ?? { products: null }, 200, {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, s-maxage=10, stale-while-revalidate=60",
    });
  }

  const img = /^\/api\/catalog\/image\/([a-z0-9-]+\.(?:webp|png|jpg))$/.exec(path);
  if (img && req.method === "GET") {
    const file = await store.getBytes(`img/${img[1]}`);
    if (!file) return new Response("Not found", { status: 404 });
    return new Response(file.data, {
      headers: { "Content-Type": file.type || "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  }

  const secret = await signingSecret(store, rawEnv);
  if (path === "/api/catalog/login" && req.method === "POST") {
    if (password) return handleLogin(req, { POSTER_PASSWORD: password, POSTER_SECRET: secret });
    return loginWithMainSite(req, rawEnv.MAIN_SITE_URL || MAIN_SITE, secret);
  }

  // isAuthorized only needs the password to be "set"; the token check itself uses the secret
  if (!isAuthorized(req, { POSTER_PASSWORD: password || "main-site", POSTER_SECRET: secret })) return json({ error: "Please log in again" }, 401);

  if (path === "/api/catalog/image" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const file = decodeImage(body.dataUrl, MAX_IMAGE_BYTES);
    if (!file) return json({ error: "The photo is missing or larger than 3 MB" }, 400);
    const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
    const base = text(body.name, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";
    const name = `${base}-${Date.now().toString(36)}${randomBytes(3).toString("hex")}.${ext}`;
    await store.setBytes(`img/${name}`, file.bytes, file.type);
    return json({ url: `/api/catalog/image/${name}` });
  }

  if (path === "/api/catalog" && req.method === "PUT") {
    const body = await req.json().catch(() => null);
    if (!Array.isArray(body?.products)) return json({ error: "Missing product list" }, 400);
    if (body.products.length > MAX_PRODUCTS) return json({ error: `At most ${MAX_PRODUCTS} products` }, 400);
    const previous = await store.getJSON("products");
    let groups = previous?.groups ?? null;
    if (body.groups !== undefined) {
      const [clean, error] = cleanGroups(body.groups);
      if (error) return json({ error }, 400);
      groups = clean;
    }
    const known = groups ? new Set(groups.flatMap((g) => g.catalogues.map((c) => c.id))) : null;
    const products = [];
    const ids = new Set();
    for (const [i, p] of body.products.entries()) {
      const [clean, error] = cleanProduct(p, i);
      if (error) return json({ error }, 400);
      if (ids.has(clean.id)) return json({ error: `Two products use the ID "${clean.id}"` }, 400);
      if (known) {
        clean.catalogues = clean.catalogues.filter((c) => known.has(c));
        if (!clean.catalogues.length) return json({ error: `"${clean.name}" is not in any existing collection` }, 400);
      }
      ids.add(clean.id);
      products.push(clean);
    }
    const saved = { products, groups, updatedAt: new Date().toISOString() };
    await store.setJSON("products", saved);
    return json(saved);
  }

  return json({ error: "Not found" }, 404);
}
