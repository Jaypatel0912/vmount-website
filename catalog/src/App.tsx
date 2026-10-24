import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  business,
  catalogues,
  coverOf,
  findCatalogue,
  groupOf,
  groups,
  homeOf,
  absolute,
  inr,
  isLow,
  isOut,
  photosOf,
  products,
  productLink,
  productsIn,
  search,
  waLink,
  type Catalogue,
  type Product,
} from "./data";
import { readToken } from "./admin/token";
import { canSharePhotos, sharePhotos } from "./share";

// The password popup is only downloaded when someone taps "Staff login"
const StaffLogin = lazy(() => import("./admin/Login"));
const openManager = () => window.location.assign("/admin");

/* ---------- routing (#/, #/c/<catalogue>, #/c/<catalogue>/<product>) ---------- */

type Route = { catalogue?: string; product?: string };

const parseHash = (): Route => {
  const [, kind, c, p] = window.location.hash.split("/");
  return kind === "c" && c ? { catalogue: c, product: p } : {};
};

function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const sync = () => setRoute(parseHash());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return route;
}

const go = (hash: string) => {
  if (window.location.hash !== hash) window.location.hash = hash;
};

/* ---------- inquiry list (kept in this browser) ---------- */

type Inquiry = Record<string, number>;
const KEY = "vmount-catalogue-inquiry";

function useInquiry() {
  const [items, setItems] = useState<Inquiry>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      // private mode: the list just won't be remembered
    }
  }, [items]);
  const set = (id: string, qty: number) =>
    setItems((cur) => {
      const next = { ...cur };
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(qty, 99);
      return next;
    });
  return { items, set, clear: () => setItems({}) };
}

const priceText = (p: Product) => (p.price ? inr.format(p.price) : "Ask for price");

/* ---------- small pieces ---------- */

function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1a8.2 8.2 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.3 5.2 4.6 1.9.8 2.7.9 3.6.7.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.3-.6-.4ZM12 2a10 10 0 0 0-8.6 15l-1.4 5 5.2-1.4A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function Header({ query, setQuery, count, onInquiry }: { query: string; setQuery: (q: string) => void; count: number; onInquiry: () => void }) {
  return (
    <header className="top">
      <div className="top-inner">
        <a className="brand" href="#/" onClick={() => setQuery("")}>
          <img src="/images/logo.png" alt="" />
          <span>
            <strong>V Mount Bikes</strong>
            <small>Catalogue</small>
          </span>
        </a>
        <label className="search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search cycles, walkers, jeeps…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value && window.location.hash.startsWith("#/c/")) go("#/");
            }}
            aria-label="Search the catalogue"
          />
        </label>
        <button type="button" className="inq-btn" onClick={onInquiry} aria-label={`Inquiry list, ${count} items`}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 7h12l-1 13H7L6 7Z" />
            <path d="M9 7a3 3 0 0 1 6 0" />
          </svg>
          <AnimatePresence>
            {count > 0 && (
              <motion.span key={count} className="inq-count" initial={{ scale: 0.4 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", bounce: 0.5, visualDuration: 0.3 }}>
                {count}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </header>
  );
}

function CatalogueTile({ c, index }: { c: Catalogue; index: number }) {
  const list = productsIn(c.id);
  const cover = coverOf(c.id);
  return (
    <motion.a
      href={`#/c/${c.id}`}
      className={`tile${cover ? "" : " is-empty"}`}
      style={{ ["--accent" as string]: c.color }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: (index % 6) * 0.05, type: "spring", visualDuration: 0.45, bounce: 0.15 }}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.97 }}
    >
      <span className="tile-media">
        <span className="tile-glow" aria-hidden />
        {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="tile-badge" aria-hidden>{c.badge}</span>}
        {cover && c.badge && <span className="tile-chip">{c.badge}</span>}
      </span>
      <span className="tile-body">
        <strong>{c.title}</strong>
        <small>{c.blurb}</small>
        <span className={`tile-count${list.length ? "" : " is-soon"}`}>{list.length ? `${list.length} ${list.length === 1 ? "product" : "products"}` : "Coming soon"}</span>
      </span>
    </motion.a>
  );
}

