import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { business, dealerPriceOf, inr, LEVELS, type Dealer, type Level, type Product } from "../data";
import { AuthError, api } from "./api";

export type SaveState = { state: "idle" | "saving" | "saved" | "error"; message?: string };

type Props = {
  token: string;
  products: Product[];
  onStatus: (s: SaveState) => void;
  onExpired: () => void;
};

const LEVEL_HINT: Record<Level, string> = { a: "Level A — big dealers", b: "Level B — regular shops", c: "Level C — small shops" };
export const dealerLink = (d: Pick<Dealer, "code">) => `${window.location.origin}/d/${d.code}`;

/** wa.me number from what staff typed: 10-digit Indian numbers get 91 in front. */
const waNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
};
const linkMessage = (d: Dealer) =>
  `Namaste ${d.owner || d.shop}! Here is your ${business.name} dealer price list:\n${dealerLink(d)}\n\nSave this link — you can see your prices and place orders anytime.`;

const blankDealer = (): Dealer => ({ id: "", code: "", shop: "", owner: "", phone: "", city: "", level: "a", discount: 0, special: {}, active: true, notes: "" });

export default function DealersPanel({ token, products, onStatus, onExpired }: Props) {
  const [dealers, setDealers] = useState<Dealer[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ d: Dealer; isNew: boolean } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api<{ dealers: Dealer[] }>("/api/catalog/dealers", token)
      .then((r) => setDealers(r.dealers))
      .catch((err) => {
        if (err instanceof AuthError) onExpired();
        setLoadError((err as Error).message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /** Save the whole dealer list (new dealers and "new link" get their codes from the server). */
  const save = async (next: Dealer[]) => {
    onStatus({ state: "saving" });
    try {
      const r = await api<{ dealers: Dealer[] }>("/api/catalog/dealers", token, { method: "PUT", body: JSON.stringify({ dealers: next }) });
      setDealers(r.dealers);
      onStatus({ state: "saved" });
      return true;
    } catch (err) {
      if (err instanceof AuthError) onExpired();
      onStatus({ state: "error", message: (err as Error).message });
      return false;
    }
  };

  const copy = async (d: Dealer) => {
    try {
      await navigator.clipboard.writeText(dealerLink(d));
      setCopied(d.id);
      setTimeout(() => setCopied((c) => (c === d.id ? null : c)), 1800);
    } catch {
      window.prompt("Copy this link:", dealerLink(d));
    }
  };

  if (loadError) return <p className="ad-error">{loadError}</p>;
  if (!dealers) return <p className="muted ad-count">Loading dealers…</p>;

  const q = query.trim().toLowerCase();
  const shown = dealers.filter((d) => !q || [d.shop, d.owner, d.city, d.phone].join(" ").toLowerCase().includes(q));
  const active = dealers.filter((d) => d.active).length;

  return (
    <>
      <p className="ad-count muted">
        Each dealer gets a private link that shows their wholesale prices and lets them place orders. Prices come from the product's level
        (A/B/C) price, less the dealer's discount — or a special price you set for that dealer. Switch a dealer off, or make a new link, and
        the old link stops working.
      </p>

      <div className="ad-tools">
        <label className="search">
          <input type="search" placeholder="Search dealers…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search dealers" />
        </label>
        <span className="muted ad-mini">
          {active} active · {dealers.length} total
        </span>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ d: blankDealer(), isNew: true })}>
          + Add dealer
        </button>
      </div>

      <ul className="ad-dealers">
        <AnimatePresence initial={false}>
          {shown.map((d) => (
            <motion.li key={d.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={d.active ? "" : "is-off"}>
              <div className="ad-dealer-main">
                <strong>{d.shop}</strong>
                <span className="muted">{[d.owner, d.city, d.phone].filter(Boolean).join(" · ") || "No contact details"}</span>
                <span className="ad-flags">
                  <em className="is-level">Level {d.level.toUpperCase()}</em>
                  {d.discount > 0 && <em>−{d.discount}%</em>}
                  {Object.keys(d.special).length > 0 && <em>{Object.keys(d.special).length} special prices</em>}
                  {!d.active && <em className="is-hidden">Switched off</em>}
                </span>
              </div>
              <div className="ad-dealer-link">
                <code>{dealerLink(d).replace(/^https?:\/\//, "")}</code>
                <div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(d)} disabled={!d.active}>
                    {copied === d.id ? "✓ Copied" : "Copy link"}
                  </button>
                  <a
                    className={`btn btn-wa btn-sm${d.active ? "" : " is-disabled"}`}
                    href={d.active ? `https://wa.me/${waNumber(d.phone)}?text=${encodeURIComponent(linkMessage(d))}` : undefined}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={!d.active}
                  >
                    Send on WhatsApp
                  </a>
                  <a className="btn btn-ghost btn-sm" href={d.active ? dealerLink(d) : undefined} target="_blank" rel="noreferrer" aria-disabled={!d.active}>
                    Preview ↗
                  </a>
                </div>
              </div>
              <div className="ad-actions">
                <button
                  type="button"
                  className={`ad-icon${d.active ? " is-on" : ""}`}
                  onClick={() => save(dealers.map((x) => (x.id === d.id ? { ...x, active: !x.active } : x)))}
                  title={d.active ? "Active — tap to switch off" : "Switched off — tap to switch on"}
                  aria-label={d.active ? `Switch off ${d.shop}` : `Switch on ${d.shop}`}
                >
                  {d.active ? "✓" : "⏻"}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ d: structuredClone(d), isNew: false })}>
                  Edit
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {!dealers.length && <p className="ad-empty muted">No dealers yet. Tap “+ Add dealer” to create the first private price-list link.</p>}

      <AnimatePresence>
        {editing && (
          <DealerEditor
            key="dealer"
            initial={editing.d}
            isNew={editing.isNew}
            products={products}
            onClose={() => setEditing(null)}
            onSave={async (d, newLink) => {
              const fixed = newLink ? { ...d, code: "" } : d;
              const next = editing.isNew ? [...dealers, fixed] : dealers.map((x) => (x.id === d.id ? fixed : x));
              if (await save(next)) setEditing(null);
            }}
            onDelete={async () => {
              if (await save(dealers.filter((x) => x.id !== editing.d.id))) setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ---------- add / edit dealer ---------- */

function Overlay({ label, onClose, children, onSubmit }: { label: string; onClose: () => void; children: ReactNode; onSubmit: (e: FormEvent) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div className="ad-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        className="ad-editor"
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", visualDuration: 0.35, bounce: 0.12 }}
        aria-label={label}
      >
        <div className="ad-editor-head">
          <h2>{label}</h2>
          <button type="button" className="ad-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </motion.form>
    </motion.div>
  );
}

function DealerEditor(props: {
  initial: Dealer;
  isNew: boolean;
  products: Product[];
  onClose: () => void;
  onSave: (d: Dealer, newLink: boolean) => void;
  onDelete: () => void;
}) {
  const { initial, isNew, products, onClose, onSave, onDelete } = props;
  const [d, setD] = useState<Dealer>(initial);
  const [newLink, setNewLink] = useState(false);
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Dealer>) => setD((cur) => ({ ...cur, ...patch }));
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const sorted = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name)), [products]);
  const specials = Object.entries(d.special).filter(([id]) => byId.has(id));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!d.shop.trim()) return setError("Enter the shop name.");
    if (!(d.discount >= 0 && d.discount <= 50)) return setError("Discount must be between 0 and 50%.");
    onSave({ ...d, shop: d.shop.trim() }, newLink);
  };

  const levelPrice = (p: Product) => dealerPriceOf(p, { level: d.level, discount: d.discount, special: {} });

  return (
    <Overlay label={isNew ? "Add dealer" : `Edit ${initial.shop}`} onClose={onClose} onSubmit={submit}>
      <label className="ad-field">
        <span>Shop name</span>
        <input value={d.shop} onChange={(e) => set({ shop: e.target.value })} placeholder="e.g. Patel Cycle Stores" maxLength={60} required autoFocus />
      </label>
      <div className="ad-row">
        <label className="ad-field">
          <span>Owner</span>
          <input value={d.owner} onChange={(e) => set({ owner: e.target.value })} placeholder="e.g. Rameshbhai" maxLength={60} />
        </label>
        <label className="ad-field">
          <span>WhatsApp number</span>
          <input value={d.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" placeholder="98765 43210" maxLength={20} />
        </label>
      </div>
      <div className="ad-row">
        <label className="ad-field">
          <span>City</span>
          <input value={d.city} onChange={(e) => set({ city: e.target.value })} placeholder="e.g. Visnagar" maxLength={40} />
        </label>
        <label className="ad-field">
          <span>Price level</span>
          <select value={d.level} onChange={(e) => set({ level: e.target.value as Level })}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_HINT[l]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="ad-row">
        <label className="ad-field">
          <span>Extra discount on level prices (%)</span>
          <input
            inputMode="decimal"
            value={d.discount || ""}
            onChange={(e) => set({ discount: Math.min(50, Math.max(0, Number(e.target.value.replace(/[^\d.]/g, "")) || 0)) })}
            placeholder="0"
          />
        </label>
        <label className="ad-check is-field">
          <input type="checkbox" checked={d.active} onChange={(e) => set({ active: e.target.checked })} /> Link active
        </label>
      </div>

      <fieldset className="ad-cats">
        <legend>Special prices for this dealer (optional)</legend>
        <p className="muted ad-hint">These replace the level price for this dealer only.</p>
        {specials.length > 0 && (
          <ul className="ad-specials">
            {specials.map(([id, price]) => {
              const p = byId.get(id)!;
              const usual = levelPrice(p);
              return (
                <li key={id}>
                  <img src={p.image} alt="" />
                  <div>
                    <strong>{p.name}</strong>
                    <span className="muted">Usual for this dealer: {usual === null ? "no price" : inr.format(usual)}</span>
                  </div>
                  <input
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => set({ special: { ...d.special, [id]: Number(e.target.value.replace(/\D/g, "")) || 0 } })}
                    aria-label={`Special price for ${p.name}`}
                  />
                  <button
                    type="button"
                    className="ad-step"
                    onClick={() => {
                      const { [id]: _gone, ...rest } = d.special;
                      set({ special: rest });
                    }}
                    aria-label={`Remove special price for ${p.name}`}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="ad-special-add">
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Product for a special price">
            <option value="">Choose a product…</option>
            {sorted
              .filter((p) => !(p.id in d.special))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!pick}
            onClick={() => {
              const p = byId.get(pick);
              if (!p) return;
              set({ special: { ...d.special, [pick]: levelPrice(p) ?? p.price ?? 0 } });
              setPick("");
            }}
          >
            + Add special price
          </button>
        </div>
      </fieldset>

      <label className="ad-field">
        <span>Notes (only staff see these)</span>
        <textarea rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={300} placeholder="Payment terms, transport, GST no…" />
      </label>

      {!isNew && (
        <div className="ad-field">
          <span>Private link</span>
          <code className="ad-code">{newLink ? "A new link will be made when you save" : dealerLink(d)}</code>
          <label className="ad-check">
            <input type="checkbox" checked={newLink} onChange={(e) => setNewLink(e.target.checked)} /> Make a new link (the old one stops working)
          </label>
        </div>
      )}

      <div className="ad-editor-foot">
        {error && (
          <p className="ad-error" role="alert">
            {error}
          </p>
        )}
        {!isNew && (
          <button type="button" className="btn btn-danger" onClick={() => window.confirm(`Delete dealer "${initial.shop}"? Their link stops working. Their past orders stay in Orders.`) && onDelete()}>
            Delete
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary">{isNew ? "Add dealer" : "Save"}</button>
      </div>
    </Overlay>
  );
}
