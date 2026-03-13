import React from "react";
import { Lock, LockOpen } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function WorkerLockButton({ worker, onUpdate }) {
  const handleToggleLock = async () => {
    await base44.entities.Worker.update(worker.id, {
      nickname: worker.nickname,
      role: worker.role,
      availability_locked: !worker.availability_locked
    });
    onUpdate();
  };

  return (
    <button
      onClick={handleToggleLock}
      className="hover:bg-gray-100 rounded p-1 transition-colors"
      title={worker.availability_locked ? "נעול - לחץ לפתיחה" : "פתוח - לחץ לנעילה"}
    >
      {worker.availability_locked ? (
        <Lock className="w-5 h-5 text-gray-900" />
      ) : (
        <LockOpen className="w-5 h-5 text-blue-500" />
      )}
    </button>
  );
}