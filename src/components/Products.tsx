import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { brand, cycleTypes, cyclesOfType, products, typeCover, waLink, type CycleType, type Product } from "../data/site";
import BikeIllustration from "./BikeIllustration";
import { useFestival } from "./FestivalContext";

const INITIAL = 8;
const ALL: CycleType = { id: "all", name: "All cycles", description: "Every VMount model in one place.", color: "#f7941d" };

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function ProductCard({ p, onAdd }: { p: Product; onAdd: () => void }) {
  const { festival, offers } = useFestival();
  const offer = offers.get(p.id);
  const hasSaving = !!offer && offer.save > 0;
  const out = p.stock === 0;
  const low = typeof p.stock === "number" && p.stock > 0 && p.stock <= 3;
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateY = useSpring(useTransform(mx, [0, 1], [-10, 10]), { stiffness: 200, damping: 20 });
  const rotateX = useSpring(useTransform(my, [0, 1], [8, -8]), { stiffness: 200, damping: 20 });
  const imgX = useTransform(mx, [0, 1], [-14, 14]);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <motion.article
      layout
      className={`card${out ? " is-out" : ""}`}
      style={{ rotateX, rotateY, ["--card" as string]: p.color }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", visualDuration: 0.4, bounce: 0.15 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        mx.set(0.5);
        my.set(0.5);
      }}
    >
      {out ? (
        <span className="card-tag is-out">Out of stock</span>
      ) : offer && festival ? (
        <span className="card-tag is-offer">{festival.name} offer</span>
      ) : (
        p.tag && <span className="card-tag">{p.tag}</span>
      )}
      <motion.div className="card-media" style={{ x: imgX }}>
        {p.image && !imgFailed ? (
          <img src={p.image} alt={p.name} loading="lazy" draggable={false} onError={() => setImgFailed(true)} />
        ) : (
          <BikeIllustration color={p.color} />
        )}
      </motion.div>
      <div className="card-body">
        <span className="card-cat">{p.category}</span>
        {low && <span className="card-low">Only {p.stock} left</span>}
        <h3>{p.name}</h3>
        <ul className="card-specs">
          {p.specs.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <div className="card-foot">
          {hasSaving ? (
            <span className="card-price">
              <s>{inr.format(p.price)}</s>
              <strong className="is-offer">{inr.format(offer!.offerPrice)}</strong>
            </span>
          ) : (
            <strong>{inr.format(p.price)}</strong>
          )}
          <motion.a
            className={`btn btn-small ${out ? "btn-ghost" : "btn-wa"}`}
            href={waLink(
              out
                ? `Hi VMount, please let me know when the ${p.name} is back in stock.`
                : `Hi VMount, I'm interested in the ${p.name}. Is it available?`,
            )}
            target="_blank"
            rel="noreferrer"
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            onClick={out ? undefined : onAdd}
          >
            {out ? "Notify me" : "Order on WhatsApp"}
          </motion.a>
        </div>
      </div>
    </motion.article>
  );
}

/** Types that have at least one cycle on the website, in the order set on /cycles. */
const shownTypes = () => cycleTypes.filter((t) => cyclesOfType(t).length);

const typeFromHash = () => {
  const m = /^#shop\/([a-z0-9-]+)$/.exec(window.location.hash);
  if (!m) return null;
  return m[1] === "all" ? ALL : shownTypes().find((t) => t.id === m[1]) ?? null;
};

