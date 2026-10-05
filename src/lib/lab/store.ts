import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LabRun } from "./types";
const dir = path.join(process.cwd(), ".data"),
  file = path.join(dir, "faultline.json");
const state = globalThis as typeof globalThis & {
  faultlineQueue?: Promise<unknown>;
};
export function labTransaction<T>(
  fn: (runs: LabRun[]) => Promise<T> | T,
): Promise<T> {
  const operation = (state.faultlineQueue ?? Promise.resolve()).then(
    async () => {
      await mkdir(dir, { recursive: true });
      let runs: LabRun[];
      try {
        runs = JSON.parse(await readFile(file, "utf8"));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        runs = [];
      }
      const result = await fn(runs);
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify(runs, null, 2), { mode: 0o600 });
      await rename(temp, file);
      return result;
    },
  );
  state.faultlineQueue = operation.catch(() => undefined);
  return operation;
}
