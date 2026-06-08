import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Users, X, Plus, Columns, Settings as SettingsIcon, ClipboardList, Pencil, Check, Calendar, UserCog, Link, Wand2, AlertTriangle } from "lucide-react";
import MappingSettings from "@/components/settings/MappingSettings";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import { Badge } from "@/components/ui/badge";
import MappableItemRow, { normalizeItem, suggestMappingId } from "@/components/settings/MappableItemRow";
import { invalidateStaticCache, invalidateTemplatesCache } from "@/lib/appDataCache";


export default function Settings() {

  const [userRoles, setUserRoles] = useState({});
  const [workers, setWorkers] = useState([]);
  // Unified schedule columns
  const [scheduleColumns, setScheduleColumns] = useState([]);
  const [newColName, setNewColName] = useState("");
  const [newColReportType, setNewColReportType] = useState("sum_numbers");
  const [newColQuantPreset, setNewColQuantPreset] = useState("");
  const [newColOption, setNewColOption] = useState("");
  const [newSubOptionName, setNewSubOptionName] = useState("");
  const [newSubOptionCriterion, setNewSubOptionCriterion] = useState("");
  const [expandedSubOptions, setExpandedSubOptions] = useState(null);
  const [expandedCol, setExpandedCol] = useState(null);
  const [populations, setPopulations] = useState([]);
  const [newPopulation, setNewPopulation] = useState("");
  const [workerRoles, setWorkerRoles] = useState([]);
  const [newWorkerRole, setNewWorkerRole] = useState("");
  const [shiftStatuses, setShiftStatuses] = useState([]);
  const [newShiftStatus, setNewShiftStatus] = useState("");
  const [tasks, setTasks] = useState([]);
  const [newTaskName, setNewTaskName] = useState("");
  const [taskQualifications, setTaskQualifications] = useState({}); // { taskName: [workerId, ...] }
  const [expandedTask, setExpandedTask] = useState(null);
  const [newQuantItem, setNewQuantItem] = useState(""); // for new column quant item
  const [renamingQuantItem, setRenamingQuantItem] = useState(null); // { colIdx, itemIdx, value }
  const [renamingSubOption, setRenamingSubOption] = useState(null); // { colIdx, subIdx, field, value }
  const [renamingWorkerRole, setRenamingWorkerRole] = useState(null); // { idx, value }
  const [renamingShiftStatus, setRenamingShiftStatus] = useState(null); // { idx, value }
  const [renamingPopulation, setRenamingPopulation] = useState(null); // { idx, value }
  const [activeTab, setActiveTab] = useState("schedule");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadSettings();
    }
  }, []);

  const loadSettings = async () => {
    const allSettings = await base44.entities.AppSettings.list();
    await new Promise(r => setTimeout(r, 800));
    const workersData = await base44.entities.Worker.list();

    const getSetting = (key) => allSettings.find(s => s.setting_key === key);

    const rolesSettings = getSetting("user_roles") ? [getSetting("user_roles")] : [];
    const scheduleColsSettings = getSetting("custom_schedule_params") ? [getSetting("custom_schedule_params")] : [];
    const populationsSettings = getSetting("worker_populations") ? [getSetting("worker_populations")] : [];
    const workerRolesSettings = getSetting("worker_roles") ? [getSetting("worker_roles")] : [];
    const shiftStatusesSettings = getSetting("shift_statuses") ? [getSetting("shift_statuses")] : [];
    const tasksSettings = getSetting("tasks_list") ? [getSetting("tasks_list")] : [];
    const taskQualSettings = getSetting("task_qualifications") ? [getSetting("task_qualifications")] : [];
    

    if (rolesSettings.length > 0) setUserRoles(JSON.parse(rolesSettings[0].setting_value));
    let loadedCols = [];
    if (scheduleColsSettings.length > 0) {
      loadedCols = JSON.parse(scheduleColsSettings[0].setting_value) || [];
      // Part A: backfill missing mapping_ids on load
      let needsSave = false;
      const withIds = loadedCols.map(c => {
        if (!c.mapping_id) {
          needsSave = true;
          return { ...c, mapping_id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` };
        }
        return c;
      });
      if (needsSave) {
        const settings2 = await base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" });
        const d = { setting_key: "custom_schedule_params", setting_value: JSON.stringify(withIds) };
        if (settings2.length > 0) await base44.entities.AppSettings.update(settings2[0].id, d);
        else await base44.entities.AppSettings.create(d);
        loadedCols = withIds;
        invalidateStaticCache();
      }
      setScheduleColumns(loadedCols);
    }
    const rawPops = populationsSettings.length > 0
      ? (JSON.parse(populationsSettings[0].setting_value) || [])
      : ["מנהל", "קבוע בכיר", "קבוע", "קבלן בכיר", "קבלן", "קבלן מיוחד", "ותיק"];
    setPopulations(rawPops.map(normalizeItem));

    const rawRoles = workerRolesSettings.length > 0
      ? (JSON.parse(workerRolesSettings[0].setting_value) || [])
      : ["שף", "סו-שף"];
    setWorkerRoles(rawRoles.map(normalizeItem));

    const rawStatuses = shiftStatusesSettings.length > 0
      ? (JSON.parse(shiftStatusesSettings[0].setting_value) || [])
      : ["מתוכנן", "מאושר", "בוצע", "בוטל"];
    setShiftStatuses(rawStatuses.map(normalizeItem));
    if (tasksSettings.length > 0) setTasks(JSON.parse(tasksSettings[0].setting_value) || []);
    if (taskQualSettings.length > 0) setTaskQualifications(JSON.parse(taskQualSettings[0].setting_value) || {});
    setWorkers(workersData);
    setLoading(false);
  };



  const handleSaveRoles = async () => {
    setSaving(true);
    const settings = await base44.entities.AppSettings.filter({ setting_key: "user_roles" });
    const data = { setting_key: "user_roles", setting_value: JSON.stringify(userRoles) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setSaving(false);
  };

  const handleRoleChange = (email, role) => {
    if (!email) return;
    setUserRoles({ ...userRoles, [email]: role });
  };

  const saveScheduleColumns = async (updated) => {
    const settings = await base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" });
    const data = { setting_key: "custom_schedule_params", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setScheduleColumns(updated);
  };

  // Part B: backfill column_id on existing Template and MokedPreset columns (one-time maintenance)
  const [backfilling, setBackfilling] = useState(false);
  const handleBackfillColumnIds = async () => {
    setBackfilling(true);
    // Build name → mapping_id from current scheduleColumns
    const nameToId = {};
    scheduleColumns.forEach(c => { if (c.mapping_id) nameToId[c.name.trim()] = c.mapping_id; });

    const [templates, presets] = await Promise.all([
      base44.entities.Template.list(),
      base44.entities.MokedPreset.list(),
    ]);

    // Update Templates
    await Promise.all(
      templates
        .filter(t => (t.columns || []).some(c => !c.column_id && nameToId[c.name?.trim()]))
        .map(t => base44.entities.Template.update(t.id, {
          columns: t.columns.map(c =>
            (!c.column_id && nameToId[c.name?.trim()]) ? { ...c, column_id: nameToId[c.name.trim()] } : c
          )
        }))
    );

    // Update Presets
    await Promise.all(
      (presets || [])
        .filter(p => ((p.template_config?.columns) || []).some(c => !c.column_id && nameToId[c.name?.trim()]))
        .map(p => {
          const cfg = p.template_config || {};
          return base44.entities.MokedPreset.update(p.id, {
            template_config: {
              ...cfg,
              columns: (cfg.columns || []).map(c =>
                (!c.column_id && nameToId[c.name?.trim()]) ? { ...c, column_id: nameToId[c.name.trim()] } : c
              )
            }
          });
        })
    );

    invalidateStaticCache();
    invalidateTemplatesCache();
    setBackfilling(false);
    alert("גיבוי מזהי עמודות הושלם בהצלחה!");
  };

  // Rename a schedule column name globally — updates Templates, TemplateRows, and MokedPresets
  const handleRenameColumnName = async (idx, oldName, newName) => {
    if (!newName.trim() || newName.trim() === oldName) return;
    const trimmed = newName.trim();
    const match = (n) => typeof n === "string" && n.trim() === oldName.trim();

    // 1. Update custom_schedule_params setting
    const updated = scheduleColumns.map((c, i) => i === idx ? { ...c, name: trimmed } : c);
    await saveScheduleColumns(updated);

    // 2. Fetch everything in parallel
    const [allTemplatesData, allRows, allPresets] = await Promise.all([
      base44.entities.Template.list(),
      base44.entities.TemplateRow.list(),
      base44.entities.MokedPreset.list(),
    ]);

    // 3. Update Templates
    await Promise.all(
      allTemplatesData
        .filter(tmpl => tmpl.columns?.some(c => match(c.name)))
        .map(tmpl => {
          const updatedCols = tmpl.columns.map(c => match(c.name) ? { ...c, name: trimmed } : c);
          return base44.entities.Template.update(tmpl.id, { columns: updatedCols });
        })
    );

    // 4. Update TemplateRows value keys
    await Promise.all(
      allRows
        .filter(row => row.values && Object.keys(row.values).some(k => match(k)))
        .map(row => {
          const newValues = { ...row.values };
          for (const k of Object.keys(newValues)) {
            if (match(k)) { newValues[trimmed] = newValues[k]; delete newValues[k]; }
          }
          return base44.entities.TemplateRow.update(row.id, { values: newValues });
        })
    );

    // 5. Update MokedPreset: rename in template_config.columns AND default_rows value keys
    await Promise.all(
      (allPresets || [])
        .filter(p => {
          const cfg = p.template_config || {};
          return (cfg.columns || []).some(c => match(c.name)) ||
            (cfg.default_rows || []).some(r => r && Object.keys(r).some(k => match(k)));
        })
        .map(p => {
          const cfg = p.template_config || {};
          const updatedCols = (cfg.columns || []).map(c => match(c.name) ? { ...c, name: trimmed } : c);
          const updatedRows = (cfg.default_rows || []).map(r => {
            if (!r) return r;
            const nr = { ...r };
            for (const k of Object.keys(nr)) {
              if (match(k)) { nr[trimmed] = nr[k]; delete nr[k]; }
            }
            return nr;
          });
          return base44.entities.MokedPreset.update(p.id, {
            template_config: { ...cfg, columns: updatedCols, default_rows: updatedRows },
          });
        })
    );

    invalidateStaticCache();
    invalidateTemplatesCache();
  };

  const handleAddScheduleColumn = async () => {
    if (!newColName.trim()) return;
    const col = { name: newColName.trim(), mapping_id: `col_${Date.now()}`, report_type: newColReportType, options: [], quantitative_items: [] };
    const updated = [...scheduleColumns, col];
    await saveScheduleColumns(updated);
    setNewColName("");
    // Auto-expand the new column if quantitative
    if (newColReportType === "count_quantitative") setExpandedCol(updated.length - 1);
  };

  const handleAddQuantItem = async (colIdx, item) => {
    if (!item.trim()) return;
    const updated = scheduleColumns.map((c, i) =>
      i === colIdx ? { ...c, quantitative_items: [...(c.quantitative_items || []), item.trim()] } : c
    );
    await saveScheduleColumns(updated);
    setNewQuantItem("");
  };

  const handleRemoveQuantItem = async (colIdx, itemIdx) => {
    const updated = scheduleColumns.map((c, i) =>
      i === colIdx ? { ...c, quantitative_items: (c.quantitative_items || []).filter((_, ii) => ii !== itemIdx) } : c
    );
    await saveScheduleColumns(updated);
  };

  const handleRemoveScheduleColumn = async (idx) => {
    await saveScheduleColumns(scheduleColumns.filter((_, i) => i !== idx));
  };

  const handleAddOption = async (colIdx) => {
    if (!newColOption.trim()) return;
    const updated = scheduleColumns.map((c, i) => i === colIdx ? { ...c, options: [...(c.options || []), newColOption.trim()] } : c);
    await saveScheduleColumns(updated);
    setNewColOption("");
  };

  const handleRemoveOption = async (colIdx, opt) => {
    const updated = scheduleColumns.map((c, i) => i === colIdx ? { ...c, options: (c.options || []).filter(o => o !== opt) } : c);
    await saveScheduleColumns(updated);
  };

  const handleAddSubOption = async (colIdx) => {
    if (!newSubOptionName.trim()) return;
    const updated = scheduleColumns.map((c, i) =>
      i === colIdx ? { ...c, sub_options: [...(c.sub_options || []), { name: newSubOptionName.trim(), criterion: newSubOptionName.trim() }] } : c
    );
    await saveScheduleColumns(updated);
    setNewSubOptionName("");
  };

  const handleRemoveSubOption = async (colIdx, subIdx) => {
    const updated = scheduleColumns.map((c, i) =>
      i === colIdx ? { ...c, sub_options: (c.sub_options || []).filter((_, si) => si !== subIdx) } : c
    );
    await saveScheduleColumns(updated);
  };

  // Rename sub_option criterion globally — updates all Assignments and TemplateRows
  const handleRenameSubOptionCriterion = async (colIdx, subIdx, oldCriterion, newCriterion) => {
    if (!newCriterion.trim() || newCriterion.trim() === oldCriterion) return;
    const colName = scheduleColumns[colIdx].name;
    const trimmed = newCriterion.trim();

    // 1. Update the setting
    const updated = scheduleColumns.map((c, i) => i === colIdx ? {
      ...c,
      sub_options: (c.sub_options || []).map((s, j) => j === subIdx ? { ...s, criterion: trimmed } : s)
    } : c);
    await saveScheduleColumns(updated);

    // 2. Update Assignments
    const assignments = await base44.entities.Assignment.list();
    for (const a of assignments) {
      const val = a.column_values?.[colName];
      if (val === oldCriterion) {
        await base44.entities.Assignment.update(a.id, { column_values: { ...a.column_values, [colName]: trimmed } });
      }
    }

    // 3. Update TemplateRows
    const rows = await base44.entities.TemplateRow.list();
    for (const r of rows) {
      const val = r.values?.[colName];
      if (val === oldCriterion) {
        await base44.entities.TemplateRow.update(r.id, { values: { ...r.values, [colName]: trimmed } });
      }
    }
  };

  // Rename quant item globally — updates all Assignments and TemplateRows
  const handleRenameQuantItem = async (colIdx, itemIdx, oldName, newName) => {
    if (!newName.trim() || newName.trim() === oldName) return;
    const colName = scheduleColumns[colIdx].name;
    const trimmed = newName.trim();

    // 1. Update the setting
    const updated = scheduleColumns.map((c, i) => i === colIdx ? {
      ...c,
      quantitative_items: (c.quantitative_items || []).map((it, j) => j === itemIdx ? trimmed : it)
    } : c);
    await saveScheduleColumns(updated);

    // 2. Update all Assignments that have this column
    const assignments = await base44.entities.Assignment.list();
    for (const a of assignments) {
      const raw = a.column_values?.[colName];
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (oldName in parsed) {
          const renamed = {};
          for (const [k, v] of Object.entries(parsed)) {
            renamed[k === oldName ? trimmed : k] = v;
          }
          const newColVals = { ...a.column_values, [colName]: JSON.stringify(renamed) };
          await base44.entities.Assignment.update(a.id, { column_values: newColVals });
        }
      } catch {}
    }

    // 3. Update all TemplateRows that have this column
    const rows = await base44.entities.TemplateRow.list();
    for (const r of rows) {
      const raw = r.values?.[colName];
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (oldName in parsed) {
          const renamed = {};
          for (const [k, v] of Object.entries(parsed)) {
            renamed[k === oldName ? trimmed : k] = v;
          }
          const newVals = { ...r.values, [colName]: JSON.stringify(renamed) };
          await base44.entities.TemplateRow.update(r.id, { values: newVals });
        }
      } catch {}
    }
  };

  // Generic save for list settings
  const saveListSetting = async (key, updated) => {
    const settings = await base44.entities.AppSettings.filter({ setting_key: key });
    const data = { setting_key: key, setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
  };

  const handleAddPopulation = async () => {
    if (!newPopulation.trim()) return;
    const newItem = { name: newPopulation.trim(), mapping_id: "", export_name: "", is_importable: true, is_exportable: true };
    const updated = [...populations, newItem];
    await saveListSetting("worker_populations", updated);
    setPopulations(updated);
    setNewPopulation("");
  };

  const handleRemovePopulation = async (idx) => {
    const updated = populations.filter((_, i) => i !== idx);
    await saveListSetting("worker_populations", updated);
    setPopulations(updated);
  };

  const handleSavePopulation = async (idx, updatedItem) => {
    const oldName = normalizeItem(populations[idx]).name;
    const newName = updatedItem.name;
    const updated = populations.map((p, i) => i === idx ? updatedItem : p);
    await saveListSetting("worker_populations", updated);
    setPopulations(updated);

    // Propagate rename to Worker records and ChartWidget.filter_populations
    if (newName && newName !== oldName) {
      const [allWorkers, allCharts] = await Promise.all([
        base44.entities.Worker.list(),
        base44.entities.ChartWidget.list(),
      ]);
      await Promise.all(
        allWorkers
          .filter(w => w.population === oldName)
          .map(w => base44.entities.Worker.update(w.id, { population: newName }))
      );

      // ── Step 2: Update ChartWidget.filter_populations ─────────────────────────
      const chartsToUpdate = allCharts.filter(c =>
        (c.filter_populations || []).includes(oldName)
      );
      await Promise.all(chartsToUpdate.map(c =>
        base44.entities.ChartWidget.update(c.id, {
          filter_populations: (c.filter_populations || []).map(p => p === oldName ? newName : p)
        })
      ));

      invalidateStaticCache();
    }
  };

  const handleAddWorkerRole = async () => {
    if (!newWorkerRole.trim()) return;
    const newItem = { name: newWorkerRole.trim(), mapping_id: "", export_name: "", is_importable: true, is_exportable: true };
    const updated = [...workerRoles, newItem];
    await saveListSetting("worker_roles", updated);
    setWorkerRoles(updated);
    setNewWorkerRole("");
  };

  const handleRemoveWorkerRole = async (idx) => {
    const removedName = normalizeItem(workerRoles[idx]).name;
    const updated = workerRoles.filter((_, i) => i !== idx);
    await saveListSetting("worker_roles", updated);
    setWorkerRoles(updated);

    if (!removedName) return;
    const matches = (val) => typeof val === "string" && val.trim() === removedName.trim();

    // Strip the deleted role from all worker records first
    const workersForCleanup = await base44.entities.Worker.list();
    await Promise.all(
      workersForCleanup
        .filter(w => {
          const roles = Array.isArray(w.role) ? w.role : (w.role ? [w.role] : []);
          return roles.some(matches);
        })
        .map(w => {
          const roles = Array.isArray(w.role) ? w.role : [w.role];
          return base44.entities.Worker.update(w.id, { role: roles.filter(r => !matches(r)) });
        })
    );

    const [allTemplates, allCharts, allAvailabilities, allPresets] = await Promise.all([
      base44.entities.Template.list(),
      base44.entities.ChartWidget.list(),
      base44.entities.Availability.list(),
      base44.entities.MokedPreset.list(),
    ]);

    // 2. Remove from ChartWidget.filter_roles
    await Promise.all(
      allCharts
        .filter(c => (c.filter_roles || []).some(r => matches(r)))
        .map(c => base44.entities.ChartWidget.update(c.id, {
          filter_roles: (c.filter_roles || []).filter(r => !matches(r))
        }))
    );

    // 3. Clear role_or_qualification on Availability shifts
    await Promise.all(
      allAvailabilities
        .filter(a => (a.shifts || []).some(s => matches(s.role_or_qualification)))
        .map(a => base44.entities.Availability.update(a.id, {
          shifts: (a.shifts || []).map(s =>
            matches(s.role_or_qualification) ? { ...s, role_or_qualification: "" } : s
          )
        }))
    );

    // 4. Clear role_filter on Template columns (keep column structure intact)
    await Promise.all(
      allTemplates
        .filter(t => (t.columns || []).some(c => matches(c.role_filter)))
        .map(t => base44.entities.Template.update(t.id, {
          columns: (t.columns || []).map(c =>
            matches(c.role_filter) ? { ...c, role_filter: "" } : c
          )
        }))
    );

    // 5. Clear role_filter on MokedPreset columns
    await Promise.all(
      (allPresets || [])
        .filter(p => ((p.template_config || {}).columns || []).some(c => matches(c.role_filter)))
        .map(p => {
          const cfg = p.template_config || {};
          return base44.entities.MokedPreset.update(p.id, {
            template_config: {
              ...cfg,
              columns: (cfg.columns || []).map(c =>
                matches(c.role_filter) ? { ...c, role_filter: "" } : c
              ),
            },
          });
        })
    );

    invalidateStaticCache();
  };

  const handleCleanupOrphanedRoles = async () => {
    const validRoleNames = new Set(workerRoles.map(r => normalizeItem(r).name.trim()).filter(Boolean));
    const allWorkers = await base44.entities.Worker.list();

    const toFix = allWorkers.filter(w => {
      const roles = Array.isArray(w.role) ? w.role : (w.role ? [w.role] : []);
      return roles.some(r => typeof r === "string" && r.trim() && !validRoleNames.has(r.trim()));
    });

    if (toFix.length === 0) {
      alert("לא נמצאו תפקידים יתומים לניקוי");
      return;
    }

    await Promise.all(toFix.map(w => {
      const roles = Array.isArray(w.role) ? w.role : [w.role];
      return base44.entities.Worker.update(w.id, {
        role: roles.filter(r => typeof r === "string" && validRoleNames.has(r.trim()))
      });
    }));

    invalidateStaticCache();
    alert(`נוקו תפקידים יתומים מ-${toFix.length} עובדים`);
  };

  const handleSaveWorkerRole = async (idx, updatedItem) => {
    const oldName = normalizeItem(workerRoles[idx]).name;
    const newName = updatedItem.name;
    const updated = workerRoles.map((r, i) => i === idx ? updatedItem : r);
    await saveListSetting("worker_roles", updated);
    setWorkerRoles(updated);

    // Propagate rename to Worker records and Template columns
    if (newName && newName !== oldName) {
      // Fetch all independent collections in parallel
      const [allWorkers, allTemplates, allCharts, allTrackers, allAvailabilities, taskQualSetting, allPresets] = await Promise.all([
        base44.entities.Worker.list(),
        base44.entities.Template.list(),
        base44.entities.ChartWidget.list(),
        base44.entities.Tracker.list(),
        base44.entities.Availability.list(),
        base44.entities.AppSettings.filter({ setting_key: "task_qualifications" }),
        base44.entities.MokedPreset.list(),
      ]);

      // Robust trimmed match helper
      const matches = (val) => typeof val === "string" && val.trim() === oldName.trim();

      // 1. Update ALL Worker records that have the old role (both active and inactive)
      await Promise.all(
        allWorkers
          .filter(w => {
            const roles = Array.isArray(w.role) ? w.role : (w.role ? [w.role] : []);
            return roles.some(r => matches(r));
          })
          .map(w => {
            const roles = Array.isArray(w.role) ? w.role : [w.role];
            return base44.entities.Worker.update(w.id, { role: roles.map(r => matches(r) ? newName : r) });
          })
      );

      // 2. Update ALL Template columns that reference the old role name
      // (both 'name' field and 'role_filter' field, for ALL column types — not just type==="worker")
      const templatesToUpdate = allTemplates.filter(t =>
        (t.columns || []).some(c => c.name === oldName || c.role_filter === oldName)
      );
      await Promise.all(
        templatesToUpdate.map(t => {
          const updatedCols = (t.columns || []).map(c => ({
            ...c,
            name: c.name === oldName ? newName : c.name,
            role_filter: c.role_filter === oldName ? newName : c.role_filter,
          }));
          return base44.entities.Template.update(t.id, { columns: updatedCols });
        })
      );

      // 3. Update TemplateRow values: rename column key in row values
      if (templatesToUpdate.length > 0) {
        const affectedTemplateIds = new Set(templatesToUpdate.map(t => t.id));
        const allRows = await base44.entities.TemplateRow.list("-date", 5000);
        await Promise.all(
          allRows
            .filter(r => affectedTemplateIds.has(r.template_id) && r.values && oldName in r.values)
            .map(r => {
              const newValues = { ...r.values, [newName]: r.values[oldName] };
              delete newValues[oldName];
              return base44.entities.TemplateRow.update(r.id, { values: newValues });
            })
        );
      }

      // ── Step 5: Update ChartWidget.filter_roles ────────────────────────────────
      const chartsToUpdate = allCharts.filter(c =>
        (c.filter_roles || []).includes(oldName)
      );
      await Promise.all(chartsToUpdate.map(c =>
        base44.entities.ChartWidget.update(c.id, {
          filter_roles: (c.filter_roles || []).map(r => r === oldName ? newName : r)
        })
      ));

      // ── Step 6: Update Tracker.columns[].criteria[].col_name ──────────────────
      const trackersToUpdate = allTrackers.filter(t =>
        (t.columns || []).some(col =>
          (col.criteria || []).some(c => c.col_name === oldName)
        )
      );
      await Promise.all(trackersToUpdate.map(t => {
        const updatedColumns = (t.columns || []).map(col => ({
          ...col,
          criteria: (col.criteria || []).map(c => ({
            ...c,
            col_name: c.col_name === oldName ? newName : c.col_name,
          })),
        }));
        return base44.entities.Tracker.update(t.id, { columns: updatedColumns });
      }));

      // ── Step 7: Update Assignment.column_values keys ───────────────────────────
      if (templatesToUpdate.length > 0) {
        const affectedTemplateIds = new Set(templatesToUpdate.map(t => t.id));
        const allAssignments = await base44.entities.Assignment.list();
        const assignmentsToUpdate = allAssignments.filter(a =>
          affectedTemplateIds.has(a.template_id) &&
          a.column_values &&
          oldName in a.column_values
        );
        await Promise.all(assignmentsToUpdate.map(a => {
          const newColumnValues = { ...a.column_values, [newName]: a.column_values[oldName] };
          delete newColumnValues[oldName];
          return base44.entities.Assignment.update(a.id, { column_values: newColumnValues });
        }));
      }

      // ── Step 8: Update Availability.shifts[].role_or_qualification ────────────
      const availsToUpdate = allAvailabilities.filter(a =>
        (a.shifts || []).some(s => s.role_or_qualification === oldName)
      );
      await Promise.all(availsToUpdate.map(a => {
        const updatedShifts = (a.shifts || []).map(s => ({
          ...s,
          role_or_qualification: s.role_or_qualification === oldName ? newName : s.role_or_qualification,
        }));
        return base44.entities.Availability.update(a.id, { shifts: updatedShifts });
      }));

      // ── Step 9: Update task_qualifications keys (role name → new name) ─────────
      if (taskQualSetting.length > 0) {
        const currentQuals = JSON.parse(taskQualSetting[0].setting_value || "{}");
        const updatedQuals = {};
        for (const [taskName, roleMap] of Object.entries(currentQuals)) {
          const updatedRoleMap = {};
          for (const [roleName, workerIds] of Object.entries(roleMap)) {
            updatedRoleMap[roleName === oldName ? newName : roleName] = workerIds;
          }
          updatedQuals[taskName] = updatedRoleMap;
        }
        await base44.entities.AppSettings.update(taskQualSetting[0].id, { setting_value: JSON.stringify(updatedQuals) });
        setTaskQualifications(updatedQuals);
      }

      // ── Step 10: Update MokedPreset.template_config columns ──────────────────
      const presetsToUpdate = (allPresets || []).filter(p => {
        const cfg = p.template_config || {};
        return (cfg.columns || []).some(c => matches(c.name) || matches(c.role_filter));
      });
      await Promise.all(presetsToUpdate.map(p => {
        const cfg = p.template_config || {};
        const updatedConfig = {
          ...cfg,
          columns: (cfg.columns || []).map(c => ({
            ...c,
            name: matches(c.name) ? newName : c.name,
            role_filter: matches(c.role_filter) ? newName : c.role_filter,
          })),
        };
        return base44.entities.MokedPreset.update(p.id, { template_config: updatedConfig });
      }));

      // Invalidate caches so Schedule/Availability pick up fresh data immediately
      invalidateStaticCache();
    }
  };

  const handleAddShiftStatus = async () => {
    if (!newShiftStatus.trim()) return;
    const newItem = { name: newShiftStatus.trim(), mapping_id: "", export_name: "", is_importable: true, is_exportable: true };
    const updated = [...shiftStatuses, newItem];
    await saveListSetting("shift_statuses", updated);
    setShiftStatuses(updated);
    setNewShiftStatus("");
  };

  const handleRemoveShiftStatus = async (idx) => {
    const updated = shiftStatuses.filter((_, i) => i !== idx);
    await saveListSetting("shift_statuses", updated);
    setShiftStatuses(updated);
  };

  const handleSaveShiftStatus = async (idx, updatedItem) => {
    const updated = shiftStatuses.map((s, i) => i === idx ? updatedItem : s);
    await saveListSetting("shift_statuses", updated);
    setShiftStatuses(updated);
  };

  // Keep legacy rename handlers for tasks (still string-based)
  const handleRenameWorkerRole = async (idx, oldName, newName) => {
    if (!newName.trim() || newName.trim() === oldName) return;
    const updated = workerRoles.map((r, i) => i === idx ? { ...normalizeItem(r), name: newName.trim() } : r);
    await saveListSetting("worker_roles", updated);
    setWorkerRoles(updated);
    setRenamingWorkerRole(null);
  };

  const handleRenameShiftStatus = async (idx, oldName, newName) => {
    if (!newName.trim() || newName.trim() === oldName) return;
    const updated = shiftStatuses.map((s, i) => i === idx ? { ...normalizeItem(s), name: newName.trim() } : s);
    await saveListSetting("shift_statuses", updated);
    setShiftStatuses(updated);
    setRenamingShiftStatus(null);
  };

  const handleRenamePopulation = async (idx, oldName, newName) => {
    if (!newName.trim() || newName.trim() === oldName) return;
    const updated = populations.map((p, i) => i === idx ? { ...normalizeItem(p), name: newName.trim() } : p);
    await saveListSetting("worker_populations", updated);
    setPopulations(updated);
    setRenamingPopulation(null);
  };

  const saveTaskQualifications = async (updated) => {
    const settings = await base44.entities.AppSettings.filter({ setting_key: "task_qualifications" });
    const data = { setting_key: "task_qualifications", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setTaskQualifications(updated);
  };

  const handleAddTask = async () => {
    if (!newTaskName.trim() || tasks.includes(newTaskName.trim())) return;
    const updated = [...tasks, newTaskName.trim()];
    const settings = await base44.entities.AppSettings.filter({ setting_key: "tasks_list" });
    const data = { setting_key: "tasks_list", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setTasks(updated);
    setNewTaskName("");
  };

  const handleRemoveTask = async (task) => {
    const updated = tasks.filter(t => t !== task);
    const updatedQuals = { ...taskQualifications };
    delete updatedQuals[task];

    // Fetch both settings in parallel
    const [taskSettings, qualSettings] = await Promise.all([
      base44.entities.AppSettings.filter({ setting_key: "tasks_list" }),
      base44.entities.AppSettings.filter({ setting_key: "task_qualifications" }),
    ]);

    const updates = [];
    if (taskSettings.length > 0) {
      updates.push(base44.entities.AppSettings.update(taskSettings[0].id, { setting_value: JSON.stringify(updated) }));
    } else {
      updates.push(base44.entities.AppSettings.create({ setting_key: "tasks_list", setting_value: JSON.stringify(updated) }));
    }
    if (qualSettings.length > 0) {
      updates.push(base44.entities.AppSettings.update(qualSettings[0].id, { setting_value: JSON.stringify(updatedQuals) }));
    } else {
      updates.push(base44.entities.AppSettings.create({ setting_key: "task_qualifications", setting_value: JSON.stringify(updatedQuals) }));
    }

    await Promise.all(updates);
    setTasks(updated);
    setTaskQualifications(updatedQuals);
  };

  const handleToggleWorkerQualification = async (taskName, role, workerId) => {
    const taskRoles = taskQualifications[taskName] || {};
    const current = taskRoles[role] || [];
    const updatedRole = current.includes(workerId)
      ? current.filter(id => id !== workerId)
      : [...current, workerId];
    const updated = { ...taskQualifications, [taskName]: { ...taskRoles, [role]: updatedRole } };
    await saveTaskQualifications(updated);
  };

  const tabs = [
    { key: "schedule", label: "לוח ודוחות", icon: Calendar },
    { key: "workers", label: "עובדים", icon: UserCog },
    { key: "users", label: "משתמשים", icon: Users },
    { key: "mapping", label: "מיפוי ייצוא/ייבוא", icon: Link },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2" dir="rtl">הגדרות</h1>
          <p className="text-gray-600" dir="rtl">הגדר הגדרות כלל מערכת</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-2 mb-6 bg-white border rounded-xl p-1 shadow-sm w-fit" dir="rtl">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-blue-900 text-white shadow"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* === TAB: לוח ודוחות === */}
        {activeTab === "schedule" && <>

        {/* Unified Schedule Columns */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between" dir="rtl">
              <CardTitle className="flex items-center gap-2"><Columns className="w-5 h-5 text-green-600" />עמודות לוח ודוחות</CardTitle>
              <button
                type="button"
                onClick={handleBackfillColumnIds}
                disabled={backfilling}
                className="text-xs text-gray-500 hover:text-blue-700 border border-gray-300 rounded-md px-2 py-1 transition-colors disabled:opacity-50"
                title="קשר עמודות קיימות בתבניות ופריסטים למזהים מהגדרות (פעולה חד פעמית)"
              >
                {backfilling ? "מבצע גיבוי..." : "גבה מזהי עמודות"}
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-4" dir="rtl">
              הגדר עמודות שיופיעו בלוח ובדוחות. לכל עמודה קבע כיצד לסכם את הנתונים בדוחות.
            </p>
            {/* Add new column */}
            <div className="space-y-2 mb-4" dir="rtl">
              <div className="flex gap-2">
                <Input value={newColName} onChange={e => setNewColName(e.target.value)} placeholder="שם עמודה חדשה..." dir="rtl" className="flex-1" />
                <Select value={newColReportType} onValueChange={v => { setNewColReportType(v); setNewColQuantPreset(""); }}>
                  <SelectTrigger className="w-56" dir="rtl"><SelectValue /></SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="sum_numbers">
                      <div dir="rtl">
                        <div className="font-medium">סיכום מספרים</div>
                        <div className="text-xs text-gray-500">מסכם ערכים מספריים שהוזנו בתאים</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="sum_hours">
                      <div dir="rtl">
                        <div className="font-medium">סיכום שעות לפי טקסט</div>
                        <div className="text-xs text-gray-500">סופר שעות עבודה לפי ערך טקסטואלי מוגדר</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="count_by_text">
                      <div dir="rtl">
                        <div className="font-medium">סיכום פעמים לפי טקסט</div>
                        <div className="text-xs text-gray-500">סופר כמה פעמים הופיע ערך מסוים בעמודה</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="count_quantitative">
                      <div dir="rtl">
                        <div className="font-medium">ספירה כמותית</div>
                        <div className="text-xs text-gray-500">עמודת ספירה לפי רשימת פריטים מוגדרת מראש</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAddScheduleColumn}><Plus className="w-4 h-4" /></Button>
              </div>
              {newColReportType === "count_quantitative" && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2" dir="rtl">
                  לאחר יצירת העמודה, פתח אותה כדי להוסיף פריטים לספירה
                </p>
              )}
            </div>

            {/* Column list */}
            <div className="space-y-2">
              {scheduleColumns.length === 0 && <p className="text-sm text-gray-400" dir="rtl">לא הוגדרו עמודות</p>}
              {scheduleColumns.map((col, idx) => (
                <div key={idx} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50" dir="rtl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{col.name}</span>
                      <Badge variant="outline" className={`text-xs ${
                        col.report_type === "sum_hours" ? "border-purple-300 text-purple-700" :
                        col.report_type === "count_by_text" ? "border-green-300 text-green-700" :
                        col.report_type === "count_quantitative" ? "border-emerald-300 text-emerald-700" :
                        "border-blue-300 text-blue-700"
                      }`}>
                        {col.report_type === "sum_hours" ? "סיכום שעות לפי טקסט" : col.report_type === "count_by_text" ? "סיכום פעמים לפי טקסט" : col.report_type === "count_quantitative" ? `ספירה כמותית${col.quantitative_preset_name ? ` — ${col.quantitative_preset_name}` : ""}` : "סיכום מספרים"}
                      </Badge>
                      {col.mapping_id ? (
                        <span className="text-[10px] font-mono bg-white border rounded px-1 text-gray-500">{col.mapping_id}</span>
                      ) : (
                        <span className="text-[10px] text-orange-400 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />ללא מזהה</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setExpandedCol(expandedCol === idx ? null : idx)} className="text-gray-400 hover:text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-200">
                        {expandedCol === idx ? "סגור" : "אפשרויות"}
                      </button>
                      <ConfirmDeleteButton onConfirm={() => handleRemoveScheduleColumn(idx)} />
                    </div>
                  </div>
                  {expandedCol === idx && (
                   <div className="p-3 border-t space-y-4" dir="rtl">
                     {/* ID / mapping_id — simplified */}
                     <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                         <div>
                           <label className="text-xs text-gray-500 block mb-1">שם מקומי</label>
                           <Input
                             defaultValue={col.name}
                             onBlur={e => handleRenameColumnName(idx, col.name, e.target.value)}
                             onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } }}
                             className="h-7 text-sm"
                             dir="rtl"
                           />
                           <p className="text-[10px] text-orange-500 mt-0.5">שינוי שם יעדכן את כל הלוחות והשורות הקיימות</p>
                         </div>
                         <div>
                           <label className="text-xs text-gray-500 block mb-1">ID / מזהה</label>
                           <div className="flex gap-1">
                             <Input
                               value={col.mapping_id || ""}
                               onChange={e => {
                                 const updated = scheduleColumns.map((c, i) => i === idx ? { ...c, mapping_id: e.target.value.trim().toLowerCase() } : c);
                                 saveScheduleColumns(updated);
                               }}
                               placeholder="col_..."
                               className="h-7 text-xs font-mono flex-1"
                               dir="ltr"
                             />
                             <Button size="sm" variant="outline" className="h-7 text-xs px-2 shrink-0"
                               onClick={() => {
                                 const suggested = suggestMappingId(col.name, "col");
                                 const updated = scheduleColumns.map((c, i) => i === idx ? { ...c, mapping_id: suggested } : c);
                                 saveScheduleColumns(updated);
                               }}
                               title="הצע מזהה"><Wand2 className="w-3 h-3" /></Button>
                           </div>
                         </div>
                       </div>
                       <p className="text-xs text-gray-400">ה-ID משמש לזיהוי בין סביבות. השם המקומי הוא רק שם התצוגה בסביבה הזו.</p>
                     </div>
                     {col.report_type === "count_quantitative" ? (
                       /* Quantitative items editor */
                       <div>
                         <p className="text-xs font-semibold text-gray-600 mb-1">פריטים לספירה</p>
                         <p className="text-xs text-gray-400 mb-2">כל פריט יספר בנפרד בדוחות (לדוגמה: A, B, C)</p>
                         <div className="flex gap-2 mb-2">
                           <Input
                             value={newQuantItem}
                             onChange={e => setNewQuantItem(e.target.value)}
                             placeholder="שם פריט... (לדוגמה: A)"
                             className="h-7 text-sm flex-1"
                             dir="rtl"
                             onKeyDown={e => e.key === 'Enter' && handleAddQuantItem(idx, newQuantItem)}
                           />
                           <Button size="sm" className="h-7" onClick={() => handleAddQuantItem(idx, newQuantItem)}><Plus className="w-3 h-3" /></Button>
                         </div>
                         <div className="space-y-1">
                           {(col.quantitative_items || []).map((item, ii) => {
                             const isRenaming = renamingQuantItem?.colIdx === idx && renamingQuantItem?.itemIdx === ii;
                             return (
                               <div key={ii} className="flex items-center gap-2">
                                 <button onClick={() => handleRemoveQuantItem(idx, ii)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X className="w-3 h-3" /></button>
                                 {isRenaming ? (
                                   <>
                                     <Input
                                       autoFocus
                                       value={renamingQuantItem.value}
                                       onChange={e => setRenamingQuantItem(prev => ({ ...prev, value: e.target.value }))}
                                       onKeyDown={async e => {
                                         if (e.key === 'Enter') {
                                           await handleRenameQuantItem(idx, ii, item, renamingQuantItem.value);
                                           setRenamingQuantItem(null);
                                         }
                                         if (e.key === 'Escape') setRenamingQuantItem(null);
                                       }}
                                       className="h-6 text-xs flex-1"
                                       dir="rtl"
                                     />
                                     <button
                                       onClick={async () => {
                                         await handleRenameQuantItem(idx, ii, item, renamingQuantItem.value);
                                         setRenamingQuantItem(null);
                                       }}
                                       className="text-green-600 hover:text-green-700 flex-shrink-0"
                                       title="שמור שינוי שם (גורפי)"
                                     >
                                       <Check className="w-3 h-3" />
                                     </button>
                                     <button onClick={() => setRenamingQuantItem(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X className="w-3 h-3" /></button>
                                   </>
                                 ) : (
                                   <>
                                     <span className="text-xs flex-1 px-1">{item}</span>
                                     <button
                                       onClick={() => setRenamingQuantItem({ colIdx: idx, itemIdx: ii, value: item })}
                                       className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                                       title="שנה שם (יעדכן נתונים קיימים)"
                                     >
                                       <Pencil className="w-3 h-3" />
                                     </button>
                                   </>
                                 )}
                               </div>
                             );
                           })}
                           {(col.quantitative_items || []).length === 0 && <p className="text-xs text-gray-400">לא הוגדרו פריטים</p>}
                         </div>
                       </div>
                     ) : (
                       <>
                         {/* Sub options */}
                         <div>
                           <p className="text-xs font-semibold text-gray-600 mb-1">אפשרויות מוכנות לבחירה בלוח</p>
                           <p className="text-xs text-gray-400 mb-2">כל אפשרות מגדירה ערך לבחירה בתא ואת הקריטריון לספירת שעות בדוחות</p>
                           <div className="flex gap-2 mb-2">
                             <Input value={newSubOptionName} onChange={e => setNewSubOptionName(e.target.value)} placeholder="שם אפשרות..." className="h-7 text-sm flex-1" dir="rtl" />
                             <Button size="sm" className="h-7" onClick={() => handleAddSubOption(idx)}><Plus className="w-3 h-3" /></Button>
                           </div>
                           <div className="space-y-1">
                             {(col.sub_options || []).map((so, si) => {
                               const isRenamingCrit = renamingSubOption?.colIdx === idx && renamingSubOption?.subIdx === si && renamingSubOption?.field === 'criterion';
                               return (
                                 <div key={si} className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1 text-xs">
                                   <button onClick={() => handleRemoveSubOption(idx, si)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X className="w-3 h-3" /></button>
                                   {/* Name — plain editable, no data impact */}
                                   <Input
                                     value={so.name}
                                     onChange={async e => {
                                       const updated = scheduleColumns.map((c, i) => i === idx ? {
                                         ...c,
                                         sub_options: (c.sub_options || []).map((s, j) => j === si ? { ...s, name: e.target.value } : s)
                                       } : c);
                                       await saveScheduleColumns(updated);
                                     }}
                                     className="h-6 text-xs flex-1 min-w-0"
                                     dir="rtl"
                                     placeholder="שם"
                                   />
                                   {/* Criterion — rename gloablly */}
                                   {isRenamingCrit ? (
                                     <>
                                       <Input
                                         autoFocus
                                         value={renamingSubOption.value}
                                         onChange={e => setRenamingSubOption(prev => ({ ...prev, value: e.target.value }))}
                                         onKeyDown={async e => {
                                           if (e.key === 'Enter') {
                                             await handleRenameSubOptionCriterion(idx, si, so.criterion, renamingSubOption.value);
                                             setRenamingSubOption(null);
                                           }
                                           if (e.key === 'Escape') setRenamingSubOption(null);
                                         }}
                                         className="h-6 text-xs flex-1 min-w-0"
                                         dir="rtl"
                                       />
                                       <button
                                         onClick={async () => {
                                           await handleRenameSubOptionCriterion(idx, si, so.criterion, renamingSubOption.value);
                                           setRenamingSubOption(null);
                                         }}
                                         className="text-green-600 hover:text-green-700 flex-shrink-0" title="שמור שם גורפי"
                                       ><Check className="w-3 h-3" /></button>
                                       <button onClick={() => setRenamingSubOption(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X className="w-3 h-3" /></button>
                                     </>
                                   ) : (
                                     <>
                                       <span className="text-xs text-gray-500 flex-1 px-1">{so.criterion}</span>
                                       <button
                                         onClick={() => setRenamingSubOption({ colIdx: idx, subIdx: si, field: 'criterion', value: so.criterion })}
                                         className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                                         title="שנה קריטריון (יעדכן נתונים קיימים)"
                                       ><Pencil className="w-3 h-3" /></button>
                                     </>
                                   )}
                                 </div>
                               );
                             })}
                             {(col.sub_options || []).length === 0 && <p className="text-xs text-gray-400">לא הוגדרו אפשרויות</p>}
                           </div>
                         </div>
                       </>
                     )}
                   </div>
                   )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shift Statuses */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2" dir="rtl"><SettingsIcon className="w-5 h-5 text-teal-600" />סטטוסי משמרות</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-3" dir="rtl">הגדר סטטוסים שניתן להקצות למשמרות בלוח. הרחב שורה לעריכת שם מקומי ו-ID.</p>
            <div className="flex gap-2 mb-4">
              <Input value={newShiftStatus} onChange={(e) => setNewShiftStatus(e.target.value)} placeholder="שם סטטוס חדש..." dir="rtl" onKeyDown={e => e.key === 'Enter' && handleAddShiftStatus()} />
              <Button onClick={handleAddShiftStatus}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-2">
              {shiftStatuses.map((status, idx) => (
                <MappableItemRow
                  key={idx}
                  item={normalizeItem(status)}
                  allItems={shiftStatuses}
                  prefix="status"
                  color="teal"
                  onSave={(updated) => handleSaveShiftStatus(idx, updated)}
                  onDelete={() => handleRemoveShiftStatus(idx)}
                />
              ))}
              {shiftStatuses.length === 0 && <p className="text-sm text-gray-400" dir="rtl">לא הוגדרו סטטוסים</p>}
            </div>
          </CardContent>
        </Card>

        </> /* end schedule tab */}

        {/* === TAB: עובדים === */}
        {activeTab === "workers" && <>

        {/* Tasks & Qualifications */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2" dir="rtl"><ClipboardList className="w-5 h-5 text-violet-600" />משימות וכשירויות</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-4" dir="rtl">
              הגדר משימות וקבע אילו עובדים כשירים לכל משימה. בעמודת הלוח, עובדים לא כשירים יצובעו בכתום ויוצגו אחרונים.
            </p>
            <div className="flex gap-2 mb-4" dir="rtl">
              <Input value={newTaskName} onChange={e => setNewTaskName(e.target.value)} placeholder="שם משימה חדשה..." dir="rtl" className="flex-1" onKeyDown={e => e.key === 'Enter' && handleAddTask()} />
              <Button onClick={handleAddTask}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-2">
              {tasks.length === 0 && <p className="text-sm text-gray-400" dir="rtl">לא הוגדרו משימות</p>}
              {tasks.map(task => (
                <div key={task} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50" dir="rtl">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{task}</span>
                      <Badge variant="outline" className="text-xs border-violet-300 text-violet-700">
                        {Object.values(taskQualifications[task] || {}).flat().length} כשירים
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setExpandedTask(expandedTask === task ? null : task)} className="text-gray-400 hover:text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-200">
                        {expandedTask === task ? "סגור" : "נהל כשירויות"}
                      </button>
                      <ConfirmDeleteButton onConfirm={() => handleRemoveTask(task)} />
                    </div>
                  </div>
                  {expandedTask === task && (
                    <div className="p-3 border-t space-y-3" dir="rtl">
                      <p className="text-xs text-gray-500">סמן עובדים כשירים למשימה לפי תפקיד:</p>
                      {workerRoles.map(roleObj => {
                        const role = normalizeItem(roleObj).name;
                        const roleWorkers = workers.filter(w => w.active !== false && (Array.isArray(w.role) ? w.role.includes(role) : w.role === role));
                        if (roleWorkers.length === 0) return null;
                        const taskRoleQuals = (taskQualifications[task] || {})[role] || [];
                        return (
                          <div key={role}>
                            <p className="text-xs font-semibold text-gray-700 mb-1">{role}</p>
                            <div className="flex flex-wrap gap-2">
                              {roleWorkers.map(worker => {
                                const qualified = taskRoleQuals.includes(worker.id);
                                return (
                                  <button
                                    key={worker.id}
                                    onClick={() => handleToggleWorkerQualification(task, role, worker.id)}
                                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                                      qualified
                                        ? 'bg-violet-100 border-violet-400 text-violet-800 font-semibold'
                                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400'
                                    }`}
                                  >
                                    {worker.nickname}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {workerRoles.length === 0 && <p className="text-xs text-gray-400">הגדר תפקידי עובדים תחילה בלשונית עובדים</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Worker Roles */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between" dir="rtl">
              <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600" />תפקידי עובדים</CardTitle>
              <button
                type="button"
                onClick={handleCleanupOrphanedRoles}
                className="text-xs text-gray-500 hover:text-red-600 border border-gray-300 rounded-md px-2 py-1 transition-colors"
              >
                נקה תפקידים יתומים
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-3" dir="rtl">הגדר תפקידים שניתן לבחור בהם בעת הוספת/עריכת עובדים. הרחב שורה לעריכת שם מקומי ו-ID.</p>
            <div className="flex gap-2 mb-4">
              <Input value={newWorkerRole} onChange={(e) => setNewWorkerRole(e.target.value)} placeholder="שם תפקיד חדש..." dir="rtl" onKeyDown={e => e.key === 'Enter' && handleAddWorkerRole()} />
              <Button onClick={handleAddWorkerRole}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-2">
              {workerRoles.map((role, idx) => (
                <MappableItemRow
                  key={idx}
                  item={normalizeItem(role)}
                  allItems={workerRoles}
                  prefix="role"
                  color="indigo"
                  onSave={(updated) => handleSaveWorkerRole(idx, updated)}
                  onDelete={() => handleRemoveWorkerRole(idx)}
                />
              ))}
              {workerRoles.length === 0 && <p className="text-sm text-gray-400" dir="rtl">לא הוגדרו תפקידים</p>}
            </div>
          </CardContent>
        </Card>

        {/* Worker Populations */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2" dir="rtl"><Users className="w-5 h-5 text-orange-600" />אוכלוסיות עובדים</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-3" dir="rtl">הגדר אוכלוסיות שניתן לבחור בהן בעת הוספת/עריכת עובדים. הרחב שורה לעריכת שם מקומי ו-ID.</p>
            <div className="flex gap-2 mb-4">
              <Input value={newPopulation} onChange={(e) => setNewPopulation(e.target.value)} placeholder="שם אוכלוסייה חדשה..." dir="rtl" onKeyDown={e => e.key === 'Enter' && handleAddPopulation()} />
              <Button onClick={handleAddPopulation}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-2">
              {populations.map((pop, idx) => (
                <MappableItemRow
                  key={idx}
                  item={normalizeItem(pop)}
                  allItems={populations}
                  prefix="pop"
                  color="orange"
                  onSave={(updated) => handleSavePopulation(idx, updated)}
                  onDelete={() => handleRemovePopulation(idx)}
                />
              ))}
              {populations.length === 0 && <p className="text-sm text-gray-400" dir="rtl">לא הוגדרו אוכלוסיות</p>}
            </div>
          </CardContent>
        </Card>

        </> /* end workers tab */}

        {/* === TAB: משתמשים === */}
        {activeTab === "users" && <>

        {/* User Roles */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2" dir="rtl"><Users className="w-5 h-5 text-blue-600" />ניהול תפקידי משתמש</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-700" dir="rtl"><strong>מנהל:</strong> גישה מלאה<br /><strong>משתמש:</strong> זמינות בלבד</p>
              </div>
              <div className="space-y-3">
                {workers.filter(w => w.email).map((worker) => (
                  <div key={worker.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{worker.nickname}</p>
                      <p className="text-sm text-gray-600">{worker.email}</p>
                    </div>
                    <Select value={userRoles[worker.email] || "user"} onValueChange={(value) => handleRoleChange(worker.email, value)}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user" dir="rtl">משתמש</SelectItem>
                        <SelectItem value="manager" dir="rtl">מנהל</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={handleSaveRoles} disabled={saving} className="bg-blue-900 hover:bg-blue-800" dir="rtl">
                <Save className="w-4 h-4 mr-2" />{saving ? "שומר..." : "שמור תפקידי משתמש"}
              </Button>
            </div>
          </CardContent>
        </Card>

        </> /* end users tab */}

        {/* === TAB: מיפוי ייצוא/ייבוא === */}
        {activeTab === "mapping" && (
          <MappingSettings onNavigateToTab={(tab) => setActiveTab(tab)} />
        )}

      </div>
    </div>
  );
}