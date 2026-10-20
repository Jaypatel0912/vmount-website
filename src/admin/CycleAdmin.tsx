import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { allProducts, brand, categories, type Category, type Product } from "../data/site";
import { Login, StaffBar, readToken, saveToken, useLoginGuard } from "./auth";
import { preparePhoto } from "./photo";
import "./cycles.css";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const LOW_STOCK = 3;

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

type Draft = {
  id: string;
  name: string;
  category: Category;
  price: string;
  stock: string; // "" = not tracked
  image: string;
  color: string;
  tag: string;
  specs: string; // one per line
  featured: boolean;
  visible: boolean;
};

const emptyDraft = (): Draft => ({
  id: "",
  name: "",
  category: "Mountain",
  price: "",
  stock: "",
  image: "",
  color: "#f7941d",
  tag: "",
  specs: "",
  featured: false,
  visible: true,
});

const toDraft = (p: Product): Draft => ({
  id: p.id,
  name: p.name,
  category: p.category,
  price: String(p.price),
  stock: p.stock === null || p.stock === undefined ? "" : String(p.stock),
  image: p.image,
  color: p.color,
  tag: p.tag ?? "",
  specs: p.specs.join("\n"),
  featured: !!p.featured,
  visible: p.visible !== false,
});

const fromDraft = (d: Draft): Product => ({
  id: d.id,
  name: d.name.trim(),
  category: d.category,
  price: Math.round(Number(d.price)),
  stock: d.stock.trim() === "" ? null : Math.round(Number(d.stock)),
  image: d.image,
  color: d.color,
  tag: d.tag.trim(),
  specs: d.specs.split(/\n|,/).map((s) => s.trim()).filter(Boolean).slice(0, 8),
  featured: d.featured,
  visible: d.visible,
});

function stockLabel(p: Product) {
  if (p.stock === null || p.stock === undefined) return { text: "Not tracked", cls: "muted" };
  if (p.stock === 0) return { text: "Out of stock", cls: "out" };
  if (p.stock <= LOW_STOCK) return { text: `Low: ${p.stock}`, cls: "low" };
  return { text: `${p.stock} in stock`, cls: "ok" };
}

