'use client';

/* oxlint-disable next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Flame, Home as HomeIcon, RotateCcw, Share2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Screen = 'intro' | 'playing' | 'result';
type PitchType = '직구' | '커브' | '체인지업';
type Outcome = 'WHIFF' | 'FOUL' | 'INFIELD_HIT' | 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'HOME_RUN';
type BatterPhase = 'idle' | 'ready' | 'swing' | 'followThrough';
type PitcherPhase = 'idle' | 'windup' | 'throw' | 'followThrough';
type CatcherPhase = 'idle' | 'prepare' | 'catch' | 'reaction';
type Pitch = { id: number; type: PitchType; duration: number; startedAt: number };
type RecordItem = { nickname: string; score: number; homeRuns: number; distance: number; playedAt: number };
type Contact = { outcome: Outcome; distance: number; exitVelocity: number; launchAngle: number; points: number };

const TOTAL_PITCHES = 10;
const WINDUP_MS = 820;
const CONTACT_PROGRESS = 0.9;
const PITCHES: Array<{ type: PitchType; duration: number }> = [
  { type: '직구', duration: 1650 }, { type: '커브', duration: 2000 }, { type: '체인지업', duration: 2350 },
];
const RESULT_META: Record<Outcome, { label: string; pose: string; tier: string }> = {
  WHIFF: { label: '에구구!', pose: '/utang-pose-miss-v2-cutout.png', tier: 'miss' },
  FOUL: { label: '파울!', pose: '/utang-pose-foul-cutout.png', tier: 'foul' },
  INFIELD_HIT: { label: '내야안타!', pose: '/utang-pose-good-cutout.png', tier: 'hit' },
  SINGLE: { label: '안타!', pose: '/utang-pose-good-cutout.png', tier: 'hit' },
  DOUBLE: { label: '2루타!', pose: '/utang-pose-good-cutout.png', tier: 'extra' },
  TRIPLE: { label: '3루타!', pose: '/utang-pose-good-cutout.png', tier: 'extra' },
  HOME_RUN: { label: '홈런!', pose: '/utang-pose-home-run-cutout.png', tier: 'homer' },
};

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function calculateContact(progress: number): Contact {
  const error = Math.abs(progress - CONTACT_PROGRESS);
  if (error > 0.245) return { outcome: 'WHIFF', distance: 0, exitVelocity: 0, launchAngle: 0, points: 0 };
  if (error > 0.178) return { outcome: 'FOUL', distance: 0, exitVelocity: 78, launchAngle: 48, points: 180 };
  const quality = clamp(1 - error / 0.178, 0, 1);
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
async function createShareCard(name: string, score: number, homeRuns: number, maxDistance: number, maxCombo: number, pose: string) {
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630;
  const context = canvas.getContext('2d'); if (!context) return null;
  const gradient = context.createLinearGradient(0, 0, 1200, 630); gradient.addColorStop(0, '#082f68'); gradient.addColorStop(.56, '#1768c5'); gradient.addColorStop(1, '#f6bd2d');
  context.fillStyle = gradient; context.fillRect(0, 0, 1200, 630);
  context.fillStyle = 'rgba(255,255,255,.12)'; context.beginPath(); context.arc(1010, 90, 380, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#77b94b'; context.beginPath(); context.ellipse(600, 650, 790, 230, 0, 0, Math.PI * 2); context.fill();
  context.strokeStyle = 'rgba(255,255,255,.7)'; context.lineWidth = 8; context.beginPath(); context.moveTo(575, 630); context.lineTo(895, 388); context.lineTo(1190, 630); context.stroke();
  try {
    const [logo, character] = await Promise.all([loadImage('/utang-sun-logo.png'), loadImage(pose)]);
    context.save(); context.beginPath(); context.arc(96, 90, 55, 0, Math.PI * 2); context.clip(); context.drawImage(logo, 41, 35, 110, 110); context.restore();
    context.drawImage(character, 750, 148, 390, 390);
  } catch { /* A text-only fallback is still shareable. */ }
  context.fillStyle = '#fff'; context.font = '900 38px sans-serif'; context.fillText('우땅야구', 175, 83);
  context.fillStyle = '#ffe15c'; context.font = '900 24px sans-serif'; context.fillText('UTANG BASEBALL · 10구 승부', 176, 119);
  context.fillStyle = '#fff'; context.font = '900 38px sans-serif'; context.fillText(`${name} 선수의 기록`, 70, 228);
  context.font = '900 92px sans-serif'; context.fillText(score.toLocaleString(), 68, 334); context.font = '900 34px sans-serif'; context.fillText('점', 465, 333);
  context.fillStyle = 'rgba(3,28,68,.72)'; context.roundRect(65, 380, 610, 124, 28); context.fill();
  context.fillStyle = '#fff'; context.font = '800 27px sans-serif'; context.fillText(`홈런  ${homeRuns}개`, 102, 430); context.fillText(`최고 비거리  ${maxDistance}m`, 330, 430); context.fillText(`최고 콤보  ×${maxCombo}`, 102, 478);
  context.fillStyle = '#ffe15c'; context.font = '800 24px sans-serif'; context.fillText('utangbaseball.cloud', 70, 570);
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', .94));
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>('intro'); const [nickname, setNickname] = useState('');
  const [pitchNumber, setPitchNumber] = useState(0); const [pitch, setPitch] = useState<Pitch | null>(null);
  const [pitcherPhase, setPitcherPhase] = useState<PitcherPhase>('idle'); const [batterPhase, setBatterPhase] = useState<BatterPhase>('idle'); const [catcherPhase, setCatcherPhase] = useState<CatcherPhase>('idle');
  const [score, setScore] = useState(0); const [combo, setCombo] = useState(0); const [maxCombo, setMaxCombo] = useState(0);
  const [homeRuns, setHomeRuns] = useState(0); const [maxDistance, setMaxDistance] = useState(0); const [contact, setContact] = useState<Contact | null>(null);
  const [ballFlying, setBallFlying] = useState(false); const [records, setRecords] = useState<RecordItem[]>([]); const [shareNotice, setShareNotice] = useState('');
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]); const statsRef = useRef({ score: 0, homeRuns: 0, maxDistance: 0, maxCombo: 0 });
  const schedule = useCallback((callback: () => void, delay: number) => { const timer = setTimeout(callback, delay); timersRef.current.push(timer); return timer; }, []);
  const clearTimers = useCallback(() => { timersRef.current.forEach(clearTimeout); timersRef.current = []; }, []);

  useEffect(() => {
    const localTimer = window.setTimeout(() => setRecords(loadRecords()), 80);
    fetch('/api/scores?period=daily').then((r) => r.ok ? r.json() as Promise<{ records?: RecordItem[] }> : null).then((data) => { if (Array.isArray(data?.records)) setRecords(data.records); }).catch(() => undefined);
    return () => window.clearTimeout(localTimer);
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
    setScore(0); setCombo(0); setMaxCombo(0); setHomeRuns(0); setMaxDistance(0); setShareNotice(''); setScreen('playing'); queuePitch(1);
  }, [clearTimers, nickname, queuePitch]);
  const resolveSwing = useCallback(() => {
    if (screen !== 'playing' || !pitch || batterPhase === 'swing' || contact) return;
    clearTimers(); setBatterPhase('swing'); setPitcherPhase('followThrough'); const progress = clamp((performance.now() - pitch.startedAt) / pitch.duration, 0, 1.14); const nextContact = calculateContact(progress);
    const keepsCombo = !['WHIFF', 'FOUL'].includes(nextContact.outcome); const nextCombo = keepsCombo ? combo + 1 : 0; const nextMaxCombo = Math.max(maxCombo, nextCombo);
    const earned = Math.round(nextContact.points * (1 + Math.min(nextCombo, 20) * .1)); const nextScore = score + earned;
    const nextHomeRuns = homeRuns + (nextContact.outcome === 'HOME_RUN' ? 1 : 0); const nextMaxDistance = Math.max(maxDistance, nextContact.distance);
    statsRef.current = { score: nextScore, homeRuns: nextHomeRuns, maxDistance: nextMaxDistance, maxCombo: nextMaxCombo };
    setContact(nextContact); setCombo(nextCombo); setMaxCombo(nextMaxCombo); setScore(nextScore); setHomeRuns(nextHomeRuns); setMaxDistance(nextMaxDistance); setBallFlying(!['WHIFF', 'FOUL'].includes(nextContact.outcome)); setCatcherPhase(nextContact.outcome === 'WHIFF' ? 'catch' : 'reaction');
    schedule(() => setBatterPhase('followThrough'), 260); schedule(() => { setPitch(null); if (pitchNumber >= TOTAL_PITCHES) finishGame(nextScore, nextHomeRuns, nextMaxDistance); else queuePitch(pitchNumber + 1); }, nextContact.outcome === 'HOME_RUN' ? 1550 : 1120);
  }, [batterPhase, clearTimers, combo, contact, finishGame, homeRuns, maxCombo, maxDistance, pitch, pitchNumber, queuePitch, schedule, score, screen]);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.code === 'Space') { event.preventDefault(); resolveSwing(); } }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, [resolveSwing]);

  const rank = useMemo(() => records.findIndex((item) => item.nickname === (nickname.trim() || '우땅이') && item.score === score) + 1, [nickname, records, score]);
  const grade = score >= 50000 ? '전설의 우땅이' : score >= 30000 ? '홈런왕 우땅이' : score >= 15000 ? '주전 우땅이' : score >= 5000 ? '동네 야구 우땅이' : '야구공 구경 온 우땅이';
  const batterImage = contact ? RESULT_META[contact.outcome].pose : '/utang-pose-good-cutout.png'; const resultImage = homeRuns > 0 ? '/utang-pose-home-run-cutout.png' : score >= 5000 ? '/utang-pose-good-cutout.png' : '/utang-pose-miss-v2-cutout.png';
  const shareScore = useCallback(async () => {
    const url = 'https://utangbaseball.cloud'; const name = nickname.trim() || '우땅이'; const text = `${name}의 우땅야구 기록 ${score.toLocaleString()}점! 홈런 ${homeRuns}개 · 최고 비거리 ${maxDistance}m ⚾`;
    setShareNotice('이미지 만드는 중…');
    try {
      const blob = await createShareCard(name, score, homeRuns, maxDistance, maxCombo, resultImage); const file = blob ? new File([blob], `우땅야구-${score}점.png`, { type: 'image/png' }) : null;
      const data = file && navigator.canShare?.({ files: [file] }) ? { title: '우땅야구 기록', text, url, files: [file] } : { title: '우땅야구 기록', text, url };
      if (typeof navigator.share === 'function') { await navigator.share(data); setShareNotice('공유 완료!'); } else { const copied = await copyText(`${text}\n${url}`); setShareNotice(copied ? '기록과 링크 복사 완료!' : '복사하지 못했어'); }
    } catch (error) { if ((error as DOMException).name === 'AbortError') setShareNotice('공유를 취소했어'); else { const copied = await copyText(`${text}\n${url}`); setShareNotice(copied ? '기록과 링크 복사 완료!' : '다시 시도해줘'); } }
    window.setTimeout(() => setShareNotice(''), 2400);
  }, [homeRuns, maxCombo, maxDistance, nickname, resultImage, score]);
  const returnHome = useCallback(() => { clearTimers(); setPitch(null); setContact(null); setScreen('intro'); }, [clearTimers]);
  const pitcherImage = pitcherPhase === 'throw' || pitcherPhase === 'followThrough' ? '/utang-pitcher-release-v2-cutout.png' : '/utang-pitcher-ready-v2-cutout.png';

  return <main className="game-shell"><section className="phone-stage" aria-label="우땅야구 게임 화면">
    <header className="game-header"><div className="header-brand"><img src="/utang-sun-logo.png" alt="" className="header-logo" /><div><h1>우땅야구</h1><span>UTANG BASEBALL</span></div></div><div className="mini-score"><span>SCORE</span><strong>{score.toLocaleString()}</strong></div></header>
    {screen === 'intro' && <div className="intro-panel screen-panel"><div className="intro-hero-row"><div className="hero-utang" aria-hidden="true"><span className="hero-sun" /><span className="hero-ground" /><img src="/utang-pose-good-cutout.png" alt="" className="hero-image" /><i>✦</i><i>✦</i></div><div className="intro-copy"><p className="badge">야구선수 우땅이!</p><h2>딱 맞는 순간,<br /><em>시원하게 날려봐!</em></h2><p>공이 ABS 중앙에 겹칠 때 화면을 탭해.<br />PC에서는 스페이스바!</p></div></div>
      <form className="nickname-form" onSubmit={startGame}><label htmlFor="nickname">선수 이름</label><div className="nickname-controls"><Input id="nickname" maxLength={10} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="우땅이" autoComplete="nickname" className="nickname-input" /><Button type="submit" className="start-button">경기 시작</Button></div></form>
      <div className="intro-ranking"><div className="intro-ranking-head"><div className="ranking-title"><Trophy size={16} /> 오늘의 우땅왕</div><span>매일 00:00 초기화 · TOP 5</span></div>{records.length > 0 ? records.slice(0, 5).map((item, index) => <div className={`ranking-row rank-${index + 1}`} key={`${item.playedAt}-${index}`}><b>{index + 1}</b><span>{item.nickname}</span><strong>{item.score.toLocaleString()}점</strong></div>) : <p className="ranking-empty">오늘의 첫 기록을 세워봐!</p>}</div></div>}
    {screen === 'playing' && <button type="button" className="play-field" onPointerDown={resolveSwing} aria-label="화면을 눌러 타격"><div className="status-row"><div className="inning-card"><span>9회말</span><b>ONE OUT</b></div><div className="pitch-progress"><div className="pitch-count"><span>PITCH</span><strong>{String(pitchNumber).padStart(2, '0')}</strong><small>/ {TOTAL_PITCHES}</small></div><div className="pitch-dots" aria-hidden="true">{Array.from({ length: TOTAL_PITCHES }, (_, index) => <i key={index} className={index < pitchNumber ? 'active' : ''} />)}</div></div><div className="combo"><Flame size={15} /><span>COMBO</span><strong>×{combo}</strong></div></div>
      <div className="stadium"><img src="/utang-stadium-v3.png" alt="우땅이 관중들이 응원하는 야구장" className="stadium-background" /><img key={`${pitcherPhase}-${pitchNumber}`} src={pitcherImage} alt="투수 우땅이" className={`pitcher pitcher-${pitcherPhase}`} /><div className="pitch-guide" aria-hidden="true" /><img src="/utang-catcher-v2-cutout.png" alt="포수 우땅이" className={`catcher catcher-${catcherPhase}`} />
        <div className={`abs-zone ${pitch && !contact ? 'live' : ''}`} aria-hidden="true"><span>ABS</span>{Array.from({ length: 9 }, (_, index) => <i key={index} />)}<b className="contact-core" /></div>
        {pitch && <div key={pitch.id} className={`baseball pitch-${pitch.type === '직구' ? 'fast' : pitch.type === '커브' ? 'curve' : 'change'}`} style={{ '--pitch-duration': `${pitch.duration}ms` } as React.CSSProperties}><img src="/baseball-official-cutout.png" alt="" /></div>}{ballFlying && <div className={`flying-ball flying-${contact?.outcome.toLowerCase()}`}><img src="/baseball-official-cutout.png" alt="" /></div>}
        <div className={`batter-shadow batter-shadow-${batterPhase}`} /><img key={batterImage} src={batterImage} alt={contact ? `${RESULT_META[contact.outcome].label} 반응을 하는 우땅이` : '타석에 선 우땅이'} className={`batter batter-${batterPhase} ${contact ? `batter-result-${RESULT_META[contact.outcome].tier}` : ''}`} />
        {pitch && !contact && <div className="pitch-label">{pitch.type}</div>}{!pitch && !contact && <div className="ready-label">투수가 준비 중!</div>}{contact && <div className={`judgment judgment-${RESULT_META[contact.outcome].tier}`}><strong>{RESULT_META[contact.outcome].label}</strong>{contact.distance > 0 && <span>{contact.distance}m · {contact.exitVelocity}km/h</span>}</div>}<div className="contact-hint">노란 원에 공이 들어오면 스윙!</div></div>
      <div className="tap-guide"><span className="tap-ring"><i /></span><strong>화면을 탭해서 스윙</strong><small>SPACE</small></div></button>}
    {screen === 'result' && <div className="result-panel screen-panel"><p className="badge">경기 종료</p><div className="result-character"><span className="result-burst" /><img src={resultImage} alt="경기를 마친 우땅이" className="result-image" /></div><p className="result-grade">{grade}</p><h2>{score.toLocaleString()}<small>점</small></h2><div className="result-stats"><div><span>홈런</span><strong>{homeRuns}개</strong></div><div><span>최고 비거리</span><strong>{maxDistance}m</strong></div><div><span>최고 콤보</span><strong>×{maxCombo}</strong></div></div>
      <div className="ranking-card"><div className="ranking-title"><Trophy size={16} /> 오늘의 우땅왕 TOP 3</div>{records.slice(0, 3).map((item, index) => <div className="ranking-row" key={`${item.playedAt}-${index}`}><b>{index + 1}</b><span>{item.nickname}</span><strong>{item.score.toLocaleString()}점</strong></div>)}</div><p className="result-rank">오늘 순위 <strong>{rank || '-'}위</strong> · 매일 00:00 초기화</p><div className="result-actions"><Button className="start-button" onClick={() => startGame()}><RotateCcw size={18} /> 다시 도전</Button><Button className="share-button" onClick={shareScore}>{shareNotice ? <Check size={18} /> : <Share2 size={18} />}{shareNotice || '카카오톡으로 공유'}</Button><Button variant="outline" className="home-button" onClick={returnHome}><HomeIcon size={18} /> 처음 화면으로</Button></div></div>}
  </section></main>;
}
