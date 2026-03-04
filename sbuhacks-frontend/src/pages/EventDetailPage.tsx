import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { type SBUEvent } from '../types';
import VibeBadge from '../components/VibeBadge';
import VibeCheckModal from '../components/VibeCheckModal';
import { useAuth } from '../contexts/AuthContext';
import RSVPControls from '../components/RSVPControls';
import ChatInterface from '../components/ChatInterface';
import TabSelector from '../components/TabSelector';
import PhotoGallery from '../components/PhotoGallery';
import PhotoUpload from '../components/PhotoUpload';
import EventFeedbackForm from '../components/EventFeedbackForm';
import EventFeedbackList from '../components/EventFeedbackList';
import { CalendarPlus, MapPin, Share2, Clock } from 'lucide-react';

const FALLBACK_IMG = 'https://image2url.com/images/1762671096133-8bcd549c-4ae7-4f31-b26f-39b9909ae90f.jpg';

const RAW_HTTP = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const API_BASE = RAW_HTTP ? RAW_HTTP.replace(/^http:/i, 'https:').replace(/\/+$/, '') : '';
const makeUrl = (path: string, params?: Record<string, string | number | boolean>) => {
  const url = new URL(path.replace(/^\/+/, ''), API_BASE + '/');
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  return url.toString();
};

function formatDateTime(dateString: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'America/New_York',
  }).format(new Date(dateString));
}