export default function CycleAdmin() {
  const [token, setToken] = useState<string | null>(readToken);
  useLoginGuard(setToken);
  const [cycles, setCycles] = useState<Product[]>(() => [...allProducts]);
  const [editing, setEditing] = useState<{ draft: Draft; isNew: boolean; originalId?: string } | null>(null);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<"All" | Category>("All");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    document.title = `Cycles — ${brand.fullName}`;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const logout = () => {
    saveToken(null);
    setToken(null);
  };

  /** Save the whole list to the server. */
  const save = async (next: Product[], message: string) => {
    setBusy("Saving…");
    try {
      const r = await fetch("/api/cycles", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cycles: next }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.status === 401) {
        logout();
        throw new Error("Your login expired. Please enter the password again.");
      }
      if (!r.ok) throw new Error(body.error || "Saving failed");
      setCycles(body.cycles);
      setToast({ kind: "ok", text: `${message} The website shows it within a minute.` });
      return true;
    } catch (e) {
      setToast({ kind: "error", text: (e as Error).message });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cycles.filter((c) => (cat === "All" || c.category === cat) && (!q || `${c.name} ${c.id} ${c.tag}`.toLowerCase().includes(q)));
  }, [cycles, query, cat]);

  const counts = useMemo(
    () => ({
      total: cycles.length,
      hidden: cycles.filter((c) => c.visible === false).length,
      out: cycles.filter((c) => c.stock === 0).length,
      low: cycles.filter((c) => typeof c.stock === "number" && c.stock > 0 && c.stock <= LOW_STOCK).length,
    }),
    [cycles],
  );

  const quickStock = (c: Product, delta: number) => {
    const current = typeof c.stock === "number" ? c.stock : 0;
    const next = cycles.map((x) => (x.id === c.id ? { ...x, stock: Math.max(0, current + delta) } : x));
    save(next, `${c.name}: stock is now ${Math.max(0, current + delta)}.`);
  };

  const toggleVisible = (c: Product) => {
    const next = cycles.map((x) => (x.id === c.id ? { ...x, visible: x.visible === false } : x));
    save(next, c.visible === false ? `${c.name} is shown on the website again.` : `${c.name} is now hidden from the website.`);
  };

  const remove = (c: Product) => {
    if (!window.confirm(`Delete "${c.name}"? It will be removed from the website.\n\nTip: use "Hide" instead if it may come back.`)) return;
    save(
      cycles.filter((x) => x.id !== c.id),
      `${c.name} was deleted.`,
    );
  };

  return (
    <main className="ps cy">
      <StaffBar current="cycles" loggedIn={!!token} onLogout={logout} />

      <AnimatePresence>
        {!token && (
          <Login
            title="Cycle manager"
            subtitle="Enter the password to add cycles, change prices and update stock."
            onToken={(t) => (saveToken(t), setToken(t))}
          />
        )}
      </AnimatePresence>

      {token && (
        <>
          <div className="cy-title">
            <h1>Cycles</h1>
            <button className="btn btn-primary" onClick={() => setEditing({ draft: emptyDraft(), isNew: true })} disabled={!!busy}>
              + Add new cycle
            </button>
          </div>

          <div className="cy-stats">
            <span>
              <strong>{counts.total}</strong> cycles
            </span>
            <span className="cy-out">
              <strong>{counts.out}</strong> out of stock
            </span>
            <span className="cy-low">
              <strong>{counts.low}</strong> low stock
            </span>
            <span>
              <strong>{counts.hidden}</strong> hidden
            </span>
          </div>

          <div className="cy-filters">
            <input type="search" placeholder="Search by name…" aria-label="Search cycles" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select value={cat} onChange={(e) => setCat(e.target.value as typeof cat)} aria-label="Filter by category">
              <option value="All">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <ul className="cy-list">
            {shown.map((c) => {
              const s = stockLabel(c);
              return (
                <motion.li key={c.id} layout className={c.visible === false ? "is-hidden" : ""}>
                  <img src={c.image} alt="" loading="lazy" />
                  <div className="cy-info">
                    <strong>
                      {c.name} {c.tag && <em>{c.tag}</em>}
                    </strong>
                    <span>
                      {c.category} · {inr.format(c.price)}
                      {c.visible === false && " · Hidden"}
                      {c.featured && " · In showroom"}
                    </span>
                  </div>
                  <div className="cy-stock">
                    <span className={`cy-badge ${s.cls}`}>{s.text}</span>
                    <div className="cy-step">
                      <button aria-label={`One less ${c.name}`} onClick={() => quickStock(c, -1)} disabled={!!busy || !c.stock}>
                        −
                      </button>
                      <button aria-label={`One more ${c.name}`} onClick={() => quickStock(c, 1)} disabled={!!busy}>
                        +
                      </button>
                    </div>
                  </div>
                  <div className="cy-actions">
                    <button className="btn btn-ghost btn-small" onClick={() => setEditing({ draft: toDraft(c), isNew: false, originalId: c.id })} disabled={!!busy}>
                      Edit
                    </button>
                    <button className="btn btn-ghost btn-small" onClick={() => toggleVisible(c)} disabled={!!busy}>
                      {c.visible === false ? "Show" : "Hide"}
                    </button>
                    <button className="btn btn-ghost btn-small cy-del" onClick={() => remove(c)} disabled={!!busy} aria-label={`Delete ${c.name}`}>
                      Delete
                    </button>
                  </div>
                </motion.li>
              );
            })}
            {!shown.length && <li className="cy-empty">No cycles match your search.</li>}
          </ul>

          <AnimatePresence>
            {editing && (
              <CycleForm
                key="form"
                initial={editing.draft}
                isNew={editing.isNew}
                taken={new Set(cycles.filter((c) => c.id !== editing.originalId).map((c) => c.id))}
                token={token}
                busy={busy}
                onCancel={() => setEditing(null)}
                onExpired={logout}
                onSave={async (p) => {
                  const next = editing.isNew ? [p, ...cycles] : cycles.map((c) => (c.id === editing.originalId ? p : c));
                  if (await save(next, editing.isNew ? `${p.name} was added.` : `${p.name} was updated.`)) setEditing(null);
                }}
              />
            )}
          </AnimatePresence>
        </>
      )}

      <AnimatePresence>
        {toast && (
          <motion.p
            className={`cy-toast ${toast.kind}`}
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {toast.text}
          </motion.p>
        )}
      </AnimatePresence>
    </main>
  );
}

