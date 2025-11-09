import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type DragEvent,
  type ReactNode,
} from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  Save,
  Upload,
  Image as ImageIcon,
  Clock,
  MapPin,
  Tag as TagIcon,
  Trash2,
  Plus,
  Sparkles,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL;
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;

type Status = 'idle' | 'saving' | 'success' | 'error';
type ImageStatus = 'idle' | 'signing' | 'uploading' | 'success' | 'error';

const MAX_MB = 10;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

interface CreatedEvent {
  id: string;
  [k: string]: unknown;
}

export default function CreateEventPage() {
  const { anonymousToken, role, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<Status>('idle');
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [locationName, setLocationName] = useState('');

  // Tags (chip-style)
  const [tagInput, setTagInput] = useState('');
  const [tagList, setTagList] = useState<string[]>([]);

  // Image upload
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<ImageStatus>('idle');
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const dropRef = useRef<HTMLLabelElement | null>(null);

  // Redirect non-organizers
  if (!isAuthenticated || role !== 'organizer') {
    return <Navigate to="/" replace />;
  }

  // ---- Helpers ----
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const addTag = useCallback(
    (raw: string) => {
      const t = raw.trim().replace(/\s+/g, ' ');
      if (!t) return;
      if (!tagList.includes(t) && tagList.length < 10) setTagList((prev) => [...prev, t]);
    },
    [tagList]
  );

  const removeTag = (t: string) => setTagList((prev) => prev.filter((x) => x !== t));

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && tagList.length) {
      setTagList((prev) => prev.slice(0, -1));
    }
  };

  const validateTimes = () => {
    if (!startTime || !endTime) return null;
    const s = new Date(startTime).getTime();
    const e = new Date(endTime).getTime();
    if (isNaN(s) || isNaN(e)) return 'Invalid date/time.';
    if (e <= s) return 'End time must be after start time.';
    return null;
  };
  const timeError = validateTimes();

  const canSubmit =
    !!title.trim() &&
    !!description.trim() &&
    !!startTime &&
    !!endTime &&
    !timeError &&
    status !== 'saving' &&
    imageStatus !== 'uploading';

  // Quick-fill helpers
  const quickSetTimes = (hoursFromNow = 1, durationHours = 2) => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + hoursFromNow);
    const end = new Date(now);
    end.setHours(end.getHours() + durationHours);
    const toLocal = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setStartTime(toLocal(now));
    setEndTime(toLocal(end));
  };

  // ---- Image Upload (drop + click) with progress ----
  const validateFile = (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      throw new Error('Please upload a PNG, JPEG, or WEBP image.');
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      throw new Error(`File too large. Max ${MAX_MB}MB.`);
    }
  };

  const uploadToCloudinaryWithProgress = async (
    file: File,
    signature: string,
    timestamp: number,
    cloudName: string,
    apiKey: string
  ) => {
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', apiKey);
      form.append('timestamp', String(timestamp));
      form.append('signature', signature);
      form.append('tags', 'event');

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(pct);
        }
      });

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          try {
            if (xhr.status >= 200 && xhr.status < 300) {
              const json = JSON.parse(xhr.responseText);
              resolve(json.secure_url as string);
            } else {
              reject(new Error('Failed to upload image to provider'));
            }
          } catch (err) {
            reject(err);
          }
        }
      };

      xhr.open('POST', url);
      xhr.send(form);
    });
  };

  const processFile = async (file: File) => {
    try {
      validateFile(file);
      setImageStatus('signing');
      setImageError(null);
      setUploadProgress(0);
      setImageUrl(null);

      const signRes = await fetch(`${API_URL}/photos/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonymousToken}`,
        },
        body: JSON.stringify({ target_type: 'event' }),
      });
      if (!signRes.ok) throw new Error('Failed to get upload signature');
      const { signature, timestamp, api_key, cloud_name } = await signRes.json();

      setImageStatus('uploading');
      const url = await uploadToCloudinaryWithProgress(
        file,
        signature,
        timestamp,
        cloud_name ?? CLOUDINARY_CLOUD_NAME,
        api_key ?? CLOUDINARY_API_KEY
      );

      setImageUrl(url);
      setImageStatus('success');
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Upload failed');
      setImageStatus('error');
    }
  };

  const handleImageInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.currentTarget.value = ''; // allow re-upload of same file
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    await processFile(f);
    dropRef.current?.classList.remove('ring-2', 'ring-blue-500');
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.add('ring-2', 'ring-blue-500');
  };
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.remove('ring-2', 'ring-blue-500');
  };

  // ---- Submit ----
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!anonymousToken || !canSubmit) return;

    setStatus('saving');
    setFormError(null);

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      location_name: locationName.trim(),
      tags: tagList,
      image_url: imageUrl || undefined,
    };

    try {
      const res = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonymousToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 403) throw new Error('Permission denied. You must be an organizer.');
      if (!res.ok) throw new Error('Failed to create event.');

      const created: CreatedEvent = await res.json();
      setStatus('success');

      setTimeout(() => {
        if (created?.id) {
          navigate(`/event/${created.id}`);
        } else {
          setTitle('');
          setDescription('');
          setStartTime('');
          setEndTime('');
          setLocationName('');
          setTagList([]);
          setImageUrl(null);
          setImageStatus('idle');
          setStatus('idle');
        }
      }, 800);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  };

  // ---- UI bits ----
  const imageStatusNode: ReactNode = (() => {
    switch (imageStatus) {
      case 'signing':
        return (
          <div className="flex items-center gap-2 text-gray-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Preparing upload…</span>
          </div>
        );
      case 'uploading':
        return (
          <div className="flex w-full items-center gap-3 text-blue-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Uploading {uploadProgress}%</span>
            <div className="h-1 flex-1 rounded bg-gray-700">
              <div className="h-1 rounded bg-blue-500" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="h-5 w-5" />
            <span>Upload complete</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <span>Upload failed</span>
            </div>
            {imageError && <p className="text-xs text-red-300">{imageError}</p>}
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-gray-300">
            <Upload className="h-5 w-5" />
            <span>Upload a banner image</span>
          </div>
        );
    }
  })();

  const PreviewCard = () => (
    <div className="sticky top-4 rounded-xl border border-gray-800 bg-gray-900 p-3">
      <div className="relative mb-3 h-40 w-full overflow-hidden rounded-lg bg-gray-800">
        {imageUrl ? (
          <img src={imageUrl} alt="Banner preview" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-500">
            <ImageIcon className="mr-2 h-5 w-5" /> No image
          </div>
        )}
      </div>
      <h3 className="line-clamp-2 text-lg font-semibold text-white">{title || 'Event title'}</h3>
      <div className="mt-2 space-y-1 text-sm text-gray-300">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-300" />
          <span>
            {startTime ? new Date(startTime).toLocaleString() : 'Start'} →{' '}
            {endTime ? new Date(endTime).toLocaleString() : 'End'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-300" />
          <span>{locationName || 'Location'}</span>
        </div>
        {!!tagList.length && (
          <div className="mt-2 flex flex-wrap gap-2">
            {tagList.map((t) => (
              <span key={t} className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-200">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-blue-300">
          <Sparkles size={18} />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Create New Event</h1>
          <p className="text-xs text-gray-400">
            Organizer tools — times are saved in your local timezone (<span className="font-mono">{tz}</span>).
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left column: form */}
        <div className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-600 bg-gray-800 p-3"
              placeholder="e.g., SBU Hack Night"
              required
              minLength={5}
            />
          </div>

          {/* Banner */}
          <div>
            <label className="block text-sm font-medium">Event Banner</label>
            <label
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className="mt-1 flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-600 px-4 py-6 text-center transition-colors hover:border-gray-500"
            >
              {imageStatusNode}
              <p className="mt-2 text-xs text-gray-400">PNG, JPG, or WEBP up to {MAX_MB}MB</p>
              <input type="file" accept={ACCEPTED.join(',')} className="hidden" onChange={handleImageInput} />
            </label>

            {imageUrl && (
              <div className="mt-3 flex items-center justify-between rounded-md bg-gray-800 p-2">
                <span className="truncate text-sm text-gray-300">{imageUrl}</span>
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl(null);
                    setImageStatus('idle');
                    setUploadProgress(0);
                  }}
                  className="inline-flex items-center gap-1 rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-600 bg-gray-800 p-3"
              placeholder="What is this event about? Who should come? Any RSVP or requirements?"
              required
              minLength={20}
            />
          </div>

          {/* Schedule */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Schedule</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => quickSetTimes(1, 2)}
                  className="rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700"
                >
                  +1h start / 2h
                </button>
                <button
                  type="button"
                  onClick={() => quickSetTimes(0, 1)}
                  className="rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700"
                >
                  Now / 1h
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="start_time" className="block text-xs text-gray-300">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  id="start_time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-600 bg-gray-800 p-3"
                  required
                />
              </div>
              <div>
                <label htmlFor="end_time" className="block text-xs text-gray-300">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  id="end_time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-600 bg-gray-800 p-3"
                  required
                />
              </div>
            </div>
            {timeError && <p className="mt-2 text-sm text-red-400">{timeError}</p>}
            <p className="mt-1 flex items-center gap-2 text-xs text-gray-400">
              <Clock className="h-3 w-3" /> Times saved in <span className="font-mono">{tz}</span>
            </p>
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location_name" className="block text-sm font-medium">
              Location
            </label>
            <input
              type="text"
              id="location_name"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-600 bg-gray-800 p-3"
              placeholder="e.g., Melville Library W-4500"
              required
            />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1 block text-sm font-medium">Tags</label>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-700 bg-gray-800 p-2">
              <TagIcon className="h-4 w-4 text-gray-400" />
              {tagList.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-100"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="text-gray-300 hover:text-white"
                    aria-label={`Remove ${t}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Type a tag and press Enter"
                className="min-w-[160px] flex-1 bg-transparent p-1 text-sm text-gray-200 outline-none placeholder-gray-500"
              />
              <button
                type="button"
                onClick={() => {
                  addTag(tagInput);
                  setTagInput('');
                }}
                className="inline-flex items-center gap-1 rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">e.g., tech, free food, workshop (max 10)</p>
          </div>

          {/* Submit */}
          <div className="flex flex-col gap-4">
            {status === 'error' && (
              <div className="flex items-center gap-2 rounded-md bg-red-800/50 p-3 text-red-300">
                <AlertTriangle size={16} />
                <p>{formError}</p>
              </div>
            )}
            {status === 'success' && (
              <div className="flex items-center gap-2 rounded-md bg-green-800/50 p-3 text-green-300">
                <CheckCircle size={16} />
                <p>Event created successfully!</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-600"
            >
              {status === 'saving' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              <span>{status === 'saving' ? 'Creating…' : 'Create Event'}</span>
            </button>
          </div>
        </div>

        {/* Right column: live preview */}
        <div className="hidden md:block">
          <PreviewCard />
        </div>
      </form>
    </div>
  );
}
