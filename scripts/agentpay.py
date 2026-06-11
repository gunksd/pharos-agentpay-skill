#!/usr/bin/env python3
"""AgentPay Skill — task escrow + reputation for AI agents on Pharos.

Usage:
  agentpay.py post --spec "translate doc" --bounty 0.01 [--claim-ttl 86400] [--review-window 3600]
  agentpay.py claim --task 1
  agentpay.py submit --task 1 --result "ipfs://Qm..."
  agentpay.py approve --task 1
  agentpay.py reject --task 1 --reason "wrong output"
  agentpay.py force-settle --task 1
  agentpay.py cancel --task 1
  agentpay.py status --task 1
  agentpay.py reputation --agent 0x...
  agentpay.py list-open

Env:
  AGENTPAY_PRIVATE_KEY  hex private key of the calling agent (required for writes)
  AGENTPAY_RPC          RPC url   (default: https://atlantic.dplabs-internal.com)
  AGENTPAY_CONTRACT     escrow contract address (default: official deployment)

Every command prints a single JSON object to stdout so agents can parse results.
"""

import argparse
import json
import os
import sys
from pathlib import Path

from web3 import Web3

DEFAULT_RPC = "https://atlantic.dplabs-internal.com"
DEFAULT_CONTRACT = os.environ.get(
    "AGENTPAY_CONTRACT", "__CONTRACT_ADDRESS__"
)
CHAIN_ID = 688689
STATUS_NAMES = ["Open", "Claimed", "Submitted", "Completed", "Cancelled"]

ABI_PATH = Path(__file__).resolve().parent.parent / "abi" / "AgentPayEscrow.json"


def die(msg: str, code: int = 1):
    print(json.dumps({"ok": False, "error": msg}))
    sys.exit(code)


def connect():
    rpc = os.environ.get("AGENTPAY_RPC", DEFAULT_RPC)
    w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={"timeout": 30}))
    if not w3.is_connected():
        die(f"cannot reach RPC {rpc}")
    abi = json.loads(ABI_PATH.read_text())
    contract = w3.eth.contract(address=Web3.to_checksum_address(DEFAULT_CONTRACT), abi=abi)
    return w3, contract


def get_account(w3):
    pk = os.environ.get("AGENTPAY_PRIVATE_KEY")
    if not pk:
        die("AGENTPAY_PRIVATE_KEY env var is required for this command")
    return w3.eth.account.from_key(pk)


def send_tx(w3, acct, fn, value=0):
    tx = fn.build_transaction(
        {
            "from": acct.address,
            "value": value,
            "nonce": w3.eth.get_transaction_count(acct.address),
            "gasPrice": w3.eth.gas_price,
            "chainId": CHAIN_ID,
        }
    )
    tx["gas"] = int(w3.eth.estimate_gas(tx) * 1.2)
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt.status != 1:
        die(f"transaction reverted: {tx_hash.hex()}")
    return receipt


def task_to_dict(t):
    return {
        "id": t[0],
        "requester": t[1],
        "worker": t[2],
        "bounty_wei": t[3],
        "bounty_phrs": float(Web3.from_wei(t[3], "ether")),
        "claim_deadline": t[4],
        "review_window": t[5],
        "submitted_at": t[6],
        "status": STATUS_NAMES[t[7]],
        "spec": t[8],
        "result": t[9],
    }