function CycleForm(props: {
  initial: Draft;
  isNew: boolean;
  taken: Set<string>;
  token: string;
  busy: string | null;
  onCancel: () => void;
  onExpired: () => void;
  onSave: (p: Product) => void;
}) {
  const { initial, isNew, taken, token, busy, onCancel, onExpired, onSave } = props;
  const [d, setD] = useState<Draft>(initial);
  const [idTouched, setIdTouched] = useState(!isNew);
  const [cutOut, setCutOut] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !uploading && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, uploading]);

  const upload = async (f: File, cut: boolean) => {
    setUploading(true);
    setError(null);
    try {
      const dataUrl = await preparePhoto(f, cut);
      const r = await fetch("/api/cycles/image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dataUrl, name: d.name || f.name.replace(/\.[^.]+$/, "") }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.status === 401) {
        onExpired();
        throw new Error("Your login expired. Please enter the password again.");
      }
      if (!r.ok) throw new Error(body.error || "Photo upload failed");
      set("image", body.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = d.id || slug(d.name);
    const price = Number(d.price);
    if (!d.name.trim()) return setError("Enter the cycle name.");
    if (!id || !/^[a-z0-9-]+$/.test(id)) return setError("The short ID may only use lowercase letters, numbers and dashes.");
    if (taken.has(id)) return setError(`Another cycle already uses the ID "${id}". Change the ID.`);
    if (!(price > 0)) return setError("Enter the price.");
    if (d.stock.trim() !== "" && !(Number(d.stock) >= 0)) return setError("Stock must be 0 or more (or leave it empty).");
    if (!d.image) return setError("Add a photo of the cycle.");
    onSave(fromDraft({ ...d, id }));
  };

  return (
    <motion.div className="ps-overlay cy-modal-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !uploading && onCancel()}>
      <motion.form
        className="cy-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Add new cycle" : `Edit ${initial.name}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        noValidate
      >
        <div className="cy-modal-head">
          <h2>{isNew ? "Add new cycle" : `Edit ${initial.name}`}</h2>
          <button type="button" className="cy-x" aria-label="Close" onClick={onCancel} disabled={uploading}>
            ✕
          </button>
        </div>

        <div className="cy-form-grid">
          <div className="cy-photo">
            <div className="cy-photo-box">
              {uploading ? <span>Cleaning photo…</span> : d.image ? <img src={d.image} alt="Cycle photo" /> : <span>No photo yet</span>}
            </div>
            <label className="btn btn-ghost btn-small cy-file">
              {d.image ? "Change photo" : "Upload photo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setFile(f);
                  upload(f, cutOut);
                }}
              />
            </label>
            <label className="cy-check">
              <input
                type="checkbox"
                checked={cutOut}
                onChange={(e) => {
                  setCutOut(e.target.checked);
                  if (file) upload(file, e.target.checked);
                }}
              />
              Remove white background
            </label>
            <small>Best result: cycle on a plain white background, side view.</small>
          </div>

          <div className="cy-fields">
            <label className="ps-field">
              <span className="ps-label">Cycle name *</span>
              <input
                required
                value={d.name}
                onChange={(e) => setD((x) => ({ ...x, name: e.target.value, id: idTouched ? x.id : slug(e.target.value) }))}
                placeholder="e.g. Duster 26T"
              />
            </label>
            <div className="ps-row">
              <label className="ps-field">
                <span className="ps-label">Category *</span>
                <select value={d.category} onChange={(e) => set("category", e.target.value as Category)}>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="ps-field">
                <span className="ps-label">Price (₹) *</span>
                <input type="number" min={0} required value={d.price} onChange={(e) => set("price", e.target.value)} placeholder="e.g. 12499" />
              </label>
            </div>
            <div className="ps-row">
              <label className="ps-field">
                <span className="ps-label">Stock (pieces)</span>
                <input type="number" min={0} value={d.stock} onChange={(e) => set("stock", e.target.value)} placeholder="Empty = not tracked" />
              </label>
              <label className="ps-field">
                <span className="ps-label">Badge (optional)</span>
                <input maxLength={24} value={d.tag} onChange={(e) => set("tag", e.target.value)} placeholder="e.g. New, Bestseller" />
              </label>
            </div>
            <label className="ps-field">
              <span className="ps-label">Key features (one per line, up to 8)</span>
              <textarea rows={3} value={d.specs} onChange={(e) => set("specs", e.target.value)} placeholder={"Dual disc brakes\n26\" alloy rims\nFront suspension"} />
            </label>
            <div className="ps-row">
              <label className="ps-field">
                <span className="ps-label">Highlight colour</span>
                <input type="color" className="cy-color" value={d.color} onChange={(e) => set("color", e.target.value)} />
              </label>
              <label className="ps-field">
                <span className="ps-label">Short ID (used in links)</span>
                <input
                  value={d.id}
                  onChange={(e) => {
                    setIdTouched(true);
                    set("id", slug(e.target.value));
                  }}
                  placeholder="auto from name"
                />
              </label>
            </div>
            <div className="cy-toggles">
              <label className="cy-check">
                <input type="checkbox" checked={d.visible} onChange={(e) => set("visible", e.target.checked)} /> Show on website
              </label>
              <label className="cy-check">
                <input type="checkbox" checked={d.featured} onChange={(e) => set("featured", e.target.checked)} /> Show in 360° showroom
              </label>
            </div>
          </div>
        </div>

        {error && <p className="ps-notice error">{error}</p>}
        <div className="ps-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={uploading}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={uploading || !!busy}>
            {busy ?? (isNew ? "Add cycle" : "Save changes")}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
