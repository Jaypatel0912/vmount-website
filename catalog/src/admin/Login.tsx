import { useEffect, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { saveToken } from "./token";
import "./admin.css";

/**
 * Staff password popup. Used on /admin, and from the catalogue's "Staff login" button
 * (there it gets onClose, so it can be dismissed and the customer page stays put).
 */
export default function Login({ onToken, onClose }: { onToken: (t: string) => void; onClose?: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/catalog/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }).catch(() => {
        throw new Error("Can't reach the server — check the internet connection and try again");
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "Login failed");
      saveToken(body.token);
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
    <motion.div className="ad-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && onClose?.()}>
      <motion.form
        key={shake}
        className="ad-login"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Staff login"
        initial={shake ? { x: 0 } : { opacity: 0, scale: 0.94, y: 10 }}
        animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : { opacity: 1, scale: 1, y: 0 }}
        transition={shake ? { duration: 0.4 } : { type: "spring", visualDuration: 0.4, bounce: 0.2 }}
      >
        <img src="/images/logo.png" alt="" />
        <h1>Catalogue manager</h1>
        <p>Enter the staff password to update products, stock and collections.</p>
        <input type="password" autoFocus required placeholder="Password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && (
          <p className="ad-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Checking…" : "Unlock"}
        </button>
        {onClose ? (
          <button type="button" className="ad-link ad-link-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        ) : (
          <a className="ad-link" href="/">
            ← Back to catalogue
          </a>
        )}
      </motion.form>
    </motion.div>
  );
}
