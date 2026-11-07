// Wholesale for the catalogue: dealers with private links, dealer prices, and dealer orders.
//
// Prices a dealer sees, in order:
//   1. a special price set for that dealer and product
//   2. the product's wholesale price for the dealer's level (A, B or C), less the dealer's % discount
//   3. nothing ("Ask for price") when the product has no price for that level
//
// Wholesale prices are never in the public product list; a dealer only gets them through an
// active private link (/d/<code>).
import { randomBytes } from "node:crypto";
import { json } from "./auth.mjs";

export const LEVELS = ["a", "b", "c"];
export const ORDER_STATUSES = ["new", "confirmed", "dispatched", "paid", "cancelled"];
const MAX_DEALERS = 500;
const MAX_ORDERS = 2000;
const MAX_ORDER_LINES = 100;
const CODE = /^[a-z0-9-]{6,48}$/;

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const intOrNull = (v, min, max) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : NaN;
};

/** Price for one dealer, or null for "Ask for price". */
export function dealerPrice(product, dealer) {
  const special = dealer.special?.[product.id];
  if (Number.isFinite(special)) return special;
  const base = product.wholesale?.[dealer.level];
  if (!Number.isFinite(base)) return null;
  return Math.round(base * (1 - (dealer.discount || 0) / 100));
}

/** Validate a product's wholesale fields. Returns [fields, error]. */
export function cleanWholesale(p, previous, where) {
  // An older admin page that doesn't know these fields must not wipe them
  const src = p.wholesale === undefined && previous ? previous : p;
  const wholesale = {};
  for (const l of LEVELS) {
    const v = intOrNull(src.wholesale?.[l], 0, 10000000);
    if (Number.isNaN(v)) return [null, `${where}: enter a valid level ${l.toUpperCase()} price (or leave it empty)`];
    wholesale[l] = v;
  }
  const minQty = intOrNull(src.minQty, 1, 100000);
  const packSize = intOrNull(src.packSize, 1, 10000);
  if (Number.isNaN(minQty)) return [null, `${where}: minimum order must be 1 or more (or empty)`];
  if (Number.isNaN(packSize)) return [null, `${where}: pack size must be 1 or more (or empty)`];
  return [{ wholesale, minQty, packSize }, null];
}

/** The product list for everyone: without wholesale prices and order rules. */
export function publicProducts(saved) {
  if (!saved?.products) return saved;
  return { ...saved, products: saved.products.map(({ wholesale, minQty, packSize, ...p }) => p) };
}

const newCode = (shop) => `${slug(shop).slice(0, 24) || "dealer"}-${randomBytes(4).toString("hex")}`;

/** Validate the dealer list. Returns [dealers, error]. New dealers (or "new link") get a fresh code. */
function cleanDealers(list, productIds) {
  if (!Array.isArray(list)) return [null, "Missing dealer list"];
  if (list.length > MAX_DEALERS) return [null, `At most ${MAX_DEALERS} dealers`];
  const ids = new Set();
  const codes = new Set();
  const out = [];
  for (const [i, d] of list.entries()) {
    const shop = text(d?.shop, 60);
    const where = `Dealer ${i + 1}${shop ? ` (${shop})` : ""}`;
    if (!shop) return [null, `${where}: shop name is required`];
    const id = text(d.id, 40) || randomBytes(6).toString("hex");
    if (!/^[a-z0-9-]+$/.test(id) || ids.has(id)) return [null, `${where}: invalid ID`];
    const level = LEVELS.includes(d.level) ? d.level : "a";
    const discount = Number(d.discount ?? 0);
    if (!Number.isFinite(discount) || discount < 0 || discount > 50) return [null, `${where}: discount must be between 0 and 50%`];
    const special = {};
    for (const [pid, price] of Object.entries(d.special && typeof d.special === "object" ? d.special : {})) {
      if (!productIds.has(pid)) continue; // product was deleted
      const v = intOrNull(price, 0, 10000000);
      if (Number.isNaN(v)) return [null, `${where}: special price for "${pid}" is not valid`];
      if (v !== null) special[pid] = v;
    }
    let code = text(d.code, 48).toLowerCase();
    if (!CODE.test(code) || codes.has(code)) code = newCode(shop);
    ids.add(id);
    codes.add(code);
    out.push({
      id,
      code,
      shop,
      owner: text(d.owner, 60),
      phone: text(d.phone, 20).replace(/[^\d+ ]/g, ""),
      city: text(d.city, 40),
      level,
      discount: Math.round(discount * 10) / 10,
      special,
      active: d.active !== false,
      notes: text(d.notes, 300),
      createdAt: text(d.createdAt, 30) || new Date().toISOString(),
    });
  }
  return [out, null];
}

const findDealer = async (store, code) => {
  const doc = await store.getJSON("dealers");
  return doc?.dealers?.find((d) => d.code === code && d.active) ?? null;
};

const inactive = () =>
  json({ error: "This dealer link isn't active. Please contact V Mount Bikes for a new link." }, 404, { "X-Robots-Tag": "noindex" });

