'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RotateCcw, Trophy } from 'lucide-react';
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
  { type: '직구', duration: 1120 },
  { type: '커브', duration: 1480 },
  { type: '체인지업', duration: 1760 },
];
const framePositions = [
  '0% 0%',
  '33.333% 0%',
  '66.666% 0%',
  '100% 0%',
  '0% 100%',
  '33.333% 100%',
  '66.666% 100%',
  '100% 100%',
];

function loadRecords(): RecordItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('utang-baseball-records') ?? '[]');
  } catch {
    return [];
  }
}

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
  const [frame, setFrame] = useState(0);
  const [isSwinging, setIsSwinging] = useState(false);
  const [ballFlying, setBallFlying] = useState(false);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => setRecords(loadRecords()), []);
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    frameTimersRef.current.forEach(clearTimeout);
    frameTimersRef.current = [];
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
      setFrame(0);
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
          [1, 2, 3, 5, 6].forEach((nextFrame, index) =>
            frameTimersRef.current.push(
              setTimeout(() => setFrame(nextFrame), index * 80),
            ),
          );
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
    (event?: FormEvent) => {
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
    if (error <= 0.035) {
      result = 'HOME RUN';
      distance = Math.round(118 + Math.random() * 32);
      basePoints = 4500 + distance * 10;
    } else if (error <= 0.075) {
      result = Math.random() > 0.62 ? 'HOME RUN' : 'PERFECT';
      distance =
        result === 'HOME RUN'
          ? Math.round(105 + Math.random() * 28)
          : Math.round(82 + Math.random() * 24);
      basePoints = (result === 'HOME RUN' ? 3000 : 2500) + distance * 10;
    } else if (error <= 0.13) {
      result = 'GOOD';
      distance = Math.round(35 + Math.random() * 55);
      basePoints = 1000 + distance * 10;
    } else if (error <= 0.19) {
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
    [0, 80, 145, 200, 255, 320, 410, 540].forEach((delay, index) =>
      frameTimersRef.current.push(setTimeout(() => setFrame(index), delay)),
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
            {records.length > 0 && (
              <div className="mini-ranking">
                <div className="ranking-title">
                  <Trophy size={15} /> 이 기기의 우땅왕
                </div>
                <strong>{records[0].nickname}</strong>
                <span>{records[0].score.toLocaleString()}점</span>
              </div>
            )}
          </div>
        )}

        {screen === 'playing' && (
          <button
            className="play-field"
            type="button"
            onPointerDown={resolveSwing}
            aria-label="화면을 눌러 타격"
          >
            <div className="status-row">
              <div className="pitch-count">
                <strong>{pitchNumber}</strong>
                <span>/ {TOTAL_PITCHES}구</span>
              </div>
              <div className="pitch-dots" aria-hidden="true">
                {Array.from({ length: TOTAL_PITCHES }, (_, index) => (
                  <i
                    key={index}
                    className={index < pitchNumber ? 'active' : ''}
                  />
                ))}
              </div>
              <div className="combo">
                COMBO <strong>×{Math.max(combo, 1)}</strong>
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
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="field-grass" />
              <div className="infield" />
              <div className="pitcher">
                <span className="pitcher-head" />
                <span className="pitcher-body" />
                <span className="pitcher-arm" />
              </div>
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
                  ⚾
                </div>
              )}
              {ballFlying && <div className="flying-ball">⚾</div>}
              <div
                className={`batter-shadow ${isSwinging ? 'swinging' : ''}`}
              />
              <div
                className={`sprite batter ${isSwinging ? 'swinging' : 'idle'}`}
                style={{ backgroundPosition: framePositions[frame] }}
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
              <div className="sprite sprite-celebrate" />
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
