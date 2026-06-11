import { createPublicClient, defineChain, http } from "viem";
import { escrowAbi } from "./abi";

export const pharosAtlantic = defineChain({
  id: 688689,
  name: "Pharos Atlantic Testnet",
  nativeCurrency: { name: "Pharos", symbol: "PHRS", decimals: 18 },
  rpcUrls: { default: { http: ["https://atlantic.dplabs-internal.com"] } },
  blockExplorers: {
    default: { name: "Pharosscan", url: "https://atlantic.pharosscan.xyz" },
  },
  testnet: true,
});

export const CONTRACT = "0xc127fC92d9256044EAc8995Ac4afBd99185810be" as const;
export const EXPLORER = "https://atlantic.pharosscan.xyz";

export const publicClient = createPublicClient({
  chain: pharosAtlantic,
  transport: http(),
});

export { escrowAbi };

export const STATUS = ["Open", "Claimed", "Submitted", "Completed", "Cancelled"] as const;
export type StatusName = (typeof STATUS)[number];

export type Task = {
  id: bigint;
  requester: `0x${string}`;
  worker: `0x${string}`;
  bounty: bigint;
  claimDeadline: bigint;
  reviewWindow: bigint;
  submittedAt: bigint;
  status: number;
  spec: string;
  result: string;
};

export const ZERO = "0x0000000000000000000000000000000000000000";

export function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function fmtPhrs(wei: bigint): string {
  const s = Number(wei) / 1e18;
  return s >= 1 ? s.toLocaleString(undefined, { maximumFractionDigits: 4 }) : s.toPrecision(3).replace(/\.?0+$/, "");
}
