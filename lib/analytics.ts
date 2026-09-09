import { koreanDayStart } from './daily-bat.ts';

export const FUNNEL_EVENTS = [
  'landing',
  'play_click',
  'game_start',
  'game_complete',
  'retry_click',
  'second_complete',
  'result_view',
  'share_click',
  'referral',
] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export function isFunnelEvent(value: unknown): value is FunnelEvent {
  return (
    typeof value === 'string' && FUNNEL_EVENTS.includes(value as FunnelEvent)
  );
}

export function funnelStatement(
  db: D1Database,
  playerId: string,
  event: FunnelEvent,
  now = Date.now(),
) {
  return db
    .prepare(
      `INSERT INTO funnel_events(day_start, player_id, event, event_count, last_event_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(day_start, player_id, event) DO UPDATE SET
       event_count = event_count + 1,
       last_event_at = excluded.last_event_at`,
    )
    .bind(koreanDayStart(now), playerId, event, now);
}
