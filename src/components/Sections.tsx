import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useScroll, useTransform } from "motion/react";
import { brand, features, mapEmbed, stats, testimonials, waLink } from "../data/site";

const reveal = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { type: "spring", visualDuration: 0.6, bounce: 0.1 },
} as const;

export function Nav({ cart }: { cart: number }) {
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 80], ["rgba(9,9,11,0)", "rgba(9,9,11,0.75)"]);
  return (
    <motion.header className="nav" style={{ backgroundColor: bg }}>
      <a href="#top" className="logo">
        <img src={brand.logo} alt="" className="logo-img" /> {brand.fullName}
      </a>
      <nav>
        <a href="#shop">Shop</a>
        <a href="#showcase">Showroom</a>
        <a href="#why">Why us</a>
        <a href="#instagram">Reels</a>
        <a href="#reviews">Reviews</a>
        <a href="#contact">Contact</a>
      </nav>
      <div className="cart" aria-label={`${cart} items in cart`}>
        Cart
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={cart}
            className="cart-count"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", visualDuration: 0.3, bounce: 0.5 }}
          >
            {cart}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.header>
  );
}

export function Marquee() {
  const items = ["Mountain", "Road", "City", "Hybrid", "Electric", "Factory direct", "Wholesale prices", "Made in Gujarat"];
  return (
    <div className="marquee" id="marquee" aria-hidden>
      <motion.div className="marquee-track" animate={{ x: ["0%", "-50%"] }} transition={{ repeat: Infinity, ease: "linear", duration: 28 }}>
        {[...items, ...items].map((t, i) => (
          <span key={i}>
            {t} <em>✦</em>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function Counter({ value, decimals = 0, suffix }: { value: number; decimals?: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(() => mv.get().toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix);
  useEffect(() => {
    if (inView) animate(mv, value, { duration: 1.8, ease: [0.16, 1, 0.3, 1] });
  }, [inView, mv, value]);
  return <motion.span ref={ref}>{text}</motion.span>;
}

export function Why() {
  return (
    <section className="section" id="why">
      <div className="section-head">
        <span className="eyebrow">Why {brand.name}</span>
        <h2>More than a bike shop</h2>
      </div>
      <div className="stats">
        {stats.map((s) => (
          <motion.div className="stat" key={s.label} {...reveal}>
            <strong>
              <Counter value={s.value} decimals={s.decimals} suffix={s.suffix} />
            </strong>
            <span>{s.label}</span>
          </motion.div>
        ))}
      </div>
      <div className="features">
        {features.map((f, i) => (
          <motion.div className="feature" key={f.title} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }} whileHover={{ y: -6 }}>
            <span className="feature-num">0{i + 1}</span>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function Reviews() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % testimonials.length), 5000);
    return () => clearInterval(id);
  }, []);
  const t = testimonials[i];
  return (
    <section className="section reviews" id="reviews">
      <span className="eyebrow">Rider stories · {brand.google.rating}★ on Google</span>
      <div className="quote-wrap">
        <AnimatePresence mode="wait">
          <motion.blockquote
            key={i}
            initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -24, filter: "blur(6px)" }}
            transition={{ duration: 0.45 }}
          >
            <p>“{t.quote}”</p>
            <footer>
              <strong>{t.name}</strong> · {t.role}
            </footer>
          </motion.blockquote>
        </AnimatePresence>
      </div>
      <div className="dots">
        {testimonials.map((_, n) => (
          <button key={n} aria-label={`Show review ${n + 1}`} onClick={() => setI(n)} className={n === i ? "on" : ""} />
        ))}
      </div>
      <a className="link reviews-link" href={brand.google.url} target="_blank" rel="noreferrer">
        Read all {brand.google.reviews} reviews on Google →
      </a>
    </section>
  );
}

export function Contact() {
  const [sent, setSent] = useState(false);
  return (
    <section className="section" id="contact">
      <motion.div className="cta" {...reveal}>
        <div>
          <span className="eyebrow">Visit the factory</span>
          <h2>Come ride one today</h2>
          <a className="g-rating" href={brand.google.url} target="_blank" rel="noreferrer">
            <strong>{brand.google.rating}</strong>
            <span className="stars" style={{ ["--pct" as string]: `${(brand.google.rating / 5) * 100}%` }}>★★★★★</span>
            <span>{brand.google.reviews} Google reviews</span>
          </a>
          <dl className="contact-list">
            <dt>Address</dt>
            <dd>{brand.address}</dd>
            <dt>Phone</dt>
            <dd>
              <a className="link" href={`tel:${brand.phone.replace(/\s/g, "")}`}>{brand.phone}</a>
            </dd>
            <dt>Hours</dt>
            <dd>{brand.hours}</dd>
            {brand.email && (
              <>
                <dt>Email</dt>
                <dd>
                  <a className="link" href={`mailto:${brand.email}`}>{brand.email}</a>
                </dd>
              </>
            )}
            <dt>Instagram</dt>
            <dd>
              <a href={brand.instagram} target="_blank" rel="noreferrer" className="link">
                {brand.instagramHandle}
              </a>
            </dd>
          </dl>
          <div className="cta-actions">
            <motion.a className="btn btn-primary" href={brand.google.url} target="_blank" rel="noreferrer" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              Directions
            </motion.a>
            <motion.a className="btn btn-ghost" href={`tel:${brand.phone.replace(/\s/g, "")}`} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              Call
            </motion.a>
            <motion.a
              className="btn btn-wa"
              href={waLink("Hi VMount, I'd like to know more about your cycles.")}
              target="_blank"
              rel="noreferrer"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              WhatsApp
            </motion.a>
          </div>
        </div>
        <form
          className="cta-form"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {sent ? (
              <motion.p key="done" className="sent" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                Thanks! We'll call you back shortly. 🚲
              </motion.p>
            ) : (
              <motion.div key="form" className="cta-fields" exit={{ opacity: 0, scale: 0.95 }}>
                <input required placeholder="Your name" aria-label="Your name" />
                <input required type="tel" placeholder="Phone number" aria-label="Phone number" />
                <motion.button className="btn btn-primary" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  Request a call back
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </motion.div>
      <motion.div className="map" {...reveal}>
        <iframe src={mapEmbed} title="Vmount Bikes location on Google Maps" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      </motion.div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <span>
        © 2026 {brand.fullName}. All rights reserved.
      </span>
      <span>
        {brand.location} · {brand.tagline} ·{" "}
        <a href={brand.instagram} target="_blank" rel="noreferrer">
          Instagram
        </a>
      </span>
    </footer>
  );
}
