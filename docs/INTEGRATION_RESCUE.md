# Integration Rescue

A local developer workbench for diagnosing and recovering mock ERP integrations. The home page is the new minimal interface; the existing order-entry demo remains at `/order-desk`.

## Run

Install dependencies with `pnpm install`, then run `pnpm dev`. Open the address printed by Next.js. Node 20.9+ is required.

1. Select **New demo run** to execute 15 isolated scenarios.
2. Select a schema mismatch and **Diagnose failure** to collect the supported repair and evidence.
3. **Test proposed repair** replays the saved inputs against fresh mock ledgers.
4. Inspect **Test results** and enter a review note, then **Approve repair**.
5. **Replay approved repair** validates the approved artifact and executes the suite again.

Baseline: 13/15 expectations met. Candidate and approved replay: 15/15. These are actual executions, including correct refusal cases, rather than illustrative success counters.

## Capabilities and boundaries

- Saved request/response traces, versioned contract evidence, scoped mapping changes, regression comparison, activity history, and JSON export.
- Server-enforced workflow ordering, revision checks, repair/snapshot integrity checks, and approval gating.
- Changed quantity semantics, expired access, and outages require operator intervention. Timeout-after-commit recovery reconciles receipts before retrying.
- Diagnosis is deterministic and rule-based. This flow makes no LLM call and does not claim autonomous recovery.
- Mock ERP only. Approval permits isolated replay, not deployment or modification of a production adapter.
- Local JSON history in `.data/faultline.json`, limited to 30 runs. Persistence assumes a writable filesystem and one server process; it is not a multi-user authenticated production service.

## Validation

`pnpm test` runs engine tests; `pnpm typecheck` checks TypeScript; `pnpm build` checks the production build.

With the local app running, `DEMO_URL=http://127.0.0.1:3000 node tests/rescue-browser.mjs` validates the complete browser flow, server approval guard, saved state, exports, search, evidence, and mobile overflow. It uses installed Chrome and saves screenshots in `test-results/`.

The older `tests/lab-browser.mjs` targets the previous Faultline interface. Use the Rescue browser test for the new home page.
