import {
  useCallback, useMemo, useRef, useState,
  type ChangeEvent, type FormEvent, type DragEvent, type ReactNode,
} from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Loader2, CheckCircle, AlertTriangle, Save, Upload,
  Image as ImageIcon, Clock, MapPin, Tag as TagIcon, Trash2, Plus, Sparkles,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL;
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;

type Status = 'idle' | 'saving' | 'success' | 'error';
type ImageStatus = 'idle' | 'signing' | 'uploading' | 'success' | 'error';
const MAX_MB = 10;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

interface CreatedEvent { id: string; [k: string]: unknown; }

export default function CreateEventPage() {
  const { anonymousToken, role, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tagList, setTagList] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<ImageStatus>('idle');
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const dropRef = useRef<HTMLLabelElement | null>(null);

  if (!isAuthenticated || role !== 'organizer') return <Navigate to="/" replace />;

  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const addTag = useCallback((raw: string) => {
    const t = raw.trim().replace(/\s+/g, ' ');
    if (!t) return;
    if (!tagList.includes(t) && tagList.length < 10) setTagList((prev) => [...prev, t]);
  }, [tagList]);
  const removeTag = (t: string) => setTagList((prev) => prev.filter((x) => x !== t));
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); setTagInput(''); }
    else if (e.key === 'Backspace' && !tagInput && tagList.length) setTagList((prev) => prev.slice(0, -1));
  };
  const validateTimes = () => {
    if (!startTime || !endTime) return null;
    const s = new Date(startTime).getTime(); const e = new Date(endTime).getTime();
    if (isNaN(s) || isNaN(e)) return 'Invalid date/time.';
    if (e <= s) return 'End time must be after start time.';
    return null;
  };
  const timeError = validateTimes();
  const canSubmit = !!title.trim() && !!description.trim() && !!startTime && !!endTime && !timeError && status !== 'saving' && imageStatus !== 'uploading';

  const quickSetTimes = (hoursFromNow = 1, durationHours = 2) => {
    const now = new Date(); now.setMinutes(0, 0, 0); now.setHours(now.getHours() + hoursFromNow);
    const end = new Date(now); end.setHours(end.getHours() + durationHours);
    const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setStartTime(toLocal(now)); setEndTime(toLocal(end));
  };

  const validateFile = (file: File) => {
    if (!ACCEPTED.includes(file.type)) throw new Error('Please upload a PNG, JPEG, or WEBP image.');
    if (file.size > MAX_MB * 1024 * 1024) throw new Error(`File too large. Max ${MAX_MB}MB.`);
  };

  const uploadToCloudinaryWithProgress = async (file: File, signature: string, timestamp: number, cloudName: string, apiKey: string) => {
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
      const form = new FormData();
      form.append('file', file); form.append('api_key', apiKey); form.append('timestamp', String(timestamp)); form.append('signature', signature); form.append('tags', 'event');
      xhr.upload.addEventListener('progress', (e) => { if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100)); });
      xhr.onreadystatechange = () => { if (xhr.readyState === 4) { try { if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText).secure_url); else reject(new Error('Upload failed')); } catch (err) { reject(err); } } };
      xhr.open('POST', url); xhr.send(form);
    });
  };

  const processFile = async (file: File) => {
    try {
      validateFile(file); setImageStatus('signing'); setImageError(null); setUploadProgress(0); setImageUrl(null);
      const signRes = await fetch(`${API_URL}/photos/sign`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonymousToken}` }, body: JSON.stringify({ target_type: 'event' }) });
      if (!signRes.ok) throw new Error('Failed to get upload signature');
      const { signature, timestamp, api_key, cloud_name } = await signRes.json();
      setImageStatus('uploading');
      const url = await uploadToCloudinaryWithProgress(file, signature, timestamp, cloud_name ?? CLOUDINARY_CLOUD_NAME, api_key ?? CLOUDINARY_API_KEY);
      setImageUrl(url); setImageStatus('success');
    } catch (err) { setImageError(err instanceof Error ? err.message : 'Upload failed'); setImageStatus('error'); }
  };

  const handleImageInput = async (e: ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; await processFile(file); e.currentTarget.value = ''; };
  const handleDrop = async (e: DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (!f) return; await processFile(f); };
  const handleDragOver = (e: DragEvent) => { e.preventDefault(); };
  const handleDragLeave = (e: DragEvent) => { e.preventDefault(); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); if (!anonymousToken || !canSubmit) return;
    setStatus('saving'); setFormError(null);
    const payload: Record<string, unknown> = { title: title.trim(), description: description.trim(), start_time: new Date(startTime).toISOString(), end_time: new Date(endTime).toISOString(), location_name: locationName.trim(), tags: tagList, image_url: imageUrl || undefined };
    try {
      const res = await fetch(`${API_URL}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonymousToken}` }, body: JSON.stringify(payload) });
      if (res.status === 403) throw new Error('Permission denied.');
      if (!res.ok) throw new Error('Failed to create event.');
      const created: CreatedEvent = await res.json();
      setStatus('success');
      setTimeout(() => { if (created?.id) navigate(`/event/${created.id}`); else { setTitle(''); setDescription(''); setStartTime(''); setEndTime(''); setLocationName(''); setTagList([]); setImageUrl(null); setImageStatus('idle'); setStatus('idle'); } }, 800);
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Unknown error'); setStatus('error'); }
  };

  const imageStatusNode: ReactNode = (() => {
    switch (imageStatus) {
      case 'signing': return <div className="flex items-center gap-2 text-mono-500"><Loader2 className="h-5 w-5 animate-spin" /><span>Preparing…</span></div>;
      case 'uploading': return <div className="flex w-full items-center gap-3 text-mono-600"><Loader2 className="h-5 w-5 animate-spin" /><span>Uploading {uploadProgress}%</span><div className="h-1 flex-1 rounded-full bg-mono-200"><div className="h-1 rounded-full bg-white transition-all" style={{ width: `${uploadProgress}%` }} /></div></div>;
      case 'success': return <div className="flex items-center gap-2 text-white"><CheckCircle className="h-5 w-5" /><span>Upload complete</span></div>;
      case 'error': return <div className="flex flex-col gap-1"><div className="flex items-center gap-2 text-mono-600"><AlertTriangle className="h-5 w-5" /><span>Upload failed</span></div>{imageError && <p className="text-[11px] text-mono-400">{imageError}</p>}</div>;
      default: return <div className="flex items-center gap-2 text-mono-500"><Upload className="h-5 w-5" /><span>Upload a banner image</span></div>;
    }
  })();

  const PreviewCard = () => (
    <div className="sticky top-20 rounded-3xl border border-white/[0.06] bg-mono-50 p-4">
      <div className="relative mb-3 h-40 w-full overflow-hidden rounded-2xl bg-mono-100">
        {imageUrl ? <img src={imageUrl} alt="Banner preview" className="h-full w-full object-cover grayscale-[20%]" /> : <div className="flex h-full w-full items-center justify-center text-mono-400"><ImageIcon className="mr-2 h-5 w-5" /> No image</div>}
      </div>
      <h3 className="line-clamp-2 text-lg font-bold text-white">{title || 'Event title'}</h3>
      <div className="mt-3 space-y-2 text-[13px] text-mono-600">
        <div className="flex items-center gap-2"><Clock className="h-4 w-4 opacity-50" /><span>{startTime ? new Date(startTime).toLocaleString() : 'Start'} → {endTime ? new Date(endTime).toLocaleString() : 'End'}</span></div>
        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 opacity-50" /><span>{locationName || 'Location'}</span></div>
        {!!tagList.length && <div className="mt-2 flex flex-wrap gap-2">{tagList.map((t) => <span key={t} className="rounded-full border border-white/[0.06] bg-mono-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-mono-500">{t}</span>)}</div>}
      </div>
    </div>
  );

  const inputClass = "mt-1 block w-full rounded-2xl border border-white/[0.08] bg-mono-50 p-3.5 text-[14px] text-white placeholder-mono-400 transition-all focus:border-white/20 focus:outline-none";

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-mono-50 text-mono-600"><Sparkles size={18} /></span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Create Event</h1>
            <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-mono-400">Timezone: <span className="font-mono">{tz}</span></p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            <div><label htmlFor="title" className="block text-[11px] font-semibold uppercase tracking-widest text-mono-400">Title</label><input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="e.g., SBU Hack Night" required minLength={5} /></div>

            <div><label className="block text-[11px] font-semibold uppercase tracking-widest text-mono-400">Banner</label>
              <label ref={dropRef} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                className="mt-1 flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/[0.08] px-4 py-8 text-center transition-all hover:border-white/20">
                {imageStatusNode}
                <p className="mt-2 text-[11px] text-mono-400">PNG, JPG, or WEBP up to {MAX_MB}MB</p>
                <input type="file" accept={ACCEPTED.join(',')} className="hidden" onChange={handleImageInput} />
              </label>
              {imageUrl && <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-mono-50 p-3"><span className="truncate text-[13px] text-mono-500">{imageUrl}</span><button type="button" onClick={() => { setImageUrl(null); setImageStatus('idle'); setUploadProgress(0); }} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-mono-500 hover:bg-white hover:text-black"><Trash2 className="h-3 w-3" /> Remove</button></div>}
            </div>

            <div><label htmlFor="description" className="block text-[11px] font-semibold uppercase tracking-widest text-mono-400">Description</label><textarea id="description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="What is this event about?" required minLength={20} /></div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-mono-400">Schedule</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => quickSetTimes(1, 2)} className="rounded-full border border-white/[0.06] bg-mono-50 px-3 py-1 text-[11px] font-semibold text-mono-500 hover:text-white">+1h / 2h</button>
                  <button type="button" onClick={() => quickSetTimes(0, 1)} className="rounded-full border border-white/[0.06] bg-mono-50 px-3 py-1 text-[11px] font-semibold text-mono-500 hover:text-white">Now / 1h</button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label htmlFor="start_time" className="block text-[11px] text-mono-400">Start</label><input type="datetime-local" id="start_time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} required /></div>
                <div><label htmlFor="end_time" className="block text-[11px] text-mono-400">End</label><input type="datetime-local" id="end_time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} required /></div>
              </div>
              {timeError && <p className="mt-2 text-[12px] text-mono-500">{timeError}</p>}
            </div>

            <div><label htmlFor="location_name" className="block text-[11px] font-semibold uppercase tracking-widest text-mono-400">Location</label><input type="text" id="location_name" value={locationName} onChange={(e) => setLocationName(e.target.value)} className={inputClass} placeholder="e.g., Melville Library W-4500" required /></div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-mono-400">Tags</label>
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.08] bg-mono-50 p-3">
                <TagIcon className="h-4 w-4 text-mono-400" />
                {tagList.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-mono-100 px-2.5 py-0.5 text-[11px] font-semibold text-mono-600">{t}<button type="button" onClick={() => removeTag(t)} className="text-mono-400 hover:text-white" aria-label={`Remove ${t}`}>×</button></span>)}
                <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} placeholder="Type tag + Enter" className="min-w-[140px] flex-1 bg-transparent p-1 text-[13px] text-white outline-none placeholder-mono-400" />
                <button type="button" onClick={() => { addTag(tagInput); setTagInput(''); }} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-mono-500 hover:bg-white hover:text-black"><Plus className="h-3 w-3" /> Add</button>
              </div>
              <p className="mt-1 text-[11px] text-mono-400">e.g., tech, free food, workshop (max 10)</p>
            </div>

            <div className="flex flex-col gap-4">
              {status === 'error' && <div className="rounded-2xl border border-white/[0.06] bg-mono-50 p-4 text-[13px] text-mono-600"><AlertTriangle size={14} className="mb-1 inline opacity-50" /> {formError}</div>}
              {status === 'success' && <div className="rounded-2xl border border-white/[0.06] bg-mono-50 p-4 text-[13px] text-white"><CheckCircle size={14} className="mb-1 inline opacity-50" /> Event created successfully!</div>}
              <button type="submit" disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3.5 text-[13px] font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-mono-200 disabled:text-mono-400">
                {status === 'saving' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                <span>{status === 'saving' ? 'Creating…' : 'Create Event'}</span>
              </button>
            </div>
          </div>

          <div className="hidden md:block"><PreviewCard /></div>
        </form>
      </div>
    </div>
  );
}
