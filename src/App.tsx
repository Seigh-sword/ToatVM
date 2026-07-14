import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelRun,
  deleteVariable,
  dispatchWorkflow,
  findRunInfo,
  getVariable,
  GitHubAuth,
  loadAuth,
  listRuns,
  saveAuth,
  setVariable,
  VmCredentials,
  WorkflowRun,
} from "./api";
import { Terminal } from "./components/Terminal";

type Mode = "terminal" | "desktop";
const POLL_MS = 5000;

type Status = "idle" | "booting" | "running" | "error" | "config";

export default function App() {
  const [auth, setAuth] = useState<GitHubAuth | null>(() => loadAuth());
  const [mode, setMode] = useState<Mode>("terminal");
  const [status, setStatus] = useState<Status>("config");
  const [vmUrl, setVmUrl] = useState<string | null>(null);
  const [creds, setCreds] = useState<VmCredentials | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // VM configuration (sent as workflow_dispatch inputs)
  const [username, setUsername] = useState("toat");
  const [password, setPassword] = useState("");
  const [os, setOs] = useState("ubuntu:latest");
  const [lifetime, setLifetime] = useState("60");

  const workflowFile = mode === "desktop" ? "vm-desktop.yml" : "vm.yml";

  const refresh = useCallback(
    async (a: GitHubAuth) => {
      try {
        const recentRuns = await listRuns(a, workflowFile).catch(
          () => [] as WorkflowRun[],
        );
        // Prefer the optional VM_URL variable; otherwise read the URL (and
        // credentials) the runner printed into the active run's job logs.
        let url = await getVariable(a, "VM_URL").catch(() => null);
        let infoCreds: VmCredentials | null = null;
        const active = recentRuns.find(
          (r) => r.status === "in_progress" || r.status === "queued",
        );
        if (active) {
          const info = await findRunInfo(a, active.id).catch(() => null);
          if (!url && info?.url) url = info.url;
          infoCreds = info?.creds ?? null;
        }
        setVmUrl(url);
        setCreds(infoCreds);
        setRuns(recentRuns);
        if (url && active) setStatus("running");
        else if (active) setStatus("booting");
        else setStatus("idle");
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    },
    [workflowFile],
  );

  useEffect(() => {
    if (!auth) {
      setStatus("config");
      return;
    }
    refresh(auth);
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => refresh(auth), POLL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [auth, refresh]);

  const onSaveConfig = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next: GitHubAuth = {
      token: String(fd.get("token") || ""),
      owner: String(fd.get("owner") || ""),
      repo: String(fd.get("repo") || ""),
    };
    saveAuth(next);
    setAuth(next);
    setStatus("idle");
  };

  const boot = async () => {
    if (!auth) return;
    setStatus("booting");
    setError(null);
    setMessage("Dispatching ToatVM session...");
    try {
      // Clear any pending stop request so the loop runs.
      await deleteVariable(auth, "VM_STOP").catch(() => {});
      const inputs: Record<string, string> = { lifetime };
      if (mode === "terminal") {
        inputs.username = username;
        inputs.password = password;
        inputs.image = os;
      }
      await dispatchWorkflow(auth, workflowFile, inputs);
      setMessage(
        "Session dispatched. The runner is booting (OS pull + setup takes a few min).",
      );
      await refresh(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  };

  const shutdown = async () => {
    if (!auth) return;
    setMessage("Stopping session...");
    try {
      // Set the stop flag (read by the workflow before boot / re-dispatch),
      // then cancel any runs that are already queued or in progress.
      await setVariable(auth, "VM_STOP", "1");
      const pending = runs.filter(
        (r) => r.status === "in_progress" || r.status === "queued",
      );
      for (const r of pending) {
        await cancelRun(auth, r.id).catch(() => {});
      }
      setMessage("Session stopped. The VM will not restart until you Boot again.");
      await refresh(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const connected = status === "running" && !!vmUrl;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
           <span className="brand-name">ToatVM</span>
          <span className="badge">experimental</span>
        </div>
        <div className="status-pill" data-status={status}>
          {status === "running"
            ? "running..."
            : status === "booting"
              ? "booting..."
              : status === "error"
                ? "error!"
                : "idle"}
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>Session</h2>

          {!auth && <ConfigForm onSave={onSaveConfig} />}

          {auth && (
            <>
              <div className="repo-line">
                {auth.owner}/{auth.repo}
                <button
                  className="link"
                  onClick={() => {
                    setAuth(null);
                    setStatus("config");
                  }}
                >
                  change
                </button>
              </div>

              <div className="mode-toggle">
                <button
                  className={mode === "terminal" ? "btn small active" : "btn small"}
                  onClick={() => setMode("terminal")}
                >
                  Terminal
                </button>
                <button
                  className={mode === "desktop" ? "btn small active" : "btn small"}
                  onClick={() => setMode("desktop")}
                >
                  Desktop
                </button>
              </div>

              {mode === "terminal" && (
                <details className="vm-settings">
                  <summary>VM settings</summary>
                  <label>
                    Username
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="toat"
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="random if blank"
                    />
                  </label>
                  <label>
                    OS
                    <select value={os} onChange={(e) => setOs(e.target.value)}>
                      <option value="ubuntu:latest">Ubuntu</option>
                      <option value="debian:latest">Debian</option>
                      <option value="archlinux:latest">Arch Linux</option>
                      <option value="alpine:latest">Alpine</option>
                      <option value="fedora:latest">Fedora</option>
                      <option value="kalilinux/kali-rolling">Kali</option>
                    </select>
                  </label>
                  <label>
                    Cycle (minutes)
                    <input
                      value={lifetime}
                      onChange={(e) => setLifetime(e.target.value)}
                      placeholder="60"
                    />
                  </label>
                </details>
              )}

              <div className="controls">
                <button
                  className="btn primary"
                  onClick={boot}
                  disabled={status === "booting" || status === "running"}
                >
                  Boot VM
                </button>
                <button
                  className="btn danger"
                  onClick={shutdown}
                  disabled={status !== "running" && status !== "booting"}
                >
                  Shut down
                </button>
              </div>

              {vmUrl ? (
                <div className="url-box">
                  <span className="label">
                    Runner {mode === "desktop" ? "desktop" : "terminal"}
                  </span>
                  <a href={vmUrl} target="_blank" rel="noreferrer">
                    {vmUrl}
                  </a>
                  {creds && (
                    <div className="creds">
                      login: <code>{creds.user}</code> / <code>{creds.pass}</code>
                    </div>
                  )}
                </div>
              ) : (
                <p className="hint">
                  No active runner URL yet. Boot a session — the runner will
                  publish its address to a GitHub Actions variable automatically.
                </p>
              )}

              {message && <p className="msg">{message}</p>}
              {error && <p className="msg error">{error}</p>}

              <details className="runs">
                <summary>Recent runs ({runs.length})</summary>
                <ul>
                  {runs.map((r) => (
                    <li key={r.id}>
                      <a href={r.html_url} target="_blank" rel="noreferrer">
                        #{r.id}
                      </a>{" "}
                      — {r.status}
                      {r.conclusion ? ` (${r.conclusion})` : ""}
                    </li>
                  ))}
                </ul>
              </details>

              <p className="disclaimer">
                ⚠ Experimental. Each runner lives up to ~6h and cycles through a
                1h cache-and-restart loop. Not for permanent use.
              </p>
            </>
          )}
        </section>

        <section className="terminal-wrap">
          {mode === "desktop" && connected && vmUrl ? (
            <iframe
              className="desktop"
              title="ToatVM Desktop"
              src={`${vmUrl}/vnc.html?path=websockify&resize=scale&autoconnect=true`}
            />
          ) : (
            <Terminal url={vmUrl} connected={connected} />
          )}
        </section>
      </main>
    </div>
  );
}

function ConfigForm({
  onSave,
}: {
  onSave: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="config" onSubmit={onSave}>
      <label>
        GitHub owner
        <input name="owner" placeholder="" required />
      </label>
      <label>
        Repository
        <input name="repo" placeholder="ToatVM" required />
      </label>
      <label>
        Personal Access Token
        <input
          name="token"
          type="password"
          placeholder="ghp_..."
          required
        />
      </label>
      <p className="hint">
        The token is stored only in your browser (localStorage) and is sent
        solely to api.github.com. It needs <code>repo</code> and{" "}
        <code>workflow</code> scopes.
      </p>
      <button className="btn primary" type="submit">
        Save & connect
      </button>
    </form>
  );
}
