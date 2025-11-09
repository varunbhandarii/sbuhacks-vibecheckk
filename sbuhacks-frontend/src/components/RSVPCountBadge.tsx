import { Users, Star } from 'lucide-react';

interface RSVPCountBadgeProps { counts: { going: number; interested: number } }

export default function RSVPCountBadge({ counts }: RSVPCountBadgeProps) {
  if (!counts || (counts.going === 0 && counts.interested === 0)) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="RSVP summary">
      {counts.going > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-600/25 px-3 py-1 text-xs font-medium text-green-100" title={`${counts.going} going`}>
          <Users size={14} aria-hidden="true" /> <span className="sr-only">Going: </span>{counts.going} Going
        </span>
      )}
      {counts.interested > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-600/25 px-3 py-1 text-xs font-medium text-yellow-100" title={`${counts.interested} interested`}>
          <Star size={14} aria-hidden /> <span className="sr-only">Interested: </span>{counts.interested} Interested
        </span>
      )}
    </div>
  );
}
