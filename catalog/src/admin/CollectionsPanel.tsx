import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Catalogue, Group, Product } from "../data";
import { AuthError, slug, uploadPhoto } from "./api";

type Props = {
  groups: Group[];
  products: Product[];
  token: string | null;
  /** Save new groups (and products, when a delete removes a collection from them). */
  onChange: (groups: Group[], products?: Product[]) => void;
  onExpired: () => void;
  onShowProducts: (collectionId: string) => void;
};

type EditCol = { c: Catalogue; groupId: string; isNew: boolean };
type EditGroup = { g: Group; isNew: boolean };

const COLORS = ["#f7941d", "#ef4444", "#e11d48", "#ff8fb1", "#a855f7", "#2f6bff", "#3aa0ff", "#22c1dc", "#16a34a", "#7cc576", "#ffb020", "#64748b"];

/** A new ID from a name that isn't used by any group or collection yet. */
function freshId(name: string, groups: Group[], fallback: string) {
  const used = new Set(groups.flatMap((g) => [g.id, ...g.catalogues.map((c) => c.id)]));
  const base = slug(name) || fallback;
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  return id;
}

const move = <T,>(list: T[], i: number, dir: -1 | 1) => {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

export default function CollectionsPanel({ groups, products, token, onChange, onExpired, onShowProducts }: Props) {
  const [editCol, setEditCol] = useState<EditCol | null>(null);
  const [editGroup, setEditGroup] = useState<EditGroup | null>(null);
  const count = (id: string) => products.filter((p) => p.catalogues.includes(id)).length;
  const cover = (c: Catalogue) => {
    if (c.image) return c.image;
    const list = products.filter((p) => p.visible !== false && p.catalogues.includes(c.id));
    return (list.find((p) => p.stock !== 0) ?? list[0])?.image;
  };

  const setGroup = (id: string, fn: (g: Group) => Group) => onChange(groups.map((g) => (g.id === id ? fn(g) : g)));

  const removeCol = (g: Group, c: Catalogue) => {
    const inIt = products.filter((p) => p.catalogues.includes(c.id));
    const only = inIt.filter((p) => p.catalogues.length === 1);
    if (only.length) {
      window.alert(
        `${only.length} product${only.length === 1 ? " is" : "s are"} only in "${c.title}".\n\nMove ${only.length === 1 ? "it" : "them"} to another collection or delete ${only.length === 1 ? "it" : "them"} first — or hide this collection instead.`,
      );
      return;
    }
    const msg = inIt.length
      ? `Delete "${c.title}"? Its ${inIt.length} product${inIt.length === 1 ? "" : "s"} will stay in their other collections.`
      : `Delete "${c.title}"?`;
    if (!window.confirm(msg)) return;
    onChange(
      groups.map((x) => (x.id === g.id ? { ...x, catalogues: x.catalogues.filter((y) => y.id !== c.id) } : x)),
      inIt.length ? products.map((p) => (p.catalogues.includes(c.id) ? { ...p, catalogues: p.catalogues.filter((y) => y !== c.id) } : p)) : undefined,
    );
  };

  const removeGroup = (g: Group) => {
    if (g.catalogues.length) {
      window.alert(`"${g.title}" still has ${g.catalogues.length} collection${g.catalogues.length === 1 ? "" : "s"}. Move or delete them first.`);
      return;
    }
    if (groups.length === 1) return window.alert("Keep at least one group.");
    if (window.confirm(`Delete the group "${g.title}"?`)) onChange(groups.filter((x) => x.id !== g.id));
  };

  return (
    <>
      <p className="ad-count muted">
        Collections are the cards customers tap on the catalogue home page, grouped under headings. Use ↑ ↓ to change the order. Hidden collections
        disappear from the catalogue but keep their products.
      </p>

      <div className="ad-groups">
        {groups.map((g, gi) => (
          <section key={g.id} className="ad-group">
            <div className="ad-group-head">
              <div>
                <h3>{g.title}</h3>
                {g.subtitle && <p className="muted">{g.subtitle}</p>}
              </div>
              <div className="ad-group-actions">
                <button type="button" className="ad-step" onClick={() => onChange(move(groups, gi, -1))} disabled={gi === 0} aria-label={`Move ${g.title} up`}>
                  ↑
                </button>
                <button type="button" className="ad-step" onClick={() => onChange(move(groups, gi, 1))} disabled={gi === groups.length - 1} aria-label={`Move ${g.title} down`}>
                  ↓
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditGroup({ g: { ...g }, isNew: false })}>
                  Rename
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeGroup(g)} aria-label={`Delete group ${g.title}`}>
                  Delete
                </button>
              </div>
            </div>

            <ul className="ad-cols">
              <AnimatePresence initial={false}>
                {g.catalogues.map((c, ci) => {
                  const n = count(c.id);
                  const img = cover(c);
                  return (
                    <motion.li key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -30 }} className={c.visible === false ? "is-hidden" : ""} style={{ ["--accent" as string]: c.color }}>
                      <button type="button" className="ad-col-thumb" onClick={() => setEditCol({ c: { ...c }, groupId: g.id, isNew: false })} aria-label={`Edit ${c.title}`}>
                        {img ? <img src={img} alt="" loading="lazy" /> : <span>{c.badge || "?"}</span>}
                        {c.badge && img && <em>{c.badge}</em>}
                      </button>
                      <div className="ad-info">
                        <strong>{c.title}</strong>
                        <span className="muted">{c.blurb || "No description"}</span>
                        <span className="ad-flags">
                          {c.visible === false && <em className="is-hidden">Hidden</em>}
                          <button type="button" className="ad-linkish" onClick={() => onShowProducts(c.id)}>
                            {n ? `${n} product${n === 1 ? "" : "s"} →` : "No products yet"}
                          </button>
                          {c.image && <em>Own cover</em>}
                        </span>
                      </div>
                      <div className="ad-col-actions">
                        <button type="button" className="ad-step" onClick={() => setGroup(g.id, (x) => ({ ...x, catalogues: move(x.catalogues, ci, -1) }))} disabled={ci === 0} aria-label={`Move ${c.title} up`}>
                          ↑
                        </button>
                        <button
                          type="button"
                          className="ad-step"
                          onClick={() => setGroup(g.id, (x) => ({ ...x, catalogues: move(x.catalogues, ci, 1) }))}
                          disabled={ci === g.catalogues.length - 1}
                          aria-label={`Move ${c.title} down`}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className={`ad-icon${c.visible === false ? "" : " is-on"}`}
                          onClick={() => setGroup(g.id, (x) => ({ ...x, catalogues: x.catalogues.map((y) => (y.id === c.id ? { ...y, visible: c.visible === false } : y)) }))}
                          title={c.visible === false ? "Hidden — tap to show" : "Visible — tap to hide"}
                          aria-label={c.visible === false ? `Show ${c.title}` : `Hide ${c.title}`}
                        >
                          {c.visible === false ? "🙈" : "👁"}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditCol({ c: { ...c }, groupId: g.id, isNew: false })}>
                          Edit
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>

            <button
              type="button"
              className="ad-add-col"
              onClick={() => setEditCol({ isNew: true, groupId: g.id, c: { id: "", title: "", blurb: "", badge: "", color: COLORS[(gi * 3 + g.catalogues.length) % COLORS.length], visible: true } })}
            >
              + Add collection to {g.title}
            </button>
          </section>
        ))}
      </div>

      <button type="button" className="btn btn-ghost ad-add-group" onClick={() => setEditGroup({ isNew: true, g: { id: "", title: "", subtitle: "", catalogues: [] } })}>
        + Add group (heading)
      </button>

      <AnimatePresence>
        {editCol && token && (
          <CollectionEditor
            key="col"
            edit={editCol}
            groups={groups}
            products={products}
            token={token}
            onExpired={onExpired}
            onClose={() => setEditCol(null)}
            onDelete={() => {
              const g = groups.find((x) => x.id === editCol.groupId)!;
              setEditCol(null);
              removeCol(g, editCol.c);
            }}
            onSave={(c, groupId) => {
              const id = editCol.isNew ? freshId(c.title, groups, "collection") : c.id;
              const saved = { ...c, id };
              // Remove from its old place, then put it in the chosen group (same position if unchanged)
              const next = groups.map((g) => {
                const at = g.catalogues.findIndex((x) => x.id === id);
                if (g.id === groupId) {
                  if (at >= 0) return { ...g, catalogues: g.catalogues.map((x) => (x.id === id ? saved : x)) };
                  return { ...g, catalogues: [...g.catalogues, saved] };
                }
                return at >= 0 ? { ...g, catalogues: g.catalogues.filter((x) => x.id !== id) } : g;
              });
              onChange(next);
              setEditCol(null);
            }}
          />
        )}
        {editGroup && (
          <GroupEditor
            key="group"
            edit={editGroup}
            onClose={() => setEditGroup(null)}
            onSave={(g) => {
              if (editGroup.isNew) onChange([...groups, { ...g, id: freshId(g.title, groups, "group"), catalogues: [] }]);
              else onChange(groups.map((x) => (x.id === g.id ? { ...x, title: g.title, subtitle: g.subtitle } : x)));
              setEditGroup(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ---------- editors ---------- */

function useEscape(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, enabled]);
}

function Sheet({ label, onClose, busy, children, onSubmit }: { label: string; onClose: () => void; busy?: boolean; children: React.ReactNode; onSubmit: (e: FormEvent) => void }) {
  useEscape(onClose, !busy);
  return (
    <motion.div className="ad-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && onClose()}>
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
          <button type="button" className="ad-close" onClick={onClose} aria-label="Close" disabled={busy}>
            ✕
          </button>
        </div>
        {children}
      </motion.form>
    </motion.div>
  );
}

function CollectionEditor(props: {
  edit: EditCol;
  groups: Group[];
  products: Product[];
  token: string;
  onClose: () => void;
  onSave: (c: Catalogue, groupId: string) => void;
  onDelete: () => void;
  onExpired: () => void;
}) {
  const { edit, groups, products, token, onClose, onSave, onDelete, onExpired } = props;
  const [c, setC] = useState<Catalogue>(edit.c);
  const [groupId, setGroupId] = useState(edit.groupId);
  const [cutOut, setCutOut] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Catalogue>) => setC((cur) => ({ ...cur, ...patch }));
  const fallback = products.find((p) => p.visible !== false && p.catalogues.includes(c.id) && p.stock !== 0)?.image;

  const upload = async (file: File) => {
    setError(null);
    setBusy(cutOut ? "Cleaning photo…" : "Uploading…");
    try {
      set({ image: await uploadPhoto(file, cutOut, c.title || "collection", token) });
    } catch (err) {
      if (err instanceof AuthError) onExpired();
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const title = c.title.trim();
    if (!title) return setError("Enter a collection name.");
    const clash = groups.some((g) => g.catalogues.some((x) => x.id !== c.id && x.title.trim().toLowerCase() === title.toLowerCase()));
    if (clash) return setError(`There is already a collection called "${title}".`);
    onSave({ ...c, title, blurb: c.blurb.trim(), badge: (c.badge ?? "").trim() }, groupId);
  };

  return (
    <Sheet label={edit.isNew ? "Add collection" : "Edit collection"} onClose={onClose} busy={!!busy} onSubmit={submit}>
      <div className="ad-photo">
        <div className="ad-photo-box ad-col-preview" style={{ ["--accent" as string]: c.color }}>
          {c.image || fallback ? <img src={c.image || fallback} alt="" /> : <span className="ad-badge-big">{c.badge || "?"}</span>}
          {c.badge && (c.image || fallback) && <em>{c.badge}</em>}
        </div>
        <div className="ad-photo-side">
          <label className="btn btn-ghost">
            {busy ?? (c.image ? "Change cover photo" : "Upload cover photo")}
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
          {c.image ? (
            <button type="button" className="ad-linkish" onClick={() => set({ image: undefined })}>
              Remove cover — use a product photo instead
            </button>
          ) : (
            <span className="muted ad-hint">Optional. Without one, the first in-stock product's photo is used.</span>
          )}
          <label className="ad-check">
            <input type="checkbox" checked={cutOut} onChange={(e) => setCutOut(e.target.checked)} /> Remove white background
          </label>
        </div>
      </div>

      <label className="ad-field">
        <span>Name</span>
        <input value={c.title} onChange={(e) => set({ title: e.target.value })} placeholder='e.g. 20" Cycles or Baby Walker' maxLength={40} required />
      </label>
      <label className="ad-field">
        <span>Short description</span>
        <input value={c.blurb} onChange={(e) => set({ blurb: e.target.value })} placeholder="e.g. Ages 6–10 · kids & fat-tyre" maxLength={80} />
      </label>

      <div className="ad-row">
        <label className="ad-field">
          <span>Badge (short text or emoji)</span>
          <input value={c.badge ?? ""} onChange={(e) => set({ badge: e.target.value })} placeholder='20" or 🚲' maxLength={8} />
        </label>
        <label className="ad-field">
          <span>Group (heading)</span>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="ad-field">
        <span>Colour</span>
        <div className="ad-colors">
          {COLORS.map((col) => (
            <button key={col} type="button" className={c.color === col ? "is-on" : ""} style={{ background: col }} onClick={() => set({ color: col })} aria-label={`Colour ${col}`} />
          ))}
          <label className="ad-color-custom" title="Pick any colour">
            <input type="color" value={c.color} onChange={(e) => set({ color: e.target.value })} aria-label="Custom colour" />
          </label>
        </div>
      </div>

      <label className="ad-check">
        <input type="checkbox" checked={c.visible !== false} onChange={(e) => set({ visible: e.target.checked })} /> Show in catalogue
      </label>

      <div className="ad-editor-foot">
        {error && (
          <p className="ad-error" role="alert">
            {error}
          </p>
        )}
        {!edit.isNew && (
          <button type="button" className="btn btn-danger" onClick={onDelete} disabled={!!busy}>
            Delete
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={!!busy}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!!busy}>
          {edit.isNew ? "Add collection" : "Save"}
        </button>
      </div>
    </Sheet>
  );
}

function GroupEditor({ edit, onClose, onSave }: { edit: EditGroup; onClose: () => void; onSave: (g: Group) => void }) {
  const [g, setG] = useState(edit.g);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!g.title.trim()) return setError("Enter a group name.");
    onSave({ ...g, title: g.title.trim(), subtitle: g.subtitle.trim() });
  };

  return (
    <Sheet label={edit.isNew ? "Add group" : "Rename group"} onClose={onClose} onSubmit={submit}>
      <p className="muted ad-hint">A group is a heading on the catalogue home page, like “Cycles” or “Kids & Toys”.</p>
      <label className="ad-field">
        <span>Name</span>
        <input value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} placeholder="e.g. Accessories" maxLength={40} required autoFocus />
      </label>
      <label className="ad-field">
        <span>Line under the heading</span>
        <input value={g.subtitle} onChange={(e) => setG({ ...g, subtitle: e.target.value })} placeholder="e.g. Helmets, locks, lights and more" maxLength={120} />
      </label>
      <div className="ad-editor-foot">
        {error && (
          <p className="ad-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary">{edit.isNew ? "Add group" : "Save"}</button>
      </div>
    </Sheet>
  );
}
