import { useState } from "react";

interface BootFormProps {
  onBoot: (data: { url: string; sharePass?: string | null }) => void;
}

export default function BootForm({ onBoot }: BootFormProps) {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<"terminal" | "desktop">("terminal");
  const [os, setOs] = useState("ubuntu:latest");
  const [user, setUser] = useState("toat");
  const [cycle, setCycle] = useState("60");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/boot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          token,
          mode,
          image: os,
          username: user,
          cycle,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed (${res.status})`);
      }

      const data = await res.json();
      onBoot({ url: data.url, sharePass: data.sharePass ?? null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="boot-form">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>GitHub owner</label>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="seigh-sword"
            required
          />
        </div>
        <div className="form-group">
          <label>Repository</label>
          <input
            type="text"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="ToatVM"
            required
          />
        </div>
        <div className="form-group">
          <label>Personal Access Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_..."
            required
          />
          <small>Needs repo + workflow scopes</small>
        </div>
        <div className="form-group">
          <label>Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as "terminal" | "desktop")}>
            <option value="terminal">Terminal (shell)</option>
            <option value="desktop">Desktop (XFCE GUI)</option>
          </select>
        </div>
        {mode === "terminal" && (
          <div className="form-group">
            <label>OS</label>
            <select value={os} onChange={(e) => setOs(e.target.value)}>
              <option value="ubuntu:latest">Ubuntu</option>
              <option value="debian:latest">Debian</option>
              <option value="archlinux:latest">Arch Linux</option>
              <option value="alpine:latest">Alpine</option>
              <option value="fedora:latest">Fedora</option>
              <option value="kalilinux/kali-rolling">Kali</option>
            </select>
          </div>
        )}
        <div className="form-group">
          <label>Username</label>
          <input type="text" value={user} onChange={(e) => setUser(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Cycle minutes</label>
          <input type="text" value={cycle} onChange={(e) => setCycle(e.target.value)} />
        </div>
        {error && <div className="error">{error}</div>}
        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Booting..." : "Boot Terminal"}
        </button>
      </form>
    </div>
  );
}
