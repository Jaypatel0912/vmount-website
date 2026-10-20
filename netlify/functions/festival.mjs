import { handleFestival } from "../lib/festival-api.mjs";
import { blobStore } from "../lib/blob-store.mjs";

export default (req) =>
  handleFestival(req, blobStore("festival"), {
    POSTER_PASSWORD: process.env.POSTER_PASSWORD,
    POSTER_SECRET: process.env.POSTER_SECRET,
  });

export const config = { path: ["/api/festival", "/api/festival/*"] };
