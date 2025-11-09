import { Link } from 'react-router-dom';
import { type SBUEvent } from '../types';
import VibeBadge from './VibeBadge';
import RSVPCountBadge from './RSVPCountBadge';
import { MapPin } from 'lucide-react';

interface EventCardProps { event: SBUEvent; variant?: 'default' | 'featured' }

const FALLBACK_IMG = 'https://image2url.com/images/1762671096133-8bcd549c-4ae7-4f31-b26f-39b9909ae90f.jpg';

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  }).format(new Date(dateString));
}

function inProgress(start?: string, end?: string) {
  if (!start) return false;
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : s + 3 * 60 * 60 * 1000; // 3h default window
  return now >= s && now <= e;
}

export default function EventCard({ event, variant = 'default' }: EventCardProps) {
  const live = inProgress((event as any).start_time, (event as any).end_time);

  return (
    <Link
      to={`/event/${event.id}`}
      aria-label={`Open event: ${event.title}`}
      className={`group block overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-gray-800 to-gray-900 shadow-lg ring-1 ring-inset ring-white/5 transition-all hover:translate-y-[-2px] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${variant === 'featured' ? 'md:min-w-[360px]' : ''}`}
    >
      <article className="flex h-full flex-col">
        {/* Media */}
        <div className="relative">
          <img
            src={event.image_url || FALLBACK_IMG}
            alt={`${event.title} cover`}
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG; }}
            className="aspect-[16/9] w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Date chip */}
          <div className="absolute left-3 top-3 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <time dateTime={new Date(event.start_time).toISOString()}>{formatDate(event.start_time)}</time>
          </div>

          {/* Live pulse */}
          {live && (
            <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-1 text-[11px] font-bold text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> LIVE
            </div>
          )}

          {/* Title overlay */}
          <h3 className="absolute bottom-3 left-3 right-3 line-clamp-2 text-xl font-extrabold text-white drop-shadow-md">
            {event.title}
          </h3>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col justify-between gap-3 p-4">
          {/* Location */}
          {event.location_name && (
            <p className="inline-flex items-center gap-1 text-sm text-gray-200">
              <MapPin size={14} className="opacity-75" /> {event.location_name}
            </p>
          )}

          {/* Tags */}
          {!!event.tags?.length && (
            <div className="mt-1 flex flex-wrap gap-2">
              {event.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-gray-200">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer badges */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            {event.rsvp_counts && <RSVPCountBadge counts={event.rsvp_counts} />}
            <VibeBadge targetId={event.id} targetType="event" />
          </div>
        </div>
      </article>
    </Link>
  );
}
