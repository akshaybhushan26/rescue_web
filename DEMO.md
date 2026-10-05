# FAULTLINE: a 90-second walkthrough

“This is FAULTLINE, a small reliability lab for business-agent integrations. It breaks a mock ERP connection, shows the evidence, and verifies a scoped repair before an engineer approves sandbox replay.”

1. **Run reliability tests.** Fifteen executions produce 13 passing expectations and two schema failures. These are measured fixture results, not production accuracy.
2. **Inspect the failure.** The agent extracted 200 bearings correctly. The v2 contract rejects `quantity` because it requires `order_qty`. Show the exact payload, response, and assertion in Execution trace.
3. **Diagnose.** Three evidence sources support one narrow mapping change. Both fields mean individual units. The repair changes neither business rules nor v1 adapters.
4. **Verify.** Replay the saved corpus. The candidate meets 15/15 expectations. Changed unit semantics still require an operator; a duplicate email still writes once; a timeout is reconciled using the original receipt.
5. **Approve and replay.** Add a note, approve the artifact, and execute again. Show the before/after table, exportable snapshots, digests, and decision history.

“The product today is a developer tool. Autonomous recovery is a future direction. Every write is an isolated mock ledger record.”

## Questions to prepare for

**What is difficult?** The rename is easy. Preserving semantics, reproducing failures, scoping changes, proving them against controls, and handling uncertain outcomes are the engineering work.

**Where is AI?** The order agent has an optional live LLM adapter. This corpus uses deterministic extraction for exact fixture replay, and diagnosis is currently a constrained rule. Fresh model runs would need separate evaluation.

**Is it an animation?** No. The server extracts each request, runs policy, submits accepted drafts to a strict executable mock contract, observes responses/receipts, and checks actual outcomes, quantities, and writes.

**What happens after a timeout?** The mock commits, loses the response, then the runner looks up the same key. It recovers the receipt without a blind second submission.

**Can a repair change quantity semantics?** The rename applies only when both fields mean `each`. A `case-of-12` contract is held. Replay checks quantities, catalog prices, totals, and order versions.

**What is limited?** One mock repair, a 15-case synthetic corpus, one-process file storage, local review, and no real ERP connector. Historical source/runtime binaries are not bundled; code changes require a new baseline.

**What comes next?** Real failure corpora, field-level evaluations, transactional storage, authenticated review, then a narrow real adapter with proven idempotency and reconciliation. Autonomous recovery should be earned through evidence.

Independent project. No claim about Trelium's private systems or missing features. No outreach is sent.
