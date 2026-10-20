import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { brand, heroBikes, products } from "../data/site";
import { badgeFor, discounted, formatDay, inr, offerBikes, todayISO, type Festival, type OfferBike } from "../data/festival";
import { DESIGNS, SIZES, drawPoster, loadImage, loadPosterFonts, type DesignId, type PosterInput, type PosterSize } from "./draw";
import { PRESETS } from "./presets";
import { Login, readToken, saveToken } from "../admin/auth";
import "./poster.css";

const ORDER: PosterSize[] = ["square", "story", "wide"];
const DESIGN_IDS = Object.keys(DESIGNS) as DesignId[];

// ---------- form ----------

type Form = {
  mode: "offer" | "greeting";
  preset: string;
  name: string;
  greeting: string;
  greetingLocal: string;
  headline: string;
  subline: string;
  start: string;
  end: string;
  appliesTo: "selected" | "all";
  discountType: "flat" | "percent" | "none";
  discountValue: string;
  picked: Record<string, string>; // cycle id -> custom offer price ("" = use the discount)
  extras: string;
  terms: string;
};

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function presetForm(id: string, keep?: Partial<Form>): Form {
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0];
  const mode = keep?.mode ?? "offer";
  return {
    mode,
    preset: p.id,
    name: p.id === "custom" ? "" : p.name,
    greeting: p.greeting,
    greetingLocal: p.greetingLocal,
    headline: mode === "greeting" ? p.wishHeadline : p.headline,
    subline: mode === "greeting" ? p.wishMessage : p.subline,
    start: keep?.start ?? todayISO(),
    end: keep?.end ?? addDays(todayISO(), 14),
    appliesTo: keep?.appliesTo ?? "selected",
    discountType: keep?.discountType ?? "flat",
    discountValue: keep?.discountValue ?? "1000",
    picked: keep?.picked ?? {},
    extras: keep?.extras ?? (mode === "greeting" ? "" : "Free helmet + bell with every cycle"),
    terms: keep?.terms ?? "Offer valid at the VMount factory store while stocks last.",
  };
}

function formFromFestival(f: Festival): Form {
  const preset = PRESETS.find((p) => p.name === f.name)?.id ?? "custom";
  return {
    mode: f.mode ?? "offer",
    preset,
    name: f.name,
    greeting: f.greeting,
    greetingLocal: f.greetingLocal ?? "",
    headline: f.headline,
    subline: f.subline,
    start: f.start,
    end: f.end,
    appliesTo: f.appliesTo,
    discountType: f.discountValue > 0 ? f.discountType : "none",
    discountValue: String(f.discountValue || ""),
    picked: Object.fromEntries(f.bikes.map((b) => [b.id, b.offerPrice ? String(b.offerPrice) : ""])),
    extras: f.extras ?? "",
    terms: f.terms ?? "",
  };
}

function festivalFromForm(form: Form, design: DesignId, posterBikes: string[]): Festival {
  const greeting = form.mode === "greeting";
  const none = greeting || form.discountType === "none";
  return {
    mode: form.mode,
    id: `${(form.name || "festival").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${form.start.slice(0, 4)}`,
    name: form.name.trim(),
    greeting: form.greeting.trim() || form.name.trim(),
    greetingLocal: form.greetingLocal.trim(),
    headline: form.headline.trim(),
    subline: form.subline.trim(),
    start: form.start,
    end: form.end,
    appliesTo: greeting ? "all" : form.appliesTo,
    discountType: form.discountType === "none" ? "flat" : form.discountType,
    discountValue: none ? 0 : Number(form.discountValue) || 0,
    extras: form.extras.trim(),
    terms: greeting ? "" : form.terms.trim(),
    design,
    bikes: greeting ? [] : Object.entries(form.picked).map(([id, price]) => ({ id, offerPrice: Number(price) || 0 })),
    posterBikes,
  };
}

