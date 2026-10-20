import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import App from "./App";
import PosterAdmin from "./poster/PosterAdmin";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      {["/poster", "/posters"].includes(window.location.pathname.replace(/\/+$/, "")) ? <PosterAdmin /> : <App />}
    </MotionConfig>
  </StrictMode>
);
