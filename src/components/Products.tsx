import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { brand, cycleTypes, cyclesOfType, products, shopEntries, typeCover, waLink, type CycleType, type Product, type ShopEntry } from "../data/site";
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

type GroupEntry = Extract<ShopEntry, { kind: "group" }>;
type View = { kind: "type"; type: CycleType } | { kind: "group"; group: GroupEntry } | null;

const groupOf = (t: CycleType) => shopEntries().find((e): e is GroupEntry => e.kind === "group" && e.types.some((x) => x.id === t.id));

const viewFromHash = (): View => {
  const m = /^#shop\/([a-z0-9-]+)$/.exec(window.location.hash);
  if (!m) return null;
  if (m[1] === "all") return { kind: "type", type: ALL };
  const entries = shopEntries();
  const group = entries.find((e): e is GroupEntry => e.kind === "group" && e.id === m[1]);
  if (group) return { kind: "group", group };
  const type = cycleTypes.find((t) => t.id === m[1]);
  return type ? { kind: "type", type } : null;
};

const listOf = (t: CycleType) => (t.id === "all" ? products : cyclesOfType(t));

/** One big card: a type, a group of types, or "All cycles". */
function ShopCard(props: {
  id: string;
  name: string;
  description: string;
  color: string;
  cover?: string;
  icon?: string;
  icons?: string[];
  meta: string[];
  onOffer: boolean;
  index: number;
  small?: boolean;
  onOpen: () => void;
}) {
  const { id, name, description, color, cover, icon, icons, meta, onOffer, index, small, onOpen } = props;
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateY = useSpring(useTransform(mx, [0, 1], [-8, 8]), { stiffness: 180, damping: 18 });
  const rotateX = useSpring(useTransform(my, [0, 1], [6, -6]), { stiffness: 180, damping: 18 });
  const bikeX = useSpring(useTransform(mx, [0, 1], [-18, 18]), { stiffness: 120, damping: 18 });

  return (
    <motion.button
      type="button"
      className={`type-card${small ? " is-small" : ""}`}
      style={{ rotateX, rotateY, ["--type" as string]: color }}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: (index % 4) * 0.07, type: "spring", visualDuration: 0.5, bounce: 0.15 }}
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
      aria-label={`${name}: ${meta.join(", ")}`}
    >
      <span className="type-glow" aria-hidden />
      <span className="type-word" aria-hidden>
        {name}
      </span>
      {onOffer && <span className="type-offer">Festival offer</span>}
      {cover ? (
        <motion.img layoutId={`type-cover-${id}`} className="type-bike" src={cover} alt="" style={{ x: bikeX }} draggable={false} loading="lazy" />
      ) : icons?.length ? (
        <motion.span className="type-icons" style={{ x: bikeX }} aria-hidden>
          {icons.slice(0, 5).map((ic, i) => (
            <span key={i} style={{ ["--i" as string]: i }}>
              {ic}
            </span>
          ))}
        </motion.span>
      ) : icon ? (
        <motion.span layoutId={`type-icon-${id}`} className="type-icon" style={{ x: bikeX }} aria-hidden>
          {icon}
        </motion.span>
      ) : null}
      <span className="type-info">
        <motion.strong layoutId={`type-name-${id}`}>{name}</motion.strong>
        {description && <span className="type-desc">{description}</span>}
        <span className="type-meta">
          {meta.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </span>
      </span>
      <span className="type-go" aria-hidden>
        →
      </span>
    </motion.button>
  );
}

function useTypeCard() {
  const { offers } = useFestival();
  return (t: CycleType) => {
    const list = listOf(t);
    const from = list.length ? Math.min(...list.map((p) => offers.get(p.id)?.offerPrice ?? p.price)) : 0;
    return {
      cover: t.id === "all" ? typeCover(cycleTypes.find((x) => cyclesOfType(x).length) ?? ALL) : typeCover(t),
      meta: list.length ? [`${list.length} ${list.length === 1 ? "model" : "models"}`, `from ${inr.format(from)}`] : ["Coming soon"],
      onOffer: list.some((p) => (offers.get(p.id)?.save ?? 0) > 0),
    };
  };
}

