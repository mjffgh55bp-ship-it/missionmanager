import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const REPORT_FALLBACK_IDS = {
  "גזר": "col_1778695698932",
  "זנב": "col_1779474980713",
  "קר": "col_1780949240936_i3zxh",
  "הערה": "col_1780949240936_0zkxk",
  "דיווח תוצאות": "col_1780949240936_wdmmc",
  "פירות": "col_1780949240936_7i2hq",
  "סילבוס": "col_1780949240936_4pydk",
};
const REPORT_NAMES = ["גזר", "זנב", "קר", "הערה", "דיווח תוצאות", "פירות", "סילבוס"];
const CORE = [
  { name: "התחלה", id: "col_core_start",    type: "time", is_time: true },
  { name: "סיום",  id: "col_core_end",      type: "time", is_time: true },
  { name: "תדריך", id: "col_core_briefing", type: "time", is_time: true },
  { name: "משימה", id: "col_core_task",     type: "task", is_time: false },
];
const WORKERS = [
  { name: "נהג",        id: "col_role_driver" },
  { name: "ליד נהג",    id: "col_role_codriver" },
  { name: "מנהל משימה", id: "col_role_mission_manager" },
  { name: "מנהל",       id: "col_role_manager" },
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const report = {
    registry: { created: 0, updated: 0, total: 0, liveParamsCount: 0, notFoundInSettings: [], mapping: {} },
    stamp: {
      templates: { checked: 0, modified: 0, colsStamped: 0 },
      presets:   { checked: 0, modified: 0, colsStamped: 0 },
      daily:     { checked: 0, modified: 0, colsStamped: 0 },
      unmappedNames: [],
    },
  };

  // ───────────────────────── PART 1: POPULATE REGISTRY ─────────────────────────
  let liveCols = [];
  try {
    const s = await base44.asServiceRole.entities.AppSettings.filter({ setting_key: "custom_schedule_params" });
    if (s.length > 0) liveCols = JSON.parse(s[0].setting_value) || [];
  } catch (e) { console.error("read custom_schedule_params failed:", e); }
  report.registry.liveParamsCount = liveCols.length;
  const liveByName = {};
  liveCols.forEach(c => { if (c && c.name) liveByName[c.name.trim()] = c; });

  const existing = await base44.asServiceRole.entities.ScheduleColumn.list('-created_date', 500);
  const byMappingId = {};
  existing.forEach(r => { if (r.mapping_id) byMappingId[r.mapping_id] = r; });

  const upsert = async (rec) => {
    const found = byMappingId[rec.mapping_id];
    if (found) { await base44.asServiceRole.entities.ScheduleColumn.update(found.id, rec); report.registry.updated++; }
    else { const c = await base44.asServiceRole.entities.ScheduleColumn.create(rec); byMappingId[rec.mapping_id] = c; report.registry.created++; }
    report.registry.mapping[rec.name] = rec.mapping_id;
  };

  let order = 0;
  for (const c of CORE) {
    await upsert({ name: c.name, mapping_id: c.id, type: c.type, is_core: true, is_time: !!c.is_time,
      role_filter: null, report_type: null, options: [], sub_options: [], quantitative_items: [], quantitative_preset_name: null, sort_order: order++ });
  }
  for (const name of REPORT_NAMES) {
    const live = liveByName[name];
    const mappingId = (live && live.mapping_id) ? live.mapping_id : REPORT_FALLBACK_IDS[name];
    if (!live) report.registry.notFoundInSettings.push(name);
    await upsert({ name, mapping_id: mappingId, type: "text", is_core: false, is_time: false, role_filter: null,
      report_type: (live && live.report_type) || null, options: (live && live.options) || [],
      sub_options: (live && live.sub_options) || [], quantitative_items: (live && live.quantitative_items) || [],
      quantitative_preset_name: (live && live.quantitative_preset_name) || null, sort_order: order++ });
  }
  for (const w of WORKERS) {
    await upsert({ name: w.name, mapping_id: w.id, type: "worker", role_filter: w.name, is_core: false, is_time: false,
      report_type: null, options: [], sub_options: [], quantitative_items: [], quantitative_preset_name: null, sort_order: order++ });
  }
  report.registry.total = report.registry.created + report.registry.updated;

  // Build name -> mapping_id from what we just wrote
  const nameToId = {};
  Object.values(byMappingId).forEach(r => { if (r && r.name && r.mapping_id) nameToId[r.name.trim()] = r.mapping_id; });

  const noteUnmapped = (nm) => {
    if (nm && !nameToId[nm.trim()] && report.stamp.unmappedNames.length < 30 && !report.stamp.unmappedNames.includes(nm)) {
      report.stamp.unmappedNames.push(nm);
    }
  };

  // ───────────────────────── PART 2: STAMP column_id (additive) ─────────────────────────
  // Templates
  const templates = await base44.asServiceRole.entities.Template.list('created_date', 500);
  report.stamp.templates.checked = templates.length;
  for (const tmpl of templates) {
    const cols = tmpl.columns || [];
    let changed = false;
    const newCols = cols.map(col => {
      const id = nameToId[(col.name || '').trim()];
      if (!id) { noteUnmapped(col.name); return col; }
      if (col.column_id === id) return col;
      changed = true; report.stamp.templates.colsStamped++;
      return { ...col, column_id: id };
    });
    if (changed) { await base44.asServiceRole.entities.Template.update(tmpl.id, { columns: newCols }); report.stamp.templates.modified++; }
  }

  // MokedPresets
  const presets = await base44.asServiceRole.entities.MokedPreset.list('created_date', 500);
  report.stamp.presets.checked = presets.length;
  for (const preset of presets) {
    const cfg = preset.template_config || {};
    const cols = cfg.columns || [];
    let changed = false;
    const newCols = cols.map(col => {
      const id = nameToId[(col.name || '').trim()];
      if (!id) { noteUnmapped(col.name); return col; }
      if (col.column_id === id) return col;
      changed = true; report.stamp.presets.colsStamped++;
      return { ...col, column_id: id };
    });
    if (changed) { await base44.asServiceRole.entities.MokedPreset.update(preset.id, { template_config: { ...cfg, columns: newCols } }); report.stamp.presets.modified++; }
  }

  // Daily columns settings (schedule_daily_columns_*)
  const allSettings = await base44.asServiceRole.entities.AppSettings.list('created_date', 500);
  const daily = allSettings.filter(s => s.setting_key && s.setting_key.startsWith('schedule_daily_columns_'));
  report.stamp.daily.checked = daily.length;
  for (const setting of daily) {
    let data = {};
    try { data = JSON.parse(setting.setting_value) || {}; } catch { continue; }
    let changed = false;
    const newData = {};
    for (const [tid, cols] of Object.entries(data)) {
      newData[tid] = (cols || []).map(col => {
        const id = nameToId[(col.name || '').trim()];
        if (!id) { noteUnmapped(col.name); return col; }
        if (col.column_id === id) return col;
        changed = true; report.stamp.daily.colsStamped++;
        return { ...col, column_id: id };
      });
    }
    if (changed) { await base44.asServiceRole.entities.AppSettings.update(setting.id, { setting_value: JSON.stringify(newData) }); report.stamp.daily.modified++; }
  }

  return Response.json({ success: true, report });
});