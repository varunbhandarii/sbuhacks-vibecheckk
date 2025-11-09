import { useEffect, useState } from 'react';
import { type Photo } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, EyeOff, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL;

interface PhotoGalleryProps {
  targetType: 'event' | 'space';
  targetId: string;
  refreshKey: number;
}

export default function PhotoGallery({ targetType, targetId, refreshKey }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const { anonymousToken } = useAuth();

  useEffect(() => {
    (async () => {
      if (!anonymousToken) return;
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/photos/${targetType}/${targetId}`, {
          headers: { Authorization: `Bearer ${anonymousToken}` },
        });
        if (!response.ok) throw new Error('Failed to load photos');
        const data: Photo[] = await response.json();
        setPhotos(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [targetType, targetId, anonymousToken, refreshKey]);

  if (isLoading) return <Loader2 className="mx-auto my-8 h-8 w-8 animate-spin" />;
  if (error) return <p className="text-center text-red-400">{error}</p>;
  if (photos.length === 0) return <p className="text-center text-gray-400">No photos yet. Be the first!</p>;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo) => (
          <button
            key={photo.id}
            onClick={() => photo.status !== 'flagged' && setLightbox(photo)}
            className="group relative aspect-square"
            aria-label="Open photo"
          >
            {photo.status === 'flagged' ? (
              <div className="flex h-full w-full flex-col items-center justify-center rounded-lg bg-gray-700">
                <EyeOff className="h-8 w-8 text-gray-400" />
                <span className="mt-2 text-xs text-gray-400">Flagged Content</span>
              </div>
            ) : (
              <img src={photo.url} alt="Event photo" loading="lazy" className="h-full w-full rounded-lg object-cover shadow-md" />
            )}
          </button>
        ))}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setLightbox(null)}>
          <img
            src={lightbox.url}
            alt="Event photo full"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute right-6 top-6 rounded bg-gray-800/70 p-2 hover:bg-gray-700"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X />
          </button>
        </div>
      )}
    </>
  );
}
