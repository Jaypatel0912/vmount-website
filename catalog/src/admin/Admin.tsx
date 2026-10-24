import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { allGroups, allProducts, inr, setGroups, setProducts, type Group, type Product } from "../data";
import { AuthError, api, readToken, saveToken, slug, uploadPhoto } from "./api";
import CollectionsPanel from "./CollectionsPanel";
import Login from "./Login";
import "./admin.css";

/* ---------- helpers ---------- */


type Status = "all" | "out" | "low" | "hidden" | "tracked";
const STATUS_LABEL: Record<Status, string> = { all: "All", out: "Out of stock", low: "Low stock (1–3)", hidden: "Hidden", tracked: "Stock tracked" };
const matches = (p: Product, s: Status) =>
  s === "all" ||
  (s === "out" && p.stock === 0) ||
  (s === "low" && typeof p.stock === "number" && p.stock > 0 && p.stock <= 3) ||
  (s === "hidden" && p.visible === false) ||
  (s === "tracked" && typeof p.stock === "number");

type Save = { state: "idle" | "saving" | "saved" | "error"; message?: string };

/* ---------- main page ---------- */

export default function Admin() {
  const [token, setToken] = useState<string | null>(readToken);
  const [items, setItems] = useState<Product[]>(() => allProducts.map((p) => ({ ...p })));
  const [cols, setCols] = useState<Group[]>(() => structuredClone(allGroups));
  const [tab, setTab] = useState<"products" | "collections">("products");
  const [dirty, setDirty] = useState(0);
  const [save, setSave] = useState<Save>({ state: "idle" });
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState<Status>("all");
  const [editing, setEditing] = useState<{ p: Product; isNew: boolean } | null>(null);
  const latest = useRef({ items, cols });
  latest.current = { items, cols };

  useEffect(() => {
    document.title = "Catalogue manager — VMount";
  }, []);

  // Auto-save shortly after the last change
  useEffect(() => {
    if (!dirty || !token) return;
    setSave({ state: "saving" });
    const t = setTimeout(async () => {
      try {
        const { items: products, cols: groups } = latest.current;
        const saved = await api<{ products: Product[]; groups: Group[] }>("/api/catalog", token, { method: "PUT", body: JSON.stringify({ products, groups }) });
        setProducts(saved.products);
        setGroups(saved.groups);
        setSave({ state: "saved" });
      } catch (err) {
        if (err instanceof AuthError) {
          saveToken(null);
          setToken(null);
        }
        setSave({ state: "error", message: (err as Error).message });
      }
    }, 700);
    return () => clearTimeout(t);
  }, [dirty, token]);

  // Warn before closing the tab while a save is pending (not when logging out on purpose)
  const leaving = useRef(false);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!leaving.current && (save.state === "saving" || save.state === "error")) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save.state]);

  const change = (next: Product[]) => {
    setItems(next);
    setDirty((n) => n + 1);
  };
  const update = (id: string, patch: Partial<Product>) => change(items.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const changeCols = (next: Group[], nextItems?: Product[]) => {
    setCols(next);
    if (nextItems) setItems(nextItems);
    setDirty((n) => n + 1);
  };
  const catTitle = useMemo(() => new Map(cols.flatMap((g) => g.catalogues.map((c) => [c.id, c.title] as const))), [cols]);
  const titles = (p: Product) => p.catalogues.map((c) => catTitle.get(c) ?? c).join(", ");

  const counts = useMemo(
    () => ({
      all: items.length,
      out: items.filter((p) => matches(p, "out")).length,
      low: items.filter((p) => matches(p, "low")).length,
      hidden: items.filter((p) => matches(p, "hidden")).length,
    }),
    [items],
  );

  const shown = items.filter((p) => {
    if (cat !== "all" && !p.catalogues.includes(cat)) return false;
    if (!matches(p, status)) return false;
    const q = query.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q);
  });

  // End the session and go back to the catalogue (staying here would just show the password popup again)
  const logout = () => {
    const unsaved = save.state === "saving" || save.state === "error";
    if (unsaved && !window.confirm("Some changes haven't been saved yet. Log out anyway and lose them?")) return;
    leaving.current = true;
    saveToken(null);
    window.location.replace("/");
  };

  return (
    <div className="ad">
      <header className="ad-top">
        <a className="brand" href="/">
          <img src="/images/logo.png" alt="" />
          <span>
            <strong>Catalogue manager</strong>
            <small>V Mount Bikes</small>
          </span>
        </a>
        <span className={`ad-save is-${save.state}`} role="status">
          {save.state === "saving" ? "Saving…" : save.state === "saved" ? "✓ All changes saved" : save.state === "error" ? `⚠ ${save.message}` : "Changes save automatically"}
        </span>
        {save.state === "error" && token && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDirty((n) => n + 1)}>
            Retry
          </button>
        )}
        <a className="btn btn-ghost btn-sm" href="/" target="_blank" rel="noreferrer">
          View catalogue ↗
        </a>
        <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
          Log out
        </button>
      </header>

      <main className="ad-main">
        <div className="ad-tabs" role="tablist" aria-label="Manage">
          {(["products", "collections"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "is-on" : ""} onClick={() => setTab(t)}>
              {tab === t && <motion.span layoutId="ad-tab-pill" className="ad-tab-pill" transition={{ type: "spring", bounce: 0.2, visualDuration: 0.3 }} />}
              <span>{t === "products" ? `Products (${items.length})` : `Collections (${cols.reduce((n, g) => n + g.catalogues.length, 0)})`}</span>
            </button>
          ))}
        </div>

        {tab === "collections" ? (
          <CollectionsPanel
            groups={cols}
            products={items}
            token={token}
            onChange={changeCols}
            onExpired={() => {
              saveToken(null);
              setToken(null);
            }}
            onShowProducts={(id) => {
              setCat(id);
              setStatus("all");
              setQuery("");
              setTab("products");
            }}
          />
        ) : (
        <>
        <div className="ad-stats">
          {(["all", "out", "low", "hidden"] as const).map((s) => (
            <button key={s} type="button" className={`ad-stat is-${s}${status === s ? " is-on" : ""}`} onClick={() => setStatus(s)}>
              <strong>{counts[s]}</strong>
              <span>{s === "all" ? "Products" : STATUS_LABEL[s]}</span>
            </button>
          ))}
        </div>

        <div className="ad-tools">
          <label className="search">
            <input type="search" placeholder="Search products…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search products" />
          </label>
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Collection">
            <option value="all">All collections</option>
            {cols.map((g) => (
              <optgroup key={g.id} label={g.title}>
                {g.catalogues.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({items.filter((p) => p.catalogues.includes(c.id)).length})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Stock filter">
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              setEditing({
                isNew: true,
                p: { id: "", name: "", catalogues: cat === "all" ? [] : [cat], image: "", specs: [], tag: "", price: null, stock: null, visible: true },
              })
            }
          >
            + Add product
          </button>
        </div>

        <p className="ad-count muted">
          Showing {shown.length} of {items.length}. Tap − / + to change stock. Empty stock = not tracked (always shown as available).
        </p>

        <ul className="ad-list">
          <AnimatePresence initial={false}>
            {shown.map((p) => (
              <motion.li key={p.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -30 }} className={p.visible === false ? "is-hidden" : ""}>
                <button type="button" className="ad-thumb" onClick={() => setEditing({ p: { ...p }, isNew: false })} aria-label={`Edit ${p.name}`}>
                  <img src={p.image} alt="" loading="lazy" />
                </button>
                <div className="ad-info">
                  <strong>{p.name}</strong>
                  <span className="muted">
                    {titles(p)} · {p.price ? inr.format(p.price) : "Ask for price"}
                  </span>
                  <span className="ad-flags">
                    {p.visible === false && <em className="is-hidden">Hidden</em>}
                    {p.stock === 0 && <em className="is-out">Out of stock</em>}
                    {typeof p.stock === "number" && p.stock > 0 && p.stock <= 3 && <em className="is-low">Low</em>}
                    {p.tag && <em>{p.tag}</em>}
                  </span>
                </div>
                <div className="ad-stock" aria-label={`Stock for ${p.name}`}>
                  {typeof p.stock === "number" ? (
                    <>
                      <button type="button" onClick={() => update(p.id, { stock: Math.max(0, (p.stock ?? 0) - 1) })} aria-label="One less" disabled={p.stock === 0}>
                        −
                      </button>
                      <input
                        inputMode="numeric"
                        value={p.stock}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          update(p.id, { stock: v === "" ? 0 : Math.min(Number(v), 100000) });
                        }}
                        aria-label="Units in stock"
                      />
                      <button type="button" onClick={() => update(p.id, { stock: (p.stock ?? 0) + 1 })} aria-label="One more">
                        +
                      </button>
                    </>
                  ) : (
                    <button type="button" className="ad-track" onClick={() => update(p.id, { stock: 5 })}>
                      Set stock
                    </button>
                  )}
                </div>
                <div className="ad-actions">
                  <button
                    type="button"
                    className={`ad-icon${p.visible === false ? "" : " is-on"}`}
                    onClick={() => update(p.id, { visible: p.visible === false })}
                    title={p.visible === false ? "Hidden — tap to show" : "Visible — tap to hide"}
                    aria-label={p.visible === false ? `Show ${p.name}` : `Hide ${p.name}`}
                  >
                    {p.visible === false ? "🙈" : "👁"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ p: { ...p }, isNew: false })}>
                    Edit
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {shown.length === 0 && <p className="ad-empty muted">No products match these filters.</p>}
        </>
        )}
      </main>

      <AnimatePresence>
        {editing && token && (
          <Editor
            key="editor"
            initial={editing.p}
            isNew={editing.isNew}
            groups={cols}
            token={token}
            onClose={() => setEditing(null)}
            onExpired={() => {
              saveToken(null);
              setToken(null);
            }}
            onSave={(p) => {
              if (editing.isNew) {
                let id = slug(p.name) || "product";
                while (items.some((x) => x.id === id)) id = `${slug(p.name)}-${Math.random().toString(36).slice(2, 6)}`;
                change([{ ...p, id }, ...items]);
              } else change(items.map((x) => (x.id === p.id ? p : x)));
              setEditing(null);
            }}
            onDelete={() => {
              change(items.filter((x) => x.id !== editing.p.id));
              setEditing(null);
            }}
          />
        )}
        {!token && <Login key="login" onToken={(t) => { setToken(t); if (save.state === "error") setDirty((n) => n + 1); }} />}
      </AnimatePresence>
    </div>
  );
}

