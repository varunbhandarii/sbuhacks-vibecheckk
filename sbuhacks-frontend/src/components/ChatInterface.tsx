import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket, ReadyState } from '../hooks/useWebSocket';
import { type ChatMessageData, type ChatMessageSubmission } from '../types';
import ChatBubble from './ChatBubble';
import { Send, Loader2, ShieldAlert, ArrowDown, History } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL;

// Tuning
const PAGE_SIZE = 50;
const MAX_CHARS = 500;
const GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes for grouping bubbles

interface ChatInterfaceProps {
  channelId: string;
  className?: string;
}

// ---- Helpers: always keep messages ascending by ts and dedup by id ----
const parseTs = (ts: string) => Date.parse(ts);
const sortAsc = (a: ChatMessageData, b: ChatMessageData) => parseTs(a.ts) - parseTs(b.ts);

function mergeDedupSort(
  base: ChatMessageData[],
  incoming: ChatMessageData[]
): ChatMessageData[] {
  if (!incoming?.length) return base;
  const map = new Map<string, ChatMessageData>();
  for (const m of base) map.set(m.id, m);
  for (const m of incoming) if (!map.has(m.id)) map.set(m.id, m);
  return Array.from(map.values()).sort(sortAsc);
}

export default function ChatInterface({ channelId, className = 'h-[calc(100vh-64px)]' }: ChatInterfaceProps) {
  const { anonymousToken, isAuthenticated, login } = useAuth();

  const [messages, setMessages] = useState<ChatMessageData[]>([]); // always ascending by ts
  const [newMessage, setNewMessage] = useState('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History paging
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Scroll helpers
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);

  // WebSocket (only when authed)
  const wsUrl = isAuthenticated ? `${import.meta.env.VITE_WS_BASE_URL}/ws/chat/${channelId}` : null;
  const { lastMessage, readyState } = useWebSocket(wsUrl);

  // Derived
  const connectionLabel =
    readyState === ReadyState.Open
      ? 'Connected'
      : readyState === ReadyState.Connecting
      ? 'Connecting…'
      : 'Disconnected';

  const oldestTs = useMemo(() => (messages.length ? messages[0].ts : null), [messages]);

  // ===== Initial / refresh history (normalize & sort) =====
  useEffect(() => {
    setMessages([]);
    setIsHistoryLoading(true);
    setHasMore(true);
    setUnseen(0);

    if (!isAuthenticated) {
      setIsHistoryLoading(false);
      return;
    }

    (async () => {
      try {
        const url = `${API_URL}/chat/${channelId}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${anonymousToken}` },
        });
        if (!response.ok) throw new Error('Failed to load chat history');

        const data: ChatMessageData[] = await response.json();
        // Regardless of API order, make it ascending and dedup
        const normalized = mergeDedupSort([], data);
        setMessages(normalized);

        // Heuristic: if fewer than PAGE_SIZE returned, we likely have no more
        if (data.length < PAGE_SIZE) setHasMore(false);

        // scroll to bottom
        queueMicrotask(() => chatEndRef.current?.scrollIntoView({ behavior: 'auto' }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsHistoryLoading(false);
      }
    })();
  }, [channelId, isAuthenticated, anonymousToken, API_URL]);

  // ===== Load older (prepend) with smooth scroll restore =====
  const loadOlder = useCallback(async () => {
    if (!isAuthenticated || isFetchingOlder || !hasMore || !oldestTs) return;
    setIsFetchingOlder(true);
    setError(null);
    const scroller = scrollerRef.current;
    const prevScrollHeight = scroller?.scrollHeight ?? 0;
    const prevScrollTop = scroller?.scrollTop ?? 0;

    try {
      // Server should return messages older than `oldestTs`.
      const url = `${API_URL}/chat/${channelId}?before=${encodeURIComponent(oldestTs)}&limit=${PAGE_SIZE}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${anonymousToken}` },
      });
      if (!res.ok) {
        setHasMore(false);
        return;
      }
      const older: ChatMessageData[] = await res.json();

      if (!older.length) {
        setHasMore(false);
      } else {
        // Merge, dedup, and keep ascending
        setMessages((prev) => mergeDedupSort(prev, older));

        // restore scroll so content doesn't jump
        queueMicrotask(() => {
          if (!scroller) return;
          const newScrollHeight = scroller.scrollHeight;
          scroller.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
        });

        if (older.length < PAGE_SIZE) setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setIsFetchingOlder(false);
    }
  }, [anonymousToken, channelId, hasMore, isAuthenticated, isFetchingOlder, oldestTs, API_URL]);

  // Auto-load older when user hits the very top
  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const onScroll = () => {
      const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 8;
      setIsAtBottom(atBottom);
      if (node.scrollTop <= 0 && !isFetchingOlder) {
        loadOlder();
      }
    };
    node.addEventListener('scroll', onScroll);
    return () => node.removeEventListener('scroll', onScroll);
  }, [loadOlder, isFetchingOlder]);

  // ===== Handle incoming socket messages (normalize & sort) =====
  useEffect(() => {
    if (!lastMessage) return;
    try {
      const incoming: ChatMessageData = JSON.parse(lastMessage.data);
      setMessages((prev) => mergeDedupSort(prev, [incoming]));
      if (!isAtBottom) setUnseen((n) => n + 1);
      else queueMicrotask(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch {
      // ignore parse errors
    }
  }, [lastMessage, isAtBottom]);

  // ===== Send =====
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed || !isAuthenticated || isSending || readyState !== ReadyState.Open) return;

    setIsSending(true);
    setError(null);

    const submission: ChatMessageSubmission = { message: trimmed };
    try {
      const response = await fetch(`${API_URL}/chat/${channelId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonymousToken}`,
        },
        body: JSON.stringify(submission),
      });
      if (!response.ok) {
        if (response.status === 423) setError('Your message was blocked by the content filter.');
        else if (response.status === 429) setError('You are sending messages too quickly. Please slow down.');
        else throw new Error('Failed to send message');
      } else {
        setNewMessage('');
        inputRef.current?.focus();
        // Socket will append; keep scroll pinned
        queueMicrotask(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSending(false);
    }
  };

  // ===== Composer helpers =====
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  const remaining = MAX_CHARS - newMessage.length;

  if (!isAuthenticated) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-800 ${className}`}>
        <ShieldAlert size={48} className="mb-4 text-yellow-500" />
        <h3 className="text-xl font-semibold">Login Required</h3>
        <p className="mb-6 text-gray-400">Please log in to join the chat.</p>
        <button
          onClick={login}
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500"
        >
          Log In
        </button>
      </div>
    );
  }

  // ===== Render =====
  const DayDivider = ({ ts }: { ts: string }) => {
    const label = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(ts));
    return (
      <div className="sticky top-0 z-10 my-2 flex items-center gap-3 text-center text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-700" />
        <span className="rounded-full bg-gray-800 px-2 py-0.5">{label}</span>
        <span className="h-px flex-1 bg-gray-700" />
      </div>
    );
  };

  const shouldShowHeader = (a: ChatMessageData, b?: ChatMessageData) => {
    if (!b) return true;
    if (a.anon_id !== b.anon_id) return true;
    const delta = Math.abs(parseTs(a.ts) - parseTs(b.ts));
    return delta > GROUP_WINDOW_MS;
  };

  return (
    <div className={`flex flex-col rounded-xl border border-gray-800 bg-gray-900 ${className}`}>
      {/* Status header (subtle) */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2 text-xs">
        <span className={connectionLabel === 'Connected' ? 'text-green-400' : connectionLabel === 'Connecting…' ? 'text-yellow-400' : 'text-red-400'}>
          {connectionLabel}
        </span>
        {isFetchingOlder ? (
          <span className="inline-flex items-center gap-1 text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading earlier…
          </span>
        ) : hasMore ? (
          <button
            onClick={loadOlder}
            className="inline-flex items-center gap-1 rounded bg-gray-800 px-2 py-1 text-gray-300 hover:bg-gray-700"
            title="Load earlier messages"
          >
            <History className="h-3 w-3" /> History
          </button>
        ) : (
          <span className="text-gray-600">No earlier messages</span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollerRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {isHistoryLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-gray-400">No messages yet. Say hi!</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const prev = i > 0 ? messages[i - 1] : undefined;
              const showHeader = shouldShowHeader(msg, prev);

              // Day divider when the calendar day changes
              const needDayDivider =
                i === 0 ||
                new Date(messages[i - 1].ts).toDateString() !== new Date(msg.ts).toDateString();

              return (
                <div key={msg.id}>
                  {needDayDivider && <DayDivider ts={msg.ts} />}
                  <ChatBubble message={msg} showHeader={showHeader} />
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </>
        )}
      </div>

      {/* Jump to latest */}
      {!isAtBottom && unseen > 0 && (
        <button
          onClick={() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setUnseen(0);
          }}
          className="absolute bottom-20 left-1/2 z-20 -translate-x-1/2 transform rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-blue-500"
        >
          <span className="inline-flex items-center gap-1">
            <ArrowDown size={14} /> {unseen} new {unseen === 1 ? 'message' : 'messages'}
          </span>
        </button>
      )}

      {/* Composer */}
      <form onSubmit={handleSendMessage} className="shrink-0 border-t border-gray-800 bg-gray-900 p-3">
        <div className="flex w-full items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={readyState === ReadyState.Open ? 'Type your message…' : 'Connecting…'}
            disabled={isSending || readyState !== ReadyState.Open}
            maxLength={MAX_CHARS}
            className="max-h-40 min-h-[48px] flex-1 resize-none rounded-lg border-none bg-gray-800 px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isSending || !newMessage.trim() || readyState !== ReadyState.Open}
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-600"
            aria-label="Send message"
          >
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send size={20} />}
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
          <span>
            Press <kbd className="rounded bg-gray-800 px-1">Enter</kbd> to send •{' '}
            <kbd className="rounded bg-gray-800 px-1">Shift</kbd>+<kbd className="rounded bg-gray-800 px-1">Enter</kbd> for newline
          </span>
          <span className={MAX_CHARS - newMessage.length < 0 ? 'text-red-400' : ''}>
            {MAX_CHARS - newMessage.length} chars left
          </span>
        </div>
        {error && <p className="mt-2 text-center text-red-400">{error}</p>}
      </form>
    </div>
  );
}
