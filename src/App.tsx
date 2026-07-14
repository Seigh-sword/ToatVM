import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelRun,
  dispatchWorkflow,
  getVariable,
  GitHubAuth,
  loadAuth,
  listRuns,
  saveAuth,
  WorkflowRun,
} from "./api";
import { Terminal } from "./components/Terminal";

const WORKFLOW_FILE = "vm.yml";
const POLL_MS = 5000;

type Status = "idle" | "booting" | "running" | "error" | "config";

export default function App() {
  const [auth, setAuth] = useState<GitHubAuth | null>(() => loadAuth());
  const [status, setStatus] = useState<Status>("config");
  const [vmUrl, setVmUrl] = useState<string | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const refresh = useCallback(
    async (a: GitHubAuth) => {
      try {
        const [url, recentRuns] = await Promise.all([
          getVariable(a, "VM_URL").catch(() => null),
          listRuns(a, WORKFLOW_FILE).catch(() => [] as WorkflowRun[]),
        ]);
        setVmUrl(url);
        setRuns(recentRuns);
        const active = recentRuns.find(
          (r) => r.status === "in_progress" || r.status === "queued",
        );
        if (url && active) setStatus("running");
        else if (active) setStatus("booting");
        else setStatus("idle");
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    },
    [],
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
      await dispatchWorkflow(auth, WORKFLOW_FILE, { lifetime: "60" });
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
                  <span className="label">Runner terminal</span>
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
          <Terminal url={vmUrl} connected={connected} />
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
        <input name="owner" placeholder="Seigh-sword" required />
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
