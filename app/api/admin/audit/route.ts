import { env } from 'cloudflare:workers';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const logs = await env.DB.prepare(
    'SELECT id, action, target_type targetType, target_id targetId, details, created_at createdAt FROM admin_audit_logs ORDER BY created_at DESC LIMIT 100',
  ).all<Record<string, number | string | null>>();
  return Response.json({
    logs: logs.results ?? [],
  });
}
