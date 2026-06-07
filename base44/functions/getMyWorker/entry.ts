import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ worker: null }, { status: 200 });

    // Try by user_id first, fall back to email
    const byUserId = await base44.asServiceRole.entities.Worker.filter({ user_id: user.id });
    let worker = byUserId?.[0] || null;

    if (!worker && user.email) {
      const byEmail = await base44.asServiceRole.entities.Worker.filter({ email: user.email });
      worker = byEmail?.[0] || null;
    }

    return Response.json({ worker }, { status: 200 });
  } catch (err) {
    return Response.json({ worker: null, error: String(err?.message || err) }, { status: 200 });
  }
});