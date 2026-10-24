import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { loadCatalog } from "./data";
import "./styles.css";

const isAdmin = window.location.pathname.replace(/\/+$/, "") === "/admin";

// The saved product list is loaded first, so every screen sees the latest stock.
async function start() {
  await loadCatalog();
  const Page: ComponentType = isAdmin ? (await import("./admin/Admin")).default : (await import("./App")).default;
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <MotionConfig reducedMotion="user">
        <Page />
      </MotionConfig>
    </StrictMode>,
  );
}

start();
