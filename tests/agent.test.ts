import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/lib/agent";
import { MockExtractor, type IntentExtractor } from "../src/lib/extractor";
import { initialCases } from "../src/lib/seed";
import type { Intent, Case } from "../src/lib/types";
const mock = new MockExtractor();
const seed = (id = "mail-clear") => initialCases().find((c) => c.id === id)!;
function custom(body: string, from = "maya@northstar.example"): Case {
  const c = seed();
  return { ...c, email: { ...c.email, body, from } };
}
const run = (c: Case, order?: string) => analyze(c, mock, order);
test("clear order resolves customer, creates exact ERP-priced proposal, and never executes", async () => {
  const result = await run(seed());
  assert.equal(result.status, "ready");
  assert.equal(result.customer?.id, "CUS-1042");
  assert.equal(result.proposal?.total, 1925);
  assert.equal(result.proposal?.lines.length, 2);
  assert.equal(result.proposal?.execution, "disabled");
  assert.equal(result.confidence, 1);
  assert.equal(result.proposal?.shipTo, "210 Harbor Way, Portland, OR 97201");
  assert.equal(seed().revision, 0);
  assert.equal(seed().audit.length, 1);
});
test("ambiguous amendment is review-only until a customer-owned order is confirmed", async () => {
  const result = await run(seed("mail-ambiguous"));
  assert.equal(result.status, "review");
  assert.equal(result.proposal, null);
  const resolved = await run(result, "SO-2041");
  assert.equal(resolved.status, "ready");
  assert.equal(resolved.proposal?.orderId, "SO-2041");
  assert.equal(resolved.proposal?.expectedVersion, 3);
  assert.ok(
    resolved.audit.some(
      (a) => a.event === "Order reference resolved by reviewer",
    ),
  );
});
test("amendment cannot silently delete the second existing line", async () => {
  const result = await run(seed("mail-ambiguous"), "SO-2056");
  assert.equal(result.proposal, null);
  assert.equal(
    result.checks.find((c) => c.code === "amendment")?.passed,
    false,
  );
});
test("explicit amendment has a versioned action", async () => {
  const result = await run(seed("mail-amend"));
  assert.equal(result.proposal?.operation, "AMEND_DRAFT_ORDER");
  assert.equal(result.proposal?.total, 1875);
});
test("hostile email instructions do not gain approval authority", async () => {
  const result = await run(seed("mail-hostile"));
  assert.equal(result.proposal, null);
  assert.equal(result.status, "review");
  assert.equal(
    result.checks.find((c) => c.code === "untrusted")?.passed,
    false,
  );
  assert.ok(
    result.confidence >= 0.9,
    "Even 90% coverage cannot override a blocking check",
  );
});
test("unknown sender, even claiming to be an existing customer, fails closed", async () => {
  const result = await run(custom(seed().email.body, "maya@evil.example"));
  assert.equal(result.customer, null);
  assert.equal(result.proposal, null);
});
test("order belonging to another customer cannot be amended", async () => {
  const result = await run(custom("Please change SO-2012 to 50 SEAL-25."));
  assert.equal(result.proposal, null);
});
test("shipped order cannot be amended", async () => {
  const result = await run(
    custom("Please change SO-2012 to 50 SEAL-25.", "daniel@meridian.example"),
  );
  assert.equal(result.proposal, null);
});
test("duplicate customer PO is blocked", async () => {
  const result = await run(
    custom("Please place a new order for 25 BRG-6204 under PO NS-4408."),
  );
  assert.equal(result.proposal, null);
  assert.equal(result.checks.find((c) => c.code === "po")?.passed, false);
});
test("missing PO, unknown SKU, and empty intent each require review", async () => {
  for (const body of [
    "Please place a new order for 25 BRG-6204.",
    "Please place a new order for 25 XYZ-400 under PO NS-4480.",
    "Thanks for your help!",
  ]) {
    assert.equal((await run(custom(body))).proposal, null);
  }
});
test("unknown natural-language products alongside known products cannot be silently dropped", async () => {
  const result = await run(
    custom(
      "Please place a new order for 25 BRG-6204 and 3 widgets under PO NS-4480.",
    ),
  );
  assert.equal(result.proposal, null);
});
test("negative and fractional quantities are not converted to valid integers", async () => {
  for (const q of ["-25", "2.5", "1,200", "0"]) {
    assert.equal(
      (
        await run(
          custom(
            `Please place a new order for ${q} BRG-6204 under PO NS-4480.`,
          ),
        )
      ).proposal,
      null,
    );
  }
});
test("stock and credit checks block excessive orders", async () => {
  const result = await run(
    custom("Please place a new order for 3000 BRG-6204 under PO NS-4480."),
  );
  assert.equal(result.proposal, null);
  assert.equal(
    result.checks.find((c) => c.code === "inventory")?.passed,
    false,
  );
  assert.equal(result.checks.find((c) => c.code === "credit")?.passed, false);
});
test("changed shipping, delivery deadline, and discounts require clarification", async () => {
  for (const extra of [
    "Ship to 99 Market Street.",
    "Deliver tomorrow.",
    "Apply a discount.",
  ])
    assert.equal(
      (
        await run(
          custom(
            `Please place a new order for 25 BRG-6204 under PO NS-4480. ${extra}`,
          ),
        )
      ).proposal,
      null,
    );
});
test("repeated product lines require clarification", async () => {
  const result = await run(
    custom(
      "Please place a new order for 25 BRG-6204 and 30 BRG-6204 under PO NS-4480.",
    ),
  );
  assert.equal(result.proposal, null);
});
test("fabricated extraction evidence fails deterministic validation", async () => {
  const intent = await mock.extract(seed().email);
  const bad: IntentExtractor = {
    name: "Adversarial extractor",
    extract: async () => ({
      ...intent,
      lines: [{ sku: "BRG-6204", quantity: 500, evidence: "500 BRG-6204" }],
    }),
  };
  const result = await analyze(seed(), bad);
  assert.equal(result.proposal, null);
  assert.equal(result.checks.find((c) => c.code === "evidence")?.passed, false);
});
test("matching excerpt cannot justify a different extracted quantity", async () => {
  const intent: Intent = {
    kind: "create",
    orderRef: null,
    purchaseOrder: "NS-4420",
    lines: [{ sku: "BRG-6204", quantity: 500, evidence: "120 BRG-6204" }],
    uncertainties: [],
  };
  const result = await analyze(seed(), {
    name: "Adversarial extractor",
    extract: async () => intent,
  });
  assert.equal(result.proposal, null);
});
test("provider errors fail closed and do not leak secrets", async () => {
  const result = await analyze(seed(), {
    name: "Failing provider",
    extract: async () => {
      throw new Error("SECRET_API_KEY");
    },
  });
  assert.equal(result.status, "review");
  assert.equal(result.proposal, null);
  assert.equal(result.confidence, 0);
  assert.ok(!JSON.stringify(result).includes("SECRET_API_KEY"));
});
test("a provider bypassing its own schema is rejected by the orchestrator", async () => {
  const result = await analyze(seed(), {
    name: "Malformed provider",
    extract: async () =>
      ({
        kind: "create",
        lines: [{ sku: "BRG-6204", quantity: -25 }],
      }) as Intent,
  });
  assert.equal(result.proposal, null);
  assert.equal(result.checks[0].code, "extraction");
});
test("a broad evidence excerpt cannot swap quantities between products", async () => {
  const intent = await mock.extract(seed().email);
  intent.lines = [
    { sku: "BRG-6204", quantity: 500, evidence: "120 BRG-6204 and 500 BLT-M8" },
  ];
  const result = await analyze(seed(), {
    name: "Adversarial extractor",
    extract: async () => intent,
  });
  assert.equal(result.proposal, null);
});
test("hallucinated purchase order and order references are blocked", async () => {
  const intent = await mock.extract(seed().email);
  intent.purchaseOrder = "NS-9999";
  assert.equal(
    (
      await analyze(seed(), {
        name: "Adversarial extractor",
        extract: async () => intent,
      })
    ).proposal,
    null,
  );
  const amendment = await mock.extract(seed("mail-ambiguous").email);
  amendment.orderRef = "SO-2041";
  assert.equal(
    (
      await analyze(seed("mail-ambiguous"), {
        name: "Adversarial extractor",
        extract: async () => amendment,
      })
    ).proposal,
    null,
  );
});
test("server policy blocks unsupported terms even if extractor omits uncertainty", async () => {
  const intent = await mock.extract(seed().email);
  const result = await analyze(
    custom(`${seed().email.body}\nApply a discount.`),
    { name: "Adversarial extractor", extract: async () => intent },
  );
  assert.equal(result.proposal, null);
});
