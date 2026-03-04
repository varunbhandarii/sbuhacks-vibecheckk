import { useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { type ChatMessage } from '../types';
import { User, Sparkles, Copy, Calendar, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

const URL_RE = /<?https?:\/\/[^\s)>]+>?/gi;
function sanitizeText(input?: string) {
  if (!input) return '';
  let s = input.replace(URL_RE, '');
  s = s.replace(/\(\s*\)/g, '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function formatShortDate(isoString: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  }).format(new Date(isoString));
}

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

export default function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user';
  const safeText = useMemo(() => sanitizeText(message.content), [message.content]);

  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(safeText); } catch { }
  }, [safeText]);

  const markdownComponents: Components = {
    a({ children }) {
      return <span className="underline decoration-white/30 underline-offset-4">{children}</span>;
    },
    p({ children }) {
      return <p className="mb-3 last:mb-0 leading-relaxed text-mono-800">{children}</p>;
    },
    strong({ children }) {
      return <strong className="font-bold text-white">{children}</strong>;
    },
    ul({ children }) {
      return <ul className="mb-3 ml-4 list-disc space-y-1 marker:text-mono-400">{children}</ul>;
    },
  };

  return (
    <div className={`msg-enter flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="flex max-w-[85%] flex-col gap-2 md:max-w-2xl">
        {/* Label */}
        <div className={`flex items-center gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
            isUser
              ? 'border-white/20 bg-white text-black'
              : 'border-white/10 bg-mono-100 text-mono-600'
          }`}>
            {isUser ? <User size={13} strokeWidth={2.5} /> : <Sparkles size={13} />}
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-mono-400">
            {isUser ? 'You' : 'VibeCheck AI'}
          </span>
          {!isUser && safeText && (
            <button
              onClick={handleCopy}
              className="ml-1 inline-flex items-center gap-1 rounded-md border border-white/[0.06] px-2 py-0.5 text-[10px] font-medium tracking-wider text-mono-400 transition-colors hover:border-white/20 hover:text-white"
              title="Copy"
            >
              <Copy size={10} /> Copy
            </button>
          )}
        </div>

        {/* Bubble */}
        <div className={`relative flex ${isUser ? 'justify-end' : 'justify-start'}`}>
          <div className={`rounded-2xl px-5 py-4 text-sm leading-relaxed ${
            isUser
              ? 'rounded-tr-md bg-white text-black'
              : 'rounded-tl-md border border-white/[0.06] bg-mono-50 text-mono-800'
          }`}>
            {safeText && (
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {safeText}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Event Cards */}
        {message.events && message.events.length > 0 && (
          <div className="relative mt-2 w-full">
            <div className="hide-scrollbar flex w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-4 pt-1">
              {message.events.map((event) => {
                const isExternal = typeof event.id === 'string' && event.id.startsWith('http');
                const cardContent = (
                  <>
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-mono-100">
                      <img
                        src={event.image_url || 'https://image2url.com/images/1762671096133-8bcd549c-4ae7-4f31-b26f-39b9909ae90f.jpg'}
                        alt=""
                        className="h-full w-full object-cover grayscale-[20%] transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-mono-50 to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2">
                        <h4 className="line-clamp-2 text-[13px] font-bold leading-tight text-white">
                          {event.title}
                        </h4>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 px-1">
                      {event.start_time && (
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-mono-600">
                          <Calendar size={11} className="opacity-50" />
                          <span className="truncate">{formatShortDate(event.start_time)}</span>
                        </div>
                      )}
                      {event.location_name && (
                        <div className="flex items-center gap-1.5 text-[11px] text-mono-400">
                          <MapPin size={11} className="opacity-50" />
                          <span className="truncate">{event.location_name}</span>
                        </div>
                      )}
                    </div>
                  </>
                );

                const cardClass = "card-hover group relative flex w-60 shrink-0 snap-start flex-col gap-2 overflow-hidden rounded-2xl border border-white/[0.06] bg-mono-50 p-3 outline-none focus-visible:ring-1 focus-visible:ring-white/30";

                return isExternal ? (
                  <a key={event.id} href={event.id} target="_blank" rel="noopener noreferrer" className={cardClass}>
                    {cardContent}
                  </a>
                ) : (
                  <Link key={event.id} to={`/event/${event.id}`} className={cardClass}>
                    {cardContent}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
