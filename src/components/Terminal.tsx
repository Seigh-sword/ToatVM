import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

// ttyd (v1) protocol over a WebSocket.
//
// Binary frames start with a single type byte:
//   0 = terminal output (server -> client) / input (client -> server)
//   1 = resize (JSON {cols, rows})
// The very first message from the server is a JSON text frame with the
// terminal config (we just read the size from it).

interface TerminalProps {
  url?: string | null;
  connected: boolean;
}

export function Terminal({ url, connected }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);


  useEffect(() => {
    if (!containerRef.current) return;
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "Menlo, Consolas, 'DejaVu Sans Mono', monospace",
      theme: {
        background: "#0b0e14",
        foreground: "#c8d3f5",
        cursor: "#82aaff",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    term.writeln("\x1b[38;5;214mToatVM\x1b[0m — terminal ready.");
    term.writeln("Boot a session from the panel above to attach to the runner.");
    termRef.current = term;
    fitRef.current = fit;

    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      wsRef.current?.close();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

 
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return;

    if (!connected || !url) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    const wsUrl = url.replace(/\/$/, "") + "/websocket";
    term.writeln("");
    term.writeln(`\x1b[38;5;82mConnecting to ${url} ...\x1b[0m`);

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      term.writeln(`\x1b[38;5;196mConnection error: ${String(err)}\x1b[0m`);
      return;
    }
    wsRef.current = ws;

    const sendResize = () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const payload = new TextEncoder().encode(
        JSON.stringify({ cols: term.cols, rows: term.rows }),
      );
      const frame = new Uint8Array(1 + payload.length);
      frame[0] = 1; 
      frame.set(payload, 1);
      ws.send(frame);
    };

    ws.onopen = () => {
      term.writeln("\x1b[38;5;82mConnected.\x1b[0m");
      sendResize();
    };

    ws.onmessage = (event) => {
      if (typeof event.data === "string") return; // ttyd config JSON, ignore
      const buf = new Uint8Array(event.data as ArrayBuffer);
      if (buf.length === 0) return;
      const type = buf[0];
      if (type === 0) {
        term.write(buf.subarray(1));
      }
    };

    ws.onclose = () => {
      term.writeln("");
      term.writeln("\x1b[38;5;214mSession closed.\x1b[0m");
    };

    ws.onerror = () => {
      term.writeln("\x1b[38;5;196mWebSocket error.\x1b[0m");
    };

    const onData = term.onData((data) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const payload = new TextEncoder().encode(data);
      const frame = new Uint8Array(1 + payload.length);
      frame[0] = 0; 
      frame.set(payload, 1);
      ws.send(frame);
    });

    const onResize2 = () => {
      fit.fit();
      sendResize();
    };
    window.addEventListener("resize", onResize2);

    return () => {
      onData.dispose();
      window.removeEventListener("resize", onResize2);
      ws.close();
    };
  }, [url, connected]);

  return <div ref={containerRef} className="terminal" />;
}
