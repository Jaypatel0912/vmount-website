// Festival offers are created and published on the password-protected /poster page.
// The published offer is read from /api/festival (Netlify function + Netlify Blobs).
import { products, type Product } from "./site";

export type FestivalBikeRef = { id: string; offerPrice?: number };

export type Festival = {
  id: string;
  /** "offer" shows prices and discounts; "greeting" is a festival wish with no offer. */
  mode?: "offer" | "greeting";
  name: string;
  greeting: string;
  greetingLocal?: string;
  headline: string;
  subline: string;
  start: string; // YYYY-MM-DD, first day the offer shows on the website
  end: string; // YYYY-MM-DD, last day
  appliesTo: "all" | "selected";
  discountType: "flat" | "percent";
  discountValue: number;
  extras?: string;
  terms?: string;
  design: string;
  bikes: FestivalBikeRef[];
  posterBikes?: string[];
  posters?: { square: string; story: string; wide: string };
  publishedAt?: string;
};

export type OfferBike = Product & { offerPrice: number; save: number };

export const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function discounted(f: Pick<Festival, "discountType" | "discountValue">, price: number) {
  const v = Math.max(0, f.discountValue || 0);
  const p = f.discountType === "percent" ? Math.round(price * (1 - Math.min(v, 90) / 100)) : price - v;
  return Math.max(0, Math.min(price, p));
}

/** Bikes in the offer with their festival price (own price, or the default discount). */
export function offerBikes(f: Festival): OfferBike[] {
  if (f.mode === "greeting") return [];
  const withPrice = (p: Product, override?: number): OfferBike => {
    const offerPrice = override && override > 0 ? Math.min(override, p.price) : discounted(f, p.price);
    return { ...p, offerPrice, save: p.price - offerPrice };
  };
  if (f.appliesTo === "all") {
    const overrides = new Map(f.bikes.map((b) => [b.id, b.offerPrice]));
    return products.map((p) => withPrice(p, overrides.get(p.id)));
  }
  return f.bikes.flatMap((ref) => {
    const p = products.find((x) => x.id === ref.id);
    return p ? [withPrice(p, ref.offerPrice)] : [];
  });
}

/** Burst-badge text for posters: "FLAT 15% OFF", "SAVE UP TO ₹3,000", or a free gift. */
export function badgeFor(f: Festival, offers: OfferBike[]) {
  if (f.mode === "greeting") return null;
  const best = offers.reduce((m, o) => Math.max(m, o.save), 0);
  if (f.appliesTo === "all" && f.discountValue > 0) {
    return { top: "FLAT", value: f.discountType === "percent" ? `${f.discountValue}% OFF` : `${inr.format(f.discountValue)} OFF` };
  }
  if (best > 0) {
    const same = offers.every((o) => o.save === best);
    return { top: same ? "SAVE" : "SAVE UP TO", value: inr.format(best) };
  }
  return f.extras ? { top: "FREE", value: "GIFT" } : null;
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const isRunning = (f: Festival, today = todayISO()) => f.start <= today && today <= f.end;
export const festivalEnds = (f: Festival) => new Date(`${f.end}T23:59:59`);
export const formatDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export async function fetchFestival(): Promise<Festival | null> {
  const r = await fetch("/api/festival", { headers: { Accept: "application/json" } });
  if (!r.ok || !r.headers.get("content-type")?.includes("json")) return null;
  return ((await r.json()) as { festival: Festival | null }).festival;
}