function validate(form: Form): string | null {
  if (!form.name.trim()) return "Enter the festival name.";
  if (!form.headline.trim()) return "Enter an offer headline.";
  if (!form.subline.trim()) return form.mode === "greeting" ? "Write your festival message." : "Enter a short description of the offer.";
  if (!form.start || !form.end) return "Choose the start and end dates.";
  if (form.end < form.start) return "The end date must be on or after the start date.";
  if (form.mode === "greeting") return null;
  if (form.discountType !== "none" && !(Number(form.discountValue) > 0) && form.appliesTo === "all")
    return "Enter the discount for all cycles, or choose “No discount (gift only)”.";
  if (form.discountType === "percent" && Number(form.discountValue) > 90) return "A percentage discount can be at most 90%.";
  if (form.appliesTo === "selected" && !Object.keys(form.picked).length) return "Tick at least one cycle for the offer.";
  if (form.discountType === "none" && !form.extras.trim()) return "With no discount, add the free gift so the offer is clear.";
  return null;
}

/** Switch poster type; swap in the other type's default text unless the owner has changed it. */
function switchMode(form: Form, mode: Form["mode"]): Form {
  const p = PRESETS.find((x) => x.id === form.preset);
  const untouched = (value: string, a?: string, b?: string) => !value.trim() || value === a || value === b;
  const next: Form = { ...form, mode };
  if (p && untouched(form.headline, p.headline, p.wishHeadline)) next.headline = mode === "greeting" ? p.wishHeadline : p.headline;
  if (p && untouched(form.subline, p.subline, p.wishMessage)) next.subline = mode === "greeting" ? p.wishMessage : p.subline;
  // A gift line belongs to offers; greetings start without one
  if (mode === "greeting" && form.mode === "offer") next.extras = "";
  if (mode === "offer" && form.mode === "greeting" && !form.extras.trim()) next.extras = "Free helmet + bell with every cycle";
  return next;
}

// ---------- drawing ----------

type Images = { logo: HTMLImageElement; background: HTMLImageElement | null; bikes: Map<string, HTMLImageElement> };

function posterData(size: PosterSize, design: DesignId, f: Festival, chosen: OfferBike[], offers: OfferBike[], imgs: Images): PosterInput {
  return {
    size,
    design,
    mode: f.mode,
    badge: badgeFor(f, offers),
    greeting: f.greeting,
    greetingLocal: f.greetingLocal,
    headline: f.headline,
    subline: f.subline,
    extras: f.extras,
    until: formatDay(f.end),
    bikes: chosen.map((b) => ({ name: b.name, img: imgs.bikes.get(b.id)!, price: b.price, offerPrice: b.offerPrice })),
    logo: imgs.logo,
    background: imgs.background,
    brandName: brand.fullName,
    phone: brand.phone,
    location: brand.location,
  };
}

// ---------- page ----------

