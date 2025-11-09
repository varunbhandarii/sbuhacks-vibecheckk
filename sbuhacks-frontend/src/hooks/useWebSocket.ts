import { useState, useEffect, useRef } from 'react';

// FIX 1: Changed 'enum' to 'const' object to avoid TS module errors.
export const ReadyState = {
  Connecting: 0,
  Open: 1,
  Closing: 2,
  Closed: 3,
} as const; // 'as const' makes it readonly, similar to an enum

// This hook takes the WebSocket URL as an argument
export function useWebSocket(url: string | null) {
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [readyState, setReadyState] = useState<number>(ReadyState.Closed); // Use 'number' for state

  const ws = useRef<WebSocket | null>(null);

  // FIX 2: Changed type from 'NodeJS.Timeout' to 'number' for browser
  const reconnectTimer = useRef<number | null>(null);

  useEffect(() => {
    function connect() {
      // --- THIS IS THE FIX ---
      // Move the guard check INSIDE the connect function.
      // This guarantees 'url' is a string before it's used.
      if (!url) {
        setReadyState(ReadyState.Closed);
        return; // Don't try to connect if URL is null
      }
      // ---------------------

      // Now TS knows 'url' is a string.
      const socket = new WebSocket(url); // This line is now safe
      ws.current = socket;
      setReadyState(ReadyState.Connecting);

      socket.onopen = () => {
        console.log(`WebSocket connected to: ${url}`);
        setReadyState(ReadyState.Open);
        // Clear any leftover timer on successful connect
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
        }
      };

      socket.onmessage = (message) => {
        setLastMessage(message);
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      socket.onclose = () => {
        console.log(`WebSocket disconnected from: ${url}`);
        ws.current = null;
        setReadyState(ReadyState.Closed);

        // Auto-Reconnect Logic
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
        }

        // Store timer ID in the ref
        reconnectTimer.current = setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          connect(); // Will re-run the 'if (!url)' check
        }, 3000);
      };
    }

    // Initial connection attempt
    connect();

    // --- Cleanup Function ---
    return () => {
      // Clear the reconnect timer
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }

      if (ws.current) {
        ws.current.onclose = null; // Disable reconnect on manual close
        ws.current.close();
        ws.current = null;
      }
    };
  }, [url]); // Re-run this effect if the URL changes

  return { lastMessage, readyState };
}