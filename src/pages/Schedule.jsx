import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { getCachedWorkers, getCachedTemplates, getCachedAllSettings, invalidateTemplatesCache, invalidateSettingsCache, invalidateStaticCache, softInvalidateStaticCache, toggleWeekPublished, parseSetting } from "@/lib/appDataCache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil, X, Copy, UserCheck, Users, GripVertical, Eye, EyeOff } from "lucide-react";
import { format, addDays, subDays, startOfWeek, differenceInDays } from "date-fns";
import { getHebrewDate } from "../components/utils/HebrewDate";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import toast from 'react-hot-toast';

const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const formatDateHebrew = (date) => {
  const d = new Date(date);
  const monthName = HEBREW_MONTHS[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  return `${day} ${monthName}, ${year}`;
};

const getCustomWeekNumber = (date) => {
  const year = date.getFullYear();
  const dec28PrevYear = new Date(year - 1, 11, 28);
  const weekStartDec28 = new Date(dec28PrevYear);
  weekStartDec28.setDate(dec28PrevYear.getDate() - dec28PrevYear.getDay());
  const diffDays = differenceInDays(date, weekStartDec28);
  if (diffDays < 0) return 0;
  return Math.floor(diffDays / 7) + 1;
};

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import DraggableColumnHeader from "../components/schedule/DraggableColumnHeader";
import ColumnCell from "../components/schedule/ColumnCell";
import WorkerCell from "../components/schedule/WorkerCell";
import TimeCell from "../components/schedule/TimeCell";
import PresetsDialog from "../components/schedule/PresetsDialog";
import { isVisibleScheduleTemplate } from "@/lib/scheduleVisibility";
import { getMokedDisplayName } from "@/lib/shiftDemand";
import { useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(() => {
    const saved = localStorage.getItem('schedule_last_date');
    if (saved) { const d = new Date(saved + 'T12:00:00'); if (!isNaN(d)) return d; }
    return new Date();
  });
  const [workers, setWorkers] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [columnTypes, setColumnTypes] = useState([]);
  const [columnSubTypes, setColumnSubTypes] = useState({});
  const [columnFreeText, setColumnFreeText] = useState({});
  const [columnQuantitative, setColumnQuantitative] = useState({});
  const [scheduleColumnsById, setScheduleColumnsById] = useState({});
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
  const [tasksList, setTasksList] = useState([]);
  const [taskQualifications, setTaskQualifications] = useState({});
  const [publishedWeeks, setPublishedWeeks] = useState([]);
  const [togglingPublish, setTogglingPublish] = useState(false);
  const staticDataLoaded = useRef(false);
  const lastWeekStart = useRef(null);
  const initialLoadStarted = useRef(false);
  const isLoadingAll = useRef(false);
  const openRegSettingIdRef = useRef(null);
  const columnOrderSaveTimer = useRef(null);
  const columnOrderSettingIdRef = useRef(null);
  const appSettingsIdCache = useRef({});
  const mokedOrderSavingRef = useRef(false);

  useEffect(() => {
    if (!initialLoadStarted.current) {
      initialLoadStarted.current = true;
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      lastWeekStart.current = weekStartStr;
      loadAllData();
      return;
    }
    if (!staticDataLoaded.current) return;
    localStorage.setItem('schedule_last_date', format(currentDate, 'yyyy-MM-dd'));
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const weekChanged = lastWeekStart.current !== weekStartStr;
    loadDailyData(weekChanged);
  }, [currentDate]);

  const fetchWithRetry = async (fn, retries = 6, baseDelay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try { return await fn(); }
      catch (e) {
        const isRateLimit = e?.message?.includes('Rate limit') || e?.message?.includes('rate limit');
        if (isRateLimit && i < retries - 1) {
          await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
        } else if (isRateLimit) {
          console.warn('Rate limit exhausted, returning empty for:', fn.toString().slice(0, 80));
          return [];
        } else {
          throw e;
        }
      }
    }
  };

  const loadAllData = async () => {
    if (isLoadingAll.current) return;
    isLoadingAll.current = true;
    setLoading(true);
    const dateString = format(currentDate, "yyyy-MM-dd");
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    lastWeekStart.current = weekStartStr;
    try {
    const [workersData, allTemplatesData, allSettings] = await Promise.all([
      getCachedWorkers(base44.entities),
      getCachedTemplates(base44.entities),
      getCachedAllSettings(base44.entities),
    ]);
    const [templateRowsData, unavailabilitiesData, availabilitiesData] = await Promise.all([
      fetchWithRetry(() => base44.entities.TemplateRow.filter({ date: dateString })),
      fetchWithRetry(() => base44.entities.Unavailability.filter({ date: dateString })),
      fetchWithRetry(() => base44.entities.Availability.filter({ week_start_date: weekStartStr })),
    ]);
    const colTypesSettings = allSettings.filter(s => s.setting_key === "custom_schedule_params");
    const shiftStatusesSettings = allSettings.filter(s => s.setting_key === "shift_statuses");
    const workerRolesSettings = allSettings.filter(s => s.setting_key === "worker_roles");
    const tasksSettings = allSettings.filter(s => s.setting_key === "tasks_list");
    const taskQualSettings = allSettings.filter(s => s.setting_key === "task_qualifications");
    const openRegSettings = allSettings.filter(s => s.setting_key === "open_registrations");
    const mokedOrderSettings = allSettings.filter(s => s.setting_key === `moked_order_${dateString}`);
    const columnOrderSettings = allSettings.filter(s => s.setting_key === `schedule_column_order_${dateString}`);
    const dailyColumnsSettings = allSettings.filter(s => s.setting_key === `schedule_daily_columns_${dateString}`);
    allSettings.forEach(s => { appSettingsIdCache.current[s.setting_key] = s.id; });
    setPublishedWeeks(parseSetting(allSettings, "published_weeks", []));
    applyStaticData({ colTypesSettings, allTemplatesData, shiftStatusesSettings, workerRolesSettings, tasksSettings, taskQualSettings, openRegSettings, workersData });
    applyDailyData({ dateString, templateRowsData, allTemplatesData, mokedOrderSettings, columnOrderSettings, dailyColumnsSettings, availabilitiesData, unavailabilitiesData });
    staticDataLoaded.current = true;
    } finally {
      isLoadingAll.current = false;
      setLoading(false);
    }
  };

  const loadDailyData = async (weekChanged = false) => {
    setDailyLoading(true);
    const dateString = format(currentDate, "yyyy-MM-dd");
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const [allSettings, freshTemplates] = await Promise.all([
      getCachedAllSettings(base44.entities),
      getCachedTemplates(base44.entities),
    ]);
    const [templateRowsData, unavailabilitiesData, availabilitiesData] = await Promise.all([
      fetchWithRetry(() => base44.entities.TemplateRow.filter({ date: dateString })),
      fetchWithRetry(() => base44.entities.Unavailability.filter({ date: dateString })),
      weekChanged
        ? fetchWithRetry(() => base44.entities.Availability.filter({ week_start_date: weekStartStr }))
        : Promise.resolve(null),
    ]);
    if (weekChanged) lastWeekStart.current = weekStartStr;
    setAllTemplates(freshTemplates);
    const freshColTypesSettings = allSettings.filter(s => s.setting_key === "custom_schedule_params");
    if (freshColTypesSettings.length > 0) {
      const customParams = JSON.parse(freshColTypesSettings[0].setting_value) || [];
      const byId = {};
      customParams.forEach(c => { if (c.mapping_id) byId[c.mapping_id] = c; });
      setScheduleColumnsById(byId);
      setColumnTypes(customParams.map(c => c.name));
      const subTypesMap = {};
      const freeTextMap = {};
      customParams.forEach(c => {
        const allOpts = [];
        if (c.options && c.options.length > 0) allOpts.push(...c.options);
        if (c.sub_options && c.sub_options.length > 0) allOpts.push(...c.sub_options.map(so => so.name));
        if (c.quantitative_items && c.quantitative_items.length > 0) allOpts.push(...c.quantitative_items);
        const keys = [c.name];
        if (c.mapping_id) keys.push(c.mapping_id);
        keys.forEach(k => {
          if (allOpts.length > 0) subTypesMap[k] = allOpts;
          if (c.free_text) freeTextMap[k] = true;
        });
      });
      const quantMap = {};
      customParams.forEach(c => {
        if (c.report_type === 'count_quantitative') {
          quantMap[c.name] = true;
          if (c.mapping_id) quantMap[c.mapping_id] = true;
        }
      });
      setColumnSubTypes(subTypesMap);
      setColumnFreeText(freeTextMap);
      setColumnQuantitative(quantMap);
    }
    const mokedOrderSettings = allSettings.filter(s => s.setting_key === `moked_order_${dateString}`);
    const columnOrderSettings = allSettings.filter(s => s.setting_key === `schedule_column_order_${dateString}`);
    const dailyColumnsSettings = allSettings.filter(s => s.setting_key === `schedule_daily_columns_${dateString}`);
    allSettings.forEach(s => { appSettingsIdCache.current[s.setting_key] = s.id; });
    setPublishedWeeks(parseSetting(allSettings, "published_weeks", []));
    applyDailyData({ dateString, templateRowsData, allTemplatesData: freshTemplates, mokedOrderSettings, columnOrderSettings, dailyColumnsSettings, availabilitiesData, unavailabilitiesData });
    setDailyLoading(false);
  };

  const applyStaticData = ({ colTypesSettings, allTemplatesData, shiftStatusesSettings, workerRolesSettings, tasksSettings, taskQualSettings, openRegSettings, workersData }) => {
    if (colTypesSettings.length > 0) {
      const customParams = JSON.parse(colTypesSettings[0].setting_value) || [];
      setColumnTypes(customParams.map(c => c.name));
      const byId = {};
      customParams.forEach(c => { if (c.mapping_id) byId[c.mapping_id] = c; });
      setScheduleColumnsById(byId);
      const subTypesMap = {};
      const freeTextMap = {};
      customParams.forEach(c => {
        const allOpts = [];
        if (c.options && c.options.length > 0) allOpts.push(...c.options);
        if (c.sub_options && c.sub_options.length > 0) allOpts.push(...c.sub_options.map(so => so.name));
        if (c.quantitative_items && c.quantitative_items.length > 0) allOpts.push(...c.quantitative_items);
        const keys = [c.name];
        if (c.mapping_id) keys.push(c.mapping_id);
        keys.forEach(k => {
          if (allOpts.length > 0) subTypesMap[k] = allOpts;
          if (c.free_text) freeTextMap[k] = true;
        });
      });
      const quantMap = {};
      customParams.forEach(c => {
        if (c.report_type === 'count_quantitative') {
          quantMap[c.name] = true;
          if (c.mapping_id) quantMap[c.mapping_id] = true;
        }
      });
      setColumnQuantitative(quantMap);
      setColumnSubTypes(subTypesMap);
      setColumnFreeText(freeTextMap);
    }
    if (shiftStatusesSettings.length > 0) setShiftStatuses(JSON.parse(shiftStatusesSettings[0].setting_value) || []);
    if (workerRolesSettings.length > 0) setWorkerRoles(JSON.parse(workerRolesSettings[0].setting_value) || []);
    const parsedTaskQual = taskQualSettings.length > 0 ? (JSON.parse(taskQualSettings[0].setting_value) || {}) : {};
    if (taskQualSettings.length > 0) setTaskQualifications(parsedTaskQual);
    if (tasksSettings.length > 0) {
      const rawTasksList = JSON.parse(tasksSettings[0].setting_value) || [];
      setTasksList(rawTasksList.map(t => typeof t === 'string' ? t : t.name));
    } else {
      setTasksList(Object.keys(parsedTaskQual));
    }
    if (openRegSettings.length > 0) {
      openRegSettingIdRef.current = openRegSettings[0].id;
      setOpenRegistrations(JSON.parse(openRegSettings[0].setting_value) || []);
    }
    setAllTemplates(allTemplatesData);
    setWorkers(workersData);
  };

  const applyDailyData = ({ dateString, templateRowsData, allTemplatesData, mokedOrderSettings, columnOrderSettings, dailyColumnsSettings, availabilitiesData, unavailabilitiesData }) => {
    if (!mokedOrderSavingRef.current) {
      if (mokedOrderSettings.length > 0) setMokedOrder(JSON.parse(mokedOrderSettings[0].setting_value) || []);
      else setMokedOrder([]);
    }
    if (columnOrderSettings.length > 0) {
      columnOrderSettingIdRef.current = columnOrderSettings[0].id;
      setCustomColumnOrders(JSON.parse(columnOrderSettings[0].setting_value) || {});
    } else {
      columnOrderSettingIdRef.current = null;
      setCustomColumnOrders({});
    }
    if (dailyColumnsSettings.length > 0) setDailyCustomColumns(JSON.parse(dailyColumnsSettings[0].setting_value) || {});
    else setDailyCustomColumns({});
    if (availabilitiesData) setAvailabilities(availabilitiesData);
    setUnavailabilities(unavailabilitiesData);
    const processRows = (rows) => {
      setTemplateRows(rows);
      const uniqueTemplateIds = [...new Set(rows.map((row) => row.template_id))];
      setTemplates(allTemplatesData.filter((t) => uniqueTemplateIds.includes(t.id)));
    };
    if (templateRowsData.length === 0) {
      const defaultTemplates = allTemplatesData.filter((t) => t.is_default && t.active && isVisibleScheduleTemplate(t));
      if (defaultTemplates.length > 0) {
        (async () => {
          for (const template of defaultTemplates) {
            const groupId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            const rowsToCreate = template.default_rows && template.default_rows.length > 0 ? template.default_rows : [{}];
            for (const rowValues of rowsToCreate) {
              const { moked_instance_name, moked_instance_name_locked, ...cleanRowValues } = rowValues;
              await base44.entities.TemplateRow.create({
                template_id: template.id,
                template_name: template.name,
                date: dateString,
                values: cleanRowValues,
                group_id: groupId
              });
            }
          }
          const updatedRows = await base44.entities.TemplateRow.filter({ date: dateString });
          processRows(updatedRows);
        })();
      } else {
        processRows([]);
      }
    } else {
      processRows(templateRowsData);
    }
  };

  const loadData = async () => {
    await loadDailyData(false);
  };

  const loadDailyDataRef = useRef(loadDailyData);
  useEffect(() => { loadDailyDataRef.current = loadDailyData; });

  useEffect(() => {
    const unsubTemplates = base44.entities.Template.subscribe(() => {
      if (staticDataLoaded.current) { softInvalidateStaticCache(); loadDailyDataRef.current(false); }
    });
    const unsubSettings = base44.entities.AppSettings.subscribe(() => {
      if (staticDataLoaded.current) { softInvalidateStaticCache(); loadDailyDataRef.current(false); }
    });
    return () => { unsubTemplates(); unsubSettings(); };
  }, []);

  const dateString = format(currentDate, "yyyy-MM-dd");

  const handleAddTemplateRowForTemplate = async (templateId, groupId) => {
    const template = allTemplates.find((t) => t.id === templateId);
    if (!template) return;
    const existingGroupRow = templateRows.find(r => r.template_id === templateId && (r.group_id || "default") === (groupId || "default"));
    const isLocked = existingGroupRow?.values?.moked_instance_name_locked === true;
    const newValues = isLocked
      ? { moked_instance_name: existingGroupRow.values.moked_instance_name, moked_instance_name_locked: true }
      : {};
    const newRow = await base44.entities.TemplateRow.create({
      template_id: templateId,
      template_name: template.name,
      date: dateString,
      values: newValues,
      group_id: groupId
    });
    setTemplateRows(prev => [...prev, newRow]);
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
    invalidateTemplatesCache();
    const newGroupId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `group_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const rowsToCreate = config.default_rows && config.default_rows.length > 0 ? config.default_rows : [{}];
    const createdRows = await Promise.all(
      rowsToCreate.map((rowValues, i) => {
        const { moked_instance_name, moked_instance_name_locked, ...cleanRowValues } = rowValues;
        cleanRowValues._order = i;
        return base44.entities.TemplateRow.create({
          template_id: newTemplate.id,
          template_name: newTemplate.name,
          date: dateString,
          values: cleanRowValues,
          group_id: newGroupId
        });
      })
    );
    setAllTemplates(prev => [...prev, newTemplate]);
    setTemplates(prev => [...prev, newTemplate]);
    setTemplateRows(prev => [...prev, ...createdRows]);
    toast.success(`מוקד "${preset.name}" נוסף ללוח`);
  };

  const handleDuplicateMoked = async (group) => {
    const originalGroupId = group.group_id;
    const newGroupId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `group_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const sourceRows = [...group.rows].sort((a, b) => {
      const aO = a.values?._order ?? new Date(a.created_date || 0).getTime();
      const bO = b.values?._order ?? new Date(b.created_date || 0).getTime();
      return aO - bO;
    });
    const createdRows = [];
    for (let index = 0; index < sourceRows.length; index++) {
      const row = sourceRows[index];
      const clonedValues = JSON.parse(JSON.stringify(row.values || {}));
      delete clonedValues._row_id;
      delete clonedValues._source_row_id;
      delete clonedValues._created_from_row_id;
      delete clonedValues._original_row_id;
      delete clonedValues.original_row_id;
      delete clonedValues.parent_row_id;
      delete clonedValues.continuation_source_row_id;
      delete clonedValues.continuation_from_date;
      delete clonedValues.is_continuation;
      delete clonedValues.moked_instance_name;
      delete clonedValues.moked_instance_name_locked;
      clonedValues._order = index;
      clonedValues._duplicated_from_row_id = row.id;
      const created = await base44.entities.TemplateRow.create({
        template_id: row.template_id,
        template_name: row.template_name,
        date: row.date || dateString,
        group_id: newGroupId,
        values: clonedValues
      });
      createdRows.push(created);
    }
    setTemplateRows(prev => [...prev, ...createdRows]);
    setTemplates(prev => {
      const template = allTemplates.find(t => t.id === group.template_id);
      if (template && !prev.find(t => t.id === template.id)) return [...prev, template];
      return prev;
    });
    toast.success('מוקד שוכפל בהצלחה');
  };

  const handleTimeSaved = async (row, newValues) => {
    const endTime = newValues["סיום"] || newValues["שעת סיום"] || "";
    if (!endTime.startsWith("+")) return;
    const plusMatch = endTime.match(/^(\+(\d+))\s+(\d{2}):(\d{2})$/);
    if (!plusMatch) return;
    const daysAhead = parseInt(plusMatch[2]);
    const realEndTime = `${plusMatch[3]}:${plusMatch[4]}`;
    if (daysAhead === 1 && realEndTime <= "06:00") return;
    for (let d = 1; d <= daysAhead; d++) {
      const futureDate = format(addDays(currentDate, d), "yyyy-MM-dd");
      const existingRows = await base44.entities.TemplateRow.filter({ date: futureDate });
      const alreadyExists = existingRows.some((r) => r.values?.continuation_source_row_id === row.id);
      if (alreadyExists) continue;
      const template = allTemplates.find((t) => t.id === row.template_id);
      const isLastDay = d === daysAhead;
      const continuationStart = "06:00";
      const continuationEnd = isLastDay ? realEndTime : "06:00";
      if (continuationStart === continuationEnd) continue;
      const continuationValues = {
        ...newValues,
        "התחלה": continuationStart,
        "שעת התחלה": continuationStart,
        "סיום": continuationEnd,
        "שעת סיום": continuationEnd,
        is_continuation: true,
        continuation_from_date: dateString
      };
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
      setTemplateRows(templateRows.filter(r => r.id !== rowId));
    }
  };

  const saveMokedName = async (templateId, groupId, name) => {
    if (!name.trim()) {
      setEditingMokedName(null);
      setEditingMokedNameValue("");
      return;
    }
    const trimmed = name.trim();
    const groupRows = templateRows.filter(r => r.template_id === templateId && (r.group_id || "default") === (groupId || "default"));
    await Promise.all(groupRows.map(r =>
      base44.entities.TemplateRow.update(r.id, {
        values: { ...r.values, moked_instance_name: trimmed, moked_instance_name_locked: true }
      })
    ));
    setTemplateRows(prev => prev.map(r =>
      r.template_id === templateId && (r.group_id || "default") === (groupId || "default")
        ? { ...r, values: { ...r.values, moked_instance_name: trimmed, moked_instance_name_locked: true } }
        : r
    ));
    setEditingMokedName(null);
    setEditingMokedNameValue("");
  };

  const saveColumnOrder = (templateId, newOrderedColumns) => {
    const newCustomOrders = { ...customColumnOrders, [templateId]: newOrderedColumns.map((c) => c.name) };
    setCustomColumnOrders(newCustomOrders);
    if (columnOrderSaveTimer.current) clearTimeout(columnOrderSaveTimer.current);
    columnOrderSaveTimer.current = setTimeout(async () => {
      const key = `schedule_column_order_${dateString}`;
      const data = { setting_key: key, setting_value: JSON.stringify(newCustomOrders) };
      if (columnOrderSettingIdRef.current) {
        await base44.entities.AppSettings.update(columnOrderSettingIdRef.current, data);
      } else {
        const settings = await base44.entities.AppSettings.filter({ setting_key: key });
        if (settings.length > 0) {
          columnOrderSettingIdRef.current = settings[0].id;
          await base44.entities.AppSettings.update(settings[0].id, data);
        } else {
          const created = await base44.entities.AppSettings.create(data);
          columnOrderSettingIdRef.current = created.id;
        }
        invalidateSettingsCache();
      }
    }, 500);
  };

  const saveMokedOrder = async (newOrder) => {
    mokedOrderSavingRef.current = true;
    setMokedOrder(newOrder);
    const key = `moked_order_${dateString}`;
    const data = { setting_key: key, setting_value: JSON.stringify(newOrder) };
    invalidateSettingsCache();
    const cachedId = appSettingsIdCache.current[key];
    if (cachedId) {
      await base44.entities.AppSettings.update(cachedId, data);
    } else {
      const created = await base44.entities.AppSettings.create(data);
      appSettingsIdCache.current[key] = created.id;
    }
    mokedOrderSavingRef.current = false;
  };

  const weekStartStrForPublish = format(startOfWeek(currentDate, { weekStartsOn: 0 }), "yyyy-MM-dd");
  const isCurrentWeekPublished = publishedWeeks.includes(weekStartStrForPublish);

  const handleTogglePublish = async () => {
    setTogglingPublish(true);
    try {
      const next = !isCurrentWeekPublished;
      const weeks = await toggleWeekPublished(base44.entities, weekStartStrForPublish, next);
      setPublishedWeeks(weeks);
    } catch (e) {
      console.error("toggle publish failed:", e);
      alert("שגיאה בעדכון פרסום המשמרות. נסה שוב.");
    } finally {
      setTogglingPublish(false);
    }
  };

  const groupedMokeds = useMemo(() => {
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
      rows: rows.sort((a, b) => {
        const aO = a.values?._order ?? new Date(a.created_date).getTime();
        const bO = b.values?._order ?? new Date(b.created_date).getTime();
        return aO - bO;
      })
    }));
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
      return isVisibleScheduleTemplate(template);
    });
  }, [templateRows, mokedOrder, allTemplates]);

  const workerDayAssignments = useMemo(() => {
    const map = new Map();
    templateRows.forEach(row => {
      const tmpl = allTemplates.find(t => t.id === row.template_id);
      if (!tmpl) return;
      const startTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"];
      const endTime   = row.values?.["סיום"]   || row.values?.["שעת סיום"];
      if (!startTime || !endTime) return;
      const allCols = [
        ...(tmpl.columns || []),
        ...(dailyCustomColumns[row.template_id] || [])
      ];
      allCols.forEach(col => {
        if (col.type !== "worker") return;
        const workerId = row.values?.[col.name];
        if (!workerId) return;
        if (!map.has(workerId)) map.set(workerId, []);
        map.get(workerId).push({ rowId: row.id, columnName: col.name, startTime, endTime });
      });
    });
    return map;
  }, [templateRows, allTemplates, dailyCustomColumns]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8 flex items-center justify-center">
        <div className="text-gray-600" dir="rtl">טוען...</div>
      </div>
    );
  }

  const isDailyLoading = dailyLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b bg-white pb-0">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap" dir="rtl">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl">לוח</CardTitle>
                  {isDailyLoading && <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin" />}
                </div>
                <div className="flex items-center gap-1 mr-auto">
                  <Button variant="outline" onClick={() => setCurrentDate(new Date())} size="sm" dir="rtl">היום</Button>
                  <Button
                    variant="outline" size="icon"
                    onClick={handleTogglePublish}
                    disabled={togglingPublish}
                    title={isCurrentWeekPublished
                      ? "העובדים רואים את משמרות השבוע — לחץ כדי להסתיר"
                      : "המשמרות מוסתרות מהעובדים — לחץ כדי לפרסם"}
                    className={isCurrentWeekPublished ? "text-green-600" : "text-gray-400"}
                  >
                    {togglingPublish
                      ? <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                      : isCurrentWeekPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 7))}><ChevronRight className="w-4 h-4" /></Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="px-3 py-2 bg-blue-900 text-white rounded-lg font-semibold min-w-[150px] text-center cursor-pointer hover:bg-blue-800 transition-colors text-sm" dir="rtl">
                        {(() => {
                          const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
                          return `שבוע ${getCustomWeekNumber(ws)}`;
                        })()}
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={currentDate}
                        onSelect={(date) => date && setCurrentDate(date)}
                        disabled={(date) => false}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronLeft className="w-4 h-4" /></Button>
                </div>
                {editMode && (
                  <>
                    {templateRows.length > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="destructive" size="icon" onClick={async () => {
                              if (confirm(`האם למחוק את כל ${templateRows.length} השורות מכל הקטגוריות?`)) {
                                setTemplateRows([]);
                                setTemplates([]);
                                await Promise.all(templateRows.map(row => base44.entities.TemplateRow.delete(row.id)));
                              }
                            }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent dir="rtl">מחק את כל המוקדים</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowPresetsDialog(true)} dir="rtl">
                      <Plus className="w-4 h-4 ml-1" />הוסף מוקד
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={() => setEditMode(false)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent dir="rtl">צא ממצב עריכה</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}
                {!editMode && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => setEditMode(true)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent dir="rtl">מצב עריכה</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              {(() => {
                const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
                return (
                  <div className="flex gap-1 pb-2" dir="rtl">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const day = addDays(weekStart, i);
                      const dayStr = format(day, "yyyy-MM-dd");
                      const todayStr = format(new Date(), "yyyy-MM-dd");
                      const isSelected = dayStr === dateString;
                      const isToday = dayStr === todayStr;
                      const hebDate = getHebrewDate(day);
                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentDate(day)}
                          className={`flex flex-col items-center px-2 py-1.5 rounded-lg text-xs transition-all duration-150 flex-1 ${
                            isSelected
                              ? "bg-blue-900 text-white font-semibold"
                              : isToday
                              ? "bg-blue-100 text-blue-900 font-semibold hover:bg-blue-200"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          <span className="font-medium text-[12px] leading-tight">{HEBREW_DAYS[day.getDay()]}</span>
                          <span className={`text-[9px] leading-tight flex gap-0.5 items-center ${isSelected ? "text-blue-200" : "text-gray-400"}`}>
                            <span>{format(day, "d.M")}</span>
                            <span className="opacity-50">|</span>
                            <span className="truncate max-w-[52px]">{hebDate.dayHeb} {hebDate.monthHeb}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </CardHeader>
        </Card>

        {templates.length === 0 && templateRows.length === 0 ? (
          <Card className="border-none shadow-lg">
            <CardContent className="py-16 text-center" dir="rtl">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">אין מוקדים ליום זה</h3>
              <p className="text-gray-600">לחץ על "מצב עריכה" ואז "צור מוקד חדש" להתחיל.</p>
            </CardContent>
          </Card>
        ) : (
          <DragDropContext onDragEnd={(result) => {
            if (!result.destination || !editMode) return;
            const newOrder = groupedMokeds.map(g => g.key);
            const [removed] = newOrder.splice(result.source.index, 1);
            newOrder.splice(result.destination.index, 0, removed);
            saveMokedOrder(newOrder);
          }}>
            <Droppable droppableId="moked-list">
              {(provided) => (
                <div className="space-y-4" ref={provided.innerRef} {...provided.droppableProps}>
                  {groupedMokeds.map((group, groupIndex) => {
                const template = allTemplates.find((t) => t.id === group.template_id);
                if (!template) return null;
                const templateRowsForTemplate = group.rows;

                const dailyColumns = dailyCustomColumns[template.id] || [];
                const allColumns = [...(template.columns || []), ...dailyColumns];
                const customOrder = customColumnOrders[template.id];
                const orderedColumns = customOrder
                  ? [
                      ...customOrder.map((name) => allColumns.find((col) => col.name === name)).filter(Boolean),
                      ...allColumns.filter((col) => !customOrder.includes(col.name))
                    ]
                  : allColumns;

                const resolveColName = (col) =>
                  (col.column_id && scheduleColumnsById[col.column_id]?.name) || col.name;

                return (
                  <Draggable key={group.key} draggableId={group.key} index={groupIndex} isDragDisabled={!editMode}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.draggableProps} className={snapshot.isDragging ? "opacity-70" : ""}>
                  <Card className="border-none shadow-lg overflow-hidden">
                    <CardHeader className="text-black py-3" style={{ background: `linear-gradient(to left, ${template.color || '#3b82f6'}, ${template.color || '#3b82f6'}dd)` }}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {editMode && (
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1">
                              <GripVertical className="w-5 h-5 text-black/60" />
                            </div>
                          )}
                          {group.rows.some((r) => r.values?.is_continuation) && (
                            <span className="text-[10px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded font-normal" dir="rtl">
                              המשך מ-{group.rows.find((r) => r.values?.continuation_from_date)?.values?.continuation_from_date || "יום קודם"}
                            </span>
                          )}
                          {editingMokedName === `${group.key}` ? (
                            <Input
                              value={editingMokedNameValue}
                              onChange={(e) => setEditingMokedNameValue(e.target.value)}
                              onBlur={() => saveMokedName(template.id, group.group_id, editingMokedNameValue)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveMokedName(template.id, group.group_id, editingMokedNameValue);
                                else if (e.key === 'Escape') { setEditingMokedName(null); setEditingMokedNameValue(""); }
                              }}
                              autoFocus
                              className="text-lg font-bold h-8 w-64 bg-white/20 border-white text-black"
                              dir="rtl" />
                          ) : (
                            <CardTitle
                            className="text-slate-50 text-lg font-semibold tracking-tight cursor-pointer hover:underline flex items-center gap-2"
                            onClick={() => {
                              const canonicalName = getMokedDisplayName(group.rows[0], template);
                              setEditingMokedName(`${group.key}`);
                              setEditingMokedNameValue(canonicalName);
                            }}
                            dir="rtl">
                            {getMokedDisplayName(group.rows[0], template)}
                            <Pencil className="w-3 h-3 opacity-60" />
                            </CardTitle>
                          )}
                        </div>
                        {editMode && (
                          <div className="flex gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="destructive" className="h-7 w-7"
                                    onClick={async () => {
                                      if (confirm(`האם למחוק את המוקד "${template.name}" מהלוח?`)) {
                                        const rowIdsToDelete = templateRowsForTemplate.map(r => r.id);
                                        setTemplateRows(prev => prev.filter(r => !rowIdsToDelete.includes(r.id)));
                                        const updatedRegs = openRegistrations.filter(r => r && r.key !== group.key);
                                        if (updatedRegs.length !== openRegistrations.length) {
                                          setOpenRegistrations(updatedRegs);
                                        }
                                        await Promise.all(templateRowsForTemplate.map(row => base44.entities.TemplateRow.delete(row.id)));
                                        if (updatedRegs.length !== openRegistrations.length) {
                                          const regSettings = await base44.entities.AppSettings.filter({ setting_key: "open_registrations" });
                                          const regData = { setting_key: "open_registrations", setting_value: JSON.stringify(updatedRegs) };
                                          if (regSettings.length > 0) await base44.entities.AppSettings.update(regSettings[0].id, regData);
                                          else await base44.entities.AppSettings.create(regData);
                                        }
                                      }
                                    }}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent dir="rtl">מחק מוקד</TooltipContent>
                              </Tooltip>
                              {(() => {
                                const isOpen = openRegistrations.some((r) => r && r.key === group.key);
                                return (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        className={`h-7 w-7 ${isOpen ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                                        onClick={async () => {
                                          let updated;
                                          if (isOpen) {
                                            updated = openRegistrations.filter((r) => r && r.key !== group.key);
                                          } else {
                                            const rowShifts = templateRowsForTemplate
                                              .map((row) => ({
                                                start_time: row.values?.["התחלה"] || row.values?.["שעת התחלה"] || null,
                                                end_time: row.values?.["סיום"] || row.values?.["שעת סיום"] || null
                                              }))
                                              .filter((s) => s.start_time && s.end_time);
                                            const entry = { key: group.key, name: template.name, date: dateString, shifts: rowShifts.length > 0 ? rowShifts : [] };
                                            updated = [...openRegistrations, entry];
                                          }
                                          setOpenRegistrations(updated);
                                          const regData = { setting_key: "open_registrations", setting_value: JSON.stringify(updated) };
                                          if (openRegSettingIdRef.current) {
                                           await base44.entities.AppSettings.update(openRegSettingIdRef.current, regData);
                                          } else {
                                           const created = await base44.entities.AppSettings.create(regData);
                                           openRegSettingIdRef.current = created.id;
                                          }
                                          invalidateSettingsCache();
                                          toast.success(!isOpen ? `הרשמה לـ"${template.name}" נפתחה` : `הרשמה לـ"${template.name}" נסגרה`);
                                        }}>
                                        <UserCheck className="w-3 h-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent dir="rtl">{isOpen ? "הרשמה פתוחה" : "אפשר הרשמה"}</TooltipContent>
                                  </Tooltip>
                                );
                              })()}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleDuplicateMoked(group)}>
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent dir="rtl">שכפל מוקד</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <DraggableColumnHeader
                            groupKey={group.key}
                            orderedColumns={orderedColumns}
                            editMode={editMode}
                            templateId={template.id}
                            scheduleColumnsById={scheduleColumnsById}
                            onReorder={async (newCols) => { await saveColumnOrder(template.id, newCols); }}
                            onDeleteColumn={async (col) => {
                              if (confirm(`האם למחוק את העמודה "${col.name}"?`)) {
                                const isDailyColumn = (dailyCustomColumns[template.id] || []).some((c) => c.name === col.name);
                                if (isDailyColumn) {
                                const updatedDailyColumns = { ...dailyCustomColumns, [template.id]: (dailyCustomColumns[template.id] || []).filter((c) => c.name !== col.name) };
                                setDailyCustomColumns(updatedDailyColumns);
                                const dcKey = `schedule_daily_columns_${dateString}`;
                                const data = { setting_key: dcKey, setting_value: JSON.stringify(updatedDailyColumns) };
                                const cachedDcId = appSettingsIdCache.current[dcKey];
                                if (cachedDcId) await base44.entities.AppSettings.update(cachedDcId, data);
                                invalidateSettingsCache();
                                } else {
                                  const updatedColumns = template.columns.filter((c) => c.name !== col.name);
                                  setAllTemplates(prev => prev.map(t => t.id === template.id ? { ...t, columns: updatedColumns } : t));
                                  setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, columns: updatedColumns } : t));
                                  await base44.entities.Template.update(template.id, { columns: updatedColumns });
                                }
                              }
                            }}
                            onAddColumn={() => { setSelectedTemplate(template); setShowAddTemplateColumnDialog(true); }}
                          />
                        </TableHeader>
                          <TableBody>
                            {templateRowsForTemplate.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={orderedColumns.length + 3} className="text-center text-gray-500 py-8" dir="rtl">
                                  אין שורות. לחץ "הוסף שורה" להוספה.
                                </TableCell>
                              </TableRow>
                            ) : (() => {
                              const getCellKey = (row, colName) => {
                                const v = row.values?.[colName] || "";
                                const subs = (row.values?.[`${colName}_subTypes`] || []).join(",");
                                return v || subs;
                              };
                              const spanMap = {};
                              orderedColumns.forEach((col, colIdx) => {
                                let i = 0;
                                while (i < templateRowsForTemplate.length) {
                                  const val = getCellKey(templateRowsForTemplate[i], col.name);
                                  if (val && !editMode) {
                                    let span = 1;
                                    while (
                                      i + span < templateRowsForTemplate.length &&
                                      getCellKey(templateRowsForTemplate[i + span], col.name) === val
                                    ) { span++; }
                                    spanMap[`${i}_${colIdx}`] = span;
                                    for (let k = 1; k < span; k++) spanMap[`${i+k}_${colIdx}`] = 0;
                                    i += span;
                                  } else {
                                    spanMap[`${i}_${colIdx}`] = 1;
                                    i++;
                                  }
                                }
                              });
                              return templateRowsForTemplate.map((row, rowIndex) => (
                                <TableRow key={row.id} className={`h-8 ${row.values?.is_continuation ? "bg-orange-50" : ""}`}>
                                  {editMode && (
                                    <TableCell className="w-[60px] p-0">
                                      <div className="flex flex-col gap-0 items-center">
                                       <Button size="icon" variant="ghost" className="h-4 w-4" disabled={rowIndex === 0}
                                         onClick={async () => {
                                           const rows = [...templateRowsForTemplate];
                                           const a = rows[rowIndex];
                                           const b = rows[rowIndex - 1];
                                           const aOrder = a.values?._order ?? rowIndex;
                                           const bOrder = b.values?._order ?? (rowIndex - 1);
                                           await base44.entities.TemplateRow.update(a.id, { values: { ...a.values, _order: bOrder } });
                                           await base44.entities.TemplateRow.update(b.id, { values: { ...b.values, _order: aOrder } });
                                           loadData();
                                         }}>
                                         <ChevronUp className="w-3 h-3" />
                                       </Button>
                                       <Button size="icon" variant="ghost" className="h-4 w-4" disabled={rowIndex === templateRowsForTemplate.length - 1}
                                         onClick={async () => {
                                           const rows = [...templateRowsForTemplate];
                                           const a = rows[rowIndex];
                                           const b = rows[rowIndex + 1];
                                           const aOrder = a.values?._order ?? rowIndex;
                                           const bOrder = b.values?._order ?? (rowIndex + 1);
                                           await base44.entities.TemplateRow.update(a.id, { values: { ...a.values, _order: bOrder } });
                                           await base44.entities.TemplateRow.update(b.id, { values: { ...b.values, _order: aOrder } });
                                           loadData();
                                         }}>
                                         <ChevronDown className="w-3 h-3" />
                                       </Button>
                                      </div>
                                    </TableCell>
                                  )}
                                  {orderedColumns.map((col, idx) => {
                                    const spanKey = `${rowIndex}_${idx}`;
                                    const span = spanMap[spanKey] ?? 1;
                                    if (span === 0) return null;
                                     return (
                                       <TableCell key={idx} dir="rtl" className="p-0 text-center" rowSpan={span > 1 ? span : undefined} style={span > 1 ? { verticalAlign: 'top', height: `${span * 32}px` } : {}}>
                                        {col.type === "worker" ? (
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
                                            taskQualifiedWorkerIds={col.task_name ? Object.values(taskQualifications[col.task_name] || {}).flat() : (row.values?.task ? Object.values(taskQualifications[row.values.task] || {}).flat() : undefined)}
                                            workerDayAssignments={workerDayAssignments}
                                            onSaved={(workerId) => {
                                            const newValues = { ...row.values, [col.name]: workerId };
                                            setTemplateRows((prev) => prev.map((r) => r.id === row.id ? { ...r, values: newValues } : r));
                                            }} />
                                        ) : col.type === "time" ? (
                                          <TimeCell
                                            rowId={row.id}
                                            colName={col.name}
                                            value={row.values?.[col.name] || ""}
                                            defaultValue={col.default_value || ""}
                                            onSaved={(newValues) => {
                                            setTemplateRows((prev) => prev.map((r) => r.id === row.id ? { ...r, values: newValues } : r));
                                             handleTimeSaved(row, newValues);
                                            }}
                                            rowValues={row.values || {}} />
                                        ) : col.type === 'task' ? (
                                          <Select
                                            value={row.values?.task || ""}
                                            onValueChange={async (value) => {
                                              const newValues = { ...row.values, task: value };
                                              await base44.entities.TemplateRow.update(row.id, { values: newValues });
                                              setTemplateRows((prev) => prev.map((r) => r.id === row.id ? { ...r, values: newValues } : r));
                                            }}>
                                            <SelectTrigger className="h-full border-0 rounded-none text-xs justify-center">
                                              <SelectValue placeholder="-" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value={null}>ללא</SelectItem>
                                              {tasksList.map((t) => { const name = typeof t === 'string' ? t : t.name; return <SelectItem key={name} value={name}>{name}</SelectItem>; })}
                                            </SelectContent>
                                          </Select>
                                        ) : ((columnSubTypes[resolveColName(col)] || columnSubTypes[col.name] || []).length > 0 || columnFreeText[resolveColName(col)] || columnFreeText[col.name]) ? (
                                          <ColumnCell
                                            assignmentId={row.id}
                                            colType={col.name}
                                            columnValues={row.values || {}}
                                            availableSubTypes={columnSubTypes[resolveColName(col)] || columnSubTypes[col.name] || []}
                                            freeText={!!(columnFreeText[resolveColName(col)] || columnFreeText[col.name])}
                                            isTemplateRow={true}
                                            isQuantitative={!!(columnQuantitative[resolveColName(col)] || columnQuantitative[col.name])}
                                            onSaved={(updatedColumnValues) => {
                                            const newValues = { ...row.values, ...updatedColumnValues };
                                            base44.entities.TemplateRow.update(row.id, { values: newValues });
                                             setTemplateRows((prev) => prev.map((r) => r.id === row.id ? { ...r, values: newValues } : r));
                                            }} />
                                        ) : (
                                          <div className="px-2 py-1 text-sm text-center">{row.values?.[col.name] || ''}</div>
                                        )}
                                      </TableCell>
                                    );
                                  })}
                                  <TableCell className="p-0 text-center">
                                    <Select
                                      value={row.values?.status || ""}
                                      onValueChange={async (value) => {
                                        const newValues = { ...row.values, status: value };
                                        try {
                                          await base44.entities.TemplateRow.update(row.id, { values: newValues });
                                          setTemplateRows((prev) => prev.map((r) => r.id === row.id ? { ...r, values: newValues } : r));
                                        } catch {
                                          await loadData();
                                        }
                                      }}>
                                      <SelectTrigger className="h-full border-0 rounded-none text-xs justify-center">
                                        <SelectValue placeholder="-" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value={null}>ללא</SelectItem>
                                        {shiftStatuses.map((s) => {
                                          const label = typeof s === 'string' ? s : (s?.name || '');
                                          return <SelectItem key={label} value={label}>{label}</SelectItem>;
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  {editMode && (
                                    <TableCell className="p-0">
                                      <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500 hover:text-red-700" onClick={() => handleDeleteTemplateRow(row.id)}>
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </TableCell>
                                  )}
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                      {editMode && (
                        <div className="flex items-center gap-1 px-3 py-1 border-t border-gray-100 bg-gray-50/50">
                          <button
                            onClick={() => handleAddTemplateRowForTemplate(template.id, group.group_id)}
                            className="flex items-center gap-1 px-3 py-1 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
                            dir="rtl">
                            <Plus className="w-3 h-3" />שורה חדשה
                          </button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                      </div>
                    )}
                  </Draggable>
                );
              })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}

        <PresetsDialog
          open={showPresetsDialog}
          onOpenChange={setShowPresetsDialog}
          onAddPreset={handleAddPresetToSchedule} />

        <Dialog open={showAddTemplateColumnDialog} onOpenChange={setShowAddTemplateColumnDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle dir="rtl">הוסף עמודה ל{selectedTemplate?.name}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label dir="rtl">בחר סוג עמודה</Label>
                <Select value={newTemplateColumnName} onValueChange={(val) => { setNewTemplateColumnName(val); setNewTemplateColumnType(""); setNewTemplateColumnRole(""); }}>
                  <SelectTrigger><SelectValue placeholder="בחר מסוגי העמודות..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="briefing">תדריך</SelectItem>
                    <SelectItem value="time">זמן התחלה</SelectItem>
                    <SelectItem value="time_end">זמן סיום</SelectItem>
                    {columnTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    <SelectItem value="worker_member">חבר צוות</SelectItem>
                    {tasksList.length > 0 && <SelectItem value="task">משימה</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              {newTemplateColumnName === "worker_member" && (
                <>
                  <div>
                    <Label dir="rtl">תפקיד</Label>
                    <Select value={newTemplateColumnRole} onValueChange={(val) => { setNewTemplateColumnRole(val); setNewTemplateColumnType(val); }}>
                      <SelectTrigger dir="rtl"><SelectValue placeholder="בחר תפקיד..." /></SelectTrigger>
                      <SelectContent>
                        {workerRoles.map((role, i) => {
                          const roleName = typeof role === "string" ? role : role.name;
                          return <SelectItem key={i} value={roleName}>{roleName}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  {newTemplateColumnRole && (
                    <div>
                      <Label dir="rtl">שם העמודה (אופציונלי)</Label>
                      <Input
                        value={newTemplateColumnType === newTemplateColumnRole ? "" : newTemplateColumnType}
                        onChange={(e) => setNewTemplateColumnType(e.target.value || newTemplateColumnRole)}
                        placeholder={newTemplateColumnRole}
                        dir="rtl" />
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddTemplateColumnDialog(false); setNewTemplateColumnName(""); setNewTemplateColumnType("text"); }} dir="rtl">ביטול</Button>
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
                  } else if (newTemplateColumnName === "task") {
                    columnToAdd = { name: "משימה", type: "task", width: 120 };
                  } else {
                    const settingsColEntry = Object.values(scheduleColumnsById).find(c => c.name === newTemplateColumnName);
                    columnToAdd = { name: newTemplateColumnName, type: "text", width: 120, ...(settingsColEntry?.mapping_id ? { column_id: settingsColEntry.mapping_id } : {}) };
                  }
                  const updatedDailyColumns = {
                    ...dailyCustomColumns,
                    [selectedTemplate.id]: [...(dailyCustomColumns[selectedTemplate.id] || []), columnToAdd]
                  };
                  setDailyCustomColumns(updatedDailyColumns);
                  const addColKey = `schedule_daily_columns_${dateString}`;
                  const addColData = { setting_key: addColKey, setting_value: JSON.stringify(updatedDailyColumns) };
                  const cachedAddColId = appSettingsIdCache.current[addColKey];
                  if (cachedAddColId) { await base44.entities.AppSettings.update(cachedAddColId, addColData); } else { const created = await base44.entities.AppSettings.create(addColData); appSettingsIdCache.current[addColKey] = created.id; }
                  invalidateSettingsCache();
                  setShowAddTemplateColumnDialog(false);
                  setNewTemplateColumnName("");
                  setNewTemplateColumnType("text");
                  setSelectedTemplate(null);
                  toast.success('עמודה נוספה בהצלחה');
                }}
                disabled={!newTemplateColumnName || (newTemplateColumnName === "worker_member" && !newTemplateColumnRole)}
                className="bg-blue-900 hover:bg-blue-800"
                dir="rtl">
                הוסף עמודה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}