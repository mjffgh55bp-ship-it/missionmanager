import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, AlertTriangle, CheckCircle2, Loader2, X, ChevronDown, ChevronUp, Info } from "lucide-react";
import {
  sanitizeText, isEmpty, normalizeForMatch,
  SHEET_AVAIL_SUBMISSIONS, SHEET_AVAIL_WINDOWS, SHEET_UNAVAIL_WINDOWS, SHEET_WORKERS_MAP,
} from "@/lib/dataTransferSchema";
import { fetchWithRetry } from "@/lib/appDataCache";

// ── Sheet parser ──────────────────────────────────────────────────────────────
function parseSheet(ws) {
  if (!ws) return { headers: [], rows: [] };
  const raw = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
  if (raw.length < 1) return { headers: [], rows: [] };
  const headers = raw[0].map(h => String(h ?? "").trim());
  const rows = raw.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i] !== undefined && r[i] !== null ? String(r[i]).trim() : ""; });
    return obj;
  }).filter(row => Object.values(row).some(v => v !== ""));
  return { headers, rows };
}

const VALID_SHIFT_TYPES = new Set(["wanted", "available", "unavailable"]);
const VALID_UNAVAIL_REASONS = new Set(["overseas", "occupied"]);
const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateShift(shift) {
  const errs = [];
  if (!shift.date || !DATE_RE.test(shift.date))     errs.push("תאריך לא תקין");
  if (!shift.start_time || !TIME_RE.test(shift.start_time)) errs.push("שעת התחלה לא תקינה");
  if (!shift.end_time   || !TIME_RE.test(shift.end_time))   errs.push("שעת סיום לא תקינה");
  if (!VALID_SHIFT_TYPES.has(shift.type))            errs.push(`סוג "${shift.type}" לא חוקי`);
  if (shift.priority !== "" && isNaN(Number(shift.priority))) errs.push("עדיפות לא מספרית");
  return errs;
}

const STATUS_STYLES = {
  תקין: "bg-green-100 text-green-800", דולג: "bg-yellow-100 text-yellow-800",
  שגיאה: "bg-red-100 text-red-800",   עודכן: "bg-blue-100 text-blue-800",
  יובא:  "bg-emerald-100 text-emerald-800", אזהרה: "bg-orange-100 text-orange-800",
};

