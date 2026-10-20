// Shared login for the staff pages (/poster and /cycles). The password lives only in
// the POSTER_PASSWORD environment variable; logins get a signed token valid for 12 hours.
import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_HOURS = 12;

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });

export const safeEqual = (a, b) => {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && timingSafeEqual(A, B);
};

const secret = (env) => env.POSTER_SECRET || `vmount-poster:${env.POSTER_PASSWORD}`;
const sign = (env, exp) => createHmac("sha256", secret(env)).update(String(exp)).digest("base64url");

export function isAuthorized(req, env) {
  if (!env.POSTER_PASSWORD) return false;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(env, exp));
}

export const notConfigured = () =>
  json({ error: "The staff pages are not set up yet: add POSTER_PASSWORD in Netlify and redeploy." }, 503);

export async function handleLogin(req, env) {
  if (!env.POSTER_PASSWORD) return notConfigured();
  const body = await req.json().catch(() => ({}));
  if (!safeEqual(body.password ?? "", env.POSTER_PASSWORD)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return json({ error: "Wrong password" }, 401);
  }
  const exp = Date.now() + TOKEN_HOURS * 3600 * 1000;
  return json({ token: `${exp}.${sign(env, exp)}`, hours: TOKEN_HOURS });
}

/** Decode a "data:image/...;base64,..." upload. */
export function decodeImage(dataUrl, maxBytes) {
  const m = /^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!m) return null;
  const bytes = Buffer.from(m[2], "base64");
  return bytes.length && bytes.length <= maxBytes ? { type: m[1], bytes } : null;
}
