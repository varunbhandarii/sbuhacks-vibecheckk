import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { type UserProfile, type UserProfileUpdate } from '../types';
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  Save,
  Check,
  X,
  Copy,
  Link as LinkIcon,
  RefreshCcw,
  Info,
  User as UserIcon,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL;

type Status = 'idle' | 'loading' | 'saving' | 'success' | 'error';
type UsernameState = 'idle' | 'checking' | 'available' | 'taken' | 'same';

const BIO_MAX = 280;

export default function MyProfilePage() {
  const { anonymousToken, isLoading: isAuthLoading, login } = useAuth();

  const [profile, setProfile] = useState<UserProfileUpdate>({
    username: '',
    display_name: '',
    bio: '',
  });
  const [original, setOriginal] = useState<UserProfileUpdate | null>(null);

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  // Username check
  const [usernameState, setUsernameState] = useState<UsernameState>('idle');
  const [usernameMsg, setUsernameMsg] = useState<string>('');
  const usernameAbortRef = useRef<AbortController | null>(null);
  const debouncerRef = useRef<number | null>(null);

  // Copy link feedback
  const [copied, setCopied] = useState(false);

  // Unsaved changes guard
  const isDirty = useMemo(() => {
    if (!original) return false;
    return (
      (profile.username ?? '') !== (original.username ?? '') ||
      (profile.display_name ?? '') !== (original.display_name ?? '') ||
      (profile.bio ?? '') !== (original.bio ?? '')
    );
  }, [profile, original]);

  // ----- Fetch profile on mount -----
  useEffect(() => {
    if (isAuthLoading) return;
    if (!anonymousToken) {
      login();
      return;
    }

    (async () => {
      try {
        setStatus('loading');
        const response = await fetch(`${API_URL}/profile/me`, {
          headers: { Authorization: `Bearer ${anonymousToken}` },
        });
        if (!response.ok) throw new Error('Failed to load your profile');
        const data: UserProfile = await response.json();
        setProfile({
          username: data.username ?? '',
          display_name: data.display_name ?? '',
          bio: data.bio ?? '',
        });
        setOriginal({
          username: data.username ?? '',
          display_name: data.display_name ?? '',
          bio: data.bio ?? '',
        });
        setStatus('idle');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    })();
  }, [anonymousToken, isAuthLoading, login]);

  // ----- Unsaved changes browser guard -----
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ''; // required for Chrome
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ----- Helpers -----
  const sanitizeUsername = (v: string) =>
    v
      .toLowerCase()
      .replace(/\s+/g, '-') // spaces to hyphen
      .replace(/[^a-z0-9._-]/g, ''); // allowed: a-z 0-9 . _ -

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    let { name, value } = e.target;
    if (name === 'username') {
      value = sanitizeUsername(value);
    }
    if (name === 'bio' && value.length > BIO_MAX) {
      value = value.slice(0, BIO_MAX);
    }
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const resetChanges = () => {
    if (original) setProfile({ ...original });
    setStatus('idle');
    setError(null);
  };

  // ----- Debounced username availability check using GET /profile/{username} -----
  useEffect(() => {
    if (!profile.username) {
      setUsernameState('idle');
      setUsernameMsg('');
      return;
    }
    if (!original) return;

    // same username as current
    if (profile.username === original.username) {
      setUsernameState('same');
      setUsernameMsg('This is your current username.');
      return;
    }

    // clear pending
    if (debouncerRef.current) window.clearTimeout(debouncerRef.current);
    if (usernameAbortRef.current) usernameAbortRef.current.abort();

    setUsernameState('checking');
    setUsernameMsg('Checking availability…');

    debouncerRef.current = window.setTimeout(async () => {
      try {
        usernameAbortRef.current = new AbortController();
        const res = await fetch(`${API_URL}/profile/${profile.username}`, {
          signal: usernameAbortRef.current.signal,
        });
        if (res.ok) {
          // Exists → taken (and not the same as ours)
          setUsernameState('taken');
          setUsernameMsg('That handle is already taken.');
        } else if (res.status === 404) {
          setUsernameState('available');
          setUsernameMsg('Great — handle is available!');
        } else {
          setUsernameState('idle');
          setUsernameMsg('');
        }
      } catch {
        // network/abort → keep neutral
        setUsernameState('idle');
        setUsernameMsg('');
      }
    }, 450);
  }, [profile.username, original]);

  // ----- Submit -----
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!anonymousToken || status === 'saving') return;

    // basic client validation
    if (!profile.username?.trim() || !profile.display_name?.trim()) {
      setError('Username and Display Name are required.');
      setStatus('error');
      return;
    }
    if (usernameState === 'taken') {
      setError('Please choose a different username — that one is taken.');
      setStatus('error');
      return;
    }

    setStatus('saving');
    setError(null);
    try {
      const response = await fetch(`${API_URL}/profile/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonymousToken}`,
        },
        body: JSON.stringify({
          username: profile.username,
          display_name: profile.display_name,
          bio: profile.bio || null,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to save profile');
      }

      const data: UserProfile = await response.json();
      const updated = {
        username: data.username ?? '',
        display_name: data.display_name ?? '',
        bio: data.bio ?? '',
      };
      setProfile(updated);
      setOriginal(updated);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  };

  // ----- Keyboard shortcut: Cmd/Ctrl+S to save -----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      if ((isMac && e.metaKey && e.key === 's') || (!isMac && e.ctrlKey && e.key === 's')) {
        e.preventDefault();
        if (isDirty && status !== 'saving') {
          // mimic form submit
          (async () => {
            const fake = { preventDefault: () => {} } as unknown as FormEvent;
            await handleSubmit(fake);
          })();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDirty, status, handleSubmit]);

  const bioLeft = BIO_MAX - (profile.bio?.length ?? 0);
  const profileUrl = profile.username ? `${window.location.origin}/profile/${profile.username}` : '';

  // ----- Render -----
  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20 text-blue-300">
          <UserIcon size={18} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-xs text-gray-400">
            This info is public. Your <span className="font-semibold text-white">@username</span> must be unique.
          </p>
        </div>
      </div>

      {/* Status banners */}
      {status === 'error' && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-red-800/50 p-3 text-red-200">
          <AlertTriangle size={16} />
          <p className="text-sm">{error}</p>
        </div>
      )}
      {status === 'success' && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-green-800/50 p-3 text-green-200">
          <CheckCircle size={16} />
          <p className="text-sm">Profile saved!</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left column: form */}
        <div className="space-y-6">
          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-200">
              Username
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-600 bg-gray-700 px-3 text-gray-300">
                @
              </span>
              <input
                type="text"
                name="username"
                id="username"
                value={profile.username || ''}
                onChange={handleChange}
                className={`block w-full flex-1 rounded-none rounded-r-md border p-3 focus:border-blue-500 focus:ring-blue-500 ${
                  usernameState === 'taken'
                    ? 'border-red-600 bg-gray-800'
                    : usernameState === 'available'
                    ? 'border-green-600 bg-gray-800'
                    : 'border-gray-600 bg-gray-800'
                }`}
                placeholder="your-unique-handle"
                required
                minLength={3}
                maxLength={32}
                autoComplete="off"
              />
            </div>

            {/* Username helper row */}
            <div className="mt-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {usernameState === 'checking' && (
                  <span className="inline-flex items-center gap-1 text-gray-300">
                    <Loader2 className="h-3 w-3 animate-spin" /> {usernameMsg}
                  </span>
                )}
                {usernameState === 'available' && (
                  <span className="inline-flex items-center gap-1 text-green-300">
                    <Check className="h-3 w-3" /> {usernameMsg}
                  </span>
                )}
                {usernameState === 'taken' && (
                  <span className="inline-flex items-center gap-1 text-red-300">
                    <X className="h-3 w-3" /> {usernameMsg}
                  </span>
                )}
                {usernameState === 'same' && (
                  <span className="inline-flex items-center gap-1 text-gray-400">
                    <Info className="h-3 w-3" /> {usernameMsg}
                  </span>
                )}
              </div>

              {/* Profile link preview + copy */}
              {profile.username && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(profileUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1200);
                    } catch {}
                  }}
                  className="inline-flex items-center gap-1 text-gray-300 hover:text-white"
                  title="Copy profile link"
                >
                  <LinkIcon className="h-3 w-3" />
                  <span className="hidden sm:inline">{profileUrl}</span>
                  {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Allowed: lowercase letters, numbers, dots, underscores, and hyphens. Spaces are converted to hyphens.
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label htmlFor="display_name" className="block text-sm font-medium text-gray-200">
              Display Name
            </label>
            <input
              type="text"
              name="display_name"
              id="display_name"
              value={profile.display_name || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-800 p-3 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Your Public Name"
              required
              minLength={2}
              maxLength={64}
            />
          </div>

          {/* Bio */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="bio" className="block text-sm font-medium text-gray-200">
                Bio
              </label>
              <span className={`text-xs ${bioLeft < 15 ? 'text-yellow-300' : 'text-gray-400'}`}>
                {bioLeft} / {BIO_MAX}
              </span>
            </div>
            <textarea
              name="bio"
              id="bio"
              rows={4}
              value={profile.bio || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-800 p-3 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Tell everyone a bit about yourself…"
              maxLength={BIO_MAX}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={status === 'saving' || !isDirty || usernameState === 'taken'}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-600 sm:w-auto"
            >
              {status === 'saving' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              <span>{status === 'saving' ? 'Saving…' : 'Save Profile'}</span>
            </button>

            <button
              type="button"
              onClick={resetChanges}
              disabled={!isDirty || status === 'saving'}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-700 px-4 py-3 font-semibold text-gray-100 transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              title="Revert unsaved changes"
            >
              <RefreshCcw className="h-5 w-5" />
              Reset
            </button>
          </div>
        </div>

        {/* Right column: preview card */}
        <aside className="hidden md:block">
          <div className="sticky top-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-700 text-gray-200">
                <UserIcon />
              </div>
              <div>
                <div className="text-lg font-semibold text-white">
                  {profile.display_name || 'Display Name'}
                </div>
                <div className="text-sm text-gray-400">@{profile.username || 'username'}</div>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm text-gray-300">
              {profile.bio || 'Your bio will appear here.'}
            </p>
            {profile.username && (
              <a
                href={`/profile/${profile.username}`}
                className="mt-4 inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200"
              >
                <LinkIcon className="h-4 w-4" /> View public profile
              </a>
            )}
          </div>
        </aside>
      </form>
    </div>
  );
}
