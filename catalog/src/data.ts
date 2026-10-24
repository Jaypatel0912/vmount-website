// Catalogue data for the standalone VMount catalogue site.
// Products live in products.json; business details come from the main site's settings.
import settings from "../../src/content/settings.json";
import productData from "./products.json";

export const business = {
  ...settings.business,
  name: "V Mount Bikes",
};

export type Catalogue = {
  id: string;
  title: string;
  /** Short line under the title. */
  blurb: string;
  /** Accent colour for the tile. */
  color: string;
  /** Short text or emoji: shown on the tile and page header. */
  badge?: string;
  /** Optional cover photo; otherwise the first in-stock product's photo is used. */
  image?: string;
  /** false hides the collection from the public catalogue. */
  visible?: boolean;
};

export type Group = { id: string; title: string; subtitle: string; catalogues: Catalogue[] };

export type Product = {
  id: string;
  name: string;
  /** Catalogue ids this product appears in. */
  catalogues: string[];
  /** Main photo (always the first of `images`). */
  image: string;
  /** All photos, main first. Older saved products only have `image`. */
  images?: string[];
  specs: string[];
  tag?: string;
  /** Price in ₹; empty shows "Ask for price". */
  price?: number | null;
  /** Units in stock; empty = not tracked, 0 = "Out of stock". */
  stock?: number | null;
  /** false hides the product from the public catalogue. */
  visible?: boolean;
};

/** Built-in collections, used until they are first saved on /admin. */
export const builtInGroups: Group[] = [
  {
    id: "cycles",
    title: "Cycles",
    subtitle: "Pick a wheel size — from first rides to 29er mountain bikes",
    catalogues: [
      { id: "size-14", title: '14" Cycles', blurb: "Ages 3–5 · first pedal bike", color: "#ff8fb1", badge: '14"' },
      { id: "size-16", title: '16" Cycles', blurb: "Ages 4–7 · with trainer wheels", color: "#ffb020", badge: '16"' },
      { id: "size-20", title: '20" Cycles', blurb: "Ages 6–10 · kids & fat-tyre", color: "#22c1dc", badge: '20"' },
      { id: "size-24", title: '24" Cycles', blurb: "Ages 9–13 · teen MTB", color: "#3aa0ff", badge: '24"' },
      { id: "size-26", title: '26" Cycles', blurb: "Teens & adults · mountain", color: "#2f6bff", badge: '26"' },
      { id: "size-27-5", title: '27.5" Cycles', blurb: "Adults · all-terrain", color: "#16a34a", badge: '27.5"' },
      { id: "size-29", title: '29" Cycles', blurb: "Tall riders · big wheels", color: "#e11d48", badge: '29"' },
      { id: "size-700c", title: "700c Cycles", blurb: "City & hybrid · fast rolling", color: "#ef4444", badge: "700c" },
      { id: "gear-cycle", title: "Gear Cycles", blurb: "Multi-speed for hills & highways", color: "#f7941d", badge: "⚙" },
    ],
  },
  {
    id: "kids",
    title: "Kids & Toys",
    subtitle: "Walkers, ride-ons and battery-operated rides for little ones",
    catalogues: [
      { id: "walker", title: "Walker", blurb: "Baby walkers with music & toys", color: "#ff8fb1", badge: "👶" },
      { id: "tricycle", title: "Tricycle", blurb: "Basic, handle & hood tricycles", color: "#ffb020", badge: "🚲" },
      { id: "rider", title: "Rider", blurb: "Push-along ride-ons & horses", color: "#7cc576", badge: "🐎" },
      { id: "panda", title: "Panda", blurb: "Panda walkers, riders & trikes", color: "#64748b", badge: "🐼" },
      { id: "kick-bike", title: "Kick Bike", blurb: "Runners & kick scooters", color: "#3aa0ff", badge: "🛴" },
      { id: "jeep", title: "Jeep", blurb: "Battery-operated jeeps", color: "#16a34a", badge: "🚙" },
      { id: "kids-bike", title: "Bike", blurb: "Battery-operated kids bikes", color: "#ef4444", badge: "🏍️" },
      { id: "scooty", title: "Scooty", blurb: "Battery-operated scooties & vespas", color: "#a855f7", badge: "🛵" },
    ],
  },
];