function StatusBadge({ status, tooltip }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium cursor-help ${STATUS_STYLES[status] || "bg-gray-100 text-gray-700"}`}
      title={tooltip || ""}
    >{status}</span>
  );
}

function CollapsibleSection({ title, open, onToggle, icon, children }) {
  return (
    <Card className="border shadow-sm">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
        <span className="flex items-center gap-2">{icon}{title}</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <CardContent className="p-0">{children}</CardContent>}
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AvailabilityImportPanel({ currentUser, onAuditLog }) {
  const fileRef = useRef();
  const [fileName, setFileName]       = useState("");
  const [rawSheets, setRawSheets]     = useState(null);
  const [preview, setPreview]         = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying]       = useState(false);
  const [result, setResult]           = useState(null);
  const [parseError, setParseError]   = useState("");
  const [showAvailDiag, setShowAvailDiag] = useState(true);
  const [showUnavailDiag, setShowUnavailDiag] = useState(false);

  const reset = () => {
    setFileName(""); setRawSheets(null); setPreview(null);
    setResult(null); setParseError(""); setShowAvailDiag(true); setShowUnavailDiag(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Step 1: Read file ───────────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx")) { setParseError("יש להעלות קובץ XLSX בלבד."); return; }
    setFileName(file.name);
    setParseError(""); setRawSheets(null); setPreview(null); setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: "array" });
      const sheetNames = wb.SheetNames;

      if (!sheetNames.includes(SHEET_AVAIL_SUBMISSIONS)) {
        setParseError(`הקובץ אינו מכיל גיליון "${SHEET_AVAIL_SUBMISSIONS}". יש לייצא קובץ זמינות ממערכת זו.`);
        return;
      }

      const sheets = {
        submissions:   parseSheet(wb.Sheets[SHEET_AVAIL_SUBMISSIONS]),
        windows:       parseSheet(wb.Sheets[SHEET_AVAIL_WINDOWS]),
        unavailWindows: parseSheet(wb.Sheets[SHEET_UNAVAIL_WINDOWS]),
        workersMap:    parseSheet(wb.Sheets[SHEET_WORKERS_MAP]),
      };
      setRawSheets(sheets);
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Step 2: Build preview ───────────────────────────────────────────────────
  const handleBuildPreview = async () => {
    if (!rawSheets) return;
    setLoadingPreview(true);

    const workers = await fetchWithRetry(() => base44.entities.Worker.list());
    await new Promise(r => setTimeout(r, 200));

    // Worker lookups
    const workerById      = {};
    const workerByMappingId = {};
    const workerByNick    = {};
    const workerByName    = {};
    workers.forEach(w => {
      workerById[w.id] = w;
      if (w.worker_mapping_id) workerByMappingId[w.worker_mapping_id] = w;
      if (w.nickname) workerByNick[normalizeForMatch(w.nickname)] = w;
      if (w.full_name) workerByName[normalizeForMatch(w.full_name)] = w;
    });

    // Build incoming id→mapping_id from the imported workers map sheet
    const importedIdToMappingId = {};
    rawSheets.workersMap.rows.forEach(iw => {
      const id = iw.worker_id?.trim();
      const mid = iw.worker_mapping_id?.trim();
      if (id && mid) importedIdToMappingId[id] = mid;
      // Also supplement nick fallback
      if (id && workerById[id]) {
        const nick = normalizeForMatch(iw.nickname || "");
        if (nick && !workerByNick[nick]) workerByNick[nick] = workerById[id];
      }
    });

    // Resolve worker from imported submission
    const resolveWorker = (workerId, workerName) => {
      // 1. Stable cross-network id (survives renames) — highest priority
      const mid = workerId ? importedIdToMappingId[workerId] : null;
      if (mid && workerByMappingId[mid]) return workerByMappingId[mid];
      // 2. Same-network DB id (works only if same network)
      if (workerId && workerById[workerId]) return workerById[workerId];
      // 3. Legacy fallbacks by name (last resort)
      const byNick = workerByNick[normalizeForMatch(workerName || "")];
      if (byNick) return byNick;
      const byName = workerByName[normalizeForMatch(workerName || "")];
      if (byName) return byName;
      return null;
    };

    // Group windows by availability_id
    const windowsByAvailId = {};
    rawSheets.windows.rows.forEach(w => {
      const id = w.availability_id;
      if (!windowsByAvailId[id]) windowsByAvailId[id] = [];
      windowsByAvailId[id].push(w);
    });

    // Load existing availability for relevant week_start_dates
    const allWeekStarts = [...new Set(rawSheets.submissions.rows.map(r => r.week_start_date).filter(Boolean))];
    let existingAvailList = [];
    if (allWeekStarts.length > 0) {
      // Staggered to avoid rate limits
      for (const ws of allWeekStarts) {
        const batch = await fetchWithRetry(() => base44.entities.Availability.filter({ week_start_date: ws }));
        existingAvailList.push(...batch);
        await new Promise(r => setTimeout(r, 200));
      }
    }
    // Index existing by (worker_id, week_start_date)
    const existingByKey = {};
    existingAvailList.forEach(a => {
      existingByKey[`${a.worker_id}::${a.week_start_date}`] = a;
    });

    // Load existing unavailability for date range
    const allDates = rawSheets.unavailWindows.rows.map(r => r.date).filter(Boolean).sort();
    const minDate = allDates[0] || "";
    const maxDate = allDates[allDates.length - 1] || "";
    let existingUnavail = [];
    if (minDate && maxDate) {
      await new Promise(r => setTimeout(r, 200));
      const allUnavail = await fetchWithRetry(() => base44.entities.Unavailability.list());
      existingUnavail = allUnavail.filter(u => u.date >= minDate && u.date <= maxDate);
    }

    // ── Build availability plan ───────────────────────────────────────────────
    const availPlan = [];
    rawSheets.submissions.rows.forEach((sub, i) => {
      const worker = resolveWorker(sub.worker_id, sub.worker_name);
      if (!worker) {
        availPlan.push({
          status: "שגיאה",
          errors: [`העובד "${sub.worker_name || sub.worker_id}" לא קיים במערכת היעד`],
          sub, action: "skip",
        });
        return;
      }

      if (!sub.week_start_date || !DATE_RE.test(sub.week_start_date)) {
        availPlan.push({ status: "שגיאה", errors: ["תאריך שבוע לא תקין"], sub, action: "skip" });
        return;
      }

      const existingRecord = existingByKey[`${worker.id}::${sub.week_start_date}`];

      // Parse windows for this availability
      const importedWindows = windowsByAvailId[sub.availability_id] || [];
      const validWindows = [];
      const invalidWindows = [];
      importedWindows.forEach(w => {
        const errs = validateShift({ ...w, type: w.type || "available" });
        if (errs.length > 0) invalidWindows.push({ ...w, errs });
        else validWindows.push({
          date: w.date,
          start_time: w.start_time,
          end_time: w.end_time,
          type: w.type || "available",
          priority: w.priority !== "" && w.priority != null ? Number(w.priority) : undefined,
        });
      });

      // Determine which windows are new vs already exist
      const existingShifts = existingRecord?.shifts || [];
      const shiftsToAdd = [];
      const shiftsAlreadyExist = [];
      validWindows.forEach(vw => {
        const dup = existingShifts.find(es =>
          es.date === vw.date &&
          es.start_time === vw.start_time &&
          es.end_time === vw.end_time &&
          es.type === vw.type
        );
        if (dup) shiftsAlreadyExist.push(vw);
        else shiftsToAdd.push(vw);
      });

      // Parse extra_tasks
      let extraTasks = null;
      if (sub.extra_tasks_json && sub.extra_tasks_json.trim()) {
        try { extraTasks = JSON.parse(sub.extra_tasks_json); } catch { /* ignore */ }
      }

      availPlan.push({
        status: invalidWindows.length > 0 ? "אזהרה" : "תקין",
        errors: [],
        warnings: invalidWindows.map(w => `חלון לא תקין: ${w.date} ${w.start_time}-${w.end_time}: ${w.errs.join(", ")}`),
        sub, worker, existingRecord, extraTasks,
        shiftsToAdd, shiftsAlreadyExist, invalidWindows,
        action: existingRecord ? "update" : "create",
      });
    });

    // ── Build unavailability plan ─────────────────────────────────────────────
    const unavailPlan = [];
    rawSheets.unavailWindows.rows.forEach(u => {
      const worker = resolveWorker(u.worker_id, u.worker_name);
      if (!worker) {
        unavailPlan.push({
          status: "שגיאה",
          errors: [`העובד "${u.worker_name || u.worker_id}" לא קיים`],
          u, action: "skip",
        });
        return;
      }
      if (!u.date || !DATE_RE.test(u.date)) {
        unavailPlan.push({ status: "שגיאה", errors: ["תאריך לא תקין"], u, action: "skip" });
        return;
      }
      if (!TIME_RE.test(u.start_time) || !TIME_RE.test(u.end_time)) {
        unavailPlan.push({ status: "שגיאה", errors: ["שעה לא תקינה"], u, action: "skip" });
        return;
      }

      const reason = VALID_UNAVAIL_REASONS.has(u.reason) ? u.reason : "occupied";

      // Check for duplicate
      const dup = existingUnavail.find(e =>
        e.worker_id === worker.id &&
        e.date === u.date &&
        e.start_time === u.start_time &&
        e.end_time === u.end_time
      );

      if (dup) {
        unavailPlan.push({ status: "דולג", errors: [], u, worker, reason, action: "skip_dup" });
      } else {
        unavailPlan.push({ status: "תקין", errors: [], u, worker, reason, action: "create" });
      }
    });

    setPreview({ availPlan, unavailPlan });
    setLoadingPreview(false);
  };

  // ── Step 3: Apply ───────────────────────────────────────────────────────────
  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);

    let availCreated = 0, availUpdated = 0, unavailCreated = 0, skipped = 0, errors = 0;
    const failures = [];

    const applyWithRetry = async (fn, tries = 4) => {
      let lastErr;
      for (let i = 0; i < tries; i++) {
        try { return await fn(); }
        catch (e) {
          lastErr = e;
          await new Promise(r => setTimeout(r, 400 * (i + 1)));
        }
      }
      throw lastErr;
    };

    // Process availability
    for (const plan of preview.availPlan) {
      if (plan.action === "skip") { errors++; continue; }

      const newShifts = [...(plan.existingRecord?.shifts || []), ...plan.shiftsToAdd];

      try {
        if (plan.action === "create") {
          const data = {
            worker_id: plan.worker.id,
            worker_name: plan.worker.nickname || plan.worker.full_name || "",
            week_start_date: plan.sub.week_start_date,
            shifts: newShifts,
            status: plan.sub.status || "draft",
          };
          if (!isEmpty(plan.sub.desired_shifts)) data.desired_shifts = Number(plan.sub.desired_shifts);
          if (plan.extraTasks) data.extra_tasks = plan.extraTasks;
          if (!isEmpty(plan.sub.change_request)) data.change_request = plan.sub.change_request;
          await applyWithRetry(() => base44.entities.Availability.create(data));
          availCreated++;
        } else if (plan.action === "update" && plan.existingRecord) {
          const updates = { shifts: newShifts };
          if (!isEmpty(plan.sub.status)) updates.status = plan.sub.status;
          if (!isEmpty(plan.sub.desired_shifts)) updates.desired_shifts = Number(plan.sub.desired_shifts);
          if (plan.extraTasks) updates.extra_tasks = plan.extraTasks;
          if (!isEmpty(plan.sub.change_request)) updates.change_request = plan.sub.change_request;
          await applyWithRetry(() => base44.entities.Availability.update(plan.existingRecord.id, updates));
          availUpdated++;
        }
      } catch (e) {
        console.error("import write failed for", plan.worker?.nickname, e);
        failures.push(plan.worker?.nickname || plan.sub?.worker_name || "?");
      }
    }

    // Process unavailability
    for (const plan of preview.unavailPlan) {
      if (plan.action === "skip") { errors++; continue; }
      if (plan.action === "skip_dup") { skipped++; continue; }
      try {
        await applyWithRetry(() => base44.entities.Unavailability.create({
          worker_id: plan.worker.id,
          worker_name: plan.worker.nickname || plan.worker.full_name || "",
          date: plan.u.date,
          start_time: plan.u.start_time,
          end_time: plan.u.end_time,
          reason: plan.reason,
        }));
        unavailCreated++;
      } catch (e) {
        console.error("unavail write failed for", plan.worker?.nickname, e);
        failures.push(plan.worker?.nickname || plan.u?.worker_name || "?");
      }
    }

    await base44.entities.AuditLog.create({
      action_type: "import",
      file_name: fileName,
      user_email: currentUser?.email || "",
      user_name: currentUser?.full_name || "",
      row_count: preview.availPlan.length + preview.unavailPlan.length,
      imported_count: availCreated + unavailCreated,
      updated_count: availUpdated,
      skipped_count: skipped,
      error_count: errors,
      notes: `זמינות חדשה: ${availCreated}, עודכנה: ${availUpdated}, אי-זמינות: ${unavailCreated}`,
    });
    if (onAuditLog) onAuditLog();

    setResult({ availCreated, availUpdated, unavailCreated, skipped, errors, failures });
    setApplying(false);
    setPreview(null);
    if (failures.length > 0) {
      alert(`הייבוא הסתיים עם ${failures.length} כשלים (כנראה עקב חיבור רשת). העובדים שלא נקלטו: ${[...new Set(failures)].join(", ")}.
נסה לייבא שוב — פעולה זו בטוחה וניתנת לחזרה (הנתונים מתווספים, לא נמחקים).`);
    } else {
      alert(`הייבוא הושלם: ${availCreated} נוצרו, ${availUpdated} עודכנו, ${unavailCreated} אילוצים. ${errors > 0 ? errors + " דולגו." : ""}`);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" dir="rtl">

      {/* Upload */}
      {!rawSheets && !result && (
        <Card className="border shadow-sm">
          <CardContent className="pt-6">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600 font-medium">לחץ להעלאת קובץ XLSX של זמינות</span>
              <span className="text-xs text-gray-400 mt-1">קבצי ייצוא זמינות בלבד</span>
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
            </label>
            {parseError && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-sm text-red-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{parseError}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* File loaded */}
      {rawSheets && !preview && !result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-800 text-sm">{fileName}</span>
            <Button variant="ghost" size="sm" onClick={reset}><X className="w-4 h-4" /></Button>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 space-y-1">
            <div>קובץ זמינות זוהה בהצלחה.</div>
            <div className="text-xs text-blue-600">
              {rawSheets.submissions.rows.length} רשומות · {rawSheets.windows.rows.length} חלונות · {rawSheets.unavailWindows.rows.length} אי-זמינות
            </div>
          </div>
          <Button onClick={handleBuildPreview} disabled={loadingPreview} className="w-full bg-blue-900 hover:bg-blue-800">
            {loadingPreview
              ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />בודק נתונים...</>
              : "בדוק ייבוא — הצג תצוגה מקדימה"}
          </Button>
        </div>
      )}

      {/* Preview */}
      {preview && !result && (
        <AvailPreviewPanel
          preview={preview}
          fileName={fileName}
          showAvailDiag={showAvailDiag} setShowAvailDiag={setShowAvailDiag}
          showUnavailDiag={showUnavailDiag} setShowUnavailDiag={setShowUnavailDiag}
          applying={applying}
          onApply={handleApply}
          onCancel={reset}
        />
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-800">הייבוא הושלם</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["זמינות חדשה", result.availCreated, "text-emerald-700"],
                ["זמינות עודכנה", result.availUpdated, "text-blue-700"],
                ["אי-זמינות חדשה", result.unavailCreated, "text-emerald-700"],
                ["דולגו (כפולים)", result.skipped, "text-yellow-700"],
                ["שגיאות", result.errors, "text-red-700"],
              ].map(([label, val, color]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-600">{label}:</span>
                  <span className={`font-semibold ${color}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>
          <Button variant="outline" onClick={reset} className="w-full">ייבוא נוסף</Button>
        </div>
      )}
    </div>
  );
}

