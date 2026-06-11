import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import "./index.css";
import { wagmiConfig } from "./wagmi";
import { pharosAtlantic } from "./chain";
import { AppProvider } from "./ui/AppContext";
import Layout from "./ui/Layout";

const Home = lazy(() => import("./pages/Home"));
const Board = lazy(() => import("./pages/Board"));
const Post = lazy(() => import("./pages/Post"));
const Agent = lazy(() => import("./pages/Agent"));
const Docs = lazy(() => import("./pages/Docs"));
const Skill = lazy(() => import("./pages/Skill"));

const queryClient = new QueryClient();

const rkTheme = darkTheme({
  accentColor: "#f0b35c",
  accentColorForeground: "#241a08",
  borderRadius: "medium",
  fontStack: "system",
});
rkTheme.colors.modalBackground = "#101722";
rkTheme.colors.connectButtonBackground = "#101722";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            theme={rkTheme}
            initialChain={pharosAtlantic}
            modalSize="compact"
            appInfo={{ appName: "AgentPay" }}
          >
            <AppProvider>
              <Suspense fallback={<div className="page-fallback" aria-hidden="true" />}>
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="board" element={<Board />} />
                    <Route path="post" element={<Post />} />
                    <Route path="agent" element={<Agent />} />
                    <Route path="docs" element={<Docs />} />
                    <Route path="skill" element={<Skill />} />
                  </Route>
                </Routes>
              </Suspense>
            </AppProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </BrowserRouter>
  </StrictMode>,
);