/** One inquiry line per product, with a link to its main photo so it shows up in WhatsApp. */
const inquiryText = (lines: { p: Product; qty?: number }[], intro: string) =>
  [
    intro,
    ...lines.map(({ p, qty }, i) => `${lines.length > 1 ? `${i + 1}. ` : ""}${p.name}${qty ? ` — qty ${qty}` : ""}\n   Photo: ${absolute(p.image)}`),
    "",
    "Please share price and availability.",
  ].join("\n");

/** "Share with photos" button: sends real photos through the phone's share menu (pick WhatsApp → VMount). */
function SharePhotosButton({ photos, text }: { photos: { url: string; name: string }[]; text: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  if (!canSharePhotos()) return null;
  return (
    <div className="share-photos">
      <button
        type="button"
        className="btn btn-ghost"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          try {
            const r = await sharePhotos(photos, text);
            setState(r === "shared" ? "done" : "idle");
          } catch {
            setState("error");
          }
        }}
      >
        📷 {state === "busy" ? "Preparing photos…" : `Share with ${photos.length === 1 ? "photo" : `${photos.length} photos`}`}
      </button>
      <small className="muted">
        {state === "error"
          ? "Couldn't share the photos — please try again."
          : state === "done"
            ? "Sent! If the message text is missing, paste it — it's copied."
            : "Choose WhatsApp, then the VMount Bikes chat. The message is copied too."}
      </small>
    </div>
  );
}

const notifyLink = (p: Product) => waLink(`Hi VMount, please tell me when "${p.name}" is back in stock.`);

function StockNote({ p }: { p: Product }) {
  if (isOut(p)) return <span className="stock is-out">Out of stock</span>;
  if (isLow(p)) return <span className="stock is-low">Only {p.stock} left</span>;
  return null;
}

