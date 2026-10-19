import { getToken } from "../lib/token.mjs";

const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}";

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

/** GET /api/instagram?limit=12&after=<cursor> — your posts, newest first. */
export default async (req) => {
  const token = await getToken();
  if (!token) return json({ error: "Instagram is not connected" }, 503);

  const params = new URL(req.url).searchParams;
  const api = new URL("https://graph.instagram.com/me/media");
  api.searchParams.set("fields", FIELDS);
  api.searchParams.set("limit", String(Math.min(Number(params.get("limit")) || 12, 50)));
  if (params.get("after")) api.searchParams.set("after", params.get("after"));
  api.searchParams.set("access_token", token);

  const res = await fetch(api);
  if (!res.ok) {
    console.error("Instagram API error", res.status, await res.text());
    return json({ error: "Instagram request failed" }, 502);
  }
  const body = await res.json();
  return json(
    { data: body.data ?? [], next: body.paging?.next ? body.paging?.cursors?.after ?? null : null },
    200,
    // Browsers cache 5 min; Netlify's CDN 15 min, so new posts appear within ~15 minutes.
    { "Cache-Control": "public, max-age=300", "Netlify-CDN-Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
  );
};

export const config = { path: "/api/instagram" };
