import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { type FeedbackSubmission } from '../types';
import { Star, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL;

interface FeedbackFormProps {
  eventId: string;
  onFeedbackPosted: () => void;
}

type Status = 'idle' | 'saving' | 'success' | 'error';
const MAX_CHARS = 500;

export default function EventFeedbackForm({ eventId, onFeedbackPosted }: FeedbackFormProps) {
  const { anonymousToken, isAuthenticated, login } = useAuth();

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_CHARS - review.length;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !anonymousToken) return login();
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    if (review.length > MAX_CHARS) {
      setError('Review is too long');
      return;
    }

    setStatus('saving');
    setError(null);

    const submissionData: FeedbackSubmission = { rating, review: review.trim() || undefined };

    try {
      const response = await fetch(`${API_URL}/events/${eventId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonymousToken}` },
        body: JSON.stringify(submissionData),
      });

      if (response.status === 403) throw new Error('Feedback is not yet open for this event.');
      if (response.status === 409) throw new Error('You have already submitted feedback for this event.');
      if (!response.ok) throw new Error('Failed to submit feedback.');

      setStatus('success');
      onFeedbackPosted();
      setRating(0);
      setReview('');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="mb-6 rounded-lg bg-gray-800 p-6 text-center">
        <p className="text-gray-300">Please log in to leave a review.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-lg bg-gray-800 p-6">
      <h3 className="text-xl font-semibold">Leave a Review</h3>

      <div>
        <label className="mb-2 block text-sm font-medium">Rating*</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
              aria-pressed={rating >= star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0"
            >
              <Star
                size={28}
                className={`transition-colors ${(hoverRating || rating) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="review" className="mb-2 block text-sm font-medium">
          Review (Optional)
        </label>
        <textarea
          id="review"
          rows={3}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          className="w-full rounded-md border-gray-600 bg-gray-700 p-3"
          placeholder="How was the event? What could be improved?"
          maxLength={MAX_CHARS + 1}
        />
        <div className={`mt-1 text-right text-xs ${remaining < 0 ? 'text-red-400' : 'text-gray-400'}`}>{remaining} characters left</div>
      </div>

      <div className="flex flex-col items-end gap-3">
        {status === 'error' && (
          <div className="flex w-full items-center gap-2 text-red-300">
            <AlertTriangle size={16} /> <p>{error}</p>
          </div>
        )}
        {status === 'success' && (
          <div className="flex w-full items-center gap-2 text-green-300">
            <CheckCircle size={16} /> <p>Thank you for your feedback!</p>
          </div>
        )}
        <button
          type="submit"
          disabled={status === 'saving' || rating === 0 || remaining < 0}
          className="flex w-32 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-600"
        >
          {status === 'saving' ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Submit'}
        </button>
      </div>
    </form>
  );
}
