import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const toStrArr = (a) => Array.isArray(a) ? a.map(x => (typeof x === 'string' ? x : (x && x.name) ? String(x.name) : String(x ?? ''))).filter(Boolean) : [];

const REPORT_FALLBACK_IDS = {
  "גזר": "col_1778695698932", "זנב": "col_1779474980713", "קר": "col_1780949240936_i3zxh",
  "הערה": "col_1780949240936_0zkxk", "דיווח תוצאות": "col_1780949240936_wdmmc",
  "פירות": "col_1780949240936_7i2hq", "סילבוס": "col_1780949240936_4pydk",
};
const REPORT_NAMES = ["גזר", "זנב", "קר", "הערה", "דיווח תוצאות", "פירות", "סילבוס"];
const CORE = [
  { name: "התחלה", id: "col_core_start",    type: "time", is_time: true },
  { name: "סיום",  id: "col_core_end",      type: "time", is_time: true },
  { name: "תדריך", id: "col_core_briefing", type: "time", is_time: true },
  { name: "משימה", id: "col_core_task",     type: "task", is_time: false },
];
const WORKERS = [
  { name: "נהג", id: "col_role_driver" }, { name: "ליד נהג", id: "col_role_codriver" },
  { name: "מנהל משימה", id: "col_role_mission_manager" }, { name: "מנהל", id: "col_role_manager" },
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const report = { created: 0, updated: 0, failed: 0, total: 0, liveParamsCount: 0,
    notFoundInSettings: [], errors: [], mapping: {} };

  let liveCols = [];
  try {
    const s = await base44.asServiceRole.entities.AppSettings.filter({ setting_key: "custom_schedule_params" });
    if (s.length > 0) liveCols = JSON.parse(s[0].setting_value) || [];
  } catch (e) { console.error("read custom_schedule_params failed:", e); }
  report.liveParamsCount = liveCols.length;
  const liveByName = {};
  liveCols.forEach(c => { if (c && c.name) liveByName[c.name.trim()] = c; });

  const existing = await base44.asServiceRole.entities.ScheduleColumn.list('-created_date', 500);
  const byMappingId = {};
  existing.forEach(r => { if (r.mapping_id) byMappingId[r.mapping_id] = r; });

  const upsert = async (rec) => {
    try {
      const found = byMappingId[rec.mapping_id];
      if (found) { await base44.asServiceRole.entities.ScheduleColumn.update(found.id, rec); report.updated++; }
      else { const c = await base44.asServiceRole.entities.ScheduleColumn.create(rec); byMappingId[rec.mapping_id] = c; report.created++; }
      report.mapping[rec.name] = rec.mapping_id;
      await sleep(60);
    } catch (e) {
      report.failed++;
      report.errors.push({ name: rec.name, mapping_id: rec.mapping_id, error: String(e && e.message ? e.message : e) });
      await sleep(300);
    }
  };

  let order = 0;
  for (const c of CORE) {
    await upsert({ name: c.name, mapping_id: c.id, type: c.type, is_core: true, is_time: !!c.is_time,
      role_filter: null, report_type: null, options: [], sub_options: [], quantitative_items: [], quantitative_preset_name: null, sort_order: order++ });
  }
  for (const name of REPORT_NAMES) {
    const live = liveByName[name];
    const mappingId = (live && live.mapping_id) ? live.mapping_id : REPORT_FALLBACK_IDS[name];
    if (!live) report.notFoundInSettings.push(name);
    await upsert({ name, mapping_id: mappingId, type: "text", is_core: false, is_time: false, role_filter: null,
      report_type: (live && live.report_type) || null,
      options: toStrArr(live && live.options),
      sub_options: Array.isArray(live && live.sub_options) ? live.sub_options : [],
      quantitative_items: toStrArr(live && live.quantitative_items),
      quantitative_preset_name: (live && live.quantitative_preset_name) || null, sort_order: order++ });
  }
  for (const w of WORKERS) {
    await upsert({ name: w.name, mapping_id: w.id, type: "worker", role_filter: w.name, is_core: false, is_time: false,
      report_type: null, options: [], sub_options: [], quantitative_items: [], quantitative_preset_name: null, sort_order: order++ });
  }

  report.total = report.created + report.updated;
  return Response.json({ success: report.failed === 0, report });
});