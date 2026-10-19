import { useState } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import Hero from "./components/Hero";
import Products from "./components/Products";
import Showcase from "./components/Showcase";
import { Promo } from "./components/Social";
import InstagramFeed from "./components/InstagramFeed";
import { Contact, Footer, Marquee, Nav, Reviews, Why } from "./components/Sections";

export default function App() {
  const [cart, setCart] = useState(0);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });

  return (
    <>
      <motion.div className="progress" style={{ scaleX: progress }} />
      <Nav cart={cart} />
      <main>
        <Hero />
        <Marquee />
        <Showcase />
        <Products onAdd={() => setCart((c) => c + 1)} />
        <Promo />
        <Why />
        <InstagramFeed />
        <Reviews />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