export default function Products({ onAdd }: { onAdd: () => void }) {
  const [view, setView] = useState<View>(viewFromHash);
  const [showAll, setShowAll] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const entries = shopEntries();
  const card = useTypeCard();

  // Back/forward buttons and shared links (#shop/mountain, #shop/group-kids-toys) open the right view
  useEffect(() => {
    const sync = () => {
      setView(viewFromHash());
      setShowAll(false);
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const go = (next: View) => {
    const hash = !next ? "#shop" : next.kind === "group" ? `#shop/${next.group.id}` : `#shop/${next.type.id}`;
    if (window.location.hash !== hash) history.pushState(null, "", hash);
    setView(next);
    setShowAll(false);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openType = (t: CycleType) => go({ kind: "type", type: t });
  const parent = view?.kind === "type" ? groupOf(view.type) : undefined;
  const filtered = view?.kind === "type" ? listOf(view.type) : [];
  const list = showAll ? filtered : filtered.slice(0, INITIAL);
  const topTypes = entries.filter((e) => e.kind === "type").map((e) => (e as { type: CycleType }).type);
  // Chips: sibling types inside a group, or the top-level types
  const chips = parent ? parent.types : [...topTypes, ALL];

  const heading = !view ? "Shop by type" : view.kind === "group" ? view.group.name : "Find your next ride";

  return (
    <section className="section" id="shop" ref={sectionRef}>
      <div className="section-head">
        <span className="eyebrow">The collection</span>
        <h2>{heading}</h2>
        <p className="muted">
          {!view ? "Pick a type to see every model in it." : view.kind === "group" ? "Pick a type to see what's in stock." : "Factory-direct prices on every model."}{" "}
          Prices shown are placeholders for now —{" "}
          <a className="link" href={brand.catalog} target="_blank" rel="noreferrer">
            see our WhatsApp catalog
          </a>
          .
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!view && (
          <motion.div key="types" className="type-grid" exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.2 }}>
            {entries.map((e, i) => {
              if (e.kind === "type") {
                const c = card(e.type);
                return (
                  <ShopCard key={e.id} id={e.type.id} name={e.type.name} description={e.type.description} color={e.type.color} icon={e.type.icon} {...c} index={i} onOpen={() => openType(e.type)} />
                );
              }
              const all = e.types.flatMap(listOf);
              const cover = e.types.map((t) => t.image ?? (cyclesOfType(t).length ? typeCover(t) : undefined)).find(Boolean);
              return (
                <ShopCard
                  key={e.id}
                  id={e.id}
                  name={e.name}
                  description={e.types.map((t) => t.name).join(" · ")}
                  color={e.types[0].color}
                  cover={cover}
                  icons={e.types.map((t) => t.icon ?? "").filter(Boolean)}
                  meta={[`${e.types.length} types`, all.length ? `${all.length} products` : "New range"]}
                  onOffer={false}
                  index={i}
                  onOpen={() => go({ kind: "group", group: e })}
                />
              );
            })}
            {topTypes.length > 1 && <ShopCard {...ALL} {...card(ALL)} index={entries.length} onOpen={() => openType(ALL)} />}
          </motion.div>
        )}

        {view?.kind === "group" && (
          <motion.div key={`group-${view.group.id}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="type-head">
              <button type="button" className="btn btn-ghost btn-small" onClick={() => go(null)}>
                ← All types
              </button>
            </div>
            <div className="type-grid is-sub">
              {view.group.types.map((t, i) => (
                <ShopCard key={t.id} id={t.id} name={t.name} description={t.description} color={t.color} icon={t.icon} {...card(t)} index={i} small onOpen={() => openType(t)} />
              ))}
            </div>
          </motion.div>
        )}

        {view?.kind === "type" && (
          <motion.div key={`list-${view.type.id}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="type-head" style={{ ["--type" as string]: view.type.color }}>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => go(parent ? { kind: "group", group: parent } : null)}>
                ← {parent ? parent.name : "All types"}
              </button>
              <div className="type-head-title">
                {view.type.id !== "all" && typeCover(view.type) ? (
                  <motion.img layoutId={`type-cover-${view.type.id}`} src={typeCover(view.type)} alt="" />
                ) : view.type.icon ? (
                  <motion.span layoutId={`type-icon-${view.type.id}`} className="type-head-icon" aria-hidden>
                    {view.type.icon}
                  </motion.span>
                ) : null}
                <div>
                  <motion.h3 layoutId={`type-name-${view.type.id}`}>{view.type.name}</motion.h3>
                  <span>
                    {filtered.length ? `${filtered.length} ${filtered.length === 1 ? "model" : "models"}` : "Coming soon"}
                    {view.type.description && ` · ${view.type.description}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="tabs type-chips" role="tablist" aria-label="Types">
              {chips.map((t) => (
                <button key={t.id} role="tab" aria-selected={view.type.id === t.id} className={view.type.id === t.id ? "active" : ""} onClick={() => openType(t)}>
                  {view.type.id === t.id && (
                    <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: "spring", visualDuration: 0.3, bounce: 0.2 }} />
                  )}
                  <span>
                    {t.icon && !parent ? "" : t.icon ? `${t.icon} ` : ""}
                    {t.id === "all" ? "All" : t.name}
                  </span>
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="type-empty" style={{ ["--type" as string]: view.type.color }}>
                {view.type.icon && <span aria-hidden>{view.type.icon}</span>}
                <h4>New {view.type.name.toLowerCase()} stock is on the way</h4>
                <p className="muted">Message us for current models, colours and prices.</p>
                <a
                  className="btn btn-wa"
                  href={waLink(`Hi VMount, which ${view.type.name} models do you have, and what are the prices?`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ask on WhatsApp
                </a>
              </div>
            ) : (
              <>
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
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
