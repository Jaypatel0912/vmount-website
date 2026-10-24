import { handleCatalog } from "../../../netlify/lib/catalog-api.mjs";
import { blobStore } from "../../../netlify/lib/blob-store.mjs";

export default (req) =>
  handleCatalog(req, blobStore("catalog"), {
    CATALOG_PASSWORD: process.env.CATALOG_PASSWORD,
    POSTER_PASSWORD: process.env.POSTER_PASSWORD,
    POSTER_SECRET: process.env.POSTER_SECRET,
    MAIN_SITE_URL: process.env.MAIN_SITE_URL,
  });

export const config = { path: ["/api/catalog", "/api/catalog/*"] };
