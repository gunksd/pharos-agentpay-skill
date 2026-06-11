# AgentPay Escrow — DoraHacks BUIDL Submission

**Hackathon:** Pharos Skill-to-Agent Dual Cascade Hackathon — Phase 1 (Skill)
**GitHub:** https://github.com/gunksd/pharos-agentpay-skill
**Live dApp:** https://pharos-agentpay.vercel.app
**Network:** Pharos Atlantic Testnet (chain id 688689)
**Contract:** [`0xc127fC92d9256044EAc8995Ac4afBd99185810be`](https://atlantic.pharosscan.xyz/address/0xc127fC92d9256044EAc8995Ac4afBd99185810be) — source code verified on Pharosscan (SocialScan API, `Pass - Verified`)

## One-liner

Trust-minimized pay-per-task escrow + on-chain reputation, packaged as a
drop-in Agent Skill — the payment rail any two Pharos agents need before
they can do business with each other.

## Why this Skill

Pharos is built for an economy where agents hire other agents. That economy
has a bootstrap problem: two autonomous agents that have never met cannot
trust each other. The requester won't pay first; the worker won't work
first; neither can tell whether the counterparty has a history of stiffing
people. Every Phase 2 agent that wants to buy or sell work will hit this
wall on its first transaction.

`agentpay-escrow` solves it with three primitives:

1. **Escrowed bounties** — the requester locks PHRS in a contract with no
   admin key. Funds can only flow to the worker (approval or timeout) or
   back to the requester (unclaimed expiry). The contract is the only
   trusted party.
2. **A complete task lifecycle** — `post → claim → submit → approve/reject`,
   plus `force-settle` (worker gets paid if the requester goes silent past
   the review window) and `cancel` (requester refunded if nobody claims).
   Neither side can hold the other hostage.
3. **Earned, on-chain reputation** — settlements and disputes write to a
   public ledger only the contract can mutate. `trust_score` (0-100) lets
   any agent screen a counterparty in one call before committing work or
   funds.

## What was actually shipped and verified

- **Contract** (`contracts/AgentPayEscrow.sol`): single file, zero external
  dependencies, custom errors, events on every state transition, deployed
  and exercised on Atlantic.
- **Tests**: 6/6 Foundry tests covering the happy path, reject-and-reopen,
  force-settle timing, cancel refunds, access control, and zero-bounty
  rejection.
- **Skill packaging** (`SKILL.md` + `scripts/agentpay.py`): standard Agent
  Skill format (YAML frontmatter + agent-facing instructions + decision
  table), compatible with SKILL.md runtimes (Claude Code, OpenClaw, Anvita
  Flow). The CLI emits exactly one JSON object per call so LLM agents can
  parse results without scraping.
- **Live end-to-end proof** (`demo/e2e.md`): two independent agent wallets
  ran the full cycle on Atlantic — post (bounty locked) → list-open →
  claim → submit → approve. The bounty verifiably moved to the worker
  (+0.002 PHRS) and both sides' reputation updated on-chain. All five tx
  hashes with explorer links are in the demo transcript.

## Key transactions

| Step | Tx |
|---|---|
| Deploy | [`0x2860e7f0…fc68136`](https://atlantic.pharosscan.xyz/tx/0x2860e7f000234faf79bd69b99862ea850baefa88519a6f47d69843d95fc68136) |
| postTask (0.002 PHRS locked) | [`0x76e61fb2…aebaf8`](https://atlantic.pharosscan.xyz/tx/0x76e61fb2a8af78c74a0dede31b36e9936492fe61b0cf1718307a949be0aebaf8) |
| claimTask | [`0xc7bd22f4…e64c4e`](https://atlantic.pharosscan.xyz/tx/0xc7bd22f4a8800d43d7a2f1553f330f2e6aba1be34465244e8330f12595e64c4e) |
| submitResult | [`0xdeef2015…b68d6d15`](https://atlantic.pharosscan.xyz/tx/0xdeef2015b1cb4efcb6c4f2a349593ba439be1be28cdb83fc100eb180b68d6d15) |
| approveAndPay (bounty released) | [`0x9b556dfd…c4a08fb9c`](https://atlantic.pharosscan.xyz/tx/0x9b556dfd673afc851e85cdd13ce0a0af0f03ab330576492e4de6176c4a08fb9c) |

## Reusability & composability

- Any Phase 2 agent gets payments + counterparty screening by dropping the
  skill folder into its runtime — no code changes.
- The contract emits events for every transition: a dispute-arbitration
  skill can watch `SubmissionRejected`, a job-board can index `TaskPosted`,
  an analytics agent can score the whole market from `TaskCompleted`.
- Stable ABI shipped at `abi/AgentPayEscrow.json`; the reputation ledger is
  a free-standing public good any other skill can read.

## Repository layout

```
SKILL.md                      the Skill (agent-facing, standard format)
contracts/AgentPayEscrow.sol  escrow + reputation contract
scripts/agentpay.py           JSON-output CLI wrapper (10 commands)
scripts/deploy.sh             one-shot deploy script
abi/AgentPayEscrow.json       stable ABI for composers
test/AgentPayEscrow.t.sol     Foundry test suite
demo/e2e.md                   live on-chain demo transcript
deployment.json               canonical deployment record
web/                          live dApp frontend (Vite + React + viem)
```

## Phase 2 direction

This skill is the settlement layer for an **Agent Task Market**: a steward
agent that autonomously posts work it cannot do itself, screens bidders by
trust score, verifies submissions, and settles — turning the escrow + 
reputation primitives into a self-sustaining agent labor market on Pharos.
