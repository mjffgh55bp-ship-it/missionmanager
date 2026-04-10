import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil } from "lucide-react";
import { format, addDays, subDays, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Download } from "lucide-react";
import toast from 'react-hot-toast';

const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

const formatDateHebrew = (date) => {
  const d = new Date(date);
  const monthName = HEBREW_MONTHS[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  return `${day} ${monthName}, ${year}`;
};

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ColumnCell from "../components/schedule/ColumnCell";
import WorkerCell from "../components/schedule/WorkerCell";
import TimeCell from "../components/schedule/TimeCell";
import PresetsDialog from "../components/schedule/PresetsDialog";
import { BookmarkPlus } from "lucide-react";

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workers, setWorkers] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [columnTypes, setColumnTypes] = useState([]);
  const [columnSubTypes, setColumnSubTypes] = useState({});
  const [templates, setTemplates] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [templateRows, setTemplateRows] = useState([]);
  const [showAddTemplateColumnDialog, setShowAddTemplateColumnDialog] = useState(false);
  const [showCreateMokedDialog, setShowCreateMokedDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editingMokedName, setEditingMokedName] = useState(null);
  const [editingMokedNameValue, setEditingMokedNameValue] = useState("");
  const [newTemplateColumnName, setNewTemplateColumnName] = useState("");
  const [newTemplateColumnType, setNewTemplateColumnType] = useState("text");
  const [newTemplateColumnRole, setNewTemplateColumnRole] = useState("");

  const [customColumnOrders, setCustomColumnOrders] = useState({});
  const [dailyCustomColumns, setDailyCustomColumns] = useState({});
  const [mokedOrder, setMokedOrder] = useState([]);
  const [shiftStatuses, setShiftStatuses] = useState([]);
  const [workerRoles, setWorkerRoles] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [showPresetsDialog, setShowPresetsDialog] = useState(false);
  const [openRegistrations, setOpenRegistrations] = useState([]);

  useEffect(() => {loadData();}, [currentDate]);



  const loadData = async () => {
    setLoading(true);
    const dateString = format(currentDate, "yyyy-MM-dd");
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");

    const [workersData, availabilitiesData, unavailabilitiesData] = await Promise.all([
    base44.entities.Worker.filter({ active: true }),
    base44.entities.Availability.filter({ week_start_date: weekStartStr }),
    base44.entities.Unavailability.filter({ date: dateString })]
    );

    const [colTypesSettings, allTemplatesData, templateRowsData, shiftStatusesSettings, workerRolesSettings] = await Promise.all([
    base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" }),
    base44.entities.Template.filter({ active: true }),
    base44.entities.TemplateRow.filter({ date: dateString }),
    base44.entities.AppSettings.filter({ setting_key: "shift_statuses" }),
    base44.entities.AppSettings.filter({ setting_key: "worker_roles" })]
    );

    if (colTypesSettings.length > 0) {
      const customParams = JSON.parse(colTypesSettings[0].setting_value) || [];
      setColumnTypes(customParams.map(c => c.name));
      // Build subtypes map from options and sub_options
      const subTypesMap = {};
      customParams.forEach(c => {
        const allOpts = [];
        if (c.options && c.options.length > 0) allOpts.push(...c.options);
        if (c.sub_options && c.sub_options.length > 0) allOpts.push(...c.sub_options.map(so => so.name));
        if (allOpts.length > 0) subTypesMap[c.name] = allOpts;
      });
      setColumnSubTypes(subTypesMap);
    }
    if (shiftStatusesSettings.length > 0) setShiftStatuses(JSON.parse(shiftStatusesSettings[0].setting_value) || []);
    if (workerRolesSettings.length > 0) setWorkerRoles(JSON.parse(workerRolesSettings[0].setting_value) || []);

    const openRegSettings = await base44.entities.AppSettings.filter({ setting_key: "open_registrations" });
    if (openRegSettings.length > 0) {
      setOpenRegistrations(JSON.parse(openRegSettings[0].setting_value) || []);
    } else {
      setOpenRegistrations([]);
    }

    const mokedOrderSettings = await base44.entities.AppSettings.filter({ setting_key: `moked_order_${dateString}` });
    if (mokedOrderSettings.length > 0) {
      setMokedOrder(JSON.parse(mokedOrderSettings[0].setting_value) || []);
    } else {
      setMokedOrder([]);
    }

    const columnOrderSettings = await base44.entities.AppSettings.filter({ setting_key: `schedule_column_order_${dateString}` });
    if (columnOrderSettings.length > 0) {
      setCustomColumnOrders(JSON.parse(columnOrderSettings[0].setting_value) || {});
    } else {
      setCustomColumnOrders({});
    }

    const dailyColumnsSettings = await base44.entities.AppSettings.filter({ setting_key: `schedule_daily_columns_${dateString}` });
    if (dailyColumnsSettings.length > 0) {
      setDailyCustomColumns(JSON.parse(dailyColumnsSettings[0].setting_value) || {});
    } else {
      setDailyCustomColumns({});
    }

    // Auto-add default templates if no rows exist for this date
    if (templateRowsData.length === 0) {
      const defaultTemplates = allTemplatesData.filter((t) => t.is_default && t.active);
      for (const template of defaultTemplates) {
        const groupId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const rowsToCreate = template.default_rows && template.default_rows.length > 0 ?
        template.default_rows :
        [{}];
        for (const rowValues of rowsToCreate) {
          await base44.entities.TemplateRow.create({
            template_id: template.id,
            template_name: template.name,
            date: dateString,
            values: rowValues,
            group_id: groupId
          });
        }
      }
      const updatedTemplateRows = await base44.entities.TemplateRow.filter({ date: dateString });
      setTemplateRows(updatedTemplateRows);
      const updatedUniqueIds = [...new Set(updatedTemplateRows.map((row) => row.template_id))];
      setTemplates(allTemplatesData.filter((t) => updatedUniqueIds.includes(t.id)));
    } else {
      setTemplateRows(templateRowsData);
      const uniqueTemplateIds = [...new Set(templateRowsData.map((row) => row.template_id))];
      setTemplates(allTemplatesData.filter((t) => uniqueTemplateIds.includes(t.id)));
    }

    setAllTemplates(allTemplatesData);
    setWorkers(workersData);
    setAvailabilities(availabilitiesData);
    setUnavailabilities(unavailabilitiesData);
    setLoading(false);
  };

  const dateString = format(currentDate, "yyyy-MM-dd");

  const handleAddTemplateRowForTemplate = async (templateId, groupId) => {
    const template = allTemplates.find((t) => t.id === templateId);
    if (!template) return;

    await base44.entities.TemplateRow.create({
      template_id: templateId,
      template_name: template.name,
      date: dateString,
      values: {},
      group_id: groupId
    });

    await loadData();
  };

  const handleAddPresetToSchedule = async (preset) => {
    const config = preset.template_config;
    const newTemplate = await base44.entities.Template.create({
      name: preset.name,
      color: config.color || '#3b82f6',
      columns: config.columns || [],
      default_rows: config.default_rows || [],
      active: true
    });
    const newGroupId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const rowsToCreate = config.default_rows && config.default_rows.length > 0 ?
    config.default_rows :
    [{}];
    const createdRows = [];
    for (const rowValues of rowsToCreate) {
      const newRow = await base44.entities.TemplateRow.create({
        template_id: newTemplate.id,
        template_name: newTemplate.name,
        date: dateString,
        values: rowValues,
        group_id: newGroupId
      });
      createdRows.push(newRow);
    }
    // Immediately update state so moked appears without waiting for DB consistency
    setAllTemplates(prev => [...prev, newTemplate]);
    setTemplates(prev => [...prev, newTemplate]);
    setTemplateRows(prev => [...prev, ...createdRows]);
    toast.success(`מוקד "${preset.name}" נוסף ללוח`);
    await loadData();
  };

  const handleDuplicateMoked = async (group) => {
    const newGroupId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const rowsToCreate = group.rows.map((row) => ({
      template_id: row.template_id,
      template_name: row.template_name,
      date: dateString,
      values: row.values,
      group_id: newGroupId
    }));
    await base44.entities.TemplateRow.bulkCreate(rowsToCreate);
    await loadData();
    toast.success('מוקד שוכפל בהצלחה');
  };

  const handleCreateNewMoked = async () => {
    const newTemplate = await base44.entities.Template.create({
      name: `מוקד ${format(currentDate, 'dd/MM')}`,
      color: '#3b82f6',
      columns: [
      { name: "תדריך", type: "time", width: 100 },
      { name: "התחלה", type: "time", width: 100 },
      { name: "סיום", type: "time", width: 100 },
      { name: "שף", type: "worker", width: 150 },
      { name: "סו שף", type: "worker", width: 150 }],

      default_rows: [],
      active: true
    });

    const newGroupId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    await base44.entities.TemplateRow.create({
      template_id: newTemplate.id,
      template_name: newTemplate.name,
      date: dateString,
      values: {},
      group_id: newGroupId
    });

    setShowCreateMokedDialog(false);
    await loadData();
    toast.success('מוקד חדש נוצר בהצלחה');
  };

  // When a time cell with +N is saved, auto-create continuation rows for the affected days
  // Day boundary is at 06:00 — shifts ending before 06:00 stay in the same day
  const handleTimeSaved = async (row, newValues) => {
    const endTime = newValues["סיום"] || newValues["שעת סיום"] || "";
    if (!endTime.startsWith("+")) return;

    const plusMatch = endTime.match(/^(\+(\d+))\s+(\d{2}):(\d{2})$/);
    if (!plusMatch) return;
    const daysAhead = parseInt(plusMatch[2]);
    const realEndTime = `${plusMatch[3]}:${plusMatch[4]}`;

    // Only create continuation if end time is >= 06:00 (crosses the day boundary)
    if (daysAhead === 1 && realEndTime < "06:00") return;

    // For each future day, ensure a continuation row exists
    for (let d = 1; d <= daysAhead; d++) {
      const futureDate = format(addDays(currentDate, d), "yyyy-MM-dd");
      // Check if a continuation row already exists for this group on that day
      const existingRows = await base44.entities.TemplateRow.filter({ date: futureDate });
      const alreadyExists = existingRows.some((r) => r.values?.continuation_source_row_id === row.id);
      if (alreadyExists) continue;

      const template = allTemplates.find((t) => t.id === row.template_id);
      const isLastDay = d === daysAhead;

      const continuationValues = {
        ...newValues,
        "התחלה": "06:00",
        "שעת התחלה": "06:00",
        "סיום": isLastDay ? realEndTime : "06:00",
        "שעת סיום": isLastDay ? realEndTime : "06:00",
        is_continuation: true,
        continuation_from_date: dateString
      };
      // Remove worker assignments from continuation rows — they'll be assigned separately
      for (const col of template?.columns || []) {
        if (col.type === "worker") delete continuationValues[col.name];
      }

      await base44.entities.TemplateRow.create({
        template_id: row.template_id,
        template_name: row.template_name,
        date: futureDate,
        values: { ...continuationValues, continuation_source_row_id: row.id },
        group_id: row.group_id
      });
    }
  };

  const handleDeleteTemplateRow = async (rowId) => {
    if (confirm("האם למחוק שורה זו?")) {
      await base44.entities.TemplateRow.delete(rowId);
      const updatedRows = templateRows.filter(r => r.id !== rowId);
      setTemplateRows(updatedRows);
    }
  };

  const saveMokedName = async (templateId, name) => {
    if (name.trim()) {
      await base44.entities.Template.update(templateId, { name });
      setTemplateRows(prev => prev.map(r => 
        r.template_id === templateId ? { ...r, template_name: name } : r
      ));
      setAllTemplates(prev => prev.map(t => 
        t.id === templateId ? { ...t, name } : t
      ));
      setTemplates(prev => prev.map(t => 
        t.id === templateId ? { ...t, name } : t
      ));
    }
    setEditingMokedName(null);
    setEditingMokedNameValue("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8 flex items-center justify-center">
        <div className="text-gray-600" dir="rtl">טוען...</div>
      </div>);

  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b bg-white">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-wrap">
                <CardTitle className="text-2xl" dir="rtl">לוח</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 1))}><ChevronRight className="w-4 h-4" /></Button>
                  <div className="px-4 py-2 bg-blue-900 text-white rounded-lg font-semibold min-w-[160px] text-center" dir="rtl">{formatDateHebrew(currentDate)}</div>
                  <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronLeft className="w-4 h-4" /></Button>
                  <Button variant="outline" onClick={() => setCurrentDate(new Date())} dir="rtl">היום</Button>
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  <Button
                    variant={editMode ? "default" : "outline"}
                    onClick={() => setEditMode(!editMode)}
                    className={editMode ? "bg-purple-600 hover:bg-purple-700" : ""}
                    dir="rtl">

                    <Pencil className="w-4 h-4 ml-2" />
                    {editMode ? 'סיים עריכה' : 'עריכה'}
                  </Button>
                  {editMode &&
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowPresetsDialog(true)} dir="rtl">
                      <Plus className="w-4 h-4 ml-2" />
                      הוסף מוקד
                    </Button>
                  }
                  {editMode && templateRows.length > 0 &&
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (confirm(`האם למחוק את כל ${templateRows.length} השורות מכל הקטגוריות?`)) {
                        for (const row of templateRows) {
                          await base44.entities.TemplateRow.delete(row.id);
                        }
                        loadData();
                      }
                    }}
                    dir="rtl">

                      <Trash2 className="w-4 h-4 ml-2" />
                      מחק הכל
                    </Button>
                  }
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {templates.length === 0 && templateRows.length === 0 ?
        <Card className="border-none shadow-lg">
            <CardContent className="py-16 text-center" dir="rtl">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">אין מוקדים ליום זה</h3>
              <p className="text-gray-600">לחץ על "מצב עריכה" ואז "צור מוקד חדש" להתחיל.</p>
            </CardContent>
          </Card> :

        <div className="space-y-4">
            {(() => {
            const groupedRows = {};
            templateRows.forEach((row) => {
              const key = `${row.template_id}_${row.group_id || 'default'}`;
              if (!groupedRows[key]) groupedRows[key] = [];
              groupedRows[key].push(row);
            });

            const groups = Object.entries(groupedRows).map(([key, rows]) => ({
              key,
              template_id: rows[0].template_id,
              group_id: rows[0].group_id,
              rows: rows.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
            }));

            // Sort groups by mokedOrder if available
            if (mokedOrder.length > 0) {
              groups.sort((a, b) => {
                const ai = mokedOrder.indexOf(a.key);
                const bi = mokedOrder.indexOf(b.key);
                if (ai === -1 && bi === -1) return 0;
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
              });
            }

            return groups.filter((group) => {
              const template = allTemplates.find((t) => t.id === group.template_id);
              if (!template) return false;
              // Hide old-style role tables (templates with a 'תפקיד' column)
              return !(template.columns || []).some(c => c.name === 'תפקיד');
            }).map((group, groupIndex) => {
              const template = allTemplates.find((t) => t.id === group.template_id);
              if (!template) return null;
              const templateRowsForTemplate = group.rows;

              const dailyColumns = dailyCustomColumns[template.id] || [];
              const allColumns = [...(template.columns || []), ...dailyColumns];

              const customOrder = customColumnOrders[template.id];
              const orderedColumns = customOrder ?
              customOrder.map((name) => allColumns.find((col) => col.name === name)).filter(Boolean) :
              allColumns;

              return (
                <Card key={group.key} className="border-none shadow-lg overflow-hidden">
                    <CardHeader className="text-black py-3" style={{ background: `linear-gradient(to left, ${template.color || '#3b82f6'}, ${template.color || '#3b82f6'}dd)` }}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {editMode &&
                        <div className="flex flex-col gap-1">
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-black hover:bg-black/10"
                          disabled={groupIndex === 0}
                          onClick={async () => {
                            const newOrder = groups.map(g => g.key);
                            [newOrder[groupIndex - 1], newOrder[groupIndex]] = [newOrder[groupIndex], newOrder[groupIndex - 1]];
                            setMokedOrder(newOrder);
                            const settings = await base44.entities.AppSettings.filter({ setting_key: `moked_order_${dateString}` });
                            const data = { setting_key: `moked_order_${dateString}`, setting_value: JSON.stringify(newOrder) };
                            if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data); else await base44.entities.AppSettings.create(data);
                          }}>
                                <ChevronUp className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-black hover:bg-black/10"
                          disabled={groupIndex === groups.length - 1}
                          onClick={async () => {
                            const newOrder = groups.map(g => g.key);
                            [newOrder[groupIndex], newOrder[groupIndex + 1]] = [newOrder[groupIndex + 1], newOrder[groupIndex]];
                            setMokedOrder(newOrder);
                            const settings = await base44.entities.AppSettings.filter({ setting_key: `moked_order_${dateString}` });
                            const data = { setting_key: `moked_order_${dateString}`, setting_value: JSON.stringify(newOrder) };
                            if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data); else await base44.entities.AppSettings.create(data);
                          }}>
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                            </div>
                        }
                          {group.rows.some((r) => r.values?.is_continuation) &&
                        <span className="text-[10px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded font-normal" dir="rtl">
                              המשך מ-{group.rows.find((r) => r.values?.continuation_from_date)?.values?.continuation_from_date || "יום קודם"}
                            </span>
                        }
                          {editingMokedName === `${group.key}` ?
                        <Input
                          value={editingMokedNameValue}
                          onChange={(e) => setEditingMokedNameValue(e.target.value)}
                          onBlur={() => saveMokedName(template.id, editingMokedNameValue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveMokedName(template.id, editingMokedNameValue);else
                            if (e.key === 'Escape') {setEditingMokedName(null);setEditingMokedNameValue("");}
                          }}
                          autoFocus
                          className="text-lg font-bold h-8 w-64 bg-white/20 border-white text-black"
                          dir="rtl" /> :


                        <CardTitle className="text-slate-50 text-lg font-semibold tracking-tight cursor-pointer hover:underline flex items-center gap-2"

                        onClick={() => {setEditingMokedName(`${group.key}`);setEditingMokedNameValue(template.name);}}
                        dir="rtl">

                              {template.name}
                              <Pencil className="w-3 h-3 opacity-60" />
                            </CardTitle>
                        }
                        </div>
                        {editMode &&
                      <div className="flex gap-2">
                            <Button size="sm" variant="secondary" onClick={() => handleAddTemplateRowForTemplate(template.id, group.group_id)} dir="rtl">
                              <Plus className="w-3 h-3 ml-1" />הוסף שורה
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => {setSelectedTemplate(template);setShowAddTemplateColumnDialog(true);}} dir="rtl">
                              <Plus className="w-3 h-3 ml-1" />הוסף עמודה
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDuplicateMoked(group)} dir="rtl">
                              <Plus className="w-3 h-3 ml-1" />שכפל מוקד
                            </Button>
                            {(() => {
                          const isOpen = openRegistrations.some((r) => r && r.key === group.key);
                          return (
                            <Button
                              size="sm"
                              variant={isOpen ? "default" : "outline"}
                              className={isOpen ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                              onClick={async () => {
                                let updated;
                                if (isOpen) {
                                  updated = openRegistrations.filter((r) => r && r.key !== group.key);
                                } else {
                                  const rowShifts = templateRowsForTemplate.
                                  map((row) => ({
                                    start_time: row.values?.["התחלה"] || row.values?.["שעת התחלה"] || null,
                                    end_time: row.values?.["סיום"] || row.values?.["שעת סיום"] || null
                                  })).
                                  filter((s) => s.start_time && s.end_time);
                                  const entry = {
                                    key: group.key,
                                    name: template.name,
                                    date: dateString,
                                    shifts: rowShifts.length > 0 ? rowShifts : []
                                  };
                                  updated = [...openRegistrations, entry];
                                }
                                setOpenRegistrations(updated);
                                const settings = await base44.entities.AppSettings.filter({ setting_key: "open_registrations" });
                                const data = { setting_key: "open_registrations", setting_value: JSON.stringify(updated) };
                                if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);else
                                await base44.entities.AppSettings.create(data);
                                toast.success(!isOpen ? `הרשמה לـ"${template.name}" נפתחה` : `הרשמה לـ"${template.name}" נסגרה`);
                              }}
                              dir="rtl">

                                  <Plus className="w-3 h-3 ml-1" />{isOpen ? "בטל הרשמה" : "אפשר הרשמה"}
                                </Button>);

                        })()}
                            <Button size="sm" variant="destructive"
                        onClick={async () => {
                          if (confirm(`האם למחוק את המוקד "${template.name}" מהלוח?`)) {
                            for (const row of templateRowsForTemplate) {
                              await base44.entities.TemplateRow.delete(row.id);
                            }
                            loadData();
                          }
                        }} dir="rtl">
                              <Trash2 className="w-3 h-3 ml-1" />מחק מוקד
                            </Button>
                          </div>
                      }
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {editMode && <TableHead className="w-[60px] text-center" dir="rtl"></TableHead>}
                              {orderedColumns.map((col, idx) =>
                            <TableHead key={idx} style={{ width: `${col.width}px` }} dir="rtl" className="text-center">
                                  <div className="flex items-center gap-1 justify-center">
                                    <span>{col.name}</span>
                                    {editMode &&
                                <div className="flex gap-0.5">
                                        <Button size="icon" variant="ghost" className="h-4 w-4 p-0" disabled={idx === 0}
                                  onClick={async () => {
                                    const newOrder = [...orderedColumns];
                                    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
                                    const newCustomOrders = { ...customColumnOrders, [template.id]: newOrder.map((c) => c.name) };
                                    setCustomColumnOrders(newCustomOrders);
                                    const settings = await base44.entities.AppSettings.filter({ setting_key: `schedule_column_order_${dateString}` });
                                    const data = { setting_key: `schedule_column_order_${dateString}`, setting_value: JSON.stringify(newCustomOrders) };
                                    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);else
                                    await base44.entities.AppSettings.create(data);
                                  }}>
                                          <ChevronRight className="w-3 h-3" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-4 w-4 p-0" disabled={idx === orderedColumns.length - 1}
                                  onClick={async () => {
                                    const newOrder = [...orderedColumns];
                                    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                                    const newCustomOrders = { ...customColumnOrders, [template.id]: newOrder.map((c) => c.name) };
                                    setCustomColumnOrders(newCustomOrders);
                                    const settings = await base44.entities.AppSettings.filter({ setting_key: `schedule_column_order_${dateString}` });
                                    const data = { setting_key: `schedule_column_order_${dateString}`, setting_value: JSON.stringify(newCustomOrders) };
                                    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);else
                                    await base44.entities.AppSettings.create(data);
                                  }}>
                                          <ChevronLeft className="w-3 h-3" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-4 w-4 p-0 text-red-500 hover:text-red-700"
                                  onClick={async () => {
                                    if (confirm(`האם למחוק את העמודה "${col.name}"?`)) {
                                      const isDailyColumn = (dailyCustomColumns[template.id] || []).some((c) => c.name === col.name);
                                      if (isDailyColumn) {
                                        const updatedDailyColumns = { ...dailyCustomColumns, [template.id]: (dailyCustomColumns[template.id] || []).filter((c) => c.name !== col.name) };
                                        setDailyCustomColumns(updatedDailyColumns);
                                        const settings = await base44.entities.AppSettings.filter({ setting_key: `schedule_daily_columns_${dateString}` });
                                        const data = { setting_key: `schedule_daily_columns_${dateString}`, setting_value: JSON.stringify(updatedDailyColumns) };
                                        if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
                                      } else {
                                        const updatedColumns = template.columns.filter((c) => c.name !== col.name);
                                        await base44.entities.Template.update(template.id, { columns: updatedColumns });
                                      }
                                      loadData();
                                    }
                                  }}>
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                }
                                  </div>
                                </TableHead>
                            )}
                              <TableHead className="w-[100px] text-center" dir="rtl">סטטוס</TableHead>
                              {editMode && <TableHead className="w-[60px] text-center" dir="rtl"></TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {templateRowsForTemplate.length === 0 ?
                          <TableRow>
                                <TableCell colSpan={orderedColumns.length + 3} className="text-center text-gray-500 py-8" dir="rtl">
                                  אין שורות. לחץ "הוסף שורה" להוספה.
                                </TableCell>
                              </TableRow> :

                          templateRowsForTemplate.map((row, rowIndex) =>
                          <TableRow key={row.id} className={`h-8 ${row.values?.is_continuation ? "bg-orange-50" : ""}`}>
                                  {editMode &&
                            <TableCell className="w-[60px] p-0">
                                      <div className="flex flex-col gap-0 items-center">
                                        <Button size="icon" variant="ghost" className="h-4 w-4" disabled={rowIndex === 0}
                                onClick={async () => {
                                  const prevRow = templateRowsForTemplate[rowIndex - 1];
                                  await base44.entities.TemplateRow.update(row.id, { created_date: prevRow.created_date });
                                  await base44.entities.TemplateRow.update(prevRow.id, { created_date: row.created_date });
                                  loadData();
                                }}>
                                          <ChevronUp className="w-3 h-3" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-4 w-4" disabled={rowIndex === templateRowsForTemplate.length - 1}
                                onClick={async () => {
                                  const nextRow = templateRowsForTemplate[rowIndex + 1];
                                  await base44.entities.TemplateRow.update(row.id, { created_date: nextRow.created_date });
                                  await base44.entities.TemplateRow.update(nextRow.id, { created_date: row.created_date });
                                  loadData();
                                }}>
                                          <ChevronDown className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </TableCell>
                            }
                                  {orderedColumns.map((col, idx) =>
                            <TableCell key={idx} dir="rtl" className="p-0 text-center">
                                      {col.type === "worker" ?
                              <WorkerCell
                                rowId={row.id}
                                columnName={col.name}
                                currentValue={row.values?.[col.name]}
                                currentRowValues={row.values || {}}
                                workers={workers}
                                workerRoles={workerRoles}
                                roleFilter={col.role_filter || (col.type === "worker" ? col.name : null)}
                                availabilities={availabilities}
                                unavailabilities={unavailabilities}
                                dateString={dateString}
                                rowStartTime={row.values?.["התחלה"] || row.values?.["שעת התחלה"]}
                                rowEndTime={row.values?.["סיום"] || row.values?.["שעת סיום"]}
                                onSaved={(workerId) => {
                                  const newValues = { ...row.values, [col.name]: workerId };
                                  setTemplateRows((prev) => prev.map((r) => r.id === row.id ? { ...r, values: newValues } : r));
                                }} /> :

                              col.type === "time" ?
                              <TimeCell
                                rowId={row.id}
                                colName={col.name}
                                value={row.values?.[col.name] || ""}
                                defaultValue={col.default_value || ""}
                                onSaved={(newValues) => {
                                  setTemplateRows((prev) => prev.map((r) => r.id === row.id ? { ...r, values: newValues } : r));
                                  handleTimeSaved(row, newValues);
                                }}
                                rowValues={row.values || {}} /> :


(columnSubTypes[col.name] || []).length > 0 ?
                                <ColumnCell
                                  assignmentId={row.id}
                                  colType={col.name}
                                  columnValues={row.values || {}}
                                  availableSubTypes={columnSubTypes[col.name] || []}
                                  isTemplateRow={true}
                                  onSaved={(updatedColumnValues) => {
                                    const newValues = { ...row.values, ...updatedColumnValues };
                                    base44.entities.TemplateRow.update(row.id, { values: newValues });
                                    setTemplateRows((prev) => prev.map((r) => r.id === row.id ? { ...r, values: newValues } : r));
                                  }} /> :
                                <div className="px-2 py-1 text-sm text-center">{row.values?.[col.name] || ''}</div>

                              }
                                    </TableCell>
                            )}
                                  <TableCell className="p-0 text-center">
                                    <Select
                                value={row.values?.status || ""}
                                onValueChange={async (value) => {
                                  const newValues = { ...row.values, status: value };
                                  await base44.entities.TemplateRow.update(row.id, { values: newValues });
                                  setTemplateRows((prev) => prev.map((r) => r.id === row.id ? { ...r, values: newValues } : r));
                                }}>

                                      <SelectTrigger className="h-full border-0 rounded-none text-xs justify-center">
                                        <SelectValue placeholder="-" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value={null}>ללא</SelectItem>
                                        {shiftStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  {editMode &&
                                  <TableCell className="p-0">
                                      <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500 hover:text-red-700" onClick={() => handleDeleteTemplateRow(row.id)}>
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </TableCell>
                            }
                                </TableRow>
                          )
                          }
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>);

            });
          })()}
          </div>
        }

        <PresetsDialog
          open={showPresetsDialog}
          onOpenChange={setShowPresetsDialog}
          onAddPreset={handleAddPresetToSchedule} />


        {/* Add Template Column Dialog */}
        <Dialog open={showAddTemplateColumnDialog} onOpenChange={setShowAddTemplateColumnDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle dir="rtl">הוסף עמודה ל{selectedTemplate?.name}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label dir="rtl">בחר סוג עמודה</Label>
                <Select value={newTemplateColumnName} onValueChange={(val) => {setNewTemplateColumnName(val);setNewTemplateColumnType("");setNewTemplateColumnRole("");}}>
                  <SelectTrigger><SelectValue placeholder="בחר מסוגי העמודות..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="briefing">תדריך</SelectItem>
                    <SelectItem value="time">זמן התחלה</SelectItem>
                    <SelectItem value="time_end">זמן סיום</SelectItem>
                    {columnTypes.map((t) =>
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                    )}
                    <SelectItem value="worker_member">חבר צוות</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newTemplateColumnName === "worker_member" &&
              <>
                  <div>
                    <Label dir="rtl">תפקיד</Label>
                    <Select value={newTemplateColumnRole} onValueChange={(val) => {setNewTemplateColumnRole(val);setNewTemplateColumnType(val);}}>
                      <SelectTrigger dir="rtl"><SelectValue placeholder="בחר תפקיד..." /></SelectTrigger>
                      <SelectContent>
                        {workerRoles.map((role) =>
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                      )}
                      </SelectContent>
                    </Select>
                  </div>
                  {newTemplateColumnRole &&
                <div>
                      <Label dir="rtl">שם העמודה (אופציונלי)</Label>
                      <Input
                    value={newTemplateColumnType === newTemplateColumnRole ? "" : newTemplateColumnType}
                    onChange={(e) => setNewTemplateColumnType(e.target.value || newTemplateColumnRole)}
                    placeholder={newTemplateColumnRole}
                    dir="rtl" />

                    </div>
                }
                </>
              }
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {setShowAddTemplateColumnDialog(false);setNewTemplateColumnName("");setNewTemplateColumnType("text");}} dir="rtl">ביטול</Button>
              <Button
                onClick={async () => {
                  if (!newTemplateColumnName || !selectedTemplate) return;
                  let columnToAdd;
                  if (newTemplateColumnName === "briefing") {
                    columnToAdd = { name: "תדריך", type: "time", width: 100 };
                  } else if (newTemplateColumnName === "time") {
                    columnToAdd = { name: "התחלה", type: "time", width: 100 };
                  } else if (newTemplateColumnName === "time_end") {
                    columnToAdd = { name: "סיום", type: "time", width: 100 };
                  } else if (newTemplateColumnName === "worker_member") {
                    const colName = newTemplateColumnType.trim() || newTemplateColumnRole;
                    columnToAdd = { name: colName, type: "worker", width: 150, role_filter: newTemplateColumnRole };
                  } else {
                    columnToAdd = { name: newTemplateColumnName, type: "text", width: 120 };
                  }

                  const updatedDailyColumns = {
                    ...dailyCustomColumns,
                    [selectedTemplate.id]: [...(dailyCustomColumns[selectedTemplate.id] || []), columnToAdd]
                  };
                  setDailyCustomColumns(updatedDailyColumns);

                  const settings = await base44.entities.AppSettings.filter({ setting_key: `schedule_daily_columns_${dateString}` });
                  const data = { setting_key: `schedule_daily_columns_${dateString}`, setting_value: JSON.stringify(updatedDailyColumns) };
                  if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);else
                  await base44.entities.AppSettings.create(data);

                  setShowAddTemplateColumnDialog(false);
                  setNewTemplateColumnName("");
                  setNewTemplateColumnType("text");
                  setSelectedTemplate(null);
                  await loadData();
                  toast.success('עמודה נוספה בהצלחה');
                }}
                disabled={!newTemplateColumnName || newTemplateColumnName === "worker_member" && !newTemplateColumnRole}
                className="bg-blue-900 hover:bg-blue-800"
                dir="rtl">

                הוסף עמודה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>);

}