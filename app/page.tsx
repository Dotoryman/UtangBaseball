'use client';

/* oxlint-disable next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Flame, HelpCircle, Home as HomeIcon, RotateCcw, Share2, Trophy, X } from 'lucide-react';
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
const WINDUP_MS = 760;
const CONTACT_PROGRESS = 0.84;
const PITCHES: Array<{ type: PitchType; duration: number }> = [
  { type: '직구', duration: 1500 }, { type: '커브', duration: 1780 }, { type: '체인지업', duration: 2050 },
];
const RESULT_META: Record<Outcome, { label: string; pose: string; tier: string }> = {
  WHIFF: { label: '에구구!', pose: '/utang-pose-miss-authentic.png', tier: 'miss' },
  FOUL: { label: '파울!', pose: '/utang-pose-foul-authentic.png', tier: 'foul' },
  INFIELD_HIT: { label: '내야안타!', pose: '/utang-pose-good-authentic.png', tier: 'hit' },
  SINGLE: { label: '안타!', pose: '/utang-pose-good-authentic.png', tier: 'hit' },
  DOUBLE: { label: '2루타!', pose: '/utang-pose-good-authentic.png', tier: 'extra' },
  TRIPLE: { label: '3루타!', pose: '/utang-pose-good-authentic.png', tier: 'extra' },
  HOME_RUN: { label: '홈런!', pose: '/utang-batter-v8-follow.png', tier: 'homer' },
};
const BATTER_FRAMES = [
  '/utang-batter-v8-ready.png',
  '/utang-batter-v8-load.png',
  '/utang-batter-v8-stride.png',
  '/utang-batter-v8-start.png',
  '/utang-batter-v8-mid.png',
  '/utang-batter-v8-contact.png',
  '/utang-batter-v8-extension.png',
  '/utang-batter-v8-follow.png',
];

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function calculateContact(progress: number): Contact {
  const error = Math.abs(progress - CONTACT_PROGRESS);
  if (error > 0.3) return { outcome: 'WHIFF', distance: 0, exitVelocity: 0, launchAngle: 0, points: 0 };
  if (error > 0.21) return { outcome: 'FOUL', distance: 0, exitVelocity: 78, launchAngle: 48, points: 180 };
  const quality = clamp(1 - error / 0.21, 0, 1);
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
    const background = await loadImage('/utang-share-card-v3-bg.png');
    context.drawImage(background, 0, 0, 1200, 630);
  } catch {
    const fallback = context.createLinearGradient(0, 0, 1200, 630); fallback.addColorStop(0, '#071c46'); fallback.addColorStop(1, '#164f9e');
    context.fillStyle = fallback; context.fillRect(0, 0, 1200, 630);
  }
  context.textBaseline = 'alphabetic';
  context.fillStyle = '#ffcf45'; context.font = '900 24px "Malgun Gothic", sans-serif'; context.fillText('UTANG BASEBALL · FINAL SCORE', 118, 154);
  context.fillStyle = '#fff'; context.font = '900 43px "Malgun Gothic", sans-serif'; context.fillText(`${name} 선수의 10구 승부`, 118, 214);
  context.fillStyle = '#fff'; context.font = '900 104px "Arial Black", "Malgun Gothic", sans-serif'; context.fillText(score.toLocaleString(), 112, 330);
  const scoreWidth = context.measureText(score.toLocaleString()).width;
  context.fillStyle = '#ffcf45'; context.font = '900 36px "Malgun Gothic", sans-serif'; context.fillText('점', 125 + scoreWidth, 326);
  context.strokeStyle = 'rgba(255,255,255,.16)'; context.lineWidth = 2; context.beginPath(); context.moveTo(118, 365); context.lineTo(755, 365); context.stroke();
  context.fillStyle = '#b9d7ff'; context.font = '800 22px "Malgun Gothic", sans-serif'; context.fillText('홈런', 120, 410); context.fillText('최고 비거리', 325, 410); context.fillText('최고 콤보', 555, 410);
  context.fillStyle = '#fff'; context.font = '900 35px "Malgun Gothic", sans-serif'; context.fillText(`${homeRuns}개`, 120, 456); context.fillText(`${maxDistance}m`, 325, 456); context.fillText(`×${maxCombo}`, 555, 456);
  context.fillStyle = '#ffcf45'; context.font = '800 23px "Malgun Gothic", sans-serif'; context.fillText('utangbaseball.cloud', 118, 535);
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
  const [showHelp, setShowHelp] = useState(false);
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
      ...BATTER_FRAMES,
      '/utang-pitcher-authentic.png',
      '/utang-catcher-authentic.png',
      '/utang-pose-good-authentic.png',
      '/utang-pose-miss-authentic.png',
      '/utang-pose-foul-authentic.png',
      '/baseball-official-cutout.png',
      '/utang-stadium-v4.webp',
    ];
    characterAssets.forEach((src) => { const image = new Image(); image.src = src; });
  }, []);
  useEffect(() => clearTimers, [clearTimers]);
  const finishGame = useCallback((finalScore: number, finalHomeRuns: number, finalDistance: number) => {
    const record: RecordItem = { nickname: nickname.trim() || '우땅이', score: finalScore, homeRuns: finalHomeRuns, distance: finalDistance, playedAt: Date.now() };
    const nextRecords = [...loadRecords(), record].sort((a, b) => b.score - a.score).slice(0, 10); localStorage.setItem('utang-baseball-records', JSON.stringify(nextRecords)); setRecords(nextRecords);
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
        setPitch(null); setContact({ outcome: 'WHIFF', distance: 0, exitVelocity: 0, launchAngle: 0, points: 0 }); setCombo(0); setBatterPhase('followThrough'); setCatcherPhase('catch'); schedule(() => setCatcherPhase('reaction'), 260);
        schedule(() => { const current = statsRef.current; if (nextNumber >= TOTAL_PITCHES) finishGame(current.score, current.homeRuns, current.maxDistance); else queuePitch(nextNumber + 1); }, 1020);
      }, nextPitch.duration + 190);
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
    clearTimers(); setBatterPhase('swing'); setPitcherPhase('followThrough'); const progress = clamp((performance.now() - pitch.startedAt) / pitch.duration, 0, 1.14); const nextContact = calculateContact(progress);
    const keepsCombo = !['WHIFF', 'FOUL'].includes(nextContact.outcome); const nextCombo = keepsCombo ? combo + 1 : 0; const nextMaxCombo = Math.max(maxCombo, nextCombo);
    const earned = Math.round(nextContact.points * (1 + Math.min(nextCombo, 20) * .1)); const nextScore = score + earned;
    const nextHomeRuns = homeRuns + (nextContact.outcome === 'HOME_RUN' ? 1 : 0); const nextMaxDistance = Math.max(maxDistance, nextContact.distance);
    statsRef.current = { score: nextScore, homeRuns: nextHomeRuns, maxDistance: nextMaxDistance, maxCombo: nextMaxCombo };
    setContact(nextContact); setCombo(nextCombo); setMaxCombo(nextMaxCombo); setScore(nextScore); setHomeRuns(nextHomeRuns); setMaxDistance(nextMaxDistance); setBallFlying(!['WHIFF', 'FOUL'].includes(nextContact.outcome)); setCatcherPhase(nextContact.outcome === 'WHIFF' ? 'catch' : 'reaction');
    schedule(() => setBatterPhase('followThrough'), 260); schedule(() => { setPitch(null); if (pitchNumber >= TOTAL_PITCHES) finishGame(nextScore, nextHomeRuns, nextMaxDistance); else queuePitch(pitchNumber + 1); }, nextContact.outcome === 'HOME_RUN' ? 1550 : 1120);
  }, [batterPhase, clearTimers, combo, contact, countdown, finishGame, homeRuns, maxCombo, maxDistance, pitch, pitchNumber, queuePitch, schedule, score, screen]);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.code === 'Space') { event.preventDefault(); resolveSwing(); } }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, [resolveSwing]);

  const rank = useMemo(() => records.findIndex((item) => item.nickname === (nickname.trim() || '우땅이') && item.score === score) + 1, [nickname, records, score]);
  const grade = score >= 50000 ? '전설의 우땅이' : score >= 30000 ? '홈런왕 우땅이' : score >= 15000 ? '주전 우땅이' : score >= 5000 ? '동네 야구 우땅이' : '야구공 구경 온 우땅이';
  const resultImage = homeRuns > 0 ? '/utang-batter-v8-follow.png' : score >= 5000 ? '/utang-pose-good-authentic.png' : '/utang-pose-miss-authentic.png';
  const shareScore = useCallback(async () => {
    const url = 'https://utangbaseball.cloud'; const name = nickname.trim() || '우땅이'; const text = `${name}의 우땅야구 기록 ${score.toLocaleString()}점! 홈런 ${homeRuns}개 · 최고 비거리 ${maxDistance}m ⚾`;
    setShareNotice('이미지 만드는 중…');
    try {
      const blob = await createShareCard(name, score, homeRuns, maxDistance, maxCombo); const file = blob ? new File([blob], `우땅야구-${score}점.png`, { type: 'image/png' }) : null;
      const data = file && navigator.canShare?.({ files: [file] }) ? { title: '우땅야구 기록', text, url, files: [file] } : { title: '우땅야구 기록', text, url };
      if (typeof navigator.share === 'function') { await navigator.share(data); setShareNotice('공유 완료!'); } else { const copied = await copyText(`${text}\n${url}`); setShareNotice(copied ? '기록과 링크 복사 완료!' : '복사하지 못했어'); }
    } catch (error) { if ((error as DOMException).name === 'AbortError') setShareNotice('공유를 취소했어'); else { const copied = await copyText(`${text}\n${url}`); setShareNotice(copied ? '기록과 링크 복사 완료!' : '다시 시도해줘'); } }
    window.setTimeout(() => setShareNotice(''), 2400);
  }, [homeRuns, maxCombo, maxDistance, nickname, score]);
  const returnHome = useCallback(() => { clearTimers(); setPitch(null); setContact(null); setScreen('intro'); }, [clearTimers]);
  const pitcherImage = pitcherPhase === 'throw' || pitcherPhase === 'followThrough' ? '/utang-pitcher-follow-authentic.png' : '/utang-pitcher-authentic.png';

  return <main className="game-shell"><section className="phone-stage" aria-label="우땅야구 게임 화면">
    {screen === 'intro' && <div className="intro-panel screen-panel">
      <header className="intro-topbar"><div className="intro-brand"><img src="/utang-sun-logo.png" alt="" /><strong>우땅야구</strong></div><button type="button" className="help-button" onClick={() => setShowHelp(true)} aria-label="게임 방법 보기"><HelpCircle size={21} /></button></header>
      <div className="intro-scene"><span className="intro-halo" aria-hidden="true" /><div className="hero-sprite" aria-hidden="true">{BATTER_FRAMES.map((src, index) => <img key={src} src={src} alt="" className={`hero-image hero-frame-${index + 1}`} />)}</div><span className="hero-spark spark-one">✦</span><span className="hero-spark spark-two">✦</span></div>
      <div className="intro-copy"><h1>딱 맞는 순간,<br /><em>날려버려!</em></h1><p>10개의 공으로 오늘의 우땅왕에 도전해.</p></div>
      <form className="nickname-form" onSubmit={startGame}><label htmlFor="nickname" className="sr-only">닉네임</label><Input id="nickname" maxLength={10} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="우땅이" autoComplete="nickname" className="nickname-input" /><Button type="submit" className="start-button">PLAY BALL!</Button></form>
      <div className="intro-ranking"><div className="intro-ranking-head"><div className="ranking-title"><Trophy size={17} /> 오늘의 우땅왕</div><span>매일 00:00 · TOP 5</span></div>{records.length > 0 ? records.slice(0, 5).map((item, index) => <div className={`ranking-row rank-${index + 1}`} key={`${item.playedAt}-${index}`}><b>{index + 1}</b><span>{item.nickname}</span><strong>{item.score.toLocaleString()}점</strong></div>) : <p className="ranking-empty">오늘의 첫 기록을 세워봐!</p>}</div>
      {showHelp && <dialog open className="help-overlay" aria-label="게임 방법"><div className="help-card"><button type="button" className="help-close" onClick={() => setShowHelp(false)} aria-label="닫기"><X size={20} /></button><img src="/utang-sun-logo.png" alt="" /><h2>게임 방법</h2><ol><li><b>10개의 공</b>이 날아와.</li><li>공이 ABS 중앙에 가까워질 때 화면을 탭!</li><li>정확할수록 비거리와 콤보 점수가 커져.</li></ol><Button className="start-button" onClick={() => setShowHelp(false)}>알겠어!</Button></div></dialog>}
    </div>}
    {screen === 'playing' && <button type="button" className="play-field" onPointerDown={resolveSwing} aria-label="화면을 눌러 타격">
      <div className="game-hud"><span aria-hidden="true" /><div className="hud-score"><small>SCORE</small><strong>{score.toLocaleString()}</strong></div><div className="hud-pitches"><span>{String(pitchNumber).padStart(2, '0')}<small>/10</small></span><div>{Array.from({ length: TOTAL_PITCHES }, (_, index) => <i key={index} className={index < pitchNumber ? 'active' : ''} />)}</div></div><div className="combo"><Flame size={17} /><span>COMBO</span><strong>×{combo}</strong></div></div>
      <div className="stadium"><img src="/utang-stadium-v4.webp" alt="다양한 우땅이 관중들이 응원하는 야구장" className="stadium-background" /><img key={`${pitcherPhase}-${pitchNumber}`} src={pitcherImage} alt="투수 우땅이" className={`pitcher pitcher-${pitcherPhase}`} />{pitcherPhase === 'throw' && <span className="release-flash" aria-hidden="true" />}<div className="pitch-guide" aria-hidden="true" /><img src="/utang-catcher-authentic.png" alt="포수 우땅이" className={`catcher catcher-${catcherPhase}`} />
        {!contact && <div className={`abs-zone ${pitch ? 'live' : ''}`} aria-hidden="true"><span>ABS</span>{Array.from({ length: 9 }, (_, index) => <i key={index} />)}<b className="contact-core" /></div>}
        {pitch && <div key={pitch.id} className={`baseball pitch-${pitch.type === '직구' ? 'fast' : pitch.type === '커브' ? 'curve' : 'change'}`} style={{ '--pitch-duration': `${pitch.duration}ms` } as React.CSSProperties}><img src="/baseball-official-cutout.png" alt="" /></div>}{ballFlying && <div className={`flying-ball flying-${contact?.outcome.toLowerCase()}`}><img src="/baseball-official-cutout.png" alt="" /></div>}
        <div className={`batter-shadow batter-shadow-${batterPhase}`} /><div className={`batter batter-${batterPhase} ${contact ? `batter-result-${RESULT_META[contact.outcome].tier}` : ''}`}><span className="sr-only">{contact ? `${RESULT_META[contact.outcome].label} 타격을 한 우땅이` : '타격 준비 중인 우땅이'}</span>{BATTER_FRAMES.map((src, index) => <img key={src} src={src} alt="" className={`batter-frame batter-frame-${index + 1}`} loading="eager" decoding="sync" draggable={false} />)}{contact && ['WHIFF', 'FOUL'].includes(contact.outcome) && <img src={RESULT_META[contact.outcome].pose} alt="" className="batter-reaction" loading="eager" decoding="sync" draggable={false} />}</div>
        {pitch && !contact && <div className="pitch-label">{pitch.type}</div>}{!pitch && !contact && !countdown && <div className="ready-label">투수 준비 중</div>}{contact && <div className={`judgment judgment-${RESULT_META[contact.outcome].tier}`}><strong>{RESULT_META[contact.outcome].label}</strong>{contact.distance > 0 && <span>{contact.distance}m · {contact.exitVelocity}km/h</span>}</div>}
        {!countdown && !contact && <div className="swing-cue"><span className="tap-ring"><i /></span><strong>탭!</strong><small>SPACE</small></div>}{countdown && <div className="countdown-overlay" aria-live="assertive"><span>9회말 · 10구 승부</span><strong key={countdown}>{countdown}</strong><small>{countdown === 'PLAY' ? '플레이 볼!' : '타격 준비!'}</small></div>}
      </div>
    </button>}{screen === 'playing' && <button type="button" className="hud-home" aria-label="처음 화면으로" onPointerDown={(event) => { event.stopPropagation(); returnHome(); }}><HomeIcon size={18} /></button>}
    {screen === 'result' && <div className="result-panel screen-panel"><header className="result-topbar"><div className="intro-brand"><img src="/utang-sun-logo.png" alt="" /><strong>우땅야구</strong></div></header><p className="badge">경기 종료</p><div className="result-character"><span className="result-burst" /><img src={resultImage} alt="경기를 마친 우땅이" className="result-image" /></div><p className="result-grade">{grade}</p><h2>{score.toLocaleString()}<small>점</small></h2><div className="result-stats"><div><span>홈런</span><strong>{homeRuns}개</strong></div><div><span>최고 비거리</span><strong>{maxDistance}m</strong></div><div><span>최고 콤보</span><strong>×{maxCombo}</strong></div></div>
      <div className="ranking-card"><div className="ranking-title"><Trophy size={16} /> 오늘의 우땅왕 TOP 3</div>{records.slice(0, 3).map((item, index) => <div className="ranking-row" key={`${item.playedAt}-${index}`}><b>{index + 1}</b><span>{item.nickname}</span><strong>{item.score.toLocaleString()}점</strong></div>)}</div><p className="result-rank">오늘 순위 <strong>{rank || '-'}위</strong> · 매일 00:00 초기화</p><div className="result-actions"><Button className="start-button" onClick={() => startGame()}><RotateCcw size={18} /> 다시 도전</Button><Button className="share-button" onClick={shareScore}>{shareNotice ? <Check size={18} /> : <Share2 size={18} />}{shareNotice || '카카오톡으로 공유'}</Button><Button variant="outline" className="home-button" onClick={returnHome}><HomeIcon size={18} /> 처음 화면으로</Button></div></div>}
  </section></main>;
}
