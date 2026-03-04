import { useEffect, useMemo, useRef, useState } from 'react';
import { type ChatMessage } from '../types';
import ChatMessageBubble from '../components/ChatMessageBubble';
import { Send, Sparkles, Lightbulb, X, RotateCcw, ArrowDown } from 'lucide-react';
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

    const conversationHistory = [...messages, userMessage]
      .filter((m) => m.id !== 'greeting-1')
      .map((m) => ({ role: m.role, content: m.content }));

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

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'bot', content: data.text_response ?? '', events: data.events ?? [] },
      ]);
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        setError('Response cancelled.');
      } else {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'bot', content: `Sorry: ${errorMsg}` }]);
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

  const showSuggestions = messages.every((m) => m.role === 'bot');

  return (
    <div className="relative flex h-full max-h-[calc(100vh-64px)] flex-col overflow-hidden bg-[#0a0a0f] font-sans selection:bg-neon-pink/30">
      {/* Animated Mesh Background */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-30 mix-blend-screen">
        <div className="animate-aurora-1 absolute -left-[10%] -top-[10%] h-[50vh] w-[50vw] rounded-full bg-neon-purple/20 blur-[100px] md:blur-[120px]" />
        <div className="animate-aurora-2 absolute right-[0%] top-[20%] h-[40vh] w-[40vw] rounded-full bg-neon-pink/20 blur-[90px] md:blur-[100px]" />
        <div className="animate-aurora-3 absolute bottom-[-10%] left-[20%] h-[40vh] w-[60vw] rounded-full bg-neon-cyan/20 blur-[100px] md:blur-[120px]" />
      </div>

      {/* Header / Hero */}
      <div className="z-10 border-b border-white/5 glass px-4 py-3 shadow-[0_4px_32px_rgba(0,0,0,0.5)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-purple to-neon-pink text-white vol-shadow ring-1 ring-white/20">
              <Sparkles size={20} className="animate-pulse-glow" />
            </span>
            <div className="flex flex-col">
              <h1 className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-lg font-black tracking-tight text-transparent drop-shadow-sm">
                VIBECHECK.AI
              </h1>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-neon-cyan/80">
                Ask about events, food, clubs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLoading ? (
              <button
                onClick={handleStop}
                className="group inline-flex items-center gap-1.5 rounded-full glass-strong px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-rose-400 transition-all hover:bg-rose-500/10 hover:text-rose-300"
              >
                <X size={14} className="transition-transform group-hover:rotate-90" /> Stop
              </button>
            ) : (
              <button
                onClick={handleRegenerate}
                className="group inline-flex items-center gap-1.5 rounded-full glass-strong px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neon-purple transition-all hover:bg-neon-purple/10 hover:text-neon-pink disabled:opacity-30"
                disabled={!lastUserMessageRef.current}
                title="Regenerate last answer"
              >
                <RotateCcw size={14} className="transition-transform group-hover:-rotate-180" /> Regenerate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollerRef} className="vibe-scrollbar z-10 flex-1 space-y-8 overflow-y-auto px-4 py-6 md:px-8 md:py-8 lg:px-12">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {showSuggestions && (
            <div className="msg-enter mx-auto mb-2 w-full max-w-3xl">
              <div className="mb-4 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-neon-cyan">
                <Lightbulb size={12} className="opacity-80 animate-pulse" /> Try asking
              </div>
              <div className="flex flex-wrap justify-center gap-2.5">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                    className="msg-enter rounded-full glass-strong border-white/10 px-4 py-2 text-xs font-medium tracking-wide text-gray-200 transition-all hover:-translate-y-1 hover:border-neon-purple/50 hover:bg-neon-purple/10 hover:text-white hover:vol-shadow"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} />
          ))}

          {isLoading && (
            <div className="msg-enter flex max-w-[85%] flex-col gap-2 md:max-w-2xl">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl glass-strong text-neon-cyan ring-1 ring-neon-cyan/30">
                  <Sparkles size={16} className="animate-pulse-glow rounded-full" />
                </div>
                <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">
                  VibeCheck AI
                </span>
              </div>
              <div className="relative ml-10 flex">
                <div className="glass flex h-10 w-20 items-center justify-center gap-1.5 rounded-3xl rounded-tl-sm px-4 vol-shadow-lg ring-1 ring-white/10">
                  <div className="h-2 w-2 animate-dot-bounce rounded-full bg-neon-cyan" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 animate-dot-bounce rounded-full bg-neon-purple" style={{ animationDelay: '200ms' }} />
                  <div className="h-2 w-2 animate-dot-bounce rounded-full bg-neon-pink" style={{ animationDelay: '400ms' }} />
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
          onClick={() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setUnseen(0);
          }}
          className="absolute bottom-28 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-md transition-transform hover:scale-105 active:scale-95 vol-shadow-lg ring-1 ring-white/20"
        >
          <ArrowDown size={14} className="animate-bounce" />
          {unseen} New {unseen === 1 ? 'Message' : 'Messages'}
        </button>
      )}

      {/* Composer */}
      <div className="z-10 w-full shrink-0 animate-fade-slide-up p-4 sm:p-6 lg:p-8">
        <form onSubmit={handleSendQuery} className="mx-auto flex w-full max-w-4xl flex-col gap-2">
          {/* Shimmer loading bar along top of input */}
          <div className="relative h-1 w-full overflow-hidden rounded-t-xl opacity-50">
            {isLoading && <div className="shimmer-bar absolute inset-0 h-full w-full" />}
          </div>
          
          <div className="neon-ring neon-ring-focus group flex w-full items-end gap-2 rounded-2xl glass-strong bg-gray-900/60 p-2 transition-all">
            <textarea
              rows={1}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) handleSendQuery(e);
                }
              }}
              placeholder={isAuthenticated ? 'Type your vibes here...' : 'Please log in to chat'}
              disabled={isLoading || !isAuthenticated}
              className="vibe-scrollbar max-h-[120px] min-h-[44px] w-full resize-none rounded-xl border-none bg-transparent px-4 py-3 text-[15px] font-medium leading-relaxed tracking-wide text-white placeholder-gray-500 caret-neon-cyan focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!canSend}
              className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                canSend 
                  ? 'bg-gradient-to-br from-neon-purple to-neon-pink text-white vol-shadow hover:scale-105 active:scale-95' 
                  : 'bg-gray-800 text-gray-500'
              }`}
              aria-label="Send message"
            >
              <Send size={18} className={`${canSend ? 'translate-x-0.5' : ''} transition-transform`} />
            </button>
          </div>
          <div className="flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-[0.15em]">
            <span className="text-red-400">{error && !isLoading ? error : ''}</span>
            <span className="text-neon-cyan/50">
              {!isAuthenticated ? 'Login required to chat' : 'Shift + Enter for new line'}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
