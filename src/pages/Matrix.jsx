import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Edit2, Trash2, X } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const DEFAULT_CATEGORIES = [
  { id: "selected", label: "איכ√ת √ נבחר", color: "bg-pink-200", borderColor: "border-blue-600" },
  { id: "absent", label: "נבחר: ‎√×לא", color: "bg-pink-100", borderColor: "border-pink-600" },
  { id: "green", label: "המקף כחול", color: "bg-lime-400", borderColor: "border-lime-600" },
  { id: "greenAlt", label: "כגונת טבל 30 המקפת כחול", color: "bg-lime-500", borderColor: "border-lime-700" },
  { id: "magenta", label: "כגונת 45", color: "bg-pink-500", borderColor: "border-pink-700" },
  { id: "brown", label: "תשמורת", color: "bg-amber-700", borderColor: "border-amber-900" },
  { id: "purple", label: "כוננות 60/75/90/105/120/180", color: "bg-purple-400", borderColor: "border-purple-600" },
  { id: "lightBlue", label: "מאמן", color: "bg-sky-300", borderColor: "border-sky-500" },
  { id: "orange", label: "ציוד", color: "bg-orange-400", borderColor: "border-orange-600" },
  { id: "lightPink", label: "אחר", color: "bg-pink-200", borderColor: "border-pink-400" },
  { id: "lavender", label: "חופש", color: "bg-purple-200", borderColor: "border-purple-400" },
  { id: "gray", label: 'חו"ל', color: "bg-gray-400", borderColor: "border-gray-600" },
];

const COLOR_OPTIONS = [
  { value: "bg-pink-200", label: "ורוד בהיר" },
  { value: "bg-pink-500", label: "ורוד" },
  { value: "bg-pink-700", label: "ורוד כהה" },
  { value: "bg-lime-400", label: "ירוק בהיר" },
  { value: "bg-lime-500", label: "ירוק" },
  { value: "bg-lime-700", label: "ירוק כהה" },
  { value: "bg-amber-500", label: "חום בהיר" },
  { value: "bg-amber-700", label: "חום" },
  { value: "bg-purple-200", label: "סגול בהיר" },
  { value: "bg-purple-400", label: "סגול" },
  { value: "bg-purple-700", label: "סגול כהה" },
  { value: "bg-sky-200", label: "תכלת בהיר" },
  { value: "bg-sky-300", label: "תכלת" },
  { value: "bg-sky-500", label: "תכלת כהה" },
  { value: "bg-orange-300", label: "כתום בהיר" },
  { value: "bg-orange-400", label: "כתום" },
  { value: "bg-orange-600", label: "כתום כהה" },
  { value: "bg-gray-300", label: "אפור בהיר" },
  { value: "bg-gray-400", label: "אפור" },
  { value: "bg-gray-600", label: "אפור כהה" },
  { value: "bg-blue-300", label: "כחול בהיר" },
  { value: "bg-blue-400", label: "כחול" },
  { value: "bg-blue-600", label: "כחול כהה" },
  { value: "bg-red-300", label: "אדום בהיר" },
  { value: "bg-red-400", label: "אדום" },
  { value: "bg-red-600", label: "אדום כהה" },
  { value: "bg-yellow-300", label: "צהוב בהיר" },
  { value: "bg-yellow-400", label: "צהוב" },
  { value: "bg-yellow-600", label: "צהוב כהה" },
  { value: "bg-green-300", label: "ירוק עלים בהיר" },
  { value: "bg-green-500", label: "ירוק עלים" },
  { value: "bg-green-700", label: "ירוק עלים כהה" },
  { value: "bg-teal-300", label: "טורקיז בהיר" },
  { value: "bg-teal-500", label: "טורקיז" },
  { value: "bg-teal-700", label: "טורקיז כהה" },
  { value: "bg-indigo-300", label: "אינדיגו בהיר" },
  { value: "bg-indigo-500", label: "אינדיגו" },
  { value: "bg-indigo-700", label: "אינדיגו כהה" },
  { value: "bg-rose-300", label: "ורד בהיר" },
  { value: "bg-rose-500", label: "ורד" },
  { value: "bg-rose-700", label: "ורד כהה" },
];

