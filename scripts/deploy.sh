#!/usr/bin/env bash
# Deploy AgentPayEscrow to Pharos Atlantic and patch the address into the repo.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC="${AGENTPAY_RPC:-https://atlantic.dplabs-internal.com}"
PK="${AGENTPAY_DEPLOYER_KEY:?set AGENTPAY_DEPLOYER_KEY to the deployer private key}"

echo "Deploying AgentPayEscrow to $RPC ..."
OUT=$(forge create contracts/AgentPayEscrow.sol:AgentPayEscrow \
  --rpc-url "$RPC" --private-key "$PK" --broadcast --json)
ADDR=$(echo "$OUT" | python3 -c "import json,sys;print(json.load(sys.stdin)['deployedTo'])")
TX=$(echo "$OUT" | python3 -c "import json,sys;print(json.load(sys.stdin)['transactionHash'])")

echo "Contract: $ADDR"
echo "Tx:       $TX"

# Patch the canonical address into skill files
sed -i "s/__CONTRACT_ADDRESS__/$ADDR/g" SKILL.md scripts/agentpay.py 2>/dev/null || true
echo "{\"contract\": \"$ADDR\", \"deploy_tx\": \"$TX\", \"chain_id\": 688689, \"rpc\": \"$RPC\"}" > deployment.json
echo "Patched SKILL.md / scripts/agentpay.py, wrote deployment.json"
