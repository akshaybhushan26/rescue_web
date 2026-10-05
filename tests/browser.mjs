import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

// Destructive sandbox test: resets local demo cases. Run against a dedicated local server.
const base = process.env.DEMO_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const post = (data, extra = {}) =>
  context.request.post(`${base}/api/workspace`, { data, ...extra });
const get = async () =>
  (await context.request.get(`${base}/api/workspace`)).json();
const byId = (data, id) => data.cases.find((c) => c.id === id);
async function ok(response) {
  assert.equal(response.status(), 200, await response.text());
  return response.json();
}
await mkdir("test-results", { recursive: true });
try {
  await ok(await post({ action: "reset" }));
  await page.goto(`${base}/order-desk`);
  await page.getByRole("button", { name: /^Needs your review/ }).click();
  await page
    .getByRole("heading", { name: "All clear here.", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Back to all emails", exact: true })
    .click();
  assert.equal(
    await page.getByRole("region", { name: "Next step" }).count(),
    1,
  );
  await page.getByRole("button", { name: "Run agent", exact: true }).click();
  await page.getByText("Ready for your approval.", { exact: true }).waitFor();
  assert.equal((await get()).cases[0].proposal.total, 1925);
  assert.equal(
    await page.locator(".email-letter").getAttribute("open"),
    null,
    "Analyzed email should fold away to focus the draft",
  );
  await page.screenshot({
    path: "test-results/clear-order.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Action details", exact: true })
    .click();
  await page
    .getByText("execution: disabled · no live ERP adapter connected", {
      exact: true,
    })
    .waitFor();
  await page.getByRole("button", { name: "Proposal", exact: true }).click();
  await page
    .getByLabel("Reviewer note")
    .fill("Confirmed quantities and terms for the sandbox walkthrough.");
  await page
    .getByRole("button", { name: "Approve proposal", exact: true })
    .click();
  await page.getByText("Approved for the sandbox", { exact: true }).waitFor();
  await page.getByRole("button", { name: /Activity/ }).click();
  await page
    .getByText("Proposal approved in sandbox", { exact: true })
    .waitFor();
  console.log("PASS clear order → inspect payload → approve → audit");

  await page
    .getByRole("button", { name: "Ambiguous case", exact: true })
    .click();
  await page.getByRole("button", { name: "Run agent", exact: true }).click();
  await page
    .getByText("This request needs a closer look.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: /^Human review/ }).click();
  await page
    .getByRole("button", { name: "Review details", exact: true })
    .click();
  await page
    .getByLabel("Confirmed order reference")
    .waitFor({ state: "visible" });
  assert.equal(
    await page
      .getByRole("button", { name: "Approve proposal", exact: true })
      .isDisabled(),
    true,
  );
  await page.screenshot({
    path: "test-results/ambiguous-review.png",
    fullPage: true,
  });
  await page.getByLabel("Confirmed order reference").selectOption("SO-2056");
  await page
    .getByRole("button", { name: "Confirm & validate", exact: true })
    .click();
  await page
    .getByText(
      "Partial changes require clarification; the MVP only supports replacing quantities for all existing lines.",
      { exact: true },
    )
    .waitFor();
  await page.getByLabel("Confirmed order reference").selectOption("SO-2041");
  await page
    .getByRole("button", { name: "Confirm & validate", exact: true })
    .click();
  await page.getByText("Amend SO-2041", { exact: true }).waitFor();
  assert.equal(byId(await get(), "mail-ambiguous").proposal.expectedVersion, 3);
  console.log(
    "PASS ambiguous review → partial-line guard → confirmed versioned amendment",
  );

  const data = await ok(
    await post({ action: "analyze", id: "mail-hostile", revision: 0 }),
  );
  const hostile = byId(data, "mail-hostile");
  assert.equal(hostile.confidence, 0.9);
  assert.equal(hostile.proposal, null);
  assert.equal(
    (
      await post({
        action: "approve",
        id: hostile.id,
        revision: hostile.revision,
        note: "Attempt to override blocking policy.",
      })
    ).status(),
    409,
  );
  assert.equal(
    (
      await post({
        action: "resolve",
        id: hostile.id,
        revision: hostile.revision,
        orderId: "SO-2041",
      })
    ).status(),
    409,
  );
  assert.equal(
    (await post({ action: "analyze", id: "mail-clear", revision: 0 })).status(),
    409,
  );
  assert.equal(
    (
      await post(
        { action: "reset" },
        { headers: { origin: "https://untrusted.example" } },
      )
    ).status(),
    403,
  );
  assert.equal(
    (
      await post({
        action: "ingest",
        from: "not-an-email",
        subject: "test",
        body: "bad input",
      })
    ).status(),
    400,
  );
  console.log(
    "PASS server rejects policy bypass, stale revisions, cross-origin mutations, invalid input",
  );

  const custom = await ok(
    await post({
      action: "ingest",
      from: "maya@northstar.example",
      subject: "Duplicate approved PO",
      body: "Please place a new order for 25 BRG-6204 under PO NS-4420.",
    }),
  );
  const duplicateId = custom.cases.at(-1).id;
  const analyzedDuplicate = await ok(
    await post({ action: "analyze", id: duplicateId, revision: 0 }),
  );
  assert.equal(
    (
      await post({
        action: "approve",
        id: duplicateId,
        revision: byId(analyzedDuplicate, duplicateId).revision,
        note: "Testing duplicate approval rejection.",
      })
    ).status(),
    409,
  );
  const explicit = await ok(
    await post({ action: "analyze", id: "mail-amend", revision: 0 }),
  );
  const rev = byId(explicit, "mail-amend").revision;
  const responses = await Promise.all([
    post({
      action: "approve",
      id: "mail-amend",
      revision: rev,
      note: "Concurrent approval check one.",
    }),
    post({
      action: "approve",
      id: "mail-amend",
      revision: rev,
      note: "Concurrent approval check two.",
    }),
  ]);
  assert.deepEqual(responses.map((r) => r.status()).sort(), [200, 409]);
  console.log(
    "PASS duplicate customer/PO approval and concurrent stale approval protection",
  );

  await page.reload();
  await page.getByRole("button", { name: "Add an email", exact: true }).click();
  await page
    .getByLabel("Subject", { exact: true })
    .fill("Browser-created request");
  await page
    .getByLabel("Email body", { exact: true })
    .fill("Please place a new order for 25 BRG-6204 under PO NS-4490.");
  await page.getByRole("button", { name: "Add to inbox", exact: true }).click();
  await page
    .getByRole("heading", {
      name: "Browser-created request",
      exact: true,
      level: 2,
    })
    .waitFor();
  await page.getByRole("button", { name: "Run agent", exact: true }).click();
  await page.getByText("Ready for your approval.", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Mobile page overflows horizontally",
  );
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  console.log(
    "PASS custom email ingestion, analysis, and mobile overflow check",
  );
  assert.deepEqual(errors, [], "Browser runtime errors");
  await ok(await post({ action: "reset" }));
  console.log(
    "All browser and API checks passed. Sandbox reset to original sample emails.",
  );
} finally {
  await browser.close();
}
