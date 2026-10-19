# Instagram on the website

The website reads your posts and reels straight from Instagram through the official
Instagram API. Setup steps are in **ADMIN-SETUP.md → Step 4: Connect Instagram**.

## Alternative: Behold.so

If you'd rather not create a Meta developer app, a Behold.so JSON feed also works,
but it shows only a limited number of recent posts and no "Load more":

1. Create a JSON feed at https://behold.so connected to @vmountbikes.
2. Add `VITE_INSTAGRAM_FEED_URL=<your feed URL>` in Netlify's environment variables
   (or in a local `.env` file), then redeploy.

When `VITE_INSTAGRAM_FEED_URL` is set, it is used instead of the official connection.
