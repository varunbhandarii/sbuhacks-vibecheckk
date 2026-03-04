import { Link } from 'react-router-dom';
import { type SBUEvent } from '../types';
import VibeBadge from './VibeBadge';
import RSVPCountBadge from './RSVPCountBadge';
import { MapPin, Calendar } from 'lucide-react';

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
      className={`event-card-glow group block overflow-hidden rounded-[24px] glass-strong flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${variant === 'featured' ? 'md:min-w-[360px]' : ''}`}
    >
      {/* Media Header */}
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-gray-900">
        <img
          src={event.image_url || FALLBACK_IMG}
          alt={`${event.title} cover`}
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG; }}
          className="h-full w-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-105"
        />
        {/* Gradients to pop text */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-900/40 to-transparent" />
        
        {/* Date chip */}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-bold tracking-wide text-white backdrop-blur-md ring-1 ring-white/20">
          <Calendar size={14} className="text-neon-cyan" />
          <time dateTime={new Date(event.start_time).toISOString()}>{formatShortDate(event.start_time)}</time>
        </div>

        {/* Live pulse */}
        {live && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-red-600/80 px-3 py-1.5 text-[11px] font-black tracking-widest text-white backdrop-blur-md ring-1 ring-red-400/50 vol-shadow">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white shadow-[0_0_8px_white]" /> LIVE
          </div>
        )}

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 w-full p-4">
           <h3 className="line-clamp-2 text-xl md:text-2xl font-black leading-tight tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] transition-colors duration-300 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-neon-cyan">
            {event.title}
          </h3>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        
        <div className="flex flex-col gap-3">
          {/* Location */}
          {event.location_name && (
            <p className="inline-flex items-center gap-2 text-sm font-medium tracking-wide text-gray-300">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neon-pink/10 text-neon-pink ring-1 ring-neon-pink/20">
                <MapPin size={12} />
              </span>
              <span className="line-clamp-1">{event.location_name}</span>
            </p>
          )}

          {/* Tags */}
          {!!event.tags?.length && (
            <div className="flex flex-wrap gap-2">
              {event.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-md bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-neon-cyan ring-1 ring-white/10 transition-colors group-hover:bg-neon-cyan/10 group-hover:ring-neon-cyan/30">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer badges */}
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/5 pt-4">
          {event.rsvp_counts && <RSVPCountBadge counts={event.rsvp_counts} />}
          <VibeBadge targetId={event.id} targetType="event" />
        </div>
      </div>
    </Link>
  );
}
