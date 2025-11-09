// src/pages/EventDetailPage.tsx
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
import { CalendarPlus, MapPin, Share2 } from 'lucide-react';

const FALLBACK_IMG = 'https://via.placeholder.com/1200x600?text=Event';

// --- URL helpers to keep HTTPS and avoid redirect loops ---
const RAW_HTTP = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const API_BASE = RAW_HTTP ? RAW_HTTP.replace(/^http:/i, 'https:').replace(/\/+$/, '') : '';
const makeUrl = (path: string, params?: Record<string, string | number | boolean>) => {
  const url = new URL(path.replace(/^\/+/, ''), API_BASE + '/');
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  return url.toString();
};

function formatDateTime(dateString: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }).format(new Date(dateString));
}

function googleCalendarUrl(e: SBUEvent) {
  const toGCal = (d: string) =>
    new Date(d).toISOString().replace(/[-:]|\.\d{3}/g, '').replace('.000', '');
  const dates = `${toGCal(e.start_time)}/${toGCal(e.end_time)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates,
    details: e.description ?? '',
    location: e.location_name ?? '',
  });
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
        setLoading(true);
        setError(null);
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const response = await fetch(makeUrl(`events/${eventId}`), { signal: controller.signal });
        if (!response.ok) throw new Error('Failed to fetch event details');

        const data: SBUEvent = await response.json();
        setEvent(data);
        document.title = `${data.title} • SBU VibeCheck`;
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
    return () => abortRef.current?.abort();
  }, [eventId]);

  // --- 1. RENAMED THIS VARIABLE ---
  // This is true if the event has started
  const isEventStarted = useMemo(() => {
    if (!event?.start_time) return false;
    return Date.now() > new Date(event.start_time).getTime();
  }, [event]);

  // --- 2. CREATED NEW VARIABLE FOR END TIME ---
  // This is true if the event has finished
  const isEventFinished = useMemo(() => {
    if (!event?.start_time) return false;
    return Date.now() > new Date(event.start_time).getTime();
  }, [event]);
  // --- END OF CHANGES ---

  const eventQuestions =
    event?.vibe_question_1_text && event?.vibe_question_1_options
      ? {
          q1Text: event.vibe_question_1_text,
          q1Options: event.vibe_question_1_options,
          q2Text: event.vibe_question_2_text,
          q2Options: event.vibe_question_2_options,
        }
      : undefined;

  const handleUploadSuccess = () => setGalleryRefreshKey((k) => k + 1);
  const handleFeedbackPosted = () => setFeedbackRefreshKey((k) => k + 1);

  if (loading) {
    // ... (loading skeleton JSX is the same)
    return (
      <div className="p-4 md:p-8">
        <div className="relative mb-6 h-64 w-full overflow-hidden rounded-lg md:h-96">
          <div className="absolute h-full w-full animate-pulse rounded-lg bg-gray-700" />
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2">
            <div className="h-10 w-48 animate-pulse rounded bg-gray-700" />
            <div className="h-24 w-full animate-pulse rounded bg-gray-700" />
          </div>
          <div className="rounded-lg bg-gray-800 p-6">
            <div className="h-6 w-32 animate-pulse rounded bg-gray-700" />
            <div className="mt-4 h-8 w-full animate-pulse rounded bg-gray-700" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    // ... (error JSX is the same)
    return (
      <div className="p-6 text-center text-red-400">
        <p className="mb-2 text-lg font-semibold">Couldn’t load this event.</p>
        <p className="text-sm text-red-300">{error}</p>
      </div>
    );
  }

  if (!event) {
    return <div className="p-6 text-center text-gray-400">Event not found.</div>;
  }

  return (
    <>
      <div className="p-4 md:p-8">
        {/* Hero */}
        <div className="relative mb-6 h-64 w-full overflow-hidden rounded-lg md:h-96">
          {/* ... (Hero JSX is the same) ... */}
          <img
            src={event.image_url || FALLBACK_IMG}
            alt={`${event.title} cover`}
            className="absolute h-full w-full rounded-lg object-cover"
            loading="eager"
            onError={(e) => ((e.currentTarget as HTMLImageElement).src = FALLBACK_IMG)}
          />
          <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
          <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-3 p-2 md:bottom-8 md:left-8 md:right-auto md:p-4">
            <h1 className="text-3xl font-bold text-white md:text-5xl">{event.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-200">
              <span className="rounded bg-blue-700/70 px-2 py-1">{formatDateTime(event.start_time)}</span>
              <span className="text-gray-300">to</span>
              <span className="rounded bg-blue-700/70 px-2 py-1">{formatDateTime(event.end_time)}</span>
              {event.location_name && (
                <a
                  className="inline-flex items-center gap-1 rounded bg-gray-800/70 px-2 py-1 hover:bg-gray-700"
                  href={`https://maps.google.com/?q=${encodeURIComponent(event.location_name)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={16} /> {event.location_name}
                </a>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={googleCalendarUrl(event)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-gray-800/80 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
              >
                <CalendarPlus size={16} /> Add to Google Calendar
              </a>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    // You could add a "Copied!" toast here
                  } catch {}
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-800/80 px-3 py-1.5 text-sm font-medium hover:bg-gray-700"
              >
                <Share2 size={16} /> Copy link
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Left */}
          <div className="md:col-span-2">
            <TabSelector
              tabs={['Details', 'Chat', 'Photos', 'Feedback']}
              selectedTab={selectedTab}
              onSelectTab={(t) => setSelectedTab(t as any)}
            />

            <div className="py-6">
              {/* ... (Details Tab) ... */}
              {selectedTab === 'Details' && (
                <section>
                  <h2 className="mb-3 text-2xl font-semibold">Description</h2>
                  <p className="whitespace-pre-wrap text-gray-300">{event.description}</p>
                  {!!event.tags?.length && (
                    <div className="mt-6">
                      <h3 className="mb-2 text-lg font-semibold text-blue-300">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {event.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-gray-700 px-3 py-1 text-xs font-medium text-gray-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
              {/* ... (Chat Tab) ... */}
              {selectedTab === 'Chat' && (
                <section className="h-[600px] rounded-lg border border-gray-700">
                  <ChatInterface channelId={`event:${event.id}`} className="h-full" />
                </section>
              )}
              {/* ... (Photos Tab) ... */}
              {selectedTab === 'Photos' && (
                <section className="space-y-6">
                  <h2 className="text-2xl font-semibold">Event Photos</h2>
                  <PhotoUpload targetType="event" targetId={event.id} onUploadSuccess={handleUploadSuccess} />
                  <PhotoGallery targetType="event" targetId={event.id} refreshKey={galleryRefreshKey} />
                </section>
              )}
              {/* ... (Feedback Tab) ... */}
              {selectedTab === 'Feedback' && (
                <section className="space-y-6">
                  <h2 className="text-2xl font-semibold">Event Feedback</h2>
                  {/* --- 4. USE isEventFinished HERE --- */}
                  {isEventFinished ? (
                    <EventFeedbackForm eventId={event.id} onFeedbackPosted={handleFeedbackPosted} />
                  ) : (
                    <div className="mb-6 rounded-lg bg-gray-800 p-6 text-center">
                      <p className="text-gray-300">Feedback will open after the event ends.</p>
                    </div>
                  )}
                  <EventFeedbackList eventId={event.id} refreshKey={feedbackRefreshKey} />
                </section>
              )}
            </div>
          </div>

          {/* Right */}
          <aside className="flex h-fit flex-col gap-6 rounded-lg bg-gray-800 p-6 md:col-span-1">
            <div className="border-b border-gray-700 pb-6">
              <h2 className="mb-3 text-2xl font-semibold">Live Vibe</h2>
              <VibeBadge targetId={event.id} targetType="event" />
              {/* --- 3. UPDATED THIS BUTTON --- */}
              {isAuthenticated && isEventStarted && (
                <button
                  onClick={() => setIsVibeModalOpen(true)}
                  className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500"
                >
                  Rate the Vibe
                </button>
              )}
            </div>

            <div className="border-b border-gray-700 pb-6">
              <RSVPControls eventId={event.id} />
            </div>

            <div>
              <h2 className="mb-4 text-2xl font-semibold">Details</h2>
              <div className="mb-4">
                <strong className="block text-blue-300">When</strong>
                <p>{formatDateTime(event.start_time)}</p>
                <p className="text-sm text-gray-400">to {formatDateTime(event.end_time)}</p>
              </div>
              {event.location_name && (
                <div className="mb-4">
                  <strong className="block text-blue-300">Where</strong>
                  <p>{event.location_name}</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {isVibeModalOpen && (
        <VibeCheckModal
          targetId={event.id}
          targetType="event"
          targetName={event.title}
          onClose={() => setIsVibeModalOpen(false)}
          eventQuestions={eventQuestions}
        />
      )}
    </>
  );
}