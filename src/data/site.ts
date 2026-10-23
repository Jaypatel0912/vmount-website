// Business info lives in src/content/settings.json (admin panel: /admin).
// Cycles are managed on the password-protected /cycles page and loaded from
// /api/cycles before the page draws; src/content/products.json is the fallback.
import settings from "../content/settings.json";
import productData from "../content/products.json";

const b = settings.business;

export const brand = {
  ...b,
  catalog: `https://wa.me/c/${b.whatsapp}`,
  instagram: b.instagramUrl,
  google: {
    rating: b.googleRating,
    reviews: b.googleReviews,
    url: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(b.googleMapsQuery),
  },
};

/** A cycle type (category) shown as a card in "Shop by type". Editable on /cycles → Types. */
export type CycleType = {
  id: string;
  name: string;
  description: string;
  color: string;
  /** Optional cover photo; otherwise a cycle of this type is used. */
  image?: string;
};
export type Category = string;

export const DEFAULT_TYPES: CycleType[] = [
  { id: "mountain", name: "Mountain", description: "Built for rough roads, trails and weekend adventures.", color: "#3ddc84" },
  { id: "road", name: "Road", description: "Lightweight speed machines with drop bars and 700C wheels.", color: "#f7941d" },
  { id: "city", name: "City", description: "Comfortable everyday rides for school, work and the market.", color: "#3aa0ff" },
  { id: "hybrid", name: "Hybrid", description: "Road speed and city comfort in one bike.", color: "#c084fc" },
  { id: "electric", name: "Electric", description: "Pedal-assist e-bikes that make every ride effortless.", color: "#2ee6c5" },
  { id: "kids", name: "Kids", description: "Safe, fun first bikes for little riders.", color: "#ffd23d" },
];

/** All cycle types in display order (including ones with no cycles yet). */
export const cycleTypes: CycleType[] = DEFAULT_TYPES.map((t) => ({ ...t }));
/** Type names, in order. */
export const categories: string[] = cycleTypes.map((t) => t.name);

export type Product = {
  id: string;
  name: string;
  category: Category;
  price: number;
  image: string;
  color: string;
  tag?: string;
  specs: string[];
  featured?: boolean;
  visible?: boolean;
  /** Units in stock; null/undefined = not tracked. 0 shows "Out of stock". */
  stock?: number | null;
};

/** Every cycle, including hidden ones (for the /cycles manager). */
export const allProducts: Product[] = [...(productData.products as Product[])];
/** Cycles shown on the website. */
export const products: Product[] = [];
/** Bikes shown in the 360° showroom ring. */
export const showcase: Product[] = [];
/** Bikes shown in the top banner, in the order set in the admin. */
export const heroBikes: Product[] = [];

const fill = <T,>(target: T[], items: T[]) => void target.splice(0, target.length, ...items);

function derive() {
  fill(categories, cycleTypes.map((t) => t.name));
  fill(products, allProducts.filter((p) => p.visible !== false));
  const featured = products.filter((p) => p.featured);
  fill(showcase, (featured.length >= 3 ? featured : products).slice(0, 12));
  const banner = settings.hero.bikes.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p);
  // In-stock bikes first in the banner
  fill(heroBikes, (banner.length ? banner : products.slice(0, 4)).filter((p) => p.stock !== 0));
  if (!heroBikes.length) fill(heroBikes, products.slice(0, 4));
}
derive();

/** Replace the catalogue (called once at start-up with the list saved on /cycles). */
export function setCatalog(list: Product[], types?: CycleType[] | null) {
  fill(allProducts, list);
  if (types?.length) fill(cycleTypes, types);
  // Any category used by a cycle but missing from the type list still gets a card
  for (const p of list) {
    if (!cycleTypes.some((t) => t.name === p.category)) {
      cycleTypes.push({ id: slugify(p.category), name: p.category, description: "", color: "#f7941d" });
    }
  }
  derive();
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

/** Cycles of one type that are shown on the website. */
export const cyclesOfType = (t: CycleType) => products.filter((p) => p.category === t.name);

/** Cover photo for a type card: its own photo, else a showroom cycle, else any in-stock cycle of that type. */
export function typeCover(t: CycleType) {
  if (t.image) return t.image;
  const list = cyclesOfType(t);
  return (list.find((p) => p.featured && p.stock !== 0) ?? list.find((p) => p.stock !== 0) ?? list[0])?.image;
}

/** Load the saved cycle list; keeps the built-in list if the server is slow or unreachable. */
export async function loadCatalog(timeoutMs = 2500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch("/api/cycles", { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!r.ok || !r.headers.get("content-type")?.includes("json")) return;
    const { cycles, types } = (await r.json()) as { cycles: Product[] | null; types?: CycleType[] | null };
    if (Array.isArray(cycles) && cycles.length) setCatalog(cycles, types);
    else if (types?.length) setCatalog([...allProducts], types);
  } catch {
    // offline or slow: keep the built-in list
  } finally {
    clearTimeout(timer);
  }
}

export const { hero, promo, features, stats, testimonials, reels } = settings;

/** WhatsApp chat link with a pre-filled message. */
export const waLink = (text: string) => `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(text)}`;

export const mapEmbed = `https://www.google.com/maps?q=${encodeURIComponent(b.googleMapsQuery + ", " + b.address)}&output=embed`;
