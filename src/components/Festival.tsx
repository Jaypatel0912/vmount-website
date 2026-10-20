import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { brand, waLink } from "../data/site";
import { festivalEnds, formatDay, inr, type Festival, type OfferBike } from "../data/festival";

function useCountdown(end: Date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, end.getTime() - now);
  return {
    d: Math.floor(left / 86400000),
    h: Math.floor(left / 3600000) % 24,
    m: Math.floor(left / 60000) % 60,
    s: Math.floor(left / 1000) % 60,
    done: left === 0,
  };
}

/** Rotating rangoli drawn from rings of petals. */
function Rangoli() {
  const rings = [
    { r: 92, n: 24, len: 24, w: 8, color: "#f7c04a" },
    { r: 68, n: 16, len: 26, w: 11, color: "#ff7a1a" },
    { r: 44, n: 12, len: 22, w: 10, color: "#e8457a" },
    { r: 24, n: 8, len: 16, w: 8, color: "#ffd56b" },
  ];
  return (
    <motion.svg
      className="fest-rangoli"
      viewBox="-100 -100 200 200"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 140, ease: "linear" }}
    >
      {rings.map((ring) =>
        Array.from({ length: ring.n }, (_, i) => (
          <ellipse
            key={`${ring.r}-${i}`}
            cx={0}
            cy={-(ring.r - ring.len / 2)}
            rx={ring.w / 2}
            ry={ring.len / 2}
            fill={ring.color}
            fillOpacity={0.55}
            stroke="#ffe6a8"
            strokeOpacity={0.6}
            strokeWidth={0.6}
            transform={`rotate(${(i * 360) / ring.n})`}
          />
        )),
      )}
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i / 36) * Math.PI * 2;
        return <circle key={i} cx={Math.cos(a) * 97} cy={Math.sin(a) * 97} r={1.6} fill="#ffe6a8" />;
      })}
      <circle r={9} fill="#f7941d" />
      <circle r={4} fill="#ffe6a8" />
    </motion.svg>
  );
}

/** Marigold and mango-leaf garland hung across the top. */
function Toran() {
  const items = Array.from({ length: 31 }, (_, i) => {
    const t = i / 30;
    const x = t * 1200;
    const y = 14 + Math.sin(t * Math.PI * 3) ** 2 * 26;
    return { x, y, i };
  });
  return (
    <svg className="fest-toran" viewBox="0 0 1200 90" preserveAspectRatio="none" aria-hidden>
      <path d={`M0 14 ${items.map((p) => `L${p.x} ${p.y}`).join(" ")}`} stroke="#c98b2a" strokeWidth={2} fill="none" />
      {items.map(({ x, y, i }) =>
        i % 2 ? (
          <ellipse key={i} cx={x} cy={y + 18} rx={6} ry={15} fill="#2f8f3a" transform={`rotate(${i % 4 === 1 ? 8 : -8} ${x} ${y})`} />
        ) : (
          <g key={i}>
            <circle cx={x} cy={y + 6} r={10} fill={i % 4 === 0 ? "#f7941d" : "#ffc21a"} />
            <circle cx={x} cy={y + 6} r={4} fill="#c2410c" />
          </g>
        ),
      )}
    </svg>
  );
}

function Diya({ delay }: { delay: number }) {
  return (
    <svg className="diya" viewBox="-40 -60 80 80" aria-hidden>
      <defs>
        <radialGradient id="flame" cx="50%" cy="70%" r="60%">
          <stop offset="0%" stopColor="#fffbe6" />
          <stop offset="45%" stopColor="#ffd34d" />
          <stop offset="100%" stopColor="#ff7a1a" />
        </radialGradient>
        <linearGradient id="bowl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2672a" />
          <stop offset="100%" stopColor="#7a250b" />
        </linearGradient>
      </defs>
      <circle cy={-22} r={26} fill="#ffb347" opacity={0.18} />
      <path className="flame" style={{ animationDelay: `${delay}s` }} d="M0 -46 C 11 -28, 10 -12, 0 -6 C -10 -12, -11 -28, 0 -46 Z" fill="url(#flame)" />
      <path d="M-34 -4 Q0 26 34 -4 Z" fill="url(#bowl)" />
      <ellipse cy={-4} rx={34} ry={5} fill="#f7c04a" />
    </svg>
  );
}

