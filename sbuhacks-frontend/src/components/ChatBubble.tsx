import { type ChatMessageData } from '../types';
import { User } from 'lucide-react';

interface ChatBubbleProps {
  message: ChatMessageData;
  /** When true, render name/time/avatar. Consecutive messages from same user within a short window hide the header. */
  showHeader?: boolean;
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// naive linkify (http/https)
function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noreferrer" className="text-blue-400 underline hover:text-blue-300">
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export default function ChatBubble({ message, showHeader = true }: ChatBubbleProps) {
  const displayName = `User ${message.anon_id.substring(0, 6)}`;

  return (
    <div className="flex w-full justify-start">
      <div className="flex max-w-2xl flex-col gap-1">
        {showHeader && (
          <div className="ml-10 flex items-baseline gap-2">
            <span className="text-sm font-semibold text-white">{displayName}</span>
            <span className="text-xs text-gray-400">{formatTime(message.ts)}</span>
          </div>
        )}

        <div className="flex flex-row gap-2">
          {showHeader ? (
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-700 text-gray-200">
              <User size={16} />
            </span>
          ) : (
            <span className="h-8 w-8 flex-shrink-0" />
          )}

          <div className={`rounded-b-lg ${showHeader ? 'rounded-tr-lg' : 'rounded-t-lg'} bg-gray-800 p-3`}>
            <p className="whitespace-pre-wrap text-gray-100">
              {message.moderation_flag ? (
                <span className="italic text-gray-400">[Message removed]</span>
              ) : (
                linkify(message.message)
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
