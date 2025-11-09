import ChatInterface from '../components/ChatInterface';
import { MessageSquare, ShieldAlert, Info } from 'lucide-react';

export default function GlobalChatPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-gray-900">
      {/* Channel Header */}
      <header className="border-b border-gray-800 bg-gray-900/90 backdrop-blur supports-[backdrop-filter]:sticky supports-[backdrop-filter]:top-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-blue-300">
              <MessageSquare size={18} />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-white">#global</h1>
              <p className="text-xs text-gray-400">Campus-wide chat for SBU students</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-gray-400 sm:flex">
            <ShieldAlert size={14} />
            <span>Be respectful · No spam · Keep it SBU-appropriate</span>
          </div>
        </div>
      </header>

      {/* Two-column layout on desktop */}
      <div className="mx-auto grid h-full w-full max-w-6xl grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[minmax(0,1fr)_320px]">
        {/* Chat */}
        <div className="min-h-0"> 
          <ChatInterface
            channelId="global"
            className="h-full"
          />
        </div>

        {/* Sidebar */}
        <aside className="hidden h-full rounded-xl border border-gray-800 bg-gray-900/60 p-4 md:block">
          <div className="mb-4 flex items-center gap-2 text-blue-300">
            <Info size={16} />
            <h2 className="text-sm font-semibold uppercase tracking-wide">About #global</h2>
          </div>
          <ul className="space-y-3 text-sm text-gray-300">
            <li>• For quick questions, meetups, and campus chatter.</li>
            <li>• Follow University policies and community guidelines.</li>
            <li>• Don’t share personal info. Report issues to mods.</li>
          </ul>
          <div className="mt-6 rounded-lg bg-gray-800/60 p-3 text-xs text-gray-400">
            Tip: Press <kbd className="rounded bg-gray-700 px-1">Enter</kbd> to send, 
            <span className="ml-1"><kbd className="rounded bg-gray-700 px-1">Shift</kbd>+<kbd className="rounded bg-gray-700 px-1">Enter</kbd></span> for a new line.
          </div>
        </aside>
      </div>
    </div>
  );
}
