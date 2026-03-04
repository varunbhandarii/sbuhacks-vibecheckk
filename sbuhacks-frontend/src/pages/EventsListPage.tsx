import { useEffect, useMemo, useRef, useState } from 'react';
import { type SBUEvent, type SortOrder } from '../types';
import EventCard from '../components/EventCard';
import { ChevronDown, Filter, RefreshCw, Search, X, Loader2, Wand2 } from 'lucide-react';
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
    return new Date(anyE.end_time ?? anyE.start_time).getTime() < Date.now();
  };

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEvents) getEventCategories(e).forEach((c) => c && set.add(c));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    let arr = allEvents;
    if (!showPast) arr = arr.filter((e) => !isEventPast(e));
    if (selectedCategories.size > 0) arr = arr.filter((e) => getEventCategories(e).some((c) => selectedCategories.has(c)));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter((e) => {
        const anyE = e as unknown as { location_name?: string; category?: string; tags?: string[] };
        return [e.title, anyE.location_name, anyE.category, ...(anyE.tags ?? [])].filter(Boolean).join(' ').toLowerCase().includes(q);
      });
    }
    return arr;
  }, [allEvents, showPast, selectedCategories, query]);

  const hasMore = filteredEvents.length > visibleCount;
  const toggleCategory = (cat: string) => { setSelectedCategories((prev) => { const next = new Set(prev); next.has(cat) ? next.delete(cat) : next.add(cat); return next; }); resetPagination(); };
  const clearCategories = () => setSelectedCategories(new Set());

  const SkeletonCard = () => (
    <div className="overflow-hidden rounded-3xl border border-white/[0.06] bg-mono-50 p-5">
      <div className="mb-4 h-44 w-full animate-pulse rounded-2xl bg-mono-150" />
      <div className="mb-3 h-5 w-3/4 animate-pulse rounded bg-mono-150" />
      <div className="mb-2 h-4 w-1/3 animate-pulse rounded bg-mono-100" />
      <div className="mt-6 flex gap-3 border-t border-white/[0.04] pt-4">
        <div className="h-5 w-14 animate-pulse rounded-full bg-mono-100" />
        <div className="h-5 w-14 animate-pulse rounded-full bg-mono-100" />
      </div>
    </div>
  );
  const renderSkeletonGrid = (count = 8) => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}</div>
  );

  const SectionError = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/[0.06] bg-mono-50 p-8 text-mono-600">
      <p className="text-[13px] font-medium">{message}</p>
      <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-white transition-all hover:bg-white hover:text-black">
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  );

  useEffect(() => {
    async function fetchLiveEvents() {
      try { setLoadingLive(true); setErrorLive(null); if (liveAbortRef.current) liveAbortRef.current.abort(); const c = new AbortController(); liveAbortRef.current = c; const res = await fetch(makeUrl('/events/recommendations'), { signal: c.signal }); if (!res.ok) throw new Error('Failed to fetch live events'); setLiveEvents(await res.json()); } catch (err) { if ((err as any)?.name !== 'AbortError') setErrorLive(err instanceof Error ? err.message : 'Error'); } finally { setLoadingLive(false); }
    }
    fetchLiveEvents();
    return () => liveAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    async function fetchAllEvents() {
      try { setLoadingAll(true); setErrorAll(null); resetPagination(); if (allAbortRef.current) allAbortRef.current.abort(); const c = new AbortController(); allAbortRef.current = c; let res = await fetch(makeUrl('events/', { filter: 'all', sort: sortOrder }), { signal: c.signal }); if (!res.ok) { res = await fetch(makeUrl('events/', { sort: sortOrder }), { signal: c.signal }); if (!res.ok) throw new Error('Failed to fetch events'); } setAllEvents(await res.json()); } catch (err) { if ((err as any)?.name !== 'AbortError') setErrorAll(err instanceof Error ? err.message : 'Error'); } finally { setLoadingAll(false); }
    }
    fetchAllEvents();
    return () => allAbortRef.current?.abort();
  }, [sortOrder]);

  const retryLive = () => { setLoadingLive(true); setErrorLive(null); };
  const retryAll = () => { setLoadingAll(true); setErrorAll(null); };

  useEffect(() => {
    if (!autoLoad) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => { entries.forEach((e) => { if (e.isIntersecting) setVisibleCount((v) => (filteredEvents.length > v ? v + 12 : v)); }); }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [autoLoad, filteredEvents.length]);

  return (
    <div className="min-h-screen bg-black px-4 pb-16 pt-8 sm:px-6 md:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">

        {/* Hero */}
        <section className="mb-16 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-5xl font-extrabold tracking-tighter text-white sm:text-6xl lg:text-8xl">
              Discover<br/>your next<br/>vibe.
            </h1>
            <p className="max-w-md text-base font-medium text-mono-500">
              Find what's happening on campus. RSVP. Never miss out.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-4">
            <Link to="/ai" className="group flex items-center gap-2 rounded-full border border-white/20 bg-white px-5 py-3 text-[13px] font-bold uppercase tracking-wider text-black transition-all hover:scale-105 active:scale-95">
              <Wand2 size={16} className="group-hover:rotate-12 transition-transform" /> Ask AI
            </Link>
            <StatPill label="Live" value={loadingLive ? '—' : String(liveEvents.length)} />
            <StatPill label="Total" value={loadingAll ? '—' : String(allEvents.length)} />
          </div>
        </section>

        {/* Live & Trending */}
        <section className="mb-16">
          <button onClick={() => setIsLiveOpen((v) => !v)} aria-expanded={isLiveOpen}
            className="group flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-mono-50 px-6 py-4 transition-colors hover:bg-mono-100">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Live & Trending
              {!loadingLive && liveEvents.length > 0 && <span className="ml-3 text-[13px] font-medium text-mono-400">({liveEvents.length})</span>}
            </h2>
            <ChevronDown size={20} className={`text-mono-400 transition-transform duration-300 ${isLiveOpen ? 'rotate-180' : ''}`} />
          </button>
          {isLiveOpen && (
            <div className="mt-6">
              {loadingLive && renderSkeletonGrid(3)}
              {!loadingLive && errorLive && <SectionError message={errorLive} onRetry={retryLive} />}
              {!loadingLive && !errorLive && liveEvents.length === 0 && <EmptyState title="Nothing live right now" caption="Check back later." />}
              {!loadingLive && !errorLive && liveEvents.length > 0 && (
                <div className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-6 hide-scrollbar">
                  {liveEvents.map((event) => (
                    <div key={event.id} className="w-[85vw] max-w-[380px] shrink-0 snap-start">
                      <EventCard event={event} variant="featured" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Divider */}
        <div className="mb-8 h-px bg-white/[0.06]" />

        {/* Sticky Toolbar */}
        <div className="sticky top-[57px] z-30 -mx-4 mb-8 border-b border-white/[0.06] bg-black/90 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 lg:-mx-12 lg:px-12">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h3 className="text-lg font-bold tracking-tight text-white">
              All Events <span className="ml-1 text-[13px] font-medium text-mono-400">{!loadingAll && `(${filteredEvents.length})`}</span>
            </h3>
            <div className="flex flex-1 flex-wrap items-center gap-3 md:justify-end">
              <div className="relative flex w-full max-w-sm items-center group">
                <span className="pointer-events-none absolute left-3.5 text-mono-400 transition-colors group-focus-within:text-white"><Search size={16} /></span>
                <input value={query} onChange={(e) => { setQuery(e.target.value); resetPagination(); }}
                  placeholder="Search..."
                  className="w-full rounded-full border border-white/[0.08] bg-mono-50 py-2.5 pl-10 pr-9 text-[13px] font-medium text-white placeholder-mono-400 transition-all focus:border-white/20 focus:outline-none" />
                {query && <button onClick={() => { setQuery(''); resetPagination(); }} className="absolute right-3 text-mono-400 hover:text-white"><X size={14} /></button>}
              </div>
              <select value={sortOrder} onChange={(e) => { setSortOrder(e.target.value as SortOrder); resetPagination(); }}
                className="cursor-pointer rounded-full border border-white/[0.08] bg-mono-50 px-4 py-2.5 text-[13px] font-semibold text-mono-700 focus:border-white/20 focus:outline-none">
                <option value="hyped">Most Hyped</option>
                <option value="time">Soonest</option>
              </select>
              <button onClick={() => { setShowPast((v) => !v); resetPagination(); }}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold transition-all ${showPast ? 'border-white/30 bg-white text-black' : 'border-white/[0.08] bg-mono-50 text-mono-500 hover:text-white'}`}>
                <Filter size={14} /> {showPast ? 'Past visible' : 'Hide past'}
              </button>
            </div>
          </div>
        </div>

        {/* Categories */}
        {!loadingAll && uniqueCategories.length > 0 && (
          <div className="mb-10 flex items-center gap-2">
            <div className="flex flex-1 snap-x gap-2 overflow-x-auto hide-scrollbar py-1">
              {uniqueCategories.map((cat) => {
                const active = selectedCategories.has(cat);
                return (
                  <button key={cat} onClick={() => toggleCategory(cat)}
                    className={`shrink-0 snap-start whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-wider transition-all ${
                      active ? 'bg-white text-black' : 'border border-white/[0.06] bg-mono-50 text-mono-500 hover:border-white/15 hover:text-white'
                    }`}>{cat}</button>
                );
              })}
            </div>
            {selectedCategories.size > 0 && (
              <button onClick={clearCategories} className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-mono-400 hover:text-white">Clear</button>
            )}
          </div>
        )}

        {/* Grid */}
        {loadingAll && renderSkeletonGrid(12)}
        {!loadingAll && errorAll && <SectionError message={errorAll} onRetry={retryAll} />}
        {!loadingAll && !errorAll && (
          <>
            {filteredEvents.length === 0 ? (
              <EmptyState title="No events found" caption="Try different filters." />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredEvents.slice(0, visibleCount).map((event) => <EventCard key={event.id} event={event} />)}
                </div>
                <div ref={loadMoreRef} className="h-4" />
                {hasMore && (
                  <div className="mt-12 flex justify-center">
                    <button onClick={() => setVisibleCount((v) => v + 12)}
                      className="group inline-flex items-center gap-2 rounded-full border border-white/10 px-6 py-3 text-[12px] font-semibold uppercase tracking-wider text-white transition-all hover:bg-white hover:text-black">
                      {autoLoad ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />} Load More
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

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/[0.06] bg-mono-50 px-6 py-3 min-w-[100px]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-mono-400">{label}</div>
      <div className="mt-0.5 text-xl font-bold text-white">{value}</div>
    </div>
  );
}

function EmptyState({ title, caption }: { title: string; caption?: string }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-2 rounded-3xl border border-white/[0.06] bg-mono-50 p-12 text-center">
      <h4 className="text-lg font-bold text-white">{title}</h4>
      {caption && <p className="text-[13px] text-mono-500">{caption}</p>}
    </div>
  );
}
