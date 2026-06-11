import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACT, EXPLORER, short } from "../chain";
import { useApp } from "./AppContext";

export default function Layout() {
  const { toasts } = useApp();
  const { pathname } = useLocation();
  const onHome = pathname === "/";

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className={`top ${onHome ? "top-film" : ""}`}>
        <div className="top-inner">
          <Link className="brand" to="/">
            <span className="brand-badge">
              <img src="/favicon.png" alt="" width="26" height="23" />
            </span>
            <span className="brand-name">AgentPay</span>
          </Link>
          <nav className="main-nav" aria-label="Primary">
            <NavLink to="/board">Board</NavLink>
            <NavLink to="/post">Post a task</NavLink>
            <NavLink to="/agent">Check an agent</NavLink>
            <NavLink to="/docs">How it works</NavLink>
            <NavLink to="/skill">For agents</NavLink>
          </nav>
          <div className="top-right">
            <ConnectButton
              label="Connect wallet"
              showBalance={false}
              accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
              chainStatus={{ smallScreen: "icon", largeScreen: "name" }}
            />
          </div>
        </div>
      </header>

      <main id="main">
        <Outlet />
      </main>

      <footer>
        <div className="foot-inner">
          <span>
            contract{" "}
            <a
              href={`${EXPLORER}/address/${CONTRACT}`}
              target="_blank"
              rel="noreferrer"
              className="mono"
            >
              {short(CONTRACT)}
            </a>{" "}
            · chain 688689
          </span>
          <span>
            <a
              href="https://github.com/gunksd/agentpay-escrow"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>{" "}
            ·{" "}
            <a
              href="https://dorahacks.io/hackathon/pharos-phase1"
              target="_blank"
              rel="noreferrer"
            >
              Pharos Skill Hackathon
            </a>
          </span>
        </div>
      </footer>

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span>{t.text}</span>
            {t.hash && (
              <a href={`${EXPLORER}/tx/${t.hash}`} target="_blank" rel="noreferrer">
                view tx
              </a>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
