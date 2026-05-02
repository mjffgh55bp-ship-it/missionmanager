import React from "react";
import { Lock, LockOpen } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function WorkerLockButton({ worker, onUpdate }) {
  const [loading, setLoading] = React.useState(false);
  const [localLocked, setLocalLocked] = React.useState(worker.availability_locked);

  // Sync with incoming prop if it changes
  React.useEffect(() => {
    setLocalLocked(worker.availability_locked);
  }, [worker.availability_locked]);

  const handleToggleLock = async () => {
    const newValue = !localLocked;
    setLocalLocked(newValue); // optimistic update
    setLoading(true);
    try {
      // Ensure role is always an array (some old records have it as a string)
      const role = Array.isArray(worker.role) ? worker.role : (worker.role ? [worker.role] : []);
      await base44.entities.Worker.update(worker.id, {
        availability_locked: newValue,
        role
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to toggle worker lock:', error);
      setLocalLocked(!newValue); // revert on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleLock}
      disabled={loading}
      className="hover:bg-gray-100 rounded p-1 transition-colors disabled:opacity-50"
      title={localLocked ? "נעול - לחץ לפתיחה" : "פתוח - לחץ לנעילה"}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      ) : localLocked ? (
        <Lock className="w-4 h-4 text-gray-900" />
      ) : (
        <LockOpen className="w-4 h-4 text-blue-500" />
      )}
    </button>
  );
}