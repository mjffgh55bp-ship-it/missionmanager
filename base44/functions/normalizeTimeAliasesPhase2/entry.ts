import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Legacy alias → canonical key pairs to normalize
const ALIASES = [
  { alias: "שעת התחלה", canonical: "התחלה" },
  { alias: "שעת סיום",  canonical: "סיום"  },
];

/**
 * Normalize one values object (TemplateRow.values or Assignment.column_values).
 * Returns { newObj, changed, valuesMoved, aliasesRemoved }.
 */
function normalizeValues(vals) {
  const newObj = { ...vals };
  let changed = false;
  let valuesMoved = 0;
  const aliasesRemoved = {};

  for (const { alias, canonical } of ALIASES) {
    // Main key
    if (alias in newObj) {
      const aliasVal = newObj[alias];
      const canonicalVal = newObj[canonical];
      // Move only if canonical is missing/empty
      if (!canonicalVal && aliasVal) {
        newObj[canonical] = aliasVal;
        valuesMoved++;
      }
      delete newObj[alias];
      aliasesRemoved[alias] = (aliasesRemoved[alias] || 0) + 1;
      changed = true;
    }
    // _subTypes companion
    const aliasSubKey = `${alias}_subTypes`;
    const canonicalSubKey = `${canonical}_subTypes`;
    if (aliasSubKey in newObj) {
      const aliasSubVal = newObj[aliasSubKey];
      const canonicalSubVal = newObj[canonicalSubKey];
      if (!canonicalSubVal && aliasSubVal) {
        newObj[canonicalSubKey] = aliasSubVal;
        valuesMoved++;
      }
      delete newObj[aliasSubKey];
      changed = true;
    }
  }

  return { newObj, changed, valuesMoved, aliasesRemoved };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const report = {
    templateRows: {
      scanned: 0, changed: 0, valuesMoved: 0,
      aliasesRemoved: { "שעת התחלה": 0, "שעת סיום": 0 },
    },
    assignments: {
      scanned: 0, changed: 0, valuesMoved: 0,
      aliasesRemoved: { "שעת התחלה": 0, "שעת סיום": 0 },
    },
    samplesChanged: [],
  };

  const BATCH = 100;

  // ── 1. TemplateRows ──
  let trOffset = 0;
  while (true) {
    const rows = await base44.asServiceRole.entities.TemplateRow.list('-created_date', BATCH, trOffset);
    if (!rows || rows.length === 0) break;
    report.templateRows.scanned += rows.length;

    for (const row of rows) {
      const vals = row.values || {};
      const { newObj, changed, valuesMoved, aliasesRemoved } = normalizeValues(vals);
      if (changed) {
        try {
          await base44.asServiceRole.entities.TemplateRow.update(row.id, { values: newObj });
          report.templateRows.changed++;
          report.templateRows.valuesMoved += valuesMoved;
          for (const [k, v] of Object.entries(aliasesRemoved)) {
            report.templateRows.aliasesRemoved[k] = (report.templateRows.aliasesRemoved[k] || 0) + v;
          }
          if (report.samplesChanged.length < 5) {
            report.samplesChanged.push({ entity: "TemplateRow", id: row.id, before: vals, after: newObj });
          }
        } catch (e) {
          console.error(`TemplateRow ${row.id} update failed:`, e.message);
        }
      }
    }

    if (rows.length < BATCH) break;
    trOffset += BATCH;
    await new Promise(r => setTimeout(r, 100));
  }

  // ── 2. Assignments ──
  let aOffset = 0;
  while (true) {
    const assignments = await base44.asServiceRole.entities.Assignment.list('-date', BATCH, aOffset);
    if (!assignments || assignments.length === 0) break;
    report.assignments.scanned += assignments.length;

    for (const asn of assignments) {
      const cv = asn.column_values || {};
      const { newObj, changed, valuesMoved, aliasesRemoved } = normalizeValues(cv);
      if (changed) {
        try {
          await base44.asServiceRole.entities.Assignment.update(asn.id, { column_values: newObj });
          report.assignments.changed++;
          report.assignments.valuesMoved += valuesMoved;
          for (const [k, v] of Object.entries(aliasesRemoved)) {
            report.assignments.aliasesRemoved[k] = (report.assignments.aliasesRemoved[k] || 0) + v;
          }
          if (report.samplesChanged.length < 10) {
            report.samplesChanged.push({ entity: "Assignment", id: asn.id, before: cv, after: newObj });
          }
        } catch (e) {
          console.error(`Assignment ${asn.id} update failed:`, e.message);
        }
      }
    }

    if (assignments.length < BATCH) break;
    aOffset += BATCH;
    await new Promise(r => setTimeout(r, 100));
  }

  return Response.json({ success: true, report });
});