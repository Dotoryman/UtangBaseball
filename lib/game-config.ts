export type PitchType = '직구' | '커브' | '체인지업';

export const TOTAL_PITCHES = 7;
export const WINDUP_MS = 760;
export const CONTACT_PROGRESS = 0.86;
export const PITCHES: ReadonlyArray<{ type: PitchType; duration: number }> = [
  { type: '직구', duration: 1500 },
  { type: '커브', duration: 1725 },
  { type: '체인지업', duration: 1950 },
];
