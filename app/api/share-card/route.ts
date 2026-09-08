import { env } from 'cloudflare:workers';
import { BodyTooLargeError, readLimitedBody } from '@/lib/request-body';

const CARD_ID = /^[0-9a-f-]{32,36}$/i;
// D1 rows are capped at 2,000,000 bytes; keep margin for row metadata.
const MAX_CARD_BYTES = 1_800_000;
const MAX_ACTIVE_CARD_BYTES = 64_000_000;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!CARD_ID.test(id)) return new Response('Not found', { status: 404 });

  try {
    const row = await env.DB.prepare('SELECT image FROM share_cards WHERE id = ?').bind(id).first<{ image: number[] | ArrayBuffer }>();
    if (!row?.image) return new Response('Not found', { status: 404 });
    const bytes = Array.isArray(row.image) ? Uint8Array.from(row.image) : new Uint8Array(row.image);
    if (bytes.byteLength === 0) return new Response('Not found', { status: 404 });
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    return new Response(bytes, {
      headers: {
        'Content-Type': isJpeg ? 'image/jpeg' : 'image/png',
        'Cache-Control': 'public, max-age=2592000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Unavailable', { status: 503 });
  }
}

export async function POST(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session') ?? '';
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].toLowerCase();
  if (!CARD_ID.test(sessionId) || !contentType || !['image/png', 'image/jpeg'].includes(contentType)) {
    return Response.json({ error: '잘못된 공유 카드입니다.' }, { status: 400 });
  }

  try {
    const existing = await env.DB.prepare('SELECT id FROM share_cards WHERE session_id = ?').bind(sessionId).first<{ id: string }>();
    if (existing?.id) return Response.json({ ok: true, id: existing.id }, { status: 200 });
    const bytes = await readLimitedBody(request, MAX_CARD_BYTES);
    const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!isPng && !isJpeg) return Response.json({ error: '지원하지 않는 이미지입니다.' }, { status: 400 });
    const id = crypto.randomUUID();
    const now = Date.now();
    const expiresBefore = now - 30 * 24 * 60 * 60 * 1000;
    await env.DB.prepare('DELETE FROM share_cards WHERE created_at < ?').bind(expiresBefore).run();
    const insert = await env.DB.prepare(
      `INSERT INTO share_cards (id, image, created_at, session_id)
       SELECT ?, ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM game_sessions WHERE id = ? AND completed_at IS NOT NULL)
         AND (SELECT COALESCE(SUM(length(image)), 0) FROM share_cards) + ? <= ?
         AND NOT EXISTS (SELECT 1 FROM share_cards WHERE session_id = ?)`,
    ).bind(id, bytes.buffer, now, sessionId, sessionId, bytes.byteLength, MAX_ACTIVE_CARD_BYTES, sessionId).run();
    if (!insert.meta.changes) {
      // A concurrent upload for the same completed game may have won the unique
      // session constraint after our initial read. Return that immutable card.
      const raced = await env.DB.prepare('SELECT id FROM share_cards WHERE session_id = ?').bind(sessionId).first<{ id: string }>();
      if (raced?.id) return Response.json({ ok: true, id: raced.id }, { status: 200 });
      const completed = await env.DB.prepare('SELECT completed_at FROM game_sessions WHERE id = ?').bind(sessionId).first<{ completed_at: number | null }>();
      return Response.json({ error: completed?.completed_at ? '공유 카드 보관 공간이 가득 찼습니다.' : '완료된 경기만 공유할 수 있습니다.' }, { status: completed?.completed_at ? 507 : 403 });
    }
    await env.DB.prepare('UPDATE game_sessions SET share_card_id = ? WHERE id = ? AND completed_at IS NOT NULL AND share_card_id IS NULL').bind(id, sessionId).run();
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof BodyTooLargeError) return Response.json({ error: '공유 이미지가 너무 큽니다.' }, { status: 413 });
    const existing = await env.DB.prepare('SELECT id FROM share_cards WHERE session_id = ?').bind(sessionId).first<{ id: string }>().catch(() => null);
    if (existing?.id) return Response.json({ ok: true, id: existing.id }, { status: 200 });
    console.error(JSON.stringify({ message: 'share card request failed', error: error instanceof Error ? error.message : String(error) }));
    return Response.json({ error: '공유 카드를 저장하지 못했습니다.' }, { status: 503 });
  }
}
