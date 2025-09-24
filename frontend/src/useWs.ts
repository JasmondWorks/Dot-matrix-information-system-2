// useWs.ts
import { useEffect, useRef, useState, useCallback } from "react";

function defaultWsUrl() {
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host; // may include :port
    const hostname = window.location.hostname;

    // If we are served from the ESP itself (e.g., http://192.168.4.1/),
    // connect directly to its WS port 81 at root path.
    if (hostname === "192.168.4.1") {
      return `${proto}://${hostname}:81`;
    }

    // In dev (vite on localhost), use /ws so the proxy forwards to ESP:81
    return `${proto}://${host}/ws`;
  }
  // Fallback if executed in a non-browser context
  return "ws://192.168.4.1:81";
}

export function useWs(url = defaultWsUrl()) {
  const [connected, setConnected] = useState(false);
  const [last, setLast] = useState<any>(null);
  const ref = useRef<WebSocket | null>(null);
  const backoff = useRef(1000);

  const connect = useCallback(() => {
    const ws = new WebSocket(url);
    ref.current = ws;

    ws.onopen = () => {
      setConnected(true);
      backoff.current = 1000;
    };
    ws.onmessage = (ev) => {
      try {
        setLast(JSON.parse(ev.data));
      } catch {
        setLast(ev.data);
      }
    };
    ws.onclose = () => {
      setConnected(false);
      const d = Math.min(backoff.current, 10000);
      setTimeout(connect, d);
      backoff.current *= 2;
    };
    ws.onerror = () => ws.close();
  }, [url]);

  useEffect(() => {
    connect();
    return () => ref.current?.close();
  }, [connect]);

  const send = useCallback((obj: any) => {
    const s = ref.current;
    if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify(obj));
  }, []);

  return { connected, last, send };
}
