import React from "react";
import { Lock, LockOpen } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function WorkerLockButton({ worker, onUpdate }) {
  const [loading, setLoading] = React.useState(false);

  const handleToggleLock = async () => {
    setLoading(true);
    try {
      await base44.entities.Worker.update(worker.id, {
        availability_locked: !worker.availability_locked
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to toggle worker lock:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleLock}
      disabled={loading}
      className="hover:bg-gray-100 rounded p-1 transition-colors disabled:opacity-50"
      title={worker.availability_locked ? "נעול - לחץ לפתיחה" : "פתוח - לחץ לנעילה"}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      ) : worker.availability_locked ? (
        <Lock className="w-4 h-4 text-gray-900" />
      ) : (
        <LockOpen className="w-4 h-4 text-blue-500" />
      )}
    </button>
  );
}