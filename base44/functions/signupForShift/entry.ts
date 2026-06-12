import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function withRetry(fn, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      if (!/rate limit|429|timeout|network/i.test(msg)) throw e;
      await sleep(300 * Math.pow(2, i));
    }
  }
  throw lastErr;
}

/**
 * Atomic signup for a shift slot using a distributed lock (ShiftLock entity).
 *
 * Strategy:
 * 1. Fetch all availabilities for the week (needed for validation + saving).
 * 2. Fetch existing locks for this signupKey+week.
 * 3. Validate each lock against the holder's actual availability:
 *    A lock is VALID only if its holder has a "wanted" entry for this signupKey.
 *    Stale locks (holder removed/switched their signup) are cleaned up.
 * 4. Count only valid locks from other workers to check capacity.
 * 5. If capacity available, try to INSERT our lock (or update ours if we already hold one).
 * 6. After a 100ms race-sleep, re-check and re-validate locks.
 * 7. If we won, save the availability record.
 * 8. If we lost, delete our lock.
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

  // ── Fetch all availabilities for the week once (used for validation + saving) ──
  const allAvails = await withRetry(() => base44.entities.Availability.filter({ week_start_date: weekStartDate }));

  // ── Helper: a lock is VALID only if its holder has a "wanted" entry for this signupKey ──
  const holderHasWanted = (wid) => {
    const rec = allAvails.find(a => a.worker_id === wid);
    if (!rec || !Array.isArray(rec.shifts)) return false;
    return rec.shifts.some(s => s.signupKey === signupKey && s.type === "wanted");
  };

  // ── Handle un-registration: release ALL locks for this worker+key, save availability ──
  if (isRemove) {
    const existingLocks = await withRetry(() => base44.entities.ShiftLock.filter({ lock_key: lockKey }));
    const myLocks = existingLocks.filter(l => l.worker_id === workerId);
    for (const lock of myLocks) {
      try { await withRetry(() => base44.entities.ShiftLock.delete(lock.id)); } catch (_) {}
    }

    // Reuse the already-fetched allAvails
    const existingList = allAvails.filter(a => a.worker_id === workerId && a.week_start_date === weekStartDate);
    let saved;
    if (existingList.length > 0) {
      saved = await withRetry(() => base44.entities.Availability.update(existingList[0].id, availabilityData));
    } else {
      saved = await withRetry(() => base44.entities.Availability.create(availabilityData));
    }
    return Response.json({ success: true, record: saved });
  }

  // ── Signup branch ──

  // Step 1: Check existing locks for this slot
  const existingLocks = await withRetry(() => base44.entities.ShiftLock.filter({ lock_key: lockKey }));

  // Validate locks: only count locks whose holder actually has a "wanted" entry
  const validOtherLocks = [];
  for (const l of existingLocks) {
    if (l.worker_id === workerId) continue;
    if (holderHasWanted(l.worker_id)) {
      validOtherLocks.push(l);
    } else {
      // Stale lock (holder removed/switched their signup via another path) — clean it up
      try { await withRetry(() => base44.entities.ShiftLock.delete(l.id)); } catch (_) { /* already gone */ }
    }
  }

  if (validOtherLocks.length >= maxSlots) {
    return Response.json({ success: false, reason: 'full', currentCount: validOtherLocks.length, maxSlots });
  }

  // Step 2: Acquire lock — create if we don't already have one
  const myExistingLock = existingLocks.find(l => l.worker_id === workerId);
  let lockRecord;
  if (myExistingLock) {
    lockRecord = myExistingLock;
  } else {
    lockRecord = await withRetry(() => base44.entities.ShiftLock.create({
      lock_key: lockKey,
      worker_id: workerId,
      worker_name: workerName || '',
      locked_at: new Date().toISOString(),
    }));
  }

  // Step 3: Re-check after lock creation (handles the tight race window)
  await new Promise(r => setTimeout(r, 100));

  const locksAfter = await withRetry(() => base44.entities.ShiftLock.filter({ lock_key: lockKey }));
  // Re-validate: only count locks whose holder still has a "wanted" entry
  const validOtherLocksAfter = [];
  for (const l of locksAfter) {
    if (l.worker_id === workerId) continue;
    if (holderHasWanted(l.worker_id)) {
      validOtherLocksAfter.push(l);
    } else {
      try { await withRetry(() => base44.entities.ShiftLock.delete(l.id)); } catch (_) {}
    }
  }

  if (validOtherLocksAfter.length >= maxSlots) {
    // Someone else also got in — delete our lock and return failure
    try {
      await withRetry(() => base44.entities.ShiftLock.delete(lockRecord.id));
    } catch (_) { /* already gone — that's fine */ }
    return Response.json({ success: false, reason: 'full', currentCount: validOtherLocksAfter.length, maxSlots });
  }

  // Step 4: We won — save the availability record (reuse allAvails instead of refetching)
  const existingList = allAvails.filter(a => a.worker_id === workerId && a.week_start_date === weekStartDate);

  let saved;
  if (existingList.length > 0) {
    saved = await withRetry(() => base44.entities.Availability.update(existingList[0].id, availabilityData));
  } else {
    saved = await withRetry(() => base44.entities.Availability.create(availabilityData));
  }

  return Response.json({ success: true, record: saved });
  } catch (err) {
    console.error("signupForShift failed:", err);
    return Response.json({ success: false, error: String(err?.message || err) }, { status: 200 });
  }
});