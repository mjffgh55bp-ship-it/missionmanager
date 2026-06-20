import React, { useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

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
      <DialogContent className="sm:max-w-md max-h-[88vh] overflow-y-auto p-0" dir="rtl">
        {/* Header */}
        <div className="bg-gray-100 px-4 py-3 border-b">
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="שם העמודה"
            className="w-full bg-transparent text-gray-800 placeholder-gray-400 text-center font-semibold text-base outline-none border-none"
            dir="rtl" />
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Criteria type selector */}
          <div>
            <Label className="text-xs text-gray-700 mb-1 block" dir="rtl">סוג קריטריון</Label>
            <Select value={form.criteria_type} onValueChange={v => setForm(p => ({ ...p, criteria_type: v, criteria_value: '' }))}>
              <SelectTrigger className="h-9 text-sm border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total_shifts">סה"כ משמרות</SelectItem>
                <SelectItem value="status">לפי סטטוס</SelectItem>
                <SelectItem value="food_cart">לפי עגלה/תבנית</SelectItem>
                <SelectItem value="time_range">לפי טווח שעות</SelectItem>
                {scheduleParams.length > 0 && <SelectItem value="schedule_col">לפי עמודת לוח</SelectItem>}
                {trackers.length > 0 && <SelectItem value="tracker_col">לפי עמודת מעקב</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Criteria value based on type */}
          {form.criteria_type === 'status' && (
            <div>
              <Label className="text-xs text-gray-700 mb-1 block" dir="rtl">ערך סטטוס</Label>
              <Select value={form.criteria_value} onValueChange={v => setForm(p => ({ ...p, criteria_value: v }))}>
                <SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue placeholder="בחר סטטוס" /></SelectTrigger>
                <SelectContent>
                  {shiftStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {(form.criteria_type === 'food_cart' || form.criteria_type === 'time_range') && (
            <div>
              <Label className="text-xs text-gray-700 mb-1 block" dir="rtl">
                {form.criteria_type === 'food_cart' ? 'שם עגלה/תבנית' : 'טווח שעות (לדוגמה: 06:00-18:00)'}
              </Label>
              <Input value={form.criteria_value} onChange={e => setForm(p => ({ ...p, criteria_value: e.target.value }))}
                dir="rtl" className="h-9 text-sm" />
            </div>
          )}

          {form.criteria_type === 'schedule_col' && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-gray-700 mb-1 block" dir="rtl">עמודת לוח</Label>
                <Select value={getSelectedColName()} onValueChange={v => setForm(p => ({ ...p, criteria_value: v + '|||' }))}>
                  <SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue placeholder="בחר עמודה" /></SelectTrigger>
                  <SelectContent>
                    {scheduleParams.map(col => <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {scheduleColOptions.length > 0 && (
                <div>
                  <Label className="text-xs text-gray-700 mb-1 block" dir="rtl">ערך לסינון (אופציונלי)</Label>
                  <Select value={getSelectedCriterionVal()} onValueChange={v => setForm(p => ({ ...p, criteria_value: getSelectedColName() + '|||' + v }))}>
                    <SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue placeholder="כל הערכים (סופר קיום)" /></SelectTrigger>
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
                <Label className="text-xs text-gray-700 mb-1 block" dir="rtl">טבלת מעקב</Label>
                <Select value={getSelectedColName()} onValueChange={v => setForm(p => ({ ...p, criteria_value: v + '|||' }))}>
                  <SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue placeholder="בחר מעקב" /></SelectTrigger>
                  <SelectContent>
                    {trackers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selectedTracker?.columns?.length > 0 && (
                <div>
                  <Label className="text-xs text-gray-700 mb-1 block" dir="rtl">עמודה במעקב</Label>
                  <Select value={getSelectedCriterionVal()} onValueChange={v => setForm(p => ({ ...p, criteria_value: getSelectedColName() + '|||' + v }))}>
                    <SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue placeholder="בחר עמודה" /></SelectTrigger>
                    <SelectContent>
                      {selectedTracker.columns.map(col => <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Existing columns list */}
        {summaryColumns.length > 0 && (
          <div className="px-4 pb-2">
            <div className="border-t pt-3 space-y-1">
              {summaryColumns.map(col => (
                <div key={col.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                  <div className="flex-1 text-right">
                    <span className="font-medium text-sm text-gray-800">{col.name}</span>
                    <span className="text-xs text-gray-500 mr-2">
                      {col.criteria_type === 'total_shifts' && '• סה"כ משמרות'}
                      {col.criteria_type === 'status' && `• סטטוס: ${col.criteria_value}`}
                      {col.criteria_type === 'food_cart' && `• עגלה: ${col.criteria_value}`}
                      {col.criteria_type === 'time_range' && `• טווח: ${col.criteria_value}`}
                      {col.criteria_type === 'schedule_col' && `• ${col.criteria_value.split('|||').filter(Boolean).join(' → ')}`}
                      {col.criteria_type === 'tracker_col' && `• ${col.criteria_value.split('|||')[1] || ''}`}
                    </span>
                  </div>
                  <button onClick={() => { setEditingColumn(col); setForm({ name: col.name, criteria_type: col.criteria_type, criteria_value: col.criteria_value || '' }); }}
                    className="text-gray-400 hover:text-gray-700 text-xs border border-gray-200 rounded px-2 py-0.5">ערוך</button>
                  <button onClick={() => saveSummaryColumns(summaryColumns.filter(c => c.id !== col.id))}
                    className="text-gray-400 hover:text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="px-4 pb-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} dir="rtl" className="flex-1">ביטול</Button>
          <Button onClick={handleSave}
            className="bg-green-600 hover:bg-green-700 flex-1" dir="rtl">
            {editingColumn ? 'עדכן' : 'הוסף'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}