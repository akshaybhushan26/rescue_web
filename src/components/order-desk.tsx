"use client";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Code2,
  Database,
  FileCheck2,
  Inbox,
  Layers3,
  Loader2,
  Mail,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import type { Case, Workspace } from "@/lib/types";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );
const labels: Record<Case["status"], string> = {
  received: "Received",
  ready: "Ready for approval",
  review: "Needs review",
  approved: "Approved · sandbox",
  rejected: "Rejected",
};
type Tab = "proposal" | "context" | "audit" | "payload";
export default function OrderDesk() {
  const [data, setData] = useState<Workspace | null>(null);
  const [selected, setSelected] = useState("mail-clear");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("proposal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"email" | "architecture" | "reset" | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [orderId, setOrderId] = useState("");
  const [custom, setCustom] = useState({
    from: "maya@northstar.example",
    subject: "New order · PO NS-4425",
    body: "Please place a new order for 25 BRG-6204 under PO NS-4425. Ship to our usual Portland address, standard terms.",
  });
  const active = data?.cases.find((c) => c.id === selected);
  async function refresh() {
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the workspace.");
      setData(await response.json());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, textarea, select, a[href]",
        ) ?? [],
      );
    focusable()[0]?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
      if (event.key === "Tab") {
        const nodes = focusable();
        const first = nodes[0];
        const last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [modal]);
  function select(id: string) {
    setSelected(id);
    setTab("proposal");
    setNote("");
    setOrderId("");
    setError("");
    setNotice("");
  }
  async function command(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) await refresh();
        throw new Error(result.error || "Action failed.");
      }
      setData(result);
      const updatedCase = result.cases.find((c: Case) => c.id === selected);
      // Keep a case visible when an action moves it out of the current queue.
      if (
        payload.id === selected &&
        updatedCase &&
        filter !== "all" &&
        updatedCase.status !== filter
      )
        setFilter("all");
      if (payload.action === "ingest") {
        setFilter("all");
        setQuery("");
        select(result.cases.at(-1).id);
        setModal(null);
      }
      if (payload.action === "reset") {
        select("mail-clear");
        setModal(null);
        setFilter("all");
        setQuery("");
      }
      if (payload.action === "approve")
        setNotice("Proposal approved in the sandbox. No ERP data was changed.");
      if (payload.action === "reject")
        setNotice(
          "Case rejected. Your review note is saved in the audit trail.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function act(action: string, extra: Record<string, unknown> = {}) {
    if (active)
      void command({
        action,
        id: active.id,
        revision: active.revision,
        ...extra,
      });
  }
  function exportCase() {
    if (!active) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(active, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `trelium-${active.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const visible =
    data?.cases.filter(
      (c) =>
        (filter === "all" || c.status === filter) &&
        `${c.email.subject} ${c.email.sender} ${c.email.body}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) ?? [];
  const count = (status: string) =>
    data?.cases.filter((c) => c.status === status).length ?? 0;
  const canResolve =
    active?.status === "review" &&
    active.intent?.kind === "amend" &&
    !active.intent.orderRef &&
    active.checks
      .filter((c) => !c.passed)
      .every((c) => ["order", "amendment"].includes(c.code));
  function showFilter(next: string) {
    setFilter(next);
    setQuery("");
    const first = data?.cases.find((c) => next === "all" || c.status === next);
    if (first) select(first.id);
  }
  function showReview() {
    setTab("proposal");
    requestAnimationFrame(() =>
      document
        .getElementById(canResolve ? "clarification-section" : "review-section")
        ?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "start",
        }),
    );
  }
  return (
    <div className="rescue order-workspace">
      <aside className="rs-sidebar">
        <a href="/" className="rs-brand" aria-label="Rescue home">
          <span>
            <Workflow size={22} />
          </span>
          rescue<span className="rs-brand-dot">.</span>
        </a>
        <div className="rs-workspace">
          <span className="rs-workspace-icon">A</span>
          <div>
            Demo workspace<small>Order operations</small>
          </div>
        </div>
        <div className="rs-nav-label">WORKSPACE</div>
        <nav>
          <a href="/">
            <Workflow size={17} />
            Integration recovery
          </a>
          <button className="active" onClick={() => showFilter("all")}>
            <Inbox size={17} />
            Order desk
          </button>
          <button onClick={() => setModal("architecture")}>
            <Layers3 size={17} />
            How it works
          </button>
        </nav>
        <div className="rs-sidebar-bottom">
          <div className="rs-profile">
            <span>AB</span>
            <div>
              Akshay Bhushan<small>Independent project</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="rs-main">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>Order desk</strong>
          </div>
          <div className="top-actions">
            <span className="provider">
              <span className="status-dot" />{" "}
              {data?.mode === "openai"
                ? "Live agent · demo workspace"
                : "Demo workspace"}
            </span>
            <button
              className="icon-button"
              title="Reset demo"
              aria-label="Reset demo"
              onClick={() => setModal("reset")}
            >
              <RotateCcw size={16} />
            </button>
            <div className="avatar">AB</div>
          </div>
        </header>
        <main className="rs-content">
          <section className="rs-heading">
            <div>
              <h1>Order desk</h1>
              <p>Turn customer emails into reviewed order drafts.</p>
            </div>
            <button
              className="rs-button primary"
              onClick={() => setModal("email")}
            >
              <Plus size={16} />
              Add an email
            </button>
          </section>
          {error && (
            <div className="message error" role="alert">
              <CircleAlert size={17} />
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="message success" role="status">
              <Check size={17} />
              {notice}
            </div>
          )}
          {!data ? (
            <div className="loading">
              <Loader2 className="spin" size={22} />
              <span>Loading your order desk…</span>
              {error && (
                <button className="button" onClick={() => void refresh()}>
                  Retry
                </button>
              )}
            </div>
          ) : (
            <section className="desk">
              <aside className="inbox-panel">
                <div className="panel-title">
                  <h2>
                    Inbox <span>{data.cases.length}</span>
                  </h2>
                  <span className="live-label">
                    <span className="status-dot" /> DEMO INBOX
                  </span>
                </div>
                <div className="search-box">
                  <Search size={15} />
                  <input
                    aria-label="Search emails"
                    placeholder="Search emails…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="inbox-filters">
                  {["all", "received", "ready", "review", "approved"].map(
                    (f) => (
                      <button
                        key={f}
                        className={filter === f ? "selected" : ""}
                        onClick={() => showFilter(f)}
                      >
                        {f === "all"
                          ? "All emails"
                          : f === "review"
                            ? "Needs review"
                            : f === "ready"
                              ? "Ready"
                              : f === "approved"
                                ? "Approved"
                                : "New"}
                      </button>
                    ),
                  )}
                </div>
                <div className="email-list">
                  {visible.length === 0 && (
                    <div className="empty-inbox">
                      <Inbox size={26} />
                      <strong>No matching emails</strong>
                      <span>Try another filter or search.</span>
                    </div>
                  )}
                  {visible.map((c) => (
                    <button
                      className={`email-item ${selected === c.id ? "selected" : ""}`}
                      aria-pressed={selected === c.id}
                      key={c.id}
                      onClick={() => select(c.id)}
                    >
                      <div className="email-meta">
                        <span
                          className={`sender-avatar ${c.email.from.includes("meridian") ? "purple" : ""}`}
                        >
                          {c.email.sender
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </span>
                        <strong>{c.email.sender}</strong>
                        <time>
                          {new Date(c.email.receivedAt).toLocaleTimeString(
                            "en-GB",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Kolkata",
                            },
                          )}
                        </time>
                      </div>
                      <h3>{c.email.subject}</h3>
                      <p>{c.email.body.replace(/\n/g, " ")}</p>
                      <div className="email-item-footer">
                        <span className={`badge ${c.status}`}>
                          {c.status === "received" && (
                            <span className="mini-dot" />
                          )}
                          {labels[c.status]}
                        </span>
                        <span className="sample-label">{c.email.sample}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="inbox-foot">
                  <ShieldCheck size={14} /> Email content is always untrusted.
                </div>
              </aside>
              <div className="case-panel">
                {(!active || !visible.some((c) => c.id === active.id)) && (
                  <div className="simple-empty queue-empty">
                    <Inbox size={32} />
                    <h3>
                      {visible.length
                        ? "Choose an email to get started."
                        : "All clear here."}
                    </h3>
                    <p>
                      {visible.length
                        ? "The request and its next step will appear here."
                        : "No emails match this view. Try another filter or return to the inbox."}
                    </p>
                    <button
                      className="button"
                      onClick={() => showFilter("all")}
                    >
                      Back to all emails
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}
                {active && visible.some((c) => c.id === active.id) && (
                  <>
                    <div className="case-topline">
                      <span className="case-id">
                        CASE /{" "}
                        {active.id.startsWith("mail-")
                          ? active.id
                              .replace("mail-", "")
                              .toUpperCase()
                              .slice(0, 12)
                          : active.id}
                      </span>
                      <span className={`badge ${active.status}`}>
                        {labels[active.status]}
                      </span>
                    </div>
                    <section
                      className={`next-step ${active.status}`}
                      aria-label="Next step"
                    >
                      <div className="next-step-icon">
                        {active.status === "review" ? (
                          <CircleAlert size={22} />
                        ) : active.status === "approved" ? (
                          <CheckCheck size={22} />
                        ) : (
                          <Sparkles size={22} />
                        )}
                      </div>
                      <div className="next-step-copy">
                        <span>
                          {active.status === "received"
                            ? "STEP 01 / UNDERSTAND THE REQUEST"
                            : active.status === "review"
                              ? "YOUR INPUT IS NEEDED"
                              : active.status === "ready"
                                ? "STEP 02 / REVIEW THE PROPOSAL"
                                : "REVIEW COMPLETE"}
                        </span>
                        <h3>
                          {active.status === "received"
                            ? "Prepare this order."
                            : active.status === "review"
                              ? "This request needs your input."
                              : active.status === "ready"
                                ? "Review the draft."
                                : active.status === "approved"
                                  ? "Review complete."
                                  : "This request has been closed."}
                        </h3>
                        <p>
                          {active.status === "received"
                            ? "Match the customer, check their orders, and prepare a draft."
                            : active.status === "review"
                              ? "Review the missing details before any action is proposed."
                              : active.status === "ready"
                                ? "Check the line items, then add a note to approve or reject."
                                : "Your decision is saved in the activity history."}
                        </p>
                      </div>
                      {["received", "review"].includes(active.status) ? (
                        <button
                          className="button dark"
                          disabled={busy}
                          onClick={() =>
                            active.status === "received"
                              ? act("analyze")
                              : showReview()
                          }
                        >
                          {busy ? (
                            <Loader2 className="spin" size={16} />
                          ) : active.status === "received" ? (
                            <Sparkles size={16} />
                          ) : (
                            <ArrowRight size={16} />
                          )}
                          {busy
                            ? "Working…"
                            : active.status === "received"
                              ? "Run agent"
                              : "Review details"}
                        </button>
                      ) : active.status === "ready" ? (
                        <button className="button dark" onClick={showReview}>
                          Review proposal
                          <ArrowRight size={16} />
                        </button>
                      ) : (
                        <button
                          className="button"
                          onClick={() => setTab("audit")}
                        >
                          View activity
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </section>
                    <section className="email-content">
                      <h2>{active.email.subject}</h2>
                      <div className="email-address">
                        <span className="sender-avatar">
                          {active.email.sender[0]}
                        </span>
                        <div>
                          <strong>{active.email.sender}</strong>{" "}
                          <span>&lt;{active.email.from}&gt;</span>
                          <small>
                            To: orders@demo.example <span>·</span>{" "}
                            {new Date(
                              active.email.receivedAt,
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              timeZone: "Asia/Kolkata",
                            })}{" "}
                            ·{" "}
                            {new Date(
                              active.email.receivedAt,
                            ).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Kolkata",
                            })}{" "}
                            IST
                          </small>
                        </div>
                      </div>
                      <details
                        className="email-letter"
                        key={active.id + active.status}
                        open={active.status === "received"}
                      >
                        <summary>
                          Original customer email
                          <ChevronDown size={15} />
                        </summary>
                        <div className="email-body">{active.email.body}</div>
                      </details>
                    </section>
                    <nav className="tabs" aria-label="Case details">
                      {[
                        { id: "proposal", label: "Proposal" },
                        { id: "context", label: "Customer & orders" },
                        { id: "audit", label: "Activity" },
                        { id: "payload", label: "Action details" },
                      ].map((t) => (
                        <button
                          key={t.id}
                          className={tab === t.id ? "active" : ""}
                          aria-pressed={tab === t.id}
                          onClick={() => setTab(t.id as Tab)}
                        >
                          {t.label}
                          {t.id === "audit" && (
                            <span>{active.audit.length}</span>
                          )}
                        </button>
                      ))}
                      <div className="order-tab-actions">
                        {" "}
                        {active.status === "review" && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => act("analyze")}
                          >
                            <RotateCcw size={13} /> Try analysis again
                          </button>
                        )}
                        {["ready", "approved", "rejected"].includes(
                          active.status,
                        ) && (
                          <button
                            className="button compact"
                            onClick={exportCase}
                          >
                            <ArrowDown size={14} /> Export case
                          </button>
                        )}
                      </div>
                    </nav>
                    <div className="tab-content" id="review-section">
                      {tab === "proposal" &&
                        (active.status === "received" ? (
                          <p className="order-idle-note">
                            Run the agent to prepare a proposal from this email.
                          </p>
                        ) : (
                          <>
                            <div
                              className={`result-banner ${active.proposal ? "good" : "warning"}`}
                            >
                              <span className="result-icon">
                                {active.proposal ? (
                                  <ShieldCheck size={20} />
                                ) : (
                                  <CircleAlert size={20} />
                                )}
                              </span>
                              <div>
                                <h3>
                                  {active.status === "approved"
                                    ? "Approved for the sandbox"
                                    : active.status === "rejected"
                                      ? "Reviewed and rejected"
                                      : active.proposal
                                        ? "Ready for your approval."
                                        : "This request needs a closer look."}
                                </h3>
                                <p>
                                  {active.proposal
                                    ? "Customer, products, and terms checked. This is a draft for your review."
                                    : "The agent has paused. Resolve the highlighted details to continue."}
                                </p>
                              </div>
                              <div className="confidence">
                                <strong>
                                  {Math.round(active.confidence * 100)}
                                  <small>%</small>
                                </strong>
                                <span>checks passed</span>
                              </div>
                            </div>
                            {active.proposal && (
                              <div className="proposal-card">
                                <div className="section-caption">
                                  <span>YOUR ORDER DRAFT</span>
                                  <span className="small-pill">Draft only</span>
                                </div>
                                <div className="proposal-title">
                                  <FileCheck2 size={18} />
                                  <strong>
                                    {active.proposal.operation ===
                                    "CREATE_DRAFT_ORDER"
                                      ? "Create draft sales order"
                                      : `Amend ${active.proposal.orderId}`}
                                  </strong>
                                  <span>{active.proposal.purchaseOrder}</span>
                                </div>
                                <div className="customer-line">
                                  {active.customer?.name} <span>·</span>{" "}
                                  {active.customer?.terms} <span>·</span> USD
                                </div>
                                <table className="line-table">
                                  <thead>
                                    <tr>
                                      <th>Product</th>
                                      <th>Qty</th>
                                      <th>Unit price</th>
                                      <th>Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {active.proposal.lines.map((l) => (
                                      <tr key={l.sku}>
                                        <td>
                                          <strong>{l.sku}</strong>
                                          <small>{l.name}</small>
                                        </td>
                                        <td>{l.quantity}</td>
                                        <td>{money(l.unitPrice)}</td>
                                        <td>{money(l.lineTotal)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <div className="proposal-total">
                                  <span>
                                    Proposed subtotal{" "}
                                    <small>Taxes & freight excluded</small>
                                  </span>
                                  <strong>
                                    {money(active.proposal.total)}
                                  </strong>
                                </div>
                                <div className="shipping">
                                  <span>SHIP TO</span>
                                  {active.proposal.shipTo}
                                </div>
                              </div>
                            )}
                            <details
                              className="order-checks-disclosure"
                              open={active.status === "review"}
                            >
                              <summary>
                                Validation checks{" "}
                                <span>
                                  {active.checks.filter((c) => c.passed).length}
                                  /{active.checks.length} passed
                                </span>
                                <ChevronDown size={14} />
                              </summary>{" "}
                              <div className="checks">
                                {active.checks.map((check) => (
                                  <details
                                    key={check.code}
                                    className={check.passed ? "pass" : "fail"}
                                    open={!check.passed}
                                  >
                                    <summary>
                                      {check.passed ? (
                                        <Check size={15} />
                                      ) : (
                                        <CircleAlert size={15} />
                                      )}
                                      <strong>{check.label}</strong>
                                      <span>
                                        {check.passed ? "Passed" : "Review"}
                                      </span>
                                      <ChevronDown size={13} />
                                    </summary>
                                    <p>{check.detail}</p>
                                  </details>
                                ))}
                              </div>
                            </details>
                            {canResolve && (
                              <div
                                className="review-card"
                                id="clarification-section"
                              >
                                <h3>Confirm the intended order</h3>
                                <p>
                                  Contact the customer first. For this demo,
                                  assume they confirm <strong>SO-2041</strong>.
                                  Selecting another order may still fail
                                  validation.
                                </p>
                                <label htmlFor="order-select">
                                  Confirmed order reference
                                </label>
                                <div className="resolve-row">
                                  <select
                                    id="order-select"
                                    value={orderId}
                                    onChange={(e) => setOrderId(e.target.value)}
                                  >
                                    <option value="">
                                      Select an open order…
                                    </option>
                                    {active.orders
                                      .filter((o) => o.status === "open")
                                      .map((o) => (
                                        <option key={o.id} value={o.id}>
                                          {o.id} · PO {o.po} ·{" "}
                                          {o.lines
                                            .map(
                                              (l) => `${l.quantity} ${l.sku}`,
                                            )
                                            .join(", ")}
                                        </option>
                                      ))}
                                  </select>
                                  <button
                                    className="button dark compact"
                                    disabled={!orderId || busy}
                                    onClick={() => act("resolve", { orderId })}
                                  >
                                    Confirm & validate <ArrowRight size={14} />
                                  </button>
                                </div>
                              </div>
                            )}
                            {active.intent?.lines.length ? (
                              <details className="evidence">
                                <summary>
                                  <Code2 size={15} /> See what the customer
                                  asked for <ChevronDown size={14} />
                                </summary>
                                {active.intent.lines.map((l, i) => (
                                  <div key={i}>
                                    <span>
                                      {l.sku} · {l.quantity} units
                                    </span>
                                    <q>{l.evidence}</q>
                                  </div>
                                ))}
                              </details>
                            ) : null}
                            {["ready", "review"].includes(active.status) && (
                              <div className="decision">
                                <label htmlFor="review-note">
                                  Reviewer note{" "}
                                  <span>Required · at least 8 characters</span>
                                </label>
                                <textarea
                                  id="review-note"
                                  placeholder={
                                    active.proposal
                                      ? "e.g. Confirmed quantities and commercial terms with the customer."
                                      : "e.g. Requested clarification from the customer before proceeding."
                                  }
                                  value={note}
                                  onChange={(e) => setNote(e.target.value)}
                                  maxLength={500}
                                />
                                <div className="decision-actions">
                                  <span>
                                    <ShieldCheck size={14} /> Saved to the demo.
                                    No live order is placed.
                                  </span>
                                  <button
                                    className="button compact"
                                    disabled={busy || note.trim().length < 8}
                                    onClick={() => act("reject", { note })}
                                  >
                                    Reject case
                                  </button>
                                  <button
                                    className="button green compact"
                                    disabled={
                                      busy ||
                                      !active.proposal ||
                                      note.trim().length < 8
                                    }
                                    onClick={() => act("approve", { note })}
                                  >
                                    <Check size={14} /> Approve proposal
                                  </button>
                                </div>
                              </div>
                            )}
                            {active.reviewNote && (
                              <div className="review-note">
                                <CheckCheck size={16} />
                                <div>
                                  <strong>Reviewer decision recorded</strong>
                                  <p>{active.reviewNote}</p>
                                </div>
                              </div>
                            )}
                          </>
                        ))}
                      {tab === "context" && (
                        <div className="context-content">
                          <div className="section-caption">
                            MOCK ERP · READ-ONLY SNAPSHOT
                          </div>
                          {active.customer ? (
                            <>
                              <div className="context-customer">
                                <div className="company-avatar">
                                  {active.customer.name[0]}
                                </div>
                                <div>
                                  <h3>{active.customer.name}</h3>
                                  <span>
                                    {active.customer.id} · Exact email contact
                                    match
                                  </span>
                                </div>
                                <span className="badge ready">Matched</span>
                              </div>
                              <div className="context-grid">
                                <div>
                                  <span>Payment terms</span>
                                  <strong>{active.customer.terms}</strong>
                                </div>
                                <div>
                                  <span>Available credit</span>
                                  <strong>
                                    {money(active.customer.creditAvailable)}
                                  </strong>
                                </div>
                                <div className="full">
                                  <span>Default ship-to</span>
                                  <strong>{active.customer.shipTo}</strong>
                                </div>
                              </div>
                              <h3 className="subheading">
                                Related orders{" "}
                                <span>{active.orders.length}</span>
                              </h3>
                              {active.orders.map((o) => (
                                <div className="order-context" key={o.id}>
                                  <div>
                                    <strong>{o.id}</strong>
                                    <span>
                                      PO {o.po} · Version {o.version}
                                    </span>
                                    <span
                                      className={`badge ${o.status === "open" ? "ready" : "received"}`}
                                    >
                                      {o.status}
                                    </span>
                                  </div>
                                  <p>
                                    {o.lines
                                      .map((l) => `${l.quantity} × ${l.sku}`)
                                      .join("  /  ")}
                                  </p>
                                </div>
                              ))}
                            </>
                          ) : (
                            <div className="simple-empty">
                              <Database size={25} />
                              <h3>Context will appear here</h3>
                              <p>
                                Run the agent to resolve the sender against mock
                                customer contacts.
                              </p>
                            </div>
                          )}
                          <h3 className="subheading">Product catalog</h3>
                          {data.products.map((p) => (
                            <div key={p.sku} className="catalog-line">
                              <div>
                                <strong>{p.sku}</strong>
                                <span>{p.name}</span>
                              </div>
                              <span>
                                {p.available.toLocaleString()} available
                              </span>
                              <strong>{money(p.price)}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                      {tab === "audit" && (
                        <div className="audit-content">
                          <div className="section-caption">
                            <span>EVERY STEP, ACCOUNTED FOR</span>
                            <button
                              className="text-button"
                              onClick={exportCase}
                            >
                              Export JSON <ArrowDown size={13} />
                            </button>
                          </div>
                          <div className="timeline">
                            {active.audit.map((event, i) => (
                              <div className="timeline-event" key={event.id}>
                                <span className="timeline-marker">
                                  {i === active.audit.length - 1 ? (
                                    <Check size={12} />
                                  ) : (
                                    <span />
                                  )}
                                </span>
                                <div>
                                  <div className="timeline-title">
                                    <strong>{event.event}</strong>
                                    <time>
                                      {new Date(event.at).toLocaleTimeString(
                                        "en-GB",
                                        {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          second: "2-digit",
                                          timeZone: "Asia/Kolkata",
                                        },
                                      )}{" "}
                                      IST
                                    </time>
                                  </div>
                                  <p>{event.detail}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="empty-note">
                            <Clock3 size={14} /> Local audit log · persisted on
                            disk · not tamper-proof
                          </div>
                        </div>
                      )}
                      {tab === "payload" && (
                        <div className="payload-content">
                          <div className="section-caption">
                            <span>INSPECTABLE ACTION CONTRACT</span>
                            {active.proposal && (
                              <button
                                className="text-button"
                                onClick={exportCase}
                              >
                                Export case <ArrowDown size={13} />
                              </button>
                            )}
                          </div>
                          {active.proposal ? (
                            <>
                              <div className="payload-warning">
                                <ShieldCheck size={15} /> execution: disabled ·
                                no live ERP adapter connected
                              </div>
                              <pre>
                                {JSON.stringify(active.proposal, null, 2)}
                              </pre>
                            </>
                          ) : (
                            <div className="simple-empty">
                              <Code2 size={28} />
                              <h3>No ERP action proposed</h3>
                              <p>
                                {active.status === "received"
                                  ? "Run the agent to evaluate this request."
                                  : "All blocking checks must pass before a payload is created."}
                              </p>
                              {active.intent && (
                                <pre>
                                  {JSON.stringify(active.intent, null, 2)}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
          )}
          <footer className="page-footer">
            <span>Integration Rescue · Built by Akshay</span>
            <span>
              Sandbox only.
              <button onClick={() => setModal("architecture")}>
                Explore the architecture <ArrowRight size={12} />
              </button>
            </span>
          </footer>
        </main>
      </div>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!busy) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              onClick={() => setModal(null)}
              aria-label="Close dialog"
            >
              <X size={19} />
            </button>
            {modal === "email" && (
              <>
                <div className="eyebrow">UNTRUSTED INPUT · MOCK WORKSPACE</div>
                <h2 id="modal-title">Bring your own email.</h2>
                <p>
                  Try a request using the mock catalog: BRG-6204, BLT-M8,
                  SEAL-25. The mock parser supports “new order for 25 BRG-6204
                  under PO NS-4425” and explicit quantity amendments.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void command({ action: "ingest", ...custom });
                  }}
                >
                  <label htmlFor="custom-from">
                    Sender email
                    <input
                      id="custom-from"
                      type="email"
                      required
                      value={custom.from}
                      onChange={(e) =>
                        setCustom({ ...custom, from: e.target.value })
                      }
                    />
                  </label>
                  <small className="form-hint">
                    Known contacts: maya@northstar.example,
                    daniel@meridian.example
                  </small>
                  <label htmlFor="custom-subject">
                    Subject
                    <input
                      id="custom-subject"
                      required
                      maxLength={200}
                      value={custom.subject}
                      onChange={(e) =>
                        setCustom({ ...custom, subject: e.target.value })
                      }
                    />
                  </label>
                  <label htmlFor="custom-body">Email body</label>
                  <textarea
                    id="custom-body"
                    required
                    minLength={10}
                    maxLength={8000}
                    rows={7}
                    value={custom.body}
                    onChange={(e) =>
                      setCustom({ ...custom, body: e.target.value })
                    }
                  />
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <button className="button dark" disabled={busy} type="submit">
                    {busy ? (
                      <Loader2 className="spin" size={15} />
                    ) : (
                      <Inbox size={15} />
                    )}{" "}
                    Add to inbox
                  </button>
                </form>
              </>
            )}
            {modal === "architecture" && (
              <>
                <div className="eyebrow">DESIGNED TO BE EXPLAINED</div>
                <h2 id="modal-title">
                  Reason with context.
                  <br />
                  Act within boundaries.
                </h2>
                <p>
                  The extractor interprets the email. Deterministic server
                  policy decides whether a proposal is safe to prepare.
                </p>
                <div className="architecture-steps">
                  {[
                    {
                      title: "1. Ingest untrusted email",
                      text: "Bounded input, exact sender lookup, and no executable email HTML. Demo sender identity is operator-supplied, not authenticated.",
                    },
                    {
                      title: "2. Extract a structured intent",
                      text: "A deterministic mock works without credentials. An optional OpenAI adapter uses the same validated schema, with no tools or ERP access.",
                    },
                    {
                      title: "3. Resolve and validate context",
                      text: "Allowlisted products, exact source evidence, order ownership, quantities, credit, duplicates, and amendment semantics are checked on the server.",
                    },
                    {
                      title: "4. Review, then propose",
                      text: "Any blocking failure routes to review. All checks must pass, even above the 90% coverage threshold. Coverage measures passed checks; it is not a probability.",
                    },
                    {
                      title: "5. Record the decision",
                      text: "Reviewer notes and revision checks preserve the decision path. Approval records a proposal only. No live ERP connector exists.",
                    },
                  ].map((s) => (
                    <div key={s.title}>
                      <h3>{s.title}</h3>
                      <p>{s.text}</p>
                    </div>
                  ))}
                </div>
                <div className="architecture-boundary">
                  <strong>Before production</strong>
                  <p>
                    Add authentication, verified email ingestion, tenant
                    isolation, transactional PostgreSQL storage, calibrated
                    extraction evaluations, and an idempotent ERP write adapter.
                    The local file store and pattern guard are demo choices.
                  </p>
                </div>
              </>
            )}
            {modal === "reset" && (
              <>
                <div className="eyebrow">RESET SANDBOX</div>
                <h2 id="modal-title">Start a fresh demo?</h2>
                <p>
                  This removes custom emails, decisions, and the local audit
                  history, then restores the four sample emails.
                </p>
                <div className="modal-actions">
                  <button className="button" onClick={() => setModal(null)}>
                    Keep workspace
                  </button>
                  <button
                    className="button dark"
                    disabled={busy}
                    onClick={() => void command({ action: "reset" })}
                  >
                    <RotateCcw size={15} /> Reset demo
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
