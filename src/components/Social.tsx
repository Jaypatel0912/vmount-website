import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { brand, promo } from "../data/site";

export function Promo() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const rotate = useTransform(scrollYProgress, [0, 1], [-4, 4]);

  return (
    <section className="section promo" ref={ref}>
      <motion.div
        className="promo-copy"
        initial={{ opacity: 0, x: -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-80px" }}
      >
        <span className="eyebrow">{promo.eyebrow}</span>
        <h2>
          {brand.name} <span className="accent-text">{promo.title}</span>
        </h2>
        <p className="muted">{promo.text}</p>
        <ul className="promo-list">
          {promo.points.map((pt) => (
            <li key={pt}>{pt}</li>
          ))}
        </ul>
        <motion.a href="#shop" className="btn btn-primary" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
          See all models
        </motion.a>
      </motion.div>
      <motion.div className="promo-poster" style={{ y, rotate }}>
        <img src={promo.image} alt={`${brand.name} ${promo.title}`} loading="lazy" />
      </motion.div>
    </section>
  );
}
