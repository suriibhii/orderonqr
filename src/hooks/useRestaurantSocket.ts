import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientEvent, RestaurantState, ServerEvent } from '../shared/types';

export function useRestaurantSocket() {
  const [state, setState] = useState<RestaurantState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<ClientEvent[]>([]);
  const reconnectTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  useEffect(() => {
    let active = true;

    fetch('/api/state')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load restaurant state');
        return res.json();
      })
      .then((data: RestaurantState) => {
        if (active) {
          setState(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to connect');
      });

    function connect() {
      if (!active) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!active) return;
        setConnected(true);
        setError(null);
        while (queueRef.current.length > 0) {
          const ev = queueRef.current.shift();
          if (ev) ws.send(JSON.stringify(ev));
        }
      };

      ws.onmessage = (msg) => {
        if (!active) return;
        try {
          const parsed = JSON.parse(msg.data) as ServerEvent;
          if (parsed.type === 'state:sync') {
            setState(parsed.payload);
          } else if (parsed.type === 'toast:info') {
            showToast(parsed.payload.message);
          }
        } catch {
          // Ignore invalid JSON
        }
      };

      ws.onclose = () => {
        if (!active) return;
        setConnected(false);
        reconnectTimerRef.current = window.setTimeout(connect, 1800);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      active = false;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      wsRef.current?.close();
    };
  }, [showToast]);

  const sendEvent = useCallback((event: ClientEvent) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    } else {
      queueRef.current.push(event);
    }
  }, []);

  return { state, connected, error, toast, dismissToast: () => setToast(null), sendEvent };
}
