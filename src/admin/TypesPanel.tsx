import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { slugify, type CycleType, type Product } from "../data/site";
import { preparePhoto } from "./photo";

type Props = {
  types: CycleType[];
  cycles: Product[];
  token: string;
  busy: string | null;
  /** Save new types (and cycles, when a rename moves them). */
  onSave: (types: CycleType[], cycles: Product[], message: string) => Promise<boolean>;
  onExpired: () => void;
};

/** Cover shown in the list: own photo, else a cycle of that type. */
const coverOf = (t: CycleType, cycles: Product[]) =>
  t.image || (cycles.find((c) => c.category === t.name && c.featured) ?? cycles.find((c) => c.category === t.name))?.image;

export default function TypesPanel({ types, cycles, token, busy, onSave, onExpired }: Props) {
  const [editing, setEditing] = useState<{ t: CycleType; isNew: boolean; originalName?: string } | null>(null);

  const count = (t: CycleType) => cycles.filter((c) => c.category === t.name).length;

  const move = (i: number, dir: -1 | 1) => {
    const next = [...types];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onSave(next, cycles, `${types[i].name} moved ${dir < 0 ? "up" : "down"}.`);
  };

  const remove = (t: CycleType) => {
    if (count(t)) return;
    if (!window.confirm(`Delete the type "${t.name}"?`)) return;
    onSave(
      types.filter((x) => x.id !== t.id),
      cycles,
      `${t.name} was deleted.`,
    );
  };

  return (
    <>
      <p className="ps-help">
        Types are the big cards in “Shop by type” on the website, in this order. Types with no visible cycles are not shown there.
      </p>
      <ul className="cy-list ty-list">
        {types.map((t, i) => {
          const n = count(t);
          const cover = coverOf(t, cycles);
          return (
            <motion.li key={t.id} layout style={{ ["--type" as string]: t.color }}>
              <span className="ty-thumb">{cover ? <img src={cover} alt="" loading="lazy" /> : <span>No photo</span>}</span>
              <div className="cy-info">
                <strong>
                  <span className="ty-dot" aria-hidden /> {t.name}
                </strong>
                <span>
                  {n} {n === 1 ? "cycle" : "cycles"}
                  {t.description && ` · ${t.description}`}
                </span>
              </div>
              <div className="cy-step">
                <button aria-label={`Move ${t.name} up`} onClick={() => move(i, -1)} disabled={!!busy || i === 0}>
                  ↑
                </button>
                <button aria-label={`Move ${t.name} down`} onClick={() => move(i, 1)} disabled={!!busy || i === types.length - 1}>
                  ↓
                </button>
              </div>
              <div className="cy-actions">
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => setEditing({ t: { ...t }, isNew: false, originalName: t.name })}
                  disabled={!!busy}
                >
                  Edit
                </button>
                <button
                  className="btn btn-ghost btn-small cy-del"
                  onClick={() => remove(t)}
                  disabled={!!busy || n > 0}
                  title={n > 0 ? "Move or delete its cycles first" : undefined}
                  aria-label={`Delete type ${t.name}`}
                >
                  Delete
                </button>
              </div>
            </motion.li>
          );
        })}
      </ul>

      <div className="ps-actions">
        <button
          className="btn btn-primary"
          disabled={!!busy}
          onClick={() => setEditing({ t: { id: "", name: "", description: "", color: "#f7941d" }, isNew: true })}
        >
          + Add new type
        </button>
      </div>

      <AnimatePresence>
        {editing && (
          <TypeForm
            key="type-form"
            initial={editing.t}
            isNew={editing.isNew}
            takenNames={new Set(types.filter((t) => t.name !== editing.originalName).map((t) => t.name.toLowerCase()))}
            autoCover={coverOf({ ...editing.t, image: undefined }, cycles)}
            token={token}
            busy={busy}
            onCancel={() => setEditing(null)}
            onExpired={onExpired}
            onSave={async (t) => {
              const id = editing.isNew ? uniqueId(slugify(t.name), types) : t.id;
              const saved = { ...t, id };
              const nextTypes = editing.isNew ? [...types, saved] : types.map((x) => (x.name === editing.originalName ? saved : x));
              // Renaming a type moves its cycles along with it
              const renamed = !editing.isNew && editing.originalName !== saved.name;
              const nextCycles = renamed ? cycles.map((c) => (c.category === editing.originalName ? { ...c, category: saved.name } : c)) : cycles;
              const msg = editing.isNew ? `${saved.name} was added.` : renamed ? `${editing.originalName} is now ${saved.name}.` : `${saved.name} was updated.`;
              if (await onSave(nextTypes, nextCycles, msg)) setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function uniqueId(base: string, types: CycleType[]) {
  const root = base || "type";
  let id = root;
  for (let i = 2; types.some((t) => t.id === id); i++) id = `${root}-${i}`;
  return id;
}

function TypeForm(props: {
  initial: CycleType;
  isNew: boolean;
  takenNames: Set<string>;
  autoCover?: string;
  token: string;
  busy: string | null;
  onCancel: () => void;
  onExpired: () => void;
  onSave: (t: CycleType) => void;
}) {
  const { initial, isNew, takenNames, autoCover, token, busy, onCancel, onExpired, onSave } = props;
  const [t, setT] = useState<CycleType>(initial);
  const [cutOut, setCutOut] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ dataUrl, name: `type-${t.name || "cover"}` }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.status === 401) {
        onExpired();
        throw new Error("Your login expired. Please enter the password again.");
      }
      if (!r.ok) throw new Error(body.error || "Photo upload failed");
      setT((x) => ({ ...x, image: body.url }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = t.name.trim();
    if (!name) return setError("Enter the type name.");
    if (takenNames.has(name.toLowerCase())) return setError(`There is already a type called "${name}".`);
    onSave({ ...t, name, description: t.description.trim(), ...(t.image ? {} : { image: undefined }) });
  };

  const cover = t.image || autoCover;

  return (
    <motion.div className="ps-overlay cy-modal-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !uploading && onCancel()}>
      <motion.form
        className="cy-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Add new type" : `Edit ${initial.name}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        noValidate
      >
        <div className="cy-modal-head">
          <h2>{isNew ? "Add new type" : `Edit ${initial.name}`}</h2>
          <button type="button" className="cy-x" aria-label="Close" onClick={onCancel} disabled={uploading}>
            ✕
          </button>
        </div>

        <div className="cy-form-grid">
          <div className="cy-photo">
            <div className="cy-photo-box ty-preview" style={{ ["--type" as string]: t.color }}>
              {uploading ? <span>Cleaning photo…</span> : cover ? <img src={cover} alt="Type cover" /> : <span>No photo yet</span>}
            </div>
            <label className="btn btn-ghost btn-small cy-file">
              {t.image ? "Change cover photo" : "Upload cover photo"}
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
            {t.image ? (
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setT((x) => ({ ...x, image: undefined }))}>
                Use a cycle photo instead
              </button>
            ) : (
              <small>Optional. Without a cover photo, a cycle of this type is shown.</small>
            )}
          </div>

          <div className="cy-fields">
            <label className="ps-field">
              <span className="ps-label">Type name *</span>
              <input required maxLength={40} value={t.name} onChange={(e) => setT((x) => ({ ...x, name: e.target.value }))} placeholder="e.g. Mountain, Gear cycles, Kids 16-inch" />
            </label>
            <label className="ps-field">
              <span className="ps-label">Short description</span>
              <textarea
                rows={3}
                maxLength={140}
                value={t.description}
                onChange={(e) => setT((x) => ({ ...x, description: e.target.value }))}
                placeholder="One line about this type, shown on the card"
              />
            </label>
            <label className="ps-field">
              <span className="ps-label">Card colour</span>
              <input type="color" className="cy-color" value={t.color} onChange={(e) => setT((x) => ({ ...x, color: e.target.value }))} />
            </label>
            {!isNew && initial.name !== t.name.trim() && t.name.trim() && (
              <p className="ps-help">All cycles of “{initial.name}” will move to “{t.name.trim()}”.</p>
            )}
          </div>
        </div>

        {error && <p className="ps-notice error">{error}</p>}
        <div className="ps-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={uploading}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={uploading || !!busy}>
            {busy ?? (isNew ? "Add type" : "Save changes")}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
