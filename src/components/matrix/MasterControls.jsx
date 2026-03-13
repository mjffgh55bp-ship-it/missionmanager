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
  const getVisibleWorkers = () => {
    return workers.filter(w => {
      if (populationFilter !== "__all__" && w.population !== populationFilter) return false;
      if (roleFilter !== "__all__" && w.role !== roleFilter) return false;
      return true;
    });
  };

  const handleMasterLockToggle = async () => {
    const visibleWorkers = getVisibleWorkers();
    const allLocked = visibleWorkers.every(w => w.availability_locked);
    
    await Promise.all(
      visibleWorkers.map(worker =>
        base44.entities.Worker.update(worker.id, {
          nickname: worker.nickname,
          role: worker.role,
          availability_locked: !allLocked
        })
      )
    );
    onUpdate();
  };

  const visibleWorkers = getVisibleWorkers();
  const allLocked = visibleWorkers.every(w => w.availability_locked);
  
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
        className="hover:bg-gray-200 rounded p-1 transition-colors"
        title={allLocked ? "פתח נעילה לכולם" : "נעל זמינות לכולם"}
      >
        {allLocked ? (
          <Lock className="w-5 h-5 text-gray-900" />
        ) : (
          <LockOpen className="w-5 h-5 text-blue-500" />
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