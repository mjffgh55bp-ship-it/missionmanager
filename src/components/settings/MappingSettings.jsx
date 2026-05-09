import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Link, ChevronDown, ChevronUp } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function genMappingId(name) {
  return "col_" + name.toLowerCase().replace(/[^a-z0-9א-ת]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
}
function genTemplateMappingId(name) {
  return "moked_" + name.toLowerCase().replace(/[^a-z0-9א-ת]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
}

// ── Column mapping row ─────────────────────────────────────────────────────────
function ColMappingRow({ col, allCols, onChange }) {
  const isDuplicate = col.mapping_id &&
    allCols.filter(c => c !== col && c.mapping_id === col.mapping_id).length > 0;

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${isDuplicate ? "border-orange-400 bg-orange-50" : "border-gray-200"}`} dir="rtl">
      <div className="flex items-center gap-2 justify-between">
        <span className="font-medium text-sm">{col.name}</span>
        {isDuplicate && (
          <Badge className="bg-orange-100 text-orange-700 text-xs">
            <AlertTriangle className="w-3 h-3 mr-1" />מזהה כפול
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">מזהה מיפוי (mapping_id)</label>
          <div className="flex gap-1">
            <Input
              value={col.mapping_id || ""}
              onChange={e => onChange({ ...col, mapping_id: e.target.value.trim() })}
              placeholder="col_..."
              className="h-7 text-xs font-mono"
              dir="ltr"
            />
            {!col.mapping_id && (
              <Button size="sm" variant="outline" className="h-7 text-xs px-2 shrink-0"
                onClick={() => onChange({ ...col, mapping_id: genMappingId(col.name) })}>
                הצע
              </Button>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">שם ייצוא (export_name) — אופציונלי</label>
          <Input
            value={col.export_name || ""}
            onChange={e => onChange({ ...col, export_name: e.target.value })}
            placeholder={col.name + " (ברירת מחדל: שם מקומי)"}
            className="h-7 text-xs"
            dir="rtl"
          />
        </div>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
          <Switch
            checked={col.is_exportable !== false}
            onCheckedChange={v => onChange({ ...col, is_exportable: v })}
          />
          ייצוא מופעל
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
          <Switch
            checked={col.is_importable !== false}
            onCheckedChange={v => onChange({ ...col, is_importable: v })}
          />
          ייבוא מופעל
        </label>
      </div>
    </div>
  );
}

// ── Template mapping row ───────────────────────────────────────────────────────
function TmplMappingRow({ tmpl, allTmpls, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ mapping_id: tmpl.mapping_id || "", export_name: tmpl.export_name || "", is_exportable: tmpl.is_exportable !== false, is_importable: tmpl.is_importable !== false });
  const [saving, setSaving] = useState(false);

  const isDuplicate = draft.mapping_id && allTmpls.filter(t => t.id !== tmpl.id && t.mapping_id === draft.mapping_id).length > 0;

  const handleSave = async () => {
    setSaving(true);
    await onSave(tmpl.id, draft);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className={`border rounded-lg p-3 ${isDuplicate ? "border-orange-400 bg-orange-50" : "border-gray-200"}`} dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-medium text-sm truncate">{tmpl.name}</span>
          {tmpl.mapping_id && (
            <span className="text-xs font-mono text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{tmpl.mapping_id}</span>
          )}
          {!tmpl.mapping_id && (
            <span className="text-xs text-gray-400">ללא מזהה</span>
          )}
          {isDuplicate && <Badge className="bg-orange-100 text-orange-700 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />כפול</Badge>}
        </div>
        <button
          onClick={() => setEditing(v => !v)}
          className="text-xs text-blue-600 hover:text-blue-800 shrink-0"
        >
          {editing ? "סגור" : "ערוך"}
        </button>
      </div>
      {editing && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">מזהה מיפוי (mapping_id)</label>
              <div className="flex gap-1">
                <Input
                  value={draft.mapping_id}
                  onChange={e => setDraft(d => ({ ...d, mapping_id: e.target.value.trim() }))}
                  placeholder="moked_..."
                  className="h-7 text-xs font-mono"
                  dir="ltr"
                />
                {!draft.mapping_id && (
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2 shrink-0"
                    onClick={() => setDraft(d => ({ ...d, mapping_id: genTemplateMappingId(tmpl.name) }))}>
                    הצע
                  </Button>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">שם ייצוא (export_name)</label>
              <Input
                value={draft.export_name}
                onChange={e => setDraft(d => ({ ...d, export_name: e.target.value }))}
                placeholder={tmpl.name}
                className="h-7 text-xs"
                dir="rtl"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
              <Switch checked={draft.is_exportable} onCheckedChange={v => setDraft(d => ({ ...d, is_exportable: v }))} />
              ייצוא מופעל
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
              <Switch checked={draft.is_importable} onCheckedChange={v => setDraft(d => ({ ...d, is_importable: v }))} />
              ייבוא מופעל
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(false)}>ביטול</Button>
            <Button size="sm" className="h-7 text-xs bg-blue-900 hover:bg-blue-800" onClick={handleSave} disabled={saving || isDuplicate}>
              {saving ? "שומר..." : "שמור"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MappingSettings() {
  const [scheduleColumns, setScheduleColumns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [showTmpls, setShowTmpls] = useState(true);
  const [showCols, setShowCols] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [allSettings, allTemplates] = await Promise.all([
      base44.entities.AppSettings.list(),
      base44.entities.Template.list(),
    ]);
    const colsSetting = allSettings.find(s => s.setting_key === "custom_schedule_params");
    setScheduleColumns(colsSetting ? (JSON.parse(colsSetting.setting_value) || []) : []);
    setTemplates(allTemplates);
    setLoading(false);
  };

  const saveColumns = async (updated) => {
    setSaving(true);
    const settings = await base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" });
    const data = { setting_key: "custom_schedule_params", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setScheduleColumns(updated);
    setSaving(false);
  };

  const handleColChange = (idx, updatedCol) => {
    const updated = scheduleColumns.map((c, i) => i === idx ? updatedCol : c);
    saveColumns(updated);
  };

  const handleTemplateSave = async (tmplId, draft) => {
    await base44.entities.Template.update(tmplId, {
      mapping_id:    draft.mapping_id || null,
      export_name:   draft.export_name || null,
      is_exportable: draft.is_exportable,
      is_importable: draft.is_importable,
    });
    setTemplates(prev => prev.map(t => t.id === tmplId ? { ...t, ...draft } : t));
  };

  const colsMissingId = scheduleColumns.filter(c => !c.mapping_id);
  const tmplsMissingId = templates.filter(t => !t.mapping_id);
  const displayCols = showMissingOnly ? scheduleColumns.filter(c => !c.mapping_id) : scheduleColumns;
  const displayTmpls = showMissingOnly ? templates.filter(t => !t.mapping_id) : templates;

  if (loading) return <div className="text-sm text-gray-500 py-4 text-center" dir="rtl">טוען...</div>;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1">
        <p className="text-sm font-semibold text-blue-900 flex items-center gap-2">
          <Link className="w-4 h-4" />מזהי מיפוי לייצוא/ייבוא בין סביבות
        </p>
        <p className="text-xs text-blue-700">
          מזהה מיפוי (mapping_id) מאפשר זיהוי עמודות ומוקדים לפי מזהה יציב גם אם שמות מקומיים שונים בין סביבות (אזרחי ↔ מאובטח).
        </p>
        {(colsMissingId.length > 0 || tmplsMissingId.length > 0) && (
          <div className="flex items-center gap-2 mt-2 bg-orange-50 border border-orange-200 rounded p-2">
            <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
            <span className="text-xs text-orange-700">
              {colsMissingId.length > 0 && `${colsMissingId.length} עמודות`}
              {colsMissingId.length > 0 && tmplsMissingId.length > 0 && " ו-"}
              {tmplsMissingId.length > 0 && `${tmplsMissingId.length} מוקדים`}
              {" "}ללא מזהה מיפוי — ייצוא/ייבוא יתבסס על שם בלבד
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 mt-2">
          <Switch checked={showMissingOnly} onCheckedChange={setShowMissingOnly} />
          <span className="text-xs text-gray-600">הצג רק ללא מזהה מיפוי</span>
        </div>
      </div>

      {/* Templates */}
      <Card className="border shadow-sm">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          onClick={() => setShowTmpls(v => !v)}
        >
          <span>מוקדים / תבניות ({templates.length}){tmplsMissingId.length > 0 && <span className="text-orange-500 mr-2 text-xs">({tmplsMissingId.length} ללא מזהה)</span>}</span>
          {showTmpls ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showTmpls && (
          <CardContent className="space-y-2 pb-4">
            {displayTmpls.length === 0 && <p className="text-xs text-gray-400">אין תבניות להצגה</p>}
            {displayTmpls.map(tmpl => (
              <TmplMappingRow
                key={tmpl.id}
                tmpl={tmpl}
                allTmpls={templates}
                onSave={handleTemplateSave}
              />
            ))}
          </CardContent>
        )}
      </Card>

      {/* Schedule columns */}
      <Card className="border shadow-sm">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          onClick={() => setShowCols(v => !v)}
        >
          <span>עמודות לוח ({scheduleColumns.length}){colsMissingId.length > 0 && <span className="text-orange-500 mr-2 text-xs">({colsMissingId.length} ללא מזהה)</span>}</span>
          {showCols ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showCols && (
          <CardContent className="space-y-2 pb-4">
            {displayCols.length === 0 && <p className="text-xs text-gray-400">אין עמודות להצגה</p>}
            {displayCols.map((col, i) => {
              const realIdx = scheduleColumns.indexOf(col);
              return (
                <ColMappingRow
                  key={i}
                  col={col}
                  allCols={scheduleColumns}
                  onChange={(updated) => handleColChange(realIdx, updated)}
                />
              );
            })}
            {saving && <p className="text-xs text-gray-500 text-center">שומר...</p>}
          </CardContent>
        )}
      </Card>
    </div>
  );
}