'use client';

/* oxlint-disable next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Flame, RotateCcw, Share2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Screen = 'intro' | 'playing' | 'result';
type PitchType = '직구' | '커브' | '체인지업';
type Judgment = 'MISS' | 'FOUL' | 'GOOD' | 'PERFECT' | 'HOME RUN';
type Pitch = {
  id: number;
  type: PitchType;
  duration: number;
  startedAt: number;
};
type RecordItem = {
  nickname: string;
  score: number;
  homeRuns: number;
  distance: number;
  playedAt: number;
};

const TOTAL_PITCHES = 10;
const PITCHES: Array<{ type: PitchType; duration: number }> = [
  { type: '직구', duration: 1280 },
  { type: '커브', duration: 1620 },
  { type: '체인지업', duration: 1950 },
];
function loadRecords(): RecordItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('utang-baseball-records') ?? '[]');
  } catch {
    return [];
  }
}

const POSE_BY_JUDGMENT: Record<Judgment, string> = {
  MISS: '/utang-pose-miss-v2-cutout.png',
  FOUL: '/utang-pose-foul-cutout.png',
  GOOD: '/utang-pose-good-cutout.png',
  PERFECT: '/utang-pose-good-cutout.png',
  'HOME RUN': '/utang-pose-home-run-cutout.png',
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>('intro');
  const [nickname, setNickname] = useState('');
  const [pitchNumber, setPitchNumber] = useState(0);
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [homeRuns, setHomeRuns] = useState(0);
  const [maxDistance, setMaxDistance] = useState(0);
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [lastDistance, setLastDistance] = useState(0);
  const [isSwinging, setIsSwinging] = useState(false);
  const [ballFlying, setBallFlying] = useState(false);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [shareNotice, setShareNotice] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const localRecordsTimer = window.setTimeout(
      () => setRecords(loadRecords()),
      100,
    );
    fetch('/api/scores?period=all')
      .then((response) =>
        response.ok
          ? (response.json() as Promise<{ records?: RecordItem[] }>)
          : null,
      )
      .then((data) => {
        if (Array.isArray(data?.records)) setRecords(data.records);
      })
      .catch(() => undefined);
    return () => window.clearTimeout(localRecordsTimer);
  }, []);
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const finishGame = useCallback(
    (finalScore: number, finalHomeRuns: number, finalDistance: number) => {
      const nextRecord: RecordItem = {
        nickname: nickname.trim() || '우땅이',
        score: finalScore,
        homeRuns: finalHomeRuns,
        distance: finalDistance,
        playedAt: Date.now(),
      };
      const nextRecords = [...loadRecords(), nextRecord]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      localStorage.setItem(
        'utang-baseball-records',
        JSON.stringify(nextRecords),
      );
      setRecords(nextRecords);
      setScreen('result');
      fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextRecord),
      })
        .then((response) =>
          response.ok
            ? (response.json() as Promise<{ records?: RecordItem[] }>)
            : null,
        )
        .then((data) => {
          if (Array.isArray(data?.records)) setRecords(data.records);
        })
        .catch(() => undefined);
    },
    [nickname],
  );

  const queuePitch = useCallback(
    (nextNumber: number) => {
      setPitchNumber(nextNumber);
      setJudgment(null);
      setLastDistance(0);
      setBallFlying(false);
      setIsSwinging(false);
      const config = PITCHES[Math.floor(Math.random() * PITCHES.length)];
      const nextPitch: Pitch = {
        id: Date.now() + Math.random(),
        type: config.type,
        duration: config.duration,
        startedAt: performance.now() + 650,
      };
      timeoutRef.current = setTimeout(() => {
        setPitch(nextPitch);
        timeoutRef.current = setTimeout(() => {
          setJudgment('MISS');
          setCombo(0);
          setIsSwinging(true);
          timeoutRef.current = setTimeout(() => {
            setPitch(null);
            if (nextNumber >= TOTAL_PITCHES) {
              setScore((currentScore) => {
                setHomeRuns((currentHomeRuns) => {
                  setMaxDistance((currentDistance) => {
                    finishGame(currentScore, currentHomeRuns, currentDistance);
                    return currentDistance;
                  });
                  return currentHomeRuns;
                });
                return currentScore;
              });
            } else queuePitch(nextNumber + 1);
          }, 900);
        }, nextPitch.duration + 120);
      }, 650);
    },
    [finishGame],
  );

  const startGame = useCallback(
    (event?: { preventDefault(): void }) => {
      event?.preventDefault();
      if (!nickname.trim()) setNickname('우땅이');
      clearTimers();
      setScore(0);
      setCombo(0);
      setHomeRuns(0);
      setMaxDistance(0);
      setScreen('playing');
      queuePitch(1);
    },
    [clearTimers, nickname, queuePitch],
  );

  const resolveSwing = useCallback(() => {
    if (screen !== 'playing' || !pitch || isSwinging || judgment) return;
    clearTimers();
    setIsSwinging(true);
    const progress = Math.max(
      0,
      Math.min(1, (performance.now() - pitch.startedAt) / pitch.duration),
    );
    const error = Math.abs(progress - 0.8);
    let result: Judgment;
    let distance = 0,
      basePoints = 0;
    let keepsCombo = true;
    if (error <= 0.055) {
      result = 'HOME RUN';
      distance = Math.round(118 + Math.random() * 32);
      basePoints = 4500 + distance * 10;
    } else if (error <= 0.105) {
      result = Math.random() > 0.62 ? 'HOME RUN' : 'PERFECT';
      distance =
        result === 'HOME RUN'
          ? Math.round(105 + Math.random() * 28)
          : Math.round(82 + Math.random() * 24);
      basePoints = (result === 'HOME RUN' ? 3000 : 2500) + distance * 10;
    } else if (error <= 0.175) {
      result = 'GOOD';
      distance = Math.round(35 + Math.random() * 55);
      basePoints = 1000 + distance * 10;
    } else if (error <= 0.245) {
      result = 'FOUL';
      basePoints = 150;
    } else {
      result = 'MISS';
      keepsCombo = false;
    }
    const nextCombo = keepsCombo ? combo + 1 : 0;
    const earned = Math.round(basePoints * (1 + Math.min(nextCombo, 20) * 0.1));
    const nextScore = score + earned;
    const nextHomeRuns = homeRuns + (result === 'HOME RUN' ? 1 : 0);
    const nextMaxDistance = Math.max(maxDistance, distance);
    setJudgment(result);
    setLastDistance(distance);
    setCombo(nextCombo);
    setScore(nextScore);
    setHomeRuns(nextHomeRuns);
    setMaxDistance(nextMaxDistance);
    setBallFlying(
      result === 'GOOD' || result === 'PERFECT' || result === 'HOME RUN',
    );
    timeoutRef.current = setTimeout(
      () => {
        setPitch(null);
        if (pitchNumber >= TOTAL_PITCHES)
          finishGame(nextScore, nextHomeRuns, nextMaxDistance);
        else queuePitch(pitchNumber + 1);
      },
      result === 'HOME RUN' ? 1450 : 1050,
    );
  }, [
    clearTimers,
    combo,
    finishGame,
    homeRuns,
    isSwinging,
    judgment,
    maxDistance,
    pitch,
    pitchNumber,
    queuePitch,
    score,
    screen,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        resolveSwing();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resolveSwing]);

  const rank = useMemo(
    () =>
      records.findIndex(
        (item) =>
          item.nickname === (nickname.trim() || '우땅이') &&
          item.score === score,
      ) + 1,
    [nickname, records, score],
  );
  const grade =
    score >= 50000
      ? '전설의 우땅이'
      : score >= 30000
        ? '홈런왕 우땅이'
        : score >= 15000
          ? '주전 우땅이'
          : score >= 5000
            ? '동네 야구 우땅이'
            : '야구공 구경 온 우땅이';
  const batterImage = judgment
    ? POSE_BY_JUDGMENT[judgment]
    : '/utang-batter-clean-cutout.png';
  const batterPose = judgment
    ? judgment.replace(' ', '-').toLowerCase()
    : 'ready';
  const resultImage =
    homeRuns > 0
      ? '/utang-pose-home-run-cutout.png'
      : score >= 5000
        ? '/utang-pose-good-cutout.png'
        : '/utang-pose-miss-v2-cutout.png';

  const shareScore = useCallback(async () => {
    const shareText = `우땅야구에서 ${score.toLocaleString()}점! 홈런 ${homeRuns}개, 최고 비거리 ${maxDistance}m ⚾`;
    const shareData = {
      title: '우땅야구 기록',
      text: shareText,
      url: window.location.origin,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareNotice('공유했어!');
      } else {
        await navigator.clipboard.writeText(
          `${shareText}\n${window.location.origin}`,
        );
        setShareNotice('기록과 링크를 복사했어!');
      }
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        await navigator.clipboard.writeText(
          `${shareText}\n${window.location.origin}`,
        );
        setShareNotice('기록과 링크를 복사했어!');
      }
    }
    window.setTimeout(() => setShareNotice(''), 2200);
  }, [homeRuns, maxDistance, score]);

  return (
    <main className="game-shell">
      <section className="phone-stage" aria-label="우땅야구 게임 화면">
        <div className="sky-glow" />
        <header className="game-header">
          <div className="header-brand">
            <img src="/utang-sun-logo.png" alt="" className="header-logo" />
            <h1>우땅야구</h1>
          </div>
          <div className="mini-score">
            <span>SCORE</span>
            <strong>{score.toLocaleString()}</strong>
          </div>
        </header>

        {screen === 'intro' && (
          <div className="intro-panel screen-panel">
            <div className="hero-utang" aria-hidden="true">
              <img src="/utang-intro-hero.png" alt="" className="hero-image" />
              <span className="spark spark-one">✦</span>
              <span className="spark spark-two">✦</span>
            </div>
            <div className="intro-copy">
              <p className="badge">오늘의 한구승부</p>
              <h2>
                10개의 공을
                <br />
                가장 멀리 날려봐!
              </h2>
              <p>
                타이밍에 맞춰 화면을 탭하면 돼.
                <br />
                PC에서는 스페이스바도 가능해.
              </p>
            </div>
            <form className="nickname-form" onSubmit={startGame}>
              <label htmlFor="nickname">닉네임</label>
              <Input
                id="nickname"
                maxLength={10}
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="우땅이 (기본)"
                autoComplete="nickname"
                className="nickname-input"
              />
              <Button type="submit" className="start-button">
                경기 시작
              </Button>
            </form>
            <div className="intro-ranking">
              <div className="intro-ranking-head">
                <div className="ranking-title">
                  <Trophy size={15} /> 우땅왕 랭킹
                </div>
                <span>TOP 5</span>
              </div>
              {records.length > 0 ? (
                records.slice(0, 5).map((item, index) => (
                  <div
                    className="ranking-row"
                    key={`${item.playedAt}-${index}`}
                  >
                    <b>{index + 1}</b>
                    <span>{item.nickname}</span>
                    <strong>{item.score.toLocaleString()}점</strong>
                  </div>
                ))
              ) : (
                <p className="ranking-empty">첫 우땅왕이 되어봐!</p>
              )}
            </div>
          </div>
        )}

        {screen === 'playing' && (
          <button
            type="button"
            className="play-field"
            onPointerDown={resolveSwing}
            aria-label="화면을 눌러 타격"
          >
            <div className="status-row">
              <div className="inning-card">
                <span>9회말</span>
                <b>UTANG</b>
              </div>
              <div className="pitch-progress">
                <div className="pitch-count">
                  <span>PITCH</span>
                  <strong>{String(pitchNumber).padStart(2, '0')}</strong>
                  <small>/ {TOTAL_PITCHES}</small>
                </div>
                <div className="pitch-dots" aria-hidden="true">
                  {Array.from({ length: TOTAL_PITCHES }, (_, index) => (
                    <i
                      key={index}
                      className={index < pitchNumber ? 'active' : ''}
                    />
                  ))}
                </div>
              </div>
              <div className="combo">
                <Flame size={14} /> <span>COMBO</span>
                <strong>×{Math.max(combo, 1)}</strong>
              </div>
            </div>
            <div className="stadium">
              <div className="cloud cloud-one" />
              <div className="cloud cloud-two" />
              <div className="scoreboard">
                <span>UTANG</span>
                <b>BASEBALL</b>
              </div>
              <div className="stands">
                <img
                  src="/utang-crowd-stadium.png"
                  alt="응원하는 우땅이 관중들"
                  className="crowd-strip"
                />
              </div>
              <div className="field-grass" />
              <div className="infield" />
              <div className="pitcher-mound" />
              <div className="pitch-lane" aria-hidden="true" />
              <div className="home-plate" />
              <img
                src="/utang-pitcher-cutout-v2.png"
                alt="투구하는 우땅이"
                className="pitcher"
              />
              {pitch && (
                <div
                  key={pitch.id}
                  className={`baseball pitch-${pitch.type === '직구' ? 'fast' : pitch.type === '커브' ? 'curve' : 'change'}`}
                  style={
                    {
                      '--pitch-duration': `${pitch.duration}ms`,
                    } as React.CSSProperties
                  }
                >
                  <img src="/baseball-official.png" alt="" />
                </div>
              )}
              {ballFlying && (
                <div className="flying-ball">
                  <img src="/baseball-official.png" alt="" />
                </div>
              )}
              <div
                className={`abs-zone ${pitch && !judgment ? 'live' : ''}`}
                aria-hidden="true"
              >
                <span>ABS</span>
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div
                className={`batter-shadow ${isSwinging ? 'swinging' : ''}`}
              />
              <img
                key={batterImage}
                src={batterImage}
                alt={
                  judgment
                    ? `${judgment} 반응을 하는 우땅이`
                    : '타석에 선 우땅이'
                }
                className={`batter batter-${batterPose} ${isSwinging ? 'swinging' : 'idle'}`}
              />
              {pitch && !judgment && (
                <div className="pitch-label">{pitch.type}</div>
              )}
              {!pitch && !judgment && <div className="ready-label">준비!</div>}
              {judgment && (
                <div
                  className={`judgment judgment-${judgment.replace(' ', '-').toLowerCase()}`}
                >
                  <strong>{judgment}</strong>
                  {lastDistance > 0 && <span>{lastDistance}m</span>}
                </div>
              )}
            </div>
            <div className="tap-guide">
              <span className="tap-ring">
                <i />
              </span>
              <strong>공이 가까워지면 탭!</strong>
              <small>또는 SPACE</small>
            </div>
          </button>
        )}

        {screen === 'result' && (
          <div className="result-panel screen-panel">
            <p className="badge">경기 종료</p>
            <div className="result-character">
              <img
                src={resultImage}
                alt="경기를 마친 우땅이"
                className="result-image"
              />
            </div>
            <p className="result-grade">{grade}</p>
            <h2>{score.toLocaleString()}점</h2>
            <div className="result-stats">
              <div>
                <span>홈런</span>
                <strong>{homeRuns}개</strong>
              </div>
              <div>
                <span>최고 비거리</span>
                <strong>{maxDistance}m</strong>
              </div>
              <div>
                <span>기기 내 순위</span>
                <strong>{rank || '-'}위</strong>
              </div>
            </div>
            <div className="ranking-card">
              <div className="ranking-title">
                <Trophy size={16} /> 이 기기의 우땅왕
              </div>
              {records.slice(0, 3).map((item, index) => (
                <div className="ranking-row" key={`${item.playedAt}-${index}`}>
                  <b>{index + 1}</b>
                  <span>{item.nickname}</span>
                  <strong>{item.score.toLocaleString()}</strong>
                </div>
              ))}
            </div>
            <Button className="start-button" onClick={() => startGame()}>
              <RotateCcw size={17} /> 다시 도전
            </Button>
            <Button className="share-button" onClick={shareScore}>
              {shareNotice ? <Copy size={17} /> : <Share2 size={17} />}
              {shareNotice || '점수 공유하기'}
            </Button>
            <Button
              variant="ghost"
              className="home-button"
              onClick={() => setScreen('intro')}
            >
              처음 화면
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
