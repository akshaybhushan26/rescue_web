import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.DEMO_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const post = (data, extra = {}) =>
  context.request.post(`${base}/api/lab`, { data, ...extra });
await mkdir("test-results", { recursive: true });
try {
  await page.goto(base);
  await page
    .getByRole("button", { name: "Run reliability tests", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "The intent is right. The adapter is wrong.",
      exact: true,
    })
    .waitFor();
  let data = await (await context.request.get(`${base}/api/lab`)).json();
  const baseline = data.run;
  assert.equal(baseline.baseline.passed, 13);
  assert.equal(baseline.baseline.results.length, 15);
  await page.screenshot({
    path: "test-results/faultline-baseline.png",
    fullPage: true,
  });
  assert.equal(
    (
      await post({
        action: "replay",
        id: baseline.id,
        revision: baseline.revision,
      })
    ).status(),
    409,
  );
  assert.equal(
    (
      await post({
        action: "approve",
        id: baseline.id,
        revision: baseline.revision,
        note: "Unverified repair must not be approved.",
      })
    ).status(),
    409,
  );
  assert.equal(
    (
      await post(
        { action: "run" },
        { headers: { origin: "https://untrusted.example" } },
      )
    ).status(),
    403,
  );
  await page
    .getByRole("button", { name: "Execution trace", exact: true })
    .click();
  await page.getByText("Mock ERP returned HTTP 400", { exact: true }).click();
  await page
    .locator(".lab-trace-event[open] pre")
    .filter({ hasText: "SCHEMA_MISMATCH" })
    .waitFor();
  await page
    .getByRole("button", { name: "Diagnosis & repair", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Diagnose integration failure", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "Restore the v2 quantity mapping",
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Verify repair · 15 scenarios", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "Verification: 15/15 expectations met",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Approve repair", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByLabel("Engineer review note")
    .fill(
      "Verified identical units, scoped v2 mapping, and all 15 saved regression fixtures.",
    );
  await page
    .getByRole("button", { name: "Approve repair", exact: true })
    .click();
  assert.equal(
    await page.locator(".lab-flow > div.done").count(),
    3,
    "Approval alone must not mark replay complete",
  );
  await page
    .getByRole("button", { name: "Replay approved repair", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "Repair verified. Replay complete.",
      exact: true,
    })
    .waitFor();
  data = await (await context.request.get(`${base}/api/lab`)).json();
  const completed = data.run;
  assert.equal(completed.stage, "replayed");
  assert.equal(await page.locator(".lab-flow > div.done").count(), 4);
  assert.equal(completed.replay.passed, 15);
  assert.equal(completed.replay.unsafeWrites, 0);
  assert.equal(completed.replay.duplicateWrites, 0);
  assert.equal(completed.approvedDigest, completed.repair.digest);
  assert.equal(completed.snapshot.inputDigest, baseline.snapshot.inputDigest);
  assert.equal(
    (await post({ action: "verify", id: completed.id, revision: 0 })).status(),
    409,
  );
  await page
    .getByRole("button", { name: "Before & after", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "Same inputs. A measured difference.",
      exact: true,
    })
    .waitFor();
  assert.equal(await page.locator(".lab-results-table tbody tr").count(), 15);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/faultline-comparison.png",
    fullPage: true,
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export run", exact: true }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^faultline-.*\.json$/);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByText("Approved repair replayed", { exact: true }).waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: "Before & after", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "Same inputs. A measured difference.",
      exact: true,
    })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page
    .getByRole("button", { name: "Before & after", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "Same inputs. A measured difference.",
      exact: true,
    })
    .waitFor();
  await page.evaluate(() => scrollTo(0, 0));
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Mobile page overflow",
  );
  await page.screenshot({
    path: "test-results/faultline-mobile.png",
    fullPage: true,
  });
  const contract = await context.request.get(`${base}/api/mock-erp/orders`);
  assert.equal((await contract.json()).quantityField, "order_qty");
  const rejected = await context.request.post(`${base}/api/mock-erp/orders`, {
    data: baseline.baseline.results.find((r) => r.fixtureId === "schema-drift")
      .request,
  });
  assert.equal(rejected.status(), 400);
  const accepted = await context.request.post(`${base}/api/mock-erp/orders`, {
    data: completed.replay.results.find((r) => r.fixtureId === "schema-drift")
      .request,
  });
  assert.equal(accepted.status(), 201);
  assert.deepEqual(errors, []);
  console.log(
    "PASS real baseline 13/15 → evidence → verify 15/15 → human approval → fresh replay 15/15",
  );
  console.log(
    "PASS premature/stale/cross-origin commands rejected; trace, export, persistence, mobile, and mock HTTP contract verified",
  );
} finally {
  await browser.close();
}
