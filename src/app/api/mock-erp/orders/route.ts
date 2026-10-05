import { NextRequest, NextResponse } from "next/server";
import { MockERP, contractFor } from "@/lib/lab/mock-erp";
import { erpSnapshot } from "@/lib/lab/fixtures";
export const runtime = "nodejs";
// Contract probe only. Every HTTP request gets a fresh sandbox ledger.
// Stateful idempotency/reconciliation tests run on isolated MockERP instances in the lab.
export async function GET() {
  return NextResponse.json({
    ...contractFor("schema-v2"),
    execution: "isolated-mock-only",
    state: "ephemeral-per-request",
  });
}
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 10000)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const response = new MockERP("schema-v2", erpSnapshot()).submit(data);
  return NextResponse.json(response.body, { status: response.status });
}
