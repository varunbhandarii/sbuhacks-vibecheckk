import { useCallback } from 'react';

interface TabSelectorProps {
  tabs: string[];
  selectedTab: string;
  onSelectTab: (tab: string) => void;
}

export default function TabSelector({ tabs, selectedTab, onSelectTab }: TabSelectorProps) {
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSelectTab(tabs[(idx + 1) % tabs.length]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSelectTab(tabs[(idx - 1 + tabs.length) % tabs.length]);
      }
    },
    [onSelectTab, tabs]
  );

  return (
    <div className="border-b border-gray-700">
      <nav className="-mb-px flex gap-6" aria-label="Tabs">
        {tabs.map((tab, idx) => {
          const isActive = tab === selectedTab;
          return (
            <button
              key={tab}
              onClick={() => onSelectTab(tab)}
              onKeyDown={(e) => onKeyDown(e, idx)}
              className={`shrink-0 border-b-2 px-1 pb-4 text-sm font-medium outline-none ${
                isActive
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-300'
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
