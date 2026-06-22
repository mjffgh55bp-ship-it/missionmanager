import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowLeftRight } from "lucide-react";

/**
 * Given a numeric value and a visual config, returns a background color string (or null).
 */
export function getVisualColor(value, config) {
  if (!config || !config.mode) return null;
  const num = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(num)) return null;

  if (config.mode === "thresholds") {
    // thresholds: array of { min, max, color }
    const ranges = config.thresholds || [];
    for (const r of ranges) {
      const mn = r.min === "" || r.min === undefined ? -Infinity : parseFloat(r.min);
      const mx = r.max === "" || r.max === undefined ? Infinity : parseFloat(r.max);
      if (num >= mn && num <= mx) return r.color;
    }
    return null;
  }

  if (config.mode === "avg_scale") {
    const avg = config._avg;
    if (avg === undefined || avg === null) return null;
    if (avg === 0) return null;
    const reversed = !!config.reversed;
    const ratio = (num - avg) / avg; // negative = below avg, positive = above avg
    const clamped = Math.max(-1, Math.min(1, ratio));
    const effectiveClamped = reversed ? -clamped : clamped;
    if (effectiveClamped < 0) {
      const intensity = Math.round(Math.abs(effectiveClamped) * 180);
      return `rgb(255, ${255 - intensity}, ${255 - intensity})`;
    } else {
      const intensity = Math.round(effectiveClamped * 180);
      return `rgb(${255 - intensity}, 255, ${255 - intensity})`;
    }
  }

  if (config.mode === "custom_scale") {
    const { target, lower, upper } = config;
    const reversed = !!config.reversed;
    const t = parseFloat(target);
    const lo = parseFloat(lower);
    const hi = parseFloat(upper);
    if (isNaN(t) || isNaN(lo) || isNaN(hi)) return null;
    const red = "rgb(255, 80, 80)";
    const green = "rgb(60, 200, 100)";
    if (num <= lo) return reversed ? green : red;
    if (num >= hi) return reversed ? red : green;
    if (num < t) {
      const ratio = (num - lo) / (t - lo);
      if (reversed) {
        const g = Math.round((1 - ratio) * 200);
        return `rgb(${255 - Math.round(ratio * 195)}, ${g + 55}, 60)`;
      }
      return `rgb(255, ${Math.round(ratio * 200)}, 60)`;
    }
    const ratio = (num - t) / (hi - t);
    if (reversed) {
      return `rgb(${Math.round(ratio * 220)}, ${Math.round(120 * (1 - ratio) + 60)}, 60)`;
    }
    const r = Math.round((1 - ratio) * 220);
    const g = Math.round(120 + ratio * 135);
    return `rgb(${r}, ${g}, 60)`;
  }

  return null;
}

