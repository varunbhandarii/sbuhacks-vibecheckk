import { useEffect, useRef, useState } from 'react';
import { useWebSocket, ReadyState } from '../hooks/useWebSocket';
import { type VibeSummary } from '../types';

const RAW_HTTP = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const API_BASE = RAW_HTTP ? RAW_HTTP.replace(/^http:/i, 'https:').replace(/\/+$/, '') : '';
const RAW_WS = (import.meta.env.VITE_WS_BASE_URL ?? RAW_HTTP).trim();
const WS_BASE = RAW_WS
  ? (/^ws(s)?:/i.test(RAW_WS) ? RAW_WS.replace(/^ws:/i, 'wss:') : RAW_WS.replace(/^http:/i, 'https:').replace(/^https:/i, 'wss:')).replace(/\/+$/, '')
  : '';

const makeUrl2 = (path: string, params?: Record<string, string | number | boolean>) => {
  const url = new URL(path.replace(/^\/+/, ''), API_BASE + '/');
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return url.toString();
};
const makeWs = (path: string) => new URL(path.replace(/^\/+/, ''), WS_BASE + '/').toString();

interface VibeBadgeProps { targetId: string; targetType: 'event' | 'space' }

function vibeLabel(avg: number | null) {
  if (avg === null) return { label: 'No vibe', color: 'bg-gray-600/90', meter: 0 };
  if (avg <= 1) return { label: 'Skip', color: 'bg-gray-600/90', meter: 20 };
  if (avg <= 2) return { label: 'Maybe', color: 'bg-blue-600/90', meter: 45 };
  if (avg <= 3) return { label: 'Worth it', color: 'bg-green-600/90', meter: 70 };
  return { label: 'Packed', color: 'bg-red-600/90', meter: 95 };
}
function connDot(state: number) {
  const base = 'inline-block h-2 w-2 rounded-full';
  if (state === ReadyState.Open) return <span className={`${base} bg-green-400`} aria-label="live" />;
  if (state === ReadyState.Connecting) return <span className={`${base} bg-yellow-400`} aria-label="connecting" />;
  return <span className={`${base} bg-gray-400`} aria-label="offline" />;
}

export default function VibeBadge({ targetId, targetType }: VibeBadgeProps) {
  const [vibe, setVibe] = useState<VibeSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const wsUrl = makeWs(`/ws/vibe/${targetId}`);
  const { lastMessage, readyState } = useWebSocket(wsUrl);
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setIsLoading(true);
        const res = await fetch(makeUrl2('vibes/summary', { target_type: targetType, target_id: targetId }));
        if (!res.ok) throw new Error('Failed to fetch vibe');
        const data: VibeSummary = await res.json();
        if (!aborted) setVibe(data);
      } catch (e) {
        console.error('Error fetching initial vibe:', e);
      } finally {
        if (!aborted) setIsLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [targetId, targetType]);

  useEffect(() => {
    if (!lastMessage) return;
    try { setVibe(JSON.parse(lastMessage.data)); } catch {}
  }, [lastMessage]);

  useEffect(() => {
    const shouldPoll = readyState !== ReadyState.Open;
    if (shouldPoll && pollTimerRef.current == null) {
      const id = window.setInterval(async () => {
        try {
          const res = await fetch(makeUrl2('vibes/summary', { target_type: targetType, target_id: targetId }));
          if (!res.ok) return; setVibe(await res.json());
        } catch {}
      }, 30000);
      pollTimerRef.current = id;
    }
    if (!shouldPoll && pollTimerRef.current != null) {
      window.clearInterval(pollTimerRef.current); pollTimerRef.current = null;
    }
    return () => { if (pollTimerRef.current != null) { window.clearInterval(pollTimerRef.current); pollTimerRef.current = null; } };
  }, [readyState, targetId, targetType]);

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200" aria-live="polite">
        <span className="h-3 w-3 animate-pulse rounded-full bg-gray-400" /> Loading…
      </div>
    );
  }

  if (!vibe || (vibe as any).count === 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200" aria-live="polite">
        {connDot(readyState)} No ratings yet
      </div>
    );
  }

  const avgRaw = (vibe as any).avg ?? (vibe as any).avg_rating ?? null;
  const avg = typeof avgRaw === 'number' ? avgRaw : null;
  const { label, color, meter } = vibeLabel(avg);
  const trend = (vibe as any).trend ?? 0;
  const trendChar = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white ${color}`} aria-live="polite" title={`Vibe: ${label}${avg ? ` (${avg.toFixed(1)})` : ''}`}>
      {connDot(readyState)}
      <span>{label}</span>
      {avg !== null && <span className="font-mono">{avg.toFixed(1)}</span>}
      <span aria-hidden>{trendChar}</span>
      <span className="sr-only">Trend {trend > 0 ? 'rising' : trend < 0 ? 'falling' : 'steady'}</span>
      {/* meter */}
      <span aria-hidden className="ml-1 inline-flex h-1 w-16 overflow-hidden rounded-full bg-white/30">
        <span style={{ width: `${meter}%` }} className="block h-full bg-white" />
      </span>
      <span className="font-normal text-white/90">({(vibe as any).count})</span>
    </div>
  );
}
