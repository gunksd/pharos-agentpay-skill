import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  okxWallet,
  rabbyWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { pharosAtlantic } from "./chain";

/* WalletConnect cloud id: injected wallets (MetaMask / OKX / Rabby browser
   extensions) work without it; set a real one to enable mobile QR connect. */
const projectId =
  import.meta.env.VITE_WALLETCONNECT_ID ?? "agentpay-placeholder-project-id00";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: [injectedWallet, metaMaskWallet, okxWallet, rabbyWallet, walletConnectWallet],
    },
  ],
  { appName: "AgentPay", projectId },
);

export const wagmiConfig = createConfig({
  chains: [pharosAtlantic],
  connectors,
  transports: {
    [pharosAtlantic.id]: http(),
  },
});
