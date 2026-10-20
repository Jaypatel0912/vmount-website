import { getStore } from "@netlify/blobs";

/** Netlify Blobs storage for the festival API (used online). */
export function blobStore(name) {
  const s = getStore({ name, consistency: "strong" });
  return {
    getJSON: (key) => s.get(key, { type: "json" }),
    setJSON: (key, value) => s.setJSON(key, value),
    getBytes: async (key) => {
      const r = await s.getWithMetadata(key, { type: "arrayBuffer" });
      return r ? { data: r.data, type: r.metadata?.type } : null;
    },
    setBytes: (key, bytes, type) => s.set(key, bytes, { metadata: { type } }),
    delete: (key) => s.delete(key),
  };
}
