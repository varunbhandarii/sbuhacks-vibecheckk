// src/pages/AdminPage.tsx
import { useState, type FormEvent } from 'react';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL;
type Status = 'idle' | 'promoting' | 'success' | 'error';

export default function AdminPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [username, setUsername] = useState('');
  const [adminKey, setAdminKey] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('promoting');
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_URL}/admin/promote/${username}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey, // Send the special key
        },
      });

      if (response.status === 401) {
        throw new Error('Invalid Admin Key');
      }
      if (response.status === 404) {
        throw new Error('User not found');
      }
      if (!response.ok) {
        throw new Error('Failed to promote user');
      }

      const data = await response.json();
      setStatus('success');
      setSuccess(`Success! ${data.username} is now an organizer.`);
      setUsername(''); // Clear username on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  };

  return (
    <div className="mx-auto max-w-lg p-4 md:p-8">
      <h1 className="mb-6 text-3xl font-bold">Admin Panel</h1>
      <p className="mb-6 text-gray-400">
        Use this form to promote a user to the "organizer" role.
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="username" className="block text-sm font-medium">
            Username to Promote
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-600 bg-gray-800 p-3"
            placeholder="@username"
            required
          />
        </div>

        <div>
          <label htmlFor="adminKey" className="block text-sm font-medium">
            Admin Key
          </label>
          <input
            type="password"
            id="adminKey"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-600 bg-gray-800 p-3"
            placeholder="••••••••••••"
            required
          />
        </div>

        <div className="flex flex-col gap-4">
          {status === 'error' && (
            <div className="flex items-center gap-2 rounded-md bg-red-800/50 p-3 text-red-300">
              <AlertTriangle size={16} />
              <p>{error}</p>
            </div>
          )}
          {status === 'success' && (
            <div className="flex items-center gap-2 rounded-md bg-green-800/50 p-3 text-green-300">
              <CheckCircle size={16} />
              <p>{success}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={status === 'promoting'}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:bg-gray-600"
          >
            {status === 'promoting' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'Promote to Organizer'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}