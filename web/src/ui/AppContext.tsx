import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { pharosAtlantic, type Task } from "../chain";
import { useEscrowWrites, useTasks, type TxToast } from "../hooks";

type AppCtx = {
  address: Address | undefined;
  chainOk: boolean;
  openConnect: () => void;
  tasks: Task[] | null;
  tasksError: string | null;
  reload: () => void;
  notify: (t: Omit<TxToast, "id">) => void;
  toasts: TxToast[];
  write: (label: string, fn: string, args: unknown[], value?: bigint) => Promise<void>;
  busy: string | null;
};

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { address, chainId, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { tasks, error: tasksError, reload } = useTasks();
  const [toasts, setToasts] = useState<TxToast[]>([]);
  const toastId = useRef(0);

  const chainOk = !isConnected || chainId === pharosAtlantic.id;

  const openConnect = useCallback(() => {
    openConnectModal?.();
  }, [openConnectModal]);

  const notify = useCallback((t: Omit<TxToast, "id">) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.filter((p) => p.kind !== "pending"), { ...t, id }]);
    if (t.kind !== "pending") {
      setTimeout(() => setToasts((prev) => prev.filter((p) => p.id !== id)), 8000);
    }
  }, []);

  const { write, busy } = useEscrowWrites(address, notify, reload);

  return (
    <Ctx.Provider
      value={{
        address,
        chainOk,
        openConnect,
        tasks,
        tasksError,
        reload,
        notify,
        toasts,
        write,
        busy,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
