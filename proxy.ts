import { NextResponse } from 'next/server';

const PRIMARY_HOST = 'utangbaseball.cloud';
const PUBLIC_HOSTS = new Set([PRIMARY_HOST, `www.${PRIMARY_HOST}`]);

export function proxy(request: Request) {
  const url = new URL(request.url);
  if (!PUBLIC_HOSTS.has(url.hostname)) return NextResponse.next();

  const forwardedProtocol = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    .trim();
  const needsHttps =
    url.protocol !== 'https:' || forwardedProtocol === 'http';
  const needsPrimaryHost = url.hostname !== PRIMARY_HOST;
  if (!needsHttps && !needsPrimaryHost) return NextResponse.next();

  url.protocol = 'https:';
  url.hostname = PRIMARY_HOST;
  url.port = '';
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: '/:path*',
};
