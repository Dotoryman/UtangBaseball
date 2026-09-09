import { koreanDayStart } from './daily-bat.ts';

const DAY = 86_400_000;

export function adminPeriod(url: URL) {
  const now = Date.now();
  const today = koreanDayStart(now);
  const preset = url.searchParams.get('period') ?? 'today';
  if (preset === 'yesterday') return { from: today - DAY, to: today, preset };
  if (preset === '7d') return { from: today - 6 * DAY, to: now + 1, preset };
  if (preset === '30d') return { from: today - 29 * DAY, to: now + 1, preset };
  if (preset === 'custom') {
    const from = Number(url.searchParams.get('from'));
    const to = Number(url.searchParams.get('to'));
    if (
      Number.isFinite(from) &&
      Number.isFinite(to) &&
      from >= 0 &&
      to > from &&
      to - from <= 366 * DAY
    )
      return { from, to, preset };
  }
  return { from: today, to: now + 1, preset: 'today' };
}
