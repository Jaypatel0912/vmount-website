import { handleCycles } from "../lib/cycles-api.mjs";
import { blobStore } from "../lib/blob-store.mjs";

export default (req) =>
  handleCycles(req, blobStore("cycles"), {
    POSTER_PASSWORD: process.env.POSTER_PASSWORD,
    POSTER_SECRET: process.env.POSTER_SECRET,
  });

export const config = { path: ["/api/cycles", "/api/cycles/*"] };
