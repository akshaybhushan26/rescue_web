import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { analyze } from "../agent";
import { MockExtractor } from "../extractor";
import type { Case, ERPContext } from "../types";
import { adapt, contractFor, MockERP } from "./mock-erp";
import { erpSnapshot, fixtures } from "./fixtures";
import type {
  Config,
  Fixture,
  LabRun,
  Report,
  Repair,
  Result,
  Trace,
  Outcome,
  ContractResponse,
} from "./types";
export const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const legacyConfig: Config = {
  version: "legacy-v1",
  quantityField: "quantity",
  scope: "schema-v2-only",
  execution: "isolated-mock-only",
};
export const repairedConfig: Config = {
  ...legacyConfig,
  version: "verified-v2",
  quantityField: "order_qty",
};
export async function sourceDigest() {
  return digest(
    await Promise.all([
      readFile(path.join(process.cwd(), "src/lib/agent.ts"), "utf8"),
      readFile(path.join(process.cwd(), "src/lib/extractor.ts"), "utf8"),
      readFile(path.join(process.cwd(), "src/lib/lab/runner.ts"), "utf8"),
      readFile(path.join(process.cwd(), "src/lib/lab/mock-erp.ts"), "utf8"),
      readFile(path.join(process.cwd(), "pnpm-lock.yaml"), "utf8"),
    ]),
  );
}
function makeCase(f: Fixture): Case {
  return {
    id: f.id,
    email: structuredClone(f.email),
    revision: 0,
    status: "received",
    provider: null,
    intent: null,
    customer: null,
    orders: [],
    checks: [],
    confidence: 0,
    proposal: null,
    audit: [],
    reviewNote: null,
  };
}
export async function executeFixture(
  f: Fixture,
  config: Config,
  context: ERPContext,
): Promise<Result> {
  const start = performance.now();
  const trace: Trace[] = [];
  const log = (
    stage: string,
    label: string,
    status: Trace["status"],
    evidence: Trace["evidence"],
  ) =>
    trace.push({
      id: `${f.id}-${trace.length}`,
      stage,
      label,
      status,
      elapsedMs: Math.round((performance.now() - start) * 100) / 100,
      evidence,
    });
  log("input", "Email fixture loaded", "passed", {
    email: f.email,
    deliveries: f.deliveries,
    inputDigest: digest(f.email),
  });
  const analysis = await analyze(
    makeCase(f),
    new MockExtractor(context.products),
    undefined,
    context,
  );
  log(
    "context",
    "Customer and order context resolved",
    analysis.customer ? "passed" : "held",
    { customer: analysis.customer, orders: analysis.orders },
  );
  log(
    "intent",
    "Structured intent extracted",
    analysis.intent ? "passed" : "held",
    { provider: "deterministic-mock", intent: analysis.intent },
  );
  log(
    "policy",
    "Server policy evaluated",
    analysis.proposal ? "passed" : "held",
    { checks: analysis.checks, proposedAction: analysis.proposal },
  );
  const erp = new MockERP(f.fault, structuredClone(context));
  let outcome: Outcome = "review",
    request: Record<string, unknown> | null = null,
    response: ContractResponse | null = null;
  if (analysis.proposal) {
    const contract = contractFor(f.fault);
    log(
      "contract",
      "Current API contract inspected",
      contract.unit === "each" ? "passed" : "held",
      { contract },
    );
    if (contract.unit !== "each") {
      outcome = "manual";
      log("guard", "Unit semantics differ; repair refused", "held", {
        sourceUnit: "each",
        targetUnit: contract.unit,
        reason:
          "A field rename would change order quantities. Requires a verified conversion and operator review.",
      });
    } else {
      const field = f.fault === "schema-v2" ? config.quantityField : "quantity";
      const key = `faultline-${digest({ email: f.email, fixtureId: f.id }).slice(0, 24)}`;
      request = adapt(analysis.proposal, field, key);
      for (let delivery = 0; delivery < f.deliveries; delivery++) {
        log("request", `Adapter request · delivery ${delivery + 1}`, "passed", {
          payload: request,
          mapping: field,
          execution: "isolated-mock-only",
        });
        response = erp.submit(request);
        log(
          "response",
          `Mock ERP returned HTTP ${response.status}`,
          response.status < 400 ? "passed" : "failed",
          { ...response, callerKnowsCommit: response.status < 400 },
        );
        if (response.status === 504) {
          const receipt = erp.lookup(key);
          log(
            "reconcile",
            "Idempotency lookup performed before retry",
            receipt ? "passed" : "held",
            { key, receipt, retrySent: false },
          );
          if (receipt) response = receipt;
        }
        outcome =
          response.status < 400
            ? "committed"
            : [401, 503, 504].includes(response.status)
              ? "manual"
              : "failed";
      }
    }
  }
  const quantities = erp.ledger.flatMap((r) =>
    (r.lines as { quantity: number }[]).map((l) => l.quantity),
  );
  const writes = erp.ledger.length;
  const duplicateWrites = Math.max(0, writes - 1);
  const wrongQuantities =
    writes > 0 &&
    JSON.stringify(quantities) !== JSON.stringify(f.expected.quantities);
  const unsafeWrites =
    ["review", "manual"].includes(f.expected.outcome) || wrongQuantities
      ? writes
      : duplicateWrites;
  const passed =
    outcome === f.expected.outcome &&
    writes === f.expected.writes &&
    JSON.stringify(quantities) === JSON.stringify(f.expected.quantities) &&
    unsafeWrites === 0;
  log(
    "assertion",
    passed ? "Expected behavior verified" : "Expected behavior not met",
    passed ? "passed" : "failed",
    {
      expected: f.expected,
      actual: { outcome, writes, quantities, duplicateWrites, unsafeWrites },
    },
  );
  return {
    fixtureId: f.id,
    name: f.name,
    category: f.category,
    fault: f.fault,
    passed,
    outcome,
    expectation: f.expected,
    writes,
    duplicateWrites,
    unsafeWrites,
    elapsedMs: Math.round((performance.now() - start) * 100) / 100,
    trace,
    analysis,
    request,
    response,
    ledger: erp.ledger,
  };
}
export async function executeSuite(
  saved: Fixture[],
  context: ERPContext,
  config: Config,
): Promise<Report> {
  const start = performance.now();
  const results: Result[] = [];
  for (const f of saved)
    results.push(
      await executeFixture(
        structuredClone(f),
        config,
        structuredClone(context),
      ),
    );
  return {
    id: randomUUID(),
    at: new Date().toISOString(),
    config: structuredClone(config),
    results,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    unsafeWrites: results.reduce((s, r) => s + r.unsafeWrites, 0),
    duplicateWrites: results.reduce((s, r) => s + r.duplicateWrites, 0),
    elapsedMs: Math.round((performance.now() - start) * 100) / 100,
  };
}
export async function createRun(): Promise<LabRun> {
  const saved = structuredClone(fixtures),
    erp = erpSnapshot();
  const baseline = await executeSuite(saved, erp, legacyConfig);
  const at = new Date().toISOString();
  return {
    id: randomUUID(),
    revision: 0,
    stage: "baseline",
    createdAt: at,
    snapshot: {
      fixtures: saved,
      erp,
      provider: "deterministic-mock",
      sourceDigest: await sourceDigest(),
      inputDigest: digest({ fixtures: saved, erp }),
    },
    baseline,
    repair: null,
    verification: null,
    replay: null,
    approvedDigest: null,
    reviewNote: null,
    audit: [
      {
        at,
        event: "Baseline executed",
        detail: `${baseline.passed}/${saved.length} expectations met. Each fixture used an isolated mock ledger.`,
      },
    ],
  };
}
export function diagnose(run: LabRun): Repair {
  if (
    !["clean-order", "multi-line"].every(
      (id) => run.baseline.results.find((r) => r.fixtureId === id)?.passed,
    )
  )
    throw new Error(
      "Control fixtures did not pass. Do not infer a mapping repair without a working baseline.",
    );
  const failed = run.baseline.results.find(
    (r) =>
      !r.passed &&
      r.fault === "schema-v2" &&
      r.response?.body.code === "SCHEMA_MISMATCH",
  );
  if (!failed)
    throw new Error(
      "No supported schema mismatch found. An operator must investigate this failure.",
    );
  const contract = contractFor(failed.fault);
  if (contract.unit !== "each" || contract.quantityField !== "order_qty")
    throw new Error(
      "Field semantics are not compatible. No safe repair proposed.",
    );
  const repair = {
    id: randomUUID(),
    title: "Restore the v2 quantity mapping",
    explanation:
      "The agent extracted the correct order. The v2 adapter sent quantity, while the strict contract requires order_qty. Both fields represent positive integer counts of individual items.",
    scope:
      "Mock ERP v2 adapter only. v1 mappings, business policy, and live integrations are unchanged.",
    before: "lines[].quantity ← intent.quantity",
    after: "lines[].order_qty ← intent.quantity",
    config: structuredClone(repairedConfig),
    evidence: [
      {
        source: "Failed request + HTTP 400",
        detail: `Saved ${failed.fixtureId} request contains quantity. Contract validation rejected it as SCHEMA_MISMATCH.`,
      },
      {
        source: "Versioned v2 API contract",
        detail:
          "order_qty is required; unit=each. Unknown fields are rejected by the executable Zod contract.",
      },
      {
        source: "Historical v1 behavior",
        detail:
          "The clean-order and multi-line control fixtures verify individual item counts. Replay must preserve their quantities and totals.",
      },
    ],
  };
  return { ...repair, digest: digest(repair) };
}
export async function validateSnapshot(run: LabRun) {
  if (run.snapshot.sourceDigest !== (await sourceDigest()))
    throw new Error(
      "Runner or agent code changed since this run. Start a new baseline; historical code is not bundled.",
    );
  if (
    run.snapshot.inputDigest !==
    digest({ fixtures: run.snapshot.fixtures, erp: run.snapshot.erp })
  )
    throw new Error("Saved fixture snapshot integrity check failed.");
  if (run.repair) {
    const { digest: expected, ...repair } = run.repair;
    if (digest(repair) !== expected)
      throw new Error(
        "Repair artifact changed. Diagnose and verify a new run.",
      );
  }
}
