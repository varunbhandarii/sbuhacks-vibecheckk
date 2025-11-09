// src/types.ts
export type RSVPStatus = 'going' | 'interested' | 'not_interested';
export type RSVPVisibility = 'public' | 'private';

// This is what the POST body will look like
export interface RSVPSubmission {
  event_id: string;
  status: RSVPStatus;
  visibility: RSVPVisibility;
}

// This is the full response from GET /rsvp/{event_id}/counts
// It includes public counts AND the user's private status
export interface RSVPDetails {
  counts: {
    going: number;
    interested: number;
  };
  my_status: RSVPStatus | null;
  my_visibility: RSVPVisibility | null;
}
// Based on your 'Data Model' plan
export interface SBUEvent {
  id: string; // uuid
  title: string;
  description: string;
  start_time: string; // ISO 8601 string
  end_time: string;   // ISO 8601 string
  location_name: string;
  image_url?: string;
  tags: string[];
  // We'll add other fields like vibes, rsvps later
  rsvp_counts?: {
    going: number;
    interested: number;
  };

  vibe_question_1_text: string | null;
  vibe_question_1_options: string[] | null;
  vibe_question_2_text: string | null;
  vibe_question_2_options: string[] | null;
}

// Based on the 'API Sketch' for GET /vibes/summary
export interface VibeSummary {
  avg: number | null; // Average rating
  count: number;    // Total number of ratings
  trend: number;    // e.g., +1, -1, or 0 for up/down/stable
}

export type VibeRatingEnum = 'empty' | 'studying' | 'lively' | 'packed';

export const VIBE_RATINGS: { id: VibeRatingEnum; label: string }[] = [
  { id: 'empty', label: 'Empty' },
  { id: 'studying', label: 'Studying' },
  { id: 'lively', label: 'Lively' },
  { id: 'packed', label: 'Packed' },
];

// This is the shape of the JSON we will POST to /vibes
export interface VibeSubmission {
  target_id: string;
  target_type: 'event' | 'space';
  
  // For Spaces (the old way)
  rating_enum?: VibeRatingEnum;
  crowd?: number;
  queue?: number;

  // For Events (the new way)
  answer_1?: string;
  answer_2?: string | null;
}

// A single chat message in our state
export interface ChatMessage {
  id: string; // For React key
  role: 'user' | 'bot';
  content: string;
  events?: SBUEvent[]; // Optional array of events
}

// The expected JSON response from POST /ai/query
export interface AIChatResponse {
  natural_language_response: string;
  structured_results: SBUEvent[];
}

export interface CampusSpace {
  id: string; // uuid
  name: string; // e.g., "Melville Library - Main Stacks"
  type: 'library' | 'dining' | 'gym' | 'parking' | 'arena' | 'ballroom' | 'pantry';
  lat: number;
  lon: number;
}

export interface ChatMessageData {
  id: string;
  channel: string;
  anon_id: string; // The anonymous user ID of the sender
  message: string;
  ts: string; // ISO 8601 timestamp
  moderation_flag?: boolean;
}

// The body for POSTING a new message
export interface ChatMessageSubmission {
  message: string;
}

// The full Photo object from our backend
export interface Photo {
  id: string;
  url: string; // The Cloudinary URL
  target_id: string;
  anon_id: string;
  status: 'approved' | 'flagged' | 'removed';
  ts: string;
}

// The body we POST to our *backend* after
// the Cloudinary upload is successful
export interface PhotoSubmission {
  target_type: 'event' | 'space';
  target_id: string;
  url: string; // The URL from Cloudinary
}

// This is the full profile object
export interface UserProfile {
  username: string; // The unique @handle
  display_name: string;
  bio: string | null;
}

// This is used for the PUT /profile/me request
export type UserProfileUpdate = Partial<UserProfile>;

export type UserRole = 'student' | 'organizer';

// 2. Add 'role' to the AuthContextType
interface AuthContextType {
  anonymousToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: UserRole; // <-- ADD THIS
  login: () => void;
  logout: () => void;
}

export type SortOrder = 'hyped' | 'time';

// The public user info we expect the backend to send
// with each feedback item.
export interface FeedbackAuthor {
  username: string;
  display_name: string;
}

// The full feedback object returned by GET /events/{id}/feedback
export interface EventFeedback {
  id: string;
  rating: number; // 1-5
  review: string | null;
  ts: string; // ISO timestamp
  author: FeedbackAuthor;
}

// The data we send when POSTing a new feedback
export interface FeedbackSubmission {
  rating: number;
  review?: string;
}

export interface PublicAttendee {
  username: string;
  profile_image_url: string | null;
}