function TypeCard({ t, index, onOpen }: { t: CycleType; index: number; onOpen: () => void }) {
  const { offers } = useFestival();
  const list = t.id === "all" ? products : cyclesOfType(t);
  const cover = t.id === "all" ? typeCover(shownTypes()[0] ?? ALL) : typeCover(t);
  const from = Math.min(...list.map((p) => offers.get(p.id)?.offerPrice ?? p.price));
  const onOffer = list.some((p) => (offers.get(p.id)?.save ?? 0) > 0);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateY = useSpring(useTransform(mx, [0, 1], [-8, 8]), { stiffness: 180, damping: 18 });
  const rotateX = useSpring(useTransform(my, [0, 1], [6, -6]), { stiffness: 180, damping: 18 });
  const bikeX = useSpring(useTransform(mx, [0, 1], [-18, 18]), { stiffness: 120, damping: 18 });

  return (
    <motion.button
      type="button"
      className="type-card"
      style={{ rotateX, rotateY, ["--type" as string]: t.color }}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: (index % 3) * 0.08, type: "spring", visualDuration: 0.5, bounce: 0.15 }}
      whileTap={{ scale: 0.98 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        mx.set(0.5);
        my.set(0.5);
      }}
      onClick={onOpen}
      aria-label={`${t.name}: ${list.length} ${list.length === 1 ? "model" : "models"}, from ${inr.format(from)}`}
    >
      <span className="type-glow" aria-hidden />
      <span className="type-word" aria-hidden>
        {t.name}
      </span>
      {onOffer && <span className="type-offer">Festival offer</span>}
      {cover && (
        <motion.img layoutId={`type-cover-${t.id}`} className="type-bike" src={cover} alt="" style={{ x: bikeX }} draggable={false} loading="lazy" />
      )}
      <span className="type-info">
        <motion.strong layoutId={`type-name-${t.id}`}>{t.name}</motion.strong>
        {t.description && <span className="type-desc">{t.description}</span>}
        <span className="type-meta">
          <span>
            {list.length} {list.length === 1 ? "model" : "models"}
          </span>
          <span>from {inr.format(from)}</span>
        </span>
      </span>
      <span className="type-go" aria-hidden>
        →
      </span>
    </motion.button>
  );
}

export default function Products({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen] = useState<CycleType | null>(typeFromHash);
  const [showAll, setShowAll] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const types = shownTypes();

  // Back/forward buttons and shared links (#shop/mountain) open the right type
  useEffect(() => {
    const sync = () => {
      setOpen(typeFromHash());
      setShowAll(false);
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const go = (t: CycleType | null) => {
    const hash = t ? `#shop/${t.id}` : "#shop";
    if (window.location.hash !== hash) history.pushState(null, "", hash);
    setOpen(t);
    setShowAll(false);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const filtered = open ? (open.id === "all" ? products : cyclesOfType(open)) : [];
  const list = showAll ? filtered : filtered.slice(0, INITIAL);

  return (
    <section className="section" id="shop" ref={sectionRef}>
      <div className="section-head">
        <span className="eyebrow">The collection</span>
        <h2>{open ? "Find your next ride" : "Shop by type"}</h2>
        <p className="muted">
          {open ? "Factory-direct prices on every model." : "Pick a type to see every model in it."} Prices shown are placeholders for now —{" "}
          <a className="link" href={brand.catalog} target="_blank" rel="noreferrer">
            see our WhatsApp catalog
          </a>
          .
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!open ? (
          <motion.div key="types" className="type-grid" exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.2 }}>
            {types.map((t, i) => (
              <TypeCard key={t.id} t={t} index={i} onOpen={() => go(t)} />
            ))}
            {types.length > 1 && <TypeCard t={ALL} index={types.length} onOpen={() => go(ALL)} />}
          </motion.div>
        ) : (
          <motion.div key={`list-${open.id}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="type-head" style={{ ["--type" as string]: open.color }}>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => go(null)}>
                ← All types
              </button>
              <div className="type-head-title">
                {open.id !== "all" && typeCover(open) && (
                  <motion.img layoutId={`type-cover-${open.id}`} src={typeCover(open)} alt="" />
                )}
                <div>
                  <motion.h3 layoutId={`type-name-${open.id}`}>{open.name}</motion.h3>
                  <span>
                    {filtered.length} {filtered.length === 1 ? "model" : "models"}
                    {open.description && ` · ${open.description}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="tabs type-chips" role="tablist" aria-label="Cycle types">
              {[...types, ALL].map((t) => (
                <button key={t.id} role="tab" aria-selected={open.id === t.id} className={open.id === t.id ? "active" : ""} onClick={() => go(t)}>
                  {open.id === t.id && (
                    <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: "spring", visualDuration: 0.3, bounce: 0.2 }} />
                  )}
                  <span>{t.id === "all" ? "All" : t.name}</span>
                </button>
              ))}
            </div>

            <motion.div layout className="grid">
              <AnimatePresence mode="popLayout">
                {list.map((p) => (
                  <ProductCard key={p.id} p={p} onAdd={onAdd} />
                ))}
              </AnimatePresence>
            </motion.div>
            {filtered.length > INITIAL && (
              <div className="more">
                <motion.button className="btn btn-ghost" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Show fewer" : `Show all ${filtered.length} bikes`}
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
