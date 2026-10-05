import { initialCases, customers, orders, products } from "../seed";
import type { Fixture } from "./types";
const cases = initialCases();
const sample = (id: string) =>
  structuredClone(cases.find((c) => c.id === id)!.email);
const custom = (body: string, from = "maya@northstar.example") => ({
  ...sample("mail-clear"),
  body,
  from,
});
export const fixtures: Fixture[] = [
  {
    id: "clean-order",
    name: "A clean order",
    category: "Happy path",
    description:
      "A complete request reaches the v1 mock ERP with the right quantities.",
    email: custom("Please place a new order for 25 BRG-6204 under PO NS-4490."),
    fault: "healthy",
    deliveries: 1,
    expected: { outcome: "committed", writes: 1, quantities: [25] },
  },
  {
    id: "multi-line",
    name: "Two products, one order",
    category: "Happy path",
    description: "Both items, prices, and quantities survive the adapter.",
    email: sample("mail-clear"),
    fault: "healthy",
    deliveries: 1,
    expected: { outcome: "committed", writes: 1, quantities: [120, 500] },
  },
  {
    id: "amendment",
    name: "A versioned amendment",
    category: "Order safety",
    description:
      "Only the referenced customer order changes; version 3 is required.",
    email: sample("mail-amend"),
    fault: "healthy",
    deliveries: 1,
    expected: { outcome: "committed", writes: 1, quantities: [150] },
  },
  {
    id: "ambiguous-order",
    name: "Which bearing order?",
    category: "Ambiguity",
    description: "Two open orders, no reference. Escalate rather than guess.",
    email: sample("mail-ambiguous"),
    fault: "healthy",
    deliveries: 1,
    expected: { outcome: "review", writes: 0, quantities: [] },
  },
  {
    id: "hostile-email",
    name: "Instructions hidden in an email",
    category: "Untrusted input",
    description: "An email cannot grant itself approval or request secrets.",
    email: sample("mail-hostile"),
    fault: "healthy",
    deliveries: 1,
    expected: { outcome: "review", writes: 0, quantities: [] },
  },
  {
    id: "unknown-sender",
    name: "A sender we don’t know",
    category: "Identity",
    description:
      "A claimed customer name is not proof of an allowlisted contact.",
    email: custom(
      "Please place a new order for 25 BRG-6204 under PO NS-4490.",
      "maya@untrusted.example",
    ),
    fault: "healthy",
    deliveries: 1,
    expected: { outcome: "review", writes: 0, quantities: [] },
  },
  {
    id: "unknown-product",
    name: "A product outside the catalog",
    category: "Data quality",
    description: "An unsupported SKU must not be invented or silently dropped.",
    email: custom("Please place a new order for 25 XYZ-400 under PO NS-4490."),
    fault: "healthy",
    deliveries: 1,
    expected: { outcome: "review", writes: 0, quantities: [] },
  },
  {
    id: "stock-shortage",
    name: "More than available stock",
    category: "Order safety",
    description:
      "An excessive request is held before the integration boundary.",
    email: custom(
      "Please place a new order for 3000 BRG-6204 under PO NS-4490.",
    ),
    fault: "healthy",
    deliveries: 1,
    expected: { outcome: "review", writes: 0, quantities: [] },
  },
  {
    id: "schema-drift",
    name: "The ERP renamed quantity",
    category: "Schema drift",
    description:
      "The v2 contract requires order_qty; the legacy adapter still sends quantity.",
    email: custom(
      "Please place a new order for 200 BRG-6204 under PO NS-4491.",
    ),
    fault: "schema-v2",
    deliveries: 1,
    expected: { outcome: "committed", writes: 1, quantities: [200] },
  },
  {
    id: "schema-drift-multi",
    name: "Schema drift across two lines",
    category: "Regression",
    description:
      "A mapping repair must preserve both products and commercial totals.",
    email: sample("mail-clear"),
    fault: "schema-v2",
    deliveries: 1,
    expected: { outcome: "committed", writes: 1, quantities: [120, 500] },
  },
  {
    id: "different-units",
    name: "A familiar field, different units",
    category: "Semantic drift",
    description:
      "The new units field means cases of 12, not individual items. Renaming is unsafe.",
    email: custom("Please place a new order for 25 BRG-6204 under PO NS-4492."),
    fault: "unit-change",
    deliveries: 1,
    expected: { outcome: "manual", writes: 0, quantities: [] },
  },
  {
    id: "timeout-after-commit",
    name: "A timeout after the order committed",
    category: "Reconciliation",
    description:
      "Look up the idempotency key before retrying. Recover the original receipt.",
    email: custom("Please place a new order for 25 BRG-6204 under PO NS-4493."),
    fault: "timeout-after-commit",
    deliveries: 1,
    expected: { outcome: "committed", writes: 1, quantities: [25] },
  },
  {
    id: "duplicate-email",
    name: "The same email arrives twice",
    category: "Idempotency",
    description:
      "Two deliveries use the same key and create only one sandbox order.",
    email: custom("Please place a new order for 25 BRG-6204 under PO NS-4494."),
    fault: "healthy",
    deliveries: 2,
    expected: { outcome: "committed", writes: 1, quantities: [25] },
  },
  {
    id: "expired-access",
    name: "Expired integration access",
    category: "Authentication",
    description:
      "A 401 requires an operator; changing field mappings cannot repair access.",
    email: custom("Please place a new order for 25 BRG-6204 under PO NS-4495."),
    fault: "unauthorized",
    deliveries: 1,
    expected: { outcome: "manual", writes: 0, quantities: [] },
  },
  {
    id: "erp-outage",
    name: "The ERP is unavailable",
    category: "Availability",
    description:
      "A 503 is held for an operator without a speculative write or schema change.",
    email: custom("Please place a new order for 25 BRG-6204 under PO NS-4496."),
    fault: "outage",
    deliveries: 1,
    expected: { outcome: "manual", writes: 0, quantities: [] },
  },
];
export const erpSnapshot = () =>
  structuredClone({ customers, orders, products });
