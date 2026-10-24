// Login token and server calls shared by the catalogue manager's tabs.
import { preparePhoto } from "../../../src/admin/photo";

export { readToken, saveToken } from "./token";

export class AuthError extends Error {}

export async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers },
    });
  } catch {
    throw new Error("Can't reach the server — check the internet connection, then tap Retry");
  }
  const body = await r.json().catch(() => ({}));
  if (r.status === 401) throw new AuthError(body.error || "Please log in again");
  if (!r.ok) throw new Error(body.error || "Something went wrong — please try again");
  return body as T;
}

/** Resize (and optionally clean) a photo in the browser, upload it, and return its URL. */
export async function uploadPhoto(file: File, cutOut: boolean, name: string, token: string) {
  const dataUrl = await preparePhoto(file, cutOut);
  const { url } = await api<{ url: string }>("/api/catalog/image", token, { method: "POST", body: JSON.stringify({ dataUrl, name }) });
  return url;
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
