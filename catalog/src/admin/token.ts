// Staff login token, kept for this browser tab only (12 hours).
const TOKEN_KEY = "vmount-catalog-token";

export function readToken() {
  try {
    const t = sessionStorage.getItem(TOKEN_KEY);
    return t && Number(t.split(".")[0]) > Date.now() ? t : null;
  } catch {
    return null;
  }
}

export function saveToken(t: string | null) {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable: login lasts for this page view only
  }
}
