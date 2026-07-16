// Tiny ttyd (v1) WebSocket client used by `toatvm -sync` and `-exec`.
// Binary frames: type 0 = input/output, type 1 = resize (JSON).
// We open the socket, send input, and resolve once we've seen the output we
// expect (matched by a marker) or after a timeout.

export interface TtydResult {
  output: string;
  ok: boolean;
}

export async function ttydRun(
  url: string,
  input: string,
  opts: { expect?: string; timeoutMs?: number } = {},
): Promise<TtydResult> {
  const wsUrl = url.replace(/\/$/, "") + "/websocket";
  const timeoutMs = opts.timeoutMs ?? 20000;

  return new Promise<TtydResult>((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      reject(err);
      return;
    }

    let output = "";
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve({ output, ok });
    };

    const timer = setTimeout(() => finish(opts.expect ? output.includes(opts.expect) : true), timeoutMs);

    const sendInput = () => {
      const payload = new TextEncoder().encode(input);
      const frame = new Uint8Array(1 + payload.length);
      frame[0] = 0;
      frame.set(payload, 1);
      ws.send(frame);
      // give the shell a moment, then end
      setTimeout(() => finish(opts.expect ? output.includes(opts.expect) : true), 1500);
    };

    ws.onopen = () => {
      // resize to something reasonable
      const r = new TextEncoder().encode(JSON.stringify({ cols: 200, rows: 40 }));
      const rf = new Uint8Array(1 + r.length);
      rf[0] = 1;
      rf.set(r, 1);
      ws.send(rf);
      sendInput();
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") return;
      const buf = new Uint8Array(ev.data as ArrayBuffer);
      if (buf.length === 0) return;
      if (buf[0] === 0) {
        output += new TextDecoder().decode(buf.subarray(1));
      }
    };

    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error("ttyd WebSocket error"));
    };

    ws.onclose = () => {
      clearTimeout(timer);
      if (!done) finish(opts.expect ? output.includes(opts.expect) : true);
    };
  });
}
