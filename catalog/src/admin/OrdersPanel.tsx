import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { business, inr, STATUS_LABELS, type Order, type OrderStatus } from "../data";
import { AuthError, api } from "./api";
import type { SaveState } from "./DealersPanel";

type Props = {
  token: string;
  onStatus: (s: SaveState) => void;
  onExpired: () => void;
  /** Lets the tab label show how many orders are new. */
  onNewCount: (n: number) => void;
};

const STATUSES = Object.keys(STATUS_LABELS) as OrderStatus[];
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const waNumber = (phone = "") => {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const statusMessage = (o: Order) =>
  `Namaste ${o.dealerOwner || o.dealerShop}, your ${business.name} order ${o.number} is now: ${STATUS_LABELS[o.status]}.` +
  (o.staffNote ? `\n${o.staffNote}` : "");

/** A clean printable order sheet (opens the print dialog; "Save as PDF" works too). */
function printOrder(o: Order) {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return window.alert("Allow pop-ups for this site to print orders.");
  const rows = o.items
    .map(
      (l, i) =>
        `<tr><td>${i + 1}</td><td>${esc(l.name)}</td><td class="n">${l.qty}</td><td class="n">${l.price === null ? "To confirm" : inr.format(l.price)}</td><td class="n">${l.lineTotal === null ? "—" : inr.format(l.lineTotal)}</td></tr>`,
    )
    .join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Order ${esc(o.number)}</title><style>
    body{font:14px/1.5 system-ui,sans-serif;color:#1b2233;margin:32px}
    header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #f7941d;padding-bottom:12px;margin-bottom:16px}
    h1{margin:0;font-size:22px} .muted{color:#667085} table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border-bottom:1px solid #e4e5ee;padding:8px;text-align:left} th{background:#f6f6fb} .n{text-align:right}
    tfoot td{font-weight:700;font-size:16px;border-bottom:0}
  </style></head><body>
    <header><div><h1>${esc(business.fullName)}</h1><div class="muted">${esc(business.address)}<br>${esc(business.phone)}</div></div>
    <div style="text-align:right"><h1>Order ${esc(o.number)}</h1><div class="muted">${esc(when(o.createdAt))}<br>Status: ${STATUS_LABELS[o.status]}</div></div></header>
    <div><strong>${esc(o.dealerShop ?? "")}</strong>${o.dealerOwner ? ` — ${esc(o.dealerOwner)}` : ""}<br><span class="muted">${esc([o.dealerCity, o.dealerPhone].filter(Boolean).join(" · "))}</span></div>
    <table><thead><tr><th>#</th><th>Product</th><th class="n">Qty (pcs)</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead>
    <tbody>${rows}</tbody><tfoot><tr><td colspan="4" class="n">Total</td><td class="n">${inr.format(o.total)}</td></tr></tfoot></table>
    ${o.unpriced ? `<p class="muted">${o.unpriced} item(s) still to be priced.</p>` : ""}
    ${o.note ? `<p><strong>Dealer's note:</strong> ${esc(o.note)}</p>` : ""}
    <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

export default function OrdersPanel({ token, onStatus, onExpired, onNewCount }: Props) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [open, setOpen] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api<{ orders: Order[] }>("/api/catalog/orders", token)
      .then((r) => {
        setOrders(r.orders);
        onNewCount(r.orders.filter((o) => o.status === "new").length);
      })
      .catch((err) => {
        if (err instanceof AuthError) onExpired();
        setError((err as Error).message);
      });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [token]);

  const setStatus = async (o: Order, status: OrderStatus) => {
    onStatus({ state: "saving" });
    try {
      const r = await api<{ order: Order }>(`/api/catalog/orders/${o.id}`, token, { method: "PUT", body: JSON.stringify({ status }) });
      setOrders((cur) => {
        const next = (cur ?? []).map((x) => (x.id === o.id ? r.order : x));
        onNewCount(next.filter((x) => x.status === "new").length);
        return next;
      });
      onStatus({ state: "saved" });
    } catch (err) {
      if (err instanceof AuthError) onExpired();
      onStatus({ state: "error", message: (err as Error).message });
    }
  };

  if (error) return <p className="ad-error">{error}</p>;
  if (!orders) return <p className="muted ad-count">Loading orders…</p>;

  const count = (s: OrderStatus) => orders.filter((o) => o.status === s).length;
  const shown = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <>
      <div className="ad-tools">
        <div className="ad-status-filter" role="tablist" aria-label="Order status">
          {(["all", ...STATUSES] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={filter === s} className={filter === s ? "is-on" : ""} onClick={() => setFilter(s)}>
              {s === "all" ? `All (${orders.length})` : `${STATUS_LABELS[s]} (${count(s)})`}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
          ↻ Refresh
        </button>
      </div>

      <ul className="ad-orders">
        <AnimatePresence initial={false}>
          {shown.map((o) => (
            <motion.li key={o.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`is-${o.status}`}>
              <button type="button" className="ad-order-head" onClick={() => setOpen(open === o.id ? null : o.id!)} aria-expanded={open === o.id}>
                <span>
                  <strong>{o.number}</strong> · {o.dealerShop}
                  {o.dealerCity && <span className="muted"> · {o.dealerCity}</span>}
                </span>
                <span className="muted">
                  {when(o.createdAt)} · {o.items.reduce((s, l) => s + l.qty, 0)} pcs · <strong>{inr.format(o.total)}</strong>
                  {o.unpriced ? ` + ${o.unpriced} to price` : ""}
                </span>
              </button>
              <div className="ad-order-actions">
                <select value={o.status} onChange={(e) => setStatus(o, e.target.value as OrderStatus)} aria-label={`Status of ${o.number}`} className={`status is-${o.status}`}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <a className="btn btn-wa btn-sm" href={`https://wa.me/${waNumber(o.dealerPhone)}?text=${encodeURIComponent(statusMessage(o))}`} target="_blank" rel="noreferrer">
                  WhatsApp dealer
                </a>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => printOrder(o)}>
                  Print / PDF
                </button>
              </div>
              <AnimatePresence initial={false}>
                {open === o.id && (
                  <motion.div className="ad-order-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <table className="ad-table is-compact">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Qty</th>
                          <th>Rate</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.items.map((l) => (
                          <tr key={l.id}>
                            <td>{l.name}</td>
                            <td>{l.qty}</td>
                            <td>{l.price === null ? "To confirm" : inr.format(l.price)}</td>
                            <td>{l.lineTotal === null ? "—" : inr.format(l.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {o.note && (
                      <p>
                        <strong>Dealer's note:</strong> {o.note}
                      </p>
                    )}
                    <p className="muted">{[o.dealerOwner, o.dealerPhone].filter(Boolean).join(" · ")}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {!shown.length && <p className="ad-empty muted">{orders.length ? "No orders with this status." : "No dealer orders yet. They appear here as soon as a dealer places one."}</p>}
    </>
  );
}
