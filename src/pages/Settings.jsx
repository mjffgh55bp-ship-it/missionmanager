import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Users, X, Plus, Columns, Settings as SettingsIcon, ClipboardList, Pencil, Check, Calendar, UserCog, Link, Wand2, AlertTriangle, Search, FileSearch } from "lucide-react";
import MappingSettings from "@/components/settings/MappingSettings";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import { Badge } from "@/components/ui/badge";
import MappableItemRow, { normalizeItem, suggestMappingId } from "@/components/settings/MappableItemRow";
import { invalidateStaticCache, invalidateTemplatesCache, getCachedAllSettings, getCachedWorkers } from "@/lib/appDataCache";
import { getTaskQuals } from "@/lib/taskQuals";


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
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadSettings();
    }
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [allSettings, workersData] = await Promise.all([
        getCachedAllSettings(base44.entities),
        getCachedWorkers(base44.entities),
      ]);

      const getSetting = (key) => allSettings.find(s => s.setting_key === key);

      const rolesSettings = getSetting("user_roles") ? [getSetting("user_roles")] : [];
      const scheduleColsSettings = getSetting("custom_schedule_params") ? [getSetting("custom_schedule_params")] : [];
      const populationsSettings = getSetting("worker_populations") ? [getSetting("worker_populations")] : [];
      const workerRolesSettings = getSetting("worker_roles") ? [getSetting("worker_roles")] : [];
      const shiftStatusesSettings = getSetting("shift_statuses") ? [getSetting("shift_statuses")] : [];
      const tasksSettings = getSetting("tasks_list") ? [getSetting("tasks_list")] : [];
      const taskQualSettings = getSetting("task_qualifications") ? [getSetting("task_qualifications")] : [];

      if (rolesSettings.length > 0) setUserRoles(JSON.parse(rolesSettings[0].setting_value));

      if (scheduleColsSettings.length > 0) {
        const loadedCols = JSON.parse(scheduleColsSettings[0].setting_value) || [];
        const needsSave = loadedCols.some(c => !c.mapping_id);
        const withIds = needsSave
          ? loadedCols.map(c => c.mapping_id ? c : { ...c, mapping_id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` })
          : loadedCols;
        setScheduleColumns(withIds); // show data immediately
        if (needsSave) {
          // persist quietly after render — don't block or risk blanking the page
          (async () => {
            try {
              const s2 = await base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" });
              const d = { setting_key: "custom_schedule_params", setting_value: JSON.stringify(withIds) };
              if (s2.length > 0) await base44.entities.AppSettings.update(s2[0].id, d);
              else await base44.entities.AppSettings.create(d);
              invalidateStaticCache();
            } catch (e) { console.error("mapping_id backfill save failed:", e); }
          })();
        }
      }

      const rawPops = populationsSettings.length > 0
        ? (JSON.parse(populationsSettings[0].setting_value) || [])
        : ["מנהל", "קבוע בכיר", "קבוע", "קבלן בכיר", "קבלן", "קבלן מיוחד", "ותיק"];
      setPopulations(rawPops.map(normalizeItem));

      const rawRoles = workerRolesSettings.length > 0
        ? (JSON.parse(workerRolesSettings[0].setting_value) || [])
        : [];
      const normRoles = rawRoles.map(normalizeItem).map(r =>
        r.mapping_id ? r : { ...r, mapping_id: suggestMappingId(r.name, "role") }
      );
      setWorkerRoles(normRoles);
      // Persist backfilled ids quietly (don't block render), like the tasks/schedule-column backfill
      const rolesNeedSave = rawRoles.some((r, i) => normRoles[i].mapping_id && (typeof r === "string" || !r.mapping_id));
      if (rolesNeedSave) {
        (async () => {
          try {
            const s2 = await base44.entities.AppSettings.filter({ setting_key: "worker_roles" });
            const d = { setting_key: "worker_roles", setting_value: JSON.stringify(normRoles) };
            if (s2.length > 0) await base44.entities.AppSettings.update(s2[0].id, d);
            else await base44.entities.AppSettings.create(d);
          } catch (e) { console.error("role mapping_id backfill failed:", e); }
        })();
      }

      const rawStatuses = shiftStatusesSettings.length > 0
        ? (JSON.parse(shiftStatusesSettings[0].setting_value) || [])
        : ["מתוכנן", "מאושר", "בוצע", "בוטל"];
      setShiftStatuses(rawStatuses.map(normalizeItem));

      if (tasksSettings.length > 0) {
        const rawTasks = JSON.parse(tasksSettings[0].setting_value) || [];
        const normTasks = rawTasks.map(normalizeItem).map(t =>
          t.mapping_id ? t : { ...t, mapping_id: suggestMappingId(t.name, "task") }
        );
        setTasks(normTasks);
        // Persist backfilled ids quietly (don't block render), like the schedule-column backfill
        const needsSave = rawTasks.some((t, i) => normTasks[i].mapping_id && (typeof t === "string" || !t.mapping_id));
        if (needsSave) {
          (async () => {
            try {
              const s2 = await base44.entities.AppSettings.filter({ setting_key: "tasks_list" });
              const d = { setting_key: "tasks_list", setting_value: JSON.stringify(normTasks) };
              if (s2.length > 0) await base44.entities.AppSettings.update(s2[0].id, d);
              else await base44.entities.AppSettings.create(d);
            } catch (e) { console.error("task mapping_id backfill failed:", e); }
          })();
        }
        // Re-key task_qualifications from name → mapping_id (backward-compatible; runs once)
        if (taskQualSettings.length > 0) {
          const rawQuals = JSON.parse(taskQualSettings[0].setting_value) || {};
          const nameToId = {};
          normTasks.forEach(t => { if (t.mapping_id && t.name) nameToId[t.name] = t.mapping_id; });
          let changed = false;
          const rekeyed = {};
          for (const [k, v] of Object.entries(rawQuals)) {
            const id = nameToId[k];
            if (id && id !== k) { rekeyed[id] = v; changed = true; }
            else { rekeyed[k] = v; }
          }
          setTaskQualifications(rekeyed);
          if (changed) {
            (async () => {
              try {
                const s2 = await base44.entities.AppSettings.filter({ setting_key: "task_qualifications" });
                const d = { setting_key: "task_qualifications", setting_value: JSON.stringify(rekeyed) };
                if (s2.length > 0) await base44.entities.AppSettings.update(s2[0].id, d);
                else await base44.entities.AppSettings.create(d);
              } catch (e) { console.error("task_qualifications re-key failed:", e); }
            })();
          }
        }
      } else {
        // No tasks_list, but task_qualifications may exist — load as-is
        if (taskQualSettings.length > 0) {
          setTaskQualifications(JSON.parse(taskQualSettings[0].setting_value) || {});
        }
      }
      // ── One-time backfill: role_mapping_id on template worker columns ──
      const roleBackfillDone = localStorage.getItem('role_mid_backfill_v1');
      if (!roleBackfillDone) {
        (async () => {
          try {
            const workerRolesSetting = await base44.entities.AppSettings.filter({ setting_key: "worker_roles" });
            const roleList = workerRolesSetting.length > 0 ? (JSON.parse(workerRolesSetting[0].setting_value) || []) : [];
            const roleIdByName = {};
            roleList.forEach(r => { if (!r.mapping_id) return; const n = typeof r === "string" ? r : r.name; if (n) roleIdByName[n.trim()] = r.mapping_id; });

            const allTemplatesData = await base44.entities.Template.list('created_date', 500);
            const tmplsToUpdate = [];
            for (const t of allTemplatesData) {
              let changed = false;
              const updatedCols = (t.columns || []).map(col => {
                if (col.type !== "worker" || col.role_mapping_id) return col;
                const roleName = (col.role_filter || col.name || "").trim();
                const mid = roleIdByName[roleName];
                if (mid) { changed = true; return { ...col, role_mapping_id: mid }; }
                return col;
              });
              if (changed) tmplsToUpdate.push({ id: t.id, columns: updatedCols });
            }
            await Promise.all(tmplsToUpdate.map(t => base44.entities.Template.update(t.id, { columns: t.columns })));

            // MokedPreset backfill
            const allPresets = await base44.entities.MokedPreset.list('created_date', 200);
            const presetsToUpdate = [];
            for (const p of allPresets) {
              const cfg = p.template_config || {};
              let changed = false;
              const updatedCols = (cfg.columns || []).map(col => {
                if (col.type !== "worker" || col.role_mapping_id) return col;
                const roleName = (col.role_filter || col.name || "").trim();
                const mid = roleIdByName[roleName];
                if (mid) { changed = true; return { ...col, role_mapping_id: mid }; }
                return col;
              });
              if (changed) presetsToUpdate.push({ id: p.id, template_config: { ...cfg, columns: updatedCols } });
            }
            await Promise.all(presetsToUpdate.map(p => base44.entities.MokedPreset.update(p.id, { template_config: p.template_config })));

            localStorage.setItem('role_mid_backfill_v1', '1');
          } catch (e) { console.error("role_mapping_id backfill on templates failed:", e); }
        })();
      }

      // ── One-time backfill: ensure ScheduleColumn exists for every role ──
      const roleSchedColDone = localStorage.getItem('role_schedcol_sync_v1');
      if (!roleSchedColDone) {
        (async () => {
          try {
            // Reload fresh ScheduleColumns in case they were modified by the mapping_id backfill above
            const s2 = await base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" });
            const currentCols = s2.length > 0 ? (JSON.parse(s2[0].setting_value) || []) : [];
            const normRoles = workerRoles.map(r => typeof r === "string" ? { name: r } : r);
            let changed = false;

            for (const role of normRoles) {
              const roleName = (role.name || "").trim();
              if (!roleName) continue;

              const exists = currentCols.some(c =>
                c.type === "worker" && ((c.role_filter || "").trim() === roleName || (c.name || "").trim() === roleName)
              );
              if (exists) continue;

              const colMappingId = role.mapping_id
                ? `col_role_${role.mapping_id}`
                : `col_role_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

              const maxOrder = Math.max(0, ...currentCols.map(c => c.sort_order || 0), 0);

              currentCols.push({
                mapping_id: colMappingId,
                name: roleName,
                role_filter: roleName,
                type: "worker",
                is_core: false,
                sort_order: maxOrder + 1,
              });
              changed = true;
            }

            if (changed) {
              const d = { setting_key: "custom_schedule_params", setting_value: JSON.stringify(currentCols) };
              if (s2.length > 0) await base44.entities.AppSettings.update(s2[0].id, d);
              else await base44.entities.AppSettings.create(d);
              invalidateStaticCache();
              setScheduleColumns(currentCols);
            }

            localStorage.setItem('role_schedcol_sync_v1', '1');
          } catch (e) { console.error("role schedcol backfill failed:", e); }
        })();
      }

      // ── One-time backfill: stamp role_mapping_id on MokedPreset + Template worker columns ──
      const presetRoleMidDone = localStorage.getItem('preset_role_mid_v1');
      if (!presetRoleMidDone) {
        (async () => {
          try {
            const workerRolesSetting = await base44.entities.AppSettings.filter({ setting_key: "worker_roles" });
            const roleList = workerRolesSetting.length > 0 ? (JSON.parse(workerRolesSetting[0].setting_value) || []) : [];
            const roleIdByName = {};
            roleList.forEach(r => { if (!r.mapping_id) return; const n = typeof r === "string" ? r : r.name; if (n) roleIdByName[n.trim()] = r.mapping_id; });

            // MokedPresets
            const allPresets = await base44.entities.MokedPreset.list('created_date', 500);
            const presetsToUpdate = [];
            for (const p of allPresets) {
              const cfg = p.template_config || {};
              let changed = false;
              const updatedCols = (cfg.columns || []).map(col => {
                if (col.type !== "worker" || col.role_mapping_id) return col;
                const roleName = (col.role_filter || col.name || "").trim();
                const mid = roleIdByName[roleName];
                if (mid) { changed = true; return { ...col, role_mapping_id: mid }; }
                return col;
              });
              if (changed) presetsToUpdate.push({ id: p.id, template_config: { ...cfg, columns: updatedCols } });
            }
            await Promise.all(presetsToUpdate.map(p => base44.entities.MokedPreset.update(p.id, { template_config: p.template_config })));

            // Templates (high limit — there are 303+)
            const allTemplatesData = await base44.entities.Template.list('created_date', 1000);
            const tmplsToUpdate = [];
            for (const t of allTemplatesData) {
              let changed = false;
              const updatedCols = (t.columns || []).map(col => {
                if (col.type !== "worker" || col.role_mapping_id) return col;
                const roleName = (col.role_filter || col.name || "").trim();
                const mid = roleIdByName[roleName];
                if (mid) { changed = true; return { ...col, role_mapping_id: mid }; }
                return col;
              });
              if (changed) tmplsToUpdate.push({ id: t.id, columns: updatedCols });
            }
            await Promise.all(tmplsToUpdate.map(t => base44.entities.Template.update(t.id, { columns: t.columns })));

            localStorage.setItem('preset_role_mid_v1', '1');
          } catch (e) { console.error("preset role_mapping_id backfill failed:", e); }
        })();
      }

      // ── One-time backfill: stamp mapping_id on shift statuses ──
      const statusMappingIdDone = localStorage.getItem('status_mapping_id_v1');
      if (!statusMappingIdDone) {
        (async () => {
          try {
            const statusSettings = await base44.entities.AppSettings.filter({ setting_key: "shift_statuses" });
            if (statusSettings.length > 0) {
              const statuses = JSON.parse(statusSettings[0].setting_value) || [];
              let changed = false;
              const updated = statuses.map(s => {
                if (typeof s === "string") { changed = true; return { name: s, mapping_id: suggestMappingId(s, "status"), export_name: "", is_importable: true, is_exportable: true }; }
                if (!s.mapping_id) { changed = true; return { ...s, mapping_id: suggestMappingId(s.name, "status") }; }
                return s;
              });
              if (changed) {
                await base44.entities.AppSettings.update(statusSettings[0].id, { setting_value: JSON.stringify(updated) });
              }
            }
            localStorage.setItem('status_mapping_id_v1', '1');
          } catch (e) { console.error("status mapping_id backfill failed:", e); }
        })();
      }

      // ── One-time backfill: stamp mapping_id on populations ──
      const popMappingIdDone = localStorage.getItem('pop_mapping_id_v1');
      if (!popMappingIdDone) {
        (async () => {
          try {
            const popSettings = await base44.entities.AppSettings.filter({ setting_key: "worker_populations" });
            if (popSettings.length > 0) {
              const pops = JSON.parse(popSettings[0].setting_value) || [];
              let changed = false;
              const updated = pops.map(p => {
                if (typeof p === "string") { changed = true; return { name: p, mapping_id: suggestMappingId(p, "pop"), export_name: "", is_importable: true, is_exportable: true }; }
                if (!p.mapping_id) { changed = true; return { ...p, mapping_id: suggestMappingId(p.name, "pop") }; }
                return p;
              });
              if (changed) {
                await base44.entities.AppSettings.update(popSettings[0].id, { setting_value: JSON.stringify(updated) });
              }
            }
            localStorage.setItem('pop_mapping_id_v1', '1');
          } catch (e) { console.error("population mapping_id backfill failed:", e); }
        })();
      }

      setWorkers(workersData);
    } catch (err) {
      console.error("loadSettings failed:", err);
      // leave any already-set state in place; page stays visible
    } finally {
      setLoading(false); // ALWAYS clear loading, even on error
    }
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

  const handleSaveWorkerMappingId = async (worker, value) => {
    const v = (value || "").trim();
    if (v === (worker.worker_mapping_id || "")) return;
    try {
      await base44.entities.Worker.update(worker.id, { worker_mapping_id: v });
      setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, worker_mapping_id: v } : w));
    } catch (e) {
      console.error("save worker_mapping_id failed:", e);
      alert("שגיאה בשמירת מזהה הסנכרון. נסה שוב.");
    }
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

    const templates = await base44.entities.Template.list('created_date', 300);
    await new Promise(r => setTimeout(r, 150));
    const presets = await base44.entities.MokedPreset.list('created_date', 100);

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

    // 2. Fetch everything (staggered to avoid rate limits)
    const allTemplatesData = await base44.entities.Template.list('created_date', 300);
    await new Promise(r => setTimeout(r, 200));
    const allRows = await base44.entities.TemplateRow.list('-created_date', 500);
    await new Promise(r => setTimeout(r, 200));
    const allPresets = await base44.entities.MokedPreset.list('created_date', 100);

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
    const newItem = { name: newPopulation.trim(), mapping_id: suggestMappingId(newPopulation.trim(), "pop"), export_name: "", is_importable: true, is_exportable: true };
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
    const roleMappingId = suggestMappingId(newWorkerRole.trim(), "role");
    const newItem = { name: newWorkerRole.trim(), mapping_id: roleMappingId, export_name: "", is_importable: true, is_exportable: true };
    const updated = [...workerRoles, newItem];
    await saveListSetting("worker_roles", updated);
    setWorkerRoles(updated);
    setNewWorkerRole("");

    // Auto-create ScheduleColumn for this role so it's immediately usable
    const exists = scheduleColumns.some(c =>
      c.type === "worker" && ((c.role_filter || "").trim() === newItem.name || (c.name || "").trim() === newItem.name)
    );
    if (!exists) {
      const colMappingId = `col_role_${roleMappingId}`;
      const maxOrder = Math.max(0, ...scheduleColumns.map(c => c.sort_order || 0), 0);
      const newCol = {
        mapping_id: colMappingId,
        name: newItem.name,
        role_filter: newItem.name,
        type: "worker",
        is_core: false,
        sort_order: maxOrder + 1,
      };
      const updatedCols = [...scheduleColumns, newCol];
      await saveScheduleColumns(updatedCols);
    }
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

    const allTemplates = await base44.entities.Template.list('created_date', 300);
    await new Promise(r => setTimeout(r, 150));
    const [allCharts, allAvailabilities, allPresets] = await Promise.all([
      base44.entities.ChartWidget.list('created_date', 100),
      base44.entities.Availability.list('-created_date', 500),
      base44.entities.MokedPreset.list('created_date', 100),
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
      const allWorkers = await getCachedWorkers(base44.entities);
      await new Promise(r => setTimeout(r, 150));
      const allTemplates = await base44.entities.Template.list('created_date', 300);
      await new Promise(r => setTimeout(r, 150));
      const [allCharts, allTrackers] = await Promise.all([
        base44.entities.ChartWidget.list('created_date', 100),
        base44.entities.Tracker.list('created_date', 100),
      ]);
      await new Promise(r => setTimeout(r, 150));
      const allAvailabilities = await base44.entities.Availability.list('-created_date', 500);
      await new Promise(r => setTimeout(r, 150));
      const [taskQualSetting, allPresets] = await Promise.all([
        base44.entities.AppSettings.filter({ setting_key: "task_qualifications" }),
        base44.entities.MokedPreset.list('created_date', 100),
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

      // ── Step 11: Update ScheduleColumn for this role ──
      const matchRoleCol = (c) =>
        c.type === "worker" && ((c.role_filter || "").trim() === oldName.trim() || (c.name || "").trim() === oldName.trim());
      const colIdx = scheduleColumns.findIndex(matchRoleCol);
      if (colIdx >= 0) {
        const updatedCols = scheduleColumns.map(c => {
          if (!matchRoleCol(c)) return c;
          return {
            ...c,
            name: (c.name || "").trim() === oldName.trim() ? newName : c.name,
            role_filter: (c.role_filter || "").trim() === oldName.trim() ? newName : c.role_filter,
          };
        });
        await saveScheduleColumns(updatedCols);
      }

      // Invalidate caches so Schedule/Availability pick up fresh data immediately
      invalidateStaticCache();
    }
  };

  const handleAddShiftStatus = async () => {
    if (!newShiftStatus.trim()) return;
    const newItem = { name: newShiftStatus.trim(), mapping_id: suggestMappingId(newShiftStatus.trim(), "status"), export_name: "", is_importable: true, is_exportable: true };
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
    const nm = newTaskName.trim();
    if (!nm || tasks.some(t => t.name === nm)) return;
    const newTask = { name: nm, mapping_id: suggestMappingId(nm, "task"), export_name: "", is_importable: true, is_exportable: true };
    const updated = [...tasks, newTask];
    const settings = await base44.entities.AppSettings.filter({ setting_key: "tasks_list" });
    const data = { setting_key: "tasks_list", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setTasks(updated);
    setNewTaskName("");
  };

  const handleSaveTask = async (idx, updatedItem) => {
    const updated = tasks.map((t, i) => i === idx ? updatedItem : t);
    await saveListSetting("tasks_list", updated);
    setTasks(updated);
  };

  const handleRemoveTask = async (task) => {
    const updated = tasks.filter(t => t.mapping_id !== task.mapping_id);
    const updatedQuals = { ...taskQualifications };
    delete updatedQuals[task.name];
    if (task.mapping_id) delete updatedQuals[task.mapping_id];

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

  const handleToggleWorkerQualification = async (task, role, workerId) => {
    const key = task.mapping_id || task.name;
    const taskRoles = getTaskQuals(taskQualifications, task);
    const current = taskRoles[role] || [];
    const updatedRole = current.includes(workerId)
      ? current.filter(id => id !== workerId)
      : [...current, workerId];
    const updated = { ...taskQualifications, [key]: { ...taskRoles, [role]: updatedRole } };
    // If a legacy name-key existed for this task, remove it so we don't keep two copies
    if (task.mapping_id && task.name && taskQualifications[task.name] && key !== task.name) {
      delete updated[task.name];
    }
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
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2" dir="rtl">הגדרות</h1>
            <p className="text-gray-600" dir="rtl">הגדר הגדרות כלל מערכת</p>
          </div>
          <a href="/RoleRepairPreview" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
            <FileSearch className="w-4 h-4" />
            תצוגה מקדימה לתיקון תפקידים
          </a>
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
                                 const v = e.target.value.trim().toLowerCase();
                                 setScheduleColumns(prev => prev.map((c, i) => i === idx ? { ...c, mapping_id: v } : c));
                               }}
                               onBlur={() => saveScheduleColumns(scheduleColumns)}
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
                                     onChange={e => {
                                       const val = e.target.value;
                                       setScheduleColumns(prev => prev.map((c, i) => i === idx ? {
                                         ...c,
                                         sub_options: (c.sub_options || []).map((s, j) => j === si ? { ...s, name: val } : s)
                                       } : c));
                                     }}
                                     onBlur={() => saveScheduleColumns(scheduleColumns)}
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
              {tasks.map((task, idx) => (
                <div key={task.mapping_id || idx} className="space-y-1">
                  <MappableItemRow
                    item={normalizeItem(task)}
                    allItems={tasks}
                    prefix="task"
                    color="violet"
                    onSave={(updated) => handleSaveTask(idx, updated)}
                    onDelete={() => handleRemoveTask(task)}
                  />
                  <div className="flex items-center justify-between px-3" dir="rtl">
                    <Badge variant="outline" className="text-xs border-violet-300 text-violet-700">
                      {Object.values(getTaskQuals(taskQualifications, task)).flat().length} כשירים
                    </Badge>
                    <button onClick={() => setExpandedTask(expandedTask === task.mapping_id ? null : task.mapping_id)} className="text-gray-400 hover:text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-100">
                      {expandedTask === task.mapping_id ? "סגור כשירויות" : "נהל כשירויות"}
                    </button>
                  </div>
                  {expandedTask === task.mapping_id && (
                    <div className="p-3 border rounded-lg space-y-3" dir="rtl">
                      <p className="text-xs text-gray-500">סמן עובדים כשירים למשימה לפי תפקיד:</p>
                      {workerRoles.map(roleObj => {
                        const role = normalizeItem(roleObj).name;
                        const roleWorkers = workers.filter(w => w.active !== false && (Array.isArray(w.role) ? w.role.includes(role) : w.role === role));
                        if (roleWorkers.length === 0) return null;
                        const taskRoleQuals = (getTaskQuals(taskQualifications, task))[role] || [];
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
                <p className="text-sm text-gray-700 mt-2" dir="rtl"><strong>מזהה סנכרון:</strong> הזן את אותו מזהה לאותו עובד בכל רשת סגורה. נתונים מועברים לפי המזהה הזה, לא לפי השם.</p>
              </div>
              <div className="relative max-w-md mb-4">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="חפש לפי שם, אימייל או מזהה סנכרון..."
                  className="pr-10"
                  dir="rtl"
                />
              </div>
              <div className="space-y-3">
                {workers.filter(w => {
                  if (!w.email) return false;
                  if (!userSearchQuery.trim()) return true;
                  const q = userSearchQuery.toLowerCase();
                  return (
                    (w.nickname || "").toLowerCase().includes(q) ||
                    (w.email || "").toLowerCase().includes(q) ||
                    (w.worker_mapping_id || "").toLowerCase().includes(q)
                  );
                }).map((worker) => (
                  <div key={worker.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{worker.nickname}</p>
                      <p className="text-sm text-gray-600">{worker.email}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <label className="text-xs text-gray-500 mb-1" dir="rtl">מזהה סנכרון</label>
                      <Input
                        defaultValue={worker.worker_mapping_id || ""}
                        onBlur={(e) => handleSaveWorkerMappingId(worker, e.target.value)}
                        placeholder="זהה בכל הרשתות"
                        dir="ltr"
                        className="w-40"
                      />
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