import { env } from 'cloudflare:workers';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const [logs, settings] = await env.DB.batch<
    Record<string, number | string | null>
  >([
    env.DB.prepare(
      'SELECT id, action, target_type targetType, target_id targetId, details, created_at createdAt FROM admin_audit_logs ORDER BY created_at DESC LIMIT 100',
    ),
    env.DB.prepare(
      'SELECT setting_key settingKey, setting_value settingValue, label, updated_at updatedAt FROM balance_settings ORDER BY setting_key',
    ),
  ]);
  return Response.json({
    logs: logs.results ?? [],
    settings: settings.results ?? [],
  });
}
