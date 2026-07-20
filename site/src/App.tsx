import { useState } from "react";
import Terminal from "./components/Terminal";
import "./App.css";

type View = "home" | "terminal";

interface TerminalSession {
  url: string;
  sharePass: string | null;
}

export default function App() {
  const [view, setView] = useState<View>("home");
  const [session, setSession] = useState<TerminalSession | null>(null);

  const handleClose = () => {
    setView("home");
    setSession(null);
  };

  return (
    <div className="app">
      {view === "home" && (
        <>
          <nav className="nav">
            <span className="brand">
              <img src="/icon.svg" alt="" className="nav-icon" />
              ToatCloud Terminal
            </span>
            <span className="links">
              <a href="/docs/">Docs</a>
              <a href="https://github.com/Seigh-sword/ToatVM">GitHub</a>
            </span>
          </nav>

          <section className="hero">
            <div className="hero-glow" />
            <pre className="ascii">
 ____  ____  ____  ___  __  __    __  __  ___  ____  ____
/ ___|| ___|/ ___|/ _ \\ \\ \\/ /   / / | |/ _ \\/ ___|| __ )
\\___ \\|___|| |   | | | | \\  /   / /  | | | | \\___ \\|  _ \\
 ___) |___)| |___| |_| | /  \\  / /___| | |_| |___) | |_) |
|____/|____/ \\____|\\___/ /_/\\_\\\\____/|_|\\___/|____/|____/
            </pre>
            <div className="hero-badge">Open Source</div>
            <h1>A terminal in your browser</h1>
            <p>
              Boot a real Linux VM on GitHub Actions and get a live shell in
              your browser. No setup, no install, just open the URL.
            </p>
            <div className="hero-actions">
              <a className="btn" href="https://github.com/Seigh-sword/ToatVM">
                View on GitHub
              </a>
              <a className="btn ghost" href="/docs/">
                Read the Docs
              </a>
            </div>
          </section>

          <div className="container">
            <div className="cards">
              <div className="card">
                <div className="card-icon">&#x1F4BB;</div>
                <h3>Instant terminal</h3>
                <p>Pick an OS, boot, and get a working shell in under a minute.</p>
              </div>
              <div className="card">
                <div className="card-icon">&#x1F310;</div>
                <h3>Any OS</h3>
                <p>Ubuntu, Debian, Arch, Alpine, Fedora, Kali — in Docker.</p>
              </div>
              <div className="card">
                <div className="card-icon">&#x1F510;</div>
                <h3>Shareable</h3>
                <p>Hand the URL to a friend. Password-protect if you want.</p>
              </div>
              <div className="card">
                <div className="card-icon">&#x1F4E6;</div>
                <h3>State caching</h3>
                <p>Files persist across cycles. Your home directory survives reboots.</p>
              </div>
            </div>

            <section className="cli-section">
              <h2>Get started with the CLI</h2>
              <div className="cli-box">
                <div className="cli-header">
                  <span className="cli-dot red" />
                  <span className="cli-dot yellow" />
                  <span className="cli-dot green" />
                  <span className="cli-title">terminal</span>
                </div>
                <pre className="cli-body">
{`# Install the CLI
npm i -g toatcloud-terminal

# Create an account
toatcloud-terminal -new

# Boot a terminal session
toatcloud-terminal -init

# Check status
toatcloud-terminal -status

# Stop gracefully
toatcloud-terminal -stop`}
                </pre>
              </div>
            </section>

            <section className="features-section">
              <h2>Features</h2>
              <div className="features-grid">
                <div className="feature">
                  <h4>Multiple accounts</h4>
                  <p>Switch between GitHub accounts with a single command.</p>
                </div>
                <div className="feature">
                  <h4>OS choice</h4>
                  <p>Ubuntu, Debian, Arch, Alpine, Fedora, Kali in Docker.</p>
                </div>
                <div className="feature">
                  <h4>Graceful stop</h4>
                  <p>Caches state then closes. No lost work.</p>
                </div>
                <div className="feature">
                  <h4>Live URL + creds</h4>
                  <p>Printed and copyable. Open directly in your browser.</p>
                </div>
                <div className="feature">
                  <h4>Run logs</h4>
                  <p>Stream job logs to debug boot issues.</p>
                </div>
                <div className="feature">
                  <h4>Templates</h4>
                  <p>Save and reuse session configurations.</p>
                </div>
                <div className="feature">
                  <h4>Port forwards</h4>
                  <p>Expose services running inside the VM.</p>
                </div>
                <div className="feature">
                  <h4>Env vars</h4>
                  <p>Pass environment variables into the container.</p>
                </div>
              </div>
            </section>

            <section className="cta-section">
              <h2>Ready to try it?</h2>
              <p>
                Install the CLI, create an account, and boot your first VM in under a minute.
              </p>
              <a className="btn" href="https://github.com/Seigh-sword/ToatVM">
                Get Started
              </a>
            </section>
          </div>

          <footer className="site-footer">
            <div className="footer-inner">
              <span className="footer-brand">ToatCloud Terminal</span>
              <span className="footer-links">
                <a href="https://github.com/Seigh-sword/ToatVM">GitHub</a>
                <a href="/docs/">Docs</a>
                <a href="https://github.com/Seigh-sword/ToatVM/blob/main/LICENSE">License</a>
              </span>
              <span className="footer-copy">Apache 2.0 — Experimental</span>
            </div>
          </footer>
        </>
      )}

      {view === "terminal" && session && (
        <Terminal url={session.url} sharePass={session.sharePass} onClose={handleClose} />
      )}
    </div>
  );
}
