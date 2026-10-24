# VMount Catalogue (separate site)

A standalone, QuickSell-style catalogue: collections → products → inquiry list → WhatsApp.
It does not change the main website.

- Run locally: `npm run catalog` → http://localhost:5174 (manager: http://localhost:5174/admin)
- Build: `npm run catalog:build` → `catalog/dist`
- Deploy: new Netlify site from the same repo with **Base directory = `catalog`** (settings are in `catalog/netlify.toml`).
  No environment variables are needed — see *Password* below.

## Managing products and stock — `/admin`

Open `https://<your-catalogue-site>/admin` and enter the password. Changes save automatically and
appear on the catalogue within a few seconds.

- **Stock**: tap **Set stock** to start counting a product, then − / + (or type a number).
  `0` shows **Out of stock** with a “Notify me” WhatsApp button; 1–3 shows **Only N left**.
  Clear the stock box in **Edit** to stop tracking (product always shows as available).
- **Hide / show**: the 👁 button hides a product without deleting it.
- **Add / edit / delete**: name, price (empty = “Ask for price”), tag, features, sub-sections, and
  **up to 10 photos** — pick several at once; ★ makes one the main photo, ‹ › reorder, ✕ removes
  (white background can be removed automatically).
- The cards at the top show totals and filter to Out of stock / Low stock / Hidden.

### Password

The manager uses **the same staff password as the main VMount website**. On the catalogue's own Netlify
site nothing needs setting up: the password is checked with the main site
(`https://vmount-cycle.netlify.app`, or `MAIN_SITE_URL` if set), so changing it there changes it here too.
Locally it uses `POSTER_PASSWORD` from `.env.local` (the same one the main site uses).
To give the catalogue its own password instead, set `CATALOG_PASSWORD`.
Local changes are saved in `.dev-data/catalog/`; online they're stored in Netlify Blobs.
Until the first save, the catalogue shows the built-in list in `src/products.json`.

## Sections and sub-sections — `/admin` → Sections tab

The catalogue is organised as **Section → Sub-section → Products**, e.g. *Cycles → 26" Cycles → Duster 26"*
or *Kids & Toys → Walker → Panda Gold Walker*. (In the code, sections are `groups` and sub-sections are
`catalogues`.)

- **+ Add section** (top of the tab): name and a line under it. Right after, the form to add its first
  sub-section opens; then add products and tick that sub-section.
- **Sub-sections**: name, short description, badge (text or emoji), colour, section, optional cover photo
  (otherwise the first in-stock product's photo is used).
- **Order**: ↑ ↓ on sections and sub-sections. **Hide**: 👁 hides a sub-section but keeps its products.
- **Delete**: a sub-section can be deleted when every product in it is also in another one (otherwise move
  or delete those products first, or hide it). A section can be deleted once it's empty.
- “N products →” jumps to that sub-section's products.

Until sections are first saved, the built-in list in `src/data.ts` (`builtInGroups`) is used.

## WhatsApp inquiries and photos

A WhatsApp link (`wa.me`) can only carry text, so:

- **Ask on WhatsApp / Send inquiry on WhatsApp** opens the VMount chat with the message filled in,
  including a **photo link** for each item (and a link to the product).
- **📷 Share with photos** (shown on phones) sends the actual photos through the phone's share menu:
  the customer picks WhatsApp, then the VMount Bikes chat. The message is copied as well, in case
  WhatsApp drops the text when several photos are shared.
