'use client';

/* oxlint-disable next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Flame, HelpCircle, Home as HomeIcon, RotateCcw, Share2, Trophy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Screen = 'intro' | 'playing' | 'result';
type PitchType = '직구' | '커브' | '체인지업';
type Outcome = 'WHIFF' | 'FOUL' | 'INFIELD_HIT' | 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'HOME_RUN';
type BatterPhase = 'idle' | 'ready' | 'swing' | 'followThrough';
type PitcherPhase = 'idle' | 'windup' | 'throw' | 'followThrough';
type CatcherPhase = 'idle' | 'prepare' | 'catch' | 'reaction';
type Countdown = 3 | 2 | 1 | 'PLAY' | null;
type Pitch = { id: number; type: PitchType; duration: number; startedAt: number };
type RecordItem = { nickname: string; score: number; homeRuns: number; distance: number; playedAt: number };
type Contact = { outcome: Outcome; distance: number; exitVelocity: number; launchAngle: number; points: number };

const TOTAL_PITCHES = 10;
const RANKING_PAGE_SIZE = 5;
const WINDUP_MS = 760;
const CONTACT_PROGRESS = 0.86;
const PITCHES: Array<{ type: PitchType; duration: number }> = [
  { type: '직구', duration: 1650 }, { type: '커브', duration: 1900 }, { type: '체인지업', duration: 2150 },
];
const RESULT_META: Record<Outcome, { label: string; pose: string; tier: string }> = {
  WHIFF: { label: '에구구!', pose: '/utang-pose-miss-v4.png', tier: 'miss' },
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
function loadRecords(): RecordItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const records = JSON.parse(localStorage.getItem('utang-baseball-records') ?? '[]') as RecordItem[];
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return records.filter((record) => record.playedAt >= midnight);
  } catch { return []; }
}
async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const field = document.createElement('textarea'); field.value = text; field.style.position = 'fixed'; field.style.opacity = '0';
    document.body.appendChild(field); field.focus(); field.select(); const copied = document.execCommand('copy'); field.remove(); return copied;
  }
}
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });
}
async function createShareCard(name: string, score: number, homeRuns: number, maxDistance: number, maxCombo: number) {
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630;
  const context = canvas.getContext('2d'); if (!context) return null;
  try {
    const background = await loadImage('/utang-share-card-v4-bg.jpg');
    context.drawImage(background, 0, 0, 1200, 630);
  } catch {
    const fallback = context.createLinearGradient(0, 0, 1200, 630); fallback.addColorStop(0, '#071c46'); fallback.addColorStop(1, '#164f9e');
    context.fillStyle = fallback; context.fillRect(0, 0, 1200, 630);
  }
  context.textBaseline = 'alphabetic'; context.textAlign = 'left';
  context.fillStyle = '#ffcf45'; context.font = '900 23px Arial, sans-serif'; context.fillText('UTANG BASEBALL · FINAL SCORE', 105, 154);
  const playerTitle = `${name} 선수의 10구 승부`;
  context.fillStyle = '#fff'; context.font = '900 42px "Malgun Gothic", sans-serif';
  if (context.measureText(playerTitle).width > 630) context.font = '900 34px "Malgun Gothic", sans-serif';
  context.fillText(playerTitle, 105, 211);
  context.fillStyle = '#fff'; context.font = '900 98px "Arial Black", "Malgun Gothic", sans-serif'; context.fillText(score.toLocaleString(), 100, 325);
  const scoreWidth = context.measureText(score.toLocaleString()).width;
  context.fillStyle = '#ffcf45'; context.font = '900 34px "Malgun Gothic", sans-serif'; context.fillText('점', 114 + scoreWidth, 321);
  context.strokeStyle = 'rgba(255,255,255,.18)'; context.lineWidth = 2; context.beginPath(); context.moveTo(105, 354); context.lineTo(735, 354); context.stroke();
  context.fillStyle = '#b9d7ff'; context.font = '800 20px "Malgun Gothic", sans-serif'; context.fillText('홈런', 105, 397); context.fillText('최고 비거리', 310, 397); context.fillText('최고 콤보', 535, 397);
  context.fillStyle = '#fff'; context.font = '900 34px "Malgun Gothic", sans-serif'; context.fillText(`${homeRuns}개`, 105, 443); context.fillText(`${maxDistance}m`, 310, 443); context.fillText(`×${maxCombo}`, 535, 443);
  context.fillStyle = '#ffcf45'; context.font = '800 22px Arial, sans-serif'; context.fillText('utangbaseball.cloud', 105, 515);
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', .94));
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>('intro'); const [nickname, setNickname] = useState('');
  const [pitchNumber, setPitchNumber] = useState(0); const [pitch, setPitch] = useState<Pitch | null>(null);
  const [pitcherPhase, setPitcherPhase] = useState<PitcherPhase>('idle'); const [batterPhase, setBatterPhase] = useState<BatterPhase>('idle'); const [catcherPhase, setCatcherPhase] = useState<CatcherPhase>('idle');
  const [countdown, setCountdown] = useState<Countdown>(null);
  const [score, setScore] = useState(0); const [combo, setCombo] = useState(0); const [maxCombo, setMaxCombo] = useState(0);
  const [homeRuns, setHomeRuns] = useState(0); const [maxDistance, setMaxDistance] = useState(0); const [contact, setContact] = useState<Contact | null>(null);
  const [ballFlying, setBallFlying] = useState(false); const [records, setRecords] = useState<RecordItem[]>([]); const [shareNotice, setShareNotice] = useState('');
  const [showHelp, setShowHelp] = useState(false); const [rankingPage, setRankingPage] = useState(0);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]); const statsRef = useRef({ score: 0, homeRuns: 0, maxDistance: 0, maxCombo: 0 });
  const schedule = useCallback((callback: () => void, delay: number) => { const timer = setTimeout(callback, delay); timersRef.current.push(timer); return timer; }, []);
  const clearTimers = useCallback(() => { timersRef.current.forEach(clearTimeout); timersRef.current = []; }, []);

  useEffect(() => {
    const localTimer = window.setTimeout(() => setRecords(loadRecords()), 80);
    fetch('/api/scores?period=daily').then((r) => r.ok ? r.json() as Promise<{ records?: RecordItem[] }> : null).then((data) => { if (Array.isArray(data?.records)) setRecords(data.records); }).catch(() => undefined);
    return () => window.clearTimeout(localTimer);
  }, []);
  useEffect(() => {
    const characterAssets = [
      '/utang-batter-v8-strip.webp',
      '/utang-batter-v8-follow.png',
      '/utang-pitcher-authentic.png',
      '/utang-pitcher-follow-v2.png',
      '/utang-catcher-authentic.png',
      '/utang-catcher-catch-v4.png',
      '/utang-pose-good-authentic.png',
      '/utang-pose-miss-v4.png',
      '/utang-pose-foul-authentic.png',
      '/baseball-official-cutout.png',
      '/utang-stadium-v4.webp',
    ];
    characterAssets.forEach((src) => { const image = new Image(); image.src = src; });
  }, []);
  useEffect(() => clearTimers, [clearTimers]);
  const finishGame = useCallback((finalScore: number, finalHomeRuns: number, finalDistance: number) => {
    const record: RecordItem = { nickname: nickname.trim() || '우땅이', score: finalScore, homeRuns: finalHomeRuns, distance: finalDistance, playedAt: Date.now() };
    const nextRecords = [...loadRecords(), record].sort((a, b) => b.score - a.score).slice(0, 50); localStorage.setItem('utang-baseball-records', JSON.stringify(nextRecords)); setRecords(nextRecords);
    setPitch(null); setScreen('result'); setPitcherPhase('idle'); setBatterPhase('idle'); setCatcherPhase('idle');
    fetch('/api/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) }).then((r) => r.ok ? r.json() as Promise<{ records?: RecordItem[] }> : null).then((data) => { if (Array.isArray(data?.records)) setRecords(data.records); }).catch(() => undefined);
  }, [nickname]);
  const queuePitch = useCallback((nextNumber: number) => {
    setPitchNumber(nextNumber); setPitch(null); setContact(null); setBallFlying(false); setPitcherPhase('idle'); setBatterPhase('idle'); setCatcherPhase('idle');
    const config = PITCHES[Math.floor(Math.random() * PITCHES.length)];
    schedule(() => { setPitcherPhase('windup'); setBatterPhase('ready'); setCatcherPhase('prepare'); }, 180);
    schedule(() => {
      const nextPitch: Pitch = { id: Date.now() + Math.random(), type: config.type, duration: config.duration, startedAt: performance.now() };
      setPitcherPhase('throw'); setPitch(nextPitch); schedule(() => setPitcherPhase('followThrough'), 300);
      schedule(() => {
        setPitch(null); setContact({ outcome: 'WHIFF', distance: 0, exitVelocity: 0, launchAngle: 0, points: 0 }); setCombo(0); setBatterPhase('followThrough'); setCatcherPhase('catch');
        schedule(() => setCatcherPhase('reaction'), 300);
        schedule(() => { const current = statsRef.current; if (nextNumber >= TOTAL_PITCHES) finishGame(current.score, current.homeRuns, current.maxDistance); else queuePitch(nextNumber + 1); }, 940);
      }, nextPitch.duration + 30);
    }, WINDUP_MS);
  }, [finishGame, schedule]);
  const startGame = useCallback((event?: { preventDefault(): void }) => {
    event?.preventDefault(); if (!nickname.trim()) setNickname('우땅이'); clearTimers(); statsRef.current = { score: 0, homeRuns: 0, maxDistance: 0, maxCombo: 0 };
    setScore(0); setCombo(0); setMaxCombo(0); setHomeRuns(0); setMaxDistance(0); setShareNotice(''); setPitchNumber(0); setScreen('playing'); setCountdown(3);
    schedule(() => setCountdown(2), 700); schedule(() => setCountdown(1), 1400); schedule(() => setCountdown('PLAY'), 2100);
    schedule(() => { setCountdown(null); queuePitch(1); }, 2500);
  }, [clearTimers, nickname, queuePitch, schedule]);
  const resolveSwing = useCallback(() => {
    if (screen !== 'playing' || countdown || !pitch || batterPhase === 'swing' || contact) return;
    clearTimers(); setBatterPhase('swing'); setPitcherPhase('followThrough');
    const progress = clamp((performance.now() - pitch.startedAt) / pitch.duration, 0, 1.14);
    const nextContact = calculateContact(measureVisualSwingError() ?? Math.abs(progress - CONTACT_PROGRESS));
    const keepsCombo = !['WHIFF', 'FOUL'].includes(nextContact.outcome); const nextCombo = keepsCombo ? combo + 1 : 0; const nextMaxCombo = Math.max(maxCombo, nextCombo);
    const earned = Math.round(nextContact.points * (1 + Math.min(nextCombo, 20) * .1)); const nextScore = score + earned;
    const nextHomeRuns = homeRuns + (nextContact.outcome === 'HOME_RUN' ? 1 : 0); const nextMaxDistance = Math.max(maxDistance, nextContact.distance);
    statsRef.current = { score: nextScore, homeRuns: nextHomeRuns, maxDistance: nextMaxDistance, maxCombo: nextMaxCombo };
    const isWhiff = nextContact.outcome === 'WHIFF';
    const isFoul = nextContact.outcome === 'FOUL';
    const catchDelay = Math.max(120, (1 - progress) * pitch.duration + 30);
    if (!isWhiff) setPitch(null);
    setContact(nextContact); setCombo(nextCombo); setMaxCombo(nextMaxCombo); setScore(nextScore); setHomeRuns(nextHomeRuns); setMaxDistance(nextMaxDistance); setBallFlying(!isWhiff && !isFoul); setCatcherPhase(isWhiff ? 'prepare' : 'reaction');
    schedule(() => setBatterPhase('followThrough'), 260);
    if (isWhiff) schedule(() => { setPitch(null); setCatcherPhase('catch'); }, catchDelay);
    const finishDelay = isWhiff ? catchDelay + 900 : nextContact.outcome === 'HOME_RUN' ? 1550 : 1120;
    schedule(() => { setPitch(null); if (pitchNumber >= TOTAL_PITCHES) finishGame(nextScore, nextHomeRuns, nextMaxDistance); else queuePitch(pitchNumber + 1); }, finishDelay);
  }, [batterPhase, clearTimers, combo, contact, countdown, finishGame, homeRuns, maxCombo, maxDistance, pitch, pitchNumber, queuePitch, schedule, score, screen]);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.code === 'Space') { event.preventDefault(); resolveSwing(); } }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, [resolveSwing]);

  const rank = useMemo(() => records.findIndex((item) => item.nickname === (nickname.trim() || '우땅이') && item.score === score) + 1, [nickname, records, score]);
  const rankingPageCount = Math.max(1, Math.ceil(records.length / RANKING_PAGE_SIZE));
  const visibleRecords = records.slice(rankingPage * RANKING_PAGE_SIZE, (rankingPage + 1) * RANKING_PAGE_SIZE);
  useEffect(() => { setRankingPage((page) => Math.min(page, rankingPageCount - 1)); }, [rankingPageCount]);
  const grade = score >= 50000 ? '전설의 우땅이' : score >= 30000 ? '홈런왕 우땅이' : score >= 15000 ? '주전 우땅이' : score >= 5000 ? '동네 야구 우땅이' : '야구공 구경 온 우땅이';
  const resultImage = homeRuns > 0 ? '/utang-batter-v8-follow.png' : score >= 5000 ? '/utang-pose-good-authentic.png' : '/utang-pose-miss-v4.png';
  const shareScore = useCallback(async () => {
    const name = nickname.trim() || '우땅이';
    const cardId = crypto.randomUUID();
    const query = new URLSearchParams({ name, score: String(score), hr: String(homeRuns), distance: String(maxDistance), combo: String(maxCombo), card: cardId });
    const shareUrl = `https://utangbaseball.cloud/share?${query.toString()}`;
    setShareNotice('공유 카드 준비 중…');
    try {
      const blob = await createShareCard(name, score, homeRuns, maxDistance, maxCombo);
      if (!blob) throw new Error('share-card');
      const upload = await fetch(`/api/share-card?id=${encodeURIComponent(cardId)}`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: blob });
      if (!upload.ok) throw new Error('share-card-upload');
      if (typeof navigator.share === 'function') { await navigator.share({ url: shareUrl }); setShareNotice('공유 완료!'); }
      else { const copied = await copyText(shareUrl); setShareNotice(copied ? '링크 복사 완료!' : '복사하지 못했어'); }
    } catch (error) { if ((error as DOMException).name === 'AbortError') setShareNotice('공유를 취소했어'); else { const copied = await copyText(shareUrl); setShareNotice(copied ? '링크 복사 완료!' : '다시 시도해줘'); } }
    window.setTimeout(() => setShareNotice(''), 2400);
  }, [homeRuns, maxCombo, maxDistance, nickname, score]);
  const returnHome = useCallback(() => { clearTimers(); setPitch(null); setContact(null); setScreen('intro'); }, [clearTimers]);
  const pitcherImage = pitcherPhase === 'throw' || pitcherPhase === 'followThrough' ? '/utang-pitcher-follow-v2.png' : '/utang-pitcher-authentic.png';
  const catcherImage = catcherPhase === 'catch' ? '/utang-catcher-catch-v4.png' : '/utang-catcher-authentic.png';

  return <main className="game-shell"><section className="phone-stage" aria-label="우땅야구 게임 화면">
    {screen === 'intro' && <div className="intro-panel screen-panel">
      <header className="intro-topbar"><button type="button" className="intro-brand brand-home" onClick={returnHome} aria-label="우땅야구 시작 화면"><img src="/utang-sun-logo.png" alt="햇님 우땅이" /><strong>우땅야구</strong></button><button type="button" className="help-button" onClick={() => setShowHelp(true)} aria-label="게임 방법 보기"><HelpCircle size={21} /></button></header>
      <div className="intro-scene"><span className="intro-halo" aria-hidden="true" /><div className="hero-sprite" aria-hidden="true" /><span className="hero-spark spark-one">✦</span><span className="hero-spark spark-two">✦</span></div>
      <div className="intro-copy"><h1>우땅이랑 같이,<br /><em>한 방 날려볼까?</em></h1><p>10개의 공으로 오늘의 우땅왕에 도전해.</p></div>
      <form className="nickname-form" onSubmit={startGame}><label htmlFor="nickname" className="sr-only">닉네임</label><Input id="nickname" maxLength={10} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="우땅이" autoComplete="nickname" className="nickname-input" /><Button type="submit" className="start-button">PLAY BALL!</Button></form>
      <div className="intro-ranking"><div className="intro-ranking-head"><div className="ranking-title"><Trophy size={17} /> 오늘의 우땅왕</div><span>매일 00:00 · 5명씩</span></div>{records.length > 0 ? visibleRecords.map((item, index) => { const rankNumber = rankingPage * RANKING_PAGE_SIZE + index + 1; return <div className={`ranking-row rank-${rankNumber}`} key={`${item.playedAt}-${rankNumber}`}><b>{rankNumber}</b><span>{item.nickname}</span><strong>{item.score.toLocaleString()}점</strong></div>; }) : <p className="ranking-empty">오늘의 첫 기록을 세워봐!</p>}{rankingPageCount > 1 && <div className="ranking-pagination"><button type="button" onClick={() => setRankingPage((page) => Math.max(0, page - 1))} disabled={rankingPage === 0} aria-label="이전 순위"><ChevronLeft size={16} /></button><span>{rankingPage + 1} / {rankingPageCount}</span><button type="button" onClick={() => setRankingPage((page) => Math.min(rankingPageCount - 1, page + 1))} disabled={rankingPage === rankingPageCount - 1} aria-label="다음 순위"><ChevronRight size={16} /></button></div>}</div>
      {showHelp && <dialog open className="help-overlay" aria-label="게임 방법"><div className="help-card"><button type="button" className="help-close" onClick={() => setShowHelp(false)} aria-label="닫기"><X size={20} /></button><img src="/utang-sun-logo.png" alt="" /><h2>게임 방법</h2><ol><li><b>10개의 공</b>이 날아와.</li><li>공이 ABS 중앙에 가까워질 때 화면을 탭!</li><li>정확할수록 비거리와 콤보 점수가 커져.</li></ol><Button className="start-button" onClick={() => setShowHelp(false)}>알겠어!</Button></div></dialog>}
    </div>}
    {screen === 'playing' && <button type="button" className="play-field" onPointerDown={resolveSwing} aria-label="화면을 눌러 타격">
      <div className="game-hud"><span aria-hidden="true" /><div className="hud-score"><small>SCORE</small><strong>{score.toLocaleString()}</strong></div><div className="hud-pitches"><span>{String(pitchNumber).padStart(2, '0')}<small>/10</small></span><div>{Array.from({ length: TOTAL_PITCHES }, (_, index) => <i key={index} className={index < pitchNumber ? 'active' : ''} />)}</div></div><div className="combo"><Flame size={17} /><span>COMBO</span><strong>×{combo}</strong></div></div>
      <div className="stadium"><img src="/utang-stadium-v4.webp" alt="다양한 우땅이 관중들이 응원하는 야구장" className="stadium-background" /><img key={`${pitcherPhase}-${pitchNumber}`} src={pitcherImage} alt="투수 우땅이" className={`pitcher pitcher-${pitcherPhase}`} />{pitcherPhase === 'throw' && <span className="release-flash" aria-hidden="true" />}<div className="pitch-guide" aria-hidden="true" /><img src={catcherImage} alt={catcherPhase === 'catch' ? '공을 잡은 포수 우땅이' : '포수 우땅이'} className={`catcher catcher-${catcherPhase}`} />
        {!contact && <div className={`abs-zone ${pitch ? 'live' : ''}`} aria-hidden="true"><span>ABS</span>{Array.from({ length: 9 }, (_, index) => <i key={index} />)}<b className="contact-core" /></div>}
        {pitch && <div key={pitch.id} className={`baseball pitch-${pitch.type === '직구' ? 'fast' : pitch.type === '커브' ? 'curve' : 'change'}`} style={{ '--pitch-duration': `${pitch.duration}ms` } as React.CSSProperties}><img src="/baseball-official-cutout.png" alt="" /></div>}{ballFlying && <div className={`flying-ball flying-${contact?.outcome.toLowerCase()}`}><img src="/baseball-official-cutout.png" alt="" /></div>}
        <div className={`batter-shadow batter-shadow-${batterPhase}`} /><div className={`batter batter-${batterPhase} ${contact ? `batter-result-${RESULT_META[contact.outcome].tier}` : ''}`}><span className="sr-only">{contact ? `${RESULT_META[contact.outcome].label} 타격을 한 우땅이` : '타격 준비 중인 우땅이'}</span><span className="batter-visual" aria-hidden="true" />{contact && ['WHIFF', 'FOUL'].includes(contact.outcome) && <img src={RESULT_META[contact.outcome].pose} alt="" className="batter-reaction" loading="eager" decoding="sync" draggable={false} />}</div>
        {pitch && !contact && <div className="pitch-label">{pitch.type}</div>}{!pitch && !contact && !countdown && <div className="ready-label">투수 준비 중</div>}{contact && <div className={`judgment judgment-${RESULT_META[contact.outcome].tier}`}><strong>{RESULT_META[contact.outcome].label}</strong>{contact.distance > 0 && <span>{contact.distance}m · {contact.exitVelocity}km/h</span>}</div>}
        {!countdown && !contact && <div className="swing-cue"><span className="tap-ring"><i /></span><strong>탭!</strong><small>SPACE</small></div>}{countdown && <div className="countdown-overlay" aria-live="assertive"><img src="/utang-sun-logo.png" alt="준비하는 우땅이" /><span>9회말 · 10구 승부</span><strong key={countdown}>{countdown}</strong><small>{countdown === 'PLAY' ? '플레이 볼!' : '타격 준비!'}</small></div>}
      </div>
    </button>}{screen === 'playing' && <button type="button" className="hud-home" aria-label="처음 화면으로" onPointerDown={(event) => { event.stopPropagation(); returnHome(); }}><HomeIcon size={18} /></button>}
    {screen === 'result' && <div className="result-panel screen-panel"><header className="result-topbar"><button type="button" className="intro-brand brand-home" onClick={returnHome} aria-label="우땅야구 시작 화면"><img src="/utang-sun-logo.png" alt="햇님 우땅이" /><strong>우땅야구</strong></button></header><p className="badge">경기 종료</p><div className="result-character"><span className="result-burst" /><img src={resultImage} alt="경기를 마친 우땅이" className="result-image" /></div><p className="result-grade">{grade}</p><h2>{score.toLocaleString()}<small>점</small></h2><div className="result-stats"><div><span>홈런</span><strong>{homeRuns}개</strong></div><div><span>최고 비거리</span><strong>{maxDistance}m</strong></div><div><span>최고 콤보</span><strong>×{maxCombo}</strong></div></div>
      <div className="ranking-card"><div className="ranking-title"><Trophy size={16} /> 오늘의 우땅왕 TOP 3</div>{records.slice(0, 3).map((item, index) => <div className="ranking-row" key={`${item.playedAt}-${index}`}><b>{index + 1}</b><span>{item.nickname}</span><strong>{item.score.toLocaleString()}점</strong></div>)}</div><p className="result-rank">오늘 순위 <strong>{rank || '-'}위</strong> · 매일 00:00 초기화</p><div className="result-actions"><Button className="start-button" onClick={() => startGame()}><RotateCcw size={18} /> 다시 도전</Button><Button className="share-button" onClick={shareScore}>{shareNotice ? <Check size={18} /> : <Share2 size={18} />}{shareNotice || '카카오톡으로 공유'}</Button><Button variant="outline" className="home-button" onClick={returnHome}><HomeIcon size={18} /> 처음 화면으로</Button></div></div>}
  </section></main>;
}
