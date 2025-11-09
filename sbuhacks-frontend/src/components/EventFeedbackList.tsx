import { useEffect, useMemo, useState } from 'react';
import { type EventFeedback } from '../types';
import { Star, Loader2, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_BASE_URL;

interface FeedbackListProps {
  eventId: string;
  refreshKey: number;
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }).format(
    new Date(d)
  );
}

const RenderStars = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[...Array(5)].map((_, i) => (
      <Star key={i} size={16} className={i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'} />
    ))}
  </div>
);

export default function EventFeedbackList({ eventId, refreshKey }: FeedbackListProps) {
  const [feedbacks, setFeedbacks] = useState<EventFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(10);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/events/${eventId}/feedback`);
        if (!res.ok) throw new Error('Failed to load feedback');
        const data: EventFeedback[] = await res.json();
        setFeedbacks(data);
        setVisible(10);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId, refreshKey]);

  const hasMore = useMemo(() => feedbacks.length > visible, [feedbacks.length, visible]);

  if (loading) return <Loader2 className="mx-auto my-8 h-8 w-8 animate-spin" />;

  if (feedbacks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-700 p-8 text-gray-400">
        <MessageSquare size={32} />
        <h3 className="font-semibold">No Feedback Yet</h3>
        <p className="text-sm">Be the first to leave a review!</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {feedbacks.slice(0, visible).map((fb) => (
          <div key={fb.id} className="rounded-lg bg-gray-800 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link to={`/profile/${fb.author.username}`} className="font-semibold text-white hover:underline">
                  {fb.author.display_name}
                </Link>
                <span className="text-gray-400">·</span>
                <span className="text-sm text-gray-400">@{fb.author.username}</span>
              </div>
              <span className="text-xs text-gray-500">{formatDate(fb.ts)}</span>
            </div>
            <RenderStars rating={fb.rating} />
            {fb.review && <p className="mt-3 whitespace-pre-wrap text-gray-300">{fb.review}</p>}
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setVisible((v) => v + 10)}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow hover:bg-gray-700"
          >
            Load more
          </button>
        </div>
      )}
    </>
  );
}
