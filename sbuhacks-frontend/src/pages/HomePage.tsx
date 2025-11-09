import { useEffect, useMemo, useRef, useState } from 'react';
import { type ChatMessage } from '../types';
import ChatMessageBubble from '../components/ChatMessageBubble';
import { Send, Loader2, Sparkles, Lightbulb, X, RotateCcw, ArrowDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_BASE_URL;

const GREETING_MESSAGE: ChatMessage = {
  id: 'greeting-1',
  role: 'bot',
  content: "Hey! I'm VibeCheck AI.\nAsk me what's happening on campus!",
};

const SUGGESTIONS = [
  'What are the biggest events today?',
  'Any free food events right now?',
  'CS club meetups this week',
  'Find quiet study spaces near the library',
  'Show me parties this weekend',
];

const STORAGE_KEY = 'vibecheck:home:thread';

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING_MESSAGE]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [unseen, setUnseen] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const { anonymousToken, login, isAuthenticated } = useAuth();
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);

  // Load thread from localStorage (if any)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: ChatMessage[] = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length) {
          setMessages(saved);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist thread
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Auto-scroll (only when near bottom)
  useEffect(() => {
    if (isAtBottom) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    else setUnseen((n) => (isLoading ? n : n + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Track scroll position
  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const onScroll = () => {
      const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 16;
      setIsAtBottom(atBottom);
      if (atBottom) setUnseen(0);
    };
    node.addEventListener('scroll', onScroll);
    return () => node.removeEventListener('scroll', onScroll);
  }, []);

  const canSend = useMemo(() => !!query.trim() && isAuthenticated && !isLoading, [query, isAuthenticated, isLoading]);

  const sendQuery = async (text: string) => {
    if (!text.trim() || isLoading) return;

    if (!isAuthenticated || !anonymousToken) {
      login();
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
    };

    lastUserMessageRef.current = userMessage.content;
    setMessages((prev) => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);
    setError(null);

    // Build conversation history (exclude greeting)
    const conversationHistory = [...messages, userMessage]
      .filter((m) => m.id !== 'greeting-1')
      .map((m) => ({ role: m.role, content: m.content }));

    // Abort controller (for Stop)
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${API_URL}/ai/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonymousToken}`,
        },
        body: JSON.stringify({
          text: userMessage.content,
          conversation_history: conversationHistory,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`Failed to get response from AI (${response.status})`);
      const data: any = await response.json();

      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'bot',
        content: data.text_response ?? '',
        events: data.events ?? [],
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        setError('Response cancelled.');
      } else {
        const errorMsg = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(errorMsg);
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'bot',
          content: `Sorry, I ran into an error: ${errorMsg}`,
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendQuery = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuery(query);
  };

  const handleSuggestion = (text: string) => {
    setQuery(text);
    // Send immediately
    setTimeout(() => sendQuery(text), 0);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsLoading(false);
  };

  const handleRegenerate = () => {
    const last = lastUserMessageRef.current;
    if (last) sendQuery(last);
  };

  const showSuggestions = useMemo(() => {
    // Show when the only message is the greeting or no user messages yet
    const hasUser = messages.some((m) => m.role === 'user');
    return !hasUser;
  }, [messages]);

  return (
    <div className="flex h-full max-h-[calc(100vh-64px)] flex-col">
      {/* Header / Hero */}
      <div className="border-b border-gray-800 bg-gray-900/60 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/20 text-blue-300">
              <Sparkles size={16} />
            </span>
            <div>
              <h1 className="text-sm font-semibold text-white">VibeCheck AI</h1>
              <p className="text-xs text-gray-400">Ask about events, food, clubs, study spots—anything SBU.</p>
            </div>
          </div>

          {/* Controls for running request */}
          <div className="flex items-center gap-2">
            {isLoading ? (
              <button
                onClick={handleStop}
                className="inline-flex items-center gap-1 rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700"
              >
                <X size={14} /> Stop
              </button>
            ) : (
              <button
                onClick={handleRegenerate}
                className="inline-flex items-center gap-1 rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700"
                disabled={!lastUserMessageRef.current}
                title="Regenerate last answer"
              >
                <RotateCcw size={14} /> Regenerate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 1) Messages */}
      <div ref={scrollerRef} className="flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
        {/* Suggestions / Quick prompts */}
        {showSuggestions && (
          <div className="mx-auto w-full max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-gray-400">
              <Lightbulb size={14} /> Try asking:
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="rounded-full border border-gray-700 bg-gray-900/60 px-3 py-1 text-sm text-gray-200 hover:bg-gray-800"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation */}
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg bg-gray-700/80 p-3 pr-4">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Jump to latest */}
      {!isAtBottom && unseen > 0 && (
        <button
          onClick={() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setUnseen(0);
          }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 transform rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-blue-500"
        >
          <span className="inline-flex items-center gap-1">
            <ArrowDown size={14} /> {unseen} new {unseen === 1 ? 'message' : 'messages'}
          </span>
        </button>
      )}

      {/* 2) Composer */}
      <form onSubmit={handleSendQuery} className="shrink-0 border-t border-gray-700 bg-gray-800 p-3">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isAuthenticated ? 'Ask me anything about campus…' : 'Please log in to chat'}
            disabled={isLoading || !isAuthenticated}
            className="flex-1 rounded-lg border-none bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-600"
            aria-label="Send message"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send size={20} />}
          </button>
        </div>
        {error && !isLoading && <p className="mt-2 text-center text-red-400">{error}</p>}
        {!isAuthenticated && (
          <p className="mt-2 text-center text-gray-400">
            Tip: you need to log in before asking the AI.
          </p>
        )}
      </form>
    </div>
  );
}