const forDealer = (o) => ({ number: o.number, items: o.items, total: o.total, unpriced: o.unpriced, note: o.note, status: o.status, createdAt: o.createdAt });

/** Dealer link endpoints (public, need a valid code): /api/catalog/dealer/<code>[/order|/orders] */
export async function handleDealerLink(req, store, path) {
  const m = /^\/api\/catalog\/dealer\/([a-z0-9-]{6,48})(\/order|\/orders)?$/.exec(path);
  if (!m) return null;
  const dealer = await findDealer(store, m[1]);
  if (!dealer) return inactive();
  const saved = await store.getJSON("products");
  const products = (saved?.products ?? []).filter((p) => p.visible !== false);

  if (!m[2] && req.method === "GET") {
    const prices = {};
    for (const p of products) prices[p.id] = { price: dealerPrice(p, dealer), minQty: p.minQty ?? null, packSize: p.packSize ?? null };
    return json({ dealer: { shop: dealer.shop, owner: dealer.owner, city: dealer.city, level: dealer.level.toUpperCase() }, prices }, 200, { "X-Robots-Tag": "noindex" });
  }

  if (m[2] === "/orders" && req.method === "GET") {
    const doc = await store.getJSON("orders");
    const mine = (doc?.orders ?? []).filter((o) => o.dealerId === dealer.id).slice(0, 50).map(forDealer);
    return json({ orders: mine });
  }

  if (m[2] === "/order" && req.method === "POST") {
    const body = await req.json().catch(() => null);
    const lines = Array.isArray(body?.items) ? body.items : [];
    if (!lines.length) return json({ error: "Your order is empty" }, 400);
    if (lines.length > MAX_ORDER_LINES) return json({ error: `At most ${MAX_ORDER_LINES} products in one order` }, 400);
    const byId = new Map(products.map((p) => [p.id, p]));
    const items = [];
    for (const line of lines) {
      const p = byId.get(text(line?.id, 60));
      if (!p) return json({ error: "A product in your order is no longer available — please remove it and try again" }, 400);
      const qty = intOrNull(line.qty, 1, 100000);
      if (!qty) return json({ error: `Enter a quantity for ${p.name}` }, 400);
      if (p.minQty && qty < p.minQty) return json({ error: `${p.name}: minimum order is ${p.minQty} pcs` }, 400);
      if (p.packSize && qty % p.packSize) return json({ error: `${p.name}: order in packs of ${p.packSize} pcs` }, 400);
      const price = dealerPrice(p, dealer);
      items.push({ id: p.id, name: p.name, image: p.image, qty, price, lineTotal: price === null ? null : price * qty });
    }
    const doc = (await store.getJSON("orders")) ?? { next: 1, orders: [] };
    const now = new Date().toISOString();
    const order = {
      id: randomBytes(6).toString("hex"),
      number: `VM-${String(doc.next).padStart(4, "0")}`,
      dealerId: dealer.id,
      dealerShop: dealer.shop,
      dealerOwner: dealer.owner,
      dealerPhone: dealer.phone,
      dealerCity: dealer.city,
      level: dealer.level,
      items,
      total: items.reduce((s, i) => s + (i.lineTotal ?? 0), 0),
      unpriced: items.filter((i) => i.price === null).length,
      note: text(body.note, 500),
      status: "new",
      createdAt: now,
      updatedAt: now,
    };
    await store.setJSON("orders", { next: doc.next + 1, orders: [order, ...doc.orders].slice(0, MAX_ORDERS) });
    return json({ order: forDealer(order) });
  }

  return json({ error: "Not found" }, 404);
}

/** Staff endpoints (caller has already checked the login): dealers and orders. */
export async function handleWholesaleAdmin(req, store, path) {
  if (path === "/api/catalog/dealers" && req.method === "GET") {
    const doc = await store.getJSON("dealers");
    return json({ dealers: doc?.dealers ?? [] });
  }

  if (path === "/api/catalog/dealers" && req.method === "PUT") {
    const body = await req.json().catch(() => null);
    const saved = await store.getJSON("products");
    const [dealers, error] = cleanDealers(body?.dealers, new Set((saved?.products ?? []).map((p) => p.id)));
    if (error) return json({ error }, 400);
    await store.setJSON("dealers", { dealers, updatedAt: new Date().toISOString() });
    return json({ dealers });
  }

  if (path === "/api/catalog/orders" && req.method === "GET") {
    const doc = await store.getJSON("orders");
    return json({ orders: doc?.orders ?? [] });
  }

  const m = /^\/api\/catalog\/orders\/([a-f0-9]{12})$/.exec(path);
  if (m && req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    if (!ORDER_STATUSES.includes(body.status)) return json({ error: "Unknown order status" }, 400);
    const doc = await store.getJSON("orders");
    const order = doc?.orders?.find((o) => o.id === m[1]);
    if (!order) return json({ error: "Order not found" }, 404);
    order.status = body.status;
    if (typeof body.staffNote === "string") order.staffNote = text(body.staffNote, 500);
    order.updatedAt = new Date().toISOString();
    await store.setJSON("orders", doc);
    return json({ order });
  }

  return null;
}
