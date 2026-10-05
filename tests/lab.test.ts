import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtures, erpSnapshot } from "../src/lib/lab/fixtures";
import {
  createRun,
  diagnose,
  executeSuite,
  executeFixture,
  legacyConfig,
  repairedConfig,
  validateSnapshot,
  digest,
} from "../src/lib/lab/runner";
import { MockERP, adapt } from "../src/lib/lab/mock-erp";

test("baseline actually executes 15 scenarios and isolates the two v2 mapping failures", async () => {
  const report = await executeSuite(fixtures, erpSnapshot(), legacyConfig);
  assert.equal(report.results.length, 15);
  assert.equal(report.passed, 13);
  assert.equal(report.failed, 2);
  assert.deepEqual(
    report.results.filter((r) => !r.passed).map((r) => r.fixtureId),
    ["schema-drift", "schema-drift-multi"],
  );
  for (const r of report.results.filter((r) => !r.passed)) {
    assert.equal(r.response?.status, 400);
    assert.equal(r.response?.body.code, "SCHEMA_MISMATCH");
    assert.equal(r.writes, 0);
  }
  assert.equal(report.unsafeWrites, 0);
  assert.equal(report.duplicateWrites, 0);
});
test("candidate mapping fixes v2 and preserves every safety and v1 control", async () => {
  const before = await executeSuite(fixtures, erpSnapshot(), legacyConfig),
    after = await executeSuite(fixtures, erpSnapshot(), repairedConfig);
  assert.equal(after.passed, 15);
  assert.equal(after.failed, 0);
  assert.equal(after.unsafeWrites, 0);
  assert.deepEqual(
    before.results[0].request,
    after.results[0].request,
    "v1 mapping must not change",
  );
  const changed = after.results.find((r) => r.fixtureId === "schema-drift")!;
  assert.equal(
    (changed.request!.lines as Record<string, unknown>[])[0].order_qty,
    200,
  );
  assert.equal(
    (changed.request!.lines as Record<string, unknown>[])[0].quantity,
    undefined,
  );
  assert.equal(changed.ledger[0].total, 2500);
});
test("semantic drift never receives a speculative rename", async () => {
  const f = fixtures.find((f) => f.id === "different-units")!;
  const result = await executeFixture(f, repairedConfig, erpSnapshot());
  assert.equal(result.outcome, "manual");
  assert.equal(result.request, null);
  assert.equal(result.writes, 0);
  assert.ok(result.trace.some((e) => e.stage === "guard"));
});
test("timeout after commit is reconciled with a receipt, without a second write", async () => {
  const r = await executeFixture(
    fixtures.find((f) => f.id === "timeout-after-commit")!,
    legacyConfig,
    erpSnapshot(),
  );
  assert.equal(r.passed, true);
  assert.equal(r.writes, 1);
  assert.equal(r.trace.filter((e) => e.stage === "request").length, 1);
  assert.ok(
    r.trace.some((e) => e.stage === "response" && e.evidence.status === 504),
  );
  assert.ok(
    r.trace.some(
      (e) => e.stage === "reconcile" && e.evidence.retrySent === false,
    ),
  );
});
test("duplicate email deliveries reuse the key and receipt", async () => {
  const r = await executeFixture(
    fixtures.find((f) => f.id === "duplicate-email")!,
    legacyConfig,
    erpSnapshot(),
  );
  assert.equal(r.trace.filter((e) => e.stage === "request").length, 2);
  assert.equal(r.writes, 1);
  assert.equal(r.duplicateWrites, 0);
  assert.equal(r.response?.body.deduplicated, true);
});
test("mock contract rejects a changed payload using an existing idempotency key", async () => {
  const r = await executeFixture(fixtures[0], legacyConfig, erpSnapshot());
  const erp = new MockERP("healthy", erpSnapshot());
  const p = r.request!;
  assert.equal(erp.submit(p).status, 201);
  assert.equal(erp.submit(p).status, 200);
  const conflicting = structuredClone(p);
  conflicting.purchaseOrder = "NS-9999";
  assert.equal(erp.submit(conflicting).status, 409);
  assert.equal(erp.ledger.length, 1);
});
test("mock endpoint enforces price, total, and optimistic order version at the boundary", async () => {
  const r = await executeFixture(fixtures[0], legacyConfig, erpSnapshot());
  const p = structuredClone(r.request!);
  p.total = 999;
  assert.equal(new MockERP("healthy", erpSnapshot()).submit(p).status, 422);
  const amendment = await executeFixture(
    fixtures[2],
    legacyConfig,
    erpSnapshot(),
  );
  const q = structuredClone(amendment.request!);
  q.expectedVersion = 2;
  assert.equal(new MockERP("healthy", erpSnapshot()).submit(q).status, 409);
});
test("stored fixtures and context reproduce semantic results exactly", async () => {
  const run = await createRun();
  await validateSnapshot(run);
  const again = await executeSuite(
    run.snapshot.fixtures,
    run.snapshot.erp,
    run.baseline.config,
  );
  const semantic = (r: typeof again) =>
    r.results.map((x) => ({
      id: x.fixtureId,
      passed: x.passed,
      outcome: x.outcome,
      ledger: x.ledger,
      request: x.request,
    }));
  assert.deepEqual(semantic(again), semantic(run.baseline));
  assert.equal(
    run.snapshot.inputDigest,
    digest({ fixtures: run.snapshot.fixtures, erp: run.snapshot.erp }),
  );
});
test("repair and snapshot mutations invalidate replay integrity", async () => {
  const run = await createRun();
  run.repair = diagnose(run);
  await validateSnapshot(run);
  run.repair.config.quantityField = "quantity";
  await assert.rejects(() => validateSnapshot(run), /Repair artifact changed/);
  const tampered = await createRun();
  tampered.snapshot.fixtures[0].email.body = "Changed";
  await assert.rejects(() => validateSnapshot(tampered), /snapshot integrity/);
  const stale = await createRun();
  stale.snapshot.sourceDigest = "old-version";
  await assert.rejects(() => validateSnapshot(stale), /code changed/);
});
test("wrong fixture quantities are counted as unsafe writes, not only as failures", async () => {
  const f = structuredClone(fixtures[0]);
  f.expected.quantities = [26];
  const r = await executeFixture(f, legacyConfig, erpSnapshot());
  assert.equal(r.passed, false);
  assert.equal(r.unsafeWrites, 1);
});
test("schema repair cannot be inferred if the working controls failed", async () => {
  const run = await createRun();
  run.baseline.results[0].passed = false;
  assert.throws(() => diagnose(run), /Control fixtures/);
});
