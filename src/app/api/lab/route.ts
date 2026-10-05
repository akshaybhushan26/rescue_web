import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { labTransaction } from "@/lib/lab/store";
import { fixtures } from "@/lib/lab/fixtures";
import {
  createRun,
  diagnose,
  executeSuite,
  validateSnapshot,
} from "@/lib/lab/runner";
import type { LabRun } from "@/lib/lab/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("run") }).strict(),
  z
    .object({
      action: z.enum(["diagnose", "verify", "replay"]),
      id: z.uuid(),
      revision: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      action: z.literal("approve"),
      id: z.uuid(),
      revision: z.number().int().nonnegative(),
      note: z.string().trim().min(8).max(500),
    })
    .strict(),
]);
const summary = (runs: LabRun[]) => ({
  fixtures: fixtures.map(({ email, expected, ...rest }) => ({
    ...rest,
    expectedOutcome: expected.outcome,
  })),
  run: runs.at(-1) ?? null,
  history: runs
    .slice()
    .reverse()
    .map((r) => ({
      id: r.id,
      at: r.createdAt,
      stage: r.stage,
      passed: (r.replay ?? r.verification ?? r.baseline).passed,
      total: r.snapshot.fixtures.length,
    })),
  mode: "deterministic-mock",
});
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  return NextResponse.json(
    await labTransaction((runs) =>
      id
        ? { ...summary(runs), run: runs.find((r) => r.id === id) ?? null }
        : summary(runs),
    ),
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const u = new URL(origin);
      if (
        !["http:", "https:"].includes(u.protocol) ||
        u.host !== request.headers.get("host")
      )
        return NextResponse.json(
          { error: "Cross-origin mutation rejected." },
          { status: 403 },
        );
    } catch {
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
  }
  if (!request.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json({ error: "JSON required." }, { status: 415 });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 10000)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let input: z.infer<typeof command>;
  try {
    input = command.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid command. Approval requires a review note of at least 8 characters.",
      },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await labTransaction(async (runs) => {
        if (input.action === "run") {
          if (runs.length >= 30)
            throw new Error(
              "Local history is limited to 30 runs. Export and archive .data/faultline.json before starting more.",
            );
          runs.push(await createRun());
          return summary(runs);
        }
        const current = runs.find((r) => r.id === input.id);
        if (!current) throw new Error("Run not found.");
        if (current.revision !== input.revision)
          throw new Error("Run changed. Refresh before continuing.");
        await validateSnapshot(current);
        const next = structuredClone(current);
        let event = "",
          detail = "";
        if (input.action === "diagnose") {
          if (next.stage !== "baseline")
            throw new Error("Diagnosis is already recorded.");
          next.repair = diagnose(next);
          next.stage = "diagnosed";
          event = "Repair proposed";
          detail =
            "Rule-based diagnosis grounded in executable schema evidence. No configuration applied.";
        }
        if (input.action === "verify") {
          if (next.stage !== "diagnosed" || !next.repair)
            throw new Error("Diagnose a supported repair first.");
          next.verification = await executeSuite(
            next.snapshot.fixtures,
            next.snapshot.erp,
            next.repair.config,
          );
          next.stage = "verified";
          event = "Regression suite executed";
          detail = `${next.verification.passed}/${next.snapshot.fixtures.length} expectations met. Saved inputs, fresh isolated ledgers.`;
        }
        if (input.action === "approve") {
          if (
            next.stage !== "verified" ||
            !next.repair ||
            !next.verification ||
            next.verification.failed ||
            next.verification.unsafeWrites ||
            next.verification.duplicateWrites
          )
            throw new Error(
              "Approval blocked: verification must pass every scenario with zero unsafe or duplicate writes.",
            );
          next.approvedDigest = next.repair.digest;
          next.reviewNote = input.note;
          next.stage = "approved";
          event = "Repair approved by local operator";
          detail = `${input.note} Approval authorizes isolated sandbox replay only.`;
        }
        if (input.action === "replay") {
          if (
            next.stage !== "approved" ||
            !next.repair ||
            next.approvedDigest !== next.repair.digest
          )
            throw new Error(
              "Approve the verified repair artifact before replay.",
            );
          next.replay = await executeSuite(
            next.snapshot.fixtures,
            next.snapshot.erp,
            next.repair.config,
          );
          next.stage = "replayed";
          event = "Approved repair replayed";
          detail = `${next.replay.passed}/${next.snapshot.fixtures.length} expectations met. No live writes or order-agent configuration changes.`;
        }
        next.revision++;
        next.audit.push({ at: new Date().toISOString(), event, detail });
        runs[runs.findIndex((r) => r.id === next.id)] = next;
        return { ...summary(runs), run: next };
      }),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lab operation failed." },
      { status: 409 },
    );
  }
}
