import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { business, dealerCodeFromPath, loadCatalog, loadDealer, waLink } from "./data";
import "./styles.css";

const path = window.location.pathname.replace(/\/+$/, "");
const isAdmin = path === "/admin";
const dealerCode = dealerCodeFromPath();

/** Shown when a dealer link is wrong, switched off or replaced. */
function DealerLinkProblem({ message }: { message: string }) {
  return (
    <main className="link-problem">
      <img src="/images/logo.png" alt="" />
      <h1>Dealer link not active</h1>
      <p>{message}</p>
      <a className="btn btn-wa" href={waLink("Hi VMount, my dealer price-list link isn't working. Please send me a new one.")} target="_blank" rel="noreferrer">
        Ask {business.name} on WhatsApp
      </a>
      <a className="link-problem-home" href="/">
        Open the regular catalogue
      </a>
    </main>
  );
}

// The saved product list (and, on a dealer link, that dealer's prices) load first,
// so every screen sees the latest stock and prices.
async function start() {
  const [, dealerError] = await Promise.all([loadCatalog(), dealerCode ? loadDealer(dealerCode) : Promise.resolve(null)]);
  let Page: ComponentType;
  if (isAdmin) Page = (await import("./admin/Admin")).default;
  else if (dealerError) Page = () => <DealerLinkProblem message={dealerError} />;
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
