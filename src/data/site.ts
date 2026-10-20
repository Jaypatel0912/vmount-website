// Content lives in src/content/*.json and is edited through the admin panel (/admin).
// This file only shapes that content for the components.
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
};

export const products = (productData.products as Product[]).filter((p) => p.visible !== false);

/** Bikes shown in the 360° showroom ring. */
export const showcase = (() => {
  const picked = products.filter((p) => p.featured);
  return (picked.length >= 3 ? picked : products).slice(0, 12);
})();

/** Bikes shown in the top banner, in the order set in the admin. */
export const heroBikes = (() => {
  const picked = settings.hero.bikes.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p);
  return picked.length ? picked : products.slice(0, 4);
})();

export const { hero, promo, features, stats, testimonials, reels } = settings;

/** WhatsApp chat link with a pre-filled message. */
export const waLink = (text: string) => `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(text)}`;

export const mapEmbed = `https://www.google.com/maps?q=${encodeURIComponent(b.googleMapsQuery + ", " + b.address)}&output=embed`;
