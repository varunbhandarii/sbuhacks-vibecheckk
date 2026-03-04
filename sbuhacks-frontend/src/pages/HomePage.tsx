import { useEffect, useMemo, useRef, useState } from 'react';
import { type ChatMessage } from '../types';
import ChatMessageBubble from '../components/ChatMessageBubble';
import { Send, Sparkles, ArrowDown, X, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_BASE_URL;

const GREETING_MESSAGE: ChatMessage = {
  id: 'greeting-1',
  role: 'bot',
  content: "Hey! I'm VibeCheck AI.\nAsk me what's happening on campus.",
};

const SUGGESTIONS = [
  'What events are happening today?',
  'Any free food events?',
  'CS club meetups this week',
  'Study spaces near library',
  'Parties this weekend',
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: ChatMessage[] = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length) setMessages(saved);
      }
    } catch { }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { }
  }, [messages]);

  useEffect(() => {
    if (isAtBottom) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    else setUnseen((n) => (isLoading ? n : n + 1));
  }, [messages]);

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
    if (!isAuthenticated || !anonymousToken) { login(); return; }

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text.trim() };
    lastUserMessageRef.current = userMessage.content;
    setMessages((prev) => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);
    setError(null);

    const conversationHistory = [...messages, userMessage]
      .filter((m) => m.id !== 'greeting-1')
      .map((m) => ({ role: m.role, content: m.content }));

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${API_URL}/ai/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonymousToken}` },
        body: JSON.stringify({ text: userMessage.content, conversation_history: conversationHistory }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Failed to get response from AI (${response.status})`);
      const data: any = await response.json();
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'bot', content: data.text_response ?? '', events: data.events ?? [] }]);
    } catch (err) {
      if ((err as any)?.name === 'AbortError') { setError('Cancelled.'); }
      else {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'bot', content: `Sorry: ${errorMsg}` }]);
      }
    } finally { setIsLoading(false); }
  };

  const handleSendQuery = (e: React.FormEvent) => { e.preventDefault(); sendQuery(query); };
  const handleSuggestion = (text: string) => { setQuery(text); setTimeout(() => sendQuery(text), 0); };
  const handleStop = () => { abortRef.current?.abort(); setIsLoading(false); };
  const handleRegenerate = () => { const last = lastUserMessageRef.current; if (last) sendQuery(last); };

  const showSuggestions = messages.every((m) => m.role === 'bot');

  return (
    <div className="relative flex h-full max-h-[calc(100vh-64px)] flex-col overflow-hidden bg-black">
      {/* Header */}
      <div className="z-10 border-b border-white/[0.06] px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-mono-50">
              <Sparkles size={16} className="text-mono-600" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight text-white">VibeCheck AI</h1>
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-mono-400">Campus Events Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoading ? (
              <button onClick={handleStop} className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-mono-500 transition-all hover:border-white/30 hover:text-white">
                <X size={12} className="transition-transform group-hover:rotate-90" /> Stop
              </button>
            ) : (
              <button onClick={handleRegenerate} disabled={!lastUserMessageRef.current}
                className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-mono-500 transition-all hover:border-white/30 hover:text-white disabled:opacity-20">
                <RotateCcw size={12} className="transition-transform group-hover:-rotate-180" /> Redo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollerRef} className="mono-scrollbar z-10 flex-1 space-y-6 overflow-y-auto px-4 py-8 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {showSuggestions && (
            <div className="msg-enter mx-auto mb-4 w-full max-w-2xl">
              <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-mono-400">Try asking</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s, idx) => (
                  <button key={s} onClick={() => handleSuggestion(s)}
                    style={{ animationDelay: `${idx * 0.04}s` }}
                    className="msg-enter rounded-full border border-white/[0.06] bg-mono-50 px-4 py-2 text-[13px] font-medium text-mono-600 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:text-white">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => <ChatMessageBubble key={msg.id} message={msg} />)}

          {isLoading && (
            <div className="msg-enter flex max-w-[85%] flex-col gap-2 md:max-w-2xl">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-mono-100 text-mono-600">
                  <Sparkles size={13} />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-mono-400">VibeCheck AI</span>
              </div>
              <div className="ml-9 flex">
                <div className="flex h-10 items-center gap-2 rounded-2xl rounded-tl-md border border-white/[0.06] bg-mono-50 px-5">
                  <div className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-white" style={{ animationDelay: '0ms' }} />
                  <div className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-mono-500" style={{ animationDelay: '200ms' }} />
                  <div className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-mono-300" style={{ animationDelay: '400ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} className="h-4" />
        </div>
      </div>

      {/* Jump to bottom */}
      {!isAtBottom && unseen > 0 && (
        <button
          onClick={() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); setUnseen(0); }}
          className="absolute bottom-28 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
        >
          <ArrowDown size={12} className="animate-bounce" /> {unseen} new
        </button>
      )}

      {/* Composer */}
      <div className="z-10 w-full shrink-0 border-t border-white/[0.06] p-4 sm:p-6">
        <form onSubmit={handleSendQuery} className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          {isLoading && <div className="shimmer-bar h-px w-full rounded-full" />}
          <div className="focus-ring flex w-full items-end gap-2 rounded-2xl border border-white/[0.08] bg-mono-50 p-2 transition-all">
            <textarea
              rows={1}
              value={query}
              onChange={(e) => { setQuery(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canSend) handleSendQuery(e); } }}
              placeholder={isAuthenticated ? 'Ask anything about campus events...' : 'Log in to chat'}
              disabled={isLoading || !isAuthenticated}
              className="mono-scrollbar max-h-[120px] min-h-[44px] w-full resize-none rounded-xl border-none bg-transparent px-4 py-3 text-[15px] font-medium text-white placeholder-mono-400 caret-white focus:outline-none disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={!canSend}
              className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                canSend ? 'bg-white text-black hover:scale-105 active:scale-95' : 'bg-mono-200 text-mono-400'
              }`}
              aria-label="Send message"
            >
              <Send size={16} className={canSend ? 'translate-x-0.5' : ''} />
            </button>
          </div>
          <div className="flex items-center justify-between px-2 text-[10px] font-medium uppercase tracking-[0.1em]">
            <span className="text-mono-400">{error && !isLoading ? error : ''}</span>
            <span className="text-mono-300">{!isAuthenticated ? 'Login required' : 'Shift+Enter for new line'}</span>
          </div>
        </form>
      </div>
    </div>
  );
}
