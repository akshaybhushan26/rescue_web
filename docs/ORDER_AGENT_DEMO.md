# A short walkthrough Akshay can explain

“This demo handles the gap between a customer email and a safe ERP action. It resolves the customer and their open orders, extracts the request, validates it, then proposes a draft. It never writes to a live ERP.”

**Show the clear order:** run Maya's PO NS-4420. Explain that prices, shipping, and terms are looked up from ERP data rather than trusted from the email. Open the JSON payload: the action is explicit, typed, and inspectable. Approve with a note, then show Activity.

**Show the ambiguous change:** run the bearing amendment with no order number. There are two possible orders, so the agent pauses. Simulate customer confirmation of SO-2041 and rerun checks. The proposed amendment contains an expected order version. Selecting the other order stays blocked because it would drop a line.

**Show the boundary:** run the hostile email. The instruction to bypass validation is just untrusted text. Even 90% coverage does not produce a payload when one blocking guard fails.

## Design questions worth being ready for

**Why separate extraction from policy?** Natural-language interpretation can vary. Customer identity, prices, limits, and write permission should be deterministic and testable. The model never gets an ERP write tool.

**What does confidence mean here?** It is check coverage, not a model probability. I expose the checks rather than inventing a probability. In production I would evaluate field-level extraction on a labeled corpus and calibrate routing thresholds from measured risk.

**Why no database?** The local prototype has no configured database. Atomic JSON persistence keeps setup simple. I would use PostgreSQL transactions, row-level tenant isolation, a unique customer/PO constraint, and an append-only audit for a deployment.

**How would retries be safe?** Current revision checks stop stale decisions and duplicate customer/PO approvals in one process. A production outbox and idempotent ERP adapter would address retries across workers. The ERP version and fresh stock/credit checks must be checked at write time.

**What is deliberately limited?** Mock parsing, email authentication, persistent multi-worker storage, partial amendments, shipping and delivery changes, and real ERP execution. The demo routes uncertainty to review and documents these limits.

**What would I build next?** Verified ingestion, a labeled evaluation set, transactional storage, authenticated review, and only then a narrowly scoped ERP adapter with idempotency and fresh validation.

This is an independent engineering demonstration, not a Trelium product or a claim about its internal stack. No outreach is sent by this application.
