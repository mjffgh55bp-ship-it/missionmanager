import React from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Send, Star, Check, Ban, Plus, Save, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NotificationDialog({
  open, onOpenChange, viewMode, currentDate,
  selectedWorkerForNotification,
  notificationNotes, setNotificationNotes,
  getWorkerTemplateShifts, getWorkerExtraTaskShifts,
  sendNotification
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle dir="rtl">שלח לוח זמנים {viewMode === "weekly" ? "שבועי" : "יומי"} - {selectedWorkerForNotification?.nickname}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-h-60 overflow-y-auto" dir="rtl">
            <p className="text-sm font-semibold mb-2">
              {viewMode === "weekly"
                ? `משמרות לשבוע של ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "d.M.yyyy")}:`
                : `משמרות ל-${format(currentDate, "d.M.yyyy")}:`}
            </p>
            {viewMode === "weekly" && selectedWorkerForNotification ? (
              Array.from({ length: 7 }).map((_, i) => {
                const d = addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), i);
                const dStr = format(d, "yyyy-MM-dd");
                const dayTemplateShifts = getWorkerTemplateShifts(selectedWorkerForNotification.id, dStr);
                const dayExtraTaskShifts = getWorkerExtraTaskShifts(selectedWorkerForNotification.id, dStr);
                const allDayShifts = [...dayTemplateShifts, ...dayExtraTaskShifts];
                const hebrewDays = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
                return (
                  <div key={i} className="mb-2" dir="rtl">
                    <p className="text-xs font-semibold">{hebrewDays[d.getDay()]}, {format(d, "d.M")}</p>
                    {allDayShifts.length === 0 ? (
                      <p className="text-xs text-gray-500 mr-2">אין משמרות</p>
                    ) : allDayShifts.map((a, idx) => {
                      const briefingTime = a.briefing_time || (() => {
                        const [hours, minutes] = a.start_time.split(':').map(Number);
                        const bm = hours * 60 + minutes - 15;
                        return `${String(Math.floor(bm / 60)).padStart(2, '0')}:${String(bm % 60).padStart(2, '0')}`;
                      })();
                      return (
                        <div key={idx} className="text-xs bg-white p-1 rounded border ml-2 mt-1" dir="rtl">
                          <div className="font-semibold">{a.food_cart_name}</div>
                          <div className="text-amber-600">תדריך: {briefingTime}</div>
                          <div className="text-gray-600">משמרת: {a.start_time} - {a.end_time}</div>
                          {a.status && <div className="text-blue-600 font-medium">סטטוס: {a.status}</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            ) : selectedWorkerForNotification ? (() => {
              const allShifts = [
                ...getWorkerTemplateShifts(selectedWorkerForNotification.id),
                ...getWorkerExtraTaskShifts(selectedWorkerForNotification.id)
              ];
              return allShifts.length > 0 ? allShifts.map((a, idx) => {
                const briefingTime = a.briefing_time || (() => {
                  const [hours, minutes] = a.start_time.split(':').map(Number);
                  const bm = hours * 60 + minutes - 15;
                  return `${String(Math.floor(bm / 60)).padStart(2, '0')}:${String(bm % 60).padStart(2, '0')}`;
                })();
                return (
                  <div key={idx} className="text-xs bg-white p-2 rounded border mb-1" dir="rtl">
                    <p className="font-semibold">{a.food_cart_name}</p>
                    <p className="text-amber-600">תדריך: {briefingTime}</p>
                    <p className="text-gray-600">משמרת: {a.start_time} - {a.end_time} {a.hours ? `(${a.hours}h)` : ''}</p>
                    {a.status && <p className="text-blue-600 font-medium">סטטוס: {a.status}</p>}
                  </div>
                );
              }) : <p className="text-sm text-gray-600" dir="rtl">אין משמרות מתוכננות</p>;
            })() : (
              <p className="text-sm text-gray-600">אין משמרות מתוכננות</p>
            )}
          </div>
          <div>
            <Label dir="rtl">הערות נוספות</Label>
            <Textarea value={notificationNotes} onChange={(e) => setNotificationNotes(e.target.value)} rows={4} dir="rtl" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} dir="rtl">ביטול</Button>
          <Button onClick={sendNotification} className="bg-blue-900 hover:bg-blue-800" disabled={!selectedWorkerForNotification?.email} dir="rtl">
            <Send className="w-4 h-4 mr-2" />שלח
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TypeChangeDialog({ open, onOpenChange, handleChangeType }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader><DialogTitle dir="rtl">שינוי סוג זמינות</DialogTitle></DialogHeader>
        <div className="py-4 space-y-2" dir="rtl">
          <Button variant="outline" className="w-full justify-start" onClick={() => handleChangeType('wanted')}>
            <Star className="w-4 h-4 ml-2 text-green-600 fill-green-600" />רצוי
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => handleChangeType('available')}>
            <Check className="w-4 h-4 ml-2 text-blue-600" />זמין
          </Button>

        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ManualShiftDialog({
  open, onOpenChange,
  editingShift, selectedWorkerForManual,
  manualShiftData, setManualShiftData,
  submitManualShift, deleteShift
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right" dir="rtl">
            {editingShift ? 'עריכת' : 'הוספת'} חלון זמינות - {selectedWorkerForManual?.nickname}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4" dir="rtl">
            <div>
              <Label className="text-center block mb-2" dir="rtl">שעת סיום (HH:MM)</Label>
              <Input type="time" value={manualShiftData.end_time} onChange={(e) => setManualShiftData({ ...manualShiftData, end_time: e.target.value })} />
            </div>
            <div>
              <Label className="text-center block mb-2" dir="rtl">שעת התחלה (HH:MM)</Label>
              <Input type="time" value={manualShiftData.start_time} onChange={(e) => setManualShiftData({ ...manualShiftData, start_time: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="text-center block mb-2" dir="rtl">סוג זמינות</Label>
            <div className="flex gap-2 justify-center">
              <Button variant={manualShiftData.type === "wanted" ? "default" : "outline"} className={manualShiftData.type === "wanted" ? "bg-green-500 hover:bg-green-600" : ""} onClick={() => setManualShiftData({ ...manualShiftData, type: "wanted" })} dir="rtl">
                <Star className="w-4 h-4 ml-1" />רצוי
              </Button>
              <Button variant={manualShiftData.type === "available" ? "default" : "outline"} className={manualShiftData.type === "available" ? "bg-blue-500 hover:bg-blue-600" : ""} onClick={() => setManualShiftData({ ...manualShiftData, type: "available" })} dir="rtl">
                <Check className="w-4 h-4 ml-1" />זמין
              </Button>
              <Button variant={manualShiftData.type === "constraint" ? "default" : "outline"} className={manualShiftData.type === "constraint" ? "bg-gray-500 hover:bg-gray-600 text-white" : ""} onClick={() => setManualShiftData({ ...manualShiftData, type: "constraint" })} dir="rtl">
                <Ban className="w-4 h-4 ml-1" />אילוץ
              </Button>
            </div>
          </div>
          {manualShiftData.type === "constraint" && (
            <div>
              <Label className="text-center block mb-2" dir="rtl">סיבת האילוץ</Label>
              <div className="flex gap-2 justify-center" dir="rtl">
                <Button variant={manualShiftData.reason === "occupied" ? "default" : "outline"} onClick={() => setManualShiftData({ ...manualShiftData, reason: "occupied" })} dir="rtl">עיסוק</Button>
                <Button variant={manualShiftData.reason === "overseas" ? "default" : "outline"} onClick={() => setManualShiftData({ ...manualShiftData, reason: "overseas" })} dir="rtl">חו״ל</Button>
                <Button variant={manualShiftData.reason === "other" ? "default" : "outline"} onClick={() => setManualShiftData({ ...manualShiftData, reason: "other" })} dir="rtl">אחר</Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex justify-between" dir="rtl">
          <div>
            {editingShift && (
              <Button variant="destructive" onClick={deleteShift} dir="rtl">מחק</Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} dir="rtl">ביטול</Button>
            <Button onClick={submitManualShift} className="bg-blue-900 hover:bg-blue-800" disabled={!manualShiftData.start_time || !manualShiftData.end_time} dir="rtl">
              {editingShift ? 'עדכן' : <><Plus className="w-4 h-4 mr-2" />הוסף</>}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UnavailabilityDialog({
  open, onOpenChange,
  editingUnavail, setEditingUnavail,
  onSave,
}) {
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const isCreate = !editingUnavail?.id;

  const handleSave = async () => {
    if (saving || deleting) return;
    if (!editingUnavail?.start_time || !editingUnavail?.end_time || !editingUnavail?.date) return;
    setSaving(true);
    try {
      await onSave(editingUnavail);
      onOpenChange(false);
    } catch {
      alert("שגיאה בעדכון האילוץ. נסה שוב.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (saving || deleting || isCreate) return;
    setDeleting(true);
    try {
      await onSave(editingUnavail, true);
      onOpenChange(false);
    } catch {
      alert("שגיאה במחיקת האילוץ. נסה שוב.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {isCreate ? 'הוספת אילוץ' : 'עריכת אילוץ'} — {editingUnavail?.worker_name || ''}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="block mb-1 text-xs text-gray-600">תאריך</Label>
            <Input
              type="date"
              value={editingUnavail?.date || ''}
              onChange={e => setEditingUnavail(prev => ({ ...prev, date: e.target.value }))}
              className="text-sm h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="block mb-1 text-xs text-gray-600">שעת התחלה</Label>
              <Input
                type="time"
                value={editingUnavail?.start_time || ''}
                onChange={e => setEditingUnavail(prev => ({ ...prev, start_time: e.target.value }))}
                className="text-sm h-9"
              />
            </div>
            <div>
              <Label className="block mb-1 text-xs text-gray-600">שעת סיום</Label>
              <Input
                type="time"
                value={editingUnavail?.end_time || ''}
                onChange={e => setEditingUnavail(prev => ({ ...prev, end_time: e.target.value }))}
                className="text-sm h-9"
              />
            </div>
          </div>
          <div>
            <Label className="block mb-1 text-xs text-gray-600">סיבה</Label>
            <Select
              value={editingUnavail?.reason || 'occupied'}
              onValueChange={v => setEditingUnavail(prev => ({ ...prev, reason: v }))}
            >
              <SelectTrigger dir="rtl" className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="occupied">תפוס</SelectItem>
                <SelectItem value="overseas">בחו"ל</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex justify-between" dir="rtl">
          <div>
            {!isCreate && (
              <Button variant="destructive" onClick={handleDelete} disabled={saving || deleting} dir="rtl">
                <Trash2 className="w-4 h-4 ml-1" />
                {deleting ? 'מוחק...' : 'מחק'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting} dir="rtl">ביטול</Button>
            <Button
              onClick={handleSave}
              className="bg-blue-900 hover:bg-blue-800"
              disabled={!editingUnavail?.start_time || !editingUnavail?.end_time || !editingUnavail?.date || saving || deleting}
              dir="rtl"
            >
              <Save className="w-4 h-4 ml-1" />
              {saving ? 'שומר...' : isCreate ? 'צור' : 'שמור'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}