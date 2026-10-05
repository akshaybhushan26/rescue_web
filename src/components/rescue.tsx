"use client";
import { useEffect, useState, useRef } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  Download,
  FileCode2,
  FlaskConical,
  History,
  Inbox,
  Layers,
  Loader2,
  Mail,
  Play,
  Search,
  ShieldCheck,
  Workflow,
  Wrench,
  X,
  BookOpen,
} from "lucide-react";
import type { LabRun } from "@/lib/lab/types";
type State = {
  run: LabRun | null;
  history: {
    id: string;
    at: string;
    stage: string;
    passed: number;
    total: number;
  }[];
  fixtures: { id: string; name: string; description: string }[];
};
type Tab = "Overview" | "Evidence" | "Test results" | "Activity";
export default function Rescue() {
  const [showGuide, setShowGuide] = useState(false);
  const [data, setData] = useState<State | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [tab, setTab] = useState<Tab>("Overview"),
    [section, setSection] = useState("Incidents"),
    [selected, setSelected] = useState("schema-drift"),
    [query, setQuery] = useState(""),
    [note, setNote] = useState("");
  const run = data?.run,
    report = run?.replay ?? run?.verification ?? run?.baseline;
  const result = run?.baseline.results.find((r) => r.fixtureId === selected);
  async function load(id?: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/lab${id ? `?id=${id}` : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) throw Error("Could not load your workspace. Please retry.");
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function act(action: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/lab", {
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
      const next = await res.json();
      if (!res.ok) throw Error(next.error);
      setData(next);
      if (action === "run") {
        setNote("");
        setSelected("schema-drift");
        setTab("Overview");
        setSection("Incidents");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!run) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(run, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `integration-rescue-${run.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const action = !run
    ? "run"
    : (
        {
          baseline: "diagnose",
          diagnosed: "verify",
          verified: "approve",
          approved: "replay",
          replayed: "run",
        } as const
      )[run.stage];
  const actionLabel = {
    run: "Run demo",
    diagnose: "Diagnose failure",
    verify: "Test proposed repair",
    approve: "Approve repair",
    replay: "Replay approved repair",
  }[action];
  const incidents =
    run?.baseline.results
      .filter((r) => r.fault !== "healthy")
      .filter((r) =>
        `${r.name} ${r.fault}`.toLowerCase().includes(query.toLowerCase()),
      ) ?? [];
  return (
    <div className="rescue">
      {showGuide && (
        <DemoGuide
          close={() => setShowGuide(false)}
          start={() => {
            setShowGuide(false);
            void act("run");
          }}
          busy={busy || !data}
        />
      )}
      <aside className="rs-sidebar">
        <a href="/" className="rs-brand">
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
          <Layers size={14} />
        </div>
        <div className="rs-nav-label">WORKSPACE</div>
        <nav>
          {[
            { name: "Incidents", icon: Activity },
            { name: "Test suite", icon: FlaskConical },
            { name: "Run history", icon: History },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={section === name ? "active" : ""}
              onClick={() => setSection(name)}
            >
              <Icon size={17} />
              {name}
              {name === "Incidents" && run && (
                <span>
                  {run.replay ? run.replay.failed : run.baseline.failed}
                </span>
              )}
            </button>
          ))}
          <a href="/order-desk">
            <Inbox size={17} />
            Order desk
            <ArrowUpRight size={14} />
          </a>
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
        <header className="rs-topbar">
          <span>
            Workspace <ChevronRight size={13} /> <b>{section}</b>
          </span>
          <span className="rs-environment">
            <i /> Sandbox <span className="rs-divider">/</span> Mock ERP
          </span>
        </header>
        <main className="rs-content">
          <div className="rs-heading">
            <div>
              <h1>
                {section === "Incidents"
                  ? "Integration recovery"
                  : section === "Test suite"
                    ? "Test suite"
                    : "Run history"}
              </h1>
              <p>
                From a failed request to a verified repair. Every decision, in
                view.
              </p>
            </div>
            <div className="rs-heading-actions">
              <button
                className="rs-button rs-guide-button"
                onClick={() => setShowGuide(true)}
              >
                <BookOpen size={15} />
                Demo guide
              </button>
              <button
                className="rs-button primary"
                disabled={busy || !data}
                onClick={() => void act("run")}
              >
                {busy ? (
                  <Loader2 className="rs-spin" size={15} />
                ) : (
                  <Play size={15} />
                )}
                New demo run
              </button>
            </div>
          </div>
          {error && (
            <div className="rs-error" role="alert">
              {error}
              <button onClick={() => void load()}>Refresh workspace</button>
            </div>
          )}
          {run && (
            <div className="rs-run-summary" aria-label="Run summary">
              <span>
                <i />{" "}
                {run.replay
                  ? "Replay complete"
                  : run.stage === "baseline"
                    ? "Baseline recorded"
                    : "Recovery in progress"}
              </span>
              <span>
                <strong>
                  {report?.passed}/{report?.results.length}
                </strong>{" "}
                tests passed
              </span>
              <span>
                <ShieldCheck size={14} />
                {report?.unsafeWrites} unsafe writes
              </span>
              <button onClick={() => setSection("Test suite")}>
                View results
                <ArrowRight size={13} />
              </button>
            </div>
          )}
          {!data ? (
            <div className="rs-empty">
              <Loader2 className="rs-spin" />
              <h2>Loading workspace</h2>
            </div>
          ) : !run ? (
            <div className="rs-welcome">
              <div className="rs-welcome-icon">
                <Workflow size={34} />
              </div>
              <span className="rs-eyebrow">FROM FAILURE TO RECOVERY</span>
              <h2>
                A broken integration.
                <br />A clear path forward.
              </h2>
              <p>
                Follow an order from email to ERP. Reproduce a schema change,
                inspect the evidence, and test a repair against{" "}
                {data.fixtures.length} real sandbox scenarios.
              </p>
              <div className="rs-journey">
                <span>
                  <Mail size={18} />
                  Email received
                </span>
                <ArrowRight size={16} />
                <span>
                  <Layers size={18} />
                  Order extracted
                </span>
                <ArrowRight size={16} />
                <span className="rs-red">
                  <CircleAlert size={18} />
                  ERP rejected
                </span>
              </div>
              <button
                className="rs-button primary"
                disabled={busy}
                onClick={() => void act("run")}
              >
                <Play size={15} />
                Run demo
              </button>
              <small>
                Local sandbox · Rule-based diagnosis · No credentials needed
              </small>
            </div>
          ) : section === "Run history" ? (
            <section className="rs-panel">
              <div className="rs-panel-heading">
                <h2>Recovery runs</h2>
                <span>{data.history.length} saved locally</span>
              </div>
              {data.history.map((h) => (
                <button
                  className="rs-history-row"
                  disabled={busy}
                  key={h.id}
                  onClick={() => {
                    void load(h.id);
                    setSection("Incidents");
                    setNote("");
                  }}
                >
                  <History size={18} />
                  <div>
                    <strong>Run {h.id.slice(0, 8)}</strong>
                    <small>{new Date(h.at).toLocaleString()}</small>
                  </div>
                  <span>{h.stage}</span>
                  <b>
                    {h.passed}/{h.total}
                  </b>
                  <ChevronRight size={16} />
                </button>
              ))}
            </section>
          ) : section === "Test suite" ? (
            <section className="rs-panel">
              <div className="rs-panel-heading">
                <h2>Regression suite</h2>
                <span>Same inputs. Fresh ledgers.</span>
              </div>
              <Results run={run} />
            </section>
          ) : (
            <div className="rs-workbench">
              <section className="rs-incident-list">
                <div className="rs-list-title">
                  <h2>Integration signals</h2>
                  <span>{incidents.length}</span>
                </div>
                <label className="rs-search">
                  <Search size={15} />
                  <input
                    aria-label="Search signals"
                    placeholder="Search signals…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div className="rs-list-caption">CURRENT RUN</div>
                {incidents.map((r) => (
                  <button
                    key={r.fixtureId}
                    className={`rs-incident ${selected === r.fixtureId ? "selected" : ""}`}
                    onClick={() => {
                      setSelected(r.fixtureId);
                      setTab("Overview");
                    }}
                  >
                    <span
                      className={`rs-signal-icon ${r.outcome === "manual" ? "amber" : r.passed || (run.replay && r.fault === "schema-v2") ? "green" : ""}`}
                    >
                      {(r.passed && r.outcome !== "manual") ||
                      (run.replay && r.fault === "schema-v2") ? (
                        <Check size={15} />
                      ) : (
                        <CircleAlert size={15} />
                      )}
                    </span>
                    <div>
                      <strong>{r.name}</strong>
                      <small>
                        Mock ERP ·{" "}
                        {r.fault === "schema-v2"
                          ? "Schema mismatch"
                          : r.outcome === "manual"
                            ? "Operator required"
                            : "Recovery control"}
                      </small>
                      <span className="rs-incident-tag">
                        {r.fault === "schema-v2" && run.replay
                          ? "Resolved"
                          : r.outcome === "failed"
                            ? "Needs repair"
                            : r.outcome === "manual"
                              ? "Manual review"
                              : "Verified behavior"}
                      </span>
                    </div>
                    <ChevronRight size={14} />
                  </button>
                ))}
                {!incidents.length && (
                  <p className="rs-no-results">No matching signals.</p>
                )}
                <div className="rs-list-footer">
                  <i />
                  Evidence from executed scenarios
                </div>
              </section>
              <section className="rs-detail">
                <div className="rs-detail-heading">
                  <div className="rs-detail-kicker">
                    <span>MOCK ERP</span>
                    <span>INC / {selected}</span>
                  </div>
                  <h2>{result?.name ?? "Select a signal"}</h2>
                  <p>
                    {data.fixtures.find((f) => f.id === selected)?.description}
                  </p>
                  <div className="rs-detail-meta">
                    <span
                      className={`rs-badge ${result?.outcome === "manual" ? "amber" : (run.replay && result?.fault === "schema-v2") || result?.passed ? "green" : ""}`}
                    >
                      {run.replay && result?.fault === "schema-v2"
                        ? "Recovered"
                        : result?.outcome === "manual"
                          ? "Manual intervention"
                          : result?.passed
                            ? "Control passed"
                            : "Investigation"}
                    </span>
                    <span>Email → Order agent → ERP</span>
                  </div>
                </div>
                <div className="rs-tabs" role="tablist">
                  {(
                    [
                      "Overview",
                      "Evidence",
                      "Test results",
                      "Activity",
                    ] as Tab[]
                  ).map((t) => (
                    <button
                      role="tab"
                      aria-selected={tab === t}
                      key={t}
                      onClick={() => setTab(t)}
                    >
                      {t}
                    </button>
                  ))}
                  <button
                    className="rs-export"
                    aria-label="Export run"
                    title="Export run as JSON"
                    onClick={download}
                  >
                    <Download size={16} />
                  </button>
                </div>
                <div className="rs-tab-content">
                  {tab === "Overview" && (
                    <>
                      <div className="rs-flow">
                        {[
                          "Detect",
                          "Diagnose",
                          "Verify",
                          "Approve",
                          "Replay",
                        ].map((s, i) => {
                          const index = [
                            "baseline",
                            "diagnosed",
                            "verified",
                            "approved",
                            "replayed",
                          ].indexOf(run.stage);
                          return (
                            <div className={i <= index ? "done" : ""} key={s}>
                              <span>
                                {i <= index ? <Check size={12} /> : i + 1}
                              </span>
                              {s}
                              {i < 4 && <div />}
                            </div>
                          );
                        })}
                      </div>
                      {result?.fault !== "schema-v2" ? (
                        <div className="rs-explanation">
                          <span className="rs-eyebrow">
                            {result?.outcome === "manual"
                              ? "OPERATOR ACTION REQUIRED"
                              : "RECOVERY CONTROL"}
                          </span>
                          <h3>
                            {result?.outcome === "manual"
                              ? "A mapping change cannot resolve this signal."
                              : "The expected behavior is preserved."}
                          </h3>
                          <p>
                            {result?.fault === "unauthorized"
                              ? "The credential has expired. Renew access with the integration owner before resuming orders."
                              : result?.fault === "outage"
                                ? "The endpoint is unavailable. Restore service and verify availability before retrying."
                                : result?.fault === "unit-change"
                                  ? "The new field represents cases of 12, not individual items. A field rename would change quantities; a verified conversion is required."
                                  : "The sandbox checks the stored receipt before retrying, preserving the original order without an additional write."}
                          </p>
                          <button
                            className="rs-button"
                            onClick={() => setTab("Evidence")}
                          >
                            Inspect execution evidence
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="rs-explanation">
                            <span className="rs-eyebrow">
                              {run.repair
                                ? "ROOT CAUSE IDENTIFIED"
                                : "FAILURE DETECTED"}
                            </span>
                            <h3>
                              {run.repair
                                ? "The order is right. The field mapping isn’t."
                                : "The ERP rejected the order payload."}
                            </h3>
                            <p>
                              {run.repair
                                ? run.repair.explanation
                                : "The v2 API rejected the outgoing request. Compare the failed payload with the current contract and historical orders to find a supported repair."}
                            </p>
                          </div>
                          {run.stage === "verified" && (
                            <label className="rs-review">
                              Review note
                              <textarea
                                placeholder="Explain what you reviewed before approving this repair…"
                                value={note}
                                maxLength={500}
                                onChange={(e) => setNote(e.target.value)}
                              />
                              <small>
                                At least 8 characters. Approval applies only to
                                sandbox replay.
                              </small>
                            </label>
                          )}
                          {run.replay ? (
                            <div className="rs-recovered">
                              <Check size={18} />
                              <div>
                                <strong>
                                  Integration recovered in the sandbox.
                                </strong>
                                <p>
                                  {run.replay.passed}/
                                  {run.replay.results.length} scenarios passed
                                  in approved replay. Review: {run.reviewNote}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="rs-action">
                              <div>
                                <strong>
                                  {run.stage === "baseline"
                                    ? "Start with the evidence."
                                    : run.stage === "diagnosed"
                                      ? "A proposed fix needs proof."
                                      : run.stage === "verified"
                                        ? "Ready for your review."
                                        : "Approved and ready to replay."}
                                </strong>
                                <p>
                                  {run.stage === "diagnosed"
                                    ? "Replay every saved scenario with the candidate mapping."
                                    : "Every step is recorded in the activity log."}
                                </p>
                              </div>
                              <button
                                className="rs-button primary"
                                disabled={
                                  busy ||
                                  (action === "approve" &&
                                    (note.trim().length < 8 ||
                                      !!run.verification?.failed))
                                }
                                onClick={() => void act(action)}
                              >
                                {busy ? (
                                  <Loader2 size={15} className="rs-spin" />
                                ) : null}
                                {actionLabel}
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          )}
                          <details className="rs-repair-disclosure">
                            <summary>
                              <FileCode2 size={15} />
                              {run.repair
                                ? "Review the mapping change"
                                : "Inspect the rejected mapping"}
                              <ChevronRight size={14} />
                            </summary>{" "}
                            <div className="rs-code-card">
                              <div>
                                <FileCode2 size={15} />
                                {run.repair
                                  ? "Proposed adapter change"
                                  : "Rejected field mapping"}
                                <span>ERP v2</span>
                              </div>
                              <pre>
                                <span className="rs-code-comment">
                                  // lines[] · quantity in individual items
                                </span>
                                {"\n"}
                                <span className="rs-code-removed">
                                  − quantity: intent.quantity
                                </span>
                                {run.repair && (
                                  <>
                                    {"\n"}
                                    <span className="rs-code-added">
                                      + order_qty: intent.quantity
                                    </span>
                                  </>
                                )}
                              </pre>
                              <footer>
                                <ShieldCheck size={13} />
                                Scoped to the v2 adapter · Quantity semantics
                                preserved
                              </footer>
                            </div>
                          </details>
                          {run.verification && !run.replay && (
                            <div className="rs-success">
                              <ShieldCheck size={20} />
                              <div>
                                <strong>
                                  {run.verification.passed}/
                                  {run.verification.results.length} regression
                                  tests passed
                                </strong>
                                <p>
                                  {run.verification.unsafeWrites} unsafe writes
                                  · {run.verification.duplicateWrites} duplicate
                                  writes
                                </p>
                              </div>
                              <button onClick={() => setTab("Test results")}>
                                View results
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                      <div className="rs-safety-note">
                        <ShieldCheck size={14} />
                        Sandbox only. Rule-based diagnosis; no live integration
                        changes.
                      </div>
                    </>
                  )}
                  {tab === "Evidence" && (
                    <div className="rs-evidence">
                      <h3>Execution evidence</h3>
                      <p>
                        Recorded requests, responses, and policy checks for this
                        signal.
                      </p>
                      {run.repair && (
                        <div className="rs-evidence-summary">
                          <span>
                            SUPPORTED BY {run.repair.evidence.length} SOURCES
                          </span>
                          {run.repair.evidence.map((e) => (
                            <details key={e.source}>
                              <summary>
                                <Check size={14} />
                                {e.source}
                                <ChevronRight size={13} />
                              </summary>
                              <p>{e.detail}</p>
                            </details>
                          ))}
                        </div>
                      )}
                      {result?.trace.map((e, i) => (
                        <details key={e.id}>
                          <summary>
                            <span
                              className={e.status === "failed" ? "rs-red" : ""}
                            >
                              {e.status === "passed" ? (
                                <Check size={15} />
                              ) : (
                                <CircleAlert size={15} />
                              )}
                            </span>
                            <div>
                              <strong>{e.label}</strong>
                              <small>
                                {e.stage} · {e.elapsedMs.toFixed(2)} ms
                              </small>
                            </div>
                            <ChevronRight size={14} />
                          </summary>
                          <pre>{JSON.stringify(e.evidence, null, 2)}</pre>
                        </details>
                      ))}
                    </div>
                  )}
                  {tab === "Test results" && <Results run={run} />}{" "}
                  {tab === "Activity" && (
                    <div className="rs-audit">
                      <h3>Decision history</h3>
                      {run.audit.map((a, i) => (
                        <div key={i}>
                          <span>
                            <Check size={13} />
                          </span>
                          <section>
                            <strong>{a.event}</strong>
                            <p>{a.detail}</p>
                            <small>{new Date(a.at).toLocaleTimeString()}</small>
                          </section>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
          <footer className="rs-footer">
            <span>
              Integration Rescue <span> / </span> Built by Akshay
            </span>
            <span>Developer-led recovery, one verified step at a time.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Results({ run }: { run: LabRun }) {
  const latest = run.replay ?? run.verification;
  return (
    <div className="rs-results">
      <div className="rs-comparison">
        <div>
          <small>BEFORE REPAIR</small>
          <strong>
            {run.baseline.passed}
            <span>/{run.baseline.results.length}</span>
          </strong>
        </div>
        <ArrowRight size={22} />
        <div>
          <small>{run.replay ? "APPROVED REPLAY" : "AFTER VERIFICATION"}</small>
          <strong className="rs-green">
            {latest ? latest.passed : "—"}
            <span>/{run.baseline.results.length}</span>
          </strong>
        </div>
      </div>
      <p>
        A pass means the expected outcome, quantities, and write count matched.
        Safe refusals pass too.
      </p>
      <div className="rs-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {run.baseline.results.map((r) => (
              <tr key={r.fixtureId}>
                <td>
                  {r.name}
                  <small>{r.category}</small>
                </td>
                <td className={r.passed ? "rs-green" : "rs-red"}>
                  {r.passed ? "Passed" : "Failed"}
                </td>
                <td
                  className={
                    latest
                      ? latest.results.find((a) => a.fixtureId === r.fixtureId)
                          ?.passed
                        ? "rs-green"
                        : "rs-red"
                      : ""
                  }
                >
                  {latest
                    ? latest.results.find((a) => a.fixtureId === r.fixtureId)
                        ?.passed
                      ? "Passed"
                      : "Failed"
                    : "Not run"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DemoGuide({
  close,
  start,
  busy,
}: {
  close: () => void;
  start: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="rs-guide"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      aria-labelledby="guide-title"
    >
      <div className="rs-guide-inner">
        <button
          className="rs-close"
          aria-label="Close demo guide"
          onClick={close}
        >
          <X size={19} />
        </button>
        <div className="rs-guide-mark">
          <Workflow size={26} />
        </div>
        <span className="rs-eyebrow">THE TWO-MINUTE WALKTHROUGH</span>
        <h2 id="guide-title">
          See a broken integration
          <br />
          find its way back.
        </h2>
        <p>
          An ERP changes its order schema. The agent still understands the
          order, but the connection fails. Here’s how Rescue helps an engineer
          recover.
        </p>
        <ol>
          {[
            {
              title: "Reproduce the failure",
              text: "Run 15 sandbox scenarios. Two requests fail against the new API contract.",
            },
            {
              title: "Review an evidence-backed repair",
              text: "Inspect the rejected payload, contract, and historical behavior behind the mapping change.",
            },
            {
              title: "Test, approve, and replay",
              text: "Verify all 15 scenarios, add your review note, and replay the approved repair.",
            },
          ].map((s, i) => (
            <li key={s.title}>
              <span>{i + 1}</span>
              <div>
                <strong>{s.title}</strong>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="rs-guide-note">
          <ShieldCheck size={17} />
          <span>
            Working sandbox · Rule-based diagnosis
            <br />
            No production credentials or live writes
          </span>
        </div>
        <button className="rs-button primary" disabled={busy} onClick={start}>
          <Play size={15} />
          Start a fresh demo
          <ArrowRight size={15} />
        </button>
      </div>
    </dialog>
  );
}
