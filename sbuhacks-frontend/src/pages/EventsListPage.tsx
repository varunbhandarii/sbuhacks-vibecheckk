import { useEffect, useMemo, useRef, useState } from 'react';
import { type SBUEvent, type SortOrder } from '../types';
import EventCard from '../components/EventCard';
import { ChevronDown, Filter, RefreshCw, Search, X, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const RAW_API = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const API_BASE = (RAW_API ? RAW_API.replace(/^http:/, 'https:') : '').replace(/\/+$/, '');

const makeUrl = (path: string, params?: Record<string, string>) => {
  const url = new URL(path.replace(/^\/+/, ''), API_BASE + '/');
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
};

export default function EventsListPage() {
  const [liveEvents, setLiveEvents] = useState<SBUEvent[]>([]);
  const [allEvents, setAllEvents] = useState<SBUEvent[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [loadingAll, setLoadingAll] = useState(true);
  const [errorLive, setErrorLive] = useState<string | null>(null);
  const [errorAll, setErrorAll] = useState<string | null>(null);

  const [isLiveOpen, setIsLiveOpen] = useState(true);
  const [sortOrder, setSortOrder] = useState<SortOrder>('hyped');
  const [showPast, setShowPast] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);
  const [autoLoad, setAutoLoad] = useState(true);

  const allAbortRef = useRef<AbortController | null>(null);
  const liveAbortRef = useRef<AbortController | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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
          .filter(Boolean).join(' \u2002').toLowerCase();
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

  const EventCardSkeleton = () => (
    <div className="group relative overflow-hidden rounded-[24px] glass-strong p-5">
      <div className="mb-4 h-48 w-full animate-pulse rounded-xl bg-gray-700/50" />
      <div className="mb-3 h-6 w-3/4 animate-pulse rounded bg-gray-700/60" />
      <div className="mb-2 h-4 w-1/3 animate-pulse rounded bg-gray-700/40" />
      <div className="mt-6 flex gap-3 border-t border-white/5 pt-4">
        <div className="h-6 w-16 animate-pulse rounded-full bg-gray-700/50" />
        <div className="h-6 w-16 animate-pulse rounded-full bg-gray-700/50" />
      </div>
    </div>
  );

  const renderSkeletonGrid = (count = 9) => (
    <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => <EventCardSkeleton key={i} />)}
    </div>
  );

  const SectionError = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[24px] border border-red-500/20 glass bg-red-900/10 p-6 text-red-200">
      <div className="inline-flex items-center gap-2 font-bold tracking-wide">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400">⚠️</span>
        {message}
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-xl bg-red-500/20 px-4 py-2 text-sm font-bold text-red-300 transition-colors hover:bg-red-500/30 focus:outline-none focus:ring-2 focus:ring-red-500/50"
      >
        <RefreshCw size={16} /> RETRY
      </button>
    </div>
  );

  useEffect(() => {
    async function fetchLiveEvents() {
      try {
        setLoadingLive(true); setErrorLive(null);
        if (liveAbortRef.current) liveAbortRef.current.abort();
        const c = new AbortController(); liveAbortRef.current = c;
        const res = await fetch(makeUrl('/events/recommendations'), { signal: c.signal });
        if (!res.ok) throw new Error('Failed to fetch live events');
        setLiveEvents(await res.json());
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') setErrorLive(err instanceof Error ? err.message : 'Error');
      } finally { setLoadingLive(false); }
    }
    fetchLiveEvents();
    return () => liveAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    async function fetchAllEvents() {
      try {
        setLoadingAll(true); setErrorAll(null); resetPagination();
        if (allAbortRef.current) allAbortRef.current.abort();
        const c = new AbortController(); allAbortRef.current = c;
        let res = await fetch(makeUrl('events/', { filter: 'all', sort: sortOrder }), { signal: c.signal });
        if (!res.ok) {
          res = await fetch(makeUrl('events/', { sort: sortOrder }), { signal: c.signal });
          if (!res.ok) throw new Error('Failed to fetch events');
        }
        setAllEvents(await res.json());
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') setErrorAll(err instanceof Error ? err.message : 'Error');
      } finally { setLoadingAll(false); }
    }
    fetchAllEvents();
    return () => allAbortRef.current?.abort();
  }, [sortOrder]);

  const retryLive = () => { /* reuse effect logic */ };
  const retryAll = () => { /* reuse effect logic */ };

  useEffect(() => {
    if (!autoLoad) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) setVisibleCount((v) => (filteredEvents.length > v ? v + 12 : v));
      });
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [autoLoad, filteredEvents.length]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050508] px-4 pb-16 pt-6 sm:px-6 md:px-8 lg:px-12 selection:bg-neon-cyan/30">
      
      {/* Animated Mesh Background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-20 mix-blend-screen">
        <div className="animate-aurora-2 absolute -right-[10%] -top-[10%] h-[60vh] w-[60vw] rounded-full bg-neon-cyan/30 blur-[120px]" />
        <div className="animate-aurora-1 absolute left-[0%] top-[40%] h-[50vh] w-[40vw] rounded-full bg-neon-purple/20 blur-[100px]" />
        <div className="animate-aurora-3 absolute bottom-[-10%] right-[20%] h-[40vh] w-[60vw] rounded-full bg-neon-pink/20 blur-[130px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Hero Section */}
        <section className="relative mb-10 overflow-hidden rounded-[32px] glass vol-shadow-lg p-6 sm:p-10 lg:p-12">
          {/* subtle noise/grid overlay if we wanted, for now just gradient */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-neon-purple/10 to-transparent mix-blend-overlay" />
          
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-neon-cyan ring-1 ring-white/10 w-fit backdrop-blur-md">
                <Sparkles size={14} className="animate-pulse-glow" /> Campus Hub
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 drop-shadow-sm">
                Discover your<br/>next vibe.
              </h1>
              <p className="max-w-xl text-base sm:text-lg font-medium text-gray-400">
                Find exactly what's happening right now, reserve your spot, and never miss out on campus life.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-4">
              <Link to="/ai" className="group flex flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-neon-purple to-neon-pink p-4 min-w-[120px] vol-shadow transition-all hover:-translate-y-1 hover:scale-105 active:scale-95">
                <Wand2 size={24} className="text-white drop-shadow-md group-hover:rotate-12 transition-transform" />
                <span className="text-[11px] font-black uppercase tracking-widest text-white mt-1">Ask AI</span>
              </Link>
              <StatPill label="Live Now" value={loadingLive ? '—' : String(liveEvents.length)} border="neon-cyan" />
              <StatPill label="Total Events" value={loadingAll ? '—' : String(allEvents.length)} border="white/10" />
            </div>
          </div>
        </section>

        {/* Live & Trending */}
        <section className="mb-12">
          <button
            onClick={() => setIsLiveOpen((v) => !v)}
            aria-expanded={isLiveOpen}
            className="group flex w-full items-center justify-between rounded-2xl glass px-5 py-4 focus:outline-none focus:ring-2 focus:ring-neon-purple transition-colors hover:bg-white/10"
          >
            <h2 className="text-2xl font-black tracking-tight text-white drop-shadow-sm">
              🔥 Live & Trending
              {!loadingLive && liveEvents.length > 0 && (
                <span className="ml-3 inline-flex items-center justify-center rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400 ring-1 ring-red-500/30 align-middle">
                  {liveEvents.length}
                </span>
              )}
            </h2>
            <ChevronDown size={24} className={`text-gray-400 transition-transform duration-300 ${isLiveOpen ? 'rotate-180' : 'rotate-0'}`} />
          </button>

          {isLiveOpen && (
            <div className="mt-6">
              {loadingLive && renderSkeletonGrid(3)}
              {!loadingLive && errorLive && <SectionError message={errorLive} onRetry={retryLive} />}
              {!loadingLive && !errorLive && liveEvents.length === 0 && (
                <EmptyState title="Quiet right now" caption="No trending events at the moment. Check back later." icon="🌙" />
              )}
              {!loadingLive && !errorLive && liveEvents.length > 0 && (
                <div className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-8 hide-scrollbar">
                  {liveEvents.map((event) => (
                    <div key={event.id} className="w-[85vw] max-w-[400px] shrink-0 snap-start sm:w-[380px]">
                      <EventCard event={event} variant="featured" />
                    </div>
                  ))}
                  {/* phantom element for end padding */}
                  <div className="w-1 shrink-0 snap-start" />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Toolbar (Glass Sticky) */}
        <div className="sticky top-16 z-30 -mx-4 mb-8 glass-strong border-x-0 border-y border-white/10 px-4 py-4 shadow-2xl backdrop-blur-xl sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 lg:-mx-12 lg:px-12">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h3 className="text-xl font-bold tracking-tight text-white">
              All Events 
              <span className="ml-2 text-sm font-medium text-neon-cyan/80">
                {!loadingAll && `(${filteredEvents.length})`}
              </span>
            </h3>
            
            <div className="flex flex-1 flex-wrap items-center gap-3 md:justify-end">
              {/* Search */}
              <div className="relative flex w-full max-w-md items-center group">
                <span className="pointer-events-none absolute left-4 text-neon-cyan/50 transition-colors group-focus-within:text-neon-cyan">
                  <Search size={18} />
                </span>
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); resetPagination(); }}
                  placeholder="Search vibes..."
                  className="w-full rounded-full border border-white/10 bg-black/40 py-2.5 pl-11 pr-10 text-sm font-medium text-white placeholder:text-gray-500 transition-all focus:border-neon-cyan/50 focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-neon-cyan/50 vol-shadow"
                />
                {query && (
                  <button onClick={() => { setQuery(''); resetPagination(); }} className="absolute right-3 rounded-full bg-white/10 p-1 text-gray-300 transition-colors hover:bg-white/20 hover:text-white">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Sort */}
              <select
                value={sortOrder}
                onChange={(e) => { setSortOrder(e.target.value as SortOrder); resetPagination(); }}
                className="cursor-pointer appearance-none rounded-full border border-white/10 bg-black/40 px-5 py-2.5 text-sm font-bold text-gray-200 transition-colors hover:bg-black/60 focus:border-neon-purple focus:outline-none focus:ring-1 focus:ring-neon-purple vol-shadow"
              >
                <option value="hyped">🔥 Hyped</option>
                <option value="time">⏰ Soonest</option>
              </select>

              {/* Toggles */}
              <button
                onClick={() => { setShowPast((v) => !v); resetPagination(); }}
                className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold transition-all vol-shadow ${showPast ? 'border-neon-pink/50 bg-neon-pink/20 text-neon-pink' : 'border-white/10 bg-black/40 text-gray-400 hover:text-white'}`}
              >
                <Filter size={16} /> {showPast ? 'Past visible' : 'Hide past'}
              </button>
            </div>
          </div>
        </div>

        {/* Category chips */}
        <div className="mb-10 px-1">
          {loadingAll ? (
            <div className="h-10 w-full animate-pulse rounded-2xl bg-gray-800/50" />
          ) : uniqueCategories.length > 0 && (
            <div className="relative flex items-center">
              <div className="flex w-full snap-x gap-3 overflow-x-auto hide-scrollbar py-2">
                {uniqueCategories.map((cat) => {
                  const active = selectedCategories.has(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`shrink-0 snap-start whitespace-nowrap rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wider transition-all vol-shadow ${
                        active 
                          ? 'bg-gradient-to-r from-neon-purple to-neon-pink text-white ring-1 ring-white/20' 
                          : 'glass text-gray-300 ring-1 ring-white/5 hover:-translate-y-0.5 hover:ring-white/20 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#050508] to-transparent" />
            </div>
          )}
        </div>

        {/* Main Grid Content */}
        {loadingAll && renderSkeletonGrid(12)}
        {!loadingAll && errorAll && <SectionError message={errorAll} onRetry={retryAll} />}
        
        {!loadingAll && !errorAll && (
          <>
            {filteredEvents.length === 0 ? (
              <EmptyState title="Nothing found." caption="Your filters are too strict. Loosen up and try again." icon="🏜️" />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredEvents.slice(0, visibleCount).map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>

                <div ref={loadMoreRef} className="h-4" />

                {hasMore && (
                  <div className="mt-12 flex justify-center pb-12">
                    <button
                      onClick={() => setVisibleCount((v) => v + 12)}
                      className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full glass-strong px-8 py-4 font-bold tracking-widest text-white uppercase text-xs transition-all hover:scale-105 active:scale-95 vol-shadow ring-1 ring-white/10"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-neon-purple/20 to-neon-pink/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      {autoLoad ? <Loader2 size={18} className="animate-spin text-neon-cyan" /> : <ChevronDown size={18} className="text-neon-cyan" />}
                      <span className="relative z-10">Load More</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- Hyperstylized UI bits ---
function StatPill({ label, value, border = 'white/10' }: { label: string; value: string; border?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl glass px-6 py-3 min-w-[110px] ring-1 ring-${border} vol-shadow`}>
      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-black text-white drop-shadow-md">{value}</div>
    </div>
  );
}

function EmptyState({ title, caption, icon = '🕶️' }: { title: string; caption?: string; icon?: string }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 rounded-3xl border border-white/5 glass p-12 text-center vol-shadow-lg">
      <div className="text-6xl drop-shadow-2xl mb-2">{icon}</div>
      <h4 className="text-2xl font-black tracking-tight text-white">{title}</h4>
      {caption && <p className="max-w-md text-sm font-medium text-gray-400">{caption}</p>}
    </div>
  );
}
