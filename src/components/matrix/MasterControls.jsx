import React from "react";
import { Lock, LockOpen, MessageCircle, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function MasterControls({ 
  workers, 
  populationFilter, 
  roleFilter, 
  getWorkerSendStatus, 
  onSendWhatsApp,
  onSendEmail,
  sendingWhatsApp,
  onUpdate
}) {
  const [isLocking, setIsLocking] = React.useState(false);
  
  const getVisibleWorkers = () => {
    return workers.filter(w => {
      if (populationFilter !== "__all__" && w.population !== populationFilter) return false;
      if (roleFilter !== "__all__" && w.role !== roleFilter) return false;
      return true;
    });
  };

  const visibleWorkers = getVisibleWorkers();
  const allLocked = visibleWorkers.length > 0 && visibleWorkers.every(w => w.availability_locked);

  const handleMasterLockToggle = async () => {
    if (isLocking || visibleWorkers.length === 0) return;
    setIsLocking(true);
    
    const targetLockState = !allLocked;
    
    // Update in batches of 5 for better responsiveness
    const batchSize = 5;
    for (let i = 0; i < visibleWorkers.length; i += batchSize) {
      const batch = visibleWorkers.slice(i, i + batchSize);
      await Promise.all(
        batch.map(worker =>
          base44.entities.Worker.update(worker.id, {
            nickname: worker.nickname,
            role: worker.role,
            availability_locked: targetLockState
          })
        )
      );
    }
    
    await onUpdate();
    setIsLocking(false);
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
    </div>
  );
}