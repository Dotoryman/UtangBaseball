export type BatType = 'basic' | 'gold' | 'diamond';
export type BatReward = Exclude<BatType, 'basic'>;

export type DailyBatState = {
  dayStart: number;
  completedGames: number;
  equippedBat: BatType;
};

const BAT_SCORE_MULTIPLIERS: Record<BatType, number> = {
  basic: 1,
  gold: 1.1,
  diamond: 1.2,
};

export function koreanDayStart(now = Date.now()) {
  return Math.floor((now + 9 * 3_600_000) / 86_400_000) * 86_400_000 - 9 * 3_600_000;
}

export function batForCompletedGames(completedGames: number): BatType {
  if (completedGames >= 2) return 'diamond';
  if (completedGames >= 1) return 'gold';
  return 'basic';
}

export function createDailyBatState(now = Date.now()): DailyBatState {
  return { dayStart: koreanDayStart(now), completedGames: 0, equippedBat: 'basic' };
}

export function normalizeDailyBatState(value: unknown, now = Date.now()): DailyBatState {
  if (!value || typeof value !== 'object') return createDailyBatState(now);
  const candidate = value as Partial<DailyBatState>;
  if (candidate.dayStart !== koreanDayStart(now) || !Number.isFinite(candidate.completedGames)) return createDailyBatState(now);
  const completedGames = Math.max(0, Math.floor(candidate.completedGames ?? 0));
  return { dayStart: candidate.dayStart, completedGames, equippedBat: batForCompletedGames(completedGames) };
}

export function completeDailyGame(value: unknown, now = Date.now()): { state: DailyBatState; reward: BatReward | null } {
  const current = normalizeDailyBatState(value, now);
  const completedGames = current.completedGames + 1;
  const reward: BatReward | null = completedGames === 1 ? 'gold' : completedGames === 2 ? 'diamond' : null;
  return { state: { dayStart: current.dayStart, completedGames, equippedBat: batForCompletedGames(completedGames) }, reward };
}

export function isBatType(value: unknown): value is BatType {
  return value === 'basic' || value === 'gold' || value === 'diamond';
}

export function calculateEarnedScore(points: number, combo: number, bat: BatType) {
  return Math.round(points * (1 + Math.min(combo, 20) * 0.1) * BAT_SCORE_MULTIPLIERS[bat]);
}
