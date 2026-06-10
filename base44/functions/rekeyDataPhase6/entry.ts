import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Never re-key these — time + system keys stay name-keyed forever.
const PROTECTED = new Set([
  "_order", "_duplicated_from_row_id", "task", "is_continuation",
  "continuation_source_row_id", "continuation_from_date",
  "moked_instance_name", "moked_instance_name_locked", "status",
  "התחלה", "סיום", "תדריך", "שעת התחלה", "שעת סיום",
]);

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const report = {
    templateRows: { scanned: 0, changed: 0, idKeysAdded: 0 },
    assignments:  { scanned: 0, changed: 0, idKeysAdded: 0 },
    unknownKeys: [],
    registryCount: 0,
  };

  // ── Build name -> mapping_id from the registry; exclude time columns (they stay name-keyed) ──
  const cols = await base44.asServiceRole.entities.ScheduleColumn.list('-created_date', 500);
  report.registryCount = cols.length;
  const nameToId = {};
  const validIds = new Set();
  for (const c of cols) {
    if (!c.mapping_id) continue;
    validIds.add(c.mapping_id);
    if (c.is_time) continue;                 // never re-key time columns
    if (c.name) nameToId[c.name.trim()] = c.mapping_id;
  }

  if (report.registryCount === 0) {
    return Response.json({ error: "Registry empty — run populateAndStampPhase45 first." }, { status: 400 });
  }

  const noteUnknown = (k) => {
    if (report.unknownKeys.length < 30 && !report.unknownKeys.includes(k)) report.unknownKeys.push(k);
  };

  // Returns { out, added } or null if nothing changed. Additive only — never deletes a key.
  const rekey = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    const out = { ...obj };
    let added = 0;
    for (const key of Object.keys(obj)) {
      if (PROTECTED.has(key)) continue;
      if (key.endsWith("_subTypes")) continue;     // handled with its base key
      if (validIds.has(key)) continue;             // already an id key
      const id = nameToId[key.trim()];
      if (!id) { noteUnknown(key); continue; }      // unknown / unmapped name — leave it
      if (!(id in out)) { out[id] = obj[key]; added++; }
      const subName = `${key}_subTypes`;
      if (subName in obj) {
        const subId = `${id}_subTypes`;
        if (!(subId in out)) { out[subId] = obj[subName]; added++; }
      }
    }
    return added > 0 ? { out, added } : null;
  };

  // ── TemplateRow.values ──
  let trOffset = 0; const TR = 100;
  while (true) {
    const rows = await base44.asServiceRole.entities.TemplateRow.list('-created_date', TR, trOffset);
    if (!rows || rows.length === 0) break;
    report.templateRows.scanned += rows.length;
    for (const row of rows) {
      try {
        const res = rekey(row.values || {});
        if (res) {
          await base44.asServiceRole.entities.TemplateRow.update(row.id, { values: res.out });
          report.templateRows.changed++; report.templateRows.idKeysAdded += res.added;
        }
      } catch (e) { console.error("TemplateRow rekey failed:", row.id, e); }
    }
    if (rows.length < TR) break;
    trOffset += TR; await new Promise(r => setTimeout(r, 100));
  }

  // ── Assignment.column_values ──
  let aOffset = 0; const A = 100;
  while (true) {
    const asns = await base44.asServiceRole.entities.Assignment.list('-date', A, aOffset);
    if (!asns || asns.length === 0) break;
    report.assignments.scanned += asns.length;
    for (const asn of asns) {
      try {
        const res = rekey(asn.column_values || {});
        if (res) {
          await base44.asServiceRole.entities.Assignment.update(asn.id, { column_values: res.out });
          report.assignments.changed++; report.assignments.idKeysAdded += res.added;
        }
      } catch (e) { console.error("Assignment rekey failed:", asn.id, e); }
    }
    if (asns.length < A) break;
    aOffset += A; await new Promise(r => setTimeout(r, 100));
  }

  return Response.json({ success: true, report });
});