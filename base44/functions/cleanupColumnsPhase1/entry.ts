import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DELETE_NAMES = [
  "גזרה","הערות","מס״ז","צרכן","קרון","תפקיד",
  "שף","סו-שף","מדריך","מנהל ורצ\"ת","מנל\"ח","מנל״ח","נהג1","נהג3",
  "נוסף","עובד","שף / שף 2","סו שף"
];

const DELETE_SET = new Set(DELETE_NAMES);

// Keys that must never be touched regardless
const SYSTEM_KEYS = new Set([
  "_order","_duplicated_from_row_id","task","is_continuation",
  "continuation_source_row_id","continuation_from_date",
  "moked_instance_name","moked_instance_name_locked",
  "התחלה","סיום","תדריך","שעת התחלה","שעת סיום","status"
]);

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const report = {
    templates: { checked: 0, modified: 0, colsRemoved: 0 },
    presets: { checked: 0, modified: 0, colsRemoved: 0 },
    templateRows: { checked: 0, modified: 0, keysRemoved: 0 },
    assignments: { checked: 0, modified: 0, keysRemoved: 0 },
    dailySettings: { checked: 0, modified: 0, colsRemoved: 0 },
    removedByName: {},
  };

  const trackRemoval = (name) => {
    report.removedByName[name] = (report.removedByName[name] || 0) + 1;
  };

  // ── 1. Templates ──
  const templates = await base44.asServiceRole.entities.Template.list('created_date', 200);
  report.templates.checked = templates.length;
  for (const tmpl of templates) {
    const cols = tmpl.columns || [];
    const filtered = cols.filter(c => {
      if (DELETE_SET.has(c.name)) { trackRemoval(c.name); return false; }
      return true;
    });
    if (filtered.length < cols.length) {
      await base44.asServiceRole.entities.Template.update(tmpl.id, { columns: filtered });
      report.templates.modified++;
      report.templates.colsRemoved += (cols.length - filtered.length);
    }
  }

  // ── 2. MokedPresets ──
  const presets = await base44.asServiceRole.entities.MokedPreset.list('created_date', 200);
  report.presets.checked = presets.length;
  for (const preset of presets) {
    const config = preset.template_config || {};
    const cols = config.columns || [];
    const filtered = cols.filter(c => {
      if (DELETE_SET.has(c.name)) { trackRemoval(c.name); return false; }
      return true;
    });

    // Also clean default_rows keys
    const cleanedRows = (config.default_rows || []).map(row => {
      const cleaned = { ...row };
      for (const name of DELETE_NAMES) {
        delete cleaned[name];
        delete cleaned[`${name}_subTypes`];
      }
      return cleaned;
    });

    if (filtered.length < cols.length || JSON.stringify(cleanedRows) !== JSON.stringify(config.default_rows || [])) {
      await base44.asServiceRole.entities.MokedPreset.update(preset.id, {
        template_config: { ...config, columns: filtered, default_rows: cleanedRows }
      });
      report.presets.modified++;
      report.presets.colsRemoved += (cols.length - filtered.length);
    }
  }

  // ── 3. TemplateRows ──
  let trOffset = 0;
  const TR_BATCH = 100;
  while (true) {
    const rows = await base44.asServiceRole.entities.TemplateRow.list('-created_date', TR_BATCH, trOffset);
    if (!rows || rows.length === 0) break;
    report.templateRows.checked += rows.length;

    for (const row of rows) {
      const vals = row.values || {};
      let changed = false;
      const newVals = { ...vals };
      for (const name of DELETE_NAMES) {
        if (SYSTEM_KEYS.has(name)) continue;
        if (name in newVals) { delete newVals[name]; changed = true; report.templateRows.keysRemoved++; trackRemoval(name); }
        const subKey = `${name}_subTypes`;
        if (subKey in newVals) { delete newVals[subKey]; changed = true; report.templateRows.keysRemoved++; }
      }
      if (changed) {
        await base44.asServiceRole.entities.TemplateRow.update(row.id, { values: newVals });
        report.templateRows.modified++;
      }
    }

    if (rows.length < TR_BATCH) break;
    trOffset += TR_BATCH;
    await new Promise(r => setTimeout(r, 100));
  }

  // ── 4. Assignments ──
  let aOffset = 0;
  const A_BATCH = 100;
  while (true) {
    const assignments = await base44.asServiceRole.entities.Assignment.list('-date', A_BATCH, aOffset);
    if (!assignments || assignments.length === 0) break;
    report.assignments.checked += assignments.length;

    for (const asn of assignments) {
      const cv = asn.column_values || {};
      let changed = false;
      const newCv = { ...cv };
      for (const name of DELETE_NAMES) {
        if (SYSTEM_KEYS.has(name)) continue;
        if (name in newCv) { delete newCv[name]; changed = true; report.assignments.keysRemoved++; trackRemoval(name); }
        const subKey = `${name}_subTypes`;
        if (subKey in newCv) { delete newCv[subKey]; changed = true; report.assignments.keysRemoved++; }
      }
      if (changed) {
        await base44.asServiceRole.entities.Assignment.update(asn.id, { column_values: newCv });
        report.assignments.modified++;
      }
    }

    if (assignments.length < A_BATCH) break;
    aOffset += A_BATCH;
    await new Promise(r => setTimeout(r, 100));
  }

  // ── 5. Daily columns in AppSettings (schedule_daily_columns_*) ──
  const allSettings = await base44.asServiceRole.entities.AppSettings.list('created_date', 500);
  const dailySettings = allSettings.filter(s => s.setting_key && s.setting_key.startsWith('schedule_daily_columns_'));
  report.dailySettings.checked = dailySettings.length;

  for (const setting of dailySettings) {
    let data = {};
    try { data = JSON.parse(setting.setting_value) || {}; } catch { continue; }

    let changed = false;
    const newData = {};
    for (const [templateId, cols] of Object.entries(data)) {
      const filtered = (cols || []).filter(c => {
        if (DELETE_SET.has(c.name)) { trackRemoval(c.name); changed = true; report.dailySettings.colsRemoved++; return false; }
        return true;
      });
      newData[templateId] = filtered;
    }

    if (changed) {
      await base44.asServiceRole.entities.AppSettings.update(setting.id, {
        setting_value: JSON.stringify(newData)
      });
      report.dailySettings.modified++;
    }
  }

  return Response.json({ success: true, report });
});