// ── Preview Panel ─────────────────────────────────────────────────────────────
function AvailPreviewPanel({ preview, fileName, showAvailDiag, setShowAvailDiag, showUnavailDiag, setShowUnavailDiag, applying, onApply, onCancel }) {
  const { availPlan, unavailPlan } = preview;
  const errCount    = availPlan.filter(r => r.status === "שגיאה").length;
  const warnCount   = availPlan.filter(r => r.status === "אזהרה").length;
  const newCount    = availPlan.filter(r => r.action === "create").length;
  const updCount    = availPlan.filter(r => r.action === "update").length;
  const newWins     = availPlan.reduce((s, r) => s + (r.shiftsToAdd?.length || 0), 0);
  const dupWins     = availPlan.reduce((s, r) => s + (r.shiftsAlreadyExist?.length || 0), 0);
  const unavailNew  = unavailPlan.filter(r => r.action === "create").length;
  const unavailSkip = unavailPlan.filter(r => r.action === "skip_dup").length;
  const unavailErr  = unavailPlan.filter(r => r.action === "skip").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 items-center flex-wrap">
          <span className="font-semibold text-gray-800 text-sm">{fileName}</span>
          <Badge variant="outline">{availPlan.length} רשומות זמינות</Badge>
          {errCount  > 0 && <Badge className="bg-red-100 text-red-800">{errCount} שגיאות</Badge>}
          {warnCount > 0 && <Badge className="bg-orange-100 text-orange-800">{warnCount} אזהרות</Badge>}
          {newCount  > 0 && <Badge className="bg-emerald-100 text-emerald-800">{newCount} חדשים</Badge>}
          {updCount  > 0 && <Badge className="bg-blue-100 text-blue-800">{updCount} עדכונים</Badge>}
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}><X className="w-4 h-4" /></Button>
      </div>

      {/* Summary info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="font-semibold text-blue-800 mb-1">חלונות זמינות</div>
          <div className="text-blue-700">חדשים: {newWins} | כפולים (ידולגו): {dupWins}</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-3">
          <div className="font-semibold text-purple-800 mb-1">אי-זמינות</div>
          <div className="text-purple-700">חדשים: {unavailNew} | כפולים: {unavailSkip} | שגיאות: {unavailErr}</div>
        </div>
      </div>

      {/* Availability diagnostics */}
      <CollapsibleSection
        title={`רשומות זמינות (${availPlan.length})`}
        open={showAvailDiag}
        onToggle={() => setShowAvailDiag(v => !v)}
        icon={<Info className="w-4 h-4" />}
      >
        <AvailDiagTable plan={availPlan} />
      </CollapsibleSection>

      {/* Unavailability diagnostics */}
      <CollapsibleSection
        title={`אי-זמינות (${unavailPlan.length})`}
        open={showUnavailDiag}
        onToggle={() => setShowUnavailDiag(v => !v)}
        icon={<Info className="w-4 h-4" />}
      >
        <UnavailDiagTable plan={unavailPlan} />
      </CollapsibleSection>

      {errCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          שורות עם שגיאות יידלגו. שאר הנתונים ייובאו.
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>ביטול</Button>
        <Button onClick={onApply} disabled={applying} className="bg-blue-900 hover:bg-blue-800">
          {applying ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מייבא...</> : "אישור וייבוא"}
        </Button>
      </div>
    </div>
  );
}

