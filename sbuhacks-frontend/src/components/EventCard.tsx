import { Link } from 'react-router-dom';
import { type SBUEvent } from '../types';
import VibeBadge from './VibeBadge';
import RSVPCountBadge from './RSVPCountBadge';
import { MapPin, Calendar, ArrowUpRight } from 'lucide-react';

interface EventCardProps { event: SBUEvent; variant?: 'default' | 'featured' }

const FALLBACK_IMG = 'https://image2url.com/images/1762671096133-8bcd549c-4ae7-4f31-b26f-39b9909ae90f.jpg';

function formatShortDate(isoString: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  }).format(new Date(isoString));
}

function inProgress(start?: string, end?: string) {
  if (!start) return false;
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : s + 3 * 60 * 60 * 1000;
  return now >= s && now <= e;
}

export default function EventCard({ event, variant = 'default' }: EventCardProps) {
  const live = inProgress((event as any).start_time, (event as any).end_time);

  return (
    <Link
      to={`/event/${event.id}`}
      aria-label={`Open event: ${event.title}`}
      className={`card-hover group flex h-full flex-col overflow-hidden rounded-3xl border border-white/[0.06] bg-mono-50 outline-none focus-visible:ring-1 focus-visible:ring-white/30 ${variant === 'featured' ? 'md:min-w-[360px]' : ''}`}
    >
      {/* Image */}
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-mono-100">
        <img
          src={event.image_url || FALLBACK_IMG}
          alt={`${event.title} cover`}
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG; }}
          className="h-full w-full object-cover grayscale-[20%] transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-mono-50 via-transparent to-transparent" />

        {/* Date tag */}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md">
          <Calendar size={12} className="opacity-60" />
          <time dateTime={new Date(event.start_time).toISOString()}>{formatShortDate(event.start_time)}</time>
        </div>

        {/* Live badge */}
        {live && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-black">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black" /> Live
          </div>
        )}

        {/* Arrow on hover */}
        <div className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/0 text-white opacity-0 transition-all duration-300 group-hover:bg-white group-hover:text-black group-hover:opacity-100">
          <ArrowUpRight size={16} />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        <div className="flex flex-col gap-3">
          <h3 className="line-clamp-2 text-lg font-bold leading-snug tracking-tight text-white transition-colors">
            {event.title}
          </h3>

          {event.location_name && (
            <p className="inline-flex items-center gap-2 text-[13px] text-mono-500">
              <MapPin size={13} className="opacity-50" />
              <span className="line-clamp-1">{event.location_name}</span>
            </p>
          )}

          {!!event.tags?.length && (
            <div className="flex flex-wrap gap-2">
              {event.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-mono-500">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          {event.rsvp_counts && <RSVPCountBadge counts={event.rsvp_counts} />}
          <VibeBadge targetId={event.id} targetType="event" />
        </div>
      </div>
    </Link>
  );
}
