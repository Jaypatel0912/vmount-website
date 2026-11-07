import { useState } from "react";
import { LEVELS, type Group, type Product } from "../data";

type Props = {
  items: Product[];
  groups: Group[];
  onChange: (next: Product[]) => void;
};

type Column = "price" | "a" | "b" | "c";
const COLUMN_LABEL: Record<Column, string> = { price: "Customer", a: "Level A", b: "Level B", c: "Level C" };

const read = (p: Product, col: Column) => (col === "price" ? p.price : p.wholesale?.[col]) ?? null;
const write = (p: Product, col: Column, v: number | null): Product =>
  col === "price" ? { ...p, price: v } : { ...p, wholesale: { ...p.wholesale, [col]: v } };
const toNumber = (s: string) => (s.trim() === "" ? null : Math.max(0, Number(s.replace(/\D/g, "")) || 0));

/** Spreadsheet-style editing of customer and wholesale prices, with a bulk % change. */
export default function PriceListPanel({ items, groups, onChange }: Props) {
  const [cat, setCat] = useState("all");
  const [query, setQuery] = useState("");
  const [bulkCols, setBulkCols] = useState<Column[]>(["a", "b", "c"]);
  const [percent, setPercent] = useState("");

  const q = query.trim().toLowerCase();
  const shown = items.filter((p) => (cat === "all" || p.catalogues.includes(cat)) && (!q || p.name.toLowerCase().includes(q)));
  const shownIds = new Set(shown.map((p) => p.id));
  const missing = shown.filter((p) => LEVELS.every((l) => read(p, l) === null)).length;

  const update = (id: string, fn: (p: Product) => Product) => onChange(items.map((p) => (p.id === id ? fn(p) : p)));

  const applyBulk = () => {
    const pct = Number(percent);
    if (!pct || !bulkCols.length) return;
    const what = bulkCols.map((c) => COLUMN_LABEL[c]).join(", ");
    if (!window.confirm(`${pct > 0 ? "Increase" : "Decrease"} ${what} prices by ${Math.abs(pct)}% for ${shown.length} products? Empty prices stay empty.`)) return;
    onChange(
      items.map((p) => {
        if (!shownIds.has(p.id)) return p;
        let next = p;
        for (const col of bulkCols) {
          const v = read(next, col);
          if (v !== null) next = write(next, col, Math.round(v * (1 + pct / 100)));
        }
        return next;
      }),
    );
    setPercent("");
  };

  return (
    <>
      <p className="ad-count muted">
        Type prices straight into the table — they save automatically. Customers see the <strong>Customer</strong> price; dealers see their
        level's price. Empty = “Ask for price”. <strong>Min</strong> is the smallest dealer order (pcs) and <strong>Pack</strong> the pieces per
        pack (dealers order in whole packs).
      </p>

      <div className="ad-tools">
        <label className="search">
          <input type="search" placeholder="Search products…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search products" />
        </label>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Sub-section">
          <option value="all">All sub-sections</option>
          {groups.map((g) => (
            <optgroup key={g.id} label={g.title}>
              {g.catalogues.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="ad-bulk">
        <span>Change prices of the {shown.length} products shown:</span>
        <div className="ad-bulk-cols">
          {(Object.keys(COLUMN_LABEL) as Column[]).map((c) => (
            <label key={c} className={bulkCols.includes(c) ? "is-on" : ""}>
              <input type="checkbox" checked={bulkCols.includes(c)} onChange={(e) => setBulkCols((cur) => (e.target.checked ? [...cur, c] : cur.filter((x) => x !== c)))} />
              {COLUMN_LABEL[c]}
            </label>
          ))}
        </div>
        <input inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d.-]/g, ""))} placeholder="e.g. 5 or -3" aria-label="Percent change" />
        <span>%</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={applyBulk} disabled={!Number(percent) || !bulkCols.length || !shown.length}>
          Apply
        </button>
      </div>

      {missing > 0 && <p className="ad-hint muted">{missing} of these products have no wholesale price yet — dealers will see “Ask for price” for them.</p>}

      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Product</th>
              {(Object.keys(COLUMN_LABEL) as Column[]).map((c) => (
                <th key={c}>{COLUMN_LABEL[c]} ₹</th>
              ))}
              <th>Min</th>
              <th>Pack</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className={p.visible === false ? "is-hidden" : ""}>
                <td>
                  <span className="ad-table-product">
                    <img src={p.image} alt="" loading="lazy" />
                    <span>{p.name}</span>
                  </span>
                </td>
                {(Object.keys(COLUMN_LABEL) as Column[]).map((c) => (
                  <td key={c}>
                    <input
                      inputMode="numeric"
                      value={read(p, c) ?? ""}
                      onChange={(e) => update(p.id, (x) => write(x, c, toNumber(e.target.value)))}
                      aria-label={`${COLUMN_LABEL[c]} price for ${p.name}`}
                      placeholder="—"
                    />
                  </td>
                ))}
                <td>
                  <input
                    className="is-small"
                    inputMode="numeric"
                    value={p.minQty ?? ""}
                    onChange={(e) => update(p.id, (x) => ({ ...x, minQty: toNumber(e.target.value) || null }))}
                    aria-label={`Minimum order for ${p.name}`}
                    placeholder="1"
                  />
                </td>
                <td>
                  <input
                    className="is-small"
                    inputMode="numeric"
                    value={p.packSize ?? ""}
                    onChange={(e) => update(p.id, (x) => ({ ...x, packSize: toNumber(e.target.value) || null }))}
                    aria-label={`Pack size for ${p.name}`}
                    placeholder="1"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length && <p className="ad-empty muted">No products match.</p>}
    </>
  );
}
