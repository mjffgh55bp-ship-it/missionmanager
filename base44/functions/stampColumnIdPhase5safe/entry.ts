import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const report = {
    templates: { checked: 0, modified: 0, colsStamped: 0, errors: 0 },
    presets:   { checked: 0, modified: 0, colsStamped: 0, errors: 0 },
    daily:     { checked: 0, modified: 0, colsStamped: 0, errors: 0 },
    registryCount: 0,
    unmappedNames: [],
  };

  // Build name -> mapping_id from the (already populated) registry
  const cols = await base44.asServiceRole.entities.ScheduleColumn.list('-created_date', 500);
  report.registryCount = cols.length;
  if (cols.length === 0) return Response.json({ error: "Registry empty — run the populate step first." }, { status: 400 });
  const nameToId = {};
  cols.forEach(c => { if (c.name && c.mapping_id) nameToId[c.name.trim()] = c.mapping_id; });

  const noteUnmapped = (nm) => {
    if (nm && !nameToId[nm.trim()] && report.unmappedNames.length < 30 && !report.unmappedNames.includes(nm)) report.unmappedNames.push(nm);
  };

  // Stamp one columns array (additive). Returns { out, changed }.
  const stampCols = (arr, bucket) => {
    let changed = false;
    const out = (arr || []).map(col => {
      const id = nameToId[(col.name || '').trim()];
      if (!id) { noteUnmapped(col.name); return col; }
      if (col.column_id === id) return col;          // already stamped
      changed = true; bucket.colsStamped++;
      return { ...col, column_id: id };              // keep name
    });
    return { out, changed };
  };

  // ── Templates ──
  const templates = await base44.asServiceRole.entities.Template.list('created_date', 500);
  report.templates.checked = templates.length;
  for (const t of templates) {
    const { out, changed } = stampCols(t.columns, report.templates);
    if (!changed) continue;
    try {
      await base44.asServiceRole.entities.Template.update(t.id, { columns: out });
      report.templates.modified++;
      await sleep(80);                               // pace writes to avoid the rate limit
    } catch (e) {
      report.templates.errors++; console.error("Template stamp failed:", t.id, e);
      await sleep(400);                              // back off, then keep going
    }
  }

  // ── MokedPresets ──
  const presets = await base44.asServiceRole.entities.MokedPreset.list('created_date', 500);
  report.presets.checked = presets.length;
  for (const p of presets) {
    const cfg = p.template_config || {};
    const { out, changed } = stampCols(cfg.columns, report.presets);
    if (!changed) continue;
    try {
      await base44.asServiceRole.entities.MokedPreset.update(p.id, { template_config: { ...cfg, columns: out } });
      report.presets.modified++;
      await sleep(80);
    } catch (e) {
      report.presets.errors++; console.error("Preset stamp failed:", p.id, e);
      await sleep(400);
    }
  }

  // ── Daily columns settings ──
  const allSettings = await base44.asServiceRole.entities.AppSettings.list('created_date', 500);
  const daily = allSettings.filter(s => s.setting_key && s.setting_key.startsWith('schedule_daily_columns_'));
  report.daily.checked = daily.length;
  for (const s of daily) {
    let data = {};
    try { data = JSON.parse(s.setting_value) || {}; } catch { continue; }
    let changed = false;
    const newData = {};
    for (const [tid, arr] of Object.entries(data)) {
      const r = stampCols(arr, report.daily);
      newData[tid] = r.out;
      if (r.changed) changed = true;
    }
    if (!changed) continue;
    try {
      await base44.asServiceRole.entities.AppSettings.update(s.id, { setting_value: JSON.stringify(newData) });
      report.daily.modified++;
      await sleep(80);
    } catch (e) {
      report.daily.errors++; console.error("Daily stamp failed:", s.id, e);
      await sleep(400);
    }
  }

  const totalErrors = report.templates.errors + report.presets.errors + report.daily.errors;
  return Response.json({ success: totalErrors === 0, partial: totalErrors > 0, report });
});