/** Every group and collection, including hidden ones (for /admin). */
export const allGroups: Group[] = structuredClone(builtInGroups);
/** Groups shown publicly: only visible collections, and only groups that still have some. */
export const groups: Group[] = [];
/** Visible collections, in order. */
export const catalogues: Catalogue[] = [];

function deriveGroups() {
  const shown = allGroups.map((g) => ({ ...g, catalogues: g.catalogues.filter((c) => c.visible !== false) })).filter((g) => g.catalogues.length);
  groups.splice(0, groups.length, ...shown);
  catalogues.splice(0, catalogues.length, ...shown.flatMap((g) => g.catalogues));
}
deriveGroups();

export function setGroups(list: Group[]) {
  allGroups.splice(0, allGroups.length, ...list);
  deriveGroups();
}
/** Built-in list, used until the first save on /admin. */
export const builtInProducts: Product[] = productData.products as Product[];
/** Every product, including hidden ones (for /admin). */
export const allProducts: Product[] = [...builtInProducts];
/** Products shown in the public catalogue. */
export const products: Product[] = allProducts.filter((p) => p.visible !== false);

export function setProducts(list: Product[]) {
  allProducts.splice(0, allProducts.length, ...list);
  products.splice(0, products.length, ...list.filter((p) => p.visible !== false));
}

/** Load the list saved on /admin; keeps the built-in list if the server is slow or unreachable. */
export async function loadCatalog(timeoutMs = 2500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch("/api/catalog", { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!r.ok || !r.headers.get("content-type")?.includes("json")) return;
    const saved = (await r.json()) as { products: Product[] | null; groups?: Group[] | null };
    if (Array.isArray(saved.groups) && saved.groups.length) setGroups(saved.groups);
    if (Array.isArray(saved.products)) setProducts(saved.products);
  } catch {
    // offline or slow: keep the built-in list
  } finally {
    clearTimeout(timer);
  }
}

/** Every photo of a product, main first. */
export const photosOf = (p: Product) => (p.images?.length ? p.images : p.image ? [p.image] : []);

/** Full web address of a page path or photo on this site (for WhatsApp messages). */
export const absolute = (path: string) => new URL(path, window.location.origin).href;
/** Link that opens this product in the catalogue. */
export const productLink = (p: Product, cat: string) => absolute(`/#/c/${cat}/${p.id}`);

export const isOut = (p: Product) => p.stock === 0;
export const isLow = (p: Product) => typeof p.stock === "number" && p.stock > 0 && p.stock <= 3;

export const findCatalogue = (id: string) => catalogues.find((c) => c.id === id);
export const groupOf = (c: Catalogue) => groups.find((g) => g.catalogues.some((x) => x.id === c.id))!;
export const productsIn = (id: string) => products.filter((p) => p.catalogues.includes(id));
export const coverOf = (id: string) => {
  const own = findCatalogue(id)?.image;
  if (own) return own;
  const list = productsIn(id);
  return (list.find((p) => p.stock !== 0) ?? list[0])?.image;
};
/** First visible collection a product belongs to (for links from search). */
export const homeOf = (p: Product) => p.catalogues.find((c) => findCatalogue(c));

/** Loose search: every word must appear in the name, specs or catalogue title. */
export function search(q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return products.filter((p) => {
    if (!homeOf(p)) return false;
    const hay = [p.name, ...p.specs, ...p.catalogues.map((c) => findCatalogue(c)?.title ?? "")].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const waLink = (text: string) => `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(text)}`;
