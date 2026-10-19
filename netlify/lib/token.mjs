import { getStore } from "@netlify/blobs";

// The Instagram token starts in the IG_ACCESS_TOKEN env var. A weekly job refreshes
// it and keeps the newest copy in Netlify Blobs, so it never hits the 60-day expiry.
// If someone pastes a new token into IG_ACCESS_TOKEN, that one wins again.

const store = () => getStore("instagram");

export async function getToken() {
  const envToken = process.env.IG_ACCESS_TOKEN || "";
  let saved = null;
  try {
    saved = await store().get("token", { type: "json" });
  } catch {
    // Blobs unavailable (e.g. running outside Netlify) — use the env token.
  }
  if (saved?.token && saved.source === envToken) return saved.token;
  return envToken;
}

export async function saveToken(token) {
  await store().setJSON("token", {
    token,
    source: process.env.IG_ACCESS_TOKEN || "",
    refreshedAt: new Date().toISOString(),
  });
}
