import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, BarChart2, Table2, GripVertical } from "lucide-react";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import TrackerTable from "../components/reports/TrackerTable";
import ChartBuilder from "../components/reports/ChartBuilder";
import ChartDisplay from "../components/reports/ChartDisplay";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function Reports() {
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [templateRows, setTemplateRows] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [trackers, setTrackers] = useState([]);
  const [populations, setPopulations] = useState([]);
  const [workerRoles, setWorkerRoles] = useState([]);
  const [scheduleColumns, setScheduleColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tables");
  // Charts
  const [charts, setCharts] = useState([]);
  const [trackerEntries, setTrackerEntries] = useState([]);
  const [chartBuilderOpen, setChartBuilderOpen] = useState(false);
  const [editingChart, setEditingChart] = useState(null);
  const [selectedTrackerForCharts, setSelectedTrackerForCharts] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [
      workersData, assignmentsData, templateRowsData, templatesData, trackersData,
      populationsSettings, workerRolesSettings, globalColSettings, cartColSettings
    ] = await Promise.all([
      base44.entities.Worker.list(),
      base44.entities.Assignment.list("-date"),
      base44.entities.TemplateRow.list(),
      base44.entities.Template.filter({ active: true }),
      base44.entities.Tracker.list("order"),
      base44.entities.AppSettings.filter({ setting_key: "worker_populations" }),
      base44.entities.AppSettings.filter({ setting_key: "worker_roles" }),
      base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" }),
      base44.entities.AppSettings.filter({ setting_key: "cart_specific_params" }),
    ]);
    setWorkers(workersData);
    setAssignments(assignmentsData);
    setTemplateRows(templateRowsData);
    setAllTemplates(templatesData);
    setTrackers(trackersData);
    if (populationsSettings.length > 0) setPopulations(JSON.parse(populationsSettings[0].setting_value) || []);
    if (workerRolesSettings.length > 0) setWorkerRoles(JSON.parse(workerRolesSettings[0].setting_value) || []);
    // Load charts and all tracker entries
    const [chartsData, entriesData] = await Promise.all([
      base44.entities.ChartWidget.list("order"),
      base44.entities.TrackerEntry.list(),
    ]);
    setCharts(chartsData);
    setTrackerEntries(entriesData);

    // Collect all unique schedule columns from global + cart params
    const globalCols = globalColSettings.length > 0 ? (JSON.parse(globalColSettings[0].setting_value) || []) : [];
    const cartCols = cartColSettings.length > 0 ? Object.values(JSON.parse(cartColSettings[0].setting_value) || {}).flat() : [];
    const allCols = [...globalCols, ...cartCols];
    const uniqueCols = allCols.filter((col, idx, arr) => arr.findIndex(c => c.name === col.name) === idx);
    setScheduleColumns(uniqueCols);
    setLoading(false);
  };

  const createNewTracker = async () => {
    const created = await base44.entities.Tracker.create({ name: "מעקב חדש", columns: [], order: Date.now() });
    setTrackers(prev => [...prev, created]);
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
            <DragDropContext onDragEnd={handleReorderTrackers}>
              <Droppable droppableId="trackers">
                {(provided, snapshot) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className={snapshot.isDraggingOver ? "bg-blue-50 rounded-lg" : ""}>
                    {trackers.map((tracker, idx) => (
                      <Draggable key={tracker.id} draggableId={tracker.id} index={idx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="relative mb-6"
                          >
                            <div className="absolute right-4 top-4 text-gray-300 hover:text-gray-500" {...provided.dragHandleProps}>
                              <GripVertical className="w-5 h-5" />
                            </div>
                            <TrackerTable
                              tracker={tracker}
                              workers={workers}
                              assignments={assignments}
                              templateRows={templateRows}
                              allTemplates={allTemplates}
                              populations={populations}
                              workerRoles={workerRoles}
                              scheduleColumns={scheduleColumns}
                              onDelete={() => handleDeleteTracker(tracker.id)}
                              onUpdated={handleTrackerUpdated}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {charts.filter(chart => !selectedTrackerForCharts || chart.tracker_id === selectedTrackerForCharts).map(chart => (
                  <ChartDisplay
                    key={chart.id}
                    chart={chart}
                    workers={workers}
                    assignments={assignments}
                    templateRows={templateRows}
                    allTemplates={allTemplates}
                    trackers={trackers}
                    trackerEntries={trackerEntries}
                    onEdit={() => { setEditingChart(chart); setChartBuilderOpen(true); }}
                    onDelete={() => handleDeleteChart(chart.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

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
        assignments={assignments}
        templateRows={templateRows}
        allTemplates={allTemplates}
        trackerEntries={trackerEntries}
      />
    </div>
  );
}