def main():
    p = argparse.ArgumentParser(description="AgentPay escrow skill")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("post", help="post a task with bounty")
    sp.add_argument("--spec", required=True)
    sp.add_argument("--bounty", required=True, type=float, help="bounty in PHRS")
    sp.add_argument("--claim-ttl", type=int, default=86400)
    sp.add_argument("--review-window", type=int, default=3600)

    for name in ("claim", "approve", "force-settle", "cancel", "status"):
        sp = sub.add_parser(name)
        sp.add_argument("--task", required=True, type=int)

    sp = sub.add_parser("submit")
    sp.add_argument("--task", required=True, type=int)
    sp.add_argument("--result", required=True)

    sp = sub.add_parser("reject")
    sp.add_argument("--task", required=True, type=int)
    sp.add_argument("--reason", required=True)

    sp = sub.add_parser("reputation")
    sp.add_argument("--agent", required=True)

    sub.add_parser("list-open", help="list open tasks")

    args = p.parse_args()
    w3, c = connect()

    if args.cmd == "post":
        acct = get_account(w3)
        value = Web3.to_wei(args.bounty, "ether")
        receipt = send_tx(
            w3, acct,
            c.functions.postTask(args.spec, args.claim_ttl, args.review_window),
            value=value,
        )
        logs = c.events.TaskPosted().process_receipt(receipt)
        task_id = logs[0]["args"]["id"] if logs else None
        print(json.dumps({
            "ok": True, "action": "post", "task_id": task_id,
            "bounty_phrs": args.bounty, "tx": receipt.transactionHash.hex(),
        }))

    elif args.cmd == "claim":
        acct = get_account(w3)
        receipt = send_tx(w3, acct, c.functions.claimTask(args.task))
        print(json.dumps({"ok": True, "action": "claim", "task_id": args.task,
                          "worker": acct.address, "tx": receipt.transactionHash.hex()}))

    elif args.cmd == "submit":
        acct = get_account(w3)
        receipt = send_tx(w3, acct, c.functions.submitResult(args.task, args.result))
        print(json.dumps({"ok": True, "action": "submit", "task_id": args.task,
                          "result": args.result, "tx": receipt.transactionHash.hex()}))

    elif args.cmd == "approve":
        acct = get_account(w3)
        receipt = send_tx(w3, acct, c.functions.approveAndPay(args.task))
        print(json.dumps({"ok": True, "action": "approve", "task_id": args.task,
                          "tx": receipt.transactionHash.hex()}))

    elif args.cmd == "reject":
        acct = get_account(w3)
        receipt = send_tx(w3, acct, c.functions.rejectSubmission(args.task, args.reason))
        print(json.dumps({"ok": True, "action": "reject", "task_id": args.task,
                          "tx": receipt.transactionHash.hex()}))

    elif args.cmd == "force-settle":
        acct = get_account(w3)
        receipt = send_tx(w3, acct, c.functions.forceSettle(args.task))
        print(json.dumps({"ok": True, "action": "force-settle", "task_id": args.task,
                          "tx": receipt.transactionHash.hex()}))

    elif args.cmd == "cancel":
        acct = get_account(w3)
        receipt = send_tx(w3, acct, c.functions.cancelTask(args.task))
        print(json.dumps({"ok": True, "action": "cancel", "task_id": args.task,
                          "tx": receipt.transactionHash.hex()}))

    elif args.cmd == "status":
        t = c.functions.getTask(args.task).call()
        if t[0] == 0:
            die(f"task {args.task} does not exist")
        print(json.dumps({"ok": True, "task": task_to_dict(t)}))

    elif args.cmd == "reputation":
        agent = Web3.to_checksum_address(args.agent)
        r = c.functions.getReputation(agent).call()
        score = c.functions.trustScore(agent).call()
        print(json.dumps({
            "ok": True, "agent": agent,
            "reputation": {
                "tasks_posted": r[0], "tasks_completed_as_worker": r[1],
                "tasks_paid_as_requester": r[2], "disputes": r[3],
                "trust_score": score,
            },
        }))

    elif args.cmd == "list-open":
        next_id = c.functions.nextTaskId().call()
        open_tasks = []
        for i in range(1, next_id):
            t = c.functions.getTask(i).call()
            if STATUS_NAMES[t[7]] == "Open":
                open_tasks.append(task_to_dict(t))
        print(json.dumps({"ok": True, "open_tasks": open_tasks, "count": len(open_tasks)}))


if __name__ == "__main__":
    main()
