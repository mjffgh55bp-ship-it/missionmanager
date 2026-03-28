import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import TrackerTable from "../components/reports/TrackerTable";
import TrackerEditor from "../components/reports/TrackerEditor";

export default function Reports() {
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [templateRows, setTemplateRows] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [trackers, setTrackers] = useState([]);
  const [populations, setPopulations] = useState([]);
  const [workerRoles, setWorkerRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTracker, setEditingTracker] = useState(null);

  // Global filters
  const [dateFilterMode, setDateFilterMode] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [population, setPopulation] = useState("__all__");
  const [role, setRole] = useState("__all__");
  const [guide, setGuide] = useState("__all__");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [
      workersData, assignmentsData, templateRowsData, templatesData, trackersData,
      populationsSettings, workerRolesSettings
    ] = await Promise.all([
      base44.entities.Worker.list(),
      base44.entities.Assignment.list("-date"),
      base44.entities.TemplateRow.list(),
      base44.entities.Template.filter({ active: true }),
      base44.entities.Tracker.list("order"),
      base44.entities.AppSettings.filter({ setting_key: "worker_populations" }),
      base44.entities.AppSettings.filter({ setting_key: "worker_roles" }),
    ]);
    setWorkers(workersData);
    setAssignments(assignmentsData);
    setTemplateRows(templateRowsData);
    setAllTemplates(templatesData);
    setTrackers(trackersData);
    if (populationsSettings.length > 0) setPopulations(JSON.parse(populationsSettings[0].setting_value) || []);
    if (workerRolesSettings.length > 0) setWorkerRoles(JSON.parse(workerRolesSettings[0].setting_value) || []);
    setLoading(false);
  };

  const handleTrackerSaved = (saved) => {
    setTrackers(prev => {
      const exists = prev.find(t => t.id === saved.id);
      return exists ? prev.map(t => t.id === saved.id ? saved : t) : [...prev, saved];
    });
    setEditingTracker(null);
  };

  const handleDeleteTracker = async (trackerId) => {
    if (!window.confirm("האם למחוק את טבלת המעקב?")) return;
    await base44.entities.Tracker.delete(trackerId);
    setTrackers(prev => prev.filter(t => t.id !== trackerId));
  };

  const openNewTracker = () => {
    setEditingTracker(null);
    setEditorOpen(true);
  };

  const openEditTracker = (tracker) => {
    setEditingTracker(tracker);
    setEditorOpen(true);
  };

  const filters = { dateFilterMode, startDate, endDate, population, role, guide };

  const DATE_MODES = [
    { value: "all", label: "כל הזמן" },
    { value: "daily", label: "היום" },
    { value: "week", label: "השבוע" },
    { value: "month", label: "החודש" },
    { value: "half_year", label: "חצי שנה" },
    { value: "custom", label: "מותאם" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">דוחות ומעקב</h1>
            <p className="text-gray-500 text-sm mt-1">יצירה וניהול טבלאות מעקב מותאמות אישית</p>
          </div>
          <Button onClick={openNewTracker} className="bg-blue-900 hover:bg-blue-800">
            <Plus className="w-4 h-4 ml-1" />
            צור מעקב חדש
          </Button>
        </div>

        {/* Global Filters Bar */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-3">סינון גלובלי (חל על כל הטבלאות)</p>
          <div className="flex flex-wrap gap-3 items-end">

            {/* Date filter buttons */}
            <div>
              <Label className="text-xs block mb-1">תקופה</Label>
              <div className="flex flex-wrap gap-1">
                {DATE_MODES.map(m => (
                  <Button
                    key={m.value}
                    variant={dateFilterMode === m.value ? "default" : "outline"}
                    size="sm"
                    className={dateFilterMode === m.value ? "bg-blue-900 text-white" : ""}
                    onClick={() => setDateFilterMode(m.value)}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
            </div>

            {dateFilterMode === "custom" && (
              <div className="flex gap-2">
                <div>
                  <Label className="text-xs block mb-1">מ-</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 w-36" />
                </div>
                <div>
                  <Label className="text-xs block mb-1">עד</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 w-36" />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs block mb-1">אוכלוסייה</Label>
              <Select value={population} onValueChange={setPopulation}>
                <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">כולם</SelectItem>
                  {populations.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs block mb-1">תפקיד</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">כולם</SelectItem>
                  {workerRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs block mb-1">מדריך</Label>
              <Select value={guide} onValueChange={setGuide}>
                <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">כולם</SelectItem>
                  <SelectItem value="yes">מדריכים</SelectItem>
                  <SelectItem value="no">לא מדריכים</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Tracker Tables */}
        {trackers.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border">
            <p className="text-4xl mb-4">📊</p>
            <p className="text-xl font-semibold text-gray-700 mb-2">אין טבלאות מעקב עדיין</p>
            <p className="text-gray-400 mb-6">לחץ על "צור מעקב חדש" כדי להתחיל</p>
            <Button onClick={openNewTracker} className="bg-blue-900 hover:bg-blue-800">
              <Plus className="w-4 h-4 ml-1" />צור מעקב חדש
            </Button>
          </div>
        ) : (
          trackers.map(tracker => (
            <TrackerTable
              key={tracker.id}
              tracker={tracker}
              workers={workers}
              assignments={assignments}
              templateRows={templateRows}
              allTemplates={allTemplates}
              filters={filters}
              onEdit={() => openEditTracker(tracker)}
              onDelete={() => handleDeleteTracker(tracker.id)}
            />
          ))
        )}
      </div>

      <TrackerEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        tracker={editingTracker}
        onSaved={handleTrackerSaved}
        allTemplates={allTemplates}
      />
    </div>
  );
}