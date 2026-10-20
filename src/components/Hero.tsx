import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { brand, hero, heroBikes } from "../data/site";

const words = ["Passion", "for", "Cycling."];
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const bike = heroBikes[index];

  // Scroll: copy drifts up and fades; the bike stage sinks back slightly
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const stageY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const stageScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);

  // Pointer: the bike tilts in 3D toward the cursor
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-1, 1], [-14, 14]), { stiffness: 120, damping: 18 });
  const rotateX = useSpring(useTransform(py, [-1, 1], [8, -8]), { stiffness: 120, damping: 18 });
  const glowX = useSpring(useTransform(px, [-1, 1], [-40, 40]), { stiffness: 80, damping: 20 });
  const wordX = useSpring(useTransform(px, [-1, 1], [30, -30]), { stiffness: 60, damping: 20 });

  return (
    <section
      ref={ref}
      className="hero"
      id="top"
      style={{ ["--accent" as string]: bike.color }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        px.set(((e.clientX - r.left) / r.width) * 2 - 1);
        py.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
    >
      <div className="hero-glow" />
      <motion.div className="hero-copy" style={{ y: textY, opacity: textOpacity }}>
        <motion.span className="eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {hero.eyebrow}
        </motion.span>
        <h1>
          {words.map((w, i) => (
            <span className="word-mask" key={i}>
              <motion.span
                className={i === 2 ? "accent-text" : undefined}
                initial={{ y: "110%" }}
                animate={{ y: 0 }}
                transition={{ delay: 0.2 + i * 0.08, type: "spring", visualDuration: 0.6, bounce: 0.2 }}
              >
                {w}
              </motion.span>
              {i === 1 && <br />}
            </span>
          ))}
        </h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
          {hero.intro}
        </motion.p>
        <motion.div className="hero-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}>
          <motion.a href="#shop" className="btn btn-primary" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            Shop bikes
          </motion.a>
          <motion.a href="#contact" className="btn btn-ghost" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            Visit the factory
          </motion.a>
        </motion.div>
        <motion.a
          className="hero-rating"
          href={brand.google.url}
          target="_blank"
          rel="noreferrer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.95 }}
        >
          <span className="hero-rating-star">★</span> {brand.google.rating} · {brand.google.reviews} Google reviews · {brand.category}
        </motion.a>
        {heroBikes.length > 1 && (
          <motion.div className="swatches" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
            <span>Pick your ride</span>
            {heroBikes.map((b, i) => (
              <button key={b.id} aria-label={`Show ${b.name}`} aria-pressed={i === index} onClick={() => setIndex(i)} style={{ background: b.color }}>
                {i === index && <motion.span layoutId="swatch-ring" className="swatch-ring" />}
              </button>
            ))}
          </motion.div>
        )}
      </motion.div>

      <motion.div className="hero-stage" style={{ y: stageY, scale: stageScale }}>
        <motion.span className="hero-word" style={{ x: wordX }} aria-hidden>
          {brand.name.toUpperCase()}
        </motion.span>
        <motion.div className="stage-glow" style={{ x: glowX }} />
        <div className="stage-floor" aria-hidden>
          <span />
          <span />
        </div>

        <motion.div className="hero-bike-tilt" style={{ rotateX, rotateY }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.img
              key={bike.id}
              src={bike.image}
              alt={`${brand.name} ${bike.name}`}
              className="hero-bike"
              draggable={false}
              initial={{ x: 160, opacity: 0, filter: "blur(10px)" }}
              animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ x: -160, opacity: 0, filter: "blur(10px)" }}
              transition={{ type: "spring", visualDuration: 0.55, bounce: 0.15 }}
            />
          </AnimatePresence>
        </motion.div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.a
            key={bike.id}
            href="#shop"
            className="hero-tag"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <span className="hero-tag-cat">{bike.category}</span>
            <strong>{bike.name}</strong>
            <span className="hero-tag-price">{inr.format(bike.price)}</span>
          </motion.a>
        </AnimatePresence>
      </motion.div>

      <motion.a href="#marquee" className="scroll-cue" aria-label="Scroll down" animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}>
        ↓
      </motion.a>
    </section>
  );
}