export default function VisualAnalysisDialog({ col, values, open, onOpenChange, config, onConfigChange }) {
  const [mode, setMode] = useState(config?.mode || "thresholds");
  const [thresholds, setThresholds] = useState(
    config?.thresholds || [{ min: "", max: "", color: "#ef4444" }]
  );
  const [customTarget, setCustomTarget] = useState(config?.target ?? "");
  const [customLower, setCustomLower] = useState(config?.lower ?? "");
  const [customUpper, setCustomUpper] = useState(config?.upper ?? "");
  const [reversed, setReversed] = useState(config?.reversed || false);

  // Compute average from values
  const nums = values.map(v => typeof v === "number" ? v : parseFloat(v)).filter(v => !isNaN(v) && v > 0);
  const avg = nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : 0;

  const handleApply = () => {
    let cfg = null;
    if (mode === "thresholds") {
      cfg = { mode, thresholds };
    } else if (mode === "avg_scale") {
      cfg = { mode, _avg: avg, reversed };
    } else if (mode === "custom_scale") {
      cfg = { mode, target: customTarget, lower: customLower, upper: customUpper, reversed };
    }
    onConfigChange(cfg);
    onOpenChange(false);
  };

  const handleClear = () => {
    onConfigChange(null);
    onOpenChange(false);
  };

  const addThreshold = () => setThresholds(prev => [...prev, { min: "", max: "", color: "#22c55e" }]);
  const removeThreshold = (i) => setThresholds(prev => prev.filter((_, idx) => idx !== i));
  const updateThreshold = (i, field, val) => setThresholds(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  const previewConfig = mode === "thresholds"
    ? { mode, thresholds }
    : mode === "avg_scale"
    ? { mode, _avg: avg, reversed }
    : { mode, target: customTarget, lower: customLower, upper: customUpper, reversed };

  const PRESET_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>ניתוח ויזואלי — {col?.name}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Mode selector */}
        <div className="flex gap-2 mb-4">
          {[
            { key: "thresholds", label: "הגדרת ספים" },
            { key: "avg_scale", label: "סקאלה לפי ממוצע" },
            { key: "custom_scale", label: "סקאלה אישית" },
          ].map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${mode === m.key ? "bg-blue-900 text-white border-blue-900" : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Mode: Thresholds */}
        {mode === "thresholds" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">הגדר טווחים וצבעים. כל ערך שנמצא בטווח יצבע בהתאם.</p>
            {thresholds.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-4">{i + 1}.</span>
                <div className="flex flex-col gap-0.5 flex-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs w-8">מ-</Label>
                    <Input type="number" value={t.min} onChange={e => updateThreshold(i, "min", e.target.value)}
                      placeholder="ללא" className="h-7 text-xs w-20" />
                    <Label className="text-xs w-8">עד</Label>
                    <Input type="number" value={t.max} onChange={e => updateThreshold(i, "max", e.target.value)}
                      placeholder="ללא" className="h-7 text-xs w-20" />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <input type="color" value={t.color} onChange={e => updateThreshold(i, "color", e.target.value)}
                    className="w-8 h-7 rounded border border-gray-200 cursor-pointer p-0" />
                  <div className="flex gap-0.5 flex-wrap w-24">
                    {PRESET_COLORS.map(c => (
                      <button key={c} onClick={() => updateThreshold(i, "color", c)}
                        className="w-4 h-4 rounded-full border border-white hover:scale-110 transition-transform"
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600"
                  onClick={() => removeThreshold(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={addThreshold}>
              <Plus className="w-3 h-3 ml-1" />הוסף טווח
            </Button>
          </div>
        )}

        {/* Mode: Average scale */}
        {mode === "avg_scale" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">הערכים יצבעו בהדרגה: מתחת לממוצע — {reversed ? "ירוק" : "אדום"}, מעל — {reversed ? "אדום" : "ירוק"}.</p>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-900">{avg}</div>
              <div className="text-xs text-gray-500">ממוצע מחושב מהנתונים הנוכחיים ({nums.length} ערכים)</div>
            </div>
            <div className="flex items-center justify-center gap-0 h-6 rounded overflow-hidden text-xs">
              {reversed ? <>
                <div className="flex-1 h-full" style={{ background: "rgb(60,200,100)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(160,255,160)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(255,255,180)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(255,168,100)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(255,80,80)" }} />
              </> : <>
                <div className="flex-1 h-full" style={{ background: "rgb(255,80,80)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(255,168,100)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(255,255,180)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(160,255,160)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(60,200,100)" }} />
              </>}
            </div>
            <div className="flex justify-between text-xs text-gray-400 px-1">
              <span>הכי נמוך</span>
              <span>ממוצע ({avg})</span>
              <span>הכי גבוה</span>
            </div>
            <button
              onClick={() => setReversed(r => !r)}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium transition-colors ${reversed ? "bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"}`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              {reversed ? "סקאלה הפוכה פעילה — לחץ לביטול" : "הפוך סקאלה (גבוה = אדום)"}
            </button>
          </div>
        )}

        {/* Mode: Custom scale */}
        {mode === "custom_scale" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">הגדר יעד, סף תחתון וסף עליון. הצבע יוצג בהדרגה בין {reversed ? "ירוק לאדום" : "אדום לירוק"}.</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs block mb-1">סף תחתון</Label>
                <Input type="number" value={customLower} onChange={e => setCustomLower(e.target.value)}
                  placeholder="0" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs block mb-1 text-blue-700 font-medium">יעד רצוי</Label>
                <Input type="number" value={customTarget} onChange={e => setCustomTarget(e.target.value)}
                  placeholder="50" className="h-8 text-sm border-blue-300" />
              </div>
              <div>
                <Label className="text-xs block mb-1">סף עליון</Label>
                <Input type="number" value={customUpper} onChange={e => setCustomUpper(e.target.value)}
                  placeholder="100" className="h-8 text-sm" />
              </div>
            </div>
            <div className="flex items-center justify-center gap-0 h-6 rounded overflow-hidden">
              {reversed ? <>
                <div className="flex-1 h-full" style={{ background: "rgb(60,200,100)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(160,235,60)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(255,220,60)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(255,140,60)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(255,80,80)" }} />
              </> : <>
                <div className="flex-1 h-full" style={{ background: "rgb(255,80,80)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(255,140,60)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(255,220,60)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(160,235,60)" }} />
                <div className="flex-1 h-full" style={{ background: "rgb(60,200,100)" }} />
              </>}
            </div>
            <div className="flex justify-between text-xs text-gray-400 px-1">
              <span>{customLower || "?"}</span>
              <span>יעד: {customTarget || "?"}</span>
              <span>{customUpper || "?"}</span>
            </div>
            <button
              onClick={() => setReversed(r => !r)}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium transition-colors ${reversed ? "bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"}`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              {reversed ? "סקאלה הפוכה פעילה — לחץ לביטול" : "הפוך סקאלה (גבוה = אדום)"}
            </button>
          </div>
        )}

        {/* Preview */}
        {nums.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <div className="text-xs text-gray-500 mb-2">תצוגה מקדימה ({Math.min(nums.length, 8)} ערכים):</div>
            <div className="flex flex-wrap gap-1">
              {nums.slice(0, 8).map((v, i) => {
                const bg = getVisualColor(v, previewConfig);
                return (
                  <div key={i} className="text-xs font-semibold px-2 py-1 rounded border"
                    style={{ backgroundColor: bg || "#f9fafb", borderColor: bg ? "transparent" : "#e5e7eb" }}>
                    {v}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between mt-4 gap-2">
          <Button variant="outline" size="sm" onClick={handleClear} className="text-gray-500">
            הסר עיצוב
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>ביטול</Button>
            <Button size="sm" className="bg-blue-900 hover:bg-blue-800" onClick={handleApply}>החל עיצוב</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}