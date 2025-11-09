// src/components/SpaceCard.tsx
import { type CampusSpace } from '../types';
import VibeBadge from './VibeBadge';
import { useAuth } from '../contexts/AuthContext';

// Import icons
import {
  Library,
  Utensils,
  Dumbbell,
  Car,
  Building,
  Coffee,
  ShoppingBasket,
  HelpCircle,
} from 'lucide-react';

// Map space types to icons
const spaceIcons = {
  library: <Library size={24} />,
  dining: <Utensils size={24} />,
  gym: <Dumbbell size={24} />,
  parking: <Car size={24} />,
  arena: <Building size={24} />,
  ballroom: <Coffee size={24} />, // Close enough
  pantry: <ShoppingBasket size={24} />,
};

interface SpaceCardProps {
  space: CampusSpace;
  // This function will tell the parent page to open the modal
  onRateVibe: (space: CampusSpace) => void;
}

export default function SpaceCard({ space, onRateVibe }: SpaceCardProps) {
  const { isAuthenticated } = useAuth();
  const icon = spaceIcons[space.type] || <HelpCircle size={24} />;

  return (
    <div className="flex flex-col justify-between rounded-lg bg-gray-800 p-6 shadow-lg">
      <div>
        {/* Header: Icon and Name */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600/20 text-blue-300">
            {icon}
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{space.name}</h3>
            <p className="text-sm capitalize text-gray-400">{space.type}</p>
          </div>
        </div>

        {/* Vibe Badge: REUSED from Task 2 */}
        <div className="mt-4">
          <VibeBadge targetId={space.id} targetType="space" />
        </div>
      </div>

      {/* Rate Button */}
      {isAuthenticated && (
        <button
          onClick={() => onRateVibe(space)}
          className="mt-6 w-full rounded-lg bg-gray-700 px-4 py-2 font-semibold text-white transition-colors hover:bg-gray-600"
        >
          Rate Vibe
        </button>
      )}
    </div>
  );
}