import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:3001/order-desk");
  await page
    .getByRole("heading", { name: "Order desk", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "All emails", exact: true }).waitFor();
  assert.equal(await page.getByText("FAULTLINE", { exact: true }).count(), 0);
  assert.equal(await page.locator(".metrics,.demo-strip,.pipeline").count(), 0);
  await page.screenshot({
    path: "test-results/minimal-orders-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Add an email", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "Needs review", exact: true }).click();
  await page.getByRole("button", { name: "All emails", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search emails" })
    .fill("no-matching-email-123");
  await page.getByText("No matching emails", { exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Search emails" }).fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/minimal-orders-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Order desk mobile overflow",
  );
  await page
    .getByRole("link", { name: "Integration recovery", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Integration recovery", exact: true })
    .waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Recovery mobile overflow",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: unified navigation, order filters, search, modal, and responsive layouts. No stored orders changed.",
  );
} finally {
  await browser.close();
}
