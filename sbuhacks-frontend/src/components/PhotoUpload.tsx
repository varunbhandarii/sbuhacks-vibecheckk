import { useState, type ChangeEvent, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { type PhotoSubmission } from '../types';
import { Upload, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL;
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;

interface PhotoUploadProps {
  targetType: 'event' | 'space';
  targetId: string;
  onUploadSuccess: () => void;
}

type UploadStatus = 'idle' | 'signing' | 'uploading' | 'confirming' | 'success' | 'error';

const MAX_MB = 10;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

export default function PhotoUpload({ targetType, targetId, onUploadSuccess }: PhotoUploadProps) {
  const { anonymousToken, isAuthenticated, login } = useAuth();
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAuthenticated || !anonymousToken) return login();

    if (!ACCEPTED.includes(file.type)) {
      setError('Please upload a PNG, JPEG, or WEBP image.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File too large. Max ${MAX_MB}MB.`);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
      return;
    }

    setStatus('signing');
    setError(null);

    try {
      const signResponse = await fetch(`${API_URL}/photos/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonymousToken}`,
        },
        body: JSON.stringify({ target_id: targetId, target_type: targetType }),
      });
      if (!signResponse.ok) throw new Error('Failed to get upload signature');

      const { signature, timestamp } = await signResponse.json();

      setStatus('uploading');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', CLOUDINARY_API_KEY);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('tags', `${targetType},${targetId}`);

      const cloudinaryResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );
      if (!cloudinaryResponse.ok) throw new Error('Failed to upload image to provider');
      const cloudinaryData = await cloudinaryResponse.json();
      const imageUrl = cloudinaryData.secure_url as string;

      setStatus('confirming');
      const submission: PhotoSubmission = { target_type: targetType, target_id: targetId, url: imageUrl };
      const backendResponse = await fetch(`${API_URL}/photos/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonymousToken}`,
        },
        body: JSON.stringify(submission),
      });
      if (!backendResponse.ok) throw new Error('Failed to save photo to event');

      setStatus('success');
      onUploadSuccess();
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    }
  };

  if (!isAuthenticated) {
    return <p className="text-gray-400">Log in to upload photos.</p>;
  }

  let statusContent: ReactNode = (
    <>
      <Upload className="h-5 w-5" />
      <span>Upload Photo</span>
    </>
  );
  let isDisabled = false;

  switch (status) {
    case 'signing':
    case 'uploading':
    case 'confirming':
      statusContent = (
        <>
          <Loader2 className="h-5 w-5 animate-spin" /> <span>Uploading…</span>
        </>
      );
      isDisabled = true;
      break;
    case 'success':
      statusContent = (
        <>
          <CheckCircle className="h-5 w-5" /> <span>Success!</span>
        </>
      );
      isDisabled = true;
      break;
    case 'error':
      statusContent = (
        <>
          <AlertTriangle className="h-5 w-5" /> <span>Error</span>
        </>
      );
      break;
  }

  return (
    <div className="mb-6">
      <label
        className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold text-white transition-all ${
          isDisabled ? 'cursor-not-allowed bg-gray-600' : 'bg-blue-600 hover:bg-blue-500'
        } ${status === 'success' ? '!bg-green-600' : ''} ${status === 'error' ? '!bg-red-600' : ''}`}
      >
        {statusContent}
        <input
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          disabled={isDisabled}
          onChange={handleFileChange}
          onClick={(e) => ((e.currentTarget as HTMLInputElement).value = '')}
        />
      </label>
      {error && <p className="mt-2 text-center text-red-400">{error}</p>}
    </div>
  );
}
