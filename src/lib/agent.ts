import { randomUUID } from "node:crypto";
import {
  customers as seedCustomers,
  orders as seedOrders,
  products as seedProducts,
} from "./seed";
import {
  intentSchema,
  unsupportedTerms,
  invalidQuantitySyntax,
  type IntentExtractor,
} from "./extractor";
import type { Case, Check, Intent, Audit, ERPContext } from "./types";
export function audit(event: string, detail: string): Audit {
  return { id: randomUUID(), at: new Date().toISOString(), event, detail };
}
export const REVIEW_THRESHOLD = 0.9;
export const suspicious = (body: string) =>
  /ignore.{0,40}instructions|bypass.{0,40}(validation|checks)|reveal.{0,40}(key|secret)|system\s*(prompt|message)|approve.{0,30}automatically/i.test(
    body,
  );
export async function analyze(
  current: Case,
  extractor: IntentExtractor,
  resolvedOrderId?: string,
  context: ERPContext = {
    customers: seedCustomers,
    orders: seedOrders,
    products: seedProducts,
  },
): Promise<Case> {
  const { customers, orders, products } = context;
  const customer =
    customers.find((c) =>
      c.contacts.includes(current.email.from.toLowerCase()),
    ) ?? null;
  const customerOrders = orders.filter((o) => o.customerId === customer?.id);
  let intent: Intent;
  try {
    intent = intentSchema.parse(await extractor.extract(current.email));
  } catch {
    return {
      ...current,
      revision: current.revision + 1,
      status: "review",
      customer,
      orders: customerOrders,
      provider: extractor.name,
      intent: null,
      confidence: 0,
      proposal: null,
      checks: [
        {
          code: "extraction",
          label: "Structured extraction",
          passed: false,
          detail:
            "Extraction failed or returned an invalid schema. No proposal created; check provider configuration and retry.",
        },
      ],
      audit: [
        ...current.audit,
        audit(
          "Extraction failed",
          "Failed closed. No proposal created. Provider response and secrets are not logged.",
        ),
      ],
    };
  }
  const selectedOrder = customerOrders.find(
    (o) => o.id === (resolvedOrderId ?? intent.orderRef),
  );
  const checks: Check[] = [];
  const add = (code: string, label: string, passed: boolean, detail: string) =>
    checks.push({ code, label, passed, detail });
  add(
    "identity",
    "Customer identity",
    !!customer,
    customer
      ? `Exact contact match → ${customer.name} (${customer.id}). Demo email metadata is not authenticated.`
      : "Sender is not in the customer contact allowlist.",
  );
  add(
    "untrusted",
    "Untrusted-content guard",
    !suspicious(current.email.body),
    suspicious(current.email.body)
      ? "Instruction-like content detected. Human review required; cannot override this guard."
      : "No known instruction pattern detected. Content still treated as untrusted.",
  );
  add(
    "intent",
    "Request completeness",
    intent.kind !== "unknown" &&
      intent.uncertainties.length === 0 &&
      !unsupportedTerms(current.email.body) &&
      !invalidQuantitySyntax(current.email.body),
    intent.uncertainties.join(" ") ||
      (invalidQuantitySyntax(current.email.body)
        ? "Negative, fractional, or formatted quantity requires review."
        : unsupportedTerms(current.email.body)
          ? "Unsupported commercial or delivery instruction requires review."
          : `Structured ${intent.kind} request extracted.`),
  );
  const orderGrounded =
    resolvedOrderId !== undefined ||
    !intent.orderRef ||
    new RegExp(`\\b${intent.orderRef}\\b`, "i").test(current.email.body);
  add(
    "order",
    "Order context",
    intent.kind === "create"
      ? !intent.orderRef
      : intent.kind === "amend" &&
          !!selectedOrder &&
          selectedOrder.status === "open" &&
          orderGrounded,
    !orderGrounded
      ? "Extracted order reference is absent from the email."
      : intent.kind === "create"
        ? intent.orderRef
          ? "New order also names an existing order; clarify intent."
          : "New order; no existing order will be changed."
        : selectedOrder
          ? `${selectedOrder.id} · ${selectedOrder.status} · version ${selectedOrder.version}.`
          : `${customerOrders.filter((o) => o.status === "open").length} open orders found. Select the intended order after confirming with the customer.`,
  );
  const poGrounded =
    !!intent.purchaseOrder &&
    new RegExp(`\\b${intent.purchaseOrder}\\b`, "i").test(current.email.body);
  add(
    "po",
    "Purchase order / duplicate check",
    intent.kind !== "create" ||
      (poGrounded &&
        !orders.some(
          (o) => o.customerId === customer?.id && o.po === intent.purchaseOrder,
        )),
    intent.kind !== "create"
      ? "Existing order reference used."
      : !poGrounded
        ? "New orders require a purchase order reference grounded in the email."
        : orders.some(
              (o) =>
                o.customerId === customer?.id && o.po === intent.purchaseOrder,
            )
          ? "This customer purchase order already exists; possible duplicate."
          : `${intent.purchaseOrder} has no match in the mock ERP.`,
  );
  const validLines =
    intent.lines.length > 0 &&
    intent.lines.every((line) => products.some((p) => p.sku === line.sku)) &&
    new Set(intent.lines.map((l) => l.sku)).size === intent.lines.length;
  add(
    "products",
    "Catalog resolution",
    validLines,
    validLines
      ? `${intent.lines.length} unique line item(s) mapped to catalog SKUs.`
      : "Missing, unknown, or repeated product; clarification required.",
  );
  const evidenceValid =
    intent.lines.length > 0 &&
    intent.lines.every((line) => {
      const product = products.find((p) => p.sku === line.sku);
      return (
        current.email.body.includes(line.evidence) &&
        !!product &&
        [product.sku, ...product.aliases].some((term) => {
          const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(
            `(?<![\\d.,-])\\b${line.quantity}\\s+${escaped}\\b`,
            "i",
          ).test(line.evidence);
        })
      );
    });
  add(
    "evidence",
    "Source evidence",
    evidenceValid,
    evidenceValid
      ? "Every quantity and product has a matching excerpt in the email body."
      : "Extracted fields are not grounded in exact email excerpts.",
  );
  // This MVP supports full-line replacement amendments only. Do not drop untouched lines.
  const amendmentSafe =
    intent.kind !== "amend" ||
    (!!selectedOrder &&
      selectedOrder.lines.length === intent.lines.length &&
      selectedOrder.lines.every((l) =>
        intent.lines.some((i) => i.sku === l.sku),
      ) &&
      /\b(change|update|amend)\b/i.test(current.email.body));
  add(
    "amendment",
    "Amendment semantics",
    amendmentSafe,
    amendmentSafe
      ? "No existing line would be silently removed."
      : "Partial changes require clarification; the MVP only supports replacing quantities for all existing lines.",
  );
  const lines = intent.lines.map((l) => {
    const p = products.find((p) => p.sku === l.sku);
    return {
      sku: l.sku,
      name: p?.name ?? "Unknown product",
      quantity: l.quantity,
      unitPrice: p?.price ?? 0,
      lineTotal: Math.round(l.quantity * (p?.price ?? 0) * 100) / 100,
    };
  });
  const total =
    Math.round(lines.reduce((sum, l) => sum + l.lineTotal, 0) * 100) / 100;
  add(
    "inventory",
    "Availability",
    validLines &&
      intent.lines.every(
        (l) =>
          l.quantity <= (products.find((p) => p.sku === l.sku)?.available ?? 0),
      ),
    "Requested quantities checked against the mock available-to-promise snapshot; stock is not reserved.",
  );
  add(
    "credit",
    "Commercial terms",
    !!customer && total > 0 && total <= customer.creditAvailable,
    customer
      ? `$${total.toFixed(2)} against $${customer.creditAvailable.toLocaleString()} available credit. ERP prices and ${customer.terms} used.`
      : "Customer terms unavailable.",
  );
  const passed = checks.every((c) => c.passed);
  // Coverage score, not a calibrated probability or a model's self-reported confidence.
  const confidence =
    Math.round((checks.filter((c) => c.passed).length / checks.length) * 100) /
    100;
  const proposal =
    passed && confidence >= REVIEW_THRESHOLD && customer
      ? {
          operation:
            intent.kind === "create"
              ? ("CREATE_DRAFT_ORDER" as const)
              : ("AMEND_DRAFT_ORDER" as const),
          customerId: customer.id,
          orderId: selectedOrder?.id ?? null,
          expectedVersion: selectedOrder?.version ?? null,
          purchaseOrder: intent.purchaseOrder ?? selectedOrder?.po ?? null,
          shipTo: customer.shipTo,
          terms: customer.terms,
          lines,
          total,
          currency: "USD" as const,
          execution: "disabled" as const,
        }
      : null;
  return {
    ...current,
    revision: current.revision + 1,
    customer,
    orders: customerOrders,
    intent,
    checks,
    confidence,
    proposal,
    provider: extractor.name,
    status: proposal ? "ready" : "review",
    reviewNote: null,
    audit: [
      ...current.audit,
      audit(
        "Context resolved",
        customer
          ? `${customer.id}; ${customerOrders.length} related order(s). Exact contact lookup.`
          : "No customer match.",
      ),
      audit(
        "Intent extracted",
        `${extractor.name}; ${intent.kind}; ${intent.lines.length} line(s). Schema validated.`,
      ),
      ...(resolvedOrderId
        ? [
            audit(
              "Order reference resolved by reviewer",
              `Reviewer confirmed ${resolvedOrderId}; all validation repeated.`,
            ),
          ]
        : []),
      audit(
        "Policy evaluated",
        `${checks.filter((c) => c.passed).length}/${checks.length} checks passed; coverage ${Math.round(confidence * 100)}%.`,
      ),
      audit(
        proposal ? "Proposal prepared" : "Routed to human review",
        proposal
          ? "Inspectable payload prepared. Execution disabled; no ERP write."
          : checks
              .filter((c) => !c.passed)
              .map((c) => c.detail)
              .join(" "),
      ),
    ],
  };
}
