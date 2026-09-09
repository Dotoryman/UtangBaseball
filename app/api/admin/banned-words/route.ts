import { env } from 'cloudflare:workers';
import { requireAdmin } from '@/lib/admin-auth';
import { normalizeNickname } from '@/lib/nickname-filter';
import { BodyTooLargeError, readLimitedJson } from '@/lib/request-body';

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const rows = await env.DB.prepare(
    'SELECT id, term, created_at createdAt FROM banned_words ORDER BY term COLLATE NOCASE',
  ).all();
  return Response.json({ words: rows.results ?? [] });
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await readLimitedJson(request);
    const term = typeof body.term === 'string' ? body.term.trim() : '';
    const normalized = normalizeNickname(term);
    if (!term || term.length > 30 || !normalized)
      return Response.json(
        { error: '금지어를 다시 확인해줘.' },
        { status: 400 },
      );
    const now = Date.now();
    const result = await env.DB.batch([
      env.DB.prepare(
        'INSERT OR IGNORE INTO banned_words(term, normalized_term, created_at) VALUES (?, ?, ?)',
      ).bind(term, normalized, now),
      env.DB.prepare(
        'INSERT INTO admin_audit_logs(action, target_type, details, created_at) VALUES (?, ?, ?, ?)',
      ).bind('ADD_BANNED_WORD', 'banned_word', term, now),
    ]);
    if (!result[0].meta.changes)
      return Response.json({ error: '이미 등록된 말이야.' }, { status: 409 });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return Response.json({ error: '요청이 너무 커.' }, { status: 413 });
    return Response.json(
      { error: '금지어를 추가하지 못했어.' },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await readLimitedJson(request);
    const id = Number(body.id);
    if (!Number.isInteger(id))
      return Response.json({ error: '잘못된 금지어야.' }, { status: 400 });
    const row = await env.DB.prepare(
      'SELECT term FROM banned_words WHERE id = ?',
    )
      .bind(id)
      .first<{ term: string }>();
    if (!row)
      return Response.json({ error: '이미 없는 금지어야.' }, { status: 404 });
    await env.DB.batch([
      env.DB.prepare('DELETE FROM banned_words WHERE id = ?').bind(id),
      env.DB.prepare(
        'INSERT INTO admin_audit_logs(action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?)',
      ).bind(
        'DELETE_BANNED_WORD',
        'banned_word',
        String(id),
        row.term,
        Date.now(),
      ),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return Response.json({ error: '요청이 너무 커.' }, { status: 413 });
    return Response.json({ error: '금지어를 지우지 못했어.' }, { status: 503 });
  }
}
