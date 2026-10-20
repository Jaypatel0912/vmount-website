import { useEffect, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { brand } from "../data/site";
import { TOKEN_KEY, clearStaffLogin } from "./session";
import "../poster/poster.css";

// One login for every staff page (/poster and /cycles), kept for this browser tab.

export function readToken() {
  try {
    const t = sessionStorage.getItem(TOKEN_KEY);
    return t && Number(t.split(".")[0]) > Date.now() ? t : null;
  } catch {
    return null;
  }
}

export function saveToken(t: string | null) {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable: login lasts for this page view only
  }
}

/** Full-screen password popup. */
export function Login({ onToken, title = "Poster maker", subtitle = "Enter the password to make festival posters and offers." }: {
  onToken: (t: string) => void;
  title?: string;
  subtitle?: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/festival/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "Login failed");
      onToken(body.token);
    } catch (err) {
      setError((err as Error).message);
      setShake((n) => n + 1);
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div className="ps-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form
        key={shake}
        className="ps-login"
        onSubmit={submit}
        initial={shake ? { x: 0 } : { opacity: 0, scale: 0.94, y: 10 }}
        animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : { opacity: 1, scale: 1, y: 0 }}
        transition={shake ? { duration: 0.4 } : { type: "spring", visualDuration: 0.4, bounce: 0.2 }}
      >
        <img src={brand.logo} alt="" />
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <input
          type="password"
          autoFocus
          required
          placeholder="Password"
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="ps-notice error">{error}</p>}
        <button className="btn btn-primary" disabled={busy || !password}>
          {busy ? "Checking…" : "Unlock"}
        </button>
        <a href="/" className="ps-back">
          ← Back to website
        </a>
      </motion.form>
    </motion.div>
  );
}

/** Top bar shared by the staff pages: switch pages, go to the website, log out. */
export function StaffBar({ current, loggedIn, onLogout }: { current: "poster" | "cycles"; loggedIn: boolean; onLogout: () => void }) {
  const leave = () => clearStaffLogin(); // going to the website ends the staff login
  return (
    <header className="ps-head">
      <a href="/" className="ps-brand" onClick={leave}>
        <img src={brand.logo} alt="" /> {brand.fullName}
      </a>
      <nav className="staff-bar" aria-label="Staff pages">
        {loggedIn && (
          <>
            <a href="/poster" className={current === "poster" ? "on" : ""} aria-current={current === "poster" ? "page" : undefined}>
              Posters
            </a>
            <a href="/cycles" className={current === "cycles" ? "on" : ""} aria-current={current === "cycles" ? "page" : undefined}>
              Cycles
            </a>
          </>
        )}
        <a href="/" className="btn btn-ghost btn-small" onClick={leave}>
          Website ↗
        </a>
        {loggedIn && (
          <button className="btn btn-ghost btn-small" onClick={onLogout}>
            Log out
          </button>
        )}
      </nav>
    </header>
  );
}

/** If the page is shown again with the back button after visiting the website, ask for the password. */
export function useLoginGuard(setToken: (t: string | null) => void) {
  useEffect(() => {
    const check = () => {
      if (!readToken()) setToken(null);
    };
    window.addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("pageshow", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [setToken]);
}
