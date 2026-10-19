import { useRef, useState } from "react";
import { motion, useAnimationFrame, useMotionValue, useTransform } from "motion/react";
import { showcase } from "../data/site";

const ITEM_W = 340;
const STEP = 360 / showcase.length;
const RADIUS = Math.round(ITEM_W / 2 / Math.tan(Math.PI / showcase.length)) + 40;

/** A 3D ring of real bike photos that spins on its own and can be dragged. */
export default function Showcase() {
  const rotation = useMotionValue(0);
  const dragging = useRef(false);
  const hovering = useRef(false);
  const [front, setFront] = useState(0);
  const transform = useTransform(() => `translateZ(${-RADIUS}px) rotateY(${rotation.get()}deg)`);

  useAnimationFrame((_, delta) => {
    if (!dragging.current && !hovering.current) rotation.set(rotation.get() - delta * 0.012);
    const idx = ((Math.round(-rotation.get() / STEP) % showcase.length) + showcase.length) % showcase.length;
    if (idx !== front) setFront(idx);
  });

  const current = showcase[front];

  return (
    <section className="showcase" id="showcase">
      <div className="section-head center">
        <span className="eyebrow">360° showroom</span>
        <h2>Spin through the range</h2>
        <p className="muted">Drag to turn the ring. Every bike here is built in our own factory.</p>
      </div>

      <motion.div
        className="ring-stage"
        onPanStart={() => (dragging.current = true)}
        onPan={(_, info) => rotation.set(rotation.get() + info.delta.x * 0.25)}
        onPanEnd={() => (dragging.current = false)}
        onHoverStart={() => (hovering.current = true)}
        onHoverEnd={() => (hovering.current = false)}
      >
        <motion.div className="ring" style={{ transform }}>
          {showcase.map((p, i) => (
            <div
              key={p.id}
              className={`ring-item${i === front ? " is-front" : ""}`}
              style={{ transform: `rotateY(${i * STEP}deg) translateZ(${RADIUS}px)`, ["--card" as string]: p.color }}
            >
              <img src={p.image} alt={p.name} draggable={false} />
            </div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div key={current.id} className="ring-caption" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <span style={{ color: current.color }}>{current.category}</span>
        <strong>{current.name}</strong>
      </motion.div>
    </section>
  );
}
