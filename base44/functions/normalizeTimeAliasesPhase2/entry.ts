import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// [alias, canonical]
const ALIASES = [
  ["שעת התחלה", "התחלה"],
  ["שעת סיום",  "סיום"],
];

const isEmpty = (v) => v === undefined || v === null || v === "";

// Normalize one values/column_values object in place on a copy.
// Returns { out, changed, moved, removed: {aliasName: count} } or null if unchanged.
function normalizeObj(obj) {
  if (!obj || typeof obj !== "object") return null;
  let changed = false, moved = 0;
  const removed = {};
  const out = { ...obj };

  for (const [alias, canon] of ALIASES) {
    // main key
    if (alias in out) {
      if (isEmpty(out[canon]) && !isEmpty(out[alias])) { out[canon] = out[alias]; moved++; }
      delete out[alias];                                  // canonical already set → just drop alias
      changed = true;
      removed[alias] = (removed[alias] || 0) + 1;
    }
    // _subTypes companion
    const aliasSub = `${alias}_subTypes`;
    const canonSub = `${canon}_subTypes`;
    if (aliasSub in out) {
      if (isEmpty(out[canonSub]) && !isEmpty(out[aliasSub])) { out[canonSub] = out[aliasSub]; moved++; }
      delete out[aliasSub];
      changed = true;
      removed[aliasSub] = (removed[aliasSub] || 0) + 1;
    }
  }

  return changed ? { out, moved, removed } : null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const report = {
    templateRows: { scanned: 0, changed: 0, valuesMoved: 0, aliasesRemoved: {} },
    assignments:  { scanned: 0, changed: 0, valuesMoved: 0, aliasesRemoved: {} },
    samplesChanged: { templateRows: [], assignments: [] },
  };

  const bump = (bucket, removed) => {
    for (const [k, n] of Object.entries(removed)) {
      bucket.aliasesRemoved[k] = (bucket.aliasesRemoved[k] || 0) + n;
    }
  };

  // ── TemplateRow.values ──
  let trOffset = 0;
  const TR_BATCH = 100;
  while (true) {
    const rows = await base44.asServiceRole.entities.TemplateRow.list('-created_date', TR_BATCH, trOffset);
    if (!rows || rows.length === 0) break;
    report.templateRows.scanned += rows.length;

    for (const row of rows) {
      try {
        const res = normalizeObj(row.values || {});
        if (res) {
          if (report.samplesChanged.templateRows.length < 5) {
            report.samplesChanged.templateRows.push({ id: row.id, before: row.values, after: res.out });
          }
          await base44.asServiceRole.entities.TemplateRow.update(row.id, { values: res.out });
          report.templateRows.changed++;
          report.templateRows.valuesMoved += res.moved;
          bump(report.templateRows, res.removed);
        }
      } catch (e) {
        console.error("TemplateRow normalize failed:", row.id, e);
      }
    }

    if (rows.length < TR_BATCH) break;
    trOffset += TR_BATCH;
    await new Promise(r => setTimeout(r, 100));
  }

  // ── Assignment.column_values ──
  let aOffset = 0;
  const A_BATCH = 100;
  while (true) {
    const asns = await base44.asServiceRole.entities.Assignment.list('-date', A_BATCH, aOffset);
    if (!asns || asns.length === 0) break;
    report.assignments.scanned += asns.length;

    for (const asn of asns) {
      try {
        const res = normalizeObj(asn.column_values || {});
        if (res) {
          if (report.samplesChanged.assignments.length < 5) {
            report.samplesChanged.assignments.push({ id: asn.id, before: asn.column_values, after: res.out });
          }
          await base44.asServiceRole.entities.Assignment.update(asn.id, { column_values: res.out });
          report.assignments.changed++;
          report.assignments.valuesMoved += res.moved;
          bump(report.assignments, res.removed);
        }
      } catch (e) {
        console.error("Assignment normalize failed:", asn.id, e);
      }
    }

    if (asns.length < A_BATCH) break;
    aOffset += A_BATCH;
    await new Promise(r => setTimeout(r, 100));
  }

  return Response.json({ success: true, report });
});