/* ---------- add / edit form ---------- */

function Editor(props: {
  initial: Product;
  isNew: boolean;
  groups: Group[];
  token: string;
  onClose: () => void;
  onSave: (p: Product) => void;
  onDelete: () => void;
  onExpired: () => void;
}) {
  const { initial, isNew, groups, token, onClose, onSave, onDelete, onExpired } = props;
  const [p, setP] = useState<Product>(initial);
  const [specs, setSpecs] = useState(initial.specs.join("\n"));
  const [cutOut, setCutOut] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Product>) => setP((cur) => ({ ...cur, ...patch }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const upload = async (file: File) => {
    setError(null);
    setBusy(cutOut ? "Cleaning photo…" : "Preparing photo…");
    try {
      set({ image: await uploadPhoto(file, cutOut, p.name || "product", token) });
    } catch (err) {
      if (err instanceof AuthError) onExpired();
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!p.name.trim()) return setError("Enter a product name.");
    if (!p.catalogues.length) return setError("Tick at least one collection.");
    if (!p.image) return setError("Add a photo.");
    onSave({ ...p, name: p.name.trim(), tag: (p.tag ?? "").trim(), specs: specs.split("\n").map((s) => s.trim()).filter(Boolean) });
  };

  const toggleCat = (id: string) => set({ catalogues: p.catalogues.includes(id) ? p.catalogues.filter((c) => c !== id) : [...p.catalogues, id] });
  const numberOrNull = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v.replace(/[^\d]/g, "")) || 0)));

  return (
    <motion.div className="ad-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && onClose()}>
      <motion.form
        className="ad-editor"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", visualDuration: 0.35, bounce: 0.12 }}
        aria-label={isNew ? "Add product" : `Edit ${initial.name}`}
      >
        <div className="ad-editor-head">
          <h2>{isNew ? "Add product" : "Edit product"}</h2>
          <button type="button" className="ad-close" onClick={onClose} aria-label="Close" disabled={!!busy}>
            ✕
          </button>
        </div>

        <div className="ad-photo">
          <div className="ad-photo-box">{p.image ? <img src={p.image} alt="" /> : <span className="muted">No photo yet</span>}</div>
          <div className="ad-photo-side">
            <label className="btn btn-ghost">
              {busy ?? (p.image ? "Change photo" : "Upload photo")}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={!!busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="ad-check">
              <input type="checkbox" checked={cutOut} onChange={(e) => setCutOut(e.target.checked)} /> Remove white background
            </label>
          </div>
        </div>

        <label className="ad-field">
          <span>Name</span>
          <input value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder='e.g. Duster 26"' maxLength={90} required />
        </label>

        <div className="ad-row">
          <label className="ad-field">
            <span>Price (₹)</span>
            <input inputMode="numeric" value={p.price ?? ""} onChange={(e) => set({ price: numberOrNull(e.target.value) })} placeholder="Empty = Ask for price" />
          </label>
          <label className="ad-field">
            <span>Stock (units)</span>
            <input inputMode="numeric" value={p.stock ?? ""} onChange={(e) => set({ stock: numberOrNull(e.target.value) })} placeholder="Empty = not tracked" />
          </label>
        </div>

        <div className="ad-row">
          <label className="ad-field">
            <span>Tag (optional)</span>
            <input value={p.tag ?? ""} onChange={(e) => set({ tag: e.target.value })} placeholder="New, Bestseller…" maxLength={24} />
          </label>
          <label className="ad-check is-field">
            <input type="checkbox" checked={p.visible !== false} onChange={(e) => set({ visible: e.target.checked })} /> Show in catalogue
          </label>
        </div>

        <fieldset className="ad-cats">
          <legend>Collections</legend>
          {groups.map((g) => (
            <div key={g.id}>
              <small>{g.title}</small>
              <div className="ad-cat-list">
                {g.catalogues.map((c) => (
                  <label key={c.id} className={p.catalogues.includes(c.id) ? "is-on" : ""}>
                    <input type="checkbox" checked={p.catalogues.includes(c.id)} onChange={() => toggleCat(c.id)} />
                    {c.title}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>

        <label className="ad-field">
          <span>Features (one per line)</span>
          <textarea rows={4} value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder={"Dual disc brakes\nFront suspension"} />
        </label>

        <div className="ad-editor-foot">
          {error && (
            <p className="ad-error" role="alert">
              {error}
            </p>
          )}
          {!isNew && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => window.confirm(`Delete "${initial.name}"? This can't be undone.`) && onDelete()}
              disabled={!!busy}
            >
              Delete
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={!!busy}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!!busy}>
            {isNew ? "Add product" : "Save"}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
