import { useCallback, useMemo, useRef, useState } from "react";
import { isAddress, parseEther, type Address } from "viem";
import {
  CONTRACT,
  EXPLORER,
  STATUS,
  ZERO,
  fmtPhrs,
  short,
  type Task,
} from "./chain";
import {
  fetchReputation,
  useEscrowWrites,
  useTasks,
  useWallet,
  type Rep,
  type TxToast,
} from "./hooks";

const STATUS_CLASS = ["open", "claimed", "submitted", "completed", "cancelled"];

export default function App() {
  const { address, connect, disconnect, connecting, chainOk } = useWallet();
  const { tasks, error, reload } = useTasks();
  const [toasts, setToasts] = useState<TxToast[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((t: Omit<TxToast, "id">) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.filter((p) => p.kind !== "pending"), { ...t, id }]);
    if (t.kind !== "pending") {
      setTimeout(() => setToasts((prev) => prev.filter((p) => p.id !== id)), 8000);
    }
  }, []);

  const { write, busy } = useEscrowWrites(address, notify, reload);

  const settled = useMemo(() => {
    if (!tasks) return null;
    const done = tasks.filter((t) => t.status === 3);
    const phrs = done.reduce((acc, _t) => acc, 0n); // bounty zeroed after payout; count only
    void phrs;
    return { total: tasks.length, completed: done.length };
  }, [tasks]);

  return (
    <>
      <a className="skip" href="#board">
        Skip to task board
      </a>
      <header className="top">
        <div className="top-inner">
          <a className="brand" href="/">
            <span className="brand-badge">
              <img src="/favicon.png" alt="" width="26" height="23" />
            </span>
            <span className="brand-name">AgentPay</span>
          </a>
          <nav className="top-right">
            <span className={`net ${chainOk ? "" : "net-wrong"}`}>
              <span className="net-dot" aria-hidden="true" />
              Pharos Atlantic
            </span>
            {address ? (
              <button className="btn ghost" onClick={disconnect} title={address}>
                {short(address)}
              </button>
            ) : (
              <button className="btn solid" onClick={() => connect().catch((e) => notify({ kind: "fail", text: e.message }))} disabled={connecting}>
                {connecting ? "Connecting…" : "Connect wallet"}
              </button>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <h1>
              Agents hire agents.
              <br />
              The lantern holds the bounty.
            </h1>
            <p>
              AgentPay is a task escrow on Pharos: a requester locks PHRS, a worker
              delivers, the contract settles and writes both reputations on-chain.
              No admin key, no custodian, no trust required.
            </p>
            {settled && (
              <p className="hero-proof">
                <strong>{settled.total}</strong> task{settled.total === 1 ? "" : "s"} posted ·{" "}
                <strong>{settled.completed}</strong> settled on{" "}
                <a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer">
                  the live contract
                </a>
              </p>
            )}
            <div className="hero-links">
              <a className="btn solid" href="#post">
                Post a task
              </a>
              <a
                className="btn ghost"
                href="https://github.com/gunksd/pharos-agentpay-skill"
                target="_blank"
                rel="noreferrer"
              >
                Read the skill on GitHub
              </a>
            </div>
          </div>
          <div className="hero-mascot" aria-hidden="true">
            <div className="moon">
              <img src="/logo-ink.png" alt="" />
            </div>
          </div>
        </section>

        <Board
          tasks={tasks}
          error={error}
          address={address}
          busy={busy}
          write={write}
        />

        <section className="panels">
          <PostPanel address={address} busy={busy} write={write} connect={connect} notify={notify} />
          <RepPanel />
        </section>
      </main>

      <footer>
        <div className="foot-inner">
          <span>
            contract{" "}
            <a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer" className="mono">
              {short(CONTRACT)}
            </a>{" "}
            · chain 688689
          </span>
          <span>
            <a href="https://github.com/gunksd/pharos-agentpay-skill" target="_blank" rel="noreferrer">
              GitHub
            </a>{" "}
            ·{" "}
            <a href="https://dorahacks.io/hackathon/pharos-phase1" target="_blank" rel="noreferrer">
              Pharos Skill Hackathon
            </a>
          </span>
        </div>
      </footer>

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span>{t.text}</span>
            {t.hash && (
              <a href={`${EXPLORER}/tx/${t.hash}`} target="_blank" rel="noreferrer">
                view tx
              </a>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ================= board ================= */

type WriteFn = (label: string, fn: string, args: unknown[], value?: bigint) => Promise<void>;

function Board({
  tasks,
  error,
  address,
  busy,
  write,
}: {
  tasks: Task[] | null;
  error: string | null;
  address: Address | null;
  busy: string | null;
  write: WriteFn;
}) {
  const [tab, setTab] = useState<"all" | "open" | "mine">("all");
  const me = address?.toLowerCase();

  const visible = useMemo(() => {
    if (!tasks) return [];
    if (tab === "open") return tasks.filter((t) => t.status === 0);
    if (tab === "mine")
      return tasks.filter(
        (t) =>
          me && (t.requester.toLowerCase() === me || t.worker.toLowerCase() === me),
      );
    return tasks;
  }, [tasks, tab, me]);

  return (
    <section id="board" className="board">
      <div className="board-head">
        <h2>Task board</h2>
        <div className="tabs" role="tablist" aria-label="Filter tasks">
          {(["all", "open", "mine"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              className={`tab ${tab === k ? "tab-on" : ""}`}
              onClick={() => setTab(k)}
            >
              {k === "all" ? "All" : k === "open" ? "Open" : "Mine"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="board-error">RPC unreachable: {error}. Retrying…</p>}

      {!tasks && !error && (
        <div className="rows" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div className="row skeleton" key={i} />
          ))}
        </div>
      )}

      {tasks && visible.length === 0 && (
        <p className="empty">
          {tab === "mine"
            ? address
              ? "No tasks involve this wallet yet. Claim one from the board, or post your own."
              : "Connect a wallet to see your tasks."
            : "No open tasks right now. Post the first bounty below."}
        </p>
      )}

      <div className="rows">
        {visible.map((t) => (
          <TaskRow key={String(t.id)} t={t} me={me} busy={busy} write={write} />
        ))}
      </div>
    </section>
  );
}

function TaskRow({
  t,
  me,
  busy,
  write,
}: {
  t: Task;
  me: string | undefined;
  busy: string | null;
  write: WriteFn;
}) {
  const [openDetail, setOpenDetail] = useState(false);
  const [result, setResult] = useState("");
  const [reason, setReason] = useState("");
  const now = Math.floor(Date.now() / 1000);

  const isRequester = me && t.requester.toLowerCase() === me;
  const isWorker = me && t.worker.toLowerCase() === me;
  const st = STATUS[t.status];

  const canClaim = st === "Open" && me && !isRequester && now <= Number(t.claimDeadline);
  const canCancel = st === "Open" && isRequester && now > Number(t.claimDeadline);
  const canSubmit = st === "Claimed" && isWorker;
  const canReview = st === "Submitted" && isRequester;
  const canForce =
    st === "Submitted" && isWorker && now >= Number(t.submittedAt) + Number(t.reviewWindow);

  const id = Number(t.id);

  return (
    <article className={`row ${openDetail ? "row-open" : ""}`}>
      <button
        className="row-main"
        onClick={() => setOpenDetail((v) => !v)}
        aria-expanded={openDetail}
      >
        <span className={`dot dot-${STATUS_CLASS[t.status]}`} aria-hidden="true" />
        <span className="row-id mono">#{id}</span>
        <span className="row-spec">{t.spec}</span>
        <span className="row-status">{st}</span>
        <span className="row-bounty mono">
          {t.status === 3 ? "paid" : `${fmtPhrs(t.bounty)} PHRS`}
        </span>
      </button>

      {openDetail && (
        <div className="row-detail">
          <dl>
            <div>
              <dt>Requester</dt>
              <dd className="mono">
                <a href={`${EXPLORER}/address/${t.requester}`} target="_blank" rel="noreferrer">
                  {short(t.requester)}
                </a>
                {isRequester ? " (you)" : ""}
              </dd>
            </div>
            <div>
              <dt>Worker</dt>
              <dd className="mono">
                {t.worker === ZERO ? (
                  "unclaimed"
                ) : (
                  <>
                    <a href={`${EXPLORER}/address/${t.worker}`} target="_blank" rel="noreferrer">
                      {short(t.worker)}
                    </a>
                    {isWorker ? " (you)" : ""}
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>Claimable until</dt>
              <dd>{new Date(Number(t.claimDeadline) * 1000).toLocaleString()}</dd>
            </div>
            {t.result && (
              <div className="span2">
                <dt>Result</dt>
                <dd className="mono result-ref">{t.result}</dd>
              </div>
            )}
          </dl>

          <div className="row-actions">
            {canClaim && (
              <button
                className="btn solid"
                disabled={busy !== null}
                onClick={() => write(`Claim #${id}`, "claimTask", [t.id])}
              >
                {busy === `Claim #${id}` ? "Claiming…" : "Claim task"}
              </button>
            )}
            {canSubmit && (
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (result.trim()) write(`Submit #${id}`, "submitResult", [t.id, result.trim()]);
                }}
              >
                <input
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  placeholder="Result reference: ipfs://… or URL"
                  aria-label="Result reference"
                  required
                />
                <button className="btn solid" disabled={busy !== null}>
                  {busy === `Submit #${id}` ? "Submitting…" : "Submit result"}
                </button>
              </form>
            )}
            {canReview && (
              <>
                <button
                  className="btn solid"
                  disabled={busy !== null}
                  onClick={() => write(`Approve #${id}`, "approveAndPay", [t.id])}
                >
                  {busy === `Approve #${id}` ? "Paying…" : "Approve & pay"}
                </button>
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (reason.trim())
                      write(`Reject #${id}`, "rejectSubmission", [t.id, reason.trim()]);
                  }}
                >
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Rejection reason"
                    aria-label="Rejection reason"
                    required
                  />
                  <button className="btn danger" disabled={busy !== null}>
                    Reject
                  </button>
                </form>
              </>
            )}
            {canForce && (
              <button
                className="btn solid"
                disabled={busy !== null}
                onClick={() => write(`Force-settle #${id}`, "forceSettle", [t.id])}
              >
                Force settle (review window passed)
              </button>
            )}
            {canCancel && (
              <button
                className="btn ghost"
                disabled={busy !== null}
                onClick={() => write(`Cancel #${id}`, "cancelTask", [t.id])}
              >
                Cancel & refund
              </button>
            )}
            {!me && st === "Open" && <span className="hint">Connect a wallet to claim this task.</span>}
          </div>
        </div>
      )}
    </article>
  );
}

/* ================= post panel ================= */

function PostPanel({
  address,
  busy,
  write,
  connect,
  notify,
}: {
  address: Address | null;
  busy: string | null;
  write: WriteFn;
  connect: () => Promise<void>;
  notify: (t: Omit<TxToast, "id">) => void;
}) {
  const [spec, setSpec] = useState("");
  const [bounty, setBounty] = useState("0.005");
  const [ttl, setTtl] = useState("86400");
  const [review, setReview] = useState("3600");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let wei: bigint;
    try {
      wei = parseEther(bounty as `${number}`);
    } catch {
      notify({ kind: "fail", text: "Bounty must be a number in PHRS." });
      return;
    }
    if (wei <= 0n) {
      notify({ kind: "fail", text: "Bounty must be greater than zero." });
      return;
    }
    write("Post task", "postTask", [spec.trim(), BigInt(ttl), BigInt(review)], wei);
  };

  return (
    <section id="post" className="panel">
      <h2>Post a task</h2>
      <p className="panel-sub">Lock a PHRS bounty the contract releases on approval.</p>
      <form onSubmit={submit}>
        <label>
          Task spec
          <textarea
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="What should the worker agent deliver?"
            rows={3}
            required
            maxLength={500}
          />
        </label>
        <div className="field-grid">
          <label>
            Bounty (PHRS)
            <input
              className="mono"
              value={bounty}
              onChange={(e) => setBounty(e.target.value)}
              inputMode="decimal"
              required
            />
          </label>
          <label>
            Claimable for
            <select value={ttl} onChange={(e) => setTtl(e.target.value)}>
              <option value="3600">1 hour</option>
              <option value="86400">24 hours</option>
              <option value="604800">7 days</option>
            </select>
          </label>
          <label>
            Review window
            <select value={review} onChange={(e) => setReview(e.target.value)}>
              <option value="60">1 minute</option>
              <option value="3600">1 hour</option>
              <option value="86400">24 hours</option>
            </select>
          </label>
        </div>
        {address ? (
          <button className="btn solid wide" disabled={busy !== null}>
            {busy === "Post task" ? "Posting…" : "Post task & lock bounty"}
          </button>
        ) : (
          <button
            type="button"
            className="btn solid wide"
            onClick={() => connect().catch((e) => notify({ kind: "fail", text: e.message }))}
          >
            Connect wallet to post
          </button>
        )}
      </form>
    </section>
  );
}

/* ================= reputation panel ================= */

function RepPanel() {
  const [addr, setAddr] = useState("");
  const [rep, setRep] = useState<Rep | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddress(addr)) {
      setState("error");
      setRep(null);
      return;
    }
    setState("loading");
    try {
      setRep(await fetchReputation(addr as Address));
      setState("idle");
    } catch {
      setState("error");
    }
  };

  const settledTotal = rep ? rep.tasksCompleted + rep.tasksPaid : 0;

  return (
    <section className="panel">
      <h2>Check an agent</h2>
      <p className="panel-sub">Trust score from settled tasks and disputes, read from the ledger.</p>
      <form onSubmit={lookup} className="inline-form">
        <input
          className="mono"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder="0x agent address"
          aria-label="Agent address"
          required
        />
        <button className="btn solid" disabled={state === "loading"}>
          {state === "loading" ? "Reading…" : "Look up"}
        </button>
      </form>
      {state === "error" && <p className="board-error">Enter a valid 0x address.</p>}
      {rep && (
        <div className="rep">
          <div
            className={`score ${settledTotal === 0 ? "score-unknown" : rep.trustScore >= 80 ? "score-good" : "score-warn"}`}
          >
            <span className="score-num">{settledTotal === 0 ? "—" : rep.trustScore}</span>
            <span className="score-label">{settledTotal === 0 ? "no history" : "trust score"}</span>
          </div>
          <dl className="rep-stats">
            <div>
              <dt>Completed as worker</dt>
              <dd className="mono">{rep.tasksCompleted}</dd>
            </div>
            <div>
              <dt>Paid out as requester</dt>
              <dd className="mono">{rep.tasksPaid}</dd>
            </div>
            <div>
              <dt>Tasks posted</dt>
              <dd className="mono">{rep.tasksPosted}</dd>
            </div>
            <div>
              <dt>Disputes</dt>
              <dd className="mono">{rep.disputes}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
