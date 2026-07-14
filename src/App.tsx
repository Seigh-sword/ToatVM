import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteVariable,
  dispatchWorkflow,
  findRunInfo,
  getVariable,
  GitHubAuth,
  listRuns,
  loadAccounts,
  loadActiveId,
  saveAccounts,
  saveActiveId,
  setVariable,
  VmCredentials,
  WorkflowRun,
} from "./api";
import { proxyDesktop } from "./proxy";
import { Terminal } from "./components/Terminal";

type Mode = "terminal" | "desktop";
type Status = "idle" | "booting" | "running" | "error" | "config";
const POLL_MS = 5000;

export default function App() {
  const [accounts, setAccounts] = useState<GitHubAuth[]>(() => loadAccounts());
  const [activeId, setActiveId] = useState<string | null>(() => loadActiveId());
  const [showAdd, setShowAdd] = useState(false);

  const [mode, setMode] = useState<Mode>("terminal");
  const [status, setStatus] = useState<Status>("config");
  const [vmUrl, setVmUrl] = useState<string | null>(null);
  const [creds, setCreds] = useState<VmCredentials | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const [username, setUsername] = useState("toat");
  const [password, setPassword] = useState("");
  const [os, setOs] = useState("ubuntu:latest");
  const [lifetime, setLifetime] = useState("60");

  const active = accounts.find((a) => a.id === activeId) ?? null;
  const workflowFile = mode === "desktop" ? "vm-desktop.yml" : "vm.yml";

  const refresh = useCallback(
    async (a: GitHubAuth) => {
      try {
        const recentRuns = await listRuns(a, workflowFile).catch(
          () => [] as WorkflowRun[],
        );
        let url = await getVariable(a, "VM_URL").catch(() => null);
        let infoCreds: VmCredentials | null = null;
        const activeRun = recentRuns.find(
          (r) => r.status === "in_progress" || r.status === "queued",
        );
        if (activeRun) {
          const info = await findRunInfo(a, activeRun.id).catch(() => null);
          if (!url && info?.url) url = info.url;
          infoCreds = info?.creds ?? null;
        }
        setVmUrl(url);
        setCreds(infoCreds);
        setRuns(recentRuns);
        if (url && activeRun) setStatus("running");
        else if (activeRun) setStatus("booting");
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
    if (!active) {
      setStatus("config");
      return;
    }
    refresh(active);
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => refresh(active), POLL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [active, refresh]);

  const addAccount = (acc: Omit<GitHubAuth, "id">) => {
    const id = crypto.randomUUID();
    const next = [...accounts, { ...acc, id }];
    setAccounts(next);
    saveAccounts(next);
    setActiveId(id);
    saveActiveId(id);
    setShowAdd(false);
    setStatus("idle");
  };

  const selectAccount = (id: string) => {
    setActiveId(id);
    saveActiveId(id);
    setVmUrl(null);
    setCreds(null);
    setStatus("idle");
  };

  const boot = async () => {
    if (!active) return;
    setStatus("booting");
    setError(null);
    setMessage("Dispatching ToatVM session...");
    try {
      await deleteVariable(active, "VM_STOP").catch(() => {});
      const inputs: Record<string, string> = { lifetime };
      if (mode === "terminal") {
        inputs.username = username;
        inputs.password = password;
        inputs.image = os;
      }
      await dispatchWorkflow(active, workflowFile, inputs);
      setMessage(
        "Session dispatched. The runner is booting (OS pull + setup takes a few min).",
      );
      await refresh(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  };

  const shutdown = async () => {
    if (!active) return;
    setMessage("Stopping — the runner will cache state, then close.");
    try {
      // Graceful: set VM_STOP. The runner's boot loop detects it, saves the
      // cache, and exits; the re-dispatch step then sees the flag and stops.
      await setVariable(active, "VM_STOP", "1");
      setMessage(
        "Stop requested. Caching state and shutting down (this takes a few seconds)...",
      );
      await refresh(active);
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
        <div className="account-switch">
          {accounts.length > 0 && (
            <select
              value={activeId ?? ""}
              onChange={(e) => selectAccount(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.owner}/{a.repo})
                </option>
              ))}
            </select>
          )}
          <button className="btn small" onClick={() => setShowAdd(true)}>
            + account
          </button>
        </div>
        <div className="status-pill" data-status={status}>
          {status === "running"
            ? "running"
            : status === "booting"
              ? "booting"
              : status === "error"
                ? "error"
                : "idle"}
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>Session</h2>

          {accounts.length === 0 || showAdd ? (
            <AddAccountForm
              onSave={addAccount}
              onCancel={() => setShowAdd(false)}
            />
          ) : (
            active && (
              <>
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
                      Runner {mode === "desktop" ? "desktop" : "terminal"} (proxied)
                    </span>
                    <span className="proxied">served via ToatVM proxy</span>
                    {creds && (
                      <div className="creds">
                        login: <code>{creds.user}</code> / <code>{creds.pass}</code>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="hint">
                    No active runner yet. Boot a session — it will appear here and
                    connect through the ToatVM site (no raw tunnel URL).
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
            )
          )}
        </section>

        <section className="terminal-wrap">
          {mode === "desktop" && connected && vmUrl ? (
            <iframe
              className="desktop"
              title="ToatVM Desktop"
              src={proxyDesktop(vmUrl)}
            />
          ) : (
            <Terminal url={vmUrl} connected={connected} />
          )}
        </section>
      </main>
    </div>
  );
}

function AddAccountForm({
  onSave,
  onCancel,
}: {
  onSave: (acc: Omit<GitHubAuth, "id">) => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="config"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSave({
          name: String(fd.get("name") || "account"),
          token: String(fd.get("token") || ""),
          owner: String(fd.get("owner") || ""),
          repo: String(fd.get("repo") || ""),
        });
      }}
    >
      <label>
        Account name
        <input name="name" placeholder="my-account" required />
      </label>
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
        <input name="token" type="password" placeholder="ghp_..." required />
      </label>
      <p className="hint">
        Stored only in your browser (localStorage). Sent solely to api.github.com.
        Needs <code>repo</code> and <code>workflow</code> scopes.
      </p>
      <div className="controls">
        <button className="btn primary" type="submit">
          Save account
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
