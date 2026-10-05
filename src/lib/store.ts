import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { initialCases } from "./seed";
import type { Case } from "./types";
const folder = path.join(process.cwd(), ".data");
const file = path.join(folder, "workspace.json");
// Single-process serialized transactions. Not a substitute for database transactions across replicas.
const globalStore = globalThis as typeof globalThis & {
  orderStoreQueue?: Promise<unknown>;
};
export function transaction<T>(
  fn: (cases: Case[]) => Promise<T> | T,
): Promise<T> {
  const pending = (globalStore.orderStoreQueue ?? Promise.resolve()).then(
    async () => {
      await mkdir(folder, { recursive: true });
      let cases: Case[];
      try {
        cases = JSON.parse(await readFile(file, "utf8"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        cases = initialCases();
      }
      const result = await fn(cases);
      const temporary = `${file}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(cases, null, 2), {
        mode: 0o600,
      });
      await rename(temporary, file);
      return result;
    },
  );
  globalStore.orderStoreQueue = pending.catch(() => undefined);
  return pending;
}
