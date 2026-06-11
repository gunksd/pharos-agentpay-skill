# AgentPay Escrow — Pharos Agent Skill

**Pay-per-task escrow + on-chain reputation for AI agents, on Pharos.**

Built for the [Pharos Skill-to-Agent Dual Cascade Hackathon](https://dorahacks.io/hackathon/pharos-phase1) (Phase 1: Skill).

## The problem

The Pharos vision is an economy where agents hire other agents. But two
autonomous agents that have never met have no reason to trust each other:
the requester won't pay first, the worker won't work first, and neither has
any way to know if the counterparty has a history of stiffing people.

## The skill

`agentpay-escrow` gives any AI agent three primitives, callable as plain
CLI commands with JSON output:

1. **Escrowed payments** — a requester locks a PHRS bounty in a contract;
   it can only ever flow to the worker (on approval or timeout) or back to
   the requester (if nobody claims). No admin key, no custodian.
2. **A full task lifecycle** — `post → claim → submit → approve/reject`,
   with `force-settle` protecting workers from silent requesters and
   `cancel` protecting requesters from ghost markets.
3. **On-chain reputation** — every settlement and every dispute writes to a
   public ledger; `trust_score` (0-100) lets an agent screen counterparties
   before doing business.

```
┌──────────────┐  post(bounty 🔒)  ┌──────────────────┐
│ Requester    │ ────────────────► │ AgentPayEscrow   │
│ Agent        │                   │ (Pharos chain)   │
└──────┬───────┘                   └────────▲─────────┘
       │ approve / reject                   │ claim / submit / force-settle
       ▼                                    │
   reputation++                    ┌────────┴─────────┐
   for both sides ◄───────────────│ Worker Agent      │
   on settlement                   └──────────────────┘
```

## Deployment (Pharos Atlantic Testnet)

| | |
|---|---|
| Live app | https://pharos-agentpay.vercel.app |
| Chain ID | 688689 |
| Contract | `0xc127fC92d9256044EAc8995Ac4afBd99185810be` (source verified) |
| Explorer | https://atlantic.pharosscan.xyz/address/0xc127fC92d9256044EAc8995Ac4afBd99185810be |
| RPC | `https://atlantic.dplabs-internal.com` |

## Quick start

```bash
pip install web3
export AGENTPAY_PRIVATE_KEY=0x...   # the agent's wallet (needs a little PHRS for gas)

# requester agent: lock 0.01 PHRS for a task
python scripts/agentpay.py post --spec "Summarize this URL into 5 bullets: https://..." --bounty 0.01

# worker agent: find, vet, claim, deliver
python scripts/agentpay.py list-open
python scripts/agentpay.py reputation --agent 0xRequester
python scripts/agentpay.py claim --task 1
python scripts/agentpay.py submit --task 1 --result "ipfs://QmResult"

# requester agent: release payment
python scripts/agentpay.py approve --task 1
```

Full agent-facing instructions live in [SKILL.md](SKILL.md) (standard Agent
Skill format — drop the folder into any SKILL.md-compatible runtime such as
Claude Code, OpenClaw, or Anvita Flow).

## Repository layout

```
SKILL.md                    agent-facing skill definition (the Skill)
contracts/AgentPayEscrow.sol  escrow + reputation contract (no dependencies)
scripts/agentpay.py         CLI wrapper, one JSON object per call
scripts/deploy.sh           one-shot deploy + address patching
abi/AgentPayEscrow.json     stable ABI for composers
test/AgentPayEscrow.t.sol   Foundry test suite (6 tests)
deployment.json             canonical deployment record
web/                        live dApp (Vite + React + viem), deployed on Vercel
demo/                       end-to-end demo transcript on Atlantic testnet
```

## Verify it yourself

```bash
forge test          # 6/6 unit tests
cat demo/e2e.md     # real tx hashes for a full post→claim→submit→approve cycle
```

## Design choices

- **Single-file contract, zero dependencies** — auditable in five minutes,
  trivially composable for Phase 2 agents.
- **JSON-only CLI output** — LLM agents parse results without scraping.
- **Worker and requester are both protected** — `force-settle` (timeout
  payout) and `cancel` (timeout refund) mean no party can hold funds hostage.
- **Reputation is earned, not asserted** — only settled tasks and disputes
  mutate the ledger, and only the contract can write it.

## License

MIT
