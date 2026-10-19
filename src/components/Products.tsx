import { useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { brand, categories, products, waLink, type Product } from "../data/site";
import BikeIllustration from "./BikeIllustration";

// Only show tabs for categories that have bikes
const tabs = ["All", ...categories.filter((c) => products.some((p) => p.category === c))] as const;
const INITIAL = 8;

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function ProductCard({ p, onAdd }: { p: Product; onAdd: () => void }) {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateY = useSpring(useTransform(mx, [0, 1], [-10, 10]), { stiffness: 200, damping: 20 });
  const rotateX = useSpring(useTransform(my, [0, 1], [8, -8]), { stiffness: 200, damping: 20 });
  const imgX = useTransform(mx, [0, 1], [-14, 14]);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <motion.article
      layout
      className="card"
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
      {p.tag && <span className="card-tag">{p.tag}</span>}
      <motion.div className="card-media" style={{ x: imgX }}>
        {p.image && !imgFailed ? (
          <img src={p.image} alt={p.name} loading="lazy" draggable={false} onError={() => setImgFailed(true)} />
        ) : (
          <BikeIllustration color={p.color} />
        )}
      </motion.div>
      <div className="card-body">
        <span className="card-cat">{p.category}</span>
        <h3>{p.name}</h3>
        <ul className="card-specs">
          {p.specs.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <div className="card-foot">
          <strong>{inr.format(p.price)}</strong>
          <motion.a
            className="btn btn-small btn-wa"
            href={waLink(`Hi VMount, I'm interested in the ${p.name}. Is it available?`)}
            target="_blank"
            rel="noreferrer"
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            onClick={onAdd}
          >
            Order on WhatsApp
          </motion.a>
        </div>
      </div>
    </motion.article>
  );
}

export default function Products({ onAdd }: { onAdd: () => void }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("All");
  const [showAll, setShowAll] = useState(false);
  const filtered = tab === "All" ? products : products.filter((p) => p.category === tab);
  const list = showAll ? filtered : filtered.slice(0, INITIAL);

  return (
    <section className="section" id="shop">
      <div className="section-head">
        <span className="eyebrow">The collection</span>
        <h2>Find your next ride</h2>
        <p className="muted">
          Factory-direct prices on every model. Prices shown are placeholders for now —{" "}
          <a className="link" href={brand.catalog} target="_blank" rel="noreferrer">
            see our WhatsApp catalog
          </a>
          .
        </p>
      </div>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {tab === t && <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: "spring", visualDuration: 0.3, bounce: 0.2 }} />}
            <span>{t}</span>
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
    </section>
  );
}
