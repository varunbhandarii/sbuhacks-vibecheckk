import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { type UserProfile } from '../types';
import { Loader2, User, Home, Share2, Copy, Check } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL;

type Status = 'loading' | 'idle' | 'error';

function initialsFrom(name: string) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'U';
  const parts = trimmed.split(/\s+/);
  const a = parts[0]?.[0] ?? '';
  const b = parts[1]?.[0] ?? '';
  return (a + b || a).toUpperCase();
}

function gradientFor(seed: string) {
  // Deterministic HSL gradient based on username
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  const h2 = (h + 40) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 25%), hsl(${h2} 70% 35%))`;
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="h-24 w-24 animate-pulse rounded-full bg-gray-700/70" />
        <div className="w-full space-y-2 sm:max-w-sm">
          <div className="h-6 w-2/3 animate-pulse rounded bg-gray-700/70" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-gray-700/70" />
        </div>
      </div>
      <div className="mt-8 border-t border-gray-800 pt-6">
        <div className="h-5 w-24 animate-pulse rounded bg-gray-700/70" />
        <div className="mt-3 space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-gray-700/70" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-gray-700/70" />
          <div className="h-4 w-4/6 animate-pulse rounded bg-gray-700/70" />
        </div>
      </div>
    </div>
  );
}

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [copied, setCopied] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const firstHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const profileUrl = useMemo(
    () => (username ? `${window.location.origin}/profile/${username}` : ''),
    [username]
  );

  // Fetch profile (with abort + retriable)
  const fetchProfile = async (signal?: AbortSignal) => {
    if (!username) return;
    setStatus('loading');
    setFetchError(null);
    try {
      const response = await fetch(`${API_URL}/profile/${username}`, { signal });
      if (!response.ok) throw new Error('Profile not found');
      const data: UserProfile = await response.json();
      setProfile(data);
      setStatus('idle');
      // focus for a11y
      setTimeout(() => firstHeadingRef.current?.focus(), 0);
    } catch (err) {
      setProfile(null);
      setStatus('error');
      setFetchError(err instanceof Error ? err.message : 'Failed to load profile');
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    fetchProfile(ctrl.signal);
    return () => ctrl.abort();
  }, [username]);

  // Set document title
  useEffect(() => {
    if (status === 'idle' && profile) {
      document.title = `${profile.display_name} (@${profile.username}) • VibeCheck`;
    } else if (status === 'error') {
      document.title = `Profile Not Found • VibeCheck`;
    } else {
      document.title = `Profile • VibeCheck`;
    }
  }, [status, profile]);

  // Loading
  if (status === 'loading') return <Skeleton />;

  // Error / 404
  if (status === 'error' || !profile) {
    return (
      <div className="p-8 text-center">
        <h2 className="mb-2 text-2xl font-bold text-red-400" tabIndex={-1} ref={firstHeadingRef}>
          Profile Not Found
        </h2>
        <p className="mx-auto max-w-md text-gray-300">
          We couldn’t find a user with the username{' '}
          <strong className="text-white">@{username}</strong>.
        </p>
        {fetchError && <p className="mt-2 text-sm text-red-300">{fetchError}</p>}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500"
          >
            <Home size={16} /> Go Home
          </Link>
          <button
            onClick={() => fetchProfile()}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 font-semibold text-gray-100 hover:bg-gray-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Success
  const avatarBg = gradientFor(profile.username || profile.display_name || 'user');
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      {/* Profile Header Card */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <span
            className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full text-3xl font-semibold text-white shadow-inner"
            style={{ background: avatarBg }}
            aria-hidden="true"
          >
            {profile.display_name ? initialsFrom(profile.display_name) : <User size={40} />}
          </span>

          <div className="text-center sm:text-left">
            <h1
              className="text-3xl font-bold outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              tabIndex={-1}
              ref={firstHeadingRef}
            >
              {profile.display_name}
            </h1>
            <h2 className="text-xl text-gray-400">@{profile.username}</h2>

            {/* Actions */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(profileUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  } catch {
                    // no-op
                  }
                }}
                className="inline-flex items-center gap-2 rounded-md bg-gray-800 px-3 py-1.5 text-sm text-gray-100 hover:bg-gray-700"
                title="Copy profile link"
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                Copy Link
              </button>

              {canShare && (
                <button
                  onClick={() =>
                    (navigator as any).share({
                      title: `${profile.display_name} (@${profile.username})`,
                      text: `Check out ${profile.display_name}'s profile on VibeCheck`,
                      url: profileUrl,
                    }).catch(() => {})
                  }
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500"
                  title="Share profile"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="mt-6 border-t border-gray-800 pt-5">
            <h3 className="mb-2 text-lg font-semibold text-gray-200">Bio</h3>
            <p className="whitespace-pre-wrap text-gray-300">{profile.bio}</p>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="mt-6 flex justify-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-300 hover:text-white"
        >
          <Home size={16} /> Back to Home
        </Link>
      </div>
    </div>
  );
}
