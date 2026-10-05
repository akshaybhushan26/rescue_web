import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.DEMO_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base);
  await page.getByRole("button", { name: "Demo guide", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({
    path: "test-results/rescue-guide.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "New demo run", exact: true }).click();
  await page
    .getByRole("button", { name: "Diagnose failure", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "New demo run", exact: true })
    .waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".rs-heading-actions .primary")?.disabled,
  );
  await page.screenshot({
    path: "test-results/rescue-baseline.png",
    fullPage: true,
    animations: "disabled",
  });
  let run = (await (await context.request.get(`${base}/api/lab`)).json()).run;
  assert.equal(run.baseline.passed, 13);
  const denied = await context.request.post(`${base}/api/lab`, {
    data: { action: "replay", id: run.id, revision: run.revision },
  });
  assert.equal(denied.status(), 409);
  await page
    .getByRole("button", { name: "Diagnose failure", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Test proposed repair", exact: true })
    .click();
  await page.getByText("15/15 regression tests passed").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Approve repair", exact: true })
      .isEnabled(),
    false,
  );
  await page
    .getByRole("textbox", { name: "Review note" })
    .fill("Reviewed v2 scope, quantity semantics, and all regression results.");
  await page
    .getByRole("button", { name: "Approve repair", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Replay approved repair", exact: true })
    .click();
  await page.getByText("Integration recovered in the sandbox.").waitFor();
  await page
    .getByRole("button", {
      name: "A familiar field, different units",
      exact: false,
    })
    .click();
  await page
    .getByText("A mapping change cannot resolve this signal.")
    .waitFor();
  assert.ok(await page.locator(".rs-badge.amber").count());
  await page
    .getByRole("button", { name: "The ERP renamed quantity", exact: false })
    .click();
  await page.screenshot({
    path: "test-results/rescue-recovered.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("tab", { name: "Test results", exact: true }).click();
  assert.equal(await page.locator("tbody tr").count(), 15);
  await page.getByRole("tab", { name: "Evidence", exact: true }).click();
  await page.locator(".rs-evidence summary").first().click();
  await page.getByRole("tab", { name: "Activity", exact: true }).click();
  await page.getByText("Approved repair replayed").waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export run", exact: true }).click();
  assert.match(
    (await downloadPromise).suggestedFilename(),
    /integration-rescue/,
  );
  await page.getByRole("button", { name: /Run history/ }).click();
  await page.locator(".rs-history-row").first().click();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search signals" })
    .fill("no-such-signal");
  await page.getByText("No matching signals.").waitFor();
  await page.getByRole("textbox", { name: "Search signals" }).fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/rescue-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Mobile should not overflow",
  );
  await page.reload();
  await page.getByText("Integration recovered in the sandbox.").waitFor();
  run = (await (await context.request.get(`${base}/api/lab`)).json()).run;
  assert.equal(run.replay.passed, 15);
  assert.equal(run.replay.unsafeWrites, 0);
  assert.equal(run.replay.duplicateWrites, 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: recovery, approval guard, replay, persistence, evidence, history, export, search, and mobile layout",
  );
} finally {
  await browser.close();
}
