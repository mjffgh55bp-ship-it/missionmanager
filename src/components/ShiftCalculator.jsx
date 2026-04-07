import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Users, Clock, TrendingUp, TrendingDown, Equal, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ShiftSummaryTable from './ShiftSummaryTable';

function NumberControl({ label, value, onChange, min = 0, max = 100, step = 1, suffix = "" }) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value.toString());
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setInputValue(value.toString());
    setIsEditing(true);
  };

  const handleBlur = () => {
    const newValue = parseFloat(inputValue);
    if (!isNaN(newValue)) {
      onChange(Math.max(min, Math.min(max, newValue)));
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-gray-600 text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all"
          onClick={() => onChange(Math.max(min, value - step))}
        >
          <Minus className="h-3 w-3" />
        </Button>
        {isEditing ? (
          <input
            ref={inputRef}
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-16 text-center font-semibold text-lg border border-blue-400 rounded px-1 outline-none focus:ring-2 focus:ring-blue-500"
            step={step}
            min={min}
            max={max}
          />
        ) : (
          <motion.span 
            key={value}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onDoubleClick={handleDoubleClick}
            className="w-16 text-center font-semibold text-lg cursor-pointer hover:bg-gray-50 rounded px-1"
            title="לחיצה כפולה לעריכה"
          >
            {value}{suffix}
          </motion.span>
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all"
          onClick={() => onChange(Math.min(max, value + step))}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, variant = "default" }) {
  const variants = {
    default: "bg-gray-50 text-gray-700",
    primary: "bg-orange-50 text-orange-700",
    success: "bg-emerald-50 text-emerald-700",
    danger: "bg-red-50 text-red-700",
    warning: "bg-amber-50 text-amber-700"
  };

  return (
    <motion.div 
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`rounded-xl p-4 ${variants[variant]}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 opacity-70" />
        <span className="text-xs font-medium opacity-70">{label}</span>
      </div>
      <motion.p 
        key={value}
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-2xl font-bold"
      >
        {value}
      </motion.p>
    </motion.div>
  );
}

export default function ShiftCalculator({ title, icon: TitleIcon, accentColor = "orange", onDataChange }) {
  const storageKey = `shiftCalculator_${title}`;
  const [showTable, setShowTable] = React.useState(false);
  
  const defaultConfig = {
    dayAShifts: 4,
    dayBShifts: 6,
    daysTypeA: 3,
    daysTypeB: 4,
    dayAEveningShifts: 1,
    dayBEveningShifts: 1,
    dayANightShifts: 1,
    dayBNightShifts: 1,
    newEmployees: 2,
    newAvgShifts: 3,
    newMonthlyEveningShifts: 4,
    newMonthlyNightShifts: 4,
    veteranEmployees: 3,
    veteranAvgShifts: 5,
    veteranMonthlyEveningShifts: 9,
    veteranMonthlyNightShifts: 9,
    seniorEmployees: 2,
    seniorAvgShifts: 6,
    seniorMonthlyEveningShifts: 9,
    seniorMonthlyNightShifts: 9
  };

  const [config, setConfig] = React.useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : defaultConfig;
  });

  React.useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(config));
  }, [config, storageKey]);

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // חישובים
  const totalDayShifts = (config.dayAShifts * config.daysTypeA) + (config.dayBShifts * config.daysTypeB);
  const totalEveningShifts = (config.dayAEveningShifts * config.daysTypeA) + (config.dayBEveningShifts * config.daysTypeB);
  const totalNightShifts = (config.dayANightShifts * config.daysTypeA) + (config.dayBNightShifts * config.daysTypeB);
  const totalWeeklyShifts = totalDayShifts + totalEveningShifts + totalNightShifts;

  // חישוב משמרות סופ"ש (יום A אחד + יום B אחד)
  const weekendDayShifts = config.dayAShifts + config.dayBShifts;
  const weekendEveningShifts = config.dayAEveningShifts + config.dayBEveningShifts;
  const weekendNightShifts = config.dayANightShifts + config.dayBNightShifts;
  const totalWeekendShifts = weekendDayShifts + weekendEveningShifts + weekendNightShifts;
  const totalEmployees = config.newEmployees + config.veteranEmployees + config.seniorEmployees;
  const avgWeeklyWeekendShiftsPerEmployee = totalEmployees > 0 ? (totalWeekendShifts / totalEmployees) : 0;
  const avgMonthlyWeekendShiftsPerEmployee = avgWeeklyWeekendShiftsPerEmployee * 4.3;

  const newCapacity = config.newEmployees * config.newAvgShifts;
  const veteranCapacity = config.veteranEmployees * config.veteranAvgShifts;
  const seniorCapacity = config.seniorEmployees * config.seniorAvgShifts;
  const totalCapacity = newCapacity + veteranCapacity + seniorCapacity;

  const newEveningCapacity = config.newEmployees * (config.newMonthlyEveningShifts / 4.3);
  const veteranEveningCapacity = config.veteranEmployees * (config.veteranMonthlyEveningShifts / 4.3);
  const seniorEveningCapacity = config.seniorEmployees * (config.seniorMonthlyEveningShifts / 4.3);
  const totalEveningCapacity = newEveningCapacity + veteranEveningCapacity + seniorEveningCapacity;

  const newNightCapacity = config.newEmployees * (config.newMonthlyNightShifts / 4.3);
  const veteranNightCapacity = config.veteranEmployees * (config.veteranMonthlyNightShifts / 4.3);
  const seniorNightCapacity = config.seniorEmployees * (config.seniorMonthlyNightShifts / 4.3);
  const totalNightCapacity = newNightCapacity + veteranNightCapacity + seniorNightCapacity;

  const totalDayCapacity = totalCapacity - totalEveningCapacity - totalNightCapacity;

  const dayGap = (totalDayCapacity - totalDayShifts).toFixed(1);
  const eveningGap = (totalEveningCapacity - totalEveningShifts).toFixed(1);
  const nightGap = (totalNightCapacity - totalNightShifts).toFixed(1);
  const gap = (totalCapacity - totalWeeklyShifts).toFixed(1);

  const accentColors = {
    orange: {
      gradient: "from-orange-500 to-amber-500",
      light: "bg-orange-50",
      text: "text-orange-600",
      border: "border-orange-200"
    },
    blue: {
      gradient: "from-blue-500 to-cyan-500",
      light: "bg-blue-50",
      text: "text-blue-600",
      border: "border-blue-200"
    }
  };

  const colors = accentColors[accentColor];

  // Update parent with current data
  React.useEffect(() => {
    if (onDataChange) {
      onDataChange({
        totalDayShifts,
        totalEveningShifts,
        totalNightShifts,
        totalWeeklyShifts,
        newEmployees: config.newEmployees,
        newAvgShifts: config.newAvgShifts,
        newMonthlyEveningShifts: config.newMonthlyEveningShifts,
        newMonthlyNightShifts: config.newMonthlyNightShifts,
        newCapacity,
        veteranEmployees: config.veteranEmployees,
        veteranAvgShifts: config.veteranAvgShifts,
        veteranMonthlyEveningShifts: config.veteranMonthlyEveningShifts,
        veteranMonthlyNightShifts: config.veteranMonthlyNightShifts,
        veteranCapacity,
        seniorEmployees: config.seniorEmployees,
        seniorAvgShifts: config.seniorAvgShifts,
        seniorMonthlyEveningShifts: config.seniorMonthlyEveningShifts,
        seniorMonthlyNightShifts: config.seniorMonthlyNightShifts,
        seniorCapacity,
        totalEmployees,
        totalCapacity,
        totalDayCapacity,
        totalEveningCapacity,
        totalNightCapacity,
        dayGap,
        eveningGap,
        nightGap,
        gap,
        avgWeeklyWeekendShiftsPerEmployee,
        avgMonthlyWeekendShiftsPerEmployee
      });
    }
  }, [config, totalDayShifts, totalEveningShifts, totalNightShifts, totalWeeklyShifts, newCapacity, veteranCapacity, seniorCapacity, totalCapacity, totalDayCapacity, totalEveningCapacity, totalNightCapacity, dayGap, eveningGap, nightGap, gap, totalEmployees, avgWeeklyWeekendShiftsPerEmployee, avgMonthlyWeekendShiftsPerEmployee, onDataChange]);

  return (
    <>
      <ShiftSummaryTable 
        isOpen={showTable}
        onClose={() => setShowTable(false)}
        title={title}
        data={{
          totalDayShifts,
          totalEveningShifts,
          totalNightShifts,
          totalWeeklyShifts,
          newEmployees: config.newEmployees,
          newAvgShifts: config.newAvgShifts,
          newMonthlyEveningShifts: config.newMonthlyEveningShifts,
          newMonthlyNightShifts: config.newMonthlyNightShifts,
          newCapacity,
          veteranEmployees: config.veteranEmployees,
          veteranAvgShifts: config.veteranAvgShifts,
          veteranMonthlyEveningShifts: config.veteranMonthlyEveningShifts,
          veteranMonthlyNightShifts: config.veteranMonthlyNightShifts,
          veteranCapacity,
          seniorEmployees: config.seniorEmployees,
          seniorAvgShifts: config.seniorAvgShifts,
          seniorMonthlyEveningShifts: config.seniorMonthlyEveningShifts,
          seniorMonthlyNightShifts: config.seniorMonthlyNightShifts,
          seniorCapacity,
          totalEmployees,
          totalCapacity,
          totalDayCapacity,
          totalEveningCapacity,
          totalNightCapacity,
          dayGap,
          eveningGap,
          nightGap,
          gap,
          avgWeeklyWeekendShiftsPerEmployee,
          avgMonthlyWeekendShiftsPerEmployee
        }}
      />
      
      <Card className="overflow-hidden shadow-lg border-0 bg-white">
      <CardHeader className={`bg-gradient-to-l ${colors.gradient} text-white p-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <TitleIcon className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">{title}</CardTitle>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowTable(true)}
            className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            <FileText className="h-4 w-4" />
            ייצא לטבלה
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* משמרות נדרשות */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">משמרות נדרשות</h3>
          <div className="space-y-4">
            {/* ימי A */}
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">ימי A</div>
              <NumberControl 
                label="כמות ימי A בשבוע"
                value={config.daysTypeA}
                onChange={(v) => updateConfig('daysTypeA', v)}
                max={7}
              />
              <NumberControl 
                label="משמרות יום בימי A (06:00-22:00)"
                value={config.dayAShifts}
                onChange={(v) => updateConfig('dayAShifts', v)}
                max={20}
              />
              <NumberControl 
                label="משמרות ערב ביום A (22:00-02:00)"
                value={config.dayAEveningShifts}
                onChange={(v) => updateConfig('dayAEveningShifts', v)}
                max={5}
              />
              <NumberControl 
                label="משמרות לילה ביום A (02:00-06:00)"
                value={config.dayANightShifts}
                onChange={(v) => updateConfig('dayANightShifts', v)}
                max={5}
              />
            </div>
            {/* ימי B */}
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">ימי B</div>
              <NumberControl 
                label="כמות ימי B בשבוע"
                value={config.daysTypeB}
                onChange={(v) => updateConfig('daysTypeB', v)}
                max={7}
              />
              <NumberControl 
                label="משמרות יום בימי B (06:00-22:00)"
                value={config.dayBShifts}
                onChange={(v) => updateConfig('dayBShifts', v)}
                max={20}
              />
              <NumberControl 
                label="משמרות ערב ביום B (22:00-02:00)"
                value={config.dayBEveningShifts}
                onChange={(v) => updateConfig('dayBEveningShifts', v)}
                max={5}
              />
              <NumberControl 
                label="משמרות לילה ביום B (02:00-06:00)"
                value={config.dayBNightShifts}
                onChange={(v) => updateConfig('dayBNightShifts', v)}
                max={5}
              />
            </div>
          </div>
        </div>

        {/* סיכום משמרות לילה */}
        <div className="bg-indigo-50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-indigo-700 mb-3">סיכום משמרות ערב ולילה</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white rounded-lg p-3">
              <div className="text-gray-500 text-xs mb-1">ערב - שבועי</div>
              <div className="font-bold text-indigo-600">{totalEveningShifts}</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-gray-500 text-xs mb-1">ערב - חודשי</div>
              <div className="font-bold text-indigo-600">{Math.round(totalEveningShifts * 4.3)}</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-gray-500 text-xs mb-1">לילה - שבועי</div>
              <div className="font-bold text-purple-600">{totalNightShifts}</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-gray-500 text-xs mb-1">לילה - חודשי</div>
              <div className="font-bold text-purple-600">{Math.round(totalNightShifts * 4.3)}</div>
            </div>
          </div>
        </div>

        {/* סיכום משמרות */}
        <div className={`${colors.light} rounded-xl p-4`}>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">סה״כ משמרות שבועיות נדרשות</span>
            <motion.span 
              key={totalWeeklyShifts}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className={`text-3xl font-bold ${colors.text}`}
            >
              {totalWeeklyShifts}
            </motion.span>
          </div>
          <div className="mt-2 text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>משמרות יום:</span>
              <span>{totalDayShifts}</span>
            </div>
            <div className="flex justify-between">
              <span>משמרות ערב:</span>
              <span>{totalEveningShifts}</span>
            </div>
            <div className="flex justify-between">
              <span>משמרות לילה:</span>
              <span>{totalNightShifts}</span>
            </div>
          </div>
        </div>

        {/* ממוצע משמרות סופ"ש לעובד */}
        <div className="bg-purple-50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            ממוצע משמרות בסופ״ש לעובד
          </h4>
          <div className="text-xs text-gray-600 mb-3">
            סופ״ש = יום A אחד + יום B אחד (יומיים בשבוע)
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white rounded-lg p-3">
              <div className="text-gray-500 text-xs mb-1">ממוצע שבועי</div>
              <div className="font-bold text-purple-600">
                {avgWeeklyWeekendShiftsPerEmployee.toFixed(2)}
              </div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-gray-500 text-xs mb-1">ממוצע חודשי</div>
              <div className="font-bold text-purple-600">
                {avgMonthlyWeekendShiftsPerEmployee.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* כוח אדם */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">כוח אדם וזמינות</h3>
          
          {/* עובדים סדירים */}
          <div className="mb-4 p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">סדירים</Badge>
            </div>
            <NumberControl 
              label="כמות עובדים"
              value={config.newEmployees}
              onChange={(v) => updateConfig('newEmployees', v)}
              max={50}
            />
            <NumberControl 
              label="ממוצע משמרות שבועי"
              value={config.newAvgShifts}
              onChange={(v) => updateConfig('newAvgShifts', v)}
              step={0.5}
              max={10}
            />
            <NumberControl 
              label="ממוצע משמרות ערב חודשי (22:00-02:00)"
              value={config.newMonthlyEveningShifts}
              onChange={(v) => updateConfig('newMonthlyEveningShifts', v)}
              step={0.25}
              max={30}
            />
            <div className="text-left text-xs text-gray-400 mt-1 pr-2">
              שבועי: ~{(config.newMonthlyEveningShifts / 4.3).toFixed(1)} משמרות ערב
            </div>
            <NumberControl 
              label="ממוצע משמרות לילה חודשי (02:00-06:00)"
              value={config.newMonthlyNightShifts}
              onChange={(v) => updateConfig('newMonthlyNightShifts', v)}
              step={0.25}
              max={30}
            />
            <div className="text-left text-xs text-gray-400 mt-1 pr-2">
              שבועי: ~{(config.newMonthlyNightShifts / 4.3).toFixed(1)} משמרות לילה
            </div>
            <div className="text-left text-sm text-gray-500 mt-2">
              יכולת כיסוי: <span className="font-semibold text-gray-700">{newCapacity}</span> משמרות
            </div>
          </div>

          {/* עובדים הצ״חים */}
          <div className="mb-4 p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">הצ״חים</Badge>
            </div>
            <NumberControl 
              label="כמות עובדים"
              value={config.veteranEmployees}
              onChange={(v) => updateConfig('veteranEmployees', v)}
              max={50}
            />
            <NumberControl 
              label="ממוצע משמרות שבועי"
              value={config.veteranAvgShifts}
              onChange={(v) => updateConfig('veteranAvgShifts', v)}
              step={0.5}
              max={10}
            />
            <NumberControl 
              label="ממוצע משמרות ערב חודשי (22:00-02:00)"
              value={config.veteranMonthlyEveningShifts}
              onChange={(v) => updateConfig('veteranMonthlyEveningShifts', v)}
              step={0.25}
              max={30}
            />
            <div className="text-left text-xs text-gray-400 mt-1 pr-2">
              שבועי: ~{(config.veteranMonthlyEveningShifts / 4.3).toFixed(1)} משמרות ערב
            </div>
            <NumberControl 
              label="ממוצע משמרות לילה חודשי (02:00-06:00)"
              value={config.veteranMonthlyNightShifts}
              onChange={(v) => updateConfig('veteranMonthlyNightShifts', v)}
              step={0.25}
              max={30}
            />
            <div className="text-left text-xs text-gray-400 mt-1 pr-2">
              שבועי: ~{(config.veteranMonthlyNightShifts / 4.3).toFixed(1)} משמרות לילה
            </div>
            <div className="text-left text-sm text-gray-500 mt-2">
              יכולת כיסוי: <span className="font-semibold text-gray-700">{veteranCapacity}</span> משמרות
            </div>
          </div>

          {/* עובדים מיל */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">מיל</Badge>
            </div>
            <NumberControl 
              label="כמות עובדים"
              value={config.seniorEmployees}
              onChange={(v) => updateConfig('seniorEmployees', v)}
              max={50}
            />
            <NumberControl 
              label="ממוצע משמרות שבועי"
              value={config.seniorAvgShifts}
              onChange={(v) => updateConfig('seniorAvgShifts', v)}
              step={0.5}
              max={10}
            />
            <NumberControl 
              label="ממוצע משמרות ערב חודשי (22:00-02:00)"
              value={config.seniorMonthlyEveningShifts}
              onChange={(v) => updateConfig('seniorMonthlyEveningShifts', v)}
              step={0.25}
              max={30}
            />
            <div className="text-left text-xs text-gray-400 mt-1 pr-2">
              שבועי: ~{(config.seniorMonthlyEveningShifts / 4.3).toFixed(1)} משמרות ערב
            </div>
            <NumberControl 
              label="ממוצע משמרות לילה חודשי (02:00-06:00)"
              value={config.seniorMonthlyNightShifts}
              onChange={(v) => updateConfig('seniorMonthlyNightShifts', v)}
              step={0.25}
              max={30}
            />
            <div className="text-left text-xs text-gray-400 mt-1 pr-2">
              שבועי: ~{(config.seniorMonthlyNightShifts / 4.3).toFixed(1)} משמרות לילה
            </div>
            <div className="text-left text-sm text-gray-500 mt-2">
              יכולת כיסוי: <span className="font-semibold text-gray-700">{seniorCapacity}</span> משמרות
            </div>
          </div>
        </div>

        {/* סיכום סופי */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">סיכום לפי סוג משמרת</h3>
          
          {/* משמרות יום */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-600 mb-2 pr-1">משמרות יום (06:00-22:00)</div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard 
                label="נדרש"
                value={totalDayShifts}
                icon={Clock}
                variant="primary"
              />
              <StatCard 
                label="יכולת כיסוי"
                value={totalDayCapacity.toFixed(1)}
                icon={Users}
                variant="default"
              />
              <StatCard 
                label="פער"
                value={parseFloat(dayGap) > 0 ? `+${dayGap}` : dayGap}
                icon={parseFloat(dayGap) > 0 ? TrendingUp : parseFloat(dayGap) < 0 ? TrendingDown : Equal}
                variant={parseFloat(dayGap) > 0 ? "success" : parseFloat(dayGap) < 0 ? "danger" : "warning"}
              />
            </div>
          </div>

          {/* משמרות ערב */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-600 mb-2 pr-1">משמרות ערב (22:00-02:00)</div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard 
                label="נדרש"
                value={totalEveningShifts}
                icon={Clock}
                variant="primary"
              />
              <StatCard 
                label="יכולת כיסוי"
                value={totalEveningCapacity.toFixed(1)}
                icon={Users}
                variant="default"
              />
              <StatCard 
                label="פער"
                value={parseFloat(eveningGap) > 0 ? `+${eveningGap}` : eveningGap}
                icon={parseFloat(eveningGap) > 0 ? TrendingUp : parseFloat(eveningGap) < 0 ? TrendingDown : Equal}
                variant={parseFloat(eveningGap) > 0 ? "success" : parseFloat(eveningGap) < 0 ? "danger" : "warning"}
              />
            </div>
          </div>

          {/* משמרות לילה */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-600 mb-2 pr-1">משמרות לילה (02:00-06:00)</div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard 
                label="נדרש"
                value={totalNightShifts}
                icon={Clock}
                variant="primary"
              />
              <StatCard 
                label="יכולת כיסוי"
                value={totalNightCapacity.toFixed(1)}
                icon={Users}
                variant="default"
              />
              <StatCard 
                label="פער"
                value={parseFloat(nightGap) > 0 ? `+${nightGap}` : nightGap}
                icon={parseFloat(nightGap) > 0 ? TrendingUp : parseFloat(nightGap) < 0 ? TrendingDown : Equal}
                variant={parseFloat(nightGap) > 0 ? "success" : parseFloat(nightGap) < 0 ? "danger" : "warning"}
              />
            </div>
          </div>

          {/* סיכום כללי */}
          <div className="border-t pt-4">
            <div className="text-xs font-semibold text-gray-600 mb-2 pr-1">סה״כ כללי</div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard 
                label="נדרש"
                value={totalWeeklyShifts}
                icon={Clock}
                variant="primary"
              />
              <StatCard 
                label="יכולת כיסוי"
                value={totalCapacity.toFixed(1)}
                icon={Users}
                variant="default"
              />
              <StatCard 
                label="פער"
                value={parseFloat(gap) > 0 ? `+${gap}` : gap}
                icon={parseFloat(gap) > 0 ? TrendingUp : parseFloat(gap) < 0 ? TrendingDown : Equal}
                variant={parseFloat(gap) > 0 ? "success" : parseFloat(gap) < 0 ? "danger" : "warning"}
              />
            </div>
          </div>
        </div>

        {/* הודעת סטטוס */}
        <AnimatePresence mode="wait">
          <motion.div
            key={parseFloat(gap) > 0 ? "surplus" : parseFloat(gap) < 0 ? "shortage" : "balanced"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl text-center ${
              parseFloat(gap) > 0 
                ? "bg-emerald-50 text-emerald-700" 
                : parseFloat(gap) < 0 
                  ? "bg-red-50 text-red-700"
                  : "bg-amber-50 text-amber-700"
            }`}
          >
            {parseFloat(gap) > 0 ? (
              <p className="font-medium">✨ עודף של {gap} משמרות - יש גמישות!</p>
            ) : parseFloat(gap) < 0 ? (
              <p className="font-medium">⚠️ חסרות {Math.abs(parseFloat(gap)).toFixed(1)} משמרות לכיסוי מלא</p>
            ) : (
              <p className="font-medium">⚖️ כיסוי מדויק - ללא עודף או חוסר</p>
            )}
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
    </>
  );
}