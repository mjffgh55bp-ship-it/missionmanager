import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getCachedAllSettings, getCachedAllWorkers, parseSetting } from "@/lib/appDataCache";
import { getTaskQuals } from "@/lib/taskQuals";
import { Button } from "@/components/ui/button";
import { Plus, BarChart2, Table2 } from "lucide-react";
import TrackerEditor from "../components/reports/TrackerEditor";
import ChartBuilder from "../components/reports/ChartBuilder";
import ChartDisplay from "../components/reports/ChartDisplay";
import ChartCanvas from "../components/reports/ChartCanvas";
import TrackerLayoutArea from "../components/reports/TrackerLayoutArea";

export default function Reports() {
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [templateRows, setTemplateRows] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [trackers, setTrackers] = useState([]);
  const [populations, setPopulations] = useState([]);
  const [workerRoles, setWorkerRoles] = useState([]);
  const [roleObjects, setRoleObjects] = useState([]);       // [{name, mapping_id}]
  const [populationObjects, setPopulationObjects] = useState([]); // [{name, mapping_id}]
  const [scheduleColumns, setScheduleColumns] = useState([]);
  const [scheduleColumnsById, setScheduleColumnsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tables");
  // Charts
  const [charts, setCharts] = useState([]);
  const [trackerEntries, setTrackerEntries] = useState([]);
  const [chartBuilderOpen, setChartBuilderOpen] = useState(false);
  const [editingChart, setEditingChart] = useState(null);
  const [selectedTrackerForCharts, setSelectedTrackerForCharts] = useState(null);
  const [taskQualifications, setTaskQualifications] = useState({});
  const [qualifications, setQualifications] = useState([]);
  const [workerQualifications, setWorkerQualifications] = useState([]);
  const [trackerEditorOpen, setTrackerEditorOpen] = useState(false);
  const [editingTracker, setEditingTracker] = useState(null);


  useEffect(() => {
    loadData();

    // Real-time updates for assignments, template rows, and tracker entries
    const unsubAssignments = base44.entities.Assignment.subscribe((event) => {
      if (event.type === "create") {
        setAssignments(prev => [event.data, ...prev]);
      } else if (event.type === "update") {
        setAssignments(prev => prev.map(a => a.id === event.id ? event.data : a));
      } else if (event.type === "delete") {
        setAssignments(prev => prev.filter(a => a.id !== event.id));
      }
    });

    const unsubTemplateRows = base44.entities.TemplateRow.subscribe((event) => {
      if (event.type === "create") {
        setTemplateRows(prev => [...prev, event.data]);
      } else if (event.type === "update") {
        setTemplateRows(prev => prev.map(r => r.id === event.id ? event.data : r));
      } else if (event.type === "delete") {
        setTemplateRows(prev => prev.filter(r => r.id !== event.id));
      }
    });

    const unsubTrackerEntries = base44.entities.TrackerEntry.subscribe((event) => {
      if (event.type === "create") {
        setTrackerEntries(prev => [...prev, event.data]);
      } else if (event.type === "update") {
        setTrackerEntries(prev => prev.map(e => e.id === event.id ? event.data : e));
      } else if (event.type === "delete") {
        setTrackerEntries(prev => prev.filter(e => e.id !== event.id));
      }
    });

    return () => {
      unsubAssignments();
      unsubTemplateRows();
      unsubTrackerEntries();
    };
  }, []);

  const loadData = async () => {
    try {
    // Workers + all settings come from the shared cache (dedup + 3-min TTL)
    const [workersData, allSettings] = await Promise.all([
      getCachedAllWorkers(base44.entities),
      getCachedAllSettings(base44.entities),
    ]);

    // Page-specific data (not cached): two sequential pairs to avoid a burst
    const [assignmentsData, templateRowsData] = await Promise.all([
      base44.entities.Assignment.list("-date"),
      base44.entities.TemplateRow.list(),
    ]);
    const [templatesData, trackersData] = await Promise.all([
      base44.entities.Template.filter({ active: true }),
      base44.entities.Tracker.list("order"),
    ]);
    const [chartsData, qualificationsData] = await Promise.all([
      base44.entities.ChartWidget.list("order"),
      base44.entities.Qualification.filter({ active: true }),
    ]);
    const [entriesData, workerQualsData, scheduleColEntities] = await Promise.all([
      base44.entities.TrackerEntry.list(),
      base44.entities.WorkerQualification.list(),
      base44.entities.ScheduleColumn.list(),
    ]);

    // Pull each setting locally from the one cached list (no per-key queries)
    const taskQuals = parseSetting(allSettings, "task_qualifications", {}) || {};
    const tasksList = parseSetting(allSettings, "tasks_list", []) || [];
    const populationsRaw = parseSetting(allSettings, "worker_populations", []) || [];
    const workerRolesRaw = parseSetting(allSettings, "worker_roles", []) || [];
    const globalCols = parseSetting(allSettings, "custom_schedule_params", []) || [];
    const cartParams = parseSetting(allSettings, "cart_specific_params", {}) || {};

    setWorkers(workersData);
    setAssignments(assignmentsData);
    setTemplateRows(templateRowsData);
    setAllTemplates(templatesData);
    setTrackers(trackersData);
    setCharts(chartsData);
    setTrackerEntries(entriesData);

    // Task qualifications already parsed from the cached settings
    setTaskQualifications(taskQuals);
    const taskIdToName = {};
    (tasksList || []).forEach(t => { if (typeof t === "object" && t.mapping_id) taskIdToName[t.mapping_id] = t.name; });
    const taskQualNames = Object.keys(taskQuals).map(k => taskIdToName[k] || k);
    const taskListNames = tasksList.map(t => typeof t === 'string' ? t : t.name);
    const qualsFromEntity = qualificationsData.map(q => ({ id: q.id, name: q.name }));
    const allTaskNames = [...new Set([...taskQualNames, ...taskListNames])];
    const entityNameSet = new Set(qualsFromEntity.map(q => q.name));
    const merged = [
      ...qualsFromEntity,
      ...allTaskNames.filter(name => !entityNameSet.has(name)).map(name => ({ id: name, name }))
    ];
    setQualifications(merged);
    setWorkerQualifications(workerQualsData);
    {
      const objs = populationsRaw.map(p => typeof p === "string" ? { name: p, mapping_id: p } : p).filter(p => p.name);
      setPopulations(objs.map(p => p.name));
      setPopulationObjects(objs);
    }
    {
      const objs = workerRolesRaw.map(r => typeof r === "string" ? { name: r, mapping_id: r } : r).filter(r => r.name);
      setWorkerRoles(objs); // Pass full objects so reports can resolve mapping_id ↔ name
      setRoleObjects(objs);
    }

    // Collect all unique schedule columns from global + cart params + entities
    const cartCols = Object.values(cartParams).flat();
    const entityCols = (scheduleColEntities || []).map(c => ({
      name: c.name,
      type: c.type,
      role_filter: c.role_filter,
      mapping_id: c.mapping_id,
      options: c.options,
      sub_options: c.sub_options,
      quantitative_items: c.quantitative_items,
      is_time: c.is_time,
    }));
    const allCols = [...globalCols, ...cartCols, ...entityCols];
    const uniqueCols = allCols.filter((col, idx, arr) => arr.findIndex(c => c.name === col.name) === idx);
    setScheduleColumns(uniqueCols);
    // Build id→column map for live name resolution in charts (include entities)
    const byId = {};
    [...globalCols, ...entityCols].forEach(c => { if (c.mapping_id) byId[c.mapping_id] = c; });
    setScheduleColumnsById(byId);
    } catch (error) {
      console.error('Error loading reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewTracker = () => {
    setEditingTracker(null);
    setTrackerEditorOpen(true);
  };

  const handleTrackerSaved = (saved) => {
    if (editingTracker) {
      setTrackers(prev => prev.map(t => t.id === saved.id ? saved : t));
    } else {
      setTrackers(prev => [...prev, saved]);
    }
    setTrackerEditorOpen(false);
    // Keep editingTracker updated so next open shows latest filters
    setEditingTracker(saved);
  };

  const handleTrackerUpdated = (updated) => {
    setTrackers(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  const handleDeleteTracker = async (trackerId) => {
    await base44.entities.Tracker.delete(trackerId);
    setTrackers(prev => prev.filter(t => t.id !== trackerId));
  };

  const handleChartSaved = (saved) => {
    setCharts(prev => prev.some(c => c.id === saved.id) ? prev.map(c => c.id === saved.id ? saved : c) : [...prev, saved]);
    setEditingChart(null);
  };

  const handleDeleteChart = async (chartId) => {
    await base44.entities.ChartWidget.delete(chartId);
    setCharts(prev => prev.filter(c => c.id !== chartId));
  };

  const handleReorderTrackers = async (result) => {
    const { source, destination } = result;
    if (!destination) return;
    const newTrackers = Array.from(trackers);
    const [movedTracker] = newTrackers.splice(source.index, 1);
    newTrackers.splice(destination.index, 0, movedTracker);
    setTrackers(newTrackers);
    // Update order in database
    newTrackers.forEach(async (t, idx) => {
      await base44.entities.Tracker.update(t.id, { order: idx });
    });
  };

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
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">דוחות ומעקב</h1>
            <p className="text-gray-500 text-sm mt-1">יצירה וניהול טבלאות מעקב וגרפים מותאמים אישית</p>
          </div>
          {activeTab === "tables" ? (
            <Button onClick={createNewTracker} className="bg-blue-900 hover:bg-blue-800">
              <Plus className="w-4 h-4 ml-1" />צור מעקב חדש
            </Button>
          ) : (
            <Button onClick={() => { setEditingChart(null); setChartBuilderOpen(true); }} className="bg-blue-900 hover:bg-blue-800">
              <Plus className="w-4 h-4 ml-1" />בנה גרף חדש
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl shadow-sm border p-1 w-fit">
          <button
            onClick={() => setActiveTab("tables")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "tables" ? "bg-blue-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            <Table2 className="w-4 h-4" />טבלאות מעקב
          </button>
          <button
            onClick={() => setActiveTab("charts")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "charts" ? "bg-blue-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            <BarChart2 className="w-4 h-4" />גרפים
          </button>
        </div>

        {activeTab === "tables" && (
          trackers.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl shadow-sm border">
              <p className="text-4xl mb-4">📊</p>
              <p className="text-xl font-semibold text-gray-700 mb-2">אין טבלאות מעקב עדיין</p>
              <p className="text-gray-400 mb-6">לחץ על "צור מעקב חדש" כדי להתחיל</p>
              <Button onClick={createNewTracker} className="bg-blue-900 hover:bg-blue-800">
                <Plus className="w-4 h-4 ml-1" />צור מעקב חדש
              </Button>
            </div>
          ) : (
            <TrackerLayoutArea
              trackers={trackers}
              workers={workers}
              assignments={assignments}
              templateRows={templateRows}
              allTemplates={allTemplates}
              populations={populations}
              workerRoles={workerRoles}
              scheduleColumns={scheduleColumns}
              qualifications={qualifications}
              workerQualifications={workerQualifications}
              onDeleteTracker={handleDeleteTracker}
              onUpdatedTracker={handleTrackerUpdated}
            />
          )
        )}

        {activeTab === "charts" && (
          <>
            {trackers.length > 0 && (
              <div className="mb-6 bg-white rounded-xl shadow-sm border p-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">בחר טבלת מעקב להצגת גרפים</label>
                <select
                  value={selectedTrackerForCharts || ""}
                  onChange={e => setSelectedTrackerForCharts(e.target.value || null)}
                  className="w-full md:w-80 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  dir="rtl"
                >
                  <option value="">הצג את כל הגרפים</option>
                  {trackers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            {charts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl shadow-sm border">
                <p className="text-4xl mb-4">📈</p>
                <p className="text-xl font-semibold text-gray-700 mb-2">אין גרפים עדיין</p>
                <p className="text-gray-400 mb-6">לחץ על "בנה גרף חדש" כדי להתחיל</p>
                <Button onClick={() => { setEditingChart(null); setChartBuilderOpen(true); }} className="bg-blue-900 hover:bg-blue-800">
                  <Plus className="w-4 h-4 ml-1" />בנה גרף חדש
                </Button>
              </div>
            ) : (
              <ChartCanvas
                charts={charts.filter(chart => !selectedTrackerForCharts || chart.tracker_id === selectedTrackerForCharts)}
                workers={workers}
                assignments={assignments}
                templateRows={templateRows}
                allTemplates={allTemplates}
                trackers={trackers}
                trackerEntries={trackerEntries}
                workerQualifications={workerQualifications}
                qualifications={qualifications}
                roleObjects={roleObjects}
                populationObjects={populationObjects}
                scheduleColumnsById={scheduleColumnsById}
                onEdit={(chart) => { setEditingChart(chart); setChartBuilderOpen(true); }}
                onDelete={handleDeleteChart}
              />
            )}
          </>
        )}
      </div>

      <TrackerEditor
        open={trackerEditorOpen}
        onOpenChange={setTrackerEditorOpen}
        tracker={editingTracker}
        onSaved={handleTrackerSaved}
        scheduleColumns={scheduleColumns}
        qualifications={qualifications}
        populations={populations}
        workerRoles={workerRoles}
      />

      <ChartBuilder
        open={chartBuilderOpen}
        onOpenChange={setChartBuilderOpen}
        chart={editingChart}
        onSaved={handleChartSaved}
        scheduleColumns={scheduleColumns}
        trackers={trackers}
        workers={workers}
        populations={populations}
        workerRoles={workerRoles}
        roleObjects={roleObjects}
        populationObjects={populationObjects}
        assignments={assignments}
        templateRows={templateRows}
        allTemplates={allTemplates}
        trackerEntries={trackerEntries}
        workerQualifications={workerQualifications}
        qualifications={qualifications}
      />
    </div>
  );
}