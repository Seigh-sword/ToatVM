import { useState } from "react";
import BootForm from "./components/BootForm";
import Terminal from "./components/Terminal";
import "./App.css";

type View = "home" | "terminal";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [terminalUrl, setTerminalUrl] = useState("");
  const [sharePass, setSharePass] = useState<string | null>(null);

  const handleBoot = (data: { url: string; sharePass?: string | null }) => {
    setTerminalUrl(data.url);
    setSharePass(data.sharePass ?? null);
    setView("terminal");
  };

  const handleClose = () => {
    setView("home");
    setTerminalUrl("");
    setSharePass(null);
  };

  return (
    <div className="app">
      {view === "home" && (
        <>
          <nav className="nav">
            <span className="brand">ToatCloud Terminal</span>
            <span className="links">
              <a href="/CODE_OF_CONDUCT.md">Code of Conduct</a>
              <a href="/SECURITY.md">Security</a>
              <a href="/TERMS.md">Terms</a>
              <a href="https://github.com/Seigh-sword/ToatVM">GitHub</a>
            </span>
          </nav>
          <section className="hero">
            <pre className="ascii">
 ____  ____  ____  ___  __  __    __  __  ___  ____  ____
/ ___|| ___|/ ___|/ _ \\ \\ \\/ /   / / | |/ _ \\/ ___|| __ )
\\___ \\|___|| |   | | | | \\  /   / /  | | | | \\___ \\|  _ \\
 ___) |___)| |___| |_| | /  \\  / /___| | |_| |___) | |_) |
|____/|____/ \\____|\\___/ /_/\\_\\\\____/|_|\\___/|____/|____/
            </pre>
            <h1>A terminal in your browser</h1>
            <p>
              Boot a real Linux VM on GitHub Actions and get a live shell in
              your browser. No setup, no install, just open the URL.
            </p>
          </section>
          <div className="container">
            <div className="cards">
              <div className="card">
                <h3>Instant terminal</h3>
                <p>Pick an OS, boot, and get a working shell in under a minute.</p>
              </div>
              <div className="card">
                <h3>Any OS</h3>
                <p>Ubuntu, Debian, Arch, Alpine, Fedora, Kali — in Docker.</p>
              </div>
              <div className="card">
                <h3>Shareable</h3>
                <p>Hand the URL to a friend. Password-protect if you want.</p>
              </div>
            </div>
            <h2>Boot a terminal</h2>
            <BootForm onBoot={handleBoot} />
            <p className="note" style={{ marginTop: 20 }}>
              <strong>Experimental.</strong> Runners are ephemeral and not private.
              Not for permanent or production use. Each session runs up to ~6h and
              restarts every cycle from a cached state.
            </p>
          </div>
          <footer>ToatCloud Terminal - Apache 2.0 - Experimental</footer>
        </>
      )}
      {view === "terminal" && (
        <Terminal url={terminalUrl} sharePass={sharePass} onClose={handleClose} />
      )}
    </div>
  );
}
