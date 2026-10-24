import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";
import { fileURLToPath } from "node:url";
// @ts-expect-error plain JS module shared with the Netlify function
import { handleCatalog } from "../netlify/lib/catalog-api.mjs";
// @ts-expect-error plain JS module
import { fileStore } from "../netlify/lib/file-store.mjs";

// Standalone catalogue site (separate from the main website).
// Dev: npm run catalog   Build: npm run catalog:build  → catalog/dist
const root = fileURLToPath(new URL(".", import.meta.url));
const repo = fileURLToPath(new URL("..", import.meta.url));

const readBody = (req: IncomingMessage) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

/** Runs /api/catalog during `npm run catalog`, saving to .dev-data/catalog instead of Netlify Blobs. */
function catalogApiDev(env: Record<string, string>): Plugin {
  const store = fileStore(`${repo}.dev-data/catalog`);
  return {
    name: "catalog-api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/catalog")) return next();
        try {
          const method = req.method ?? "GET";
          const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
          const headers = new Headers();
          for (const h of ["content-type", "authorization"]) {
            const v = req.headers[h];
            if (typeof v === "string") headers.set(h, v);
          }
          const response: Response = await handleCatalog(new Request(`http://localhost${req.url}`, { method, headers, body }), store, env);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Passwords come from the repo's .env.local (same file as the main site)
  const env = loadEnv(mode, repo, "");
  return {
    root,
    plugins: [react(), catalogApiDev(env)],
    server: { port: 5174 },
    build: { outDir: "dist", emptyOutDir: true },
  };
});