export default function PosterAdmin() {
  const [token, setToken] = useState<string | null>(readToken);
  const [live, setLive] = useState<Festival | null>(null);
  const [step, setStep] = useState<"form" | "designs" | "done">("form");
  const [form, setForm] = useState<Form>(() => presetForm("diwali"));
  const [formError, setFormError] = useState<string | null>(null);
  const [bgFile, setBgFile] = useState<string | null>(null);
  const [design, setDesign] = useState<DesignId>("royal");
  const [posterBikes, setPosterBikes] = useState<string[]>([]);
  const [imgs, setImgs] = useState<Images | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    document.title = `Poster maker — ${brand.fullName}`;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  // Load the offer that is live now, to show its status and edit it
  useEffect(() => {
    if (!token) return;
    fetch("/api/festival")
      .then((r) => (r.ok ? r.json() : { festival: null }))
      .then(({ festival }: { festival: Festival | null }) => {
        setLive(festival);
        if (festival) {
          setForm(formFromFestival(festival));
          if (festival.design in DESIGNS) setDesign(festival.design as DesignId);
          if (festival.posterBikes?.length) setPosterBikes(festival.posterBikes);
        }
      })
      .catch(() => undefined);
  }, [token]);

  const draft = useMemo(() => festivalFromForm(form, design, posterBikes), [form, design, posterBikes]);
  const offers = useMemo(() => offerBikes(draft), [draft]);
  // Greeting posters can show any cycle (no prices); offer posters show cycles in the offer
  const pool = useMemo<OfferBike[]>(
    () => (draft.mode === "greeting" ? products.map((p) => ({ ...p, offerPrice: p.price, save: 0 })) : offers),
    [draft.mode, offers],
  );
  const chosen = useMemo(
    () => posterBikes.map((id) => pool.find((b) => b.id === id)).filter((b): b is OfferBike => !!b),
    [posterBikes, pool],
  );

  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const logout = () => {
    saveToken(null);
    setToken(null);
  };

  const goToDesigns = async (e: FormEvent) => {
    e.preventDefault();
    const err = validate(form);
    setFormError(err);
    if (err) return;
    // Default poster bikes: biggest savings first (offer) or the top-banner bikes (greeting)
    const greeting = form.mode === "greeting";
    const candidates = greeting ? products : offers;
    const ordered = greeting
      ? [...heroBikes, ...products.filter((p) => !heroBikes.includes(p))]
      : [...offers].sort((a, b) => b.save - a.save || Number(!!b.featured) - Number(!!a.featured));
    const keep = posterBikes.filter((id) => candidates.some((b) => b.id === id));
    const picked = keep.length ? keep : ordered.slice(0, 3).map((b) => b.id);
    setPosterBikes(picked);
    setBusy("Loading photos…");
    try {
      await loadPosterFonts();
      const [logo, background] = await Promise.all([loadImage(brand.logo), bgFile ? loadImage(bgFile) : Promise.resolve(null)]);
      const bikes = new Map<string, HTMLImageElement>();
      await Promise.all(candidates.map(async (b) => bikes.set(b.id, await loadImage(b.image))));
      setImgs({ logo, background, bikes });
      setStep("designs");
      window.scrollTo({ top: 0 });
    } catch {
      setFormError("Could not load a bike photo or the background image.");
    } finally {
      setBusy(null);
    }
  };

  const renderAll = (d: DesignId) => {
    const out: Partial<Record<PosterSize, string>> = {};
    for (const size of ORDER) {
      const c = document.createElement("canvas");
      drawPoster(c, posterData(size, d, draft, chosen, offers, imgs!));
      out[size] = c.toDataURL("image/webp", 0.9);
    }
    return out as Record<PosterSize, string>;
  };

  const publish = async () => {
    if (!imgs || !chosen.length) return;
    setBusy("Publishing to the website…");
    setNotice(null);
    try {
      const posters = renderAll(design);
      const r = await fetch("/api/festival", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ festival: draft, posters }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.status === 401) {
        logout();
        throw new Error("Your login expired. Please enter the password again.");
      }
      if (!r.ok) throw new Error(body.error || "Publishing failed");
      setLive(body.festival);
      setStep("done");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const unpublish = async () => {
    if (!window.confirm("Remove the festival offer and poster from the website?")) return;
    setBusy("Removing…");
    try {
      const r = await fetch("/api/festival", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) {
        logout();
        return;
      }
      if (!r.ok) throw new Error("Could not remove the offer");
      setLive(null);
      setNotice({ kind: "ok", text: "The festival offer has been removed from the website." });
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const download = (size: PosterSize) => {
    const url = renderAll(design)[size];
    const a = document.createElement("a");
    a.href = url;
    a.download = `vmount-${draft.id}-${size}.webp`;
    a.click();
  };

  return (
    <main className="ps">
      <header className="ps-head">
        <a href="/" className="ps-brand">
          <img src={brand.logo} alt="" /> {brand.fullName}
        </a>
        {token && (
          <button className="btn btn-ghost btn-small" onClick={logout}>
            Log out
          </button>
        )}
      </header>

      <AnimatePresence>{!token && <Login onToken={(t) => (saveToken(t), setToken(t))} />}</AnimatePresence>

      {token && (
        <>
          <h1>Festival poster maker</h1>
          <Steps step={step} />

          {live && step !== "done" && (
            <div className="ps-live">
              <span className="ps-dot" /> Live on the website: <strong>{live.name}</strong> ({formatDay(live.start)} – {formatDay(live.end)})
              <button className="btn btn-ghost btn-small" onClick={unpublish} disabled={!!busy}>
                Remove from website
              </button>
            </div>
          )}
          {notice && <p className={`ps-notice ${notice.kind}`}>{notice.text}</p>}

          {step === "form" && (
            <OfferForm
              form={form}
              update={update}
              setForm={setForm}
              error={formError}
              busy={busy}
              bgFile={bgFile}
              setBgFile={setBgFile}
              onSubmit={goToDesigns}
            />
          )}

          {step === "designs" && imgs && (
            <section className="ps-section">
              <h2>2. Choose a poster</h2>
              <p className="ps-help">Pick the design you like. You can change the bikes on the poster too.</p>

              <div className="ps-field">
                <span className="ps-label">Bikes on the poster (up to 3 — the first is the big one)</span>
                <div className="ps-bikes">
                  {[...pool]
                    .sort((a, b) => b.save - a.save)
                    .slice(0, 24)
                    .map((b) => {
                      const n = posterBikes.indexOf(b.id);
                      return (
                        <button
                          type="button"
                          key={b.id}
                          className={n >= 0 ? "on" : ""}
                          aria-pressed={n >= 0}
                          onClick={() =>
                            setPosterBikes((cur) =>
                              cur.includes(b.id) ? cur.filter((x) => x !== b.id) : cur.length < 3 ? [...cur, b.id] : cur,
                            )
                          }
                        >
                          {n >= 0 && <span className="ps-num">{n + 1}</span>}
                          <img src={b.image} alt="" />
                          <span>{b.name}</span>
                          <small>
                            {draft.mode === "greeting" ? b.category : <>{inr.format(b.offerPrice)} {b.save > 0 && <s>{inr.format(b.price)}</s>}</>}
                          </small>
                        </button>
                      );
                    })}
                </div>
              </div>

              {chosen.length === 0 ? (
                <p className="ps-notice error">Pick at least one bike for the poster.</p>
              ) : (
                <>
                  <div className="ps-designs" role="radiogroup" aria-label="Poster design">
                    {DESIGN_IDS.map((d) => (
                      <button
                        type="button"
                        key={d}
                        role="radio"
                        aria-checked={design === d}
                        className={`ps-design${design === d ? " on" : ""}`}
                        onClick={() => setDesign(d)}
                      >
                        <PosterCanvas input={posterData("square", d, draft, chosen, offers, imgs)} />
                        <strong>{DESIGNS[d].name}</strong>
                        <span>{DESIGNS[d].desc}</span>
                      </button>
                    ))}
                  </div>

                  <h3 className="ps-sub">All sizes — {DESIGNS[design].name}</h3>
                  <div className="ps-grid">
                    {ORDER.map((size) => (
                      <figure key={size} className={`ps-card ps-${size}`}>
                        <PosterCanvas input={posterData(size, design, draft, chosen, offers, imgs)} />
                        <figcaption>
                          <div>
                            <strong>{SIZES[size].label}</strong>
                            <span>{SIZES[size].hint}</span>
                          </div>
                          <button type="button" className="btn btn-ghost btn-small" onClick={() => download(size)}>
                            Download
                          </button>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </>
              )}

              <div className="ps-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setStep("form")}>
                  ← Back to edit
                </button>
                <button type="button" className="btn btn-primary" onClick={publish} disabled={!!busy || !chosen.length}>
                  {busy ?? "Publish to website"}
                </button>
              </div>
            </section>
          )}

          {step === "done" && live && (
            <motion.section className="ps-section ps-done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h2>🎉 Published!</h2>
              <p>
                <strong>{live.name}</strong> is set to show on the website from <strong>{formatDay(live.start)}</strong> to{" "}
                <strong>{formatDay(live.end)}</strong>. It appears within about 30 seconds and switches off automatically after
                the end date.
              </p>
              {live.posters && <img className="ps-done-img" src={live.posters.wide} alt="Published poster" />}
              <div className="ps-actions">
                <a className="btn btn-primary" href={todayISO() < live.start ? "/?preview-offer#offers" : "/#offers"} target="_blank" rel="noreferrer">
                  {todayISO() < live.start ? "Preview on website" : "View on website"}
                </a>
                <button type="button" className="btn btn-ghost" onClick={() => setStep("designs")}>
                  Download posters
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setStep("form")}>
                  Edit offer
                </button>
                <button type="button" className="btn btn-ghost" onClick={unpublish} disabled={!!busy}>
                  Remove from website
                </button>
              </div>
            </motion.section>
          )}
        </>
      )}
    </main>
  );
}

// ---------- pieces ----------

function Steps({ step }: { step: "form" | "designs" | "done" }) {
  const items = [
    ["form", "Offer details"],
    ["designs", "Choose poster"],
    ["done", "Published"],
  ] as const;
  const at = items.findIndex(([k]) => k === step);
  return (
    <ol className="ps-steps">
      {items.map(([k, label], i) => (
        <li key={k} className={i <= at ? "on" : ""}>
          <span>{i + 1}</span> {label}
        </li>
      ))}
    </ol>
  );
}

function PosterCanvas({ input }: { input: PosterInput }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawPoster(ref.current, input);
  });
  return <canvas ref={ref} />;
}

function OfferForm(props: {
  form: Form;
  update: <K extends keyof Form>(key: K, value: Form[K]) => void;
  setForm: (f: Form) => void;
  error: string | null;
  busy: string | null;
  bgFile: string | null;
  setBgFile: (v: string | null) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const { form, update, setForm, error, busy, bgFile, setBgFile, onSubmit } = props;
  const greeting = form.mode === "greeting";
  const none = form.discountType === "none";
  const sample = { discountType: form.discountType === "none" ? ("flat" as const) : form.discountType, discountValue: none ? 0 : Number(form.discountValue) || 0 };

  const togglePick = (id: string) => {
    const next = { ...form.picked };
    if (id in next) delete next[id];
    else next[id] = "";
    update("picked", next);
  };

  return (
    <form className="ps-section" onSubmit={onSubmit} noValidate>
      <h2>1. Poster details</h2>

      <fieldset className="ps-field">
        <legend className="ps-label">What kind of poster?</legend>
        <div className="ps-types">
          {(
            [
              ["greeting", "Festival greeting", "Wishes for your customers with your cycles in the picture. No prices or discounts."],
              ["offer", "Festival offer", "Discounts or special prices on all cycles or selected cycles."],
            ] as const
          ).map(([value, title, desc]) => (
            <label key={value} className={form.mode === value ? "on" : ""}>
              <input
                type="radio"
                name="mode"
                checked={form.mode === value}
                onChange={() => setForm(switchMode(form, value))}
              />
              <strong>{title}</strong>
              <span>{desc}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="ps-row">
        <label className="ps-field">
          <span className="ps-label">Festival</span>
          <select
            value={form.preset}
            onChange={(e) => setForm(presetForm(e.target.value, form))}
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="ps-field">
          <span className="ps-label">Festival name *</span>
          <input required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Diwali" />
        </label>
      </div>

      <div className="ps-row">
        <label className="ps-field">
          <span className="ps-label">Greeting</span>
          <input value={form.greeting} onChange={(e) => update("greeting", e.target.value)} placeholder="e.g. Happy Diwali" />
        </label>
        <label className="ps-field">
          <span className="ps-label">Greeting in Gujarati (optional)</span>
          <input className="gu" value={form.greetingLocal} onChange={(e) => update("greetingLocal", e.target.value)} placeholder="e.g. શુભ દીપાવલી" />
        </label>
      </div>

      <label className="ps-field">
        <span className="ps-label">{greeting ? "Headline *" : "Offer headline *"}</span>
        <input required maxLength={60} value={form.headline} onChange={(e) => update("headline", e.target.value)} placeholder={greeting ? "e.g. Happy Diwali from V Mount Bikes" : "e.g. Diwali Dhamaka Offer"} />
      </label>
      <label className="ps-field">
        <span className="ps-label">{greeting ? "Your message *" : "Description *"}</span>
        <textarea
          required
          maxLength={greeting ? 280 : 200}
          rows={greeting ? 3 : 2}
          value={form.subline}
          onChange={(e) => update("subline", e.target.value)}
          placeholder={greeting ? "Your festival wishes for your customers" : "One or two short lines about the offer"}
        />
      </label>

      <div className="ps-row">
        <label className="ps-field">
          <span className="ps-label">Show on website from *</span>
          <input type="date" required value={form.start} onChange={(e) => update("start", e.target.value)} />
        </label>
        <label className="ps-field">
          <span className="ps-label">Until (last day) *</span>
          <input type="date" required min={form.start} value={form.end} onChange={(e) => update("end", e.target.value)} />
        </label>
      </div>

      {!greeting && (
      <>
      <fieldset className="ps-field">
        <legend className="ps-label">Offer is on</legend>
        <div className="ps-seg">
          <label className={form.appliesTo === "selected" ? "on" : ""}>
            <input type="radio" name="applies" checked={form.appliesTo === "selected"} onChange={() => update("appliesTo", "selected")} />
            Selected cycles
          </label>
          <label className={form.appliesTo === "all" ? "on" : ""}>
            <input type="radio" name="applies" checked={form.appliesTo === "all"} onChange={() => update("appliesTo", "all")} />
            All cycles (common offer)
          </label>
        </div>
      </fieldset>

      <div className="ps-row">
        <label className="ps-field">
          <span className="ps-label">Discount</span>
          <select value={form.discountType} onChange={(e) => update("discountType", e.target.value as Form["discountType"])}>
            <option value="flat">₹ off</option>
            <option value="percent">% off</option>
            <option value="none">No discount (gift only)</option>
          </select>
        </label>
        {!none && (
          <label className="ps-field">
            <span className="ps-label">{form.discountType === "percent" ? "Percent off *" : "Amount off (₹) *"}</span>
            <input
              type="number"
              min={0}
              max={form.discountType === "percent" ? 90 : undefined}
              value={form.discountValue}
              onChange={(e) => update("discountValue", e.target.value)}
            />
          </label>
        )}
      </div>

      {form.appliesTo === "selected" && (
        <div className="ps-field">
          <span className="ps-label">
            Cycles in the offer * — tick the cycles, and type a special price if you want one (otherwise the discount above is used)
          </span>
          <div className="ps-cycle-list">
            {products.map((p) => {
              const on = p.id in form.picked;
              const auto = discounted(sample, p.price);
              return (
                <div key={p.id} className={`ps-cycle${on ? " on" : ""}`}>
                  <label>
                    <input type="checkbox" aria-label={`Include ${p.name} in the offer`} checked={on} onChange={() => togglePick(p.id)} />
                    <img src={p.image} alt="" />
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.category} · {inr.format(p.price)}
                      </small>
                    </span>
                  </label>
                  {on && (
                    <input
                      type="number"
                      min={0}
                      max={p.price}
                      aria-label={`Offer price for ${p.name}`}
                      placeholder={`Offer ₹ (${auto.toLocaleString("en-IN")})`}
                      value={form.picked[p.id]}
                      onChange={(e) => update("picked", { ...form.picked, [p.id]: e.target.value })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      </>
      )}

      <label className="ps-field">
        <span className="ps-label">{greeting ? "Extra line (optional, e.g. Showroom open all festival days)" : "Free gift / extra (optional)"}</span>
        <input maxLength={60} value={form.extras} onChange={(e) => update("extras", e.target.value)} placeholder="e.g. Free helmet + bell with every cycle" />
      </label>
      {!greeting && (
        <label className="ps-field">
          <span className="ps-label">Terms (small print, optional)</span>
          <textarea maxLength={250} rows={2} value={form.terms} onChange={(e) => update("terms", e.target.value)} />
        </label>
      )}

      <label className="ps-field">
        <span className="ps-label">Your own festival background image (optional — otherwise the design artwork is used)</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return setBgFile(null);
            const reader = new FileReader();
            reader.onload = () => setBgFile(String(reader.result));
            reader.readAsDataURL(file);
          }}
        />
        {bgFile && (
          <span className="ps-bg-preview">
            <img src={bgFile} alt="Background preview" />
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setBgFile(null)}>
              Remove
            </button>
          </span>
        )}
      </label>

      {error && <p className="ps-notice error">{error}</p>}
      <div className="ps-actions">
        <button className="btn btn-primary" disabled={!!busy}>
          {busy ?? "Create posters →"}
        </button>
      </div>
    </form>
  );
}
