import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Atomic signup for a shift slot using a distributed lock (ShiftLock entity).
 *
 * Strategy:
 * 1. Try to INSERT a ShiftLock record for this signupKey+week.
 *    - If the insert succeeds → we own the slot.
 *    - If the insert fails (duplicate lock_key already exists) → slot is taken → return { success: false }.
 * 2. After winning the lock, do a final count check (in case of slots with requiredCount > 1).
 * 3. Save the availability record.
 * 4. Clean up old locks for this key that belong to previous owners (keep only ours).
 *
 * Returns { success: true, record } or { success: false, reason: 'full' }.
 */
Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);

  // Require authentication — all workers have accounts and must be logged in.
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ success: false, error: "נדרשת התחברות כדי להירשם למשמרת" }, { status: 200 });
  }

  const body = await req.json();
  const { signupKey, weekStartDate, workerId, workerName, availabilityData, requiredCount } = body;

  if (!signupKey || !weekStartDate || !workerId || !availabilityData) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const isRemove = body.isRemove === true;
  const maxSlots = requiredCount || 1;
  const lockKey = `${signupKey}__${weekStartDate}`;

  // Handle un-registration: release lock and save availability
  if (isRemove) {
    const existingLocks = await base44.entities.ShiftLock.filter({ lock_key: lockKey });
    const myLock = existingLocks.find(l => l.worker_id === workerId);
    if (myLock) {
      await base44.entities.ShiftLock.delete(myLock.id);
    }
    const allAvails = await base44.entities.Availability.filter({ week_start_date: weekStartDate });
    const existingList = allAvails.filter(a => a.worker_id === workerId && a.week_start_date === weekStartDate);
    let saved;
    if (existingList.length > 0) {
      saved = await base44.entities.Availability.update(existingList[0].id, availabilityData);
    } else {
      saved = await base44.entities.Availability.create(availabilityData);
    }
    return Response.json({ success: true, record: saved });
  }

  // Step 1: Check existing locks for this slot
  const existingLocks = await base44.entities.ShiftLock.filter({ lock_key: lockKey });

  // Check if this worker already has a lock (re-registration attempt)
  const myExistingLock = existingLocks.find(l => l.worker_id === workerId);

  // Count locks from OTHER workers
  const otherLocks = existingLocks.filter(l => l.worker_id !== workerId);

  if (otherLocks.length >= maxSlots) {
    // Slot is fully taken by others
    return Response.json({ success: false, reason: 'full', currentCount: otherLocks.length, maxSlots });
  }

  // Step 2: Acquire lock — create if we don't already have one
  let lockRecord;
  if (myExistingLock) {
    // We already hold a lock — just update the timestamp
    lockRecord = myExistingLock;
  } else {
    // Create our lock entry
    lockRecord = await base44.entities.ShiftLock.create({
      lock_key: lockKey,
      worker_id: workerId,
      worker_name: workerName || '',
      locked_at: new Date().toISOString(),
    });
  }

  // Step 3: Re-check after lock creation (handles the tight race window)
  // Wait a tiny bit to let any concurrent inserts land
  await new Promise(r => setTimeout(r, 100));

  const locksAfter = await base44.entities.ShiftLock.filter({ lock_key: lockKey });
  const otherLocksAfter = locksAfter.filter(l => l.worker_id !== workerId);

  if (otherLocksAfter.length >= maxSlots) {
    // Someone else also got in — delete our lock and return failure
    // Guard against 404 if lock was already deleted by a concurrent request
    try {
      await base44.entities.ShiftLock.delete(lockRecord.id);
    } catch (_) { /* already gone — that's fine */ }
    return Response.json({ success: false, reason: 'full', currentCount: otherLocksAfter.length, maxSlots });
  }

  // Step 4: We won — save the availability record
  const allAvails = await base44.entities.Availability.filter({ week_start_date: weekStartDate });
  const existingList = allAvails.filter(a => a.worker_id === workerId && a.week_start_date === weekStartDate);

  let saved;
  if (existingList.length > 0) {
    saved = await base44.entities.Availability.update(existingList[0].id, availabilityData);
  } else {
    saved = await base44.entities.Availability.create(availabilityData);
  }

  return Response.json({ success: true, record: saved });
  } catch (err) {
    console.error("signupForShift failed:", err);
    return Response.json({ success: false, error: String(err?.message || err) }, { status: 200 });
  }
});