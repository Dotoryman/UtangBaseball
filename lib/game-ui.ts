import type { BatType } from './daily-bat';

export type Outcome =
  | 'WHIFF'
  | 'FOUL'
  | 'INFIELD_HIT'
  | 'SINGLE'
  | 'DOUBLE'
  | 'TRIPLE'
  | 'HOME_RUN';

export const APP_VERSION = 'v1.2.2';
export const DAILY_BAT_STORAGE_KEY = 'utang-baseball-daily-bat-v1';
export const RANKING_PAGE_SIZE = 5;
export const SWING_CONTACT_FRAME_MS = 78;

export const BATTER_FRAMES = [
  'ready',
  'load',
  'stride',
  'start',
  'mid',
  'contact',
  'extension',
  'follow',
] as const;

export const BAT_SPRITES: Record<BatType, string> = {
  basic: '/utang-batter-v8-strip.png',
  aluminum: '/utang-batter-v8-aluminum-strip.png',
  gold: '/utang-batter-v8-gold-strip.png',
  ruby: '/utang-batter-v8-ruby-strip.png',
  diamond: '/utang-batter-v8-diamond-strip.png',
};

export const BAT_LABELS: Record<BatType, string> = {
  basic: '기본',
  aluminum: '알루미늄',
  gold: '황금',
  ruby: '루비',
  diamond: '다이아몬드',
};

export const BAT_ICONS: Record<BatType, string> = {
  basic: '/utang-bat-gold-v093.png',
  aluminum: '/utang-bat-aluminum-v113.png',
  gold: '/utang-bat-gold-v093.png',
  ruby: '/utang-bat-ruby-v113.png',
  diamond: '/utang-bat-diamond-v093.png',
};

export const BAT_COLLECTION: Array<{ type: BatType; games: number }> = [
  { type: 'basic', games: 0 },
  { type: 'aluminum', games: 1 },
  { type: 'gold', games: 2 },
  { type: 'ruby', games: 3 },
  { type: 'diamond', games: 4 },
];

export const RESULT_META: Record<
  Outcome,
  { label: string; pose: string; tier: string }
> = {
  WHIFF: { label: '에구구!', pose: '/utang-pose-miss-v121.png', tier: 'miss' },
  FOUL: {
    label: '파울!',
    pose: '/utang-pose-foul-authentic.png',
    tier: 'foul',
  },
  INFIELD_HIT: {
    label: '내야안타!',
    pose: '/utang-pose-good-authentic.png',
    tier: 'hit',
  },
  SINGLE: {
    label: '안타!',
    pose: '/utang-pose-good-authentic.png',
    tier: 'hit',
  },
  DOUBLE: {
    label: '2루타!',
    pose: '/utang-pose-good-authentic.png',
    tier: 'extra',
  },
  TRIPLE: {
    label: '3루타!',
    pose: '/utang-pose-good-authentic.png',
    tier: 'extra',
  },
  HOME_RUN: {
    label: '홈런!',
    pose: '/utang-batter-v8-follow.png',
    tier: 'homer',
  },
};

export const OUTCOME_EFFECT_TIER: Record<Outcome, string> = {
  WHIFF: 'miss',
  FOUL: 'foul',
  INFIELD_HIT: 'infield',
  SINGLE: 'single',
  DOUBLE: 'double',
  TRIPLE: 'triple',
  HOME_RUN: 'homer',
};
