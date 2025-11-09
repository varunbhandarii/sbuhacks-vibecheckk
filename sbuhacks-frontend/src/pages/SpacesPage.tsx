// src/pages/SpacesPage.tsx
import { useState, useEffect } from 'react';
import { type CampusSpace } from '../types';
import SpaceCard from '../components/SpaceCard';
import VibeCheckModal from '../components/VibeCheckModal'; // REUSED from Task 3

const API_URL = import.meta.env.VITE_API_BASE_URL;

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<CampusSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Modal State ---
  // We'll store the *entire* space object when user clicks "Rate"
  const [selectedSpace, setSelectedSpace] = useState<CampusSpace | null>(null);

  // 1. Fetch all spaces from Person A's endpoint
  useEffect(() => {
    async function fetchSpaces() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_URL}/spaces`);
        if (!response.ok) {
          throw new Error('Failed to fetch campus spaces');
        }

        const data: CampusSpace[] = await response.json();
        setSpaces(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchSpaces();
  }, []); // Run once on mount

  // --- Render Logic ---

  if (loading) {
    return (
      <div className="p-4 text-center text-lg text-gray-300">
        Loading campus spaces...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-lg text-red-400">
        Error: {error}
      </div>
    );
  }

  return (
    <>
      {/* 2. Main Page Content: Grid of Spaces */}
      <div className="p-4 md:p-8">
        <h1 className="mb-6 text-3xl font-bold">Campus Spaces</h1>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
              onRateVibe={() => setSelectedSpace(space)} // Set the space to be rated
            />
          ))}
        </div>
      </div>

      {/* 3. The Modal: REUSED from Task 3 */}
      {/* It only renders when 'selectedSpace' is not null */}
      {selectedSpace && (
        <VibeCheckModal
          targetId={selectedSpace.id}
          targetType="space" // <-- The critical prop
          targetName={selectedSpace.name}
          onClose={() => setSelectedSpace(null)} // Close modal by clearing state
        />
      )}
    </>
  );
}