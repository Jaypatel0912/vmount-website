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

export const categories = ["Mountain", "Road", "City", "Hybrid", "Electric", "Kids"] as const;
export type Category = (typeof categories)[number];

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
export function setCatalog(list: Product[]) {
  fill(allProducts, list);
  derive();
}

/** Load the saved cycle list; keeps the built-in list if the server is slow or unreachable. */
export async function loadCatalog(timeoutMs = 2500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch("/api/cycles", { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!r.ok || !r.headers.get("content-type")?.includes("json")) return;
    const { cycles } = (await r.json()) as { cycles: Product[] | null };
    if (Array.isArray(cycles) && cycles.length) setCatalog(cycles);
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