function googleCalendarUrl(e: SBUEvent) {
  const toGCal = (d: string) => new Date(d).toISOString().replace(/[-:]|\.\\d{3}/g, '').replace('.000', '');
  const dates = `${toGCal(e.start_time)}/${toGCal(e.end_time)}`;
  const params = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates, details: e.description ?? '', location: e.location_name ?? '' });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<SBUEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVibeModalOpen, setIsVibeModalOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const [selectedTab, setSelectedTab] = useState<'Details' | 'Chat' | 'Photos' | 'Feedback'>('Details');
  const [galleryRefreshKey, setGalleryRefreshKey] = useState(0);
  const [feedbackRefreshKey, setFeedbackRefreshKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!eventId) return;
    document.title = `Event • SBU VibeCheck`;
    async function fetchEvent() {
      try {
        setLoading(true); setError(null);
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController(); abortRef.current = controller;
        const response = await fetch(makeUrl(`events/${eventId}`), { signal: controller.signal });
        if (!response.ok) throw new Error('Failed to fetch event details');
        const data: SBUEvent = await response.json();
        setEvent(data);
        document.title = `${data.title} • SBU VibeCheck`;
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally { setLoading(false); }
    }
    fetchEvent();
    return () => abortRef.current?.abort();
  }, [eventId]);

  const isEventStarted = useMemo(() => {
    if (!event?.start_time) return false;
    return Date.now() > new Date(event.start_time).getTime();
  }, [event]);

  const isEventFinished = useMemo(() => {
    if (!event?.start_time) return false;
    return Date.now() > new Date(event.start_time).getTime();
  }, [event]);

  const eventQuestions = event?.vibe_question_1_text && event?.vibe_question_1_options
    ? { q1Text: event.vibe_question_1_text, q1Options: event.vibe_question_1_options, q2Text: event.vibe_question_2_text, q2Options: event.vibe_question_2_options }
    : undefined;

  const handleUploadSuccess = () => setGalleryRefreshKey((k) => k + 1);
  const handleFeedbackPosted = () => setFeedbackRefreshKey((k) => k + 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-4 md:p-8">
        <div className="relative mb-8 h-64 w-full overflow-hidden rounded-3xl md:h-96">
          <div className="absolute h-full w-full animate-pulse rounded-3xl bg-mono-100" />
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2">
            <div className="h-10 w-48 animate-pulse rounded-xl bg-mono-100" />
            <div className="h-24 w-full animate-pulse rounded-xl bg-mono-100" />
          </div>
          <div className="rounded-3xl border border-white/[0.06] bg-mono-50 p-6">
            <div className="h-6 w-32 animate-pulse rounded bg-mono-150" />
            <div className="mt-4 h-8 w-full animate-pulse rounded bg-mono-150" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black p-8 text-center">
        <p className="text-lg font-semibold text-white">Couldn't load this event.</p>
        <p className="mt-1 text-[13px] text-mono-500">{error}</p>
      </div>
    );
  }

  if (!event) {
    return <div className="min-h-screen bg-black p-8 text-center text-mono-500">Event not found.</div>;
  }

  return (
    <>
      <div className="min-h-screen bg-black p-4 md:p-8">
        {/* Hero */}
        <div className="relative mb-8 h-64 w-full overflow-hidden rounded-3xl md:h-96">
          <img
            src={event.image_url || FALLBACK_IMG}
            alt={`${event.title} cover`}
            className="absolute h-full w-full rounded-3xl object-cover grayscale-[30%]"
            loading="eager"
            onError={(e) => ((e.currentTarget as HTMLImageElement).src = FALLBACK_IMG)}
          />
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-4 p-6 md:p-8">
            <h1 className="font-display text-3xl font-extrabold tracking-tighter text-white md:text-5xl">{event.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-[13px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 font-medium text-white backdrop-blur-sm">
                <Clock size={13} className="opacity-60" /> {formatDateTime(event.start_time)}
              </span>
              <span className="text-mono-400">to</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 font-medium text-white backdrop-blur-sm">
                {formatDateTime(event.end_time)}
              </span>
              {event.location_name && (
                <a className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 font-medium text-white backdrop-blur-sm hover:bg-white/10"
                  href={`https://maps.google.com/?q=${encodeURIComponent(event.location_name)}`} target="_blank" rel="noreferrer">
                  <MapPin size={13} className="opacity-60" /> {event.location_name}
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-[12px] font-semibold text-white transition-all hover:bg-white hover:text-black">
                <CalendarPlus size={14} /> Add to Calendar
              </a>
              <button
                onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); } catch {} }}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-[12px] font-semibold text-white transition-all hover:bg-white hover:text-black">
                <Share2 size={14} /> Copy Link
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <TabSelector tabs={['Details', 'Chat', 'Photos', 'Feedback']} selectedTab={selectedTab} onSelectTab={(t) => setSelectedTab(t as any)} />
            <div className="py-8">
              {selectedTab === 'Details' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="mb-3 text-xl font-bold tracking-tight text-white">Description</h2>
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-mono-600">{event.description}</p>
                  </div>
                  {!!event.tags?.length && (
                    <div>
                      <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-mono-400">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {event.tags.map((tag) => (
                          <span key={tag} className="rounded-full border border-white/[0.06] bg-mono-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-mono-600">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
              {selectedTab === 'Chat' && (
                <section className="h-[600px] overflow-hidden rounded-3xl border border-white/[0.06]">
                  <ChatInterface channelId={`event:${event.id}`} className="h-full" />
                </section>
              )}
              {selectedTab === 'Photos' && (
                <section className="space-y-6">
                  <h2 className="text-xl font-bold tracking-tight text-white">Photos</h2>
                  <PhotoUpload targetType="event" targetId={event.id} onUploadSuccess={handleUploadSuccess} />
                  <PhotoGallery targetType="event" targetId={event.id} refreshKey={galleryRefreshKey} />
                </section>
              )}
              {selectedTab === 'Feedback' && (
                <section className="space-y-6">
                  <h2 className="text-xl font-bold tracking-tight text-white">Feedback</h2>
                  {isEventFinished ? (
                    <EventFeedbackForm eventId={event.id} onFeedbackPosted={handleFeedbackPosted} />
                  ) : (
                    <div className="rounded-3xl border border-white/[0.06] bg-mono-50 p-6 text-center text-[13px] text-mono-500">
                      Feedback opens after the event ends.
                    </div>
                  )}
                  <EventFeedbackList eventId={event.id} refreshKey={feedbackRefreshKey} />
                </section>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="flex h-fit flex-col gap-6 rounded-3xl border border-white/[0.06] bg-mono-50 p-6 md:col-span-1">
            <div className="border-b border-white/[0.06] pb-6">
              <h2 className="mb-3 text-lg font-bold tracking-tight text-white">Vibe</h2>
              <VibeBadge targetId={event.id} targetType="event" />
              {isAuthenticated && isEventStarted && (
                <button onClick={() => setIsVibeModalOpen(true)}
                  className="mt-4 w-full rounded-full border border-white/20 px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-white hover:text-black">
                  Rate the Vibe
                </button>
              )}
            </div>
            <div className="border-b border-white/[0.06] pb-6">
              <RSVPControls eventId={event.id} />
            </div>
            <div>
              <h2 className="mb-4 text-lg font-bold tracking-tight text-white">Details</h2>
              <div className="mb-4">
                <strong className="block text-[11px] font-semibold uppercase tracking-widest text-mono-400">When</strong>
                <p className="mt-1 text-[14px] text-mono-700">{formatDateTime(event.start_time)}</p>
                <p className="text-[13px] text-mono-400">to {formatDateTime(event.end_time)}</p>
              </div>
              {event.location_name && (
                <div className="mb-4">
                  <strong className="block text-[11px] font-semibold uppercase tracking-widest text-mono-400">Where</strong>
                  <p className="mt-1 text-[14px] text-mono-700">{event.location_name}</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {isVibeModalOpen && (
        <VibeCheckModal targetId={event.id} targetType="event" targetName={event.title}
          onClose={() => setIsVibeModalOpen(false)} eventQuestions={eventQuestions} />
      )}
    </>
  );
}