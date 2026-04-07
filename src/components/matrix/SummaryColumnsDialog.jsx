import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export default function SummaryColumnsDialog({ open, onOpenChange, summaryColumns, saveSummaryColumns, shiftStatuses, scheduleParams, trackers }) {
  const [editingColumn, setEditingColumn] = useState(null);
  const [form, setForm] = useState({ name: '', criteria_type: 'total_shifts', criteria_value: '' });

  const resetForm = () => {
    setEditingColumn(null);
    setForm({ name: '', criteria_type: 'total_shifts', criteria_value: '' });
  };

  const handleSave = () => {
    if (!form.name) return;
    let updated;
    if (editingColumn) {
      updated = summaryColumns.map(c => c.id === editingColumn.id ? { ...c, ...form } : c);
    } else {
      updated = [...summaryColumns, { id: Date.now().toString(), ...form }];
    }
    saveSummaryColumns(updated);
    resetForm();
  };

  const getSelectedColName = () => (form.criteria_value || '').split('|||')[0];
  const getSelectedCriterionVal = () => (form.criteria_value || '').split('|||')[1] || '';

  const selectedScheduleCol = scheduleParams.find(c => c.name === getSelectedColName());
  const scheduleColOptions = selectedScheduleCol
    ? [...new Set([...(selectedScheduleCol.options || []), ...(selectedScheduleCol.sub_options || []).map(so => so.criterion)].filter(Boolean))]
    : [];

  const selectedTracker = trackers.find(t => t.id === getSelectedColName());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader><DialogTitle dir="rtl">ניהול עמודות סיכום שבועי</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2" dir="rtl">
          {summaryColumns.length === 0 && <p className="text-sm text-gray-500 text-center">אין עמודות. הוסף עמודה חדשה למטה.</p>}
          {summaryColumns.map(col => (
            <div key={col.id} className="flex items-center gap-2 bg-gray-50 rounded p-2">
              <div className="flex-1">
                <div className="font-medium text-sm">{col.name}</div>
                <div className="text-xs text-gray-500">
                  {col.criteria_type === 'total_shifts' && 'סה"כ משמרות'}
                  {col.criteria_type === 'status' && `סטטוס: ${col.criteria_value}`}
                  {col.criteria_type === 'food_cart' && `עגלה: ${col.criteria_value}`}
                  {col.criteria_type === 'time_range' && `טווח שעות: ${col.criteria_value}`}
                  {col.criteria_type === 'schedule_col' && `עמודת לוח: ${col.criteria_value.split('|||').filter(Boolean).join(' → ')}`}
                  {col.criteria_type === 'tracker_col' && `עמודת מעקב: ${col.criteria_value.split('|||')[1] || ''}`}
                </div>
              </div>
              <button onClick={() => { setEditingColumn(col); setForm({ name: col.name, criteria_type: col.criteria_type, criteria_value: col.criteria_value || '' }); }} className="text-blue-500 hover:text-blue-700 text-xs">ערוך</button>
              <button onClick={() => saveSummaryColumns(summaryColumns.filter(c => c.id !== col.id))} className="text-red-500 hover:text-red-700 text-xs">מחק</button>
            </div>
          ))}

          <div className="border-t pt-3 space-y-2">
            <div className="font-semibold text-sm mb-2">{editingColumn ? 'עריכת עמודה' : 'הוספת עמודה חדשה'}</div>

            <div>
              <Label className="text-xs" dir="rtl">שם העמודה</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="שם" dir="rtl" className="h-8 text-sm" />
            </div>

            <div>
              <Label className="text-xs" dir="rtl">סוג קריטריון</Label>
              <Select value={form.criteria_type} onValueChange={v => setForm(p => ({ ...p, criteria_type: v, criteria_value: '' }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="total_shifts">סה"כ משמרות</SelectItem>
                  <SelectItem value="status">לפי סטטוס</SelectItem>
                  <SelectItem value="food_cart">לפי עגלה/תבנית</SelectItem>
                  <SelectItem value="time_range">לפי טווח שעות (HH:MM-HH:MM)</SelectItem>
                  {scheduleParams.length > 0 && <SelectItem value="schedule_col">לפי עמודת לוח</SelectItem>}
                  {trackers.length > 0 && <SelectItem value="tracker_col">לפי עמודת מעקב</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {form.criteria_type === 'status' && (
              <div>
                <Label className="text-xs" dir="rtl">ערך סטטוס</Label>
                <Select value={form.criteria_value} onValueChange={v => setForm(p => ({ ...p, criteria_value: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="בחר סטטוס" /></SelectTrigger>
                  <SelectContent>
                    {shiftStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(form.criteria_type === 'food_cart' || form.criteria_type === 'time_range') && (
              <div>
                <Label className="text-xs" dir="rtl">
                  {form.criteria_type === 'food_cart' ? 'שם עגלה/תבנית' : 'טווח שעות (לדוגמה: 06:00-18:00)'}
                </Label>
                <Input value={form.criteria_value} onChange={e => setForm(p => ({ ...p, criteria_value: e.target.value }))} dir="rtl" className="h-8 text-sm" />
              </div>
            )}

            {form.criteria_type === 'schedule_col' && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs" dir="rtl">עמודת לוח</Label>
                  <Select value={getSelectedColName()} onValueChange={v => setForm(p => ({ ...p, criteria_value: v + '|||' }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="בחר עמודה" /></SelectTrigger>
                    <SelectContent>
                      {scheduleParams.map(col => <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {scheduleColOptions.length > 0 && (
                  <div>
                    <Label className="text-xs" dir="rtl">ערך לסינון (אופציונלי)</Label>
                    <Select value={getSelectedCriterionVal()} onValueChange={v => setForm(p => ({ ...p, criteria_value: getSelectedColName() + '|||' + v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="כל הערכים (סופר קיום)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>כל הערכים (סופר קיום)</SelectItem>
                        {scheduleColOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {form.criteria_type === 'tracker_col' && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs" dir="rtl">טבלת מעקב</Label>
                  <Select value={getSelectedColName()} onValueChange={v => setForm(p => ({ ...p, criteria_value: v + '|||' }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="בחר מעקב" /></SelectTrigger>
                    <SelectContent>
                      {trackers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {selectedTracker?.columns?.length > 0 && (
                  <div>
                    <Label className="text-xs" dir="rtl">עמודה במעקב</Label>
                    <Select value={getSelectedCriterionVal()} onValueChange={v => setForm(p => ({ ...p, criteria_value: getSelectedColName() + '|||' + v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="בחר עמודה" /></SelectTrigger>
                      <SelectContent>
                        {selectedTracker.columns.map(col => <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              {editingColumn && (
                <Button variant="outline" size="sm" onClick={resetForm}>ביטול עריכה</Button>
              )}
              <Button size="sm" className="bg-blue-900 hover:bg-blue-800" onClick={handleSave} dir="rtl">
                {editingColumn ? 'עדכן' : 'הוסף'}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} dir="rtl">סגור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}