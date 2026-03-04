import ChatInterface from '../components/ChatInterface';
import { MessageSquare, ShieldAlert, Info } from 'lucide-react';

export default function GlobalChatPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-black">
      {/* Channel Header */}
      <header className="border-b border-white/[0.06] bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-mono-50 text-mono-600">
              <MessageSquare size={16} />
            </span>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight text-white">#global</h1>
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-mono-400">Campus-wide chat</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-[11px] text-mono-400 sm:flex">
            <ShieldAlert size={13} className="opacity-50" />
            <span>Be respectful · No spam · Keep it SBU-appropriate</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto grid h-full w-full max-w-6xl grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-h-0">
          <ChatInterface channelId="global" className="h-full" />
        </div>

        {/* Sidebar */}
        <aside className="hidden h-full rounded-3xl border border-white/[0.06] bg-mono-50 p-5 md:block">
          <div className="mb-4 flex items-center gap-2 text-mono-500">
            <Info size={14} className="opacity-50" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em]">About #global</h2>
          </div>
          <ul className="space-y-3 text-[13px] text-mono-600">
            <li>• Quick questions, meetups, and campus chatter.</li>
            <li>• Follow University policies and guidelines.</li>
            <li>• Don't share personal info. Report issues.</li>
          </ul>
          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-mono-100 p-3 text-[11px] text-mono-400">
            <kbd className="rounded border border-white/10 bg-mono-150 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> to send,{' '}
            <kbd className="rounded border border-white/10 bg-mono-150 px-1.5 py-0.5 font-mono text-[10px]">Shift+Enter</kbd> for new line.
          </div>
        </aside>
      </div>
    </div>
  );
}
