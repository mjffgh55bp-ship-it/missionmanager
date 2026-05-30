import React, { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { getCachedWorkers, getCachedTemplates, getCachedAllSettings, parseSetting, parseListSetting } from "@/lib/appDataCache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Check, X, Info, GripVertical, Plus, XCircle, Star, Ban, ChevronLeft, ChevronRight, PartyPopper, Pencil, Download, Lock } from "lucide-react";
import { format, startOfWeek, addDays, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { formatHebrewDate } from "../components/utils/HebrewDate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import ShiftDemandPanel from "@/components/availability/ShiftDemandPanel";
import { buildSignupKey, serializePossibleInstances, buildUnifiedShiftDemand, getSignupsForShift } from "@/lib/shiftDemand";
import { signupForShift } from "@/functions/signupForShift";

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HEBREW_DAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

const formatDateHebrew = (date, formatType = "short") => {
  const d = new Date(date);
  const dayName = HEBREW_DAYS[d.getDay()];
  const dayNameShort = HEBREW_DAYS_SHORT[d.getDay()];
  const monthName = HEBREW_MONTHS[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();

  if (formatType === "short") {
    return `${dayNameShort}, ${day} ${monthName}`;
  } else if (formatType === "long") {
    return `${dayName}, ${day} ${monthName}, ${year}`;
  } else if (formatType === "monthYear") {
    return `${monthName} ${year}`;
  }
  return `${day} ${monthName}`;
};

const SHIFT_BLOCKS = [
{ start: "06:00", end: "10:00" },
{ start: "10:00", end: "14:00" },
{ start: "14:00", end: "18:00" },
{ start: "18:00", end: "22:00" },
{ start: "22:00", end: "02:00" },
{ start: "02:00", end: "06:00" }];


const DAYS_OF_WEEK = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// Permanent denylist — these registration names are obsolete and must never be shown
const STALE_REG_DENYLIST_STATIC = ["מנהלי מסעדה יום", "מנהלי מסעדה לילה"];

export default function Availability() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [currentWorker, setCurrentWorker] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selectedShifts, setSelectedShifts] = useState([]);
  const [originalShifts, setOriginalShifts] = useState([]);
  const [existingAvailability, setExistingAvailability] = useState(null);
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [companyEvents, setCompanyEvents] = useState([]);
  const [yearlyEvents, setYearlyEvents] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [showEditMode, setShowEditMode] = useState(false);
  const [showChangeRecap, setShowChangeRecap] = useState(false);
  const [showUnavailabilityDialog, setShowUnavailabilityDialog] = useState(false);
  const [showDateDetails, setShowDateDetails] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [changeNote, setChangeNote] = useState("");
  const [tipsMessage, setTipsMessage] = useState("");
  const [showTipsPopup, setShowTipsPopup] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [unavailabilityForm, setUnavailabilityForm] = useState({
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "09:00",
    end_time: "17:00",
    reason: "occupied",
    multiDay: false
  });
  const [desiredShiftsCount, setDesiredShiftsCount] = useState("");
  const [extraTaskStates, setExtraTaskStates] = useState({});
  const [openRegistrations, setOpenRegistrations] = useState([]);
  const [workerRolesSettings, setWorkerRolesSettings] = useState([]);
  const [templateRows, setTemplateRows] = useState([]);
  const [allTemplateRowsForCalendar, setAllTemplateRowsForCalendar] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [isManager, setIsManager] = useState(false);
  const [weekAvailabilities, setWeekAvailabilities] = useState([]);
  const [signupMode, setSignupMode] = useState("allow_over_sign_up");
  const [editingTips, setEditingTips] = useState(false);
  const [tipsEditValue, setTipsEditValue] = useState("");
  const [showTipsAsPopup, setShowTipsAsPopup] = useState(false);

  const initialLoadStarted = useRef(false);
  const lastWeekStart = useRef(null);
  const staticLoaded = useRef(false);
  const cachedUser = useRef(null);
  const cachedWorker = useRef(null);
  const cachedAllTemplateRows = useRef(null);
  const cachedAllAssignments = useRef(null);
  const isLoadingAllRef = useRef(false);
  const isLoadingDynamicRef = useRef(false);
  const queuedRefreshRef = useRef(false);
  // Track which week key we last finished loading, to drop stale results
  const loadedWeekKeyRef = useRef(null);
  // Live sync
  const syncDebounceRef = useRef(null);
  const broadcastRef = useRef(null);

  useEffect(() => {
    const weekKey = weekStart.toISOString();
    if (!initialLoadStarted.current) {
      initialLoadStarted.current = true;
      lastWeekStart.current = weekKey;
      loadAllData();
      return;
    }
    if (lastWeekStart.current === weekKey) return;
    lastWeekStart.current = weekKey;
    // On week change: reload only dynamic (week-scoped) data, skip static
    loadDynamicData(cachedWorker.current, cachedUser.current);
  }, [weekStart]);

  // Lightweight refetch — only weekAvailabilities (for live count updates)
  const refetchWeekAvailabilities = () => {
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    syncDebounceRef.current = setTimeout(async () => {
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const fresh = await base44.entities.Availability.filter({ week_start_date: weekStartStr });
      setWeekAvailabilities(fresh);
    }, 300);
  };

  // Live sync: real-time DB subscription + BroadcastChannel + localStorage + focus
  useEffect(() => {
    // ── Real-time DB subscription — fires on ANY device/browser ──────────────
    // Updates weekAvailabilities directly from the event payload — NO extra API call
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const unsubAvailability = base44.entities.Availability.subscribe((event) => {
      const record = event.data;
      if (!record || record.week_start_date !== weekStartStr) return;
      // Don't override our own optimistic update (already set locally)
      if (record.worker_id === cachedWorker.current?.id) return;
      setWeekAvailabilities(prev => {
        const without = prev.filter(a => !(a.worker_id === record.worker_id && a.week_start_date === record.week_start_date));
        if (event.type === 'delete') return without;
        return [...without, record];
      });
    });

    // Listen for AppSettings changes — registration open/close arrives here
    const unsubSettings = base44.entities.AppSettings.subscribe(() => {
      base44.entities.AppSettings.list().then(async freshSettings => {
        const freshOpenReg = parseSetting(freshSettings, "open_registrations", []);
        setOpenRegistrations(freshOpenReg);

        // Also fetch fresh TemplateRows AND Templates so newly created mokeds appear immediately.
        // allTemplates must be updated too — filterVisibleScheduleRows looks up each row's template
        // by ID. If the template was created after allTemplates was last set, it won't be found
        // and all its rows are silently filtered out, leaving the panel empty.
        try {
          const [freshRows, freshTemplates] = await Promise.all([
            base44.entities.TemplateRow.list("-date", 500),
            getCachedTemplates(base44.entities),
          ]);
          cachedAllTemplateRows.current = freshRows;
          setAllTemplates(freshTemplates);

          if (weekStart) {
            const weekStartStr = format(weekStart, "yyyy-MM-dd");
            const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");
            const weekDates = Array.from({ length: 7 }, (_, i) =>
              format(addDays(weekStart, i), "yyyy-MM-dd")
            );
            const weekRows = freshRows.filter(r =>
              weekDates.includes(r.date) &&
              r.date >= weekStartStr &&
              r.date <= weekEndStr
            );
            setTemplateRows(weekRows);
          }
        } catch {
          cachedAllTemplateRows.current = null;
        }
      }).catch(() => {});
    });

    // BroadcastChannel for same-origin cross-tab sync (fast path, no extra API call)
    const bc = new BroadcastChannel("availability-sync");
    broadcastRef.current = bc;
    // Cross-tab: only refetch if it's a different tab updating (we can't get the record directly)
    bc.onmessage = () => refetchWeekAvailabilities();

    // localStorage fallback
    const onStorage = (e) => {
      if (e.key === "availability-sync-event") refetchWeekAvailabilities();
    };
    window.addEventListener("storage", onStorage);

    // Refetch on tab focus (catches cases where subscription or storage missed)
    const onFocus = () => refetchWeekAvailabilities();
    window.addEventListener("focus", onFocus);

    // Custom in-page event (same-tab immediate update)
    const onUpdated = () => refetchWeekAvailabilities();
    window.addEventListener("availabilityUpdated", onUpdated);

    return () => {
      unsubAvailability();
      unsubSettings();
      bc.close();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("availabilityUpdated", onUpdated);
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    };
  }, [weekStart]);

  // First load: identify user immediately, then parallelize everything else
  const loadAllData = async () => {
    if (isLoadingAllRef.current) return;
    isLoadingAllRef.current = true;
    try {
      // Step 1: identify user FIRST — critical path
      const user = await base44.auth.me();
      cachedUser.current = user;
      setCurrentUser(user);

      const weekStartStr2 = format(startOfWeek(weekStart, { weekStartsOn: 0 }), "yyyy-MM-dd");

      // Step 2: fetch static data in parallel (all cached/lightweight)
      const [workersData, allSettings, eventsData, yearlyEventsData] = await Promise.all([
        getCachedWorkers(base44.entities),
        getCachedAllSettings(base44.entities),
        base44.entities.CompanyEvent.list("-date"),
        base44.entities.YearlyEvent.list("-start_date", 500),
      ]);

      // Extract settings client-side (no extra API calls)
      const openReg = parseSetting(allSettings, "open_registrations", []);
      const workerRolesRaw = parseSetting(allSettings, "worker_roles", null);
      const workerRolesList = workerRolesRaw
        ? workerRolesRaw.map(r => (typeof r === "string" ? { name: r, mapping_id: "" } : r))
        : [];
      setWorkerRolesSettings(workerRolesList);
      const userRoles = parseSetting(allSettings, "user_roles", {});
      const signupModeSetting = parseSetting(allSettings, "availability_signup_mode", "allow_over_sign_up");
      setSignupMode(signupModeSetting);
      const globalTips = parseSetting(allSettings, "availability_tips", null);
      const weekTipsRaw = allSettings.find(s => s.setting_key === `availability_tips_${weekStartStr2}`);
      const weekTips = weekTipsRaw ? (() => { try { return JSON.parse(weekTipsRaw.setting_value); } catch { return null; } })() : null;
      const acknowledgedRaw = allSettings.find(s => s.setting_key === `tips_acknowledged_${user.email}`);
      const acknowledgedVersion = acknowledgedRaw ? acknowledgedRaw.setting_value : null;

      setWorkers(workersData.sort((a, b) => (a.nickname || "").localeCompare(b.nickname || "")));
      setCompanyEvents(eventsData);
      setYearlyEvents(yearlyEventsData);
      setOpenRegistrations(openReg);

      const worker = workersData.find((w) => w.email === user.email);
      cachedWorker.current = worker;
      setCurrentWorker(worker);

      // Manager check
      const role = userRoles[user.email];
      setIsManager(user.role === 'admin' || role === 'manager');

      // Tips
      const tipsData = weekTips || globalTips;
      if (tipsData) {
        setTipsMessage(tipsData.message || "");
        setTipsEditValue(tipsData.message || "");
        setShowTipsAsPopup(tipsData.showAsPopup || false);
        if (tipsData.message?.trim() && tipsData.showAsPopup && acknowledgedVersion !== tipsData.message) {
          setShowTipsPopup(true);
        }
      } else {
        setTipsMessage("");
        setTipsEditValue("");
      }

      staticLoaded.current = true;

      // Step 3: load dynamic (week-scoped) data immediately — no artificial delay
      if (worker) {
        await loadDynamicData(worker, user);
      }
    } finally {
      isLoadingAllRef.current = false;
    }
  };

  // Week-change reload: only dynamic data, use cached templates
  const loadDynamicData = async (worker, user) => {
    if (!worker) return;
    if (isLoadingDynamicRef.current) {
      queuedRefreshRef.current = true;
      return;
    }
    isLoadingDynamicRef.current = true;
    const weekKey = weekStart.toISOString();

    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");
    const weekDates = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), "yyyy-MM-dd"));

    try {
      // Fetch dynamic data sequentially with small delays to avoid rate limits
      const templatesData = await getCachedTemplates(base44.entities);
      const availabilities = await base44.entities.Availability.filter({ worker_id: worker.id, week_start_date: weekStartStr });
      await new Promise(r => setTimeout(r, 150));
      const unavailabilitiesData = await base44.entities.Unavailability.filter({ worker_id: worker.id });
      await new Promise(r => setTimeout(r, 150));
      const weekAvailsData = await base44.entities.Availability.filter({ week_start_date: weekStartStr });
      await new Promise(r => setTimeout(r, 150));
      const freshSettings = await base44.entities.AppSettings.list();

      // Apply fresh open_registrations from settings
      const freshOpenReg = parseSetting(freshSettings, "open_registrations", []);
      setOpenRegistrations(freshOpenReg);

      // Always fetch fresh TemplateRows so new mokeds created by the manager are visible.
      // Fetch Assignments from cache (changes rarely, no need to re-fetch every week change).
      const freshTemplateRows = await base44.entities.TemplateRow.list("-date", 500);
      cachedAllTemplateRows.current = freshTemplateRows;
      const allWeekRows = freshTemplateRows;

      if (!cachedAllAssignments.current) {
        cachedAllAssignments.current = await base44.entities.Assignment.list("-date", 500);
      }
      const allWorkerAssignments = cachedAllAssignments.current;
      const perDayRowArrays = [allWeekRows.filter(r => weekDates.includes(r.date))];
      const assignmentsData = allWorkerAssignments.filter(a => a.chef_id === worker.id);
      const sousAssignments = allWorkerAssignments.filter(a => a.sous_chef_id === worker.id);
      const additionalAssignments = allWorkerAssignments.filter(a => a.additional_chef_id === worker.id);

      // Drop stale results if week changed while loading
      if (weekStart.toISOString() !== weekKey && weekKey !== lastWeekStart.current) return;

      if (availabilities.length > 0) {
        setExistingAvailability(availabilities[0]);
        const rawShifts = availabilities[0].shifts || [];

        // Step 1: collect all date+time slots that have at least one KEYED entry (with signupKey or sharedMokedKey)
        const slotsWithKeyedEntry = new Set();
        rawShifts.forEach(s => {
          if (s.signupKey || s.sharedMokedKey) {
            const d = s.operational_date || s.date;
            slotsWithKeyedEntry.add(`${d}__${s.start_time}__${s.end_time}`);
          }
        });

        // Step 2: remove naked (no moked identity) entries for slots that already have a keyed entry.
        // This eliminates legacy duplicates that cause multiple chips to appear highlighted.
        const withoutNakedDupes = rawShifts.filter(s => {
          if (s.signupKey || s.sharedMokedKey) return true; // keyed entry — always keep
          const slotKey = `${s.operational_date || s.date}__${s.start_time}__${s.end_time}`;
          return !slotsWithKeyedEntry.has(slotKey); // remove naked only if a keyed entry exists for this slot
        });

        // Step 2b: remove naked entries for slots that have multiple distinct signupKeys.
        // These entries are permanently ambiguous — cannot be assigned to either moked.
        const slotSignupKeys = new Map(); // slotKey → Set<signupKey>
        rawShifts.forEach(s => {
          if (s.signupKey) {
            const slotKey = `${s.operational_date || s.date}__${s.start_time}__${s.end_time}`;
            if (!slotSignupKeys.has(slotKey)) slotSignupKeys.set(slotKey, new Set());
            slotSignupKeys.get(slotKey).add(s.signupKey);
          }
        });
        const withoutAmbiguousNakeds = withoutNakedDupes.filter(s => {
          if (s.signupKey || s.sharedMokedKey) return true;
          const slotKey = `${s.operational_date || s.date}__${s.start_time}__${s.end_time}`;
          const keysAtSlot = slotSignupKeys.get(slotKey);
          if (keysAtSlot && keysAtSlot.size > 1) return false; // ambiguous — remove
          return true;
        });

        // Step 3: deduplicate remaining entries by their canonical key (keep last occurrence)
        const seenKeys = new Map();
        withoutAmbiguousNakeds.forEach((s, idx) => {
          const key = s.signupKey || (s.sharedMokedKey
            ? buildSignupKey(s.operational_date || s.date, s.sharedMokedKey, s.start_time, s.end_time)
            : `${s.operational_date || s.date}__${s.start_time}__${s.end_time}`);
          seenKeys.set(key, idx);
        });
        const deduped = withoutAmbiguousNakeds.filter((s, idx) => {
          const key = s.signupKey || (s.sharedMokedKey
            ? buildSignupKey(s.operational_date || s.date, s.sharedMokedKey, s.start_time, s.end_time)
            : `${s.operational_date || s.date}__${s.start_time}__${s.end_time}`);
          return seenKeys.get(key) === idx;
        });
        // Step 4: upgrade naked entries to keyed entries using the current week's demand map.
        const weekRowsForUpgrade = allWeekRows.filter(r => weekDates.includes(r.date) && !r.values?.is_hidden && !r.values?.hidden);

        if (weekRowsForUpgrade.length === 0) {
          // No schedule set up for this week — skip upgrade, keep deduped as-is
          setSelectedShifts(deduped);
          setOriginalShifts(JSON.parse(JSON.stringify(deduped)));
          setExtraTaskStates(availabilities[0].extra_tasks || {});
        } else {
          const demandMapForUpgrade = buildUnifiedShiftDemand(weekRowsForUpgrade, templatesData);
          const slotToSignupKeys = new Map();
          demandMapForUpgrade.forEach((shift, key) => {
            const slotKey = `${shift.date}__${shift.startTime}__${shift.endTime}`;
            if (!slotToSignupKeys.has(slotKey)) slotToSignupKeys.set(slotKey, []);
            slotToSignupKeys.get(slotKey).push(key);
          });

          const upgraded = deduped.map(s => {
            if (s.signupKey || s.sharedMokedKey) return s; // already keyed — always keep
            const slotKey = `${s.operational_date || s.date}__${s.start_time}__${s.end_time}`;
            const keys = slotToSignupKeys.get(slotKey);
            if (!keys || keys.length === 0) return s; // no demand for slot → keep as-is
            if (keys.length === 1) {
              const matched = demandMapForUpgrade.get(keys[0]);
              return {
                ...s,
                signupKey: matched.signupKey,
                sharedMokedKey: matched.sharedMokedKey,
                moked_name: matched.mokedName,
                operational_date: s.operational_date || s.date,
              };
            }
            return s; // ambiguous (2+ mokeds at same slot) → keep as-is, don't drop
          });

          setSelectedShifts(upgraded);
          setOriginalShifts(JSON.parse(JSON.stringify(upgraded)));
          setExtraTaskStates(availabilities[0].extra_tasks || {});
        }
      } else {
        setExistingAvailability(null);
        setSelectedShifts([]);
        setOriginalShifts([]);
        setExtraTaskStates({});
      }

      const weekUnavailabilities = unavailabilitiesData.filter((u) => {
        const uDate = new Date(u.date);
        return uDate >= new Date(weekStartStr) && uDate <= new Date(weekEndStr);
      });
      setUnavailabilities(weekUnavailabilities);

      const allTemplateRowsData = perDayRowArrays.flat();
      const templateRowsData = allTemplateRowsData.filter(r => r.date >= weekStartStr && r.date <= weekEndStr);

      const allAssignments = [...assignmentsData, ...sousAssignments, ...additionalAssignments];
      setAssignments(allAssignments);
      setTemplateRows(templateRowsData);
      setAllTemplateRowsForCalendar(allTemplateRowsData);
      setAllTemplates(templatesData);
      setWeekAvailabilities(weekAvailsData);

      loadedWeekKeyRef.current = weekKey;
    } finally {
      isLoadingDynamicRef.current = false;
      if (queuedRefreshRef.current) {
        queuedRefreshRef.current = false;
        loadDynamicData(worker, user);
      }
    }
  };

  // Legacy alias for components that call loadData()
  const loadData = async () => {
    await loadDynamicData(cachedWorker.current, cachedUser.current);
  };


  const handleDragEnd = (result, listType) => {
    if (!result.destination) return;

    const items = Array.from(selectedShifts.filter((s) => s.type === listType));
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedItems = items.map((item, index) => ({
      ...item,
      priority: index + 1
    }));

    const otherShifts = selectedShifts.filter((s) => s.type !== listType);
    setSelectedShifts([...otherShifts, ...updatedItems]);
  };

  const handleSubmit = async () => {
    if (!currentWorker) return;

    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const availabilityData = {
      worker_id: currentWorker.id,
      worker_name: currentWorker.nickname,
      week_start_date: weekStartStr,
      shifts: selectedShifts,
      status: "submitted",
      desired_shifts: desiredShiftsCount ? parseInt(desiredShiftsCount) : null,
      extra_tasks: extraTaskStates,
    };

    let updatedAvailability;
    if (existingAvailability) {
      updatedAvailability = await base44.entities.Availability.update(existingAvailability.id, availabilityData);
      setExistingAvailability(updatedAvailability);
    } else {
      updatedAvailability = await base44.entities.Availability.create(availabilityData);
      setExistingAvailability(updatedAvailability);
    }

    setOriginalShifts(JSON.parse(JSON.stringify(selectedShifts)));
    setShowSummary(false);
    setShowEditMode(false);

    // Broadcast to other tabs/workers
    const syncPayload = JSON.stringify({ ts: Date.now() });
    try { broadcastRef.current?.postMessage("update"); } catch {}
    try { localStorage.setItem("availability-sync-event", syncPayload); } catch {}
    window.dispatchEvent(new CustomEvent("availabilityUpdated"));
  };

  const handleSubmitChangeRequest = async () => {
    if (!existingAvailability) return;

    const updatedAvailability = await base44.entities.Availability.update(existingAvailability.id, {
      shifts: selectedShifts,
      status: "pending_change",
      change_request: changeNote || "Shift changes requested"
    });

    setExistingAvailability(updatedAvailability);
    setOriginalShifts(JSON.parse(JSON.stringify(selectedShifts)));
    setShowChangeRecap(false);
    setShowEditMode(false);
    setChangeNote("");

    try { broadcastRef.current?.postMessage("update"); } catch {}
    try { localStorage.setItem("availability-sync-event", JSON.stringify({ ts: Date.now() })); } catch {}
    window.dispatchEvent(new CustomEvent("availabilityUpdated"));
  };

  const getChanges = () => {
    const added = selectedShifts.filter((s) =>
    !originalShifts.find((o) =>
    o.date === s.date && o.start_time === s.start_time && o.end_time === s.end_time && o.type === s.type
    )
    );
    const removed = originalShifts.filter((o) =>
    !selectedShifts.find((s) =>
    s.date === o.date && s.start_time === o.start_time && s.end_time === o.end_time && s.type === o.type
    )
    );
    return { added, removed };
  };

  const handleAddUnavailability = async () => {
    if (!currentWorker) return;

    const startDate = new Date(unavailabilityForm.start_date);
    const endDate = unavailabilityForm.multiDay ? new Date(unavailabilityForm.end_date) : startDate;

    // Create unavailabilities for each day in range
    const datesToAdd = [];
    let currentD = new Date(startDate);
    while (currentD <= endDate) {
      datesToAdd.push(format(currentD, "yyyy-MM-dd"));
      currentD = addDays(currentD, 1);
    }

    const newUnavailabilities = [];
    for (const dateStr of datesToAdd) {
      const created = await base44.entities.Unavailability.create({
        worker_id: currentWorker.id,
        worker_name: currentWorker.nickname,
        date: dateStr,
        start_time: unavailabilityForm.start_time,
        end_time: unavailabilityForm.end_time,
        reason: unavailabilityForm.reason
      });
      newUnavailabilities.push(created);
    }

    // Update state with new unavailabilities
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");
    const weekUnavailabilities = newUnavailabilities.filter((u) => {
      const uDate = new Date(u.date);
      return uDate >= new Date(weekStartStr) && uDate <= new Date(weekEndStr);
    });
    setUnavailabilities([...unavailabilities, ...weekUnavailabilities]);

    // Also mark affected shifts as unavailable in selectedShifts
    if (unavailabilityForm.multiDay) {
      const newShifts = [...selectedShifts];
      for (const dateStr of datesToAdd) {
        SHIFT_BLOCKS.forEach((block) => {
          const overlaps = unavailabilityForm.start_time <= block.end && unavailabilityForm.end_time >= block.start;
          if (overlaps) {
            const existingIdx = newShifts.findIndex((s) => s.date === dateStr && s.start_time === block.start && s.end_time === block.end);
            if (existingIdx >= 0) {
              newShifts[existingIdx] = { ...newShifts[existingIdx], type: "unavailable", priority: 0 };
            } else {
              newShifts.push({ date: dateStr, start_time: block.start, end_time: block.end, type: "unavailable", priority: 0 });
            }
          }
        });
      }
      setSelectedShifts(newShifts);
    }

    setShowUnavailabilityDialog(false);
    setUnavailabilityForm({
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: format(new Date(), "yyyy-MM-dd"),
      start_time: "09:00",
      end_time: "17:00",
      reason: "occupied",
      multiDay: false
    });
  };

  const handleDeleteUnavailability = async (id) => {
    await base44.entities.Unavailability.delete(id);
    setUnavailabilities(unavailabilities.filter((u) => u.id !== id));
  };

  const generateICSFile = () => {
    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Mission Manager//Events//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

    companyEvents.forEach((event) => {
      const dateStr = event.date.replace(/-/g, '');
      icsContent += `BEGIN:VEVENT
DTSTART;VALUE=DATE:${dateStr}
DTEND;VALUE=DATE:${dateStr}
SUMMARY:${event.title}
DESCRIPTION:${event.description || ''}
END:VEVENT
`;
    });

    // Add yearly events assigned to current worker
    if (currentWorker) {
      yearlyEvents.filter((e) => e.worker_ids?.includes(currentWorker.id)).forEach((event) => {
        const startDateStr = event.start_date.replace(/-/g, '');
        const endDateStr = event.end_date.replace(/-/g, '');

        if (event.start_time && event.end_time) {
          const startTimeStr = event.start_time.replace(/:/g, '');
          const endTimeStr = event.end_time.replace(/:/g, '');
          icsContent += `BEGIN:VEVENT
DTSTART:${startDateStr}T${startTimeStr}00
DTEND:${endDateStr}T${endTimeStr}00
SUMMARY:${event.title || 'Event'}
DESCRIPTION:${event.worker_name || ''}
END:VEVENT
`;
        } else {
          icsContent += `BEGIN:VEVENT
DTSTART;VALUE=DATE:${startDateStr}
DTEND;VALUE=DATE:${endDateStr}
SUMMARY:${event.title || 'Event'}
DESCRIPTION:${event.worker_name || ''}
END:VEVENT
`;
        }
      });

      // Add assigned shifts from assignments and template rows
      [...assignments, ...templateRows.filter((row) => {
        if (!row.values) return false;
        return Object.values(row.values).some((val) => val === currentWorker.id);
      })].forEach((shift) => {
        const dateStr = shift.date.replace(/-/g, '');
        let startTime, endTime, briefingTime, title;

        if (shift.isTemplateShift || shift.template_id) {
          // Template shift
          startTime = shift.values?.["התחלה"] || shift.values?.["שעת התחלה"];
          endTime = shift.values?.["סיום"] || shift.values?.["שעת סיום"];
          briefingTime = shift.values?.["תדריך"];
          const template = allTemplates.find((t) => t.id === shift.template_id);
          title = template?.name || shift.template_name || 'משמרת';
        } else {
          // Regular assignment
          startTime = shift.start_time;
          endTime = shift.end_time;
          title = shift.food_cart_name;
        }

        if (!startTime || !endTime) return;

        // Use briefing time if available, otherwise use shift start time
        const eventStartTime = briefingTime || startTime;
        const startTimeStr = eventStartTime.replace(/:/g, '');
        const endTimeStr = endTime.replace(/:/g, '');

        icsContent += `BEGIN:VEVENT
DTSTART:${dateStr}T${startTimeStr}00
DTEND:${dateStr}T${endTimeStr}00
SUMMARY:${title}
DESCRIPTION:${briefingTime ? `תדריך: ${briefingTime}\\nמשמרת: ${startTime} - ${endTime}` : `משמרת: ${startTime} - ${endTime}`}
END:VEVENT
`;
      });
    }

    icsContent += `END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-schedule.ics';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isApproved = existingAvailability?.status === "approved";
  const isPendingChange = existingAvailability?.status === "pending_change";
  const canEdit = !isApproved || showEditMode;

  const getShiftStyle = (type) => {
    if (type === "wanted") return "bg-green-500 border-green-600 text-white";
    if (type === "available") return "bg-cyan-500 border-cyan-600 text-white";
    if (type === "unavailable") return "bg-red-500 border-red-600 text-white";
    return "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50";
  };

  const getShiftIcon = (type) => {
    if (type === "wanted") return <Star className="w-3 h-3" />;
    if (type === "available") return <Check className="w-3 h-3" />;
    if (type === "unavailable") return <Ban className="w-3 h-3" />;
    return null;
  };

  const calendarDays = eachDayOfInterval({
    start: startOfMonth(calendarMonth),
    end: endOfMonth(calendarMonth)
  });

  const getEventForDate = (date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return companyEvents.find((e) => e.date === dateStr);
  };

  const getYearlyEventsForDate = (date) => {
    if (!currentWorker) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    return yearlyEvents.filter((e) =>
    e.worker_ids?.includes(currentWorker.id) &&
    dateStr >= e.start_date && dateStr <= e.end_date
    );
  };

  const getYearlyEventsForShift = (date, shiftStart, shiftEnd) => {
    if (!currentWorker) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    return yearlyEvents.filter((e) => {
      if (e.start_date > dateStr || e.end_date < dateStr) return false;
      if (!e.worker_ids?.includes(currentWorker.id)) return false;
      if (!e.start_time || !e.end_time) return false;

      const eventStart = e.start_time;
      const eventEnd = e.end_time;

      // Check if event overlaps with shift
      return eventStart >= shiftStart && eventStart < shiftEnd ||
      eventEnd > shiftStart && eventEnd <= shiftEnd ||
      eventStart <= shiftStart && eventEnd >= shiftEnd;
    });
  };

  // Convert time to minutes offset from 06:00 (handles midnight crossing)
  const timeToMinsFrom6 = (time) => {
    const [h, m] = time.split(':').map(Number);
    let mins = h * 60 + m;
    if (mins < 360) mins += 1440; // 00:00-05:59 → next day
    return mins - 360;
  };

  const getEventBarPositionFull = (eventStart, eventEnd) => {
    const totalMins = 1440;
    const startMins = Math.max(timeToMinsFrom6(eventStart), 0);
    const endMins = Math.min(timeToMinsFrom6(eventEnd), totalMins);
    if (endMins <= startMins) return null;
    return {
      right: `${startMins / totalMins * 100}%`,
      width: `${(endMins - startMins) / totalMins * 100}%`
    };
  };

  const getAssignmentForDate = (date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const regularAssignments = assignments.filter((a) => a.date === dateStr);

    // Get template shifts for this worker on this date
    if (!currentWorker) return regularAssignments;

    // Use allTemplateRowsForCalendar so shifts from all months are visible in the calendar
    const rowsToSearch = allTemplateRowsForCalendar.length > 0 ? allTemplateRowsForCalendar : templateRows;
    const templateShifts = rowsToSearch.filter((row) => {
      if (row.date !== dateStr || !row.values) return false;

      // Check if worker is assigned in this row
      const isAssigned = Object.values(row.values).some((val) => val === currentWorker.id);
      if (!isAssigned) return false;

      const startTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"];
      const endTime = row.values?.["סיום"] || row.values?.["שעת סיום"];
      return startTime && endTime;
    }).map((row) => {
      const template = allTemplates.find((t) => t.id === row.template_id);
      const briefingTime = row.values?.["תדריך"];
      return {
        id: `template_${row.id}`,
        date: row.date,
        start_time: row.values?.["התחלה"] || row.values?.["שעת התחלה"],
        end_time: row.values?.["סיום"] || row.values?.["שעת סיום"],
        briefing_time: briefingTime,
        food_cart_name: template?.name || row.template_name || 'משמרת',
        hours: null,
        isTemplateShift: true
      };
    });

    return [...regularAssignments, ...templateShifts];
  };

  const handleDateClick = (day) => {
    setSelectedDate(day);
    setShowDateDetails(true);
  };

  const wantedShifts = selectedShifts.filter((s) => s.type === "wanted").sort((a, b) => (a.priority || 0) - (b.priority || 0));
  const availableShifts = selectedShifts.filter((s) => s.type === "available").sort((a, b) => (a.priority || 0) - (b.priority || 0));

  // Handle signup from the demand panel: write-through save + optimistic weekAvailabilities update
  const handleDemandSignup = async (unifiedShift, roleName, type) => {
    if (!canEdit || currentWorker?.availability_locked) return;
    const operationalDate = unifiedShift.operational_date || unifiedShift.date;
    const { startTime, endTime, signupKey, sharedMokedKey, mokedName } = unifiedShift;



    // Remove the entry for this exact signupKey, plus any naked (no moked identity) entries
    // at the same date+time — naked entries are legacy and must be replaced by keyed entries.
    let newShifts = selectedShifts.filter(s => {
      // Remove exact signupKey match
      if (s.signupKey) return s.signupKey !== signupKey;
      // Remove legacy sharedMokedKey match
      if (s.sharedMokedKey) {
        const legacyKey = buildSignupKey(s.operational_date || s.date, s.sharedMokedKey, s.start_time, s.end_time);
        return legacyKey !== signupKey;
      }
      // Remove naked entries (no moked identity) at the same date+time slot
      // — they will be replaced by the new keyed entry
      const sDate = s.operational_date || s.date;
      if (sDate === operationalDate && s.start_time === startTime && s.end_time === endTime) return false;
      return true;
    });

    if (type !== "remove") {
      if (!signupKey) {
        console.error("SIGNUP SAVE ERROR: unifiedShift.signupKey is missing — this is a bug", { unifiedShift, roleName, type });
        return; // Do not silently create a weak key
      }
      const count = newShifts.filter(s => s.type === type).length;
      const newEntry = {
        date: operationalDate,
        operational_date: operationalDate,
        start_time: startTime,
        end_time: endTime,
        type,
        priority: type === "unavailable" ? 0 : count + 1,
        moked_name: mokedName,
        sharedMokedKey,
        signupKey,
        role_or_qualification: roleName,
        possibleInstances: serializePossibleInstances(unifiedShift.possibleInstances),
      };
      newShifts.push(newEntry);
    }

    // Helper: clean naked legacy entries that are superseded by keyed entries
    const cleanShifts = (shifts) => {
      const slotsWithKey = new Set();
      shifts.forEach(s => {
        if (s.signupKey || s.sharedMokedKey) {
          const d = s.operational_date || s.date;
          slotsWithKey.add(`${d}__${s.start_time}__${s.end_time}`);
        }
      });
      return shifts.filter(s => {
        if (s.signupKey || s.sharedMokedKey) return true;
        const slotKey = `${s.operational_date || s.date}__${s.start_time}__${s.end_time}`;
        return !slotsWithKey.has(slotKey);
      });
    };

    const cleanedShifts = cleanShifts(newShifts);

    // Build availability record
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const availabilityData = {
      worker_id: currentWorker.id,
      worker_name: currentWorker.nickname,
      week_start_date: weekStartStr,
      shifts: cleanedShifts,
      status: (existingAvailability?.status && existingAvailability.status !== "draft") ? existingAvailability.status : "submitted",
      desired_shifts: desiredShiftsCount ? parseInt(desiredShiftsCount) : null,
      extra_tasks: extraTaskStates,
    };

    // In limit_sign_up mode: route ALL signup/removal through the server function
    // to ensure atomic lock acquire/release — prevents two workers claiming the same slot.
    const isLimitedMode = signupMode === "limit_sign_up";
    const isRemoveAction = type === "remove";

    let savedRecord;
    if (isLimitedMode && (type === "wanted" || isRemoveAction)) {
      // Persist atomically on server FIRST, then update UI
      const result = await signupForShift({
        signupKey,
        weekStartDate: weekStartStr,
        workerId: currentWorker.id,
        workerName: currentWorker.nickname,
        availabilityData,
        requiredCount: unifiedShift.requiredCount || 1,
        isRemove: isRemoveAction,
      });
      if (!result.data?.success) {
        // Slot was taken — refresh counts from server and do NOT apply local change
        const freshAvails = await base44.entities.Availability.filter({ week_start_date: weekStartStr });
        setWeekAvailabilities(freshAvails);
        return;
      }
      savedRecord = result.data.record;
      // Only update UI after confirmed success
      setSelectedShifts(cleanedShifts);
      setWeekAvailabilities(prev => {
        const withoutMine = prev.filter(a => a.worker_id !== currentWorker.id);
        return [...withoutMine, savedRecord];
      });
    } else {
      // For non-limit mode or non-wanted types: optimistic update first, then persist
      // 1. Optimistic local update
      setSelectedShifts(cleanedShifts);

      // 2. Optimistic weekAvailabilities update so ShiftDemandPanel sees new count immediately
      const optimisticRecord = { ...(existingAvailability || {}), ...availabilityData, shifts: cleanedShifts };
      setWeekAvailabilities(prev => {
        const withoutMine = prev.filter(a => a.worker_id !== currentWorker.id);
        return [...withoutMine, optimisticRecord];
      });

      // 3. Persist to DB
      if (existingAvailability) {
        savedRecord = await base44.entities.Availability.update(existingAvailability.id, availabilityData);
      } else {
        savedRecord = await base44.entities.Availability.create(availabilityData);
      }

      // 4. Replace optimistic record with real DB record
      setWeekAvailabilities(prev => {
        const withoutMine = prev.filter(a => a.worker_id !== currentWorker.id);
        return [...withoutMine, savedRecord];
      });
    }

    setExistingAvailability(savedRecord);

    // Broadcast to other tabs
    try { broadcastRef.current?.postMessage("update"); } catch {}
    try { localStorage.setItem("availability-sync-event", JSON.stringify({ ts: Date.now() })); } catch {}
    window.dispatchEvent(new CustomEvent("availabilityUpdated", {
      detail: {
        workerId: currentWorker.id,
        signupKey,
        type,
        operational_date: operationalDate,
        start_time: startTime,
        end_time: endTime,
        timestamp: Date.now(),
      }
    }));
  };

  const cycleExtraTask = (taskName) => {
    if (existingAvailability?.status === "approved" && !showEditMode) return;
    if (currentWorker?.availability_locked) return;
    const current = extraTaskStates[taskName] || null;
    let next;
    if (current === null || current === undefined) next = "wanted";
    else if (current === "wanted") next = "available";
    else if (current === "available") next = "unavailable";
    else next = null;
    const updated = { ...extraTaskStates };
    if (next === null) delete updated[taskName];
    else updated[taskName] = next;
    setExtraTaskStates(updated);
  };

  // Stale registration name denylist — permanently ignored regardless of any other check
  const STALE_REG_DENYLIST = STALE_REG_DENYLIST_STATIC;

  // Build the set of valid group keys from active TemplateRows in the selected week.
  // templateRows is already week-scoped (loaded via 7 per-date queries in loadDynamicData).
  // Key format matches Schedule.jsx: `${template_id}_${group_id || 'default'}`
  const activeGroupKeys = useMemo(() => {
    const keys = new Set();
    templateRows.forEach(row => {
      if (!row.template_id) return;
      keys.add(`${row.template_id}_${row.group_id || 'default'}`);
    });
    return keys;
  }, [templateRows]);



  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-2 md:p-4">
      <div className="max-w-2xl mx-auto space-y-0" dir="rtl">

        {/* ── 1. Top header: page title + greeting ── */}
        <div className="px-1 py-3 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">
            {currentWorker ? `שלום, ${currentWorker.nickname}! 👋` : "שלום!"}
          </h1>
        </div>

        {!currentWorker ? (
          <Card className="border-none shadow-lg mt-4">
            <CardContent className="py-16 text-center">
              <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">לא נמצא פרופיל עובד</h3>
              <p className="text-gray-600">האימייל שלך לא משויך לחשבון עובד.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── 2. יומן section ── */}
            <div className="pt-4 pb-1 px-1">
              <h2 className="text-base font-bold text-gray-700">יומן</h2>
            </div>

            {/* Calendar card */}
            <Card className="border-none shadow-sm">
              <CardHeader className="border-b bg-white py-2 px-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                    <span className="text-sm font-semibold px-1">{formatDateHebrew(calendarMonth, "monthYear")}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                      <ChevronLeft className="w-3 h-3" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={generateICSFile} title="סנכרן ללוח השנה">
                    <Download className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="py-2 px-2">
                <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
                  {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((d, i) => (
                    <div key={i} className="font-semibold text-gray-400 py-1 text-[10px]">{d}</div>
                  ))}
                  {calendarDays.map((day, idx) => {
                    const dayAssignments = getAssignmentForDate(day);
                    const event = getEventForDate(day);
                    const workerYearlyEvents = getYearlyEventsForDate(day);
                    const isCurrentMonth = isSameMonth(day, calendarMonth);
                    const isToday = isSameDay(day, new Date());
                    return (
                      <button key={idx} onClick={() => handleDateClick(day)}
                        className={`p-0.5 min-h-[40px] border rounded text-[10px] hover:bg-blue-50 transition-colors ${isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-300"} ${isToday ? "ring-2 ring-blue-500" : ""}`}>
                        <div className={`font-medium ${isToday ? "text-blue-600" : ""}`}>{format(day, "d")}</div>
                        {event && <div className="text-purple-500 text-[8px] leading-tight">🎉</div>}
                        {workerYearlyEvents.slice(0, 1).map((e, i) => (
                          <div key={i} className="bg-green-100 text-green-700 rounded text-[8px] leading-tight truncate mt-0.5" title={e.title}>●</div>
                        ))}
                        {dayAssignments.slice(0, 1).map((a, i) => {
                          const displayTime = a.briefing_time || a.start_time;
                          return (
                            <div key={i} className="bg-blue-100 text-blue-700 rounded text-[8px] leading-tight mt-0.5">
                              {displayTime.slice(0, 5)}
                            </div>
                          );
                        })}
                        {dayAssignments.length + workerYearlyEvents.length > 1 && (
                          <div className="text-gray-400 text-[8px]">+{dayAssignments.length + workerYearlyEvents.length - 1}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* ── 3. הרשמה section ── */}
            <div className="pt-5 pb-1 px-1 flex items-center gap-2 border-t border-gray-200 mt-4">
              <h2 className="text-base font-bold text-gray-700">הרשמה</h2>
              {existingAvailability && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  existingAvailability.status === "approved" ? "bg-green-100 text-green-700" :
                  existingAvailability.status === "submitted" ? "bg-blue-100 text-blue-700" :
                  existingAvailability.status === "pending_change" ? "bg-orange-100 text-orange-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {existingAvailability.status === "approved" ? "✓ אושר" :
                   existingAvailability.status === "submitted" ? "נשלח" :
                   existingAvailability.status === "pending_change" ? "ממתין לשינוי" : "טיוטה"}
                </span>
              )}
            </div>

            {/* 3.1 Week navigation */}
            <div className="flex items-center justify-between bg-white border rounded-xl px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(addDays(weekStart, -7), { weekStartsOn: 0 }))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(addDays(weekStart, 7), { weekStartsOn: 0 }))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm font-medium text-gray-700">
                {formatDateHebrew(weekStart)} – {formatDateHebrew(addDays(weekStart, 6))}
              </p>
            </div>

            {/* 3.2 Desired shifts + add constraint + lock/open status */}
            <div className="bg-white border rounded-xl px-3 py-1.5 shadow-sm space-y-1.5">
              {/* Compact single-line control row */}
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-500 whitespace-nowrap shrink-0">רצויות:</Label>
                <Input type="number" className="w-12 h-6 text-xs px-1.5 py-0" value={desiredShiftsCount} onChange={(e) => setDesiredShiftsCount(e.target.value)} placeholder="#" />
                <Button variant="outline" size="sm" className="h-6 text-xs px-2 py-0" onClick={() => setShowUnavailabilityDialog(true)}>
                  <Plus className="w-3 h-3 ml-0.5" />הוסף אילוץ
                </Button>
                <div className="mr-auto">
                  {currentWorker?.availability_locked ? (
                    <span className="flex items-center gap-1 text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
                      <Lock className="w-3 h-3" />נעול
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" />פתוח
                    </span>
                  )}
                </div>
              </div>
              {/* Constraints list — only shown when there are constraints */}
              {unavailabilities.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5 border-t border-gray-100">
                  {unavailabilities.map((unavail) => (
                    <div key={unavail.id} className="flex items-center gap-1 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 text-xs">
                      <span className="font-medium text-gray-700">{formatDateHebrew(unavail.date, "short")}</span>
                      <span className="text-gray-400">{unavail.start_time}–{unavail.end_time}</span>
                      <button onClick={() => handleDeleteUnavailability(unavail.id)} className="text-red-400 hover:text-red-600">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3.3 Registration policy / tips */}
            {(tipsMessage || isManager) && (
              <Card className="border-none shadow-sm">
                <CardContent className="py-2 px-4">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      {editingTips ? (
                        <div className="space-y-2">
                          <Textarea value={tipsEditValue} onChange={e => setTipsEditValue(e.target.value)} rows={4} dir="rtl" className="text-sm" placeholder="הכנס הודעה לעובדים..." />
                          <div className="flex items-center gap-2 justify-end" dir="rtl">
                            <Label className="text-xs text-gray-600">פופ-אפ שדורש אישור</Label>
                            <Switch checked={showTipsAsPopup} onCheckedChange={setShowTipsAsPopup} />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" onClick={() => setEditingTips(false)} dir="rtl">ביטול</Button>
                            <Button size="sm" className="bg-blue-900 hover:bg-blue-800" dir="rtl" onClick={async () => {
                              const weekStartStr3 = format(startOfWeek(weekStart, { weekStartsOn: 0 }), "yyyy-MM-dd");
                              const key = `availability_tips_${weekStartStr3}`;
                              const existing = await base44.entities.AppSettings.filter({ setting_key: key });
                              const data = { setting_key: key, setting_value: JSON.stringify({ message: tipsEditValue, showAsPopup: showTipsAsPopup }) };
                              if (existing.length > 0) await base44.entities.AppSettings.update(existing[0].id, data);
                              else await base44.entities.AppSettings.create(data);
                              setTipsMessage(tipsEditValue);
                              setEditingTips(false);
                            }}>שמור</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-gray-600" dir="rtl">{tipsMessage || <span className="text-gray-400">לא הוגדרה הודעה</span>}</p>
                          {isManager && (
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0" onClick={() => { setTipsEditValue(tipsMessage); setEditingTips(true); }} dir="rtl">
                              <Pencil className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 3.4 Shift demand panel — only show rows for mokeds with open registration */}
            <ShiftDemandPanel
              templateRows={openRegistrations.length === 0
                ? []
                : templateRows.filter(row => {
                    const key = `${row.template_id}_${row.group_id || 'default'}`;
                    return openRegistrations.some(r => r && r.key === key);
                  })}
              allTemplates={allTemplates}
              allAvailabilities={weekAvailabilities}
              workers={workers}
              currentWorker={currentWorker}
              selectedShifts={selectedShifts}
              signupMode={signupMode}
              weekStart={weekStart}
              onSignup={handleDemandSignup}
              canEdit={canEdit && !currentWorker?.availability_locked}
              isLocked={!!currentWorker?.availability_locked}
              onAddConstraint={() => setShowUnavailabilityDialog(true)}
              workerRolesSettings={workerRolesSettings}
            />


            {/* 3.5 Submit form */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white border rounded-xl px-3 py-2 shadow-sm">
              <p className="text-xs text-gray-500">
                {selectedShifts.filter(s => s.type === "wanted").length} רצויות,{" "}
                {selectedShifts.filter(s => s.type === "available").length} זמינות
              </p>
              <div className="flex gap-2">
                {isApproved && !showEditMode && (
                  <Button variant="outline" size="sm" onClick={() => setShowEditMode(true)} className="h-7 text-xs">
                    <Pencil className="w-3 h-3 mr-1" />ערוך
                  </Button>
                )}
                {showEditMode && (
                  <>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setShowEditMode(false); setSelectedShifts(originalShifts); }}>ביטול</Button>
                    <Button size="sm" className="h-7 text-xs bg-blue-900 hover:bg-blue-800" onClick={() => setShowChangeRecap(true)}>סקור שינויים</Button>
                  </>
                )}
                {!isApproved && !isPendingChange && (
                  <>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSelectedShifts([])} disabled={currentWorker?.availability_locked}>נקה</Button>
                    <Button size="sm" className="h-7 text-xs bg-blue-900 hover:bg-blue-800"
                      onClick={() => setShowSummary(true)}
                      disabled={selectedShifts.filter(s => s.type !== "unavailable").length === 0 || currentWorker?.availability_locked}>
                      סקור ושלח
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* bottom padding */}
            <div className="h-6" />

          {/* ── Dialogs ── */}
        <Dialog open={showUnavailabilityDialog} onOpenChange={setShowUnavailabilityDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle className="text-right" dir="rtl">הוסף אילוץ</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2" dir="rtl">
                <Label htmlFor="multiDay">מספר ימים</Label>
                <input type="checkbox" id="multiDay" checked={unavailabilityForm.multiDay} onChange={(e) => setUnavailabilityForm({ ...unavailabilityForm, multiDay: e.target.checked })} />
              </div>
              <div className={unavailabilityForm.multiDay ? "grid grid-cols-2 gap-2" : ""}>
                <div><Label className="text-center block mb-2" dir="rtl">{unavailabilityForm.multiDay ? "תאריך התחלה" : "תאריך"}</Label><Input type="date" value={unavailabilityForm.start_date} onChange={(e) => setUnavailabilityForm({ ...unavailabilityForm, start_date: e.target.value })} /></div>
                {unavailabilityForm.multiDay && <div><Label className="text-center block mb-2" dir="rtl">תאריך סיום</Label><Input type="date" value={unavailabilityForm.end_date} onChange={(e) => setUnavailabilityForm({ ...unavailabilityForm, end_date: e.target.value })} /></div>}
              </div>
              <div className="grid grid-cols-2 gap-2" dir="rtl">
                <div><Label className="text-center block mb-2">שעת התחלה</Label><Input type="time" value={unavailabilityForm.start_time} onChange={(e) => setUnavailabilityForm({ ...unavailabilityForm, start_time: e.target.value })} className="text-sm" /></div>
                <div><Label className="text-center block mb-2">שעת סיום</Label><Input type="time" value={unavailabilityForm.end_time} onChange={(e) => setUnavailabilityForm({ ...unavailabilityForm, end_time: e.target.value })} className="text-sm" /></div>
              </div>
              <div>
                <Label className="text-center block mb-2" dir="rtl">סיבה</Label>
                <Select value={unavailabilityForm.reason} onValueChange={(value) => setUnavailabilityForm({ ...unavailabilityForm, reason: value })}>
                  <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="occupied">תפוס</SelectItem>
                    <SelectItem value="overseas">בחו"ל</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUnavailabilityDialog(false)} dir="rtl">ביטול</Button>
              <Button onClick={handleAddUnavailability} className="bg-red-600 hover:bg-red-700" dir="rtl">הוסף</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showTipsPopup} onOpenChange={setShowTipsPopup}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Info className="w-5 h-5 text-blue-600" />נהלי הרשמה ועדכונים</DialogTitle></DialogHeader>
            <div className="py-4"><div className="bg-blue-50 border border-blue-200 rounded-lg p-4 whitespace-pre-wrap">{tipsMessage}</div></div>
            <DialogFooter><Button onClick={async () => {
              // Save acknowledgment to database per user
              const acknowledgedSettings = await base44.entities.AppSettings.filter({ 
                setting_key: `tips_acknowledged_${currentUser.email}` 
              });
              
              if (acknowledgedSettings.length > 0) {
                await base44.entities.AppSettings.update(acknowledgedSettings[0].id, {
                  setting_value: tipsMessage
                });
              } else {
                await base44.entities.AppSettings.create({
                  setting_key: `tips_acknowledged_${currentUser.email}`,
                  setting_value: tipsMessage
                });
              }
              
              setShowTipsPopup(false);
            }} className="bg-blue-900 hover:bg-blue-800" dir="rtl">הבנתי</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showSummary} onOpenChange={setShowSummary}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-sm" dir="rtl">סקור וסדר מחדש עדיפות</DialogTitle></DialogHeader>
            <div className="py-2">
              <div className="grid grid-cols-2 gap-2">
                {/* Wanted Shifts */}
                <div className="border rounded p-2">
                  <div className="mb-2">
                    <h3 className="font-semibold text-green-700 text-xs mb-0.5" dir="rtl">רצוי ({wantedShifts.length})</h3>
                    <p className="text-[10px] text-gray-600" dir="rtl">גרור לשינוי</p>
                  </div>
                  <DragDropContext onDragEnd={(r) => handleDragEnd(r, "wanted")}>
                    <Droppable droppableId="wanted-shifts">
                      {(provided) =>
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1 max-h-64 overflow-y-auto">
                          {wantedShifts.map((shift, index) =>
                        <Draggable key={shift.signupKey || `${shift.date}-${shift.start_time}-${index}`} draggableId={shift.signupKey || `wanted-${shift.date}-${shift.start_time}-${index}`} index={index}>
                              {(provided, snapshot) =>
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                          className={`flex items-center gap-1 p-1.5 rounded border ${snapshot.isDragging ? 'bg-green-50 border-green-300 shadow-lg' : 'bg-white border-gray-200'}`}>
                                  <GripVertical className="w-3 h-3 text-gray-400" />
                                  <div className="flex items-center justify-center w-5 h-5 bg-green-500 text-white rounded-full font-bold text-[10px]">{index + 1}</div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 text-[11px] truncate" dir="rtl">{formatDateHebrew(shift.date, "short")}</p>
                                    <p className="text-[9px] text-gray-600">{shift.start_time}-{shift.end_time}</p>
                                    {shift.moked_name && <p className="text-[9px] text-blue-600 font-medium truncate" dir="rtl">{shift.moked_name}</p>}
                                  </div>
                                </div>
                          }
                            </Draggable>
                        )}
                          {provided.placeholder}
                        </div>
                      }
                    </Droppable>
                  </DragDropContext>
                </div>

                {/* Available Shifts */}
                <div className="border rounded p-2">
                  <div className="mb-2">
                    <h3 className="font-semibold text-blue-700 text-xs mb-0.5" dir="rtl">זמין ({availableShifts.length})</h3>
                    <p className="text-[10px] text-gray-600" dir="rtl">גרור לשינוי</p>
                  </div>
                  <DragDropContext onDragEnd={(r) => handleDragEnd(r, "available")}>
                    <Droppable droppableId="available-shifts">
                      {(provided) =>
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1 max-h-64 overflow-y-auto">
                          {availableShifts.map((shift, index) =>
                        <Draggable key={shift.signupKey || `${shift.date}-${shift.start_time}-${index}`} draggableId={shift.signupKey || `available-${shift.date}-${shift.start_time}-${index}`} index={index}>
                              {(provided, snapshot) =>
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                          className={`flex items-center gap-1 p-1.5 rounded border ${snapshot.isDragging ? 'bg-blue-50 border-blue-300 shadow-lg' : 'bg-white border-gray-200'}`}>
                                  <GripVertical className="w-3 h-3 text-gray-400" />
                                  <div className="flex items-center justify-center w-5 h-5 bg-blue-500 text-white rounded-full font-bold text-[10px]">{index + 1}</div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 text-[11px] truncate" dir="rtl">{formatDateHebrew(shift.date, "short")}</p>
                                    <p className="text-[9px] text-gray-600">{shift.start_time}-{shift.end_time}</p>
                                    {shift.moked_name && <p className="text-[9px] text-blue-600 font-medium truncate" dir="rtl">{shift.moked_name}</p>}
                                  </div>
                                </div>
                          }
                            </Draggable>
                        )}
                          {provided.placeholder}
                        </div>
                      }
                    </Droppable>
                  </DragDropContext>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSummary(false)} dir="rtl"><X className="w-4 h-4 mr-2" />חזור</Button>
              <Button onClick={handleSubmit} className="bg-blue-900 hover:bg-blue-800" dir="rtl"><Check className="w-4 h-4 mr-2" />שלח</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showChangeRecap} onOpenChange={setShowChangeRecap}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle dir="rtl">סיכום בקשת שינוי</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              {(() => {
                const { added, removed } = getChanges();
                return (
                  <>
                    {added.length > 0 &&
                    <div>
                        <p className="font-semibold text-green-700 mb-2" dir="rtl">נוסף:</p>
                        {added.map((s, i) =>
                      <div key={i} className="p-2 bg-green-50 rounded mb-1 text-sm" dir="rtl">
                            {formatDateHebrew(s.date, "short")} {s.start_time}-{s.end_time} ({s.type === 'wanted' ? 'רצוי' : s.type === 'available' ? 'זמין' : 'לא זמין'})
                          </div>
                      )}
                      </div>
                    }
                    {removed.length > 0 &&
                    <div>
                        <p className="font-semibold text-red-700 mb-2" dir="rtl">הוסר:</p>
                        {removed.map((s, i) =>
                      <div key={i} className="p-2 bg-red-50 rounded mb-1 text-sm" dir="rtl">
                            {formatDateHebrew(s.date, "short")} {s.start_time}-{s.end_time} ({s.type === 'wanted' ? 'רצוי' : s.type === 'available' ? 'זמין' : 'לא זמין'})
                          </div>
                      )}
                      </div>
                    }
                    {added.length === 0 && removed.length === 0 &&
                    <p className="text-gray-500" dir="rtl">לא זוהו שינויים</p>
                    }
                  </>);

              })()}
              <div>
                <Label dir="rtl">הערה למנהל (אופציונלי)</Label>
                <Textarea value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="הסבר את הסיבה לשינויים..." rows={3} dir="rtl" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowChangeRecap(false)} dir="rtl">ביטול</Button>
              <Button onClick={handleSubmitChangeRequest} className="bg-blue-900 hover:bg-blue-800" dir="rtl">שלח בקשת שינוי</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        <Dialog open={showDateDetails} onOpenChange={setShowDateDetails}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle dir="rtl">{selectedDate && formatDateHebrew(selectedDate, "long")}</DialogTitle>
            </DialogHeader>
            {selectedDate &&
            <div className="space-y-4 py-4">
                {getEventForDate(selectedDate) &&
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="font-semibold text-purple-800 flex items-center gap-2" dir="rtl">
                      <PartyPopper className="w-4 h-4" />{getEventForDate(selectedDate).title}
                    </p>
                    {getEventForDate(selectedDate).description &&
                <p className="text-sm text-gray-600 mt-1" dir="rtl">{getEventForDate(selectedDate).description}</p>
                }
                  </div>
              }
                {getYearlyEventsForDate(selectedDate).length > 0 &&
              <div>
                    <p className="font-semibold mb-2" dir="rtl">האירועים השנתיים שלך:</p>
                    {getYearlyEventsForDate(selectedDate).map((e, i) =>
                <div key={i} className="p-3 bg-green-50 border border-green-200 rounded-lg mb-2">
                        <p className="font-medium text-green-800" dir="rtl">{e.title}</p>
                        <p className="text-sm text-gray-600">{e.start_time} - {e.end_time}</p>
                      </div>
                )}
                  </div>
              }
                <div>
                  <p className="font-semibold mb-2" dir="rtl">המשמרות שלך:</p>
                  {getAssignmentForDate(selectedDate).length === 0 ?
                <p className="text-sm text-gray-500" dir="rtl">אין משמרות מתוכננות</p> :

                getAssignmentForDate(selectedDate).map((a, i) =>
                <div key={i} className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-2">
                        <p className="font-medium" dir="rtl">{a.food_cart_name}</p>
                        {a.briefing_time && <p className="text-sm text-amber-600" dir="rtl">תדריך: {a.briefing_time}</p>}
                        <p className="text-sm text-gray-600">{a.start_time} - {a.end_time} {a.hours ? `(${a.hours}h)` : ''}</p>
                        {a.menu && <p className="text-sm text-amber-700" dir="rtl">תפריט: {a.menu}</p>}
                      </div>
                )
                }
                </div>
              </div>
            }
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDateDetails(false)} dir="rtl">סגור</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </>
        )}
      </div>
    </div>
  );
}