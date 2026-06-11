import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { useWalletClient } from "wagmi";
import { CONTRACT, escrowAbi, publicClient, type Task } from "./chain";

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
    }) as Promise<{
      tasksPosted: number;
      tasksCompleted: number;
      tasksPaid: number;
      disputes: number;
    }>,
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
  address: Address | undefined,
  notify: (t: Omit<TxToast, "id">) => void,
  reload: () => void,
) {
  const [busy, setBusy] = useState<string | null>(null);
  const { data: walletClient } = useWalletClient();

  const write = useCallback(
    async (label: string, functionName: string, args: unknown[], value?: bigint) => {
      if (!address || !walletClient) {
        notify({ kind: "fail", text: "Connect a wallet first." });
        return;
      }
      setBusy(label);
      notify({ kind: "pending", text: `${label}: confirm in wallet…` });
      try {
        const { request } = await publicClient.simulateContract({
          account: address,
          address: CONTRACT,
          abi: escrowAbi,
          functionName: functionName as any,
          args: args as any,
          value,
        });
        const hash = await walletClient.writeContract(request);
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
    [address, walletClient, notify, reload],
  );

  return { write, busy };
}
