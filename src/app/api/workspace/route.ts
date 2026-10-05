import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { transaction } from "@/lib/store";
import { products, orders, initialCases } from "@/lib/seed";
import { analyze, audit } from "@/lib/agent";
import { getExtractor } from "@/lib/extractor";
import type { Case } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const command = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("analyze"),
      id: z.string(),
      revision: z.number().int(),
    })
    .strict(),
  z
    .object({
      action: z.literal("resolve"),
      id: z.string(),
      revision: z.number().int(),
      orderId: z.string(),
    })
    .strict(),
  z
    .object({
      action: z.enum(["approve", "reject"]),
      id: z.string(),
      revision: z.number().int(),
      note: z.string().trim().min(8).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("ingest"),
      from: z.email(),
      subject: z.string().trim().min(1).max(200),
      body: z.string().trim().min(10).max(8000),
    })
    .strict(),
  z.object({ action: z.literal("reset") }).strict(),
]);
function workspace(cases: Case[]) {
  return { cases, products, mode: process.env.AGENT_PROVIDER || "mock" };
}
export async function GET() {
  return NextResponse.json(await transaction((cases) => workspace(cases)), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function POST(request: NextRequest) {
  // Local sandbox only. Reject cross-origin mutations; all access still requires production authentication before deployment.
  const origin = request.headers.get("origin");
  // Next normalizes loopback URLs internally. Compare the browser's origin with
  // the actual Host header, rather than the normalized framework URL.
  if (origin) {
    let sameOrigin = false;
    try {
      const url = new URL(origin);
      sameOrigin =
        ["http:", "https:"].includes(url.protocol) &&
        url.host === request.headers.get("host");
    } catch {
      /* invalid origin fails closed */
    }
    if (!sameOrigin)
      return NextResponse.json(
        { error: "Cross-origin mutation rejected." },
        { status: 403 },
      );
  }
  if (!request.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json({ error: "JSON required." }, { status: 415 });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 20000)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let input: z.infer<typeof command>;
  try {
    input = command.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid request. Check fields and include a review note of at least 8 characters.",
      },
      { status: 400 },
    );
  }
  try {
    const result = await transaction(async (cases) => {
      if (input.action === "reset") {
        cases.splice(0, cases.length, ...initialCases());
        return workspace(cases);
      }
      if (input.action === "ingest") {
        if (cases.length >= 50)
          throw new Error(
            "Demo capacity reached. Reset the sandbox to continue.",
          );
        const id = `mail-${crypto.randomUUID()}`;
        cases.push({
          ...initialCases()[0],
          id,
          email: {
            id,
            from: input.from.toLowerCase(),
            sender: input.from.split("@")[0],
            subject: input.subject,
            body: input.body,
            receivedAt: new Date().toISOString(),
            sample: "Custom email",
          },
          audit: [
            audit(
              "Email received",
              "Custom email saved as untrusted text. Sender metadata supplied by demo operator.",
            ),
          ],
        });
        return workspace(cases);
      }
      const index = cases.findIndex((c) => c.id === input.id);
      if (index < 0) throw new Error("Case not found.");
      const current = cases[index];
      if (current.revision !== input.revision)
        throw new Error("This case changed. Refresh before continuing.");
      if (input.action === "analyze") {
        if (current.status !== "received" && current.status !== "review")
          throw new Error("This case has already been analyzed.");
        cases[index] = await analyze(current, getExtractor());
      } else if (input.action === "resolve") {
        if (
          current.status !== "review" ||
          current.intent?.kind !== "amend" ||
          current.intent.orderRef ||
          current.checks
            .filter((c) => !c.passed)
            .some((c) => !["order", "amendment"].includes(c.code))
        )
          throw new Error(
            "Only a missing order reference can be resolved here. Other failures require a corrected email.",
          );
        const order = orders.find(
          (o) =>
            o.id === input.orderId &&
            o.customerId === current.customer?.id &&
            o.status === "open",
        );
        if (!order)
          throw new Error("Select an open order belonging to this customer.");
        cases[index] = await analyze(current, getExtractor(), order.id);
      } else {
        if (!["ready", "review"].includes(current.status))
          throw new Error("Case is already closed or has not been analyzed.");
        if (input.action === "approve") {
          if (!current.proposal || !current.checks.every((c) => c.passed))
            throw new Error("Approval blocked: unresolved validation checks.");
          if (
            current.proposal.orderId &&
            orders.find((o) => o.id === current.proposal!.orderId)?.version !==
              current.proposal.expectedVersion
          )
            throw new Error(
              "Order version changed. Analyze again before approval.",
            );
          if (
            current.proposal.operation === "CREATE_DRAFT_ORDER" &&
            cases.some(
              (c) =>
                c.id !== current.id &&
                c.status === "approved" &&
                c.proposal?.customerId === current.proposal!.customerId &&
                c.proposal?.purchaseOrder === current.proposal!.purchaseOrder,
            )
          )
            throw new Error(
              "A proposal for this customer and purchase order is already approved.",
            );
        }
        cases[index] = {
          ...current,
          revision: current.revision + 1,
          status: input.action === "approve" ? "approved" : "rejected",
          reviewNote: input.note,
          audit: [
            ...current.audit,
            audit(
              input.action === "approve"
                ? "Proposal approved in sandbox"
                : "Case rejected",
              `${input.note} No ERP write performed.`,
            ),
          ],
        };
      }
      return workspace(cases);
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update workspace.",
      },
      { status: 409 },
    );
  }
}