export default function Matrix() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cellData, setCellData] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStartCell, setDrawStartCell] = useState(null);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [workerActivities, setWorkerActivities] = useState({});
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingActivity, setEditingActivity] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ label: "", color: "bg-pink-200" });
  const [activityForm, setActivityForm] = useState({ 
    category_id: "", 
    day: 0, 
    start_time: "06:00", 
    end_time: "07:00",
    note: ""
  });
  const [blockNotes, setBlockNotes] = useState({});
  const [showBlockNoteDialog, setShowBlockNoteDialog] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [blockNoteText, setBlockNoteText] = useState("");
  const [selectedCategoryChange, setSelectedCategoryChange] = useState("");
  const [selectedWorkerTarget, setSelectedWorkerTarget] = useState("");
  const [draggedBlock, setDraggedBlock] = useState(null);
  const [blockStartHour, setBlockStartHour] = useState(0);
  const [blockEndHour, setBlockEndHour] = useState(0);
  const [resizingBlock, setResizingBlock] = useState(null);
  const [resizeStartX, setResizeStartX] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadCategories();
    loadMatrixData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      saveMatrixData();
    }, 30000);
    return () => clearInterval(interval);
  }, [cellData, workerActivities, blockNotes, weekStart]);

  useEffect(() => {
    saveMatrixData();
  }, [cellData, workerActivities, blockNotes]);

  const loadData = async () => {
    try {
      const workersData = await base44.entities.Worker.filter({ active: true });
      setWorkers(workersData.sort((a, b) => (a.nickname || "").localeCompare(b.nickname || "")));
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const settings = await base44.entities.AppSettings.filter({ setting_key: "matrix_categories" });
      if (settings.length > 0) {
        setCategories(JSON.parse(settings[0].setting_value));
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const saveCategories = async (newCategories) => {
    try {
      const settings = await base44.entities.AppSettings.filter({ setting_key: "matrix_categories" });
      const value = JSON.stringify(newCategories);
      if (settings.length > 0) {
        await base44.entities.AppSettings.update(settings[0].id, { setting_value: value });
      } else {
        await base44.entities.AppSettings.create({ setting_key: "matrix_categories", setting_value: value });
      }
      setCategories(newCategories);
    } catch (error) {
      console.error("Error saving categories:", error);
    }
  };

  const loadMatrixData = async () => {
    try {
      const weekKey = format(weekStart, "yyyy-MM-dd");
      const settings = await base44.entities.AppSettings.filter({ setting_key: `matrix_data_${weekKey}` });
      
      if (settings.length > 0) {
        const data = JSON.parse(settings[0].setting_value);
        setCellData(data.cellData || {});
        setWorkerActivities(data.workerActivities || {});
        setBlockNotes(data.blockNotes || {});
      }
    } catch (error) {
      console.error("Error loading matrix data:", error);
    }
  };

  const saveMatrixData = async () => {
    try {
      const weekKey = format(weekStart, "yyyy-MM-dd");
      const settings = await base44.entities.AppSettings.filter({ setting_key: `matrix_data_${weekKey}` });
      const value = JSON.stringify({
        cellData,
        workerActivities,
        blockNotes
      });
      
      if (settings.length > 0) {
        await base44.entities.AppSettings.update(settings[0].id, { setting_value: value });
      } else {
        await base44.entities.AppSettings.create({ 
          setting_key: `matrix_data_${weekKey}`, 
          setting_value: value 
        });
      }
    } catch (error) {
      console.error("Error saving matrix data:", error);
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 24 }, (_, i) => (i + 6) % 24); // 6,7,8...23,0,1...5

  const goToPreviousWeek = async () => {
    await saveMatrixData();
    const newWeek = subWeeks(weekStart, 1);
    setWeekStart(newWeek);
    setCellData({});
    setWorkerActivities({});
    setBlockNotes({});
    setTimeout(() => loadMatrixData(), 100);
  };

  const goToNextWeek = async () => {
    await saveMatrixData();
    const newWeek = addWeeks(weekStart, 1);
    setWeekStart(newWeek);
    setCellData({});
    setWorkerActivities({});
    setBlockNotes({});
    setTimeout(() => loadMatrixData(), 100);
  };

  const goToCurrentWeek = async () => {
    await saveMatrixData();
    const newWeek = startOfWeek(new Date(), { weekStartsOn: 0 });
    setWeekStart(newWeek);
    setCellData({});
    setWorkerActivities({});
    setBlockNotes({});
    setTimeout(() => loadMatrixData(), 100);
  };

  const getCellKey = (workerId, dayIndex, hour) => {
    return `${workerId}-${dayIndex}-${hour}`;
  };

  const handleCellClick = (workerId, dayIndex, hour, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!selectedCategory) return;
    
    if (!isDrawing) {
      // התחל ציור
      setIsDrawing(true);
      setDrawStartCell({ workerId, dayIndex, hour });
      addCell(workerId, dayIndex, hour);
    } else {
      // בדוק אם לחצנו על אותו עובד ויום
      if (workerId === drawStartCell?.workerId && dayIndex === drawStartCell?.dayIndex) {
        // סיים ציור
        setIsDrawing(false);
        setDrawStartCell(null);
      }
    }
  };

  const handleCellMouseEnter = (workerId, dayIndex, hour) => {
    if (!isDrawing || !selectedCategory || !drawStartCell) return;
    
    // ודא שאנחנו באותו עובד ובאותו יום
    if (workerId !== drawStartCell.workerId || dayIndex !== drawStartCell.dayIndex) return;
    
    addCell(workerId, dayIndex, hour);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const toggleCell = (workerId, dayIndex, hour) => {
    const key = getCellKey(workerId, dayIndex, hour);
    setCellData(prev => {
      const newData = { ...prev };
      if (newData[key] === selectedCategory) {
        delete newData[key];
      } else {
        newData[key] = selectedCategory;
      }
      return newData;
    });
  };

  const addCell = (workerId, dayIndex, hour) => {
    if (!selectedCategory) return;
    const key = getCellKey(workerId, dayIndex, hour);
    setCellData(prev => {
      const existing = prev[key] || [];
      return {
        ...prev,
        [key]: [...existing, { categoryId: selectedCategory, note: "" }]
      };
    });
  };

  const getCellCategory = (workerId, dayIndex, hour) => {
    const key = getCellKey(workerId, dayIndex, hour);
    const stack = cellData[key];
    if (!stack || stack.length === 0) return null;
    const top = stack[stack.length - 1];
    return typeof top === 'string' ? top : top.categoryId;
  };

  const getCellNote = (workerId, dayIndex, hour) => {
    const key = getCellKey(workerId, dayIndex, hour);
    const stack = cellData[key];
    if (!stack || stack.length === 0) return "";
    const top = stack[stack.length - 1];
    return typeof top === 'object' && top.note ? top.note : "";
  };

  const getBlocksForWorkerDay = (workerId, dayIndex) => {
    const blocks = [];
    const processedHours = new Set();

    for (let i = 0; i < hours.length; i++) {
      const hour = hours[i];
      
      if (processedHours.has(hour)) continue;

      const category = getCellCategory(workerId, dayIndex, hour);
      
      if (!category) {
        blocks.push({ type: 'empty', hour, colspan: 1 });
        continue;
      }

      const categoryData = categories.find(c => c.id === category);
      if (!categoryData) {
        blocks.push({ type: 'empty', hour, colspan: 1 });
        continue;
      }

      // מצא את כל השעות הרצופות עם אותה קטגוריה
      let endHour = hour;
      let colspan = 1;
      processedHours.add(hour);

      for (let j = i + 1; j < hours.length; j++) {
        const nextHour = hours[j];
        const nextCategory = getCellCategory(workerId, dayIndex, nextHour);
        
        if (nextCategory === category) {
          endHour = nextHour;
          colspan++;
          processedHours.add(nextHour);
        } else {
          break;
        }
      }

      const startTime = `${String(hour).padStart(2, '0')}:00`;
      const endTime = `${String((endHour + 1) % 24).padStart(2, '0')}:00`;
      const blockKey = `${workerId}-${dayIndex}-${hour}-${endHour}`;
      const note = getCellNote(workerId, dayIndex, hour);

      blocks.push({
        type: 'category',
        hour,
        colspan,
        category: categoryData,
        startTime,
        endTime,
        workerId,
        dayIndex,
        note,
        blockKey
      });

      i += colspan - 1;
    }

    return blocks;
  };

  const getWorkerActivities = (workerId) => {
    const activities = [];
    const processedBlocks = new Set();

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      for (let hour = 0; hour < 24; hour++) {
        const actualHour = (hour + 6) % 24;
        const key = getCellKey(workerId, dayIndex, actualHour);
        const categoryId = cellData[key];
        
        if (categoryId && !processedBlocks.has(key)) {
          const category = categories.find(c => c.id === categoryId);
          if (!category) continue;

          let startHour = actualHour;
          let endHour = actualHour + 1;
          processedBlocks.add(key);

          while (endHour < 24) {
            const nextKey = getCellKey(workerId, dayIndex, endHour);
            if (cellData[nextKey] === categoryId) {
              processedBlocks.add(nextKey);
              endHour++;
            } else {
              break;
            }
          }

          activities.push({
            day: dayIndex,
            category: category.label,
            color: category.color,
            start: `${String(startHour).padStart(2, '0')}:00`,
            end: `${String(endHour).padStart(2, '0')}:00`
          });
        }
      }
    }

    const manualActivities = workerActivities[workerId] || [];
    return [...activities, ...manualActivities].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.start.localeCompare(b.start);
    });
  };

  const handleAddCategory = () => {
    setCategoryForm({ label: "", color: "bg-pink-200" });
    setEditingCategory(null);
    setShowCategoryDialog(true);
  };

  const handleEditCategory = (category) => {
    setCategoryForm({ label: category.label, color: category.color });
    setEditingCategory(category);
    setShowCategoryDialog(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.label.trim()) return;

    let newCategories;
    if (editingCategory) {
      newCategories = categories.map(c => 
        c.id === editingCategory.id 
          ? { ...c, label: categoryForm.label, color: categoryForm.color }
          : c
      );
    } else {
      const newCategory = {
        id: `custom_${Date.now()}`,
        label: categoryForm.label,
        color: categoryForm.color,
        borderColor: categoryForm.color.replace('bg-', 'border-')
      };
      newCategories = [...categories, newCategory];
    }

    await saveCategories(newCategories);
    setShowCategoryDialog(false);
  };

  const handleDeleteCategory = async (categoryId) => {
    const newCategories = categories.filter(c => c.id !== categoryId);
    await saveCategories(newCategories);
  };

  const handleAddActivity = (worker) => {
    setSelectedWorker(worker);
    setActivityForm({ 
      category_id: categories[0]?.id || "", 
      day: 0, 
      start_time: "06:00", 
      end_time: "07:00",
      note: ""
    });
    setShowActivityDialog(true);
  };

  const handleSaveActivity = () => {
    if (!selectedWorker || !activityForm.category_id) return;

    const category = categories.find(c => c.id === activityForm.category_id);
    if (!category) return;

    const startHour = parseInt(activityForm.start_time.split(':')[0]);
    const endHour = parseInt(activityForm.end_time.split(':')[0]);
    
    const hoursToAdd = endHour >= startHour 
      ? endHour - startHour 
      : (24 - startHour) + endHour;
    
    setCellData(prev => {
      const newData = { ...prev };
      
      for (let i = 0; i < hoursToAdd; i++) {
        const currentHour = (startHour + i) % 24;
        const dayOffset = Math.floor((startHour + i) / 24);
        const actualDayIndex = (activityForm.day + dayOffset) % 7;
        const key = getCellKey(selectedWorker.id, actualDayIndex, currentHour);
        const existing = newData[key] || [];
        newData[key] = [...existing, { categoryId: category.id, note: activityForm.note || "" }];
      }
      
      return newData;
    });

    setShowActivityDialog(false);
  };

  const handleDeleteActivity = (workerId, activityId) => {
    setWorkerActivities(prev => ({
      ...prev,
      [workerId]: (prev[workerId] || []).filter(a => a.id !== activityId)
    }));
  };

  const handleBlockClick = (block, e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // אם אנחנו במצב ציור - סיים את הציור
    if (isDrawing) {
      setIsDrawing(false);
      setDrawStartCell(null);
      return;
    }
    
    // אחרת, פתח את חלון העריכה
    setSelectedBlock(block);
    setBlockNoteText(block.note || "");
    setSelectedCategoryChange("");
    setSelectedWorkerTarget("");
    setBlockStartHour(block.hour);
    setBlockEndHour((block.hour + block.colspan) % 24);
    setShowBlockNoteDialog(true);
  };

  const handleBlockDragStart = (block, e) => {
    e.stopPropagation();
    setDraggedBlock(block);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleBlockDragEnd = (e) => {
    setDraggedBlock(null);
  };



  const handleCellDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleCellDrop = (targetWorkerId, targetDayIndex, targetHour, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedBlock) return;

    const { workerId, dayIndex, hour, colspan } = draggedBlock;
    const categoryId = getCellCategory(workerId, dayIndex, hour);
    const note = getCellNote(workerId, dayIndex, hour);

    const targetStartHour = workerId === targetWorkerId ? targetHour : hour;
    let finalDayIndex = workerId === targetWorkerId ? targetDayIndex : dayIndex;
    
    // אם השעה היא בין 0-5 (אחרי חצות), עבור ליום הבא
    if (workerId !== targetWorkerId && targetStartHour >= 0 && targetStartHour <= 5) {
      finalDayIndex = (dayIndex + 1) % 7;
    }

    setCellData(prev => {
      const newData = { ...prev };
      
      // מחק מהמקור
      for (let i = 0; i < colspan; i++) {
        const hourToDelete = (hour + i) % 24;
        const dayOffset = Math.floor((hour + i) / 24);
        const actualDayIndex = (dayIndex + dayOffset) % 7;
        const oldKey = getCellKey(workerId, actualDayIndex, hourToDelete);
        const stack = newData[oldKey] || [];
        if (stack.length > 0) {
          const newStack = stack.slice(0, -1);
          if (newStack.length === 0) {
            delete newData[oldKey];
          } else {
            newData[oldKey] = newStack;
          }
        }
      }
      
      // הוסף ביעד
      for (let i = 0; i < colspan; i++) {
        const newHour = (targetStartHour + i) % 24;
        // אם עברנו את חצות (מ-23 ל-0), עבור ליום הבא
        const dayOffset = Math.floor((targetStartHour + i) / 24);
        const actualDayIndex = (finalDayIndex + dayOffset) % 7;
        const newKey = getCellKey(targetWorkerId, actualDayIndex, newHour);
        const existing = newData[newKey] || [];
        newData[newKey] = [...existing, { categoryId, note }];
      }
      
      return newData;
    });

    setDraggedBlock(null);
  };

  const handleChangeBlockCategory = (newCategoryId) => {
    if (!selectedBlock) return;
    
    const { workerId, dayIndex, hour, colspan } = selectedBlock;
    
    setCellData(prev => {
      const newData = { ...prev };
      for (let i = 0; i < colspan; i++) {
        const hourToChange = (hour + i) % 24;
        const key = getCellKey(workerId, dayIndex, hourToChange);
        const stack = newData[key] || [];
        if (stack.length > 0) {
          const newStack = [...stack];
          const topItem = newStack[newStack.length - 1];
          const existingNote = typeof topItem === 'object' ? topItem.note : "";
          newStack[newStack.length - 1] = { categoryId: newCategoryId, note: existingNote };
          newData[key] = newStack;
        }
      }
      return newData;
    });
  };

  const handleMoveBlock = (targetWorkerId) => {
    if (!selectedBlock || !targetWorkerId) return;
    
    const { workerId, dayIndex, hour, colspan } = selectedBlock;
    const categoryId = getCellCategory(workerId, dayIndex, hour);
    const note = getCellNote(workerId, dayIndex, hour);
    
    setCellData(prev => {
      const newData = { ...prev };
      for (let i = 0; i < colspan; i++) {
        const hourToMove = (hour + i) % 24;
        const dayOffset = Math.floor((hour + i) / 24);
        const actualDayIndex = (dayIndex + dayOffset) % 7;
        const oldKey = getCellKey(workerId, actualDayIndex, hourToMove);
        const stack = newData[oldKey] || [];
        if (stack.length > 0) {
          const newStack = stack.slice(0, -1);
          if (newStack.length === 0) {
            delete newData[oldKey];
          } else {
            newData[oldKey] = newStack;
          }
        }
        
        const newKey = getCellKey(targetWorkerId, actualDayIndex, hourToMove);
        const existing = newData[newKey] || [];
        newData[newKey] = [...existing, { categoryId, note }];
      }
      return newData;
    });
    
    setShowBlockNoteDialog(false);
  };

  const handleCopyBlock = (targetWorkerId) => {
    if (!selectedBlock || !targetWorkerId) return;
    
    const { workerId, dayIndex, hour, colspan } = selectedBlock;
    const categoryId = getCellCategory(workerId, dayIndex, hour);
    const note = getCellNote(workerId, dayIndex, hour);
    
    setCellData(prev => {
      const newData = { ...prev };
      for (let i = 0; i < colspan; i++) {
        const hourToCopy = (hour + i) % 24;
        const dayOffset = Math.floor((hour + i) / 24);
        const actualDayIndex = (dayIndex + dayOffset) % 7;
        const newKey = getCellKey(targetWorkerId, actualDayIndex, hourToCopy);
        const existing = newData[newKey] || [];
        newData[newKey] = [...existing, { categoryId, note }];
      }
      return newData;
    });
    
    setShowBlockNoteDialog(false);
  };

  const handleSaveBlockChanges = () => {
    if (!selectedBlock) return;
    
    const { workerId, dayIndex, hour, colspan } = selectedBlock;
    const categoryId = getCellCategory(workerId, dayIndex, hour);
    
    setCellData(prev => {
      const newData = { ...prev };
      
      // מחק את הבלוק הישן
      for (let i = 0; i < colspan; i++) {
        const hourToDelete = (hour + i) % 24;
        const dayOffset = Math.floor((hour + i) / 24);
        const actualDayIndex = (dayIndex + dayOffset) % 7;
        const key = getCellKey(workerId, actualDayIndex, hourToDelete);
        const stack = newData[key] || [];
        if (stack.length > 0) {
          const newStack = stack.slice(0, -1);
          if (newStack.length === 0) {
            delete newData[key];
          } else {
            newData[key] = newStack;
          }
        }
      }
      
      // הוסף את הבלוק החדש
      let hoursToAdd = blockEndHour >= blockStartHour 
        ? blockEndHour - blockStartHour 
        : (24 - blockStartHour) + blockEndHour;
      
      for (let i = 0; i < hoursToAdd; i++) {
        const currentHour = (blockStartHour + i) % 24;
        const dayOffset = Math.floor((blockStartHour + i) / 24);
        const actualDayIndex = (dayIndex + dayOffset) % 7;
        const key = getCellKey(workerId, actualDayIndex, currentHour);
        const existing = newData[key] || [];
        newData[key] = [...existing, { categoryId, note: blockNoteText }];
      }
      
      return newData;
    });
    
    setShowBlockNoteDialog(false);
  };

  const handleDeleteBlock = () => {
    if (!selectedBlock) return;
    
    const { workerId, dayIndex, hour, colspan } = selectedBlock;
    
    setCellData(prev => {
      const newData = { ...prev };
      for (let i = 0; i < colspan; i++) {
        const hourToDelete = (hour + i) % 24;
        const dayOffset = Math.floor((hour + i) / 24);
        const actualDayIndex = (dayIndex + dayOffset) % 7;
        const key = getCellKey(workerId, actualDayIndex, hourToDelete);
        const stack = newData[key] || [];
        if (stack.length > 0) {
          const newStack = stack.slice(0, -1);
          if (newStack.length === 0) {
            delete newData[key];
          } else {
            newData[key] = newStack;
          }
        }
      }
      return newData;
    });
    
    setShowBlockNoteDialog(false);
  };

  const handleResizeStart = (e, block, side) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingBlock({ ...block, side });
    setResizeStartX(e.clientX);
  };

  const handleResizeMove = (e) => {
    if (!resizingBlock) return;
    e.preventDefault();
    
    const deltaX = e.clientX - resizeStartX;
    const cellWidth = 24;
    const hoursDelta = Math.round(deltaX / cellWidth);
    
    if (hoursDelta === 0) return;
    
    const { workerId, dayIndex, hour, colspan, side, originalHour, originalColspan } = resizingBlock;
    const categoryId = getCellCategory(workerId, dayIndex, originalHour || hour);
    const note = getCellNote(workerId, dayIndex, originalHour || hour);

    setCellData(prev => {
      const newData = { ...prev };

      // מחק את כל הבלוק הקודם
      const currentHour = originalHour || hour;
      const currentColspan = originalColspan || colspan;
      for (let i = 0; i < currentColspan; i++) {
        const hourToDelete = (currentHour + i) % 24;
        const dayOffset = Math.floor((currentHour + i) / 24);
        const actualDayIndex = (dayIndex + dayOffset) % 7;
        const key = getCellKey(workerId, actualDayIndex, hourToDelete);
        const stack = newData[key] || [];
        if (stack.length > 0) {
          const newStack = stack.slice(0, -1);
          if (newStack.length === 0) {
            delete newData[key];
          } else {
            newData[key] = newStack;
          }
        }
      }

      // חשב את הבלוק החדש
      let newStartHour, newColspan;
      
      if (side === 'start') {
        // גרירה שמאלה = הקטנה (hoursDelta חיובי), ימינה = הגדלה (hoursDelta שלילי)
        newStartHour = (currentHour - hoursDelta + 24) % 24;
        newColspan = Math.max(1, currentColspan + hoursDelta);
      } else {
        // side === 'end'
        // גרירה ימינה = הגדלה (hoursDelta חיובי), שמאלה = הקטנה (hoursDelta שלילי)
        newStartHour = currentHour;
        newColspan = Math.max(1, currentColspan + hoursDelta);
      }

      // צור את הבלוק החדש
      for (let i = 0; i < newColspan; i++) {
        const newHour = (newStartHour + i) % 24;
        const dayOffset = Math.floor((newStartHour + i) / 24);
        const actualDayIndex = (dayIndex + dayOffset) % 7;
        const key = getCellKey(workerId, actualDayIndex, newHour);
        const existing = newData[key] || [];
        newData[key] = [...existing, { categoryId, note }];
      }

      return newData;
    });
    
    // עדכן את המצב של הבלוק שמשתנה
    setResizingBlock({
      ...resizingBlock,
      originalHour: originalHour || hour,
      originalColspan: originalColspan || colspan
    });
    setResizeStartX(e.clientX);
  };

  const handleResizeEnd = () => {
    setResizingBlock(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <p className="text-gray-600" dir="rtl">טוען...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4" onMouseUp={handleMouseUp} onMouseMove={handleResizeMove} onMouseUp={(e) => { handleMouseUp(e); handleResizeEnd(); }}>
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <Card className="border-none shadow-lg mb-4">
          <CardHeader className="border-b bg-white py-4 px-6">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl" dir="rtl">מטריצת זמינות</CardTitle>
              <div className="flex gap-2 items-center">
                <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                  השבוע
                </Button>
                <span className="px-3 py-1 bg-blue-50 text-blue-900 rounded font-medium text-sm" dir="rtl">
                  {format(weekStart, "dd/MM/yyyy")} - {format(addDays(weekStart, 6), "dd/MM/yyyy")}
                </span>
                <Button variant="outline" size="sm" onClick={goToNextWeek}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Matrix Table */}
        <Card className="border-none shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" dir="rtl">
                <thead>
                  {/* Day headers */}
                  <tr className="bg-gradient-to-l from-blue-600 to-blue-700">
                    <th className="sticky right-0 z-20 bg-blue-700 border border-blue-600 p-2 text-white font-semibold text-sm min-w-[150px]">
                      עובד
                    </th>
                    {weekDays.map((day, index) => (
                      <th key={index} colSpan={24} className="border border-blue-600 p-2 text-white text-center">
                        <div className="font-semibold">{HEBREW_DAYS[index]}</div>
                        <div className="text-xs font-normal mt-1">{format(day, "dd/MM")}</div>
                      </th>
                    ))}
                  </tr>
                  {/* Hour headers */}
                  <tr className="bg-blue-500">
                    <th className="sticky right-0 z-20 bg-blue-500 border border-blue-400 p-1"></th>
                    {weekDays.map((day, dayIndex) => (
                      <React.Fragment key={dayIndex}>
                        {hours.map((hour) => (
                          <th key={hour} className={`border border-blue-400 p-1 text-white text-[10px] min-w-[24px] w-[24px] ${hour === 5 ? 'border-l-4 border-l-blue-900' : ''}`}>
                            {hour}
                          </th>
                        ))}
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workers.map((worker, workerIndex) => (
                    <React.Fragment key={worker.id}>
                      <tr className={workerIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="sticky right-0 z-10 border border-gray-300 p-2 font-medium text-sm bg-inherit">
                          <div className="flex items-center justify-between gap-2">
                            <span>{worker.nickname}</span>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 w-6 p-0"
                              onClick={() => handleAddActivity(worker)}
                              title="הוסף בלוק"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                        {weekDays.map((day, dayIndex) => {
                          const blocks = getBlocksForWorkerDay(worker.id, dayIndex);
                          return (
                            <React.Fragment key={dayIndex}>
                              {blocks.map((block, blockIdx) => {
                                if (block.type === 'empty') {
                                  return (
                                    <td
                                      key={`${dayIndex}-${block.hour}`}
                                      className={`border border-gray-200 p-0 h-8 w-[24px] min-w-[24px] max-w-[24px] select-none ${!draggedBlock ? (isDrawing ? 'cursor-crosshair' : 'cursor-pointer hover:bg-blue-50') : 'bg-blue-100'} ${block.hour === 5 ? 'border-l-4 border-l-gray-800' : ''}`}
                                      onClick={(e) => handleCellClick(worker.id, dayIndex, block.hour, e)}
                                      onMouseEnter={() => handleCellMouseEnter(worker.id, dayIndex, block.hour)}
                                      onDragOver={handleCellDragOver}
                                      onDrop={(e) => handleCellDrop(worker.id, dayIndex, block.hour, e)}
                                    />
                                  );
                                }

                                return (
                                  <td
                                    key={`${dayIndex}-${block.hour}`}
                                    colSpan={block.colspan}
                                    className={`border border-gray-200 p-0 h-auto cursor-move ${block.category.color} ${block.hour === 5 ? 'border-l-4 border-l-gray-800' : ''} ${draggedBlock?.blockKey === block.blockKey ? 'opacity-50' : ''} relative group`}
                                    style={{ minWidth: `${block.colspan * 24}px`, maxWidth: `${block.colspan * 24}px` }}
                                    title={`${block.category.label} (${block.startTime} - ${block.endTime})${block.note ? '\n' + block.note : ''}\n\nגרור להעברה | לחץ לעריכה`}
                                    draggable
                                    onDragStart={(e) => handleBlockDragStart(block, e)}
                                    onDragEnd={handleBlockDragEnd}
                                    onDragOver={handleCellDragOver}
                                    onDrop={(e) => handleCellDrop(worker.id, dayIndex, block.hour, e)}
                                    onClick={(e) => handleBlockClick(block, e)}
                                  >
                                    <button
                                      className="absolute right-0 top-0 bottom-0 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-opacity z-10 pointer-events-auto cursor-ew-resize"
                                      onMouseDown={(e) => handleResizeStart(e, block, 'start')}
                                      title="גרור לשינוי גודל מההתחלה"
                                    >
                                      <ChevronRight className="w-3 h-3" />
                                    </button>
                                    <div className="h-full flex flex-col items-center justify-center px-1 py-1 pointer-events-none">
                                      <span className="text-[10px] font-semibold truncate" dir="rtl">
                                        {block.category.label}
                                      </span>
                                      {block.note && (
                                        <span className="text-[8px] text-gray-700 truncate max-w-full" dir="rtl">
                                          {block.note}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      className="absolute left-0 top-0 bottom-0 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-opacity z-10 pointer-events-auto cursor-ew-resize"
                                      onMouseDown={(e) => handleResizeStart(e, block, 'end')}
                                      title="גרור לשינוי גודל מהסוף"
                                    >
                                      <ChevronLeft className="w-3 h-3" />
                                    </button>
                                  </td>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </tr>
                      {workerActivities[worker.id] && workerActivities[worker.id].length > 0 && (
                        <tr className={workerIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="sticky right-0 z-10 border border-gray-300 p-2 bg-inherit" colSpan={1}>
                          </td>
                          <td colSpan={168} className="border border-gray-300 p-2">
                            <div className="flex flex-wrap gap-2 text-xs" dir="rtl">
                              {workerActivities[worker.id].map((activity, idx) => (
                                <div key={idx} className={`${activity.color} px-2 py-1 rounded flex items-center gap-1`}>
                                  <span className="font-medium">{HEBREW_DAYS[activity.day]}:</span>
                                  <span>{activity.category}</span>
                                  <span>({activity.start} - {activity.end})</span>
                                  {activity.note && (
                                    <span className="text-gray-700">- {activity.note}</span>
                                  )}
                                  <button 
                                    onClick={() => handleDeleteActivity(worker.id, activity.id)}
                                    className="hover:text-red-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {workers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500" dir="rtl">אין עובדים פעילים במערכת</p>
          </div>
        )}

        {/* Legend */}
        <Card className="border-none shadow-lg mt-4 max-w-2xl">
          <CardHeader className="border-b bg-white py-2 px-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base" dir="rtl">מקרא סוג פעילות</CardTitle>
                <p className="text-xs text-gray-600 mt-0.5" dir="rtl">לחץ על קטגוריה כדי לסמן אותה על המטריצה</p>
              </div>
              <Button onClick={handleAddCategory} size="sm">
                <Plus className="w-3 h-3 ml-1" />
                הוסף קטגוריה
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-1 gap-1.5">
              {categories.map((category) => (
                <div key={category.id} className="flex gap-1.5">
                  <button
                    onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${category.color} ${
                      selectedCategory === category.id 
                        ? `ring-2 ${category.borderColor} ring-opacity-50 scale-[1.02]` 
                        : 'hover:scale-[1.01]'
                    }`}
                    dir="rtl"
                  >
                    {category.label}
                  </button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditCategory(category)}
                    className="h-7 w-7 p-0"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteCategory(category.id)}
                    className="h-7 w-7 p-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Dialog */}
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingCategory ? "עריכת קטגוריה" : "הוספת קטגוריה חדשה"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>שם הקטגוריה</Label>
                <Input
                  value={categoryForm.label}
                  onChange={(e) => setCategoryForm({ ...categoryForm, label: e.target.value })}
                  placeholder="לדוגמה: משמרת בוקר"
                />
              </div>
              <div>
                <Label>צבע</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {COLOR_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setCategoryForm({ ...categoryForm, color: option.value })}
                      className={`h-10 rounded ${option.value} border-2 ${
                        categoryForm.color === option.value ? 'border-black' : 'border-gray-300'
                      }`}
                      title={option.label}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>ביטול</Button>
              <Button onClick={handleSaveCategory}>שמור</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Activity Dialog */}
        <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>הוספת פעילות ל-{selectedWorker?.nickname}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>יום</Label>
                <select
                  className="w-full border rounded p-2"
                  value={activityForm.day}
                  onChange={(e) => setActivityForm({ ...activityForm, day: parseInt(e.target.value) })}
                >
                  {HEBREW_DAYS.map((day, idx) => (
                    <option key={idx} value={idx}>{day}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>קטגוריה</Label>
                <select
                  className="w-full border rounded p-2"
                  value={activityForm.category_id}
                  onChange={(e) => setActivityForm({ ...activityForm, category_id: e.target.value })}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>שעת התחלה</Label>
                <Input
                  type="time"
                  value={activityForm.start_time}
                  onChange={(e) => setActivityForm({ ...activityForm, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label>שעת סיום</Label>
                <Input
                  type="time"
                  value={activityForm.end_time}
                  onChange={(e) => setActivityForm({ ...activityForm, end_time: e.target.value })}
                />
              </div>
              <div>
                <Label>הערה (אופציונלי)</Label>
                <Input
                  value={activityForm.note}
                  onChange={(e) => setActivityForm({ ...activityForm, note: e.target.value })}
                  placeholder="הערה נוספת..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowActivityDialog(false)}>ביטול</Button>
              <Button onClick={handleSaveActivity}>הוסף</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Block Note Dialog */}
        <Dialog open={showBlockNoteDialog} onOpenChange={setShowBlockNoteDialog}>
          <DialogContent dir="rtl" className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>עריכת בלוק</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>עובד</Label>
                <p className="text-sm font-medium">{workers.find(w => w.id === selectedBlock?.workerId)?.nickname}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>שעת התחלה</Label>
                  <select
                    className="w-full border rounded p-2"
                    value={blockStartHour}
                    onChange={(e) => setBlockStartHour(parseInt(e.target.value))}
                  >
                    {hours.map(h => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>שעת סיום</Label>
                  <select
                    className="w-full border rounded p-2"
                    value={blockEndHour}
                    onChange={(e) => setBlockEndHour(parseInt(e.target.value))}
                  >
                    {hours.map(h => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label>שנה קטגוריה</Label>
                <select
                  className="w-full border rounded p-2"
                  value={selectedCategoryChange}
                  onChange={(e) => {
                    setSelectedCategoryChange(e.target.value);
                    handleChangeBlockCategory(e.target.value);
                  }}
                >
                  <option value="">בחר קטגוריה חדשה...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>הערה</Label>
                <Input
                  value={blockNoteText}
                  onChange={(e) => setBlockNoteText(e.target.value)}
                  placeholder="הוסף הערה..."
                />
              </div>
            </div>
            <DialogFooter className="flex justify-between">
              <Button variant="destructive" onClick={handleDeleteBlock}>
                <Trash2 className="w-4 h-4 ml-1" />
                מחק בלוק
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowBlockNoteDialog(false)}>סגור</Button>
                <Button onClick={handleSaveBlockChanges}>שמור שינויים</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}