import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Plain-file storage for the festival API (used by `npm run dev` on your computer). */
export function fileStore(dir) {
  const file = (key) => join(dir, key);
  const ready = mkdir(dir, { recursive: true });
  return {
    async getJSON(key) {
      await ready;
      try {
        return JSON.parse(await readFile(file(`${key}.json`), "utf8"));
      } catch {
        return null;
      }
    },
    async setJSON(key, value) {
      await ready;
      await writeFile(file(`${key}.json`), JSON.stringify(value, null, 2));
    },
    async getBytes(key) {
      await ready;
      try {
        const data = await readFile(file(key));
        const type = (await readFile(file(`${key}.type`), "utf8").catch(() => "")) || undefined;
        return { data, type };
      } catch {
        return null;
      }
    },
    async setBytes(key, bytes, type) {
      await ready;
      await writeFile(file(key), bytes);
      await writeFile(file(`${key}.type`), type || "");
    },
    async delete(key) {
      await ready;
      for (const f of [`${key}.json`, key, `${key}.type`]) await rm(file(f), { force: true });
    },
  };
}
