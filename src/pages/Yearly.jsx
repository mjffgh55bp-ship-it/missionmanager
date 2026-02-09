import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Plus, FileDown, Pencil, Trash2, Calendar } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { he } from "date-fns/locale";
import { getHebrewDate } from "../components/utils/HebrewDate";

export default function Yearly() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [events, setEvents] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: "",
    date: "",
    all_day: true,
    start_time: "08:00",
    end_time: "16:00"
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentWeekStart]);

  const loadData = async () => {
    setLoading(true);
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
    const weekStartStr = format(currentWeekStart, "yyyy-MM-dd");
    const weekEndStr = format(weekEnd, "yyyy-MM-dd");

    const [eventsData, workersData] = await Promise.all([
      base44.entities.CompanyEvent.list("-date"),
      base44.entities.Worker.filter({ active: true })
    ]);

    const weekEvents = eventsData.filter(e => e.date >= weekStartStr && e.date <= weekEndStr);
    setEvents(weekEvents);
    setWorkers(workersData);
    setLoading(false);
  };

  const handlePreviousWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  const handleAddEvent = (date) => {
    setEditingEvent(null);
    setEventForm({
      title: "",
      date: date || format(new Date(), "yyyy-MM-dd"),
      all_day: true,
      start_time: "08:00",
      end_time: "16:00"
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
      end_time: event.end_time || "16:00"
    });
    setShowEventDialog(true);
  };

  const handleSaveEvent = async () => {
    const data = {
      title: eventForm.title.trim() || "אירוע",
      date: eventForm.date,
      all_day: eventForm.all_day,
      start_time: eventForm.all_day ? null : eventForm.start_time,
      end_time: eventForm.all_day ? null : eventForm.end_time
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

  const handleDeleteEvent = async (eventId) => {
    if (!confirm("האם למחוק אירוע זה?")) return;
    await base44.entities.CompanyEvent.delete(eventId);
    loadData();
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

        {/* Week Navigation */}
        <Card className="border-4 border-black shadow-xl mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={handlePreviousWeek}>
                <ChevronRight className="w-6 h-6" />
              </Button>
              
              <div className="text-center">
                <p className="text-xl font-bold text-black" dir="rtl">
                  {format(currentWeekStart, "d", { locale: he })} {format(currentWeekStart, "MMMM", { locale: he })} - {format(weekEnd, "d MMMM yyyy", { locale: he })}
                </p>
              </div>

              <Button variant="ghost" size="icon" onClick={handleNextWeek}>
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
                onClick={() => handleAddEvent(format(day, "yyyy-MM-dd"))}
              >
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-600" dir="rtl">{HEBREW_DAYS_LONG[dayOfWeek]}</p>
                    <p className="text-2xl font-bold text-black mb-1">{format(day, "d")}</p>
                    <p className="text-xs text-gray-500" dir="rtl">{hebDate.dayHeb} {hebDate.monthHeb}</p>
                    
                    {/* Event dots */}
                    {dayEvents.length > 0 && (
                      <div className="mt-3 flex justify-center gap-1">
                        {dayEvents.slice(0, 3).map((event, i) => (
                          <div 
                            key={i} 
                            className="w-2 h-2 rounded-full bg-pink-400"
                            title={event.title}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-xs text-gray-500">+{dayEvents.length - 3}</span>
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
          <CardContent className="p-4">
            <div className="flex items-center justify-end gap-6" dir="rtl">
              <div className="flex items-center gap-2">
                <span className="text-sm text-black">זכר</span>
                <div className="w-4 h-4 rounded-full bg-pink-200 border-2 border-black"></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-black">נקבה</span>
                <div className="w-4 h-4 rounded-full bg-purple-200 border-2 border-black"></div>
              </div>
              <span className="text-sm font-bold text-black">מקרא - היום לפי:</span>
            </div>
          </CardContent>
        </Card>

        {/* Events List */}
        <Card className="border-4 border-black shadow-xl bg-white">
          <CardHeader className="border-b-4 border-black bg-gradient-to-r from-green-100 to-white">
            <CardTitle className="text-xl text-black" dir="rtl">אירועים בשבוע הנוכחי</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {events.length === 0 ? (
              <p className="text-center text-gray-500 py-8" dir="rtl">אין אירועים השבוע</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div 
                    key={event.id} 
                    className="p-4 bg-gradient-to-r from-pink-300 to-pink-400 border-4 border-black rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-black" />
                      <div>
                        <p className="font-bold text-black">{event.title}</p>
                        <p className="text-sm text-black">
                          {format(new Date(event.date), "d.M.yy")}
                          {!event.all_day && ` • ${event.start_time}-${event.end_time}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => handleEditEvent(event)}
                        className="h-8 w-8 hover:bg-pink-500"
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
                  </div>
                ))}
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
      </div>
    </div>
  );
}