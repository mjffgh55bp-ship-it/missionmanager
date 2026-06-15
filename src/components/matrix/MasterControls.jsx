import React from "react";
import { Lock, LockOpen, MessageCircle, Send, Eye, EyeOff } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function MasterControls({ 
  workers, 
  populationFilter, 
  roleFilter, 
  getWorkerSendStatus, 
  onSendWhatsApp,
  onSendEmail,
  sendingWhatsApp,
  onUpdate,
  isWeekPublished,
  onTogglePublish,
  togglingPublish,
}) {
  const [isLocking, setIsLocking] = React.useState(false);
  
  const visibleWorkers = workers.filter(w => {
    if (populationFilter !== "__all__" && w.population !== populationFilter) return false;
    if (roleFilter !== "__all__") {
      const roles = Array.isArray(w.role) ? w.role : [w.role];
      if (!roles.includes(roleFilter)) return false;
    }
    return true;
  });

  const allLocked = visibleWorkers.length > 0 && visibleWorkers.every(w => w.availability_locked);

  const handleMasterLockToggle = async () => {
    if (isLocking || visibleWorkers.length === 0) return;
    setIsLocking(true);
    
    try {
      const targetLockState = !allLocked;
      
      // Update in small sequential batches to avoid rate limit
      const batchSize = 3;
      for (let i = 0; i < visibleWorkers.length; i += batchSize) {
        const batch = visibleWorkers.slice(i, i + batchSize);
        await Promise.all(
          batch.map(worker => {
            // Ensure role is always an array (some old records have it as a string)
            const role = Array.isArray(worker.role) ? worker.role : (worker.role ? [worker.role] : []);
            return base44.entities.Worker.update(worker.id, {
              availability_locked: targetLockState,
              role
            }).catch(err => {
              console.error(`Failed to update worker ${worker.nickname}:`, err);
            });
          })
        );
        // Small delay between batches to respect rate limit
        if (i + batchSize < visibleWorkers.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      onUpdate();
    } catch (error) {
      console.error('Error in master lock toggle:', error);
    } finally {
      setIsLocking(false);
    }
  };
  
  const statuses = visibleWorkers.map(w => getWorkerSendStatus(w));
  const sendBtnClass = statuses.every(s => s === 'synced') 
    ? 'text-gray-900' 
    : statuses.every(s => s === 'none')
    ? 'text-gray-600'
    : 'text-green-500';

  return (
    <div className="flex gap-1">
      {/* Master Lock Button */}
      <button
        onClick={handleMasterLockToggle}
        disabled={isLocking || visibleWorkers.length === 0}
        className="hover:bg-gray-200 rounded p-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={isLocking ? "מעדכן..." : allLocked ? "פתח נעילה לכולם" : "נעל זמינות לכולם"}
      >
        {isLocking ? (
          <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
        ) : allLocked ? (
          <Lock className="w-5 h-5 text-red-600" />
        ) : (
          <LockOpen className="w-5 h-5 text-green-500" />
        )}
      </button>
      
      {/* Master WhatsApp Button */}
      <button
        onClick={() => onSendWhatsApp(visibleWorkers)}
        className={`rounded p-1 transition-colors hover:bg-gray-200 ${sendBtnClass}`}
        title="שלח משמרות בוואטסאפ לכולם"
        disabled={sendingWhatsApp}
      >
        {sendingWhatsApp ? (
          <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <MessageCircle className="w-4 h-4" />
        )}
      </button>
      
      {/* Master Email Button */}
      <button
        onClick={() => onSendEmail(visibleWorkers)}
        className={`rounded p-1 transition-colors hover:bg-gray-200 ${sendBtnClass}`}
        title="שלח משמרות במייל לכולם"
      >
        <Send className="w-4 h-4" />
      </button>

      {/* Master Publish (eye) — gates worker visibility of manager-assigned shifts for the current week */}
      <button
        onClick={onTogglePublish}
        disabled={togglingPublish}
        className={`rounded p-1 transition-colors hover:bg-gray-200 disabled:opacity-50 ${
          isWeekPublished ? "text-green-600 hover:text-green-700" : "text-gray-400 hover:text-gray-500"
        }`}
        title={isWeekPublished
          ? "העובדים רואים את משמרות השבוע — לחץ כדי להסתיר"
          : "המשמרות מוסתרות מהעובדים — לחץ כדי לפרסם"}
      >
        {togglingPublish
          ? <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          : isWeekPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
    </div>
  );
}