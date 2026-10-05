import type { Case, ERPContext } from "../types";
export type Fault =
  | "healthy"
  | "schema-v2"
  | "unit-change"
  | "timeout-after-commit"
  | "unauthorized"
  | "outage";
export type Outcome = "committed" | "review" | "manual" | "failed";
export type Fixture = {
  id: string;
  name: string;
  category: string;
  description: string;
  email: Case["email"];
  fault: Fault;
  deliveries: number;
  expected: { outcome: Outcome; writes: number; quantities: number[] };
};
export type Trace = {
  id: string;
  stage: string;
  label: string;
  status: "passed" | "failed" | "held";
  elapsedMs: number;
  evidence: Record<string, unknown>;
};
export type ContractResponse = {
  status: number;
  body: Record<string, unknown>;
  committed: boolean;
};
export type Result = {
  fixtureId: string;
  name: string;
  category: string;
  fault: Fault;
  passed: boolean;
  outcome: Outcome;
  expectation: Fixture["expected"];
  writes: number;
  duplicateWrites: number;
  unsafeWrites: number;
  elapsedMs: number;
  trace: Trace[];
  analysis: Case;
  request: Record<string, unknown> | null;
  response: ContractResponse | null;
  ledger: Record<string, unknown>[];
};
export type Config = {
  version: "legacy-v1" | "verified-v2";
  quantityField: "quantity" | "order_qty";
  scope: "schema-v2-only";
  execution: "isolated-mock-only";
};
export type Report = {
  id: string;
  at: string;
  config: Config;
  results: Result[];
  passed: number;
  failed: number;
  unsafeWrites: number;
  duplicateWrites: number;
  elapsedMs: number;
};
export type Repair = {
  id: string;
  title: string;
  explanation: string;
  scope: string;
  before: string;
  after: string;
  config: Config;
  evidence: { source: string; detail: string }[];
  digest: string;
};
export type LabRun = {
  id: string;
  revision: number;
  stage: "baseline" | "diagnosed" | "verified" | "approved" | "replayed";
  createdAt: string;
  snapshot: {
    fixtures: Fixture[];
    erp: ERPContext;
    provider: "deterministic-mock";
    sourceDigest: string;
    inputDigest: string;
  };
  baseline: Report;
  repair: Repair | null;
  verification: Report | null;
  replay: Report | null;
  approvedDigest: string | null;
  reviewNote: string | null;
  audit: { at: string; event: string; detail: string }[];
};
