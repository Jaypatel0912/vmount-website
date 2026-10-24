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
- **Add / edit / delete**: name, price (empty = “Ask for price”), tag, features, collections, and photo
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

## Managing collections — `/admin` → Collections tab

Collections are the cards on the catalogue home page (e.g. `26" Cycles`, `Walker`), grouped under
headings (e.g. *Cycles*, *Kids & Toys*).

- **Add / edit**: name, short description, badge (text or emoji), colour, heading, and an optional cover photo
  (without one, the first in-stock product's photo is used).
- **Order**: ↑ ↓ on collections and on headings.
- **Hide**: 👁 hides a collection from customers but keeps its products.
- **Delete**: allowed when every product in it is also in another collection (otherwise move or delete those
  products first, or hide the collection). Headings can be deleted once they're empty.
- “N products →” jumps to that collection's products.

Until collections are first saved, the built-in list in `src/data.ts` (`builtInGroups`) is used.