function AvailDiagTable({ plan }) {
  const [expanded, setExpanded] = useState(false);
  const display = expanded ? plan : plan.slice(0, 10);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" dir="rtl">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">עובד</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">שבוע</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">פעולה</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">חלונות חדשים</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">כפולים</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {display.map((row, i) => {
              const allMsgs = [...(row.errors || []), ...(row.warnings || [])];
              return (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-2 py-1 font-medium">{row.worker?.nickname || row.sub?.worker_name || "?"}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{row.sub?.week_start_date || "-"}</td>
                  <td className={`px-2 py-1 font-semibold ${row.action === "create" ? "text-emerald-700" : row.action === "update" ? "text-blue-700" : "text-gray-400"}`}>
                    {row.action === "create" ? "יצירה" : row.action === "update" ? "עדכון" : "דילוג"}
                  </td>
                  <td className="px-2 py-1 text-emerald-700">{row.shiftsToAdd?.length ?? "-"}</td>
                  <td className="px-2 py-1 text-gray-400">{row.shiftsAlreadyExist?.length ?? "-"}</td>
                  <td className="px-2 py-1">
                    <StatusBadge status={row.status} tooltip={allMsgs.join("; ")} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {plan.length > 10 && (
        <button onClick={() => setExpanded(!expanded)} className="w-full text-xs text-blue-700 py-2 hover:bg-blue-50 border-t flex items-center justify-center gap-1">
          {expanded ? <><ChevronUp className="w-3 h-3" />הצג פחות</> : <><ChevronDown className="w-3 h-3" />הצג את כל {plan.length} הרשומות</>}
        </button>
      )}
    </div>
  );
}

function UnavailDiagTable({ plan }) {
  const [expanded, setExpanded] = useState(false);
  const display = expanded ? plan : plan.slice(0, 10);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" dir="rtl">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">עובד</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">תאריך</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">שעות</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">סיבה</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {display.map((row, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="px-2 py-1 font-medium">{row.worker?.nickname || row.u?.worker_name || "?"}</td>
                <td className="px-2 py-1">{row.u?.date || "-"}</td>
                <td className="px-2 py-1">{row.u?.start_time}–{row.u?.end_time}</td>
                <td className="px-2 py-1 text-gray-500">{row.reason || row.u?.reason || "-"}</td>
                <td className="px-2 py-1">
                  <StatusBadge
                    status={row.status}
                    tooltip={(row.errors || []).join("; ")}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {plan.length > 10 && (
        <button onClick={() => setExpanded(!expanded)} className="w-full text-xs text-blue-700 py-2 hover:bg-blue-50 border-t flex items-center justify-center gap-1">
          {expanded ? <><ChevronUp className="w-3 h-3" />הצג פחות</> : <><ChevronDown className="w-3 h-3" />הצג את כל {plan.length} הרשומות</>}
        </button>
      )}
    </div>
  );
}