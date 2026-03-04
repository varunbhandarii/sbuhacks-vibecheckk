import { useCallback } from 'react';

interface TabSelectorProps {
  tabs: string[];
  selectedTab: string;
  onSelectTab: (tab: string) => void;
}

export default function TabSelector({ tabs, selectedTab, onSelectTab }: TabSelectorProps) {
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); onSelectTab(tabs[(idx + 1) % tabs.length]); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); onSelectTab(tabs[(idx - 1 + tabs.length) % tabs.length]); }
    },
    [onSelectTab, tabs]
  );

  return (
    <div className="border-b border-white/[0.06]">
      <nav className="-mb-px flex gap-6" aria-label="Tabs">
        {tabs.map((tab, idx) => {
          const isActive = tab === selectedTab;
          return (
            <button
              key={tab}
              onClick={() => onSelectTab(tab)}
              onKeyDown={(e) => onKeyDown(e, idx)}
              className={`shrink-0 border-b-2 px-1 pb-4 text-[13px] font-semibold uppercase tracking-wider outline-none transition-all ${
                isActive
                  ? 'border-white text-white'
                  : 'border-transparent text-mono-400 hover:border-mono-300 hover:text-mono-700'
              }`}
              aria-selected={isActive}
              role="tab"
            >
              {tab}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
