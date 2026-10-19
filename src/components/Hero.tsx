import { lazy, Suspense, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { brand, hero, heroColors } from "../data/site";

const Bike3D = lazy(() => import("./Bike3D"));

const words = ["Passion", "for", "Cycling."];

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const [color, setColor] = useState(heroColors[0]);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section ref={ref} className="hero" id="top" style={{ ["--accent" as string]: color }}>
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
        <motion.div className="swatches" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
          <span>Frame colour</span>
          {heroColors.map((c) => (
            <button key={c} aria-label={`Frame colour ${c}`} onClick={() => setColor(c)} style={{ background: c }}>
              {c === color && <motion.span layoutId="swatch-ring" className="swatch-ring" />}
            </button>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        className="hero-canvas"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 1 }}
      >
        <Suspense fallback={<div className="canvas-loading">Loading 3D…</div>}>
          <Bike3D color={color} scroll={scrollYProgress} />
        </Suspense>
        <span className="drag-hint">Move your cursor to look around</span>
      </motion.div>

      <motion.a href="#marquee" className="scroll-cue" aria-label="Scroll down" animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}>
        ↓
      </motion.a>
    </section>
  );
}
