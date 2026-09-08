import { env } from 'cloudflare:workers';
import { BodyTooLargeError, readLimitedBody } from '@/lib/request-body';

const CARD_ID = /^[0-9a-f-]{32,36}$/i;
const MAX_CARD_BYTES = 1_800_000;

function objectKey(id: string) {
  return `share-cards/${id}`;
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!CARD_ID.test(id)) return new Response('Not found', { status: 404 });

  try {
    const object = await env.SHARE_CARDS.get(objectKey(id));
    if (object) {
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('Cache-Control', 'public, max-age=2592000, immutable');
      headers.set('ETag', object.httpEtag);
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(object.body, { headers });
    }

    // Cards created before v1.0.0 remain readable from D1 so old KakaoTalk
    // shares do not break while all new cards are stored in R2.
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
    const session = await env.DB.prepare(
      'SELECT completed_at, share_card_id FROM game_sessions WHERE id = ?',
    ).bind(sessionId).first<{ completed_at: number | null; share_card_id: string | null }>();
    if (!session?.completed_at) return Response.json({ error: '완료된 경기만 공유할 수 있습니다.' }, { status: 403 });
    if (session.share_card_id) return Response.json({ ok: true, id: session.share_card_id }, { status: 200 });

    const bytes = await readLimitedBody(request, MAX_CARD_BYTES);
    const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!isPng && !isJpeg) return Response.json({ error: '지원하지 않는 이미지입니다.' }, { status: 400 });
    const id = sessionId;
    await env.SHARE_CARDS.put(objectKey(id), bytes.buffer, {
      httpMetadata: {
        contentType: isJpeg ? 'image/jpeg' : 'image/png',
        cacheControl: 'public, max-age=2592000, immutable',
      },
      customMetadata: { sessionId },
    });
    const update = await env.DB.prepare(
      'UPDATE game_sessions SET share_card_id = ? WHERE id = ? AND completed_at IS NOT NULL AND share_card_id IS NULL',
    ).bind(id, sessionId).run();
    if (!update.meta.changes) {
      const raced = await env.DB.prepare('SELECT share_card_id FROM game_sessions WHERE id = ?').bind(sessionId).first<{ share_card_id: string | null }>();
      if (raced?.share_card_id) return Response.json({ ok: true, id: raced.share_card_id }, { status: 200 });
      return Response.json({ error: '공유 카드를 연결하지 못했습니다.' }, { status: 409 });
    }
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof BodyTooLargeError) return Response.json({ error: '공유 이미지가 너무 큽니다.' }, { status: 413 });
    const existing = await env.DB.prepare('SELECT share_card_id FROM game_sessions WHERE id = ?').bind(sessionId).first<{ share_card_id: string | null }>().catch(() => null);
    if (existing?.share_card_id) return Response.json({ ok: true, id: existing.share_card_id }, { status: 200 });
    console.error(JSON.stringify({ message: 'share card request failed', error: error instanceof Error ? error.message : String(error) }));
    return Response.json({ error: '공유 카드를 저장하지 못했습니다.' }, { status: 503 });
  }
}
