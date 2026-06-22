import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const VALID_REASONS = new Set(['overseas', 'vacation', 'scheduled_time', 'personal', 'periodic_event']);
    let processedCount = 0;
    let updatedCount = 0;
    let skip = 0;
    const batchSize = 100;
    let hasMore = true;

    while (hasMore) {
      const batch = await base44.asServiceRole.entities.Unavailability.list('-updated_date', batchSize, skip);
      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      for (const u of batch) {
        processedCount++;
        if (!VALID_REASONS.has(u.reason)) {
          await base44.asServiceRole.entities.Unavailability.update(u.id, { reason: 'personal' });
          updatedCount++;
        }
      }

      skip += batchSize;
      if (batch.length < batchSize) hasMore = false;
    }

    return Response.json({
      status: 'success',
      message: `Migration complete: ${updatedCount} constraints updated to 'personal' out of ${processedCount} processed`,
      processedCount,
      updatedCount
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});