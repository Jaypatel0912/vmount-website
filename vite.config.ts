import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";
// @ts-expect-error plain JS module shared with the Netlify function
import { handleFestival } from "./netlify/lib/festival-api.mjs";
// @ts-expect-error plain JS module
import { handleCycles } from "./netlify/lib/cycles-api.mjs";
// @ts-expect-error plain JS module
import { fileStore } from "./netlify/lib/file-store.mjs";

const readBody = (req: IncomingMessage) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

/** Runs the staff APIs during `npm run dev`, saving to .dev-data/ instead of Netlify Blobs. */
function festivalApiDev(env: Record<string, string>): Plugin {
  const festivalStore = fileStore(".dev-data/festival");
  const cyclesStore = fileStore(".dev-data/cycles");
  return {
    name: "festival-api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const cycles = req.url?.startsWith("/api/cycles");
        if (!cycles && !req.url?.startsWith("/api/festival")) return next();
        try {
          const method = req.method ?? "GET";
          const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
          const headers = new Headers();
          for (const h of ["content-type", "authorization"]) {
            const v = req.headers[h];
            if (typeof v === "string") headers.set(h, v);
          }
          const response: Response = await (cycles ? handleCycles : handleFestival)(
            new Request(`http://localhost${req.url}`, { method, headers, body }),
            cycles ? cyclesStore : festivalStore,
            { POSTER_PASSWORD: env.POSTER_PASSWORD, POSTER_SECRET: env.POSTER_SECRET },
          );
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
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), festivalApiDev(env)],
    server: { port: 5173 },
  };
});
