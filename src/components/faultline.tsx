"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  Clock3,
  Code2,
  FileCheck2,
  FlaskConical,
  History,
  Inbox,
  Loader2,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Split,
  X,
} from "lucide-react";
import type { Fixture, LabRun, Report, Result } from "@/lib/lab/types";
type FixtureSummary = Omit<Fixture, "email" | "expected"> & {
  expectedOutcome: string;
};
type State = {
  fixtures: FixtureSummary[];
  run: LabRun | null;
  history: {
    id: string;
    at: string;
    stage: string;
    passed: number;
    total: number;
  }[];
  mode: string;
};
type Tab = "diagnosis" | "trace" | "comparison" | "history";
const outcomeLabel: Record<string, string> = {
  committed: "Sandbox order recorded",
  review: "Held for review",
  manual: "Operator required",
  failed: "Integration failed",
};
export default function Faultline() {
  const [data, setData] = useState<State | null>(null),
    [selected, setSelected] = useState("schema-drift"),
    [tab, setTab] = useState<Tab>("diagnosis"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [view, setView] = useState<"baseline" | "latest">("baseline");
  const run = data?.run;
  const latest = run?.replay ?? run?.verification ?? run?.baseline;
  const report = view === "baseline" ? run?.baseline : latest;
  const result = report?.results.find((r) => r.fixtureId === selected);
  const fixture = data?.fixtures.find((f) => f.id === selected);
  const visible =
    data?.fixtures.filter(
      (f) =>
        (filter !== "failed" ||
          run?.baseline.results.some(
            (r) => r.fixtureId === f.id && !r.passed,
          )) &&
        `${f.name} ${f.category}`.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];
  async function load(id?: string) {
    try {
      const response = await fetch(`/api/lab${id ? `?id=${id}` : ""}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not load the reliability lab.");
      setData(await response.json());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function act(action: string) {
    setBusy(action);
    setError("");
    try {
      const response = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "run"
            ? { action }
            : {
                action,
                id: run?.id,
                revision: run?.revision,
                ...(action === "approve" ? { note } : {}),
              },
        ),
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || "Lab operation failed.");
      setData(next);
      if (action === "run") {
        setSelected("schema-drift");
        setView("baseline");
        setTab("diagnosis");
        setFilter("all");
        setNote("");
      }
      if (action === "verify" || action === "replay") setView("latest");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function exportRun() {
    if (!run) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(run, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `faultline-${run.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  function choose(id: string) {
    setSelected(id);
    setTab("diagnosis");
  }
  const step = run?.stage ?? "idle";
  return (
    <div className="app-shell faultline">
      <aside className="rail">
        <a
          className="brand faultline-brand"
          href="/"
          aria-label="FAULTLINE reliability lab"
        >
          <span className="brand-symbol">
            <Split size={23} />
          </span>
          <span>
            FAULTLINE<small>AGENT RELIABILITY LAB</small>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-icon">
            <FlaskConical size={16} />
          </span>
          <div>
            Integration sandbox<small>Order agent · Mock ERP</small>
          </div>
        </div>
        <div className="nav-label">YOUR WORKBENCH</div>
        <button
          className={`nav-item ${tab !== "history" ? "active" : ""}`}
          onClick={() => setTab("diagnosis")}
        >
          <Activity size={18} />
          Reliability lab<span>{data?.fixtures.length ?? 15}</span>
        </button>
        <a className="nav-item" href="/order-desk">
          <Inbox size={18} />
          Order agent
          <ArrowRight size={15} />
        </a>
        <button
          className={`nav-item ${tab === "history" ? "active" : ""}`}
          onClick={() => setTab("history")}
        >
          <History size={18} />
          Run history<span>{data?.history.length ?? 0}</span>
        </button>
        <div className="rail-bottom">
          <div className="sandbox-card">
            <ShieldCheck size={20} />
            <strong>
              Break it here.
              <br />
              Keep it safe out there.
            </strong>
            <p>
              Isolated mock orders. Review before replay. No live integration
              changes.
            </p>
            <span className="small-pill">
              <span className="status-dot" />
              Lab sandbox active
            </span>
          </div>
          <div className="builder">
            <div className="avatar">AB</div>
            <div>
              Built by Akshay<small>Independent engineering demo</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            FAULTLINE
            <ChevronRight size={14} />
            <strong>Integration reliability</strong>
          </div>
          <div className="top-actions">
            <span className="provider">
              <span className="status-dot" />
              Deterministic mock
            </span>
            <div className="avatar">AB</div>
          </div>
        </header>
        <main>
          <section className="page-heading lab-heading">
            <div>
              <div className="eyebrow">
                <span />
                BREAK YOUR AGENTS BEFORE YOUR CUSTOMERS DO
              </div>
              <h1>
                Find the fault. <em>Prove the fix.</em>
              </h1>
              <p>
                A focused workbench for broken integrations. Evidence, repair,
                and replay in one place.
              </p>
            </div>
            <button
              className="button dark"
              disabled={!!busy || !data}
              onClick={() => void act("run")}
            >
              {busy === "run" ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Play size={16} />
              )}{" "}
              {busy === "run" ? "Running scenarios…" : "Run reliability tests"}
            </button>
          </section>
          <section
            className="metrics lab-metrics"
            aria-label="Reliability scorecard"
          >
            {[
              {
                label: "Scenarios in the suite",
                value: data?.fixtures.length ?? 15,
                hint: "Orders, ambiguity, and API faults",
                icon: FlaskConical,
              },
              {
                label: "Baseline expectations met",
                value: run
                  ? `${run.baseline.passed}/${run.baseline.results.length}`
                  : "—",
                hint: run
                  ? `${run.baseline.failed} reproducible integration failures`
                  : "Run the suite to measure",
                icon: Activity,
              },
              {
                label: "Verified expectations met",
                value: run?.verification
                  ? `${latest?.passed}/${latest?.results.length}`
                  : "—",
                hint: run?.verification
                  ? "Same inputs. Fresh mock ledgers."
                  : "A repair must earn its result",
                icon: CheckCheck,
              },
              {
                label: "Unsafe sandbox writes",
                value: latest ? latest.unsafeWrites : "—",
                hint: "Measured against fixture expectations",
                icon: ShieldCheck,
              },
            ].map(({ label, value, hint, icon: Icon }) => (
              <div className="metric" key={label}>
                <div className="metric-label">
                  {label}
                  <Icon size={17} />
                </div>
                <strong>{value}</strong>
                <small>{hint}</small>
              </div>
            ))}
          </section>
          <div className="lab-flow" aria-label="Repair workflow">
            {[
              "Run baseline",
              "Inspect evidence",
              "Verify repair",
              "Approve & replay",
            ].map((label, i) => (
              <div
                key={label}
                className={
                  i <
                  {
                    idle: 0,
                    baseline: 1,
                    diagnosed: 2,
                    verified: 3,
                    approved: 3,
                    replayed: 4,
                  }[step]
                    ? "done"
                    : ""
                }
              >
                <span>{i + 1}</span>
                {label}
                {i < 3 && <ChevronRight size={14} />}
              </div>
            ))}
            <span className="lab-flow-note">
              <ShieldCheck size={13} />
              Human controls the repair
            </span>
          </div>
          {error && (
            <div className="message error" role="alert">
              <CircleAlert size={17} />
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={15} />
              </button>
            </div>
          )}
          {!data ? (
            <div className="loading">
              <Loader2 className="spin" size={20} />
              Loading FAULTLINE…
              {error && (
                <button className="button" onClick={() => void load()}>
                  Retry
                </button>
              )}
            </div>
          ) : (
            <div className="lab-workbench">
              <aside className="inbox-panel lab-scenarios">
                <div className="panel-title">
                  <h2>
                    Test scenarios <span>{data.fixtures.length}</span>
                  </h2>
                  <span className="live-label">VERSIONED FIXTURES</span>
                </div>
                <div className="search-box">
                  <Search size={15} />
                  <input
                    aria-label="Search scenarios"
                    placeholder="Find a scenario…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="inbox-filters">
                  <button
                    className={filter === "all" ? "selected" : ""}
                    onClick={() => setFilter("all")}
                  >
                    All scenarios
                  </button>
                  <button
                    className={filter === "failed" ? "selected" : ""}
                    disabled={!run}
                    onClick={() => setFilter("failed")}
                  >
                    Baseline failures{run ? ` · ${run.baseline.failed}` : ""}
                  </button>
                </div>
                <div className="scenario-list">
                  {!visible.length && (
                    <div className="empty-inbox">
                      <Search size={22} />
                      <strong>No matching scenarios</strong>
                      <span>Try a different search.</span>
                    </div>
                  )}
                  {visible.map((f, i) => {
                    const r = report?.results.find((r) => r.fixtureId === f.id);
                    return (
                      <button
                        key={f.id}
                        className={`scenario-item ${selected === f.id ? "selected" : ""}`}
                        aria-pressed={selected === f.id}
                        onClick={() => choose(f.id)}
                      >
                        <div
                          className={`scenario-state ${!r ? "pending" : r.passed ? "passed" : "failed"}`}
                        >
                          {!r ? (
                            <span>
                              {String(
                                data.fixtures.findIndex(
                                  (item) => item.id === f.id,
                                ) + 1,
                              ).padStart(2, "0")}
                            </span>
                          ) : r.passed ? (
                            <Check size={13} />
                          ) : (
                            <CircleAlert size={13} />
                          )}
                        </div>
                        <div>
                          <span>{f.category}</span>
                          <strong>{f.name}</strong>
                          <small>
                            {r
                              ? r.passed
                                ? "Expected behavior verified"
                                : "Expected behavior not met"
                              : "Ready to execute"}
                          </small>
                        </div>
                        <ChevronRight size={13} />
                      </button>
                    );
                  })}
                </div>
                <div className="inbox-foot">
                  <FlaskConical size={14} />
                  Real execution. Fictional business data.
                </div>
              </aside>
              <section className="case-panel lab-inspector">
                <div className="lab-inspector-header">
                  <div className="eyebrow">
                    {tab === "history"
                      ? "SAVED EXPERIMENTS"
                      : "SCENARIO INSPECTOR"}
                  </div>
                  {run && (
                    <button className="text-button" onClick={exportRun}>
                      <ArrowDown size={14} />
                      Export run
                    </button>
                  )}
                </div>
                {tab !== "history" && (
                  <>
                    <div className="lab-case-title">
                      <span className="lab-category">{fixture?.category}</span>
                      <h2>{fixture?.name}</h2>
                      <p>{fixture?.description}</p>
                      <div className="lab-case-meta">
                        <span
                          className={`badge ${!result ? "received" : result.passed ? "ready" : "review"}`}
                        >
                          {!result
                            ? "Not run yet"
                            : result.passed
                              ? "Expectation met"
                              : "Reproducible failure"}
                        </span>
                        {result && (
                          <span>
                            {outcomeLabel[result.outcome]} ·{" "}
                            {result.elapsedMs.toFixed(2)} ms
                          </span>
                        )}
                      </div>
                    </div>
                    {run && (
                      <div className="lab-view-toggle">
                        <span>Inspect this execution</span>
                        <div>
                          <button
                            className={view === "baseline" ? "active" : ""}
                            onClick={() => setView("baseline")}
                          >
                            Baseline
                          </button>
                          <button
                            disabled={!run.verification}
                            className={view === "latest" ? "active" : ""}
                            onClick={() => setView("latest")}
                          >
                            {run.replay
                              ? "Approved replay"
                              : "Verified candidate"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <nav className="tabs" aria-label="Lab inspector views">
                  {[
                    { id: "diagnosis", label: "Diagnosis & repair" },
                    { id: "trace", label: "Execution trace" },
                    { id: "comparison", label: "Before & after" },
                    { id: "history", label: "History" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      className={tab === t.id ? "active" : ""}
                      aria-pressed={tab === t.id}
                      onClick={() => setTab(t.id as Tab)}
                    >
                      {t.label}
                    </button>
                  ))}
                </nav>
                <div className="tab-content">
                  {tab === "diagnosis" &&
                    (!run ? (
                      <div className="lab-empty">
                        <div className="empty-illustration">
                          <Inbox size={24} />
                          <span />
                          <Split size={24} />
                          <span />
                          <FileCheck2 size={24} />
                        </div>
                        <h3>
                          A working agent.
                          <br />
                          An intentionally broken connection.
                        </h3>
                        <p>
                          Run 15 executable scenarios. Inspect the failures,
                          verify a targeted field-mapping repair, and replay the
                          same inputs after approval.
                        </p>
                        <button
                          className="button dark"
                          disabled={!!busy}
                          onClick={() => void act("run")}
                        >
                          <Play size={15} />
                          Run the baseline suite
                        </button>
                        <div className="lab-boundary">
                          <ShieldCheck size={15} />
                          Mock mode. No API key. No live ERP writes.
                        </div>
                      </div>
                    ) : (
                      <>
                        {result && (
                          <div
                            className={`result-banner ${result.passed ? "good" : "warning"}`}
                          >
                            <span className="result-icon">
                              {result.passed ? (
                                <CheckCheck size={20} />
                              ) : (
                                <CircleAlert size={20} />
                              )}
                            </span>
                            <div>
                              <h3>
                                {result.passed
                                  ? "The expected behavior held."
                                  : "The intent is right. The adapter is wrong."}
                              </h3>
                              <p>
                                {result.passed
                                  ? `${outcomeLabel[result.outcome]}. ${result.writes} sandbox write(s), ${result.duplicateWrites} duplicate write(s).`
                                  : `HTTP ${result.response?.status ?? "—"}: ${result.response?.body.message ?? "Inspect the saved trace."}`}
                              </p>
                            </div>
                          </div>
                        )}
                        {result && !result.passed && (
                          <div className="lab-contract-diff">
                            <div>
                              <span>ADAPTER SENT</span>
                              <code>
                                quantity:{" "}
                                {result.analysis.intent?.lines[0]?.quantity}
                              </code>
                              <small>Legacy v1 mapping</small>
                            </div>
                            <ArrowRight size={19} />
                            <div>
                              <span>V2 CONTRACT REQUIRES</span>
                              <code>
                                order_qty:{" "}
                                {result.analysis.intent?.lines[0]?.quantity}
                              </code>
                              <small>Same unit: individual items</small>
                            </div>
                          </div>
                        )}
                        {run.repair ? (
                          <>
                            <div className="lab-section-title">
                              <h3>Evidence-backed repair</h3>
                              <span className="small-pill">
                                Rule-based diagnosis
                              </span>
                            </div>
                            <p className="lab-copy">{run.repair.explanation}</p>
                            <div className="lab-evidence">
                              {run.repair.evidence.map((e, i) => (
                                <div key={e.source}>
                                  <span>0{i + 1}</span>
                                  <div>
                                    <strong>{e.source}</strong>
                                    <p>{e.detail}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="lab-repair-card">
                              <div className="section-caption">
                                SCOPED ADAPTER CHANGE
                                <span className="small-pill">
                                  Review required
                                </span>
                              </div>
                              <h3>{run.repair.title}</h3>
                              <div className="lab-code-diff">
                                <div>
                                  <span>−</span>
                                  <code>{run.repair.before}</code>
                                </div>
                                <div>
                                  <span>+</span>
                                  <code>{run.repair.after}</code>
                                </div>
                              </div>
                              <p>{run.repair.scope}</p>
                              <small>
                                Artifact SHA-256 ·{" "}
                                {run.repair.digest.slice(0, 20)}…
                              </small>
                            </div>
                          </>
                        ) : (
                          <div className="lab-investigate">
                            <Sparkles size={18} />
                            <div>
                              <h3>
                                {result?.passed
                                  ? "Keep the controls in the picture."
                                  : "Collect the evidence. Propose one narrow fix."}
                              </h3>
                              <p>
                                {result?.passed
                                  ? "Passing safety cases are regression controls. The failed v2 cases determine the repair; all 15 must still pass verification."
                                  : "Compare the rejected request, current API contract, and successful control fixtures. No change is applied during diagnosis."}
                              </p>
                            </div>
                          </div>
                        )}
                        {step === "baseline" && (
                          <button
                            className="button dark lab-primary"
                            disabled={!!busy}
                            onClick={() => void act("diagnose")}
                          >
                            {busy ? (
                              <Loader2 className="spin" size={15} />
                            ) : (
                              <Sparkles size={15} />
                            )}
                            Diagnose integration failure
                            <ArrowRight size={15} />
                          </button>
                        )}
                        {step === "diagnosed" && (
                          <div className="lab-next-action">
                            <h3>A plausible repair is not proof.</h3>
                            <p>
                              Re-execute every saved fixture with the candidate
                              mapping. Approval stays blocked until the entire
                              suite passes.
                            </p>
                            <button
                              className="button dark"
                              disabled={!!busy}
                              onClick={() => void act("verify")}
                            >
                              {busy ? (
                                <Loader2 className="spin" size={15} />
                              ) : (
                                <FlaskConical size={15} />
                              )}
                              Verify repair · {run.snapshot.fixtures.length}{" "}
                              scenarios
                            </button>
                          </div>
                        )}
                        {run.verification && (
                          <div className="lab-verification">
                            <CheckCheck size={22} />
                            <div>
                              <h3>
                                Verification: {run.verification.passed}/
                                {run.verification.results.length} expectations
                                met
                              </h3>
                              <p>
                                {run.verification.failed} failures ·{" "}
                                {run.verification.unsafeWrites} unsafe writes ·{" "}
                                {run.verification.duplicateWrites} duplicate
                                writes
                              </p>
                            </div>
                            <button
                              className="text-button"
                              onClick={() => setTab("comparison")}
                            >
                              Compare
                              <ArrowRight size={13} />
                            </button>
                          </div>
                        )}
                        {step === "verified" && (
                          <div className="decision">
                            <label htmlFor="lab-note">
                              Engineer review note
                              <span>Required · at least 8 characters</span>
                            </label>
                            <textarea
                              id="lab-note"
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              maxLength={500}
                              placeholder="e.g. Confirmed quantity semantics, adapter scope, and every regression result."
                            />
                            <div className="decision-actions">
                              <span>
                                <ShieldCheck size={14} />
                                Approval authorizes sandbox replay only.
                              </span>
                              <button
                                className="button dark"
                                disabled={
                                  !!busy ||
                                  note.trim().length < 8 ||
                                  !!run.verification?.failed
                                }
                                onClick={() => void act("approve")}
                              >
                                <Check size={15} />
                                Approve repair
                              </button>
                            </div>
                          </div>
                        )}
                        {step === "approved" && (
                          <div className="lab-next-action">
                            <h3>Approved. Now reproduce the result.</h3>
                            <p>
                              The approved artifact is checked again, then
                              executed against the same saved inputs in fresh
                              mock ledgers.
                            </p>
                            <button
                              className="button dark"
                              disabled={!!busy}
                              onClick={() => void act("replay")}
                            >
                              {busy ? (
                                <Loader2 className="spin" size={15} />
                              ) : (
                                <RotateCcw size={15} />
                              )}
                              Replay approved repair
                            </button>
                          </div>
                        )}
                        {run.replay && (
                          <div className="lab-complete">
                            <CheckCheck size={25} />
                            <div>
                              <h3>Repair verified. Replay complete.</h3>
                              <p>
                                {run.replay.passed}/{run.replay.results.length}{" "}
                                expectations met in a new execution.{" "}
                                {run.baseline.failed - run.replay.failed}{" "}
                                integration failures resolved; safety controls
                                preserved.
                              </p>
                              <small>
                                Approved by local operator · {run.reviewNote}
                              </small>
                            </div>
                          </div>
                        )}
                        <div className="lab-boundary">
                          <ShieldCheck size={15} />
                          No live writes. No shared adapter changes. Each
                          fixture uses its own mock ledger.
                        </div>
                      </>
                    ))}
                  {tab === "trace" &&
                    (result ? (
                      <>
                        <div className="section-caption">
                          OBSERVABLE EVENTS · NOT HIDDEN MODEL REASONING
                          <span>{result.trace.length} events</span>
                        </div>
                        <div className="timeline lab-timeline">
                          {result.trace.map((e) => (
                            <details
                              className={`lab-trace-event ${e.status}`}
                              key={e.id}
                            >
                              <summary>
                                <span className="timeline-marker">
                                  {e.status === "passed" ? (
                                    <Check size={12} />
                                  ) : e.status === "failed" ? (
                                    <X size={12} />
                                  ) : (
                                    <CircleAlert size={12} />
                                  )}
                                </span>
                                <div>
                                  <strong>{e.label}</strong>
                                  <small>
                                    {e.stage} · +{e.elapsedMs.toFixed(2)} ms
                                  </small>
                                </div>
                                <ChevronRight size={13} />
                              </summary>
                              <pre>{JSON.stringify(e.evidence, null, 2)}</pre>
                            </details>
                          ))}
                        </div>
                        <div className="lab-boundary">
                          <Code2 size={15} />
                          Exact fixture snapshot and evidence included in the
                          exported run.
                        </div>
                      </>
                    ) : (
                      <Empty
                        title="Run the suite to see the trace."
                        text="Saved requests, policy checks, API responses, and reconciliation events appear here."
                      />
                    ))}
                  {tab === "comparison" &&
                    (run ? (
                      <>
                        <div className="lab-section-title">
                          <h3>Same inputs. A measured difference.</h3>
                          <span className="small-pill">
                            {run.snapshot.fixtures.length} scenarios
                          </span>
                        </div>
                        <div className="lab-score-comparison">
                          <Score
                            report={run.baseline}
                            label="BASELINE / LEGACY ADAPTER"
                          />
                          <ArrowRight size={20} />
                          <Score
                            report={run.replay ?? run.verification}
                            label={
                              run.replay
                                ? "APPROVED REPLAY"
                                : "VERIFIED CANDIDATE"
                            }
                          />
                        </div>
                        <div className="lab-results-table">
                          <table>
                            <thead>
                              <tr>
                                <th>Scenario</th>
                                <th>Expected outcome</th>
                                <th>Before</th>
                                <th>After</th>
                              </tr>
                            </thead>
                            <tbody>
                              {run.baseline.results.map((r) => {
                                const after = latest?.results.find(
                                  (item) => item.fixtureId === r.fixtureId,
                                );
                                return (
                                  <tr key={r.fixtureId}>
                                    <td>
                                      <button
                                        onClick={() => choose(r.fixtureId)}
                                      >
                                        {r.name}
                                      </button>
                                    </td>
                                    <td>
                                      {outcomeLabel[r.expectation.outcome]}
                                    </td>
                                    <td>
                                      <span
                                        className={`lab-verdict ${r.passed ? "pass" : "fail"}`}
                                      >
                                        {r.passed ? "Met" : "Failed"}
                                      </span>
                                    </td>
                                    <td>
                                      {run.verification ? (
                                        <span
                                          className={`lab-verdict ${after?.passed ? "pass" : "fail"}`}
                                        >
                                          {after?.passed ? "Met" : "Failed"}
                                        </span>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <p className="lab-copy">
                          A passing scenario means its expected outcome and
                          write count matched. A safe refusal can pass; these
                          results are not production accuracy or a calibrated
                          confidence score.
                        </p>
                        <div className="lab-run-manifest">
                          <span>
                            Input SHA-256{" "}
                            <code>
                              {run.snapshot.inputDigest.slice(0, 20)}…
                            </code>
                          </span>
                          <span>
                            Provider <code>deterministic-mock</code>
                          </span>
                          <span>
                            Baseline suite time{" "}
                            <code>{run.baseline.elapsedMs.toFixed(2)} ms</code>
                          </span>
                          <span>
                            Model API cost <code>$0 · no model call</code>
                          </span>
                        </div>
                      </>
                    ) : (
                      <Empty
                        title="First, measure a baseline."
                        text="Before-and-after results will come from executed scenarios, never illustrative counters."
                      />
                    ))}
                  {tab === "history" && (
                    <>
                      <div className="lab-section-title">
                        <h3>A record of every experiment.</h3>
                        <span className="small-pill">Local history</span>
                      </div>
                      {!data.history.length ? (
                        <Empty
                          title="Your first run starts here."
                          text="Run the suite to save fixtures, ERP snapshots, configuration, and observable events."
                        />
                      ) : (
                        <div className="lab-history">
                          {data.history.map((h, i) => (
                            <button
                              key={h.id}
                              className={run?.id === h.id ? "selected" : ""}
                              onClick={() => {
                                void load(h.id);
                                setTab("diagnosis");
                                setView("baseline");
                                setSelected("schema-drift");
                                setNote("");
                              }}
                            >
                              <div className="scenario-state passed">
                                <History size={15} />
                              </div>
                              <div>
                                <strong>
                                  Experiment {data.history.length - i}
                                </strong>
                                <small>
                                  {new Date(h.at).toLocaleString("en-GB", {
                                    timeZone: "Asia/Kolkata",
                                  })}{" "}
                                  IST
                                </small>
                              </div>
                              <span className="badge">
                                {h.stage} · {h.passed}/{h.total}
                              </span>
                              <ChevronRight size={14} />
                            </button>
                          ))}
                        </div>
                      )}
                      {run && (
                        <div className="lab-audit">
                          <div className="section-caption">
                            CURRENT RUN · DECISION HISTORY
                          </div>
                          {run.audit.map((a, i) => (
                            <div key={i}>
                              <strong>{a.event}</strong>
                              <p>{a.detail}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="lab-boundary">
                        <Clock3 size={15} />
                        Persisted locally. History is not authenticated or
                        tamper-proof.
                      </div>
                    </>
                  )}
                </div>
              </section>
            </div>
          )}
          <footer className="page-footer">
            <span>
              FAULTLINE · An independent engineering project by Akshay
            </span>
            <span>
              Developer-led repair today. Autonomous recovery is a future
              hypothesis.
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="simple-empty">
      <FlaskConical size={29} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Score({ report, label }: { report?: Report | null; label: string }) {
  return (
    <div className="lab-score">
      <span>{label}</span>
      <strong>
        {report ? `${report.passed}/${report.results.length}` : "—"}
      </strong>
      <p>expectations met</p>
      {report && (
        <div className="lab-score-bar">
          <span
            style={{
              width: `${(report.passed / report.results.length) * 100}%`,
            }}
          />
        </div>
      )}
      <small>
        {report
          ? `${report.failed} failed · ${report.unsafeWrites} unsafe writes`
          : "Run verification to measure"}
      </small>
    </div>
  );
}
