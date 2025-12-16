'use client';

import { useState } from 'react';

export function SyncNowButton({ groupEventId }: { groupEventId: string }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/calendar-sync', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupEventId }),
      });

      const json = await res.json();
      // eslint-disable-next-line no-console
      console.log('[DebugCalendarSync] Sync response', json);
      alert(`Sync result: ${JSON.stringify(json)}`);
    } catch (err) {
      console.error('[DebugCalendarSync] Sync error', err);
      alert('Error al sincronizar. Revisa la consola.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="rounded border px-3 py-1 text-xs font-medium hover:bg-slate-900 disabled:opacity-60"
    >
      {loading ? 'Sync...' : 'Sync ahora'}
    </button>
  );
}
