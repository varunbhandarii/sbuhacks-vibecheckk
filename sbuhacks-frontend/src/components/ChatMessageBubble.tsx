import React, { useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { type ChatMessage } from '../types';
import EventCard from './EventCard';
import { User, Sparkles, Copy } from 'lucide-react';

// Remove raw URLs from text (so model output can't show raw links)
const URL_RE = /<?https?:\/\/[^\s)>]+>?/gi;
function sanitizeText(input?: string) {
  if (!input) return '';
  let s = input.replace(URL_RE, '');
  // Remove empty parentheses leftover from link removal, collapse whitespace
  s = s.replace(/\(\s*\)/g, '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n');
  return s.trim();
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

  // Ensure <a> renders as plain text (no href)
  const markdownComponents: Components = {
    a({ children }) {
      return <>{children}</>;
    },
  };

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="flex max-w-3xl flex-col gap-2">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full ${
              isUser ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-100'
            }`}
          >
            {isUser ? <User size={16} /> : <Sparkles size={16} />}
          </div>
          <span className="text-sm font-semibold text-white">{isUser ? 'You' : 'VibeCheck AI'}</span>
          {!isUser && safeText && (
            <button
              onClick={handleCopy}
              className="ml-1 inline-flex items-center gap-1 rounded bg-gray-800 px-2 py-0.5 text-[11px] text-gray-300 hover:bg-gray-700"
              title="Copy"
            >
              <Copy size={12} /> Copy
            </button>
          )}
        </div>

        {/* Text Bubble */}
        <div
          className={`rounded-lg p-4 ${
            isUser ? 'rounded-br-none bg-blue-700 text-white' : 'rounded-bl-none bg-gray-800 text-gray-100'
          }`}
        >
          {safeText && (
            <div className="prose prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {safeText}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Events Carousel */}
        {message.events && message.events.length > 0 && (
          <div className="relative mt-1 w-[94vw] max-w-3xl overflow-x-auto py-2">
            <div className="flex w-max snap-x gap-4">
              {message.events.map((event) => (
                <div key={event.id} className="w-72 flex-shrink-0 snap-start">
                  <EventCard event={event} />
                </div>
              ))}
            </div>
            {/* edge fades */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-gray-900 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-gray-900 to-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
