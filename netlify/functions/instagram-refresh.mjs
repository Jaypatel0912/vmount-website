import { getToken, saveToken } from "../lib/token.mjs";

/** Weekly: extend the Instagram token by another 60 days. */
export default async () => {
  const token = await getToken();
  if (!token) return;
  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
  );
  const body = await res.json().catch(() => ({}));
  if (res.ok && body.access_token) {
    await saveToken(body.access_token);
    console.log("Instagram token refreshed; expires in", body.expires_in, "seconds");
  } else {
    console.error("Instagram token refresh failed", res.status, JSON.stringify(body));
  }
};

export const config = { schedule: "@weekly" };
