import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { loadCatalog } from "./data/site";
import { clearStaffLogin } from "./admin/session";
import "./styles.css";

const path = window.location.pathname.replace(/\/+$/, "");

// Pages are imported after the cycle list is loaded, so every section sees the latest cycles.
async function start() {
  const staffPage = path === "/cycles" || path === "/poster" || path === "/posters";
  // Visiting the public website ends any staff login, so staff pages ask for the password again
  if (!staffPage) clearStaffLogin();
  await loadCatalog();
  let Page: ComponentType;
  if (path === "/cycles") Page = (await import("./admin/CycleAdmin")).default;
  else if (path === "/poster" || path === "/posters") Page = (await import("./poster/PosterAdmin")).default;
  else Page = (await import("./App")).default;

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <MotionConfig reducedMotion="user">
        <Page />
      </MotionConfig>
    </StrictMode>,
  );
}

start();