function ProductTile({ p, cat, qty, onAdd, index }: { p: Product; cat: string; qty: number; onAdd: () => void; index: number }) {
  const out = isOut(p);
  return (
    <motion.article
      layout
      className={`ptile${out ? " is-out" : ""}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.03, type: "spring", visualDuration: 0.4, bounce: 0.15 }}
    >
      <a href={`#/c/${cat}/${p.id}`} className="ptile-media" aria-label={`View ${p.name}`}>
        <img src={p.image} alt={p.name} loading="lazy" />
        {out ? <span className="ptile-tag is-out">Out of stock</span> : p.tag && <span className="ptile-tag">{p.tag}</span>}
        {photosOf(p).length > 1 && <span className="ptile-count">📷 {photosOf(p).length}</span>}
      </a>
      <div className="ptile-body">
        <a href={`#/c/${cat}/${p.id}`} className="ptile-name">
          {p.name}
        </a>
        {isLow(p) && <StockNote p={p} />}
        <div className="ptile-foot">
          <span className={p.price ? "price" : "price is-ask"}>{priceText(p)}</span>
          {out ? (
            <a className="add is-notify" href={notifyLink(p)} target="_blank" rel="noreferrer">
              Notify me
            </a>
          ) : (
            <motion.button type="button" className={`add${qty ? " is-in" : ""}`} onClick={onAdd} whileTap={{ scale: 0.85 }} aria-label={qty ? `${p.name}: ${qty} in inquiry, add one more` : `Add ${p.name} to inquiry`}>
              {qty ? `✓ ${qty}` : "+ Add"}
            </motion.button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

/* ---------- pages ---------- */

function Home({ query, inquiry }: { query: string; inquiry: ReturnType<typeof useInquiry> }) {
  const results = useMemo(() => search(query), [query]);

  if (query.trim()) {
    return (
      <section className="page">
        <div className="page-head">
          <h1>Results for “{query.trim()}”</h1>
          <p className="muted">{results.length ? `${results.length} products found` : "Nothing matched — try “26”, “walker” or “jeep”."}</p>
        </div>
        <div className="pgrid">
          {results.map((p, i) => (
            <ProductTile key={p.id} p={p} cat={homeOf(p)!} qty={inquiry.items[p.id] ?? 0} onAdd={() => inquiry.set(p.id, (inquiry.items[p.id] ?? 0) + 1)} index={i} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <motion.span className="hero-eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            Factory-direct · {business.location}
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            The VMount <em>catalogue</em>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            {catalogues.length} collections · {products.length} products. Tap a collection, add what you like, and send one inquiry on WhatsApp.
          </motion.p>
          <motion.div className="hero-jump" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.24 }}>
            {groups.map((g) => (
              <a key={g.id} href={`#${g.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(g.id)?.scrollIntoView({ behavior: "smooth" }); }}>
                {g.title} <span>{g.catalogues.length}</span>
              </a>
            ))}
          </motion.div>
        </div>
        <motion.img
          className="hero-bike"
          src="/images/cycles/duster-26.webp"
          alt="VMount Duster 26 inch cycle"
          initial={{ opacity: 0, x: 60, rotate: -4 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ type: "spring", visualDuration: 0.8, bounce: 0.2, delay: 0.1 }}
        />
      </section>

      {groups.map((g) => (
        <section key={g.id} id={g.id} className="group">
          <div className="group-head">
            <h2>{g.title}</h2>
            <p className="muted">{g.subtitle}</p>
          </div>
          <div className="tiles">
            {g.catalogues.map((c, i) => (
              <CatalogueTile key={c.id} c={c} index={i} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function CataloguePage({ c, inquiry }: { c: Catalogue; inquiry: ReturnType<typeof useInquiry> }) {
  const group = groupOf(c);
  const list = productsIn(c.id);
  const [filter, setFilter] = useState("");
  const shown = filter ? list.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase())) : list;
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFilter("");
    window.scrollTo({ top: 0 });
    chipsRef.current?.querySelector(".is-on")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [c.id]);

  return (
    <section className="page" style={{ ["--accent" as string]: c.color }}>
      <div className="page-head">
        <a className="back" href="#/">
          ← All collections
        </a>
        <div className="page-title">
          <span className="page-badge" aria-hidden>{c.badge}</span>
          <div>
            <h1>{c.title}</h1>
            <p className="muted">
              {group.title} · {list.length ? `${list.length} ${list.length === 1 ? "product" : "products"}` : "Coming soon"}
            </p>
          </div>
        </div>
      </div>

      <div className="chips" ref={chipsRef} role="tablist" aria-label={group.title}>
        {group.catalogues.map((x) => (
          <a key={x.id} href={`#/c/${x.id}`} role="tab" aria-selected={x.id === c.id} className={x.id === c.id ? "is-on" : ""}>
            {x.id === c.id && <motion.span layoutId="chip-pill" className="chip-pill" transition={{ type: "spring", bounce: 0.2, visualDuration: 0.3 }} />}
            <span>{x.title}</span>
          </a>
        ))}
      </div>

      {list.length > 6 && (
        <label className="search is-inline">
          <SearchIcon />
          <input type="search" placeholder={`Search in ${c.title}`} value={filter} onChange={(e) => setFilter(e.target.value)} />
        </label>
      )}

      {list.length === 0 ? (
        <div className="empty">
          <span aria-hidden>{c.badge}</span>
          <h2>New {c.title.toLowerCase()} are on the way</h2>
          <p className="muted">Message us for the latest models, colours and prices.</p>
          <a className="btn btn-wa" href={waLink(`Hi VMount, which ${c.title} do you have? Please share models and prices.`)} target="_blank" rel="noreferrer">
            <WaIcon /> Ask on WhatsApp
          </a>
        </div>
      ) : (
        <motion.div layout className="pgrid">
          {shown.map((p, i) => (
            <ProductTile key={p.id} p={p} cat={c.id} qty={inquiry.items[p.id] ?? 0} onAdd={() => inquiry.set(p.id, (inquiry.items[p.id] ?? 0) + 1)} index={i} />
          ))}
        </motion.div>
      )}
    </section>
  );
}

/* ---------- product viewer ---------- */

function ProductModal({ p, cat, inquiry }: { p: Product; cat: string; inquiry: ReturnType<typeof useInquiry> }) {
  const list = productsIn(cat);
  const i = list.findIndex((x) => x.id === p.id);
  const prev = list[(i - 1 + list.length) % list.length];
  const next = list[(i + 1) % list.length];
  const qty = inquiry.items[p.id] ?? 0;
  const close = () => go(`#/c/${cat}`);
  const c = findCatalogue(cat);
  const photos = photosOf(p);
  const [shot, setShot] = useState(0);
  useEffect(() => setShot(0), [p.id]);
  const photo = photos[Math.min(shot, photos.length - 1)] ?? p.image;
  const askText = `Hi VMount, I'm interested in "${p.name}" (${c?.title}).\nPhoto: ${absolute(p.image)}\nLink: ${productLink(p, cat)}\n\nPlease share price and availability.`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft" && list.length > 1) go(`#/c/${cat}/${prev.id}`);
      if (e.key === "ArrowRight" && list.length > 1) go(`#/c/${cat}/${next.id}`);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  });

  return (
    <motion.div className="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={p.name}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", visualDuration: 0.35, bounce: 0.12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="sheet-close" onClick={close} aria-label="Close">
          ✕
        </button>
        <div className="sheet-media">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.img
              key={photo}
              src={photo}
              alt={`${p.name}${photos.length > 1 ? ` — photo ${shot + 1} of ${photos.length}` : ""}`}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.2 }}
              drag={photos.length > 1 || list.length > 1 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                // Swipe through this product's photos; past the last one, move to the next product
                const dir = info.offset.x < -60 ? 1 : info.offset.x > 60 ? -1 : 0;
                if (!dir) return;
                const nextShot = shot + dir;
                if (nextShot >= 0 && nextShot < photos.length) setShot(nextShot);
                else if (list.length > 1) go(`#/c/${cat}/${(dir > 0 ? next : prev).id}`);
              }}
            />
          </AnimatePresence>
          {list.length > 1 && (
            <>
              <a className="nav is-prev" href={`#/c/${cat}/${prev.id}`} aria-label="Previous product">‹</a>
              <a className="nav is-next" href={`#/c/${cat}/${next.id}`} aria-label="Next product">›</a>
              <span className="sheet-pos">
                {i + 1} / {list.length}
              </span>
            </>
          )}
          {photos.length > 1 && (
            <div className="shots" role="tablist" aria-label="Photos">
              {photos.map((src, k) => (
                <button key={src} type="button" role="tab" aria-selected={k === shot} className={k === shot ? "is-on" : ""} onClick={() => setShot(k)} aria-label={`Photo ${k + 1}`}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="sheet-body">
          <span className="sheet-cat">{c?.title}</span>
          <h2>{p.name}</h2>
          <span className={p.price ? "price is-big" : "price is-ask is-big"}>{priceText(p)}</span>
          <StockNote p={p} />
          {p.specs.length > 0 && (
            <ul className="specs">
              {p.specs.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
          <div className="sheet-actions">
            {isOut(p) ? (
              <a className="btn btn-ghost" href={notifyLink(p)} target="_blank" rel="noreferrer">
                Notify me when back in stock
              </a>
            ) : qty ? (
              <div className="qty" aria-label="Quantity in inquiry">
                <button type="button" onClick={() => inquiry.set(p.id, qty - 1)} aria-label="One less">−</button>
                <span>{qty} in inquiry</span>
                <button type="button" onClick={() => inquiry.set(p.id, qty + 1)} aria-label="One more">+</button>
              </div>
            ) : (
              <motion.button type="button" className="btn btn-primary" whileTap={{ scale: 0.96 }} onClick={() => inquiry.set(p.id, 1)}>
                + Add to inquiry
              </motion.button>
            )}
            <a className="btn btn-wa" href={waLink(askText)} target="_blank" rel="noreferrer">
              <WaIcon /> Ask on WhatsApp
            </a>
            <SharePhotosButton photos={photos.map((url) => ({ url, name: p.name }))} text={askText} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------- inquiry sheet ---------- */

function InquirySheet({ inquiry, onClose }: { inquiry: ReturnType<typeof useInquiry>; onClose: () => void }) {
  const lines = Object.entries(inquiry.items)
    .map(([id, qty]) => ({ p: products.find((x) => x.id === id), qty }))
    .filter((l): l is { p: Product; qty: number } => !!l.p);
  const message = inquiryText(lines, "Hi VMount, I'd like to inquire about:");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div className="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="sheet is-list"
        role="dialog"
        aria-modal="true"
        aria-label="Inquiry list"
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", visualDuration: 0.35, bounce: 0.12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2>Your inquiry</h2>
        {lines.length === 0 ? (
          <p className="muted">Nothing added yet. Tap “+ Add” on any product.</p>
        ) : (
          <>
            <ul className="inq-list">
              <AnimatePresence initial={false}>
                {lines.map(({ p, qty }) => (
                  <motion.li key={p.id} layout exit={{ opacity: 0, x: 40 }}>
                    <img src={p.image} alt="" />
                    <div>
                      <strong>{p.name}</strong>
                      <span className="muted">{priceText(p)}</span>
                    </div>
                    <div className="qty is-small">
                      <button type="button" onClick={() => inquiry.set(p.id, qty - 1)} aria-label={`One less ${p.name}`}>−</button>
                      <span>{qty}</span>
                      <button type="button" onClick={() => inquiry.set(p.id, qty + 1)} aria-label={`One more ${p.name}`}>+</button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <div className="sheet-actions">
              <button type="button" className="btn btn-ghost" onClick={inquiry.clear}>
                Clear
              </button>
              <a className="btn btn-wa" href={waLink(message)} target="_blank" rel="noreferrer">
                <WaIcon /> Send inquiry on WhatsApp
              </a>
            </div>
            <SharePhotosButton photos={lines.map(({ p }) => ({ url: p.image, name: p.name }))} text={message} />
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ---------- app ---------- */

export default function App() {
  const route = useRoute();
  const inquiry = useInquiry();
  const [query, setQuery] = useState("");
  const [showInquiry, setShowInquiry] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  // Already logged in on this tab: go straight to the manager
  const staffLogin = () => (readToken() ? openManager() : setShowLogin(true));
  const c = route.catalogue ? findCatalogue(route.catalogue) : undefined;
  const p = c && route.product ? products.find((x) => x.id === route.product) : undefined;
  const count = Object.values(inquiry.items).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (c) setQuery("");
  }, [c?.id]);

  return (
    <>
      <Header query={query} setQuery={setQuery} count={count} onInquiry={() => setShowInquiry(true)} />
      <main>
        <AnimatePresence mode="wait">
          <motion.div key={c?.id ?? "home"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {c ? <CataloguePage c={c} inquiry={inquiry} /> : <Home query={query} inquiry={inquiry} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="foot">
        <img src="/images/logo.png" alt="" />
        <div>
          <strong>{business.fullName}</strong>
          <p>{business.address}</p>
          <p>
            <a href={`tel:${business.phone.replace(/\s/g, "")}`}>{business.phone}</a> · {business.hours} ·{" "}
            <a href={business.instagramUrl} target="_blank" rel="noreferrer">
              {business.instagramHandle}
            </a>
          </p>
        </div>
        <button type="button" className="staff-btn" onClick={staffLogin}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Staff login
        </button>
      </footer>

      <AnimatePresence>
        {count > 0 ? (
          <motion.button
            key="bar"
            type="button"
            className="inq-bar"
            initial={{ y: 90 }}
            animate={{ y: 0 }}
            exit={{ y: 90 }}
            transition={{ type: "spring", bounce: 0.25, visualDuration: 0.4 }}
            onClick={() => setShowInquiry(true)}
          >
            <span>
              <strong>{count}</strong> {count === 1 ? "item" : "items"} in inquiry
            </span>
            <span className="inq-go">
              Review & send <WaIcon />
            </span>
          </motion.button>
        ) : (
          <motion.a key="chat" className="chat" href={waLink("Hi VMount, I saw your catalogue and have a question.")} target="_blank" rel="noreferrer" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <WaIcon /> Chat
          </motion.a>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {p && c && <ProductModal key="product" p={p} cat={c.id} inquiry={inquiry} />}
        {showInquiry && <InquirySheet key="inquiry" inquiry={inquiry} onClose={() => setShowInquiry(false)} />}
      </AnimatePresence>

      <Suspense fallback={null}>
        <AnimatePresence>{showLogin && <StaffLogin key="staff" onToken={openManager} onClose={() => setShowLogin(false)} />}</AnimatePresence>
      </Suspense>
    </>
  );
}
