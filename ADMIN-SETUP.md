# V Mount Bikes website: going live and using the admin panel

The website has a built-in admin panel at **`/admin`**. From it you can:

- **Cycles:** add, edit or hide bikes (name, price, category, photo, highlight colour, badge, key features), and choose which bikes appear in the 360° showroom.
- **Website settings:** business details (address, phone, WhatsApp, hours, email, Google rating), the top-of-page text, the featured model section, the "Why choose us" cards, the counters and the customer reviews.
- **Media:** upload new photos. Bike photos with a transparent background (PNG/WebP) look best.

When you click **Publish**, the change is saved and the website updates itself in about 1 minute.

Festival offers and posters have their own page: **`/poster`** (see below).

The setup below is done **once**. It needs two free accounts: **GitHub**, which stores the website files, and **Netlify**, which hosts the website.

---

## Step 1: Put the website on GitHub

1. Create a free account at https://github.com.
2. Create a new repository named `vmount-website` (it can be **Private**).
3. Upload this project folder to that repository. Claude can do this for you once you're logged in to GitHub on this computer.

## Step 2: Host it on Netlify

1. Create a free account at https://netlify.com, using **Sign up with GitHub**.
2. Click **Add new project → Import an existing project → GitHub**, then pick `vmount-website`.
3. Keep the default settings (they're read from `netlify.toml`) and click **Deploy**.
4. Your site is now live at an address like `https://vmountbikes.netlify.app`. To use your own domain, go to **Domain management** in Netlify.

## Step 3: Turn on the admin login

1. On GitHub, go to **Settings → Developer settings → OAuth Apps → New OAuth App** and fill in:
   - **Application name:** `V Mount Admin`
   - **Homepage URL:** your Netlify site address
   - **Authorization callback URL:** `https://api.netlify.com/auth/done`
2. Click **Register application**, then **Generate a new client secret**. Copy the **Client ID** and the **Client secret**.
3. In Netlify, open your site, go to **Project configuration → Access & security → OAuth → Install provider → GitHub**, and paste both values.
4. In `public/admin/config.yml`, change these two lines (or send them to Claude):
   ```yaml
   repo: YOUR-GITHUB-USERNAME/vmount-website
   site_url: https://your-site.netlify.app
   ```
5. Open `https://your-site/admin` and click **Login with GitHub**. You're in.

**Adding staff:** on GitHub, open the repository, go to **Settings → Collaborators** and add their GitHub account. Only people you add can log in.

---

## Step 4: Connect Instagram (shows all your posts automatically)

The "Latest posts & reels" section loads all your posts (147 and counting) directly from Instagram, with a **Load more** button. New posts appear on the site within about 15 minutes.

1. **Instagram must be a Professional account.** In the Instagram app, go to **Settings → Account type and tools → Switch to professional account** (Business or Creator). It's free.
2. Go to https://developers.facebook.com, log in, and click **My Apps → Create app**.
   - Name it `VMount Website`.
   - Choose the **Instagram** use case ("Manage messaging & content on Instagram").
3. In the app, open **Instagram → API setup with Instagram login**.
   - Under **Generate access tokens**, click **Add account** and log in as **@vmountbikes**.
   - Click **Generate token** and copy the long token.
4. In Netlify, go to **Project configuration → Environment variables → Add a variable**:
   - **Key:** `IG_ACCESS_TOKEN`
   - **Value:** the token you copied
5. In Netlify, go to **Deploys → Trigger deploy → Deploy site**.

That's it. The token normally expires after 60 days, but the site **renews it automatically every week** (`netlify/functions/instagram-refresh.mjs`), so you don't have to do anything.

Until Instagram is connected, or if it's ever unavailable, the section shows the 3 backup reels listed under **Website settings → Backup reels**.

---

## Editing on your own computer (optional)

Open two terminals in the project folder:

```bash
npm run dev
```

```bash
npm run admin
```

Then open http://localhost:5173/admin/index.html. No login is needed, and changes are saved straight to the files on this computer. They go live only after you upload them to GitHub.

## Where things are

| What | File |
|---|---|
| Cycles | `src/content/products.json` |
| Business info and page text | `src/content/settings.json` |
| Uploaded photos | `public/images/uploads/` |
| Admin panel setup | `public/admin/config.yml` |
| Instagram connection | `netlify/functions/instagram.mjs` |

---

## Festival offers and posters: `/poster`

Open **`https://your-site/poster`** and enter the poster password. Then:

1. **Offer details**: choose the festival (Diwali, Navratri, Uttarayan and more, or a custom name). Check the greeting, headline and description, then set the dates the offer shows on the website.
2. Choose whether the offer is on **selected cycles** (tick them, and optionally type a special price for each) or on **all cycles**, and set the discount: rupees off, percent off, or gift only. You can add a free gift, small-print terms, and your own background image.
3. Click **Create posters**. Pick one of the 4 designs and the bikes to show (up to 3). Download the Instagram post, story/WhatsApp status and wide banner.
4. Click **Publish to website**. Within about 30 seconds the site shows the poster, the offer cards, offer prices in the shop and a small reminder. Everything switches off by itself after the end date.

To change or stop an offer, open `/poster` again: **Edit offer** or **Remove from website**.
To check an offer before its start date, open `https://your-site/?preview-offer`.

### One-time setup: the poster password

The password is checked by the server and is never stored in the website code.

1. In Netlify, go to **Project configuration → Environment variables → Add a variable**.
   - **Key:** `POSTER_PASSWORD`
   - **Value:** your password
2. Optional, for extra safety: add `POSTER_SECRET` with any long random text.
3. Go to **Deploys → Trigger deploy → Deploy site**.

To change the password later, edit `POSTER_PASSWORD` and redeploy. Anyone still logged in is logged out automatically.
When testing on your computer, the password is read from `.env.local`, which is never uploaded.
