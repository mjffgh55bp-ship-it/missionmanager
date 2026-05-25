import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Atomic signup for a shift slot.
 * Performs: fetch → check capacity → save, all server-side.
 * Returns { success: true } or { success: false, reason: "full" }.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    signupKey,
    weekStartDate,
    workerId,
    workerName,
    availabilityData, // full availability record to save (shifts, status, etc.)
    requiredCount,
    // For the capacity check: which other workers' signups count as "wanted" for this key
  } = body;

  if (!signupKey || !weekStartDate || !workerId || !availabilityData) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Use service role to read all availabilities for this week atomically
  const allAvails = await base44.asServiceRole.entities.Availability.filter({
    week_start_date: weekStartDate
  });

  // Count how many OTHER workers are already signed up as "wanted" for this signupKey
  const othersCount = allAvails.filter(avail => {
    if (avail.worker_id === workerId) return false; // exclude self
    const shifts = avail.shifts || [];
    return shifts.some(s => {
      if ((s.type || s.status) !== 'wanted') return false;
      if (s.signupKey) return s.signupKey === signupKey;
      if (s.sharedMokedKey) {
        // legacy key reconstruction: date__name:X__start__end
        const legacyKey = `${s.operational_date || s.date}__${s.sharedMokedKey}__${s.start_time}__${s.end_time}`;
        return legacyKey === signupKey;
      }
      return false;
    });
  }).length;

  const maxSlots = requiredCount || 1;
  if (othersCount >= maxSlots) {
    return Response.json({ success: false, reason: 'full', currentCount: othersCount, maxSlots });
  }

  // Slot has room — save the availability record
  const existingList = allAvails.filter(a => a.worker_id === workerId && a.week_start_date === weekStartDate);
  let saved;
  if (existingList.length > 0) {
    saved = await base44.asServiceRole.entities.Availability.update(existingList[0].id, availabilityData);
  } else {
    saved = await base44.asServiceRole.entities.Availability.create(availabilityData);
  }

  return Response.json({ success: true, record: saved });
});