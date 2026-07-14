import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelRun,
  dispatchWorkflow,
  findVmUrlFromRun,
  getVariable,
  GitHubAuth,
  loadAuth,
  listRuns,
  saveAuth,
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
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const workflowFile = mode === "desktop" ? "vm-desktop.yml" : "vm.yml";

  const refresh = useCallback(
    async (a: GitHubAuth) => {
      try {
        const recentRuns = await listRuns(a, workflowFile).catch(
          () => [] as WorkflowRun[],
        );
        // Prefer the optional VM_URL variable; otherwise read the URL the
        // runner printed into the active run's job logs (no write perms).
        let url = await getVariable(a, "VM_URL").catch(() => null);
        const active = recentRuns.find(
          (r) => r.status === "in_progress" || r.status === "queued",
        );
        if (!url && active) {
          url = await findVmUrlFromRun(a, active.id).catch(() => null);
        }
        setVmUrl(url);
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
      await dispatchWorkflow(auth, workflowFile, { lifetime: "60" });
      setMessage("Session dispatched. The runner is booting (this takes ~1 min).");
      await refresh(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  };

  const shutdown = async () => {
    if (!auth) return;
    const active = runs.find((r) => r.status === "in_progress");
    setMessage("Stopping session...");
    try {
      if (active) await cancelRun(auth, active.id);
      setMessage("Session stopped.");
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
