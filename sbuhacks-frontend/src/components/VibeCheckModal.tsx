import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { type VibeRatingEnum, type VibeSubmission, VIBE_RATINGS } from '../types';
import { X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL;

interface EventQuestions {
  q1Text: string;
  q1Options: string[];
  q2Text: string | null;
  q2Options: string[] | null;
}
interface VibeCheckModalProps {
  targetId: string;
  targetType: 'event' | 'space';
  targetName: string;
  onClose: () => void;
  eventQuestions?: EventQuestions;
}

export default function VibeCheckModal({
  targetId,
  targetType,
  targetName,
  onClose,
  eventQuestions,
}: VibeCheckModalProps) {
  const { anonymousToken, isAuthenticated } = useAuth();

  const [selectedSpaceVibe, setSelectedSpaceVibe] = useState<VibeRatingEnum | null>(null);
  const [crowd, setCrowd] = useState(3);
  const [queue, setQueue] = useState(1);

  const [selectedAnswer1, setSelectedAnswer1] = useState<string | null>(null);
  const [selectedAnswer2, setSelectedAnswer2] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEvent = targetType === 'event' && !!eventQuestions;
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const first = dialogRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea');
    first?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!isAuthenticated || !anonymousToken) {
      setError('You must be logged in to submit a vibe.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    let submissionData: VibeSubmission;
    if (isEvent) {
      if (!selectedAnswer1) {
        setError('Please answer the first question.');
        setIsSubmitting(false);
        return;
      }
      submissionData = {
        target_id: targetId,
        target_type: 'event',
        answer_1: selectedAnswer1,
        answer_2: selectedAnswer2 ?? undefined,
      };
    } else {
      if (!selectedSpaceVibe) {
        setError('Please select a main vibe.');
        setIsSubmitting(false);
        return;
      }
      submissionData = {
        target_id: targetId,
        target_type: 'space',
        rating_enum: selectedSpaceVibe,
        crowd,
        queue,
      };
    }

    try {
      const response = await fetch(`${API_URL}/vibes/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonymousToken}`,
        },
        body: JSON.stringify(submissionData),
      });
      if (!response.ok) throw new Error('Failed to submit vibe.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsSubmitting(false);
    }
  };

  const renderSpaceRatings = () => (
    <>
      <label className="mb-2 block text-sm font-medium text-gray-200">What&apos;s the vibe?</label>
      <div className="mb-6 grid grid-cols-2 gap-3">
        {VIBE_RATINGS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setSelectedSpaceVibe(id)}
            className={`rounded-lg p-3 text-center font-semibold transition-all ${
              selectedSpaceVibe === id ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mb-6">
        <label htmlFor="crowd-slider" className="mb-2 flex justify-between text-sm">
          <span>Crowd</span>
          <span className="font-bold">{crowd} / 5</span>
        </label>
        <input
          id="crowd-slider"
          type="range"
          min="1"
          max="5"
          step="1"
          value={crowd}
          onChange={(e) => setCrowd(Number(e.target.value))}
          className="h-2 w-full cursor-pointer rounded-lg bg-gray-700 accent-blue-500"
        />
      </div>
      <div className="mb-8">
        <label htmlFor="queue-slider" className="mb-2 flex justify-between text-sm">
          <span>Queue (Food/Wait)</span>
          <span className="font-bold">{queue} / 5</span>
        </label>
        <input
          id="queue-slider"
          type="range"
          min="1"
          max="5"
          step="1"
          value={queue}
          onChange={(e) => setQueue(Number(e.target.value))}
          className="h-2 w-full cursor-pointer rounded-lg bg-gray-700 accent-blue-500"
        />
      </div>
    </>
  );

  const renderEventQuestions = () => (
    <>
      <div>
        <label className="mb-3 block text-base font-medium text-gray-200">{eventQuestions!.q1Text}</label>
        <div className="mb-6 grid grid-cols-3 gap-2">
          {eventQuestions!.q1Options.map((option) => (
            <button
              key={option}
              onClick={() => setSelectedAnswer1(option)}
              className={`flex-1 rounded-lg p-3 text-center font-semibold transition-all ${
                selectedAnswer1 === option ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {eventQuestions!.q2Text && eventQuestions!.q2Options && (
        <div className="border-t border-gray-700 pt-6">
          <label className="mb-3 block text-base font-medium text-gray-200">{eventQuestions!.q2Text}</label>
          <div className="mb-6 grid grid-cols-3 gap-2">
            {eventQuestions!.q2Options.map((option) => (
              <button
                key={option}
                onClick={() => setSelectedAnswer2(option)}
                className={`flex-1 rounded-lg p-3 text-center font-semibold transition-all ${
                  selectedAnswer2 === option ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose} role="dialog" aria-modal="true">
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-lg bg-gray-800 p-6 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Rate the Vibe</h2>
            <p className="text-gray-300">for {targetName}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-700" aria-label="Close">
            <X />
          </button>
        </div>

        {isEvent ? renderEventQuestions() : renderSpaceRatings()}

        {error && <p className="mb-4 text-center text-red-400">{error}</p>}

        <div className="flex gap-4">
          <button onClick={onClose} disabled={isSubmitting} className="w-1/2 rounded-lg bg-gray-600 px-4 py-3 font-semibold text-white hover:bg-gray-500 disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-1/2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500 disabled:bg-gray-500"
          >
            {isSubmitting ? 'Submitting…' : 'Submit Vibe'}
          </button>
        </div>
      </div>
    </div>
  );
}
