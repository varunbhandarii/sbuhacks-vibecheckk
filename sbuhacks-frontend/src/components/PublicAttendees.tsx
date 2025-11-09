// src/components/PublicAttendees.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { type PublicAttendee } from '../types';
import { Loader2, User } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL;

interface PublicAttendeesProps {
  eventId: string;
}

// A helper component for a single avatar
const AttendeeAvatar = ({ attendee }: { attendee: PublicAttendee }) => (
  <Link
    to={`/profile/${attendee.username}`}
    title={`@${attendee.username}`}
    className="h-10 w-10 flex-shrink-0 rounded-full border-2 border-gray-900 bg-gray-700 transition-transform hover:-translate-y-1 hover:z-10"
  >
    {attendee.profile_image_url ? (
      <img
        src={attendee.profile_image_url}
        alt={`@${attendee.username}`}
        className="h-full w-full rounded-full object-cover"
      />
    ) : (
      <div className="flex h-full w-full items-center justify-center text-gray-400">
        <User size={20} />
      </div>
    )}
  </Link>
);

export default function PublicAttendees({ eventId }: PublicAttendeesProps) {
  const [attendees, setAttendees] = useState<PublicAttendee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAttendees() {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_URL}/rsvp/${eventId}/attendees`
        );
        if (!response.ok) throw new Error('Failed to load attendees');
        
        const data: PublicAttendee[] = await response.json();
        setAttendees(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchAttendees();
  }, [eventId]);

  if (loading) {
    return <Loader2 className="my-2 h-5 w-5 animate-spin text-gray-400" />;
  }

  if (attendees.length === 0) {
    return (
      <p className="mt-2 text-sm text-gray-400">
        No public attendees yet.
      </p>
    );
  }

  return (
    <div className="mt-3 flex -space-x-2 overflow-hidden py-1">
      {attendees.map((attendee) => (
        <AttendeeAvatar key={attendee.username} attendee={attendee} />
      ))}
    </div>
  );
}