export function FestivalSection({ f, offers: all }: { f: Festival; offers: OfferBike[] }) {
  // Common offers apply to every cycle; show the best few here, the shop shows the rest
  const offers = f.appliesTo === "all" ? [...all].sort((a, b) => b.save - a.save || Number(!!b.featured) - Number(!!a.featured)).slice(0, 4) : all;
  const greeting = f.mode === "greeting";
  const best = offers.reduce((m, o) => Math.max(m, o.save), 0);
  const t = useCountdown(festivalEnds(f));
  const sparks = useMemo(
    () => Array.from({ length: 28 }, (_, i) => ({ left: (i * 37) % 100, top: 8 + ((i * 53) % 84), delay: (i % 7) * 0.6, size: 2 + (i % 3) })),
    [],
  );

  return (
    <section className={`fest fest-${f.design}`} id="offers">
      <div className="fest-bg" aria-hidden>
        <Rangoli />
        {sparks.map((s, i) => (
          <motion.span
            key={i}
            className="fest-spark"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size * 2, height: s.size * 2 }}
            animate={{ opacity: [0, 1, 0], scale: [0.6, 1.2, 0.6] }}
            transition={{ repeat: Infinity, duration: 3.2, delay: s.delay }}
          />
        ))}
        <Toran />
      </div>

      <div className="fest-inner">
        <motion.div
          className="fest-head"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
        >
          {f.posters && (
            <motion.picture
              className="fest-poster"
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <source media="(max-width: 700px)" srcSet={f.posters.square} />
              <img src={f.posters.wide} alt={`${f.name} poster from ${brand.fullName}`} />
            </motion.picture>
          )}
          {f.greetingLocal && <span className="fest-local">{f.greetingLocal}</span>}
          <span className="eyebrow">
            {f.greeting} · {brand.fullName}
          </span>
          <h2>{f.headline}</h2>
          <p>
            {f.subline}
            {best > 0 && <> — save up to {inr.format(best)}</>}
          </p>
          {greeting && <p className="fest-sign">— Team {brand.fullName}</p>}
          {!greeting && !t.done && (
            <div className="countdown" role="timer" aria-label="Time left in the offer">
              {(
                [
                  [t.d, "days"],
                  [t.h, "hrs"],
                  [t.m, "min"],
                  [t.s, "sec"],
                ] as const
              ).map(([v, l]) => (
                <div key={l}>
                  <strong>{String(v).padStart(2, "0")}</strong>
                  <span>{l}</span>
                </div>
              ))}
            </div>
          )}
          {!greeting && <p className="fest-until">Offer till {formatDay(f.end)}</p>}
          {f.appliesTo === "all" && f.discountValue > 0 && (
            <p className="fest-all">
              {f.discountType === "percent" ? `${f.discountValue}% off` : `${inr.format(f.discountValue)} off`} on every VMount cycle
            </p>
          )}
          {f.extras && <span className="fest-extra">{greeting ? "✨" : "🎁"} {f.extras}</span>}
          {greeting && (
            <div className="fest-cta">
              <a className="btn btn-primary" href="#shop">
                Explore our cycles
              </a>
              <a className="btn btn-wa" href={waLink(`Hi VMount, ${f.greeting}! I'd like to know more about your cycles.`)} target="_blank" rel="noreferrer">
                WhatsApp us
              </a>
            </div>
          )}
        </motion.div>

        <div className="fest-grid">
          {offers.map((b, i) => (
            <motion.article
              key={b.id}
              className="fest-card"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6 }}
            >
              {b.save > 0 && <span className="fest-save">Save {inr.format(b.save)}</span>}
              <div className="fest-img">
                <img src={b.image} alt={b.name} loading="lazy" />
              </div>
              <span className="fest-cat">{b.category}</span>
              <h3>{b.name}</h3>
              <div className="fest-price">
                {b.save > 0 && <s>{inr.format(b.price)}</s>}
                <strong>{inr.format(b.offerPrice)}</strong>
              </div>
              <a
                className="btn btn-wa btn-small"
                href={waLink(`Hi VMount, I'd like the ${f.name} offer on the ${b.name} (${inr.format(b.offerPrice)}).`)}
                target="_blank"
                rel="noreferrer"
              >
                Claim on WhatsApp
              </a>
            </motion.article>
          ))}
        </div>

        <div className="diyas">
          {[0, 0.4, 0.8, 0.2, 0.6].map((d, i) => (
            <Diya key={i} delay={d} />
          ))}
        </div>
        {f.terms && <p className="fest-terms">{f.terms}</p>}
      </div>
    </section>
  );
}

/** Small floating reminder at the bottom of the screen; can be closed. */
export function FestivalPill({ f }: { f: Festival }) {
  const key = `fest-pill-${f.id}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(key) === "closed";
    } catch {
      return false;
    }
  });
  const t = useCountdown(festivalEnds(f));
  if (t.done) return null;

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          className="fest-pill"
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ delay: 1.5, type: "spring", visualDuration: 0.5, bounce: 0.25 }}
        >
          <span aria-hidden>🪔</span>
          <span>{f.mode === "greeting" ? `${f.greeting} from ${brand.fullName}` : f.headline}</span>
          {f.mode !== "greeting" && (
            <span className="fest-pill-time">
              · ends in {t.d}d {t.h}h
            </span>
          )}
          <a href="#offers">{f.mode === "greeting" ? "See wishes" : "See offers"}</a>
          <button
            aria-label="Close offer reminder"
            onClick={() => {
              setHidden(true);
              try {
                sessionStorage.setItem(key, "closed");
              } catch {
                // storage unavailable — just hide for this page view
              }
            }}
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
