import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

// Parse "+N HH:MM" or "HH:MM" times to compute hours
const calcHours = (start, end) => {
  if (!start || !end) return 0;
  const endMatch = end.match(/^\+(\d+)\s+(\d{2}):(\d{2})$/);
  const [sh, sm] = start.split(":").map(Number);
  if (endMatch) {
    const days = parseInt(endMatch[1]);
    const eh = parseInt(endMatch[2]);
    const em = parseInt(endMatch[3]);
    return Math.round((days * 24 + eh + em / 60 - sh - sm / 60) * 10) / 10;
  }
  const [eh, em] = end.split(":").map(Number);
  let diff = eh + em / 60 - sh - sm / 60;
  if (diff < 0) diff += 24;
  return Math.round(diff * 10) / 10;
};

const getDateRange = (dateFilterMode, startDate, endDate) => {
  const today = new Date();
  if (dateFilterMode === "daily") {
    const d = format(today, "yyyy-MM-dd");
    return { start: d, end: d };
  } else if (dateFilterMode === "week") {
    return {
      start: format(startOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd"),
      end: format(endOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd"),
    };
  } else if (dateFilterMode === "month") {
    return { start: format(startOfMonth(today), "yyyy-MM-dd"), end: format(endOfMonth(today), "yyyy-MM-dd") };
  } else if (dateFilterMode === "half_year") {
    const sixAgo = new Date(today);
    sixAgo.setMonth(sixAgo.getMonth() - 6);
    return { start: format(sixAgo, "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
  } else if (dateFilterMode === "custom" && startDate && endDate) {
    return { start: startDate, end: endDate };
  }
  return null;
};

export default function TrackerTable({ tracker, workers, assignments, templateRows, allTemplates, filters, onEdit, onDelete }) {
  const [entries, setEntries] = useState([]);
  const [editingCell, setEditingCell] = useState(null); // { workerId, colId }
  const [cellDraft, setCellDraft] = useState("");

  useEffect(() => {
    loadEntries();
  }, [tracker.id]);

  const loadEntries = async () => {
    const data = await base44.entities.TrackerEntry.filter({ tracker_id: tracker.id });
    setEntries(data);
  };

  const getEntry = (workerId, colId) =>
    entries.find(e => e.worker_id === workerId && e.column_id === colId);

  const startEdit = (workerId, colId) => {
    const entry = getEntry(workerId, colId);
    setCellDraft(entry?.value || "");
    setEditingCell({ workerId, colId });
  };

  const saveCell = async () => {
    if (!editingCell) return;
    const { workerId, colId } = editingCell;
    const existing = getEntry(workerId, colId);
    let updated;
    if (existing) {
      updated = await base44.entities.TrackerEntry.update(existing.id, { value: cellDraft });
      setEntries(entries.map(e => e.id === existing.id ? updated : e));
    } else {
      updated = await base44.entities.TrackerEntry.create({
        tracker_id: tracker.id,
        worker_id: workerId,
        column_id: colId,
        value: cellDraft,
      });
      setEntries([...entries, updated]);
    }
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  const computeAutoValue = (col, workerId) => {
    const dateRange = getDateRange(filters.dateFilterMode, filters.startDate, filters.endDate);

    const filteredAssignments = assignments.filter(a => {
      if (!(a.chef_id === workerId || a.sous_chef_id === workerId || a.additional_chef_id === workerId)) return false;
      if (dateRange && (a.date < dateRange.start || a.date > dateRange.end)) return false;
      return true;
    });

    if (col.type === "hours_assignments") {
      return filteredAssignments.reduce((sum, a) => sum + (a.hours || 0), 0);
    }
    if (col.type === "shifts_count") {
      return filteredAssignments.length;
    }
    if (col.type === "hours_templates") {
      let total = 0;
      templateRows.forEach(row => {
        if (dateRange && (row.date < dateRange.start || row.date > dateRange.end)) return;
        const template = allTemplates.find(t => t.id === row.template_id);
        if (!template) return;
        const startTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"] || "";
        const endTime = row.values?.["סיום"] || row.values?.["שעת סיום"] || "";
        const hours = calcHours(startTime, endTime);
        (template.columns || []).forEach(tc => {
          if (tc.type !== "worker") return;
          if (col.template_column && col.template_column !== "__all__" && tc.name !== col.template_column) return;
          if (row.values?.[tc.name] === workerId) total += hours;
        });
      });
      return Math.round(total * 10) / 10;
    }
    return null;
  };

  const filteredWorkers = workers.filter(w => {
    if (!w.active) return false;
    if (filters.population !== "__all__" && w.population !== filters.population) return false;
    if (filters.role !== "__all__" && w.role !== filters.role) return false;
    if (filters.guide === "yes" && !w.is_guide) return false;
    if (filters.guide === "no" && w.is_guide) return false;
    return true;
  });

  const isAuto = (type) => ["hours_assignments", "hours_templates", "shifts_count"].includes(type);

  return (
    <Card className="border-none shadow-lg mb-6">
      <CardHeader className="border-b py-3 px-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base flex items-center gap-2" dir="rtl">{tracker.name}</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 px-2 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead dir="rtl" className="font-bold">עובד</TableHead>
              {(tracker.columns || []).map(col => (
                <TableHead key={col.id} dir="rtl">
                  <div className="flex flex-col gap-0.5">
                    <span>{col.name}</span>
                    <span className="text-[10px] text-gray-400 font-normal">
                      {col.type === "hours_assignments" ? "שעות (משימות)" :
                       col.type === "hours_templates" ? `שעות (${col.template_column && col.template_column !== "__all__" ? col.template_column : "תבניות"})` :
                       col.type === "shifts_count" ? "משמרות" :
                       col.type === "number" ? "מספר" :
                       col.type === "text" ? "טקסט" : "סימון"}
                    </span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredWorkers.map(worker => (
              <TableRow key={worker.id} className="hover:bg-gray-50">
                <TableCell className="font-medium whitespace-nowrap">{worker.nickname}</TableCell>
                {(tracker.columns || []).map(col => {
                  const auto = isAuto(col.type);
                  const value = auto ? computeAutoValue(col, worker.id) : (getEntry(worker.id, col.id)?.value || "");
                  const isEditing = editingCell?.workerId === worker.id && editingCell?.colId === col.id;

                  if (auto) {
                    return (
                      <TableCell key={col.id} className="text-center font-semibold text-blue-900">
                        {value > 0 ? (col.type === "shifts_count" ? value : `${value}h`) : <span className="text-gray-300">-</span>}
                      </TableCell>
                    );
                  }

                  if (col.type === "checkbox") {
                    return (
                      <TableCell key={col.id} className="text-center">
                        <button
                          onClick={async () => {
                            const entry = getEntry(worker.id, col.id);
                            const newVal = value === "true" ? "" : "true";
                            if (entry) {
                              const updated = await base44.entities.TrackerEntry.update(entry.id, { value: newVal });
                              setEntries(entries.map(e => e.id === entry.id ? updated : e));
                            } else {
                              const created = await base44.entities.TrackerEntry.create({ tracker_id: tracker.id, worker_id: worker.id, column_id: col.id, value: newVal });
                              setEntries([...entries, created]);
                            }
                          }}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${value === "true" ? "bg-green-500 border-green-600 text-white" : "border-gray-300 hover:border-blue-400"}`}
                        >
                          {value === "true" && <Check className="w-3 h-3" />}
                        </button>
                      </TableCell>
                    );
                  }

                  return (
                    <TableCell key={col.id}>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            autoFocus
                            value={cellDraft}
                            onChange={e => setCellDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveCell(); if (e.key === "Escape") cancelEdit(); }}
                            className="h-7 text-sm w-24"
                            type={col.type === "number" ? "number" : "text"}
                            dir="rtl"
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={saveCell}><Check className="w-3 h-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-400" onClick={cancelEdit}><X className="w-3 h-3" /></Button>
                        </div>
                      ) : (
                        <div
                          className="min-w-[60px] min-h-[24px] px-1 rounded cursor-pointer hover:bg-blue-50 text-sm"
                          onClick={() => startEdit(worker.id, col.id)}
                          dir="rtl"
                        >
                          {value || <span className="text-gray-300 text-xs">לחץ לעריכה</span>}
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}