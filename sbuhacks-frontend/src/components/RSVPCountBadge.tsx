import { Users, Star } from 'lucide-react';

interface RSVPCountBadgeProps { counts: { going: number; interested: number } }

export default function RSVPCountBadge({ counts }: RSVPCountBadgeProps) {
  if (!counts || (counts.going === 0 && counts.interested === 0)) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="RSVP summary">
      {counts.going > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-mono-700" title={`${counts.going} going`}>
          <Users size={12} className="opacity-50" aria-hidden="true" /> <span className="sr-only">Going: </span>{counts.going} Going
        </span>
      )}
      {counts.interested > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-mono-500" title={`${counts.interested} interested`}>
          <Star size={12} className="opacity-50" aria-hidden /> <span className="sr-only">Interested: </span>{counts.interested} Interested
        </span>
      )}
    </div>
  );
}
