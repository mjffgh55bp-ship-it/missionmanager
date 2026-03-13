import React from "react";
import { Lock, LockOpen } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function WorkerLockButton({ worker, onUpdate }) {
  const handleToggleLock = async () => {
    if (!worker.nickname || !worker.role) {
      console.error('Cannot update worker: missing required fields (nickname or role)', worker);
      alert('לא ניתן לעדכן עובד זה - חסר שם או תפקיד');
      return;
    }
    
    try {
      await base44.entities.Worker.update(worker.id, {
        nickname: worker.nickname,
        role: worker.role,
        availability_locked: !worker.availability_locked
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to toggle worker lock:', error);
      alert('שגיאה בעדכון סטטוס נעילה');
    }
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