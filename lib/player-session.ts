import { batForCompletedGames, koreanDayStart, type BatReward, type BatType } from './daily-bat.ts';

export const PLAYER_COOKIE_NAME = 'utang_player';

const PLAYER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ServerBatProgress = {
  dayStart: number;
  completedGames: number;
  equippedBat: BatType;
  reward: BatReward | null;
};

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); }
    catch { return null; }
  }
  return null;
}

export function playerIdentity(request: Request) {
  const existing = readCookie(request.headers.get('cookie'), PLAYER_COOKIE_NAME);
  if (existing && PLAYER_ID.test(existing)) return { playerId: existing, setCookie: null };
  const playerId = crypto.randomUUID();
  return {
    playerId,
    setCookie: `${PLAYER_COOKIE_NAME}=${encodeURIComponent(playerId)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`,
  };
}

export function batProgress(completedGames: number, now = Date.now()): ServerBatProgress {
  const count = Math.max(0, Math.floor(completedGames));
  return {
    dayStart: koreanDayStart(now),
    completedGames: count,
    equippedBat: batForCompletedGames(count),
    reward: count === 1 ? 'gold' : count === 2 ? 'diamond' : null,
  };
}
