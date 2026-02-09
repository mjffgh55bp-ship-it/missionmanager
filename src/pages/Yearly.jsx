import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, FileDown, Pencil, Trash2, Calendar, Settings } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { he } from "date-fns/locale";
import { getHebrewDate } from "../components/utils/HebrewDate";

const DEFAULT_CATEGORIES = [
  { name: "אירוע", color: "#ffc9e3" },
  { name: "משמרת", color: "#d4c5f9" },
  { name: "פגישה", color: "#bfdbfe" },
  { name: "יום הולדת", color: "#fed7aa" },
];

export default function Yearly() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [events, setEvents] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showDayEventsDialog, setShowDayEventsDialog] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: "",
    date: "",
    all_day: true,
    start_time: "08:00",
    end_time: "16:00",
    category: "אירוע"
  });
  const [categoryForm, setCategoryForm] = useState({ name: "", color: "#ffc9e3" });
  const [editingCategoryIndex, setEditingCategoryIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    loadData();
  }, [currentWeekStart]);

  const loadData = async () => {
    if (loading) return; // Prevent multiple simultaneous loads
    setLoading(true);
    setError(null);
    try {
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
      const weekStartStr = format(currentWeekStart, "yyyy-MM-dd");
      const weekEndStr = format(weekEnd, "yyyy-MM-dd");

      const [eventsData, workersData, categoriesSettings] = await Promise.all([
        base44.entities.CompanyEvent.list("-date"),
        base44.entities.Worker.filter({ active: true }),
        base44.entities.AppSettings.filter({ setting_key: "event_categories" })
      ]);

      // Create birthday events for workers
      const currentYear = new Date().getFullYear();
      const birthdayEvents = workersData
        .filter(w => w.birth_date)
        .map(w => {
          const birthDate = new Date(w.birth_date);
          const thisYearBirthday = `${currentYear}-${String(birthDate.getMonth() + 1).padStart(2, '0')}-${String(birthDate.getDate()).padStart(2, '0')}`;
          return {
            id: `birthday-${w.id}`,
            title: `יום הולדת ל${w.nickname || w.email}`,
            date: thisYearBirthday,
            description: "יום הולדת",
            all_day: true,
            isBirthday: true
          };
        });

      const allEvents = [...eventsData, ...birthdayEvents];
      const weekEvents = allEvents.filter(e => e.date >= weekStartStr && e.date <= weekEndStr);
      setEvents(weekEvents);
      setWorkers(workersData);
      
      if (categoriesSettings.length > 0) {
        setCategories(JSON.parse(categoriesSettings[0].setting_value));
      }
      
      setLoading(false);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("אירעה שגיאה בטעינת הנתונים. אנא המתן מספר שניות ונסה שוב.");
      setLoading(false);
    }
  };

  const handlePreviousWeek = () => {
    if (loading) return;
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const handleNextWeek = () => {
    if (loading) return;
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  const handleAddEvent = (date) => {
    setEditingEvent(null);
    setEventForm({
      title: "",
      date: date || format(new Date(), "yyyy-MM-dd"),
      all_day: true,
      start_time: "08:00",
      end_time: "16:00",
      category: categories[0]?.name || "אירוע"
    });
    setShowEventDialog(true);
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setEventForm({
      title: event.title || "",
      date: event.date,
      all_day: event.all_day !== false,
      start_time: event.start_time || "08:00",
      end_time: event.end_time || "16:00",
      category: event.description || categories[0]?.name || "אירוע"
    });
    setShowEventDialog(true);
  };

  const handleSaveEvent = async () => {
    const data = {
      title: eventForm.title.trim() || "אירוע",
      date: eventForm.date,
      all_day: eventForm.all_day,
      start_time: eventForm.all_day ? null : eventForm.start_time,
      end_time: eventForm.all_day ? null : eventForm.end_time,
      description: eventForm.category
    };

    if (editingEvent) {
      await base44.entities.CompanyEvent.update(editingEvent.id, data);
    } else {
      await base44.entities.CompanyEvent.create(data);
    }

    setShowEventDialog(false);
    setEditingEvent(null);
    loadData();
  };

  const handleAddCategory = () => {
    setEditingCategoryIndex(null);
    setCategoryForm({ name: "", color: "#ec4899" });
    setShowCategoryDialog(true);
  };

  const handleEditCategory = (category, index) => {
    setEditingCategoryIndex(index);
    setCategoryForm({ name: category.name, color: category.color });
    setShowCategoryDialog(true);
  };

  const handleSaveCategory = async () => {
    let newCategories;
    if (editingCategoryIndex !== null) {
      newCategories = [...categories];
      newCategories[editingCategoryIndex] = categoryForm;
    } else {
      newCategories = [...categories, categoryForm];
    }
    
    setCategories(newCategories);
    
    const settings = await base44.entities.AppSettings.filter({ setting_key: "event_categories" });
    const data = { setting_key: "event_categories", setting_value: JSON.stringify(newCategories) };
    
    if (settings.length > 0) {
      await base44.entities.AppSettings.update(settings[0].id, data);
    } else {
      await base44.entities.AppSettings.create(data);
    }
    
    setShowCategoryDialog(false);
    setCategoryForm({ name: "", color: "#ec4899" });
    setEditingCategoryIndex(null);
  };

  const handleDeleteCategory = async (index) => {
    if (!confirm("האם למחוק קטגוריה זו?")) return;
    
    const newCategories = categories.filter((_, i) => i !== index);
    setCategories(newCategories);
    
    const settings = await base44.entities.AppSettings.filter({ setting_key: "event_categories" });
    if (settings.length > 0) {
      await base44.entities.AppSettings.update(settings[0].id, { setting_value: JSON.stringify(newCategories) });
    }
  };

  const getCategoryColor = (categoryName) => {
    const category = categories.find(c => c.name === categoryName);
    return category?.color || "#ffc9e3";
  };

  const getFilteredEvents = () => {
    if (!selectedCategory) return events;
    return events.filter(e => e.description === selectedCategory);
  };

  const getCategorySummary = (categoryName) => {
    const categoryEvents = events.filter(e => e.description === categoryName);
    return categoryEvents.length;
  };

  const handleDeleteEvent = async (eventId) => {
    if (!confirm("האם למחוק אירוע זה?")) return;
    await base44.entities.CompanyEvent.delete(eventId);
    setShowDayEventsDialog(false);
    loadData();
  };

  const handleDayClick = (date) => {
    const dayEvents = getEventsForDay(date);
    setSelectedDate(format(date, "yyyy-MM-dd"));
    setSelectedDayEvents(dayEvents);
    setShowDayEventsDialog(true);
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(currentWeekStart, i));
    }
    return days;
  };

  const getEventsForDay = (date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return events.filter(e => e.date === dateStr);
  };

  const weekDays = getWeekDays();
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });

  const HEBREW_DAYS_LONG = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-green-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-black mb-2" dir="rtl">תקופתית</h1>
          <p className="text-gray-600" dir="rtl">לוח אירועים ומשמרות</p>
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <Button 
            onClick={() => handleAddEvent()}
            className="bg-green-400 hover:bg-green-500 text-black border-2 border-black"
            dir="rtl"
          >
            <Plus className="w-4 h-4 ml-2" />
            הוסף אירוע
          </Button>
          
          <Button 
            variant="outline"
            className="border-2 border-black"
            dir="rtl"
          >
            <FileDown className="w-4 h-4 ml-2" />
            ייצוא לקובץ
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border-4 border-red-500 rounded-xl" dir="rtl">
            <p className="text-red-800 font-bold">{error}</p>
            <Button 
              onClick={loadData}
              className="mt-2 bg-red-500 hover:bg-red-600 text-white"
            >
              נסה שוב
            </Button>
          </div>
        )}

        {/* Week Navigation */}
        <Card className="border-4 border-black shadow-xl mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handlePreviousWeek}
                disabled={loading}
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
              
              <div className="text-center">
                <p className="text-xl font-bold text-black" dir="rtl">
                  {format(currentWeekStart, "d", { locale: he })} {format(currentWeekStart, "MMMM", { locale: he })} - {format(weekEnd, "d MMMM yyyy", { locale: he })}
                </p>
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleNextWeek}
                disabled={loading}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Week View */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-8">
          {weekDays.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const hebDate = getHebrewDate(day);
            const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
            const dayOfWeek = day.getDay();
            const isShabbat = dayOfWeek === 6;
            
            return (
              <Card 
                key={idx} 
                className={`border-4 shadow-lg cursor-pointer hover:shadow-xl transition-shadow ${
                  isToday ? 'border-green-400 bg-green-100' : 'border-black bg-white'
                }`}
                onClick={() => handleDayClick(day)}
              >
                <CardContent className="p-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-600" dir="rtl">{HEBREW_DAYS_LONG[dayOfWeek]}</p>
                    <p className="text-2xl font-bold text-black mb-1">{format(day, "d")}</p>
                    <p className="text-xs text-gray-500" dir="rtl">{hebDate.dayHeb} {hebDate.monthHeb}</p>
                    
                    {/* Events list */}
                    {dayEvents.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {dayEvents.slice(0, 2).map((event, i) => (
                          <div 
                            key={i} 
                            className="text-xs px-2 py-1 rounded border-2 border-black truncate"
                            style={{ backgroundColor: getCategoryColor(event.description) }}
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-gray-600 font-bold">
                            +{dayEvents.length - 2} נוספים
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Legend */}
        <Card className="border-4 border-black shadow-xl mb-6 bg-white">
          <CardHeader className="border-b-4 border-black bg-gradient-to-r from-green-100 to-white py-3">
            <div className="flex items-center justify-between">
              <Button 
                size="sm"
                onClick={handleAddCategory}
                className="bg-green-400 hover:bg-green-500 text-black border-2 border-black"
              >
                <Plus className="w-3 h-3 ml-1" />
                הוסף קטגוריה
              </Button>
              <CardTitle className="text-lg text-black" dir="rtl">מקרא</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center justify-end gap-3 flex-wrap" dir="rtl">
              {categories.map((category, index) => {
                const count = getCategorySummary(category.name);
                const isSelected = selectedCategory === category.name;
                return (
                  <button 
                    key={index}
                    onClick={() => setSelectedCategory(isSelected ? null : category.name)}
                    className={`flex items-center gap-2 p-2 px-3 rounded-lg border-2 transition-all group ${
                      isSelected ? 'border-black bg-gray-100' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCategory(category, index);
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Pencil className="w-3 h-3 text-gray-600" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(index);
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-gray-600">({count})</span>
                    <span className="text-sm text-black font-bold">{category.name}</span>
                    <div 
                      className="w-5 h-5 rounded-full border-2 border-black" 
                      style={{ backgroundColor: category.color }}
                    ></div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Events List */}
        <Card className="border-4 border-black shadow-xl bg-white">
          <CardHeader className="border-b-4 border-black bg-gradient-to-r from-green-100 to-white">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl text-black" dir="rtl">
                {selectedCategory ? `אירועים: ${selectedCategory}` : 'אירועים בשבוע הנוכחי'}
              </CardTitle>
              {selectedCategory && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className="border-2 border-black"
                  dir="rtl"
                >
                  הצג הכל
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {getFilteredEvents().length === 0 ? (
              <p className="text-center text-gray-500 py-8" dir="rtl">
                {selectedCategory ? `אין אירועים בקטגוריה "${selectedCategory}"` : 'אין אירועים השבוע'}
              </p>
            ) : (
              <div className="space-y-3">
                {getFilteredEvents().map((event) => {
                  const eventColor = getCategoryColor(event.description);
                  return (
                    <div 
                      key={event.id} 
                      className="p-4 border-4 border-black rounded-xl flex items-center justify-between"
                      style={{ background: `linear-gradient(to right, ${eventColor}dd, ${eventColor})` }}
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-black" />
                        <div>
                          <p className="font-bold text-black">{event.title}</p>
                          <p className="text-sm text-black">
                            {format(new Date(event.date), "d.M.yy")}
                            {!event.all_day && ` • ${event.start_time}-${event.end_time}`}
                            {event.description && ` • ${event.description}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                       {!event.isBirthday && (
                         <>
                           <Button 
                             size="icon" 
                             variant="ghost"
                             onClick={() => handleEditEvent(event)}
                             className="h-8 w-8 hover:bg-black/10"
                           >
                             <Pencil className="w-4 h-4 text-black" />
                           </Button>
                           <Button 
                             size="icon" 
                             variant="ghost"
                             onClick={() => handleDeleteEvent(event.id)}
                             className="h-8 w-8 hover:bg-red-400"
                           >
                             <Trash2 className="w-4 h-4 text-black" />
                           </Button>
                         </>
                       )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event Dialog */}
        <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle dir="rtl">{editingEvent ? "עריכת אירוע" : "אירוע חדש"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label dir="rtl">כותרת</Label>
                <Input
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  placeholder="שם האירוע"
                  className="mt-1"
                  dir="rtl"
                />
              </div>
              <div>
                <Label dir="rtl">תאריך</Label>
                <Input
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label dir="rtl">קטגוריה</Label>
                <Select 
                  value={eventForm.category} 
                  onValueChange={(value) => setEventForm({ ...eventForm, category: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat, idx) => (
                      <SelectItem key={idx} value={cat.name}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full border border-black" 
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={eventForm.all_day}
                  onChange={(e) => setEventForm({ ...eventForm, all_day: e.target.checked })}
                  className="rounded"
                />
                <Label dir="rtl">כל היום</Label>
              </div>
              {!eventForm.all_day && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label dir="rtl">שעת התחלה</Label>
                    <Input
                      type="time"
                      value={eventForm.start_time}
                      onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label dir="rtl">שעת סיום</Label>
                    <Input
                      type="time"
                      value={eventForm.end_time}
                      onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="flex-row-reverse gap-2">
              <Button 
                onClick={handleSaveEvent}
                className="bg-green-400 hover:bg-green-500 text-black border-2 border-black"
              >
                {editingEvent ? "עדכן" : "הוסף"}
              </Button>
              <Button variant="outline" onClick={() => setShowEventDialog(false)}>
                ביטול
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Category Dialog */}
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle dir="rtl">{editingCategoryIndex !== null ? "עריכת קטגוריה" : "קטגוריה חדשה"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label dir="rtl">שם הקטגוריה</Label>
                <Input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="שם"
                  className="mt-1"
                  dir="rtl"
                />
              </div>
              <div className="space-y-2">
                <Label dir="rtl">צבע</Label>
                <div className="flex gap-2 flex-wrap">
                  {['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'].map(color => (
                    <button
                      key={color}
                      className={`w-10 h-10 rounded-full border-4 ${categoryForm.color === color ? 'border-black' : 'border-gray-300'}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setCategoryForm({ ...categoryForm, color })}
                    />
                  ))}
                </div>
                <Input
                  type="color"
                  value={categoryForm.color}
                  onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  className="mt-2 h-10"
                />
              </div>
            </div>
            <DialogFooter className="flex-row-reverse gap-2">
              <Button 
                onClick={handleSaveCategory}
                className="bg-green-400 hover:bg-green-500 text-black border-2 border-black"
                disabled={!categoryForm.name.trim()}
              >
                {editingCategoryIndex !== null ? "עדכן" : "הוסף"}
              </Button>
              <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
                ביטול
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Day Events Dialog */}
        <Dialog open={showDayEventsDialog} onOpenChange={setShowDayEventsDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle dir="rtl">
                אירועים ב-{selectedDate && format(new Date(selectedDate), "d MMMM yyyy", { locale: he })}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {selectedDayEvents.length === 0 ? (
                <p className="text-center text-gray-500 py-8" dir="rtl">אין אירועים ביום זה</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {selectedDayEvents.map((event, idx) => {
                    const eventColor = getCategoryColor(event.description);
                    return (
                      <div 
                        key={idx}
                        className="p-4 border-4 border-black rounded-xl"
                        style={{ background: `linear-gradient(to right, ${eventColor}dd, ${eventColor})` }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-bold text-black text-lg">{event.title}</p>
                            <p className="text-sm text-black mt-1">
                              {!event.all_day && `${event.start_time}-${event.end_time} • `}
                              {event.description}
                            </p>
                          </div>
                          {!event.isBirthday && (
                            <div className="flex gap-2">
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => {
                                  handleEditEvent(event);
                                  setShowDayEventsDialog(false);
                                }}
                                className="h-8 w-8 hover:bg-black/10"
                              >
                                <Pencil className="w-4 h-4 text-black" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => handleDeleteEvent(event.id)}
                                className="h-8 w-8 hover:bg-red-400"
                              >
                                <Trash2 className="w-4 h-4 text-black" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <DialogFooter className="flex-row-reverse gap-2">
              <Button 
                onClick={() => {
                  setShowDayEventsDialog(false);
                  handleAddEvent(selectedDate);
                }}
                className="bg-green-400 hover:bg-green-500 text-black border-2 border-black"
              >
                <Plus className="w-4 h-4 ml-2" />
                הוסף אירוע
              </Button>
              <Button variant="outline" onClick={() => setShowDayEventsDialog(false)}>
                סגור
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}