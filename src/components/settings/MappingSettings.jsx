import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Link, RefreshCw, ArrowLeft } from "lucide-react";
import { normalizeItem } from "./MappableItemRow";

const SECTION_LABELS = {
  worker_roles: "תפקידי עובדים",
  worker_populations: "אוכלוסיות עובדים",
  shift_statuses: "סטטוסי משמרות",
  custom_schedule_params: "עמודות לוח",
};

const SECTION_TABS = {
  worker_roles: "workers",
  worker_populations: "workers",
  shift_statuses: "schedule",
  custom_schedule_params: "schedule",
};

export default function MappingSettings({ onNavigateToTab }) {
  const [items, setItems] = useState([]); // flat list of { section, label, item }
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMissingOnly, setShowMissingOnly] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const allSettings = await base44.entities.AppSettings.list();
    await new Promise(r => setTimeout(r, 400));
    const allTemplates = await base44.entities.Template.list();

    const flat = [];
    for (const key of Object.keys(SECTION_LABELS)) {
      const s = allSettings.find(s => s.setting_key === key);
      if (!s) continue;
      const raw = JSON.parse(s.setting_value) || [];
      raw.forEach((item, idx) => {
        const norm = normalizeItem(item);
        flat.push({ section: key, label: SECTION_LABELS[key], idx, item: norm });
      });
    }

    setItems(flat);
    setTemplates(allTemplates);
    setLoading(false);
  };

  if (loading) return <div className="text-sm text-gray-500 py-8 text-center" dir="rtl">טוען...</div>;

  // --- Audit calculations ---
  const missingMappingId = items.filter(e => !e.item.mapping_id);
  const missingTemplates = templates.filter(t => !t.mapping_id);

  // Duplicate mapping_id within same section
  const sectionMap = {};
  items.forEach(e => {
    if (!e.item.mapping_id) return;
    const k = `${e.section}::${e.item.mapping_id}`;
    if (!sectionMap[k]) sectionMap[k] = [];
    sectionMap[k].push(e);
  });
  const duplicates = Object.values(sectionMap).filter(arr => arr.length > 1).flat();

  // Duplicate template mapping_id
  const tmplIdMap = {};
  templates.forEach(t => {
    if (!t.mapping_id) return;
    if (!tmplIdMap[t.mapping_id]) tmplIdMap[t.mapping_id] = [];
    tmplIdMap[t.mapping_id].push(t);
  });
  const dupTemplates = Object.values(tmplIdMap).filter(arr => arr.length > 1).flat();

  const disabledExport = items.filter(e => e.item.is_exportable === false);
  const disabledImport = items.filter(e => e.item.is_importable === false);

  const displayItems = showMissingOnly ? missingMappingId : items;

  const totalIssues = missingMappingId.length + missingTemplates.length + duplicates.length + dupTemplates.length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Link className="w-4 h-4 text-blue-700" />
          <h3 className="text-sm font-semibold text-blue-900">מפת מיפוי ובדיקות</h3>
          <Button size="sm" variant="ghost" className="h-6 text-xs ml-auto" onClick={loadData}>
            <RefreshCw className="w-3 h-3 mr-1" />רענן
          </Button>
        </div>
        <p className="text-xs text-blue-700">
          דף זה הוא לוח ביקורת בלבד. לעריכת מזהי מיפוי — פתח את הסעיף הרלוונטי בהגדרות והרחב את הפריט.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="ללא מזהה מיפוי"
          count={missingMappingId.length + missingTemplates.length}
          color={missingMappingId.length + missingTemplates.length > 0 ? "orange" : "green"}
          icon={missingMappingId.length + missingTemplates.length > 0 ? AlertTriangle : CheckCircle}
        />
        <SummaryCard
          label="מזהים כפולים"
          count={duplicates.length + dupTemplates.length}
          color={duplicates.length + dupTemplates.length > 0 ? "red" : "green"}
          icon={duplicates.length + dupTemplates.length > 0 ? AlertTriangle : CheckCircle}
        />
        <SummaryCard
          label="ייצוא מושבת"
          count={disabledExport.length}
          color={disabledExport.length > 0 ? "gray" : "green"}
          icon={disabledExport.length > 0 ? AlertTriangle : CheckCircle}
        />
        <SummaryCard
          label="ייבוא מושבת"
          count={disabledImport.length}
          color={disabledImport.length > 0 ? "gray" : "green"}
          icon={disabledImport.length > 0 ? AlertTriangle : CheckCircle}
        />
      </div>

      {totalIssues === 0 && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-800 font-medium">הכל תקין — לכל הפריטים יש מזהה מיפוי ייחודי</p>
        </div>
      )}

      {/* Duplicate warnings */}
      {(duplicates.length > 0 || dupTemplates.length > 0) && (
        <Card className="border-red-300 shadow-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />מזהים כפולים
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            {duplicates.map((e, i) => (
              <DupRow key={i} label={e.label} name={e.item.name} mappingId={e.item.mapping_id}
                tab={SECTION_TABS[e.section]} onNavigate={onNavigateToTab} />
            ))}
            {dupTemplates.map((t, i) => (
              <DupRow key={`t${i}`} label="מוקד/תבנית" name={t.name} mappingId={t.mapping_id} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Missing mapping IDs */}
      <Card className="border shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold text-gray-700">
            פריטים ללא מזהה מיפוי
            {missingMappingId.length + missingTemplates.length > 0 && (
              <span className="text-orange-500 mr-2 text-xs">({missingMappingId.length + missingTemplates.length})</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <Switch checked={showMissingOnly} onCheckedChange={setShowMissingOnly} />
            <span className="text-xs text-gray-500">הצג רק ללא מזהה</span>
          </div>
        </div>
        <CardContent className="px-4 py-3 space-y-1">
          {(showMissingOnly ? missingMappingId : items).map((e, i) => (
            <MissingRow
              key={i}
              label={e.label}
              name={e.item.name}
              hasMappingId={!!e.item.mapping_id}
              mappingId={e.item.mapping_id}
              tab={SECTION_TABS[e.section]}
              onNavigate={onNavigateToTab}
            />
          ))}
          {(showMissingOnly ? missingTemplates : templates).map((t, i) => (
            <MissingRow
              key={`t${i}`}
              label="מוקד/תבנית"
              name={t.name}
              hasMappingId={!!t.mapping_id}
              mappingId={t.mapping_id}
              tab={null}
            />
          ))}
          {(showMissingOnly ? missingMappingId.length + missingTemplates.length : items.length + templates.length) === 0 && (
            <p className="text-xs text-gray-400">אין פריטים להצגה</p>
          )}
        </CardContent>
      </Card>

      {/* Template mapping note */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600" dir="rtl">
        <strong>מוקדים/תבניות:</strong> מזהה מיפוי נערך ישירות בעמוד ניהול התבניות / הגדרות הלוח.
      </div>
    </div>
  );
}

function SummaryCard({ label, count, color, icon: Icon }) {
  const colors = {
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    red: "bg-red-50 border-red-200 text-red-700",
    green: "bg-green-50 border-green-200 text-green-700",
    gray: "bg-gray-50 border-gray-200 text-gray-600",
  };
  return (
    <div className={`border rounded-lg p-3 ${colors[color] || colors.gray}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{count}</p>
    </div>
  );
}

function MissingRow({ label, name, hasMappingId, mappingId, tab, onNavigate }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Badge variant="outline" className="text-[10px] shrink-0">{label}</Badge>
        <span className="text-sm truncate">{name}</span>
        {hasMappingId ? (
          <span className="text-[10px] font-mono text-gray-400 shrink-0">{mappingId}</span>
        ) : (
          <span className="text-[10px] text-orange-500 flex items-center gap-0.5 shrink-0">
            <AlertTriangle className="w-3 h-3" />חסר
          </span>
        )}
      </div>
      {tab && onNavigate && !hasMappingId && (
        <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-600 shrink-0"
          onClick={() => onNavigate(tab)}>
          עבור <ArrowLeft className="w-3 h-3 mr-1" />
        </Button>
      )}
    </div>
  );
}

function DupRow({ label, name, mappingId, tab, onNavigate }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-red-100 last:border-0">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 shrink-0">{label}</Badge>
        <span className="text-sm">{name}</span>
        <span className="text-[10px] font-mono text-red-500">{mappingId}</span>
      </div>
      {tab && onNavigate && (
        <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-600 shrink-0"
          onClick={() => onNavigate(tab)}>
          עבור <ArrowLeft className="w-3 h-3 mr-1" />
        </Button>
      )}
    </div>
  );
}