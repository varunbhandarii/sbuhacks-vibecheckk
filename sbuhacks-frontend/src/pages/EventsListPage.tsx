import { useEffect, useMemo, useRef, useState } from 'react';
import { type SBUEvent, type SortOrder } from '../types';
import EventCard from '../components/EventCard';
import { ChevronDown, Filter, RefreshCw, Search, X, Loader2 } from 'lucide-react';

const RAW_API = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const API_BASE = (RAW_API ? RAW_API.replace(/^http:/, 'https:') : '').replace(/\/+$/, '');

const makeUrl = (path: string, params?: Record<string, string>) => {
  const url = new URL(path.replace(/^\/+/, ''), API_BASE + '/');
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
};

export default function EventsListPage() {
  // --- Data ---
  const [liveEvents, setLiveEvents] = useState<SBUEvent[]>([]);
  const [allEvents, setAllEvents] = useState<SBUEvent[]>([]);

  // --- Loading / error ---
  const [loadingLive, setLoadingLive] = useState(true);
  const [loadingAll, setLoadingAll] = useState(true);
  const [errorLive, setErrorLive] = useState<string | null>(null);
  const [errorAll, setErrorAll] = useState<string | null>(null);

  // --- UI state ---
  const [isLiveOpen, setIsLiveOpen] = useState(true);
  const [sortOrder, setSortOrder] = useState<SortOrder>('hyped');
  const [showPast, setShowPast] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);
  const [autoLoad, setAutoLoad] = useState(true);

  // Abort controllers
  const allAbortRef = useRef<AbortController | null>(null);
  const liveAbortRef = useRef<AbortController | null>(null);

  // Infinite-scroll sentinel
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Helpers
  const resetPagination = () => setVisibleCount(12);

  const getEventCategories = (e: SBUEvent): string[] => {
    const anyE = e as unknown as { category?: string; tags?: string[] };
    if (anyE?.category) return [anyE.category];
    if (Array.isArray(anyE?.tags)) return anyE.tags;
    return [];
  };

  const isEventPast = (e: SBUEvent) => {
    const anyE = e as unknown as { end_time?: string; start_time: string };
    const endOrStart = anyE.end_time ?? anyE.start_time;
    return new Date(endOrStart).getTime() < Date.now();
  };

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEvents) getEventCategories(e).forEach((c) => c && set.add(c));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    let arr = allEvents;
    if (!showPast) arr = arr.filter((e) => !isEventPast(e));

    if (selectedCategories.size > 0)
      arr = arr.filter((e) => getEventCategories(e).some((c) => selectedCategories.has(c)));

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter((e) => {
        const anyE = e as unknown as { location_name?: string; category?: string; tags?: string[] };
        const hay = [e.title, anyE.location_name, anyE.category, ...(anyE.tags ?? [])]
          .filter(Boolean)
          .join(' \u2002')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return arr;
  }, [allEvents, showPast, selectedCategories, query]);

  const hasMore = filteredEvents.length > visibleCount;

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
    resetPagination();
  };
  const clearCategories = () => setSelectedCategories(new Set());

  // --- Skeletons ---
  const EventCardSkeleton = () => (
    <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-gray-800 to-gray-900 p-4 shadow-lg">
      <div className="mb-3 h-44 w-full animate-pulse rounded-xl bg-gray-700/70" />
      <div className="mb-2 h-5 w-3/4 animate-pulse rounded bg-gray-700/80" />
      <div className="mb-2 h-4 w-1/3 animate-pulse rounded bg-gray-700/70" />
      <div className="mb-2 h-4 w-1/2 animate-pulse rounded bg-gray-700/60" />
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-16 animate-pulse rounded-full bg-gray-700/70" />
        <div className="h-6 w-16 animate-pulse rounded-full bg-gray-700/70" />
        <div className="h-6 w-16 animate-pulse rounded-full bg-gray-700/70" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 mix-blend-overlay transition-opacity duration-300 group-hover:opacity-100" />
    </div>
  );

  const renderSkeletonGrid = (count = 9) => (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );

  const SectionError = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-400/10 bg-red-900/30 p-4 text-red-100">
      <div className="inline-flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20">⚠️</span>
        <p className="text-sm">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg bg-red-700/80 px-3 py-1.5 text-sm font-medium hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
      >
        <RefreshCw size={16} /> Retry
      </button>
    </div>
  );

  // --- Fetch Live / Trending on mount ---
  useEffect(() => {
    async function fetchLiveEvents() {
      try {
        setLoadingLive(true);
        setErrorLive(null);
        if (liveAbortRef.current) liveAbortRef.current.abort();
        const controller = new AbortController();
        liveAbortRef.current = controller;

        const res = await fetch(makeUrl('/events/recommendations'), { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to fetch live events');
        setLiveEvents(await res.json());
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') {
          setErrorLive(err instanceof Error ? err.message : 'An unknown error occurred');
        }
      } finally {
        setLoadingLive(false);
      }
    }

    fetchLiveEvents();
    return () => liveAbortRef.current?.abort();
  }, []);

  // --- Fetch ALL events when sort changes ---
  useEffect(() => {
    async function fetchAllEvents() {
      try {
        setLoadingAll(true);
        setErrorAll(null);
        resetPagination();
        if (allAbortRef.current) allAbortRef.current.abort();
        const controller = new AbortController();
        allAbortRef.current = controller;

        let res = await fetch(makeUrl('events/', { filter: 'all', sort: sortOrder }), {
          signal: controller.signal,
        });
        if (!res.ok) {
          res = await fetch(makeUrl('events/', { sort: sortOrder }), { signal: controller.signal });
          if (!res.ok) throw new Error('Failed to fetch events');
        }
        const data: SBUEvent[] = await res.json();
        setAllEvents(data);
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') {
          setErrorAll(err instanceof Error ? err.message : 'An unknown error occurred');
        }
      } finally {
        setLoadingAll(false);
      }
    }

    fetchAllEvents();
    return () => allAbortRef.current?.abort();
  }, [sortOrder]);

  // --- Retry handlers ---
  const retryLive = () => {
    (async () => {
      try {
        setLoadingLive(true);
        setErrorLive(null);
        if (liveAbortRef.current) liveAbortRef.current.abort();
        const controller = new AbortController();
        liveAbortRef.current = controller;
        const res = await fetch(makeUrl('/events/recommendations'), { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to fetch live events');
        setLiveEvents(await res.json());
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') {
          setErrorLive(err instanceof Error ? err.message : 'An unknown error occurred');
        }
      } finally {
        setLoadingLive(false);
      }
    })();
  };

  const retryAll = () => {
    (async () => {
      try {
        setLoadingAll(true);
        setErrorAll(null);
        if (allAbortRef.current) allAbortRef.current.abort();
        const controller = new AbortController();
        allAbortRef.current = controller;

        let res = await fetch(makeUrl('events/', { filter: 'all', sort: sortOrder }), {
          signal: controller.signal,
        });
        if (!res.ok) {
          res = await fetch(makeUrl('events/', { sort: sortOrder }), { signal: controller.signal });
          if (!res.ok) throw new Error('Failed to fetch events');
        }
        setAllEvents(await res.json());
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') {
          setErrorAll(err instanceof Error ? err.message : 'An unknown error occurred');
        }
      } finally {
        setLoadingAll(false);
      }
    })();
  };

  // --- Auto-load on scroll ---
  useEffect(() => {
    if (!autoLoad) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) setVisibleCount((v) => (filteredEvents.length > v ? v + 12 : v));
      });
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [autoLoad, filteredEvents.length]);

  // --- UI ---
  return (
    <div className="px-4 pb-12 pt-2 md:px-8">
      {/* Hero / Heading */}
      <section className="relative mb-8 overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-blue-900/40 via-indigo-900/30 to-gray-900">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_70%_20%,rgba(99,102,241,.25)_0%,rgba(15,23,42,0)_60%)]" />
        <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Discover what's happening</h1>
            <p className="mt-1 text-sm text-gray-300">Find the vibe, RSVP, and never miss out again.</p>
          </div>
          <div className="flex gap-3">
            <StatPill label="Live" value={loadingLive ? '—' : String(liveEvents.length)} />
            <StatPill label="All" value={loadingAll ? '—' : String(allEvents.length)} />
            <button
              onClick={() => { retryLive(); retryAll(); }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium backdrop-blur hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Refresh events"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>
      </section>

      {/* Live & Trending */}
      <section className="mb-10">
        <button
          onClick={() => setIsLiveOpen((v) => !v)}
          aria-expanded={isLiveOpen}
          aria-controls="live-section"
          className="group flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <h2 className="text-2xl font-bold">🔥 Live & Trending{!loadingLive && liveEvents.length > 0 && (<span className="ml-2 align-middle text-sm text-gray-400">({liveEvents.length})</span>)}</h2>
          <ChevronDown size={24} className={`transition-transform duration-200 ${isLiveOpen ? 'rotate-180' : 'rotate-0'}`} aria-hidden="true" />
        </button>

        {isLiveOpen && (
          <div id="live-section" className="mt-4">
            {loadingLive && renderSkeletonGrid(6)}
            {!loadingLive && errorLive && <SectionError message={errorLive} onRetry={retryLive} />}
            {!loadingLive && !errorLive && liveEvents.length === 0 && (
              <EmptyState title="No live or trending events" caption="Check back soon — the vibe changes fast." />
            )}
            {!loadingLive && !errorLive && liveEvents.length > 0 && (
              <div className="-mx-2 flex snap-x snap-mandatory gap-4 overflow-x-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {liveEvents.map((event) => (
                  <div key={event.id} className="min-w-[290px] snap-start sm:min-w-[360px]">
                    <EventCard event={event} variant="featured" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <hr className="my-6 border-white/10" />

      {/* Toolbar */}
      <div className="sticky top-0 z-10 -mx-4 mb-5 border-b border-white/10 bg-gray-950/70 backdrop-blur md:-mx-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <h3 className="text-xl font-semibold">All Events <span className="text-sm text-gray-400">{!loadingAll && `(${filteredEvents.length})`}</span></h3>
          <div className="flex flex-1 flex-wrap items-center gap-3 md:justify-end">
            {/* Search */}
            <label className="relative inline-flex w-full max-w-md items-center" aria-label="Search events">
              <span className="pointer-events-none absolute left-3 text-gray-400"><Search size={16} /></span>
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); resetPagination(); }}
                placeholder="Search titles, tags, places…"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); resetPagination(); }}
                  className="absolute right-2 rounded-md p-1 text-gray-400 hover:text-gray-200"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </label>

            {/* Sort */}
            <div className="inline-flex items-center gap-2">
              <span className="text-sm text-gray-300">Sort</span>
              <select
                value={sortOrder}
                onChange={(e) => { setSortOrder(e.target.value as SortOrder); resetPagination(); }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Sort events"
              >
                <option value="hyped">Most hyped</option>
                <option value="time">Soonest</option>
              </select>
            </div>

            {/* Show past toggle */}
            <button
              onClick={() => { setShowPast((v) => !v); resetPagination(); }}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${showPast ? 'border-blue-400/30 bg-blue-500/10' : 'border-white/10 bg-white/5'}`}
              aria-pressed={showPast}
              aria-label="Toggle past events"
            >
              <Filter size={16} /> {showPast ? 'Showing past' : 'Hide past'}
            </button>

            {/* Auto-load toggle */}
            <button
              onClick={() => setAutoLoad((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${autoLoad ? 'border-green-400/30 bg-green-500/10' : 'border-white/10 bg-white/5'}`}
              aria-pressed={autoLoad}
            >
              {autoLoad ? 'Auto-load on scroll' : 'Manual load'}
            </button>
          </div>
        </div>
      </div>

      {/* Category chips */}
      <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm text-gray-300">
          <Filter size={16} />
          <span>Filter by category</span>
          {selectedCategories.size > 0 && (
            <button
              onClick={clearCategories}
              className="ml-auto inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-gray-200 hover:bg-white/10"
              title="Clear selected categories"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {loadingAll ? (
          <div className="h-7 w-full animate-pulse rounded bg-gray-700/70" />
        ) : uniqueCategories.length === 0 ? (
          <p className="text-sm text-gray-400">No categories found.</p>
        ) : (
          <div className="relative -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* gradient masks */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-gray-900 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-gray-900 to-transparent" />
            {uniqueCategories.map((cat) => {
              const active = selectedCategories.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-white/5 text-gray-200 hover:bg-white/10'}`}
                  aria-pressed={active}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      {loadingAll && renderSkeletonGrid(12)}

      {!loadingAll && errorAll && <SectionError message={errorAll} onRetry={retryAll} />}

      {!loadingAll && !errorAll && (
        <>
          {filteredEvents.length === 0 ? (
            <EmptyState title="No events match your filters" caption="Try clearing some filters or searching for a different term." />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredEvents.slice(0, visibleCount).map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>

              <div ref={loadMoreRef} className="h-2" />

              {hasMore && (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => setVisibleCount((v) => v + 12)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {autoLoad ? <Loader2 size={16} className="animate-spin" /> : null}
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// --- Little UI bits ---
function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-center">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function EmptyState({ title, caption }: { title: string; caption?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[.03] p-8 text-center">
      <div className="text-3xl">🕶️</div>
      <h4 className="text-lg font-semibold">{title}</h4>
      {caption && <p className="max-w-md text-sm text-gray-400">{caption}</p>}
    </div>
  );
}

