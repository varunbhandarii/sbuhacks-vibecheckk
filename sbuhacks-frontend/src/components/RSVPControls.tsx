import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import RSVPCountBadge from './RSVPCountBadge';
import { Lock, Eye, Star, Users, RefreshCw } from 'lucide-react';
import PublicAttendees from './PublicAttendees';

type RSVPStatus = 'interested' | 'going' | 'not_interested';
type RSVPVisibility = 'private' | 'public';

interface RSVPSummary {
  counts: { going: number; interested: number };
  user_status: RSVPStatus | null;
  user_visibility: RSVPVisibility | null; // <-- NEW
}
interface RSVPPublic {
  event_id: string;
  status: RSVPStatus;
  visibility: RSVPVisibility;
}

const API_URL = import.meta.env.VITE_API_BASE_URL;

interface RSVPControlsProps {
  eventId: string;
}

export default function RSVPControls({ eventId }: RSVPControlsProps) {
  const { anonymousToken, isAuthenticated, login } = useAuth();

  const [summary, setSummary] = useState<RSVPSummary | null>(null);
  const [myStatus, setMyStatus] = useState<RSVPStatus | null>(null);
  const [myVisibility, setMyVisibility] = useState<RSVPVisibility>('private');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchSummary() {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/rsvp/${eventId}/counts`, {
        headers: isAuthenticated && anonymousToken ? { Authorization: `Bearer ${anonymousToken}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load RSVP summary');
      const data: RSVPSummary = await res.json();
      setSummary(data);
      setMyStatus(data.user_status);
      if (data.user_visibility) setMyVisibility(data.user_visibility); // <-- honor server
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, isAuthenticated, anonymousToken]);

  const submitRSVP = async (newStatus: RSVPStatus, newVisibility = myVisibility) => {
    if (!isAuthenticated) return login();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/rsvp/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonymousToken}`,
        },
        body: JSON.stringify({ event_id: eventId, status: newStatus, visibility: newVisibility }),
      });
      if (!res.ok) throw new Error('Failed to update RSVP');
      const updated: RSVPPublic = await res.json();
      setMyStatus(updated.status);
      setMyVisibility(updated.visibility);
      await fetchSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateVisibility = async (vis: RSVPVisibility) => {
    setMyVisibility(vis);
    if (myStatus === 'going') {
      await submitRSVP('going', vis);
    }
  };

  if (isLoading) {
    return (
      <p className="inline-flex items-center gap-2 text-gray-400">
        <RefreshCw className="h-4 w-4 animate-spin" /> Loading RSVP…
      </p>
    );
  }

  if (!isAuthenticated) {
    return (
      <div>
        {summary?.counts && <RSVPCountBadge counts={summary.counts} />}
        <button onClick={login} className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500">
          Log in to RSVP
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-semibold text-white">Are you going?</p>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => submitRSVP('interested')}
          disabled={isSubmitting}
          className={`flex items-center justify-center gap-2 rounded-lg p-3 font-semibold transition-all disabled:opacity-50 ${
            myStatus === 'interested' ? 'bg-yellow-600 text-white ring-2 ring-yellow-300' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
          }`}
        >
          <Star size={16} /> Interested
        </button>
        <button
          onClick={() => submitRSVP('going')}
          disabled={isSubmitting}
          className={`flex items-center justify-center gap-2 rounded-lg p-3 font-semibold transition-all disabled:opacity-50 ${
            myStatus === 'going' ? 'bg-green-600 text-white ring-2 ring-green-300' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
          }`}
        >
          <Users size={16} /> Going
        </button>
      </div>

      {myStatus === 'going' && (
        <div className="flex items-center justify-center gap-4 rounded-lg bg-gray-700 p-3">
          <button
            onClick={() => updateVisibility('private')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-all ${
              myVisibility === 'private' ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Lock size={14} /> Private
          </button>
          <button
            onClick={() => updateVisibility('public')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-all ${
              myVisibility === 'public' ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Eye size={14} /> Public
          </button>
        </div>
      )}

      {myStatus && (
        <button
          onClick={() => submitRSVP('not_interested')}
          disabled={isSubmitting}
          className="text-sm text-gray-400 hover:text-red-400 disabled:opacity-50"
        >
          Remove my RSVP
        </button>
      )}

      {error && <p className="text-center text-red-400">{error}</p>}

      <hr className="my-2 border-gray-700" />
      <h3 className="text-lg font-semibold text-white">Who&apos;s Going</h3>

      {summary?.counts ? <RSVPCountBadge counts={summary.counts} /> : <p className="text-sm text-gray-400">Be the first to RSVP!</p>}

      <PublicAttendees eventId={eventId} />
    </div>
  );
}
