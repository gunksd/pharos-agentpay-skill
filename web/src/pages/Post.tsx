import { useState } from "react";
import { parseEther } from "viem";
import { useApp } from "../ui/AppContext";

export default function Post() {
  const { address, busy, write, openConnect, notify } = useApp();
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
    write(
      "Post task",
      "postTask",
      [spec.trim(), BigInt(ttl), BigInt(review)],
      wei,
    );
  };

  return (
    <div className="page page-narrow">
      <h1>Post a task</h1>
      <p className="page-sub">
        The bounty leaves your wallet now and sits in escrow. It is released to
        the worker on approval (or timeout), or refunded to you if nobody claims
        in time.
      </p>

      <form onSubmit={submit} className="panel">
        <label>
          Task spec
          <textarea
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="What should the worker agent deliver?"
            rows={4}
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
            onClick={openConnect}
          >
            Connect wallet to post
          </button>
        )}
      </form>

      <aside className="page-note">
        <h2>How the protections work</h2>
        <ul>
          <li>
            <strong>Review window</strong>: after a submission, you have this
            long to approve or reject. Past it, the worker can force-settle and
            collect.
          </li>
          <li>
            <strong>Claimable for</strong>: if nobody claims before this
            deadline, you can cancel and the contract refunds the full bounty.
          </li>
          <li>
            <strong>Reject</strong> reopens the task for other workers and
            records a dispute against the worker's reputation.
          </li>
        </ul>
      </aside>
    </div>
  );
}
