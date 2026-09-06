import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import type { Storage } from "./index";

/** Local-disk driver for unit tests. Keys are relative paths; `..` is rejected. */
export function fsDriver(root: string): Storage {
  const pathOf = (key: string) => {
    const p = normalize(join(root, key));
    if (!p.startsWith(normalize(root))) throw new Error(`bad key: ${key}`);
    return p;
  };
  return {
    async put(key, bytes, contentType) {
      const p = pathOf(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, bytes);
      await writeFile(`${p}.type`, contentType);
    },
    async get(key) {
      const p = pathOf(key);
      try {
        const [bytes, contentType] = await Promise.all([
          readFile(p),
          readFile(`${p}.type`, "utf8"),
        ]);
        return { bytes: new Uint8Array(bytes), contentType };
      } catch {
        return null;
      }
    },
    async exists(key) {
      try {
        await stat(pathOf(key));
        return true;
      } catch {
        return false;
      }
    },
    async delete(key) {
      const p = pathOf(key);
      await rm(p, { force: true });
      await rm(`${p}.type`, { force: true });
    },
  };
}
