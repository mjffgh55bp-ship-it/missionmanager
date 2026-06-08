import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 200 });
    }
    const all = await base44.asServiceRole.entities.ShiftLock.list();
    let deleted = 0;
    for (const lock of all) {
      try { await base44.asServiceRole.entities.ShiftLock.delete(lock.id); deleted++; } catch (_) {}
    }
    return Response.json({ success: true, deleted }, { status: 200 });
  } catch (err) {
    return Response.json({ success: false, error: String(err?.message || err) }, { status: 200 });
  }
});