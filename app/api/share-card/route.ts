import { env } from 'cloudflare:workers';

const CARD_ID = /^[0-9a-f-]{32,36}$/i;
// D1 rows are capped at 2,000,000 bytes; keep margin for row metadata.
const MAX_CARD_BYTES = 1_800_000;

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
  const id = new URL(request.url).searchParams.get('id') ?? '';
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].toLowerCase();
  if (!CARD_ID.test(id) || !contentType || !['image/png', 'image/jpeg'].includes(contentType)) {
    return Response.json({ error: '잘못된 공유 카드입니다.' }, { status: 400 });
  }

  const image = await request.arrayBuffer();
  const bytes = new Uint8Array(image);
  const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if ((!isPng && !isJpeg) || bytes.length > MAX_CARD_BYTES) {
    return Response.json({ error: '지원하지 않는 이미지입니다.' }, { status: 400 });
  }

  try {
    const expiresBefore = Date.now() - 30 * 24 * 60 * 60 * 1000;
    await env.DB.batch([
      env.DB.prepare('DELETE FROM share_cards WHERE created_at < ?').bind(expiresBefore),
      env.DB.prepare('INSERT OR REPLACE INTO share_cards (id, image, created_at) VALUES (?, ?, ?)').bind(id, image, Date.now()),
    ]);
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: '공유 카드를 저장하지 못했습니다.' }, { status: 503 });
  }
}
