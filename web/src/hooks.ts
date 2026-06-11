import { useCallback, useEffect, useRef, useState } from "react";
import {
  createWalletClient,
  custom,
  type Address,
  type WalletClient,
} from "viem";
import { CONTRACT, escrowAbi, pharosAtlantic, publicClient, type Task } from "./chain";

declare global {
  interface Window {
    ethereum?: any;
  }
}

/* ---------- wallet ---------- */

export function useWallet() {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainOk, setChainOk] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const clientRef = useRef<WalletClient | null>(null);

  const refreshChain = useCallback(async () => {
    if (!window.ethereum) return;
    const idHex: string = await window.ethereum.request({ method: "eth_chainId" });
    setChainOk(parseInt(idHex, 16) === pharosAtlantic.id);
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("No wallet found. Install MetaMask or OKX Wallet, then reload.");
    }
    setConnecting(true);
    try {
      const accounts: string[] = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const client = createWalletClient({
        chain: pharosAtlantic,
        transport: custom(window.ethereum),
      });
      clientRef.current = client;
      setAddress(accounts[0] as Address);
      await ensureChain();
      await refreshChain();
    } finally {
      setConnecting(false);
    }
  }, [refreshChain]);

  const disconnect = useCallback(() => {
    setAddress(null);
    clientRef.current = null;
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accs: string[]) =>
      setAddress((accs[0] as Address) ?? null);
    const onChain = () => refreshChain();
    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccounts);
      window.ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [refreshChain]);

  return { address, connect, disconnect, connecting, chainOk, walletClient: clientRef };
}

async function ensureChain() {
  const hexId = `0x${pharosAtlantic.id.toString(16)}`;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexId }],
    });
  } catch (err: any) {
    if (err?.code === 4902 || /unrecognized|not added/i.test(String(err?.message))) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexId,
            chainName: pharosAtlantic.name,
            nativeCurrency: pharosAtlantic.nativeCurrency,
            rpcUrls: pharosAtlantic.rpcUrls.default.http,
            blockExplorerUrls: [pharosAtlantic.blockExplorers!.default.url],
          },
        ],
      });
    } else if (err?.code !== 4001) {
      throw err;
    }
  }
}

/* ---------- tasks ---------- */

export function useTasks(pollMs = 15000) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const nextId = (await publicClient.readContract({
        address: CONTRACT,
        abi: escrowAbi,
        functionName: "nextTaskId",
      })) as bigint;
      const ids = Array.from({ length: Number(nextId) - 1 }, (_, i) => BigInt(i + 1));
      const raw = await Promise.all(
        ids.map((id) =>
          publicClient.readContract({
            address: CONTRACT,
            abi: escrowAbi,
            functionName: "getTask",
            args: [id],
          }),
        ),
      );
      setTasks((raw as Task[]).slice().reverse());
      setError(null);
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? "RPC error");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);

  return { tasks, error, reload: load };
}

/* ---------- reputation ---------- */

export type Rep = {
  tasksPosted: number;
  tasksCompleted: number;
  tasksPaid: number;
  disputes: number;
  trustScore: number;
};

export async function fetchReputation(agent: Address): Promise<Rep> {
  const [r, score] = await Promise.all([
    publicClient.readContract({
      address: CONTRACT,
      abi: escrowAbi,
      functionName: "getReputation",
      args: [agent],
    }) as Promise<{ tasksPosted: number; tasksCompleted: number; tasksPaid: number; disputes: number }>,
    publicClient.readContract({
      address: CONTRACT,
      abi: escrowAbi,
      functionName: "trustScore",
      args: [agent],
    }) as Promise<bigint>,
  ]);
  return {
    tasksPosted: Number(r.tasksPosted),
    tasksCompleted: Number(r.tasksCompleted),
    tasksPaid: Number(r.tasksPaid),
    disputes: Number(r.disputes),
    trustScore: Number(score),
  };
}

/* ---------- contract writes ---------- */

export type TxToast = {
  id: number;
  kind: "pending" | "ok" | "fail";
  text: string;
  hash?: string;
};

export function useEscrowWrites(
  address: Address | null,
  notify: (t: Omit<TxToast, "id">) => void,
  reload: () => void,
) {
  const [busy, setBusy] = useState<string | null>(null);

  const write = useCallback(
    async (
      label: string,
      functionName: string,
      args: unknown[],
      value?: bigint,
    ) => {
      if (!address || !window.ethereum) {
        notify({ kind: "fail", text: "Connect a wallet first." });
        return;
      }
      setBusy(label);
      notify({ kind: "pending", text: `${label}: confirm in wallet…` });
      try {
        const client = createWalletClient({
          chain: pharosAtlantic,
          transport: custom(window.ethereum),
        });
        const { request } = await publicClient.simulateContract({
          account: address,
          address: CONTRACT,
          abi: escrowAbi,
          functionName: functionName as any,
          args: args as any,
          value,
        });
        const hash = await client.writeContract(request);
        notify({ kind: "pending", text: `${label}: waiting for confirmation…`, hash });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "success") {
          notify({ kind: "ok", text: `${label} confirmed`, hash });
        } else {
          notify({ kind: "fail", text: `${label} reverted`, hash });
        }
        reload();
      } catch (e: any) {
        const msg = e?.shortMessage ?? e?.message ?? "transaction failed";
        notify({ kind: "fail", text: `${label}: ${msg.slice(0, 120)}` });
      } finally {
        setBusy(null);
      }
    },
    [address, notify, reload],
  );

  return { write, busy };
}
