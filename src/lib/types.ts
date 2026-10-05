export type Customer = {
  id: string;
  name: string;
  contacts: string[];
  terms: string;
  shipTo: string;
  creditAvailable: number;
};
export type Product = {
  sku: string;
  name: string;
  aliases: string[];
  price: number;
  available: number;
  unit: string;
};
export type Order = {
  id: string;
  customerId: string;
  po: string;
  status: "open" | "shipped";
  version: number;
  lines: { sku: string; quantity: number }[];
};
export type Email = {
  id: string;
  from: string;
  sender: string;
  subject: string;
  body: string;
  receivedAt: string;
  sample: string;
};
export type Intent = {
  kind: "create" | "amend" | "unknown";
  orderRef: string | null;
  purchaseOrder: string | null;
  lines: { sku: string; quantity: number; evidence: string }[];
  uncertainties: string[];
};
export type Check = {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
};
export type Proposal = {
  operation: "CREATE_DRAFT_ORDER" | "AMEND_DRAFT_ORDER";
  customerId: string;
  orderId: string | null;
  expectedVersion: number | null;
  purchaseOrder: string | null;
  shipTo: string;
  terms: string;
  lines: {
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  total: number;
  currency: "USD";
  execution: "disabled";
};
export type Audit = { id: string; at: string; event: string; detail: string };
export type Case = {
  id: string;
  email: Email;
  revision: number;
  status: "received" | "ready" | "review" | "approved" | "rejected";
  provider: string | null;
  intent: Intent | null;
  customer: Customer | null;
  orders: Order[];
  checks: Check[];
  confidence: number;
  proposal: Proposal | null;
  audit: Audit[];
  reviewNote: string | null;
};
export type Workspace = { cases: Case[]; products: Product[]; mode: string };
export type ERPContext = {
  customers: Customer[];
  orders: Order[];
  products: Product[];
};
