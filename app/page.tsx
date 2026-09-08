'use client';

/* oxlint-disable next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Flame, HelpCircle, Home as HomeIcon, MessageCircle, Play, RotateCcw, Trophy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Screen = 'intro' | 'playing' | 'result';
type PitchType = '직구' | '커브' | '체인지업';
type Outcome = 'WHIFF' | 'FOUL' | 'INFIELD_HIT' | 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'HOME_RUN';
type BatterPhase = 'idle' | 'ready' | 'swing' | 'followThrough';
type PitcherPhase = 'idle' | 'windup' | 'throw' | 'followThrough' | 'reaction';
type CatcherPhase = 'idle' | 'prepare' | 'catch' | 'reaction';
type Countdown = 3 | 2 | 1 | 'PLAY' | null;
type Pitch = { id: number; type: PitchType; duration: number; startedAt: number };
type RecordItem = { nickname: string; score: number; homeRuns: number; distance: number; playedAt: number };
type Contact = { outcome: Outcome; distance: number; exitVelocity: number; launchAngle: number; points: number };
type GameStats = { score: number; combo: number; maxCombo: number; homeRuns: number; maxDistance: number };
type JudgmentResponse = { contact: Contact; stats: GameStats; completed: boolean };

const TOTAL_PITCHES = 10;
const APP_VERSION = 'v0.9.2';
const BATTER_FRAMES = ['ready', 'load', 'stride', 'start', 'mid', 'contact', 'extension', 'follow'] as const;
const RANKING_PAGE_SIZE = 5;
const WINDUP_MS = 760;
const CONTACT_PROGRESS = 0.86;
const SWING_CONTACT_FRAME_MS = 78;
const PITCHES: Array<{ type: PitchType; duration: number }> = [
  { type: '직구', duration: 1650 }, { type: '커브', duration: 1900 }, { type: '체인지업', duration: 2150 },
];
const RESULT_META: Record<Outcome, { label: string; pose: string; tier: string }> = {
  WHIFF: { label: '에구구!', pose: '/utang-pose-miss-v071.png', tier: 'miss' },
  FOUL: { label: '파울!', pose: '/utang-pose-foul-authentic.png', tier: 'foul' },
  INFIELD_HIT: { label: '내야안타!', pose: '/utang-pose-good-authentic.png', tier: 'hit' },
  SINGLE: { label: '안타!', pose: '/utang-pose-good-authentic.png', tier: 'hit' },
  DOUBLE: { label: '2루타!', pose: '/utang-pose-good-authentic.png', tier: 'extra' },
  TRIPLE: { label: '3루타!', pose: '/utang-pose-good-authentic.png', tier: 'extra' },
  HOME_RUN: { label: '홈런!', pose: '/utang-batter-v8-follow.png', tier: 'homer' },
};
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function calculateContact(error: number): Contact {
  if (error > 0.34) return { outcome: 'WHIFF', distance: 0, exitVelocity: 0, launchAngle: 0, points: 0 };
  if (error > 0.24) return { outcome: 'FOUL', distance: 0, exitVelocity: 78, launchAngle: 48, points: 180 };
  const quality = clamp(1 - error / 0.24, 0, 1);
  const exitVelocity = Math.round(clamp(76 + quality * 87 + (Math.random() - 0.5) * 8, 72, 166));
  const launchAngle = Math.round(clamp(-7 + quality * 37 + (Math.random() - 0.5) * 10, -10, 38));
  const angleEfficiency = clamp(1 - Math.abs(launchAngle - 27) / 42, 0.2, 1);
  const distance = Math.round(clamp((exitVelocity - 68) * 1.42 * angleEfficiency + Math.random() * 7, 8, 150));
  let outcome: Outcome = 'INFIELD_HIT';
  if (distance >= 115) outcome = 'HOME_RUN'; else if (distance >= 96) outcome = 'TRIPLE';
  else if (distance >= 73) outcome = 'DOUBLE'; else if (distance >= 30) outcome = 'SINGLE';
  const base = { INFIELD_HIT: 800, SINGLE: 1200, DOUBLE: 2100, TRIPLE: 3000, HOME_RUN: 4500 }[outcome];
  return { outcome, distance, exitVelocity, launchAngle, points: base + distance * 10 };
}
function measureVisualSwingError() {
  if (typeof document === 'undefined') return null;
  const ball = document.querySelector('.baseball')?.getBoundingClientRect();
  const target = document.querySelector('.contact-core')?.getBoundingClientRect();
  const stage = document.querySelector('.stadium')?.getBoundingClientRect();
  if (!ball || !target || !stage) return null;
  const dx = ball.left + ball.width / 2 - (target.left + target.width / 2);
  const dy = ball.top + ball.height / 2 - (target.top + target.height / 2);
  return Math.hypot(dx, dy) / (stage.height * 0.46);
}
function koreanMidnight(now = Date.now()) { return Math.floor((now + 9 * 3600000) / 86400000) * 86400000 - 9 * 3600000; }
function loadRecords(): RecordItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const records = JSON.parse(localStorage.getItem('utang-baseball-records') ?? '[]') as RecordItem[];
    if (!Array.isArray(records)) return [];
    return records.filter((record) => record && typeof record.nickname === 'string' && Number.isFinite(record.score) && record.playedAt >= koreanMidnight() && record.playedAt <= Date.now()).sort((a, b) => b.score - a.score).slice(0, 50);
  } catch { return []; }
}
async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const field = document.createElement('textarea'); field.value = text; field.style.position = 'fixed'; field.style.opacity = '0';
    document.body.appendChild(field); field.focus(); field.select(); const copied = document.execCommand('copy'); field.remove(); return copied;
  }
}
async function postGame<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`game-${response.status}`);
  return response.json() as Promise<T>;
}
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => reject(new Error('image-timeout')), 10000);
    image.onload = () => { window.clearTimeout(timeout); resolve(image); };
    image.onerror = () => { window.clearTimeout(timeout); reject(new Error('image-load')); };
    image.src = src;
  });
}
async function createShareCard(name: string, score: number, homeRuns: number, maxDistance: number, maxCombo: number) {
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630;
  const context = canvas.getContext('2d'); if (!context) return null;
  try {
    const background = await loadImage('/utang-share-card-v073-bg.jpg');
    context.drawImage(background, 0, 0, 1200, 630);
  } catch {
    const fallback = context.createLinearGradient(0, 0, 1200, 630); fallback.addColorStop(0, '#38251c'); fallback.addColorStop(1, '#795039');
    context.fillStyle = fallback; context.fillRect(0, 0, 1200, 630);
  }
  context.textBaseline = 'alphabetic'; context.textAlign = 'left';
  context.fillStyle = '#e3b85c'; context.font = '900 23px Arial, sans-serif'; context.fillText('UTANG BASEBALL · FINAL SCORE', 105, 154);
  const playerTitle = `${name} 선수의 야구 도전`;
  context.fillStyle = '#fff8e9'; context.font = '900 42px "Malgun Gothic", sans-serif';
  if (context.measureText(playerTitle).width > 630) context.font = '900 34px "Malgun Gothic", sans-serif';
  context.fillText(playerTitle, 105, 211, 630);
  context.fillStyle = '#fff8e9'; context.font = '900 98px "Arial Black", "Malgun Gothic", sans-serif'; context.fillText(score.toLocaleString(), 100, 325);
  const scoreWidth = context.measureText(score.toLocaleString()).width;
  context.fillStyle = '#e3b85c'; context.font = '900 34px "Malgun Gothic", sans-serif'; context.fillText('점', 114 + scoreWidth, 321);
  context.strokeStyle = 'rgba(255,244,220,.22)'; context.lineWidth = 2; context.beginPath(); context.moveTo(105, 354); context.lineTo(735, 354); context.stroke();
  context.fillStyle = '#e7cba7'; context.font = '800 20px "Malgun Gothic", sans-serif'; context.fillText('홈런', 105, 397); context.fillText('최고 비거리', 310, 397); context.fillText('최고 콤보', 535, 397);
  context.fillStyle = '#fff8e9'; context.font = '900 34px "Malgun Gothic", sans-serif'; context.fillText(`${homeRuns}개`, 105, 443); context.fillText(`${maxDistance}m`, 310, 443); context.fillText(`×${maxCombo}`, 535, 443);
  context.fillStyle = '#e3b85c'; context.font = '800 22px Arial, sans-serif'; context.fillText('utangbaseball.cloud', 105, 515);
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', .9));
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>('intro'); const [nickname, setNickname] = useState('');
  const [pitchNumber, setPitchNumber] = useState(0); const [pitch, setPitch] = useState<Pitch | null>(null);
  const [pitcherPhase, setPitcherPhase] = useState<PitcherPhase>('idle'); const [batterPhase, setBatterPhase] = useState<BatterPhase>('idle'); const [catcherPhase, setCatcherPhase] = useState<CatcherPhase>('idle');
  const [batterFrame, setBatterFrame] = useState(0);
  const [countdown, setCountdown] = useState<Countdown>(null);
  const [score, setScore] = useState(0); const [combo, setCombo] = useState(0); const [maxCombo, setMaxCombo] = useState(0);
  const [homeRuns, setHomeRuns] = useState(0); const [maxDistance, setMaxDistance] = useState(0); const [contact, setContact] = useState<Contact | null>(null);
  const [ballFlying, setBallFlying] = useState(false); const [records, setRecords] = useState<RecordItem[]>([]); const [shareNotice, setShareNotice] = useState('');
  const [showHelp, setShowHelp] = useState(false); const [rankingPage, setRankingPage] = useState(0);
  const shareBusy = useRef(false);
  const shareCardRef = useRef<{ sessionId: string; cardId: string } | null>(null);
  const sessionRef = useRef<string | null>(null); const sessionReadyRef = useRef<Promise<string | null>>(Promise.resolve(null));
  const releaseReadyRef = useRef<Promise<boolean>>(Promise.resolve(false));
  const gameRunRef = useRef(0); const pitchLockedRef = useRef(true);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]); const statsRef = useRef({ score: 0, homeRuns: 0, maxDistance: 0, maxCombo: 0 });
  const schedule = useCallback((callback: () => void, delay: number) => { const timer = setTimeout(callback, delay); timersRef.current.push(timer); return timer; }, []);
  const clearTimers = useCallback(() => { timersRef.current.forEach(clearTimeout); timersRef.current = []; }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setRecords((current) => current.filter((record) => record.playedAt >= koreanMidnight()));
      fetch('/api/scores?period=daily').then((r) => r.ok ? r.json() as Promise<{ records?: RecordItem[] }> : null).then((data) => { if (!cancelled && Array.isArray(data?.records)) setRecords(data.records.filter((record) => record.playedAt >= koreanMidnight())); }).catch(() => undefined);
      clearTimeout(timer);
      timer = setTimeout(refresh, koreanMidnight() + 86400000 - Date.now() + 100);
    };
    setRecords(loadRecords());
    refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  useEffect(() => {
    const characterAssets = [
      '/utang-batter-v8-strip.png',
      '/utang-pitcher-v090-strip.png',
      '/utang-umpire-v091-strip.png',
      '/utang-catcher-v6-strip.png',
      '/utang-batter-v8-follow.png',
      '/utang-pitcher-authentic.png',
      '/utang-pitcher-follow-v2.png',
      '/utang-catcher-authentic.png',
      '/utang-catcher-catch-v4.png',
      '/utang-pose-good-authentic.png',
      '/utang-pose-miss-v071.png',
      '/utang-pose-foul-authentic.png',
      '/baseball-official-cutout.png',
      '/utang-stadium-v5.webp',
    ];
    characterAssets.forEach((src) => { const image = new Image(); image.src = src; });
  }, []);
  useEffect(() => () => { gameRunRef.current += 1; clearTimers(); }, [clearTimers]);
  const finishGame = useCallback((finalScore: number, finalHomeRuns: number, finalDistance: number) => {
    const record: RecordItem = { nickname: nickname.trim() || '우땅이', score: finalScore, homeRuns: finalHomeRuns, distance: finalDistance, playedAt: Date.now() };
    const nextRecords = [...loadRecords(), record].sort((a, b) => b.score - a.score).slice(0, 50);
    try { localStorage.setItem('utang-baseball-records', JSON.stringify(nextRecords)); } catch { /* Results still work when browser storage is unavailable. */ }
    setRecords(nextRecords);
    setPitch(null); setScreen('result'); setPitcherPhase('idle'); setBatterPhase('idle'); setBatterFrame(0); setCatcherPhase('idle');
    fetch('/api/scores?period=daily').then((r) => r.ok ? r.json() as Promise<{ records?: RecordItem[] }> : null).then((data) => { if (Array.isArray(data?.records)) setRecords(data.records); }).catch(() => undefined);
  }, [nickname]);
  const queuePitch = useCallback(async (nextNumber: number, runId = gameRunRef.current) => {
    if (runId !== gameRunRef.current) return;
    pitchLockedRef.current = true;
    releaseReadyRef.current = Promise.resolve(false);
    setPitchNumber(nextNumber); setPitch(null); setContact(null); setBallFlying(false); setPitcherPhase('idle'); setBatterPhase('idle'); setBatterFrame(0); setCatcherPhase('idle');
    let config = PITCHES[Math.floor(Math.random() * PITCHES.length)];
    const sessionId = await sessionReadyRef.current;
    if (runId !== gameRunRef.current) return;
    if (sessionId) {
      try {
        const data = await postGame<{ pitch?: { type: PitchType; duration: number } }>({ action: 'pitch', sessionId, pitchNumber: nextNumber });
        if (data?.pitch && PITCHES.some((item) => item.type === data.pitch?.type && item.duration === data.pitch?.duration)) config = data.pitch;
        else throw new Error('pitch-session');
      } catch { sessionRef.current = null; sessionReadyRef.current = Promise.resolve(null); }
    }
    if (runId !== gameRunRef.current) return;
    schedule(() => { if (runId !== gameRunRef.current) return; setPitcherPhase('windup'); setBatterPhase('ready'); setBatterFrame(1); setCatcherPhase('prepare'); }, 180);
    schedule(() => {
      if (runId !== gameRunRef.current) return;
      const nextPitch: Pitch = { id: Date.now() + Math.random(), type: config.type, duration: config.duration, startedAt: performance.now() };
      pitchLockedRef.current = false;
      setPitcherPhase('throw'); setPitch(nextPitch);
      const releaseSessionId = sessionRef.current;
      if (releaseSessionId) {
        releaseReadyRef.current = postGame<{ released?: boolean }>({ action: 'release', sessionId: releaseSessionId, pitchNumber: nextNumber })
          .then((data) => { if (!data.released) throw new Error('release-session'); return true; })
          .catch(() => { if (runId === gameRunRef.current) { sessionRef.current = null; sessionReadyRef.current = Promise.resolve(null); } return false; });
      }
      schedule(() => { if (runId === gameRunRef.current) setPitcherPhase('followThrough'); }, 300);
      schedule(async () => {
        if (runId !== gameRunRef.current || pitchLockedRef.current) return;
        pitchLockedRef.current = true;
        let miss: Contact = { outcome: 'WHIFF', distance: 0, exitVelocity: 0, launchAngle: 0, points: 0 };
        let canonical: GameStats | null = null;
        if (sessionRef.current) {
          try {
            const data = await postGame<JudgmentResponse>({ action: 'miss', sessionId: sessionRef.current, pitchNumber: nextNumber });
            if (data?.contact && data.stats) { miss = data.contact; canonical = data.stats; } else throw new Error('miss-session');
          } catch { sessionRef.current = null; sessionReadyRef.current = Promise.resolve(null); }
        }
        if (runId !== gameRunRef.current) return;
        const current = canonical ?? { ...statsRef.current, combo: 0 };
        statsRef.current = { score: current.score, homeRuns: current.homeRuns, maxDistance: current.maxDistance, maxCombo: current.maxCombo };
        setScore(current.score); setCombo(0); setMaxCombo(current.maxCombo); setHomeRuns(current.homeRuns); setMaxDistance(current.maxDistance);
        setPitch(null); setContact(miss); setBatterPhase('followThrough'); setCatcherPhase('catch');
        schedule(() => { if (runId === gameRunRef.current) setCatcherPhase('reaction'); }, 300);
        schedule(() => { if (runId !== gameRunRef.current) return; const totals = statsRef.current; if (nextNumber >= TOTAL_PITCHES) finishGame(totals.score, totals.homeRuns, totals.maxDistance); else void queuePitch(nextNumber + 1, runId); }, 940);
      }, nextPitch.duration + 30);
    }, WINDUP_MS);
  }, [finishGame, schedule]);
  const startGame = useCallback((event?: { preventDefault(): void }) => {
    event?.preventDefault(); if (!nickname.trim()) setNickname('우땅이'); clearTimers(); statsRef.current = { score: 0, homeRuns: 0, maxDistance: 0, maxCombo: 0 };
    const runId = ++gameRunRef.current; pitchLockedRef.current = true;
    const playerName = nickname.trim() || '우땅이';
    sessionReadyRef.current = postGame<{ sessionId?: string }>({ action: 'start', nickname: playerName })
      .then((data) => data.sessionId ?? null)
      .catch(() => null).then((id) => { if (runId !== gameRunRef.current) return null; sessionRef.current = id; return id; });
    releaseReadyRef.current = Promise.resolve(false);
    setPitch(null); setContact(null); setBallFlying(false); setPitcherPhase('idle'); setBatterPhase('idle'); setBatterFrame(0); setCatcherPhase('idle');
    setScore(0); setCombo(0); setMaxCombo(0); setHomeRuns(0); setMaxDistance(0); setShareNotice(''); setPitchNumber(0); setScreen('playing'); setCountdown(3);
    schedule(() => { if (runId === gameRunRef.current) setCountdown(2); }, 700); schedule(() => { if (runId === gameRunRef.current) setCountdown(1); }, 1400); schedule(() => { if (runId === gameRunRef.current) setCountdown('PLAY'); }, 2100);
    schedule(() => { if (runId !== gameRunRef.current) return; setCountdown(null); void queuePitch(1, runId); }, 2500);
  }, [clearTimers, nickname, queuePitch, schedule]);
  const resolveSwing = useCallback(async () => {
    if (screen !== 'playing' || countdown || !pitch || batterPhase === 'swing' || contact || pitchLockedRef.current) return;
    const runId = gameRunRef.current; pitchLockedRef.current = true;
    const swingStartedAt = performance.now();
    const swingElapsedMs = Math.round(clamp(swingStartedAt - pitch.startedAt, 0, pitch.duration * 1.25));
    clearTimers(); setBatterPhase('swing'); setBatterFrame(2); setPitcherPhase('followThrough');
    // Change pose in the input frame, then reach the contact drawing quickly
    // enough that the bat feels attached to a mobile pointer-down gesture.
    [3, 4, 5, 6, 7].forEach((frame, index) => schedule(() => { if (runId === gameRunRef.current) setBatterFrame(frame); }, [22, 48, 78, 114, 158][index]));
    schedule(() => { if (runId !== gameRunRef.current) return; setBatterFrame(7); setBatterPhase('followThrough'); }, 210);
    const progress = clamp((performance.now() - pitch.startedAt) / pitch.duration, 0, 1.14);
    let nextContact = calculateContact(measureVisualSwingError() ?? Math.abs(progress - CONTACT_PROGRESS));
    const previewMakesContact = !['WHIFF', 'FOUL'].includes(nextContact.outcome);
    let previewLaunched = false;
    if (previewMakesContact) schedule(() => {
      if (runId !== gameRunRef.current) return;
      previewLaunched = true; setPitch(null); setBallFlying(true);
    }, SWING_CONTACT_FRAME_MS);
    let canonical: GameStats | null = null;
    if (sessionRef.current) {
      try {
        await releaseReadyRef.current;
        if (!sessionRef.current) throw new Error('release-session');
        const data = await postGame<JudgmentResponse>({ action: 'swing', sessionId: sessionRef.current, pitchNumber, swingElapsedMs });
        if (data?.contact && data.stats) { nextContact = data.contact; canonical = data.stats; } else throw new Error('swing-session');
      } catch { sessionRef.current = null; sessionReadyRef.current = Promise.resolve(null); }
    }
    const contactFrameDelay = SWING_CONTACT_FRAME_MS - (performance.now() - swingStartedAt);
    if (contactFrameDelay > 0) await new Promise((resolve) => window.setTimeout(resolve, contactFrameDelay));
    if (runId !== gameRunRef.current) return;
    const keepsCombo = !['WHIFF', 'FOUL'].includes(nextContact.outcome); const nextCombo = canonical?.combo ?? (keepsCombo ? combo + 1 : 0); const nextMaxCombo = canonical?.maxCombo ?? Math.max(maxCombo, nextCombo);
    const earned = Math.round(nextContact.points * (1 + Math.min(nextCombo, 20) * .1)); const nextScore = canonical?.score ?? score + earned;
    const nextHomeRuns = canonical?.homeRuns ?? homeRuns + (nextContact.outcome === 'HOME_RUN' ? 1 : 0); const nextMaxDistance = canonical?.maxDistance ?? Math.max(maxDistance, nextContact.distance);
    statsRef.current = { score: nextScore, homeRuns: nextHomeRuns, maxDistance: nextMaxDistance, maxCombo: nextMaxCombo };
    const isWhiff = nextContact.outcome === 'WHIFF';
    if (!isWhiff) setPitcherPhase('reaction');
    const isFoul = nextContact.outcome === 'FOUL';
    const catchDelay = Math.max(120, (1 - progress) * pitch.duration + 30);
    if (!isWhiff) setPitch(null);
    setContact(nextContact); setCombo(nextCombo); setMaxCombo(nextMaxCombo); setScore(nextScore); setHomeRuns(nextHomeRuns); setMaxDistance(nextMaxDistance); setBallFlying(!isWhiff && !isFoul && (nextContact.outcome !== 'HOME_RUN' || previewLaunched)); setCatcherPhase(isWhiff ? 'prepare' : 'reaction');
    if (nextContact.outcome === 'HOME_RUN' && !previewLaunched) schedule(() => setBallFlying(true), 180);
    if (isWhiff) schedule(() => { setPitch(null); setCatcherPhase('catch'); }, catchDelay);
    const finishDelay = isWhiff ? catchDelay + 900 : nextContact.outcome === 'HOME_RUN' ? 2100 : 1120;
    schedule(() => { if (runId !== gameRunRef.current) return; setPitch(null); if (pitchNumber >= TOTAL_PITCHES) finishGame(nextScore, nextHomeRuns, nextMaxDistance); else void queuePitch(pitchNumber + 1, runId); }, finishDelay);
  }, [batterPhase, clearTimers, combo, contact, countdown, finishGame, homeRuns, maxCombo, maxDistance, pitch, pitchNumber, queuePitch, schedule, score, screen]);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && showHelp) { event.preventDefault(); setShowHelp(false); return; } if (screen === 'playing' && ['Space', 'Enter'].includes(event.code) && !event.repeat && !(event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"], .hud-home'))) { event.preventDefault(); void resolveSwing(); } }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, [resolveSwing, screen, showHelp]);

  const rank = useMemo(() => records.findIndex((item) => item.nickname === (nickname.trim() || '우땅이') && item.score === score) + 1, [nickname, records, score]);
  const rankingPageCount = Math.max(1, Math.ceil(records.length / RANKING_PAGE_SIZE));
  const visibleRecords = records.slice(rankingPage * RANKING_PAGE_SIZE, (rankingPage + 1) * RANKING_PAGE_SIZE);
  useEffect(() => { setRankingPage((page) => Math.min(page, rankingPageCount - 1)); }, [rankingPageCount]);
  const grade = score >= 50000 ? '전설의 우땅이' : score >= 30000 ? '홈런왕 우땅이' : score >= 15000 ? '주전 우땅이' : score >= 5000 ? '동네 야구 우땅이' : '야구공 구경 온 우땅이';
  const resultImage = homeRuns > 0 ? '/utang-batter-v8-follow.png' : score >= 5000 ? '/utang-pose-good-authentic.png' : '/utang-pose-miss-v071.png';
  const shareScore = useCallback(async () => {
    if (shareBusy.current) return;
    shareBusy.current = true;
    const name = nickname.trim() || '우땅이';
    let cardUploaded = false;
    let shareUrl = 'https://utangbaseball.cloud/';
    setShareNotice('자랑거리 만드는 중…');
    try {
      const blob = await createShareCard(name, score, homeRuns, maxDistance, maxCombo);
      if (!blob) throw new Error('share-card');
      const sessionId = sessionRef.current;
      if (!sessionId) throw new Error('share-session');
      let cardId = shareCardRef.current?.sessionId === sessionId ? shareCardRef.current.cardId : '';
      if (!cardId) {
        const upload = await fetch(`/api/share-card?session=${encodeURIComponent(sessionId)}`, { method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob, signal: AbortSignal.timeout(15000) });
        const uploaded = upload.ok ? await upload.json() as { id?: string } : null;
        if (!uploaded?.id) throw new Error('share-card-upload');
        cardId = uploaded.id; shareCardRef.current = { sessionId, cardId };
      }
      const query = new URLSearchParams({ n: name, s: String(score), h: String(homeRuns), d: String(maxDistance), x: String(maxCombo), c: cardId });
      shareUrl = `https://utangbaseball.cloud/share?${query.toString()}`;
      cardUploaded = true;
      if (typeof navigator.share === 'function') { setShareNotice('누구한테 자랑할까?'); await navigator.share({ url: shareUrl }); setShareNotice('자랑 완료!'); }
      else { const copied = await copyText(shareUrl); setShareNotice(copied ? '자랑 링크 챙겼어!' : '링크를 못 챙겼어'); }
    } catch (error) { if ((error as DOMException).name === 'AbortError') setShareNotice('다음에 자랑할래'); else if (!cardUploaded) { setShareNotice('앗, 다시 눌러줘!'); } else { const copied = await copyText(shareUrl); setShareNotice(copied ? '자랑 링크 챙겼어!' : '한 번만 더 눌러줘'); } }
    shareBusy.current = false;
    window.setTimeout(() => setShareNotice(''), 2400);
  }, [homeRuns, maxCombo, maxDistance, nickname, score]);
  const returnHome = useCallback(() => { gameRunRef.current += 1; pitchLockedRef.current = true; clearTimers(); sessionRef.current = null; sessionReadyRef.current = Promise.resolve(null); releaseReadyRef.current = Promise.resolve(false); shareCardRef.current = null; setPitch(null); setContact(null); setBallFlying(false); setCountdown(null); setScreen('intro'); }, [clearTimers]);
  const showPitcherFollow = pitcherPhase === 'throw' || pitcherPhase === 'followThrough';
  const showCatcherCatch = catcherPhase === 'catch';
  // A missed pitch is not called until it has reached the catcher's mitt.
  const umpireCall = contact?.outcome === 'WHIFF'
    ? (!pitch ? 'strike' : 'idle')
    : contact && contact.outcome !== 'FOUL' ? 'fair' : 'idle';
  const umpire = <div className={`umpire umpire-${umpireCall}`}><span className="sr-only">{umpireCall === 'strike' ? '스트라이크를 선언하는 심판 우땅이' : umpireCall === 'fair' ? '타구를 판정하는 심판 우땅이' : '판정을 기다리는 심판 우땅이'}</span><span className="umpire-sprite" aria-hidden="true" style={{ backgroundPosition: umpireCall === 'strike' ? '50% 0' : umpireCall === 'fair' ? '100% 0' : '0 0' }} /></div>;

  return <main className="game-shell"><section className="phone-stage" aria-label="우땅야구 게임 화면">
    {screen === 'intro' && <div className="intro-panel screen-panel">
      <header className="intro-topbar"><button type="button" className="intro-brand brand-home" onClick={returnHome} aria-label="우땅야구 시작 화면"><img src="/utang-sun-logo.png" alt="햇님 우땅이" /><strong>우땅야구</strong></button><button type="button" className="help-button" onClick={() => setShowHelp(true)} aria-label="게임 방법 보기"><HelpCircle size={21} /></button></header>
      <div className="intro-scene"><span className="intro-halo" aria-hidden="true" /><div className="intro-stickers" aria-hidden="true"><span className="sticker-bubble sticker-wave"><img src="/utang-sticker-wave-v071.png" alt="" /></span><span className="sticker-bubble sticker-chill"><img src="/utang-sticker-chill-v071.png" alt="" /></span><span className="sticker-bubble sticker-ball"><img src="/utang-countdown-v071.png" alt="" /></span><span className="sticker-bubble sticker-clover"><img src="/utang-sticker-clover-v091.png" alt="" /></span></div><div className="hero-sprite" aria-hidden="true" /><span className="hero-spark spark-one">✦</span><span className="hero-spark spark-two">✦</span></div>
      <div className="intro-copy"><span className="intro-callout">공 온다!</span><h1>우땅아, 잘 보고<br /><em>냅다 휘둘러!</em></h1><p>기회는 딱 10번. 하나쯤은 넘어가겠지!</p></div>
      <form className="nickname-form" onSubmit={startGame}><label htmlFor="nickname" className="sr-only">닉네임</label><Input id="nickname" maxLength={10} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="우땅이" autoComplete="nickname" className="nickname-input" /><Button type="submit" className="start-button playful-action"><Play size={17} fill="currentColor" /> 일단 쳐보자!</Button></form>
      <div className="intro-ranking"><div className="intro-ranking-head"><div className="ranking-title"><Trophy size={17} /> 오늘 제일 잘 친 우땅이</div><span>매일 00:00 · 5명씩</span></div>{records.length > 0 ? visibleRecords.map((item, index) => { const rankNumber = rankingPage * RANKING_PAGE_SIZE + index + 1; return <div className={`ranking-row rank-${rankNumber}`} key={`${item.playedAt}-${rankNumber}`}><b>{rankNumber}</b><span>{item.nickname}</span><strong>{item.score.toLocaleString()}점</strong></div>; }) : <p className="ranking-empty">아직 아무도 못 쳤어. 네가 먼저 해!</p>}{rankingPageCount > 1 && <div className="ranking-pagination"><button type="button" onClick={() => setRankingPage((page) => Math.max(0, page - 1))} disabled={rankingPage === 0} aria-label="이전 순위"><ChevronLeft size={16} /></button><span>{rankingPage + 1} / {rankingPageCount}</span><button type="button" onClick={() => setRankingPage((page) => Math.min(rankingPageCount - 1, page + 1))} disabled={rankingPage === rankingPageCount - 1} aria-label="다음 순위"><ChevronRight size={16} /></button></div>}</div>
      <footer className="intro-footer"><span>{APP_VERSION}</span><i aria-hidden="true" /> <span>Made by Dotoryman</span></footer>
      {showHelp && <dialog open className="help-overlay" aria-label="게임 방법"><div className="help-card"><button type="button" className="help-close" onClick={() => setShowHelp(false)} aria-label="닫기"><X size={20} /></button><img src="/utang-sun-logo.png" alt="" /><h2>어떻게 치냐면!</h2><ol><li>공은 <b>딱 10번</b> 날아와.</li><li>노란 원에 가까워지면 냅다 탭!</li><li>딱 맞으면 멀리 가고 점수도 팍팍 올라.</li></ol><Button className="start-button" onClick={() => setShowHelp(false)}>오케이, 알겠어!</Button></div></dialog>}
    </div>}
    {screen === 'playing' && <button type="button" className={`play-field ${contact?.outcome === 'HOME_RUN' ? 'home-run-impact' : ''}`} onPointerDown={resolveSwing} aria-label="화면을 눌러 타격">
      {contact?.outcome === 'HOME_RUN' && <output className="homer-celebration"><strong>HOME RUN!</strong><span className="homer-caption">우땅이, 날렸다! · {contact.distance}m</span><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></output>}
      <div className="arcade-board">
        <div className="arcade-board-main"><span aria-hidden="true" /><div className="arcade-score"><small>나의 점수</small><strong>{score.toLocaleString()}<span>점</span></strong></div><div className={`arcade-combo ${combo > 1 ? 'is-hot' : ''}`}><span>콤보</span><strong><Flame size={16} aria-hidden="true" />×{combo}</strong></div></div>
        <div className="arcade-inning"><img className="arcade-ball-icon" src="/baseball-official-cutout.png" alt="이번 공" /><div className="arcade-pitches" aria-hidden="true">{Array.from({ length: TOTAL_PITCHES }, (_, index) => <i key={index} className={index + 1 === pitchNumber ? 'current' : index < pitchNumber ? 'done' : ''} />)}</div><strong>{String(pitchNumber).padStart(2, '0')}<span> / {TOTAL_PITCHES}</span></strong></div>
      </div>
      <div className="stadium"><img src="/utang-stadium-v5.webp" alt="다양한 우땅이 관중들이 응원하는 야구장" className="stadium-background" /><span className="sr-only">투수 우땅이</span><div aria-hidden="true" className={`pitcher pitcher-${pitcherPhase}`}><span className="pitcher-sprite" style={{ backgroundPosition: showPitcherFollow ? '100% 0' : '0 0' }} /></div>{pitcherPhase === 'throw' && <span className="release-flash" aria-hidden="true" />}<div className="pitch-guide" aria-hidden="true" /><span className="sr-only">{showCatcherCatch ? '공을 잡은 포수 우땅이' : '포수 우땅이'}</span><div aria-hidden="true" className={`catcher catcher-${catcherPhase}`}><span className="catcher-sprite" style={{ backgroundPosition: showCatcherCatch ? '100% 0' : '0 0' }} /></div>
        {umpire}
        {contact?.outcome === 'HOME_RUN' && <span className="batter-impact-bubble" aria-hidden="true">!!</span>}
        {!contact && <div className={`abs-zone ${pitch ? 'live' : ''}`} aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}<b className="contact-core" /></div>}
        {pitch && <div key={pitch.id} className={`baseball pitch-${pitch.type === '직구' ? 'fast' : pitch.type === '커브' ? 'curve' : 'change'}`} style={{ '--pitch-duration': `${pitch.duration}ms` } as React.CSSProperties}><img src="/baseball-official-cutout.png" alt="" /></div>}{ballFlying && <div className={`flying-ball ${contact ? `flying-${contact.outcome.toLowerCase()}` : 'flying-preview'}`}><img src="/baseball-official-cutout.png" alt="" /></div>}
        <div className={`batter-shadow batter-shadow-${batterPhase}`} /><div className={`batter batter-${batterPhase} ${contact ? `batter-result-${RESULT_META[contact.outcome].tier}` : ''}`}><span className="sr-only">{contact ? `${RESULT_META[contact.outcome].label} 타격을 한 우땅이` : '타격 준비 중인 우땅이'}</span><span className="batter-sprite-v6" aria-hidden="true" style={{ backgroundPosition: `${(batterFrame / (BATTER_FRAMES.length - 1)) * 100}% 0` }} />{contact && ['WHIFF', 'FOUL'].includes(contact.outcome) && <img src={RESULT_META[contact.outcome].pose} alt="" className="batter-reaction" loading="eager" decoding="sync" draggable={false} />}</div>
        {pitch && !contact && <div className="pitch-label">{pitch.type}</div>}{!pitch && !contact && !countdown && <div className="ready-label">투수 준비 중</div>}{contact && <div className={`judgment judgment-${RESULT_META[contact.outcome].tier}`}><strong>{RESULT_META[contact.outcome].label}</strong>{contact.distance > 0 && <span>{contact.distance}m · {contact.exitVelocity}km/h</span>}</div>}
        {!countdown && !contact && <div className="swing-cue"><span className="tap-ring"><i /></span><strong>탭!</strong><small>SPACE</small></div>}{countdown && <div className="countdown-overlay" aria-live="assertive"><div className="countdown-card"><span className="countdown-kicker">UTANG BASEBALL</span><span className="countdown-friend countdown-friend-left" aria-hidden="true"><img src="/utang-sticker-wave-v071.png" alt="" /></span><span className="countdown-friend countdown-friend-right" aria-hidden="true"><img src="/utang-sticker-chill-v071.png" alt="" /></span><div className="countdown-mascot"><span className="countdown-mascot-glow" aria-hidden="true" /><img src="/utang-countdown-v071.png" alt="야구공을 안고 준비하는 우땅이" /></div><small>우땅이의 야구 도전</small><strong key={countdown}>{countdown}</strong><b>{countdown === 'PLAY' ? 'PLAY BALL!' : '타격 준비'}</b><div className="countdown-dots" aria-hidden="true"><i className="active" /><i className={countdown === 2 || countdown === 1 || countdown === 'PLAY' ? 'active' : ''} /><i className={countdown === 1 || countdown === 'PLAY' ? 'active' : ''} /></div></div></div>}
      </div>
    </button>}{screen === 'playing' && <button type="button" className="hud-home arcade-home" aria-label="처음 화면으로" onClick={returnHome}><HomeIcon size={19} /><span>홈</span></button>}
    {screen === 'result' && <div className="result-panel screen-panel"><header className="result-topbar"><button type="button" className="intro-brand brand-home" onClick={returnHome} aria-label="우땅야구 시작 화면"><img src="/utang-sun-logo.png" alt="햇님 우땅이" /><strong>우땅야구</strong></button></header><div className="result-emotes" aria-hidden="true"><span className="result-emote result-emote-wave"><img src="/utang-sticker-wave-v071.png" alt="" /></span><span className="result-emote result-emote-chill"><img src="/utang-sticker-chill-v071.png" alt="" /></span><span className="result-emote result-emote-ball"><img src="/utang-countdown-v071.png" alt="" /></span><span className="result-emote result-emote-sun result-emote-clover"><img src="/utang-sticker-clover-v091.png" alt="" /></span></div><p className="badge">다 쳤다!</p><div className="result-character"><span className="result-burst" /><img src={resultImage} alt="경기를 마친 우땅이" className={`result-image ${homeRuns > 0 ? 'result-image-homer' : score >= 5000 ? 'result-image-good' : 'result-image-miss'}`} /></div><p className="result-grade">{grade}</p><h2>{score.toLocaleString()}<small>점</small></h2><div className="result-stats"><div><span>넘긴 공</span><strong>{homeRuns}개</strong></div><div><span>제일 멀리</span><strong>{maxDistance}m</strong></div><div><span>콤보 최고</span><strong>×{maxCombo}</strong></div></div>
      <div className="ranking-card"><div className="ranking-title"><Trophy size={16} /> 오늘 잘 친 우땅이 TOP 3</div>{records.slice(0, 3).map((item, index) => <div className="ranking-row" key={`${item.playedAt}-${index}`}><b>{index + 1}</b><span>{item.nickname}</span><strong>{item.score.toLocaleString()}점</strong></div>)}</div><p className="result-rank">오늘은 <strong>{rank || '-'}등!</strong> · 자정에 다시 시작</p><div className="result-actions"><Button className="start-button result-retry" onClick={() => startGame()}><RotateCcw size={18} /> 또 칠래!</Button><Button className="share-button result-share" onClick={shareScore}>{shareNotice ? <Check size={18} /> : <MessageCircle size={18} fill="currentColor" />}{shareNotice || '친구한테 자랑!'}</Button><Button variant="outline" className="home-button result-home" onClick={returnHome}><HomeIcon size={18} /> 처음으로 갈래</Button></div></div>}
  </section></main>;
}
