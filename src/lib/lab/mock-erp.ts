import { z } from "zod";
import { createHash } from "node:crypto";
import type { ERPContext, Proposal } from "../types";
import type { ContractResponse, Fault } from "./types";
export const contractFor = (fault: Fault) => ({
  version: fault === "schema-v2" ? "v2" : fault === "unit-change" ? "v3" : "v1",
  quantityField:
    fault === "schema-v2"
      ? "order_qty"
      : fault === "unit-change"
        ? "units"
        : "quantity",
  unit: fault === "unit-change" ? "case-of-12" : "each",
  required: ["customerId", "purchaseOrder", "lines", "idempotencyKey"],
});
export function adapt(
  proposal: Proposal,
  field: string,
  key: string,
): Record<string, unknown> {
  return {
    operation: proposal.operation,
    customerId: proposal.customerId,
    purchaseOrder: proposal.purchaseOrder,
    orderId: proposal.orderId,
    expectedVersion: proposal.expectedVersion,
    shipTo: proposal.shipTo,
    terms: proposal.terms,
    currency: proposal.currency,
    total: proposal.total,
    idempotencyKey: key,
    lines: proposal.lines.map((l) => ({
      sku: String(l.sku),
      [field]: l.quantity,
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
    })),
  };
}
export class MockERP {
  readonly ledger: Record<string, unknown>[] = [];
  private receipts = new Map<
    string,
    { hash: string; response: ContractResponse }
  >();
  constructor(
    readonly fault: Fault,
    private snapshot: ERPContext,
  ) {}
  lookup(key: string) {
    return this.receipts.get(key)?.response ?? null;
  }
  submit(payload: Record<string, unknown>): ContractResponse {
    const error = (
      status: number,
      body: Record<string, unknown>,
    ): ContractResponse => ({ status, body, committed: false });
    if (this.fault === "unauthorized")
      return error(401, {
        code: "ACCESS_EXPIRED",
        message:
          "Integration credential expired. Operator intervention required.",
      });
    if (this.fault === "outage")
      return error(503, {
        code: "UNAVAILABLE",
        message: "Mock ERP service unavailable. No order committed.",
      });
    const contract = contractFor(this.fault);
    const line = z
      .object({
        sku: z.string(),
        [contract.quantityField]: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
        lineTotal: z.number().nonnegative(),
      })
      .strict();
    const schema = z
      .object({
        operation: z.enum(["CREATE_DRAFT_ORDER", "AMEND_DRAFT_ORDER"]),
        customerId: z.string(),
        purchaseOrder: z.string(),
        orderId: z.string().nullable(),
        expectedVersion: z.number().int().nullable(),
        shipTo: z.string(),
        terms: z.string(),
        currency: z.literal("USD"),
        total: z.number().positive(),
        idempotencyKey: z.string().min(10),
        lines: z.array(line).min(1),
      })
      .strict();
    const parsed = schema.safeParse(payload);
    if (!parsed.success)
      return error(400, {
        code: "SCHEMA_MISMATCH",
        message: `Contract ${contract.version} requires lines[].${contract.quantityField}; unexpected fields are rejected.`,
        contract,
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    const data = parsed.data;
    const key = data.idempotencyKey;
    const hash = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
    const previous = this.receipts.get(key);
    if (previous)
      return previous.hash === hash
        ? {
            ...previous.response,
            status: 200,
            body: { ...previous.response.body, deduplicated: true },
          }
        : error(409, {
            code: "IDEMPOTENCY_CONFLICT",
            message: "Same key, different payload. No additional write.",
          });
    const customer = this.snapshot.customers.find(
      (c) => c.id === data.customerId,
    );
    if (
      !customer ||
      customer.shipTo !== data.shipTo ||
      customer.terms !== data.terms
    )
      return error(422, {
        code: "CUSTOMER_CONTEXT",
        message: "Customer context mismatch.",
      });
    if (data.operation === "AMEND_DRAFT_ORDER") {
      const order = this.snapshot.orders.find(
        (o) => o.id === data.orderId && o.customerId === data.customerId,
      );
      if (
        !order ||
        order.status !== "open" ||
        order.version !== data.expectedVersion
      )
        return error(409, {
          code: "ORDER_VERSION",
          message: "Order owner, state, or version changed.",
        });
    }
    const normalized = data.lines.map((l) => ({
      sku: String(l.sku),
      quantity: l[contract.quantityField] as number,
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
    }));
    if (
      normalized.some((l) => {
        const p = this.snapshot.products.find((p) => p.sku === l.sku);
        return (
          !p ||
          p.price !== l.unitPrice ||
          l.quantity > p.available ||
          Math.round(l.quantity * p.price * 100) / 100 !== l.lineTotal
        );
      }) ||
      Math.round(normalized.reduce((s, l) => s + l.lineTotal, 0) * 100) /
        100 !==
        data.total ||
      data.total > customer.creditAvailable
    )
      return error(422, {
        code: "COMMERCIAL_VALIDATION",
        message: "SKU, quantity, price, total, or credit mismatch.",
      });
    const record = {
      id: `MOCK-${hash.slice(0, 8)}`,
      customerId: data.customerId,
      purchaseOrder: data.purchaseOrder,
      operation: data.operation,
      orderId: data.orderId,
      expectedVersion: data.expectedVersion,
      lines: normalized,
      total: data.total,
      execution: "isolated-mock-only",
    };
    this.ledger.push(record);
    const response: ContractResponse = {
      status: 201,
      committed: true,
      body: { receipt: record, deduplicated: false },
    };
    this.receipts.set(key, { hash, response });
    if (this.fault === "timeout-after-commit")
      return {
        status: 504,
        body: {
          code: "RESPONSE_LOST",
          message:
            "Timeout after mock commit. Outcome unknown to caller; reconcile before retrying.",
        },
        committed: true,
      };
    return response;
  }
}
