import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  url: string;
  sharePass?: string | null;
  onClose: () => void;
}

export default function Terminal({ url, sharePass, onClose }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Consolas, "Courier New", monospace',
      theme: {
        background: "#07090f",
        foreground: "#c8d3f5",
        cursor: "#82aaff",
      },
    });
    xtermRef.current = term;

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    const wsUrl = sharePass
      ? `${url.replace(/\/$/, "")}/websocket`
      : `${url.replace(/\/$/, "")}/websocket`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      const resize = new TextEncoder().encode(JSON.stringify({ cols: term.cols, rows: term.rows }));
      const rframe = new Uint8Array(1 + resize.length);
      rframe[0] = 1;
      rframe.set(resize, 1);
      ws.send(rframe);
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") return;
      const buf = new Uint8Array(ev.data as ArrayBuffer);
      if (buf.length === 0) return;
      if (buf[0] === 0) {
        term.write(new TextDecoder().decode(buf.subarray(1)));
      }
    };

    ws.onerror = () => {
      term.write("\r\n\x1b[31m[connection error]\x1b[0m\r\n");
    };

    ws.onclose = () => {
      term.write("\r\n\x1b[33m[session ended]\x1b[0m\r\n");
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        const payload = new TextEncoder().encode(data);
        const frame = new Uint8Array(1 + payload.length);
        frame[0] = 0;
        frame.set(payload, 1);
        ws.send(frame);
      }
    });

    term.onResize(() => {
      fitAddon.fit();
      const resize = new TextEncoder().encode(JSON.stringify({ cols: term.cols, rows: term.rows }));
      const rframe = new Uint8Array(1 + resize.length);
      rframe[0] = 1;
      rframe.set(resize, 1);
      ws.send(rframe);
    });

    return () => {
      ws.close();
      term.dispose();
    };
  }, [url, sharePass]);

  return (
    <div className="terminal-wrapper">
      <div className="terminal-header">
        <span className="terminal-title">ToatCloud Terminal</span>
        <button className="btn ghost" onClick={onClose} style={{ padding: "4px 12px", fontSize: 12 }}>
          Close
        </button>
      </div>
      <div ref={containerRef} className="terminal-container" />
    </div>
  );
}
