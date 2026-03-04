import React, { useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { type ChatMessage } from '../types';
import EventCard from './EventCard';
import { User, Sparkles, Copy, Calendar, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

// Remove raw URLs from text (so model output can't show raw links)
const URL_RE = /<?https?:\/\/[^\s)>]+>?/gi;
function sanitizeText(input?: string) {
  if (!input) return '';
  let s = input.replace(URL_RE, '');
  // Remove empty parentheses leftover from link removal, collapse whitespace
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
    try {
      await navigator.clipboard.writeText(safeText);
    } catch {
      // ignore
    }
  }, [safeText]);

  const markdownComponents: Components = {
    a({ children }) {
      return <span className="text-neon-pink underline decoration-neon-purple/50 decoration-dotted underline-offset-4">{children}</span>;
    },
    p({ children }) {
      return <p className="mb-3 last:mb-0 leading-relaxed tracking-wide text-gray-100">{children}</p>;
    },
    strong({ children }) {
      return <strong className="font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">{children}</strong>;
    },
    ul({ children }) {
      return <ul className="mb-3 ml-4 list-disc space-y-1 marker:text-neon-cyan">{children}</ul>;
    }
  };

  return (
    <div className={`msg-enter flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] flex-col gap-2 md:max-w-2xl`}>
        {/* Header */}
        <div className={`flex items-center gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl vol-shadow ${
              isUser 
                ? 'bg-gradient-to-br from-neon-pink to-neon-violet text-white ring-1 ring-white/20' 
                : 'glass-strong text-neon-cyan ring-1 ring-neon-cyan/30'
            }`}
          >
            {isUser ? <User size={16} strokeWidth={2.5} /> : <Sparkles size={16} className="animate-pulse-glow rounded-full" />}
          </div>
          
          <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">
            {isUser ? 'You' : 'VibeCheck AI'}
          </span>
          
          {!isUser && safeText && (
            <button
              onClick={handleCopy}
              className="ml-2 inline-flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-[10px] font-semibold tracking-wider text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              title="Copy"
            >
              <Copy size={12} /> COPY
            </button>
          )}
        </div>

        {/* Text Bubble */}
        <div className={`relative flex ${isUser ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`relative rounded-3xl p-5 text-sm md:text-base ${
              isUser 
                ? 'rounded-tr-sm bg-gradient-to-br from-neon-violet to-neon-pink text-white vol-shadow-lg ring-1 ring-white/10' 
                : 'glass rounded-tl-sm text-gray-100 vol-shadow-lg ring-1 ring-white/10'
            }`}
          >
            {/* Subtle inner highlight for 3D feel */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl rounded-tr-sm ring-1 ring-inset ring-white/20 mix-blend-overlay" />
            
            {safeText && (
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {safeText}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Inline Event Thumbnail Cards (AI only) */}
        {message.events && message.events.length > 0 && (
          <div className="relative mt-2 w-full">
            <div className="hide-scrollbar flex w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-4 pt-1">
              {message.events.map((event) => (
                <Link
                  key={event.id}
                  to={`/event/${event.id}`}
                  className="event-card-glow group relative flex w-64 shrink-0 snap-start flex-col gap-2 overflow-hidden rounded-2xl glass-strong p-3 outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-800">
                    <img 
                       src={event.image_url || 'https://image2url.com/images/1762671096133-8bcd549c-4ae7-4f31-b26f-39b9909ae90f.jpg'} 
                       alt="" 
                       className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                       <h4 className="line-clamp-2 text-sm font-extrabold leading-tight text-white drop-shadow-md">
                         {event.title}
                       </h4>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1 px-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-neon-cyan">
                      <Calendar size={12} className="opacity-80" />
                      <span className="truncate">{formatShortDate(event.start_time)}</span>
                    </div>
                    {event.location_name && (
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <MapPin size={12} className="opacity-80" />
                        <span className="truncate">{event.location_name}</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            {/* Fade edges for horizontal scroll indicator */}
            <div className="pointer-events-none absolute bottom-4 left-0 top-1 w-8 bg-gradient-to-r from-[#0d1017] to-transparent" />
            <div className="pointer-events-none absolute bottom-4 right-0 top-1 w-12 bg-gradient-to-l from-[#0d1017] to-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
