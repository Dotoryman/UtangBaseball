'use client';

/* oxlint-disable next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BarChart3,
  Ban,
  CircleDot,
  Home,
  LayoutDashboard,
  LogOut,
  RefreshCcw,
  Search,
  History,
  Share2,
  ShieldCheck,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';

type Tab = 'dashboard' | 'stats' | 'ranking' | 'words' | 'lab';
type Period = 'today' | 'yesterday' | '7d' | '30d' | 'custom';
type MetricRow = Record<string, number | string | null>;
type DashboardData = {
  summary: MetricRow;
  players: MetricRow;
  daily: MetricRow[];
  hourly: MetricRow[];
  funnel: MetricRow[];
  distributions: MetricRow;
  recent: MetricRow[];
  lifetime: MetricRow;
};
type Ranking = {
  id: number;
  nickname: string;
  score: number;
  homeRuns: number;
  distance: number;
  maxCombo: number;
  playedAt: number;
  reportCount: number;
};
type BannedWord = { id: number; term: string; createdAt: number };
type AuditData = {
  logs: Array<{
    id: number;
    action: string;
    targetType: string;
    targetId: string | null;
    details: string | null;
    createdAt: number;
  }>;
};

const FUNNEL_LABELS: Record<string, string> = {
  landing: '시작 페이지 진입',
  play_click: 'PLAY BALL 클릭',
  game_start: '게임 시작',
  game_complete: '1판 완료',
  retry_click: '다시 플레이 클릭',
  second_complete: '2판 완료',
  result_view: '결과 화면 확인',
  share_click: '카카오 공유 클릭',
  referral: '공유 링크 유입',
};
const FUNNEL_ORDER = Object.keys(FUNNEL_LABELS);
const ACTION_LABELS: Record<string, string> = {
  LOGIN: '관리자 로그인',
  DELETE_SCORE: '랭킹 기록 삭제',
  ADD_BANNED_WORD: '금지어 추가',
  DELETE_BANNED_WORD: '금지어 삭제',
  CLEAR_RANKINGS: '랭킹 전체 비우기',
};

function number(value: unknown) {
  return Number(value ?? 0);
}
function pretty(value: unknown) {
  return number(value).toLocaleString('ko-KR');
}
function kstDate(value: number) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) throw new Error(data.error ?? '요청을 처리하지 못했어.');
  return data;
}

function Metric({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <article className="admin-metric">
      <span className="metric-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {note && <em>{note}</em>}
      </div>
    </article>
  );
}

function Bars({
  rows,
  labelKey,
  valueKey,
}: {
  rows: MetricRow[];
  labelKey: string;
  valueKey: string;
}) {
  const max = Math.max(1, ...rows.map((row) => number(row[valueKey])));
  if (!rows.length)
    return <p className="admin-empty">아직 모인 기록이 없어.</p>;
  return (
    <div className="mini-bars">
      {rows.map((row, index) => (
        <div className="mini-bar-row" key={`${String(row[labelKey])}-${index}`}>
          <span>{String(row[labelKey])}</span>
          <i>
            <b
              style={{
                width: `${Math.max(2, (number(row[valueKey]) / max) * 100)}%`,
              }}
            />
          </i>
          <strong>{pretty(row[valueKey])}</strong>
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('dashboard');
  const [period, setPeriod] = useState<Period>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [rankingTotal, setRankingTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('score');
  const [page, setPage] = useState(1);
  const [words, setWords] = useState<BannedWord[]>([]);
  const [newWord, setNewWord] = useState('');
  const [audit, setAudit] = useState<AuditData>({ logs: [] });
  const [deleteTarget, setDeleteTarget] = useState<Ranking | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({ period });
    if (period === 'custom' && customFrom && customTo) {
      params.set(
        'from',
        String(new Date(`${customFrom}T00:00:00+09:00`).getTime()),
      );
      params.set(
        'to',
        String(new Date(`${customTo}T23:59:59.999+09:00`).getTime() + 1),
      );
    }
    return params.toString();
  }, [customFrom, customTo, period]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<DashboardData>(`/api/admin/dashboard?${query}`));
      setNotice('');
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : '현황을 불러오지 못했어.',
      );
    } finally {
      setLoading(false);
    }
  }, [query]);
  const loadRankings = useCallback(async () => {
    const params = new URLSearchParams(query);
    params.set('search', search);
    params.set('sort', sort);
    params.set('page', String(page));
    try {
      const result = await api<{ records: Ranking[]; total: number }>(
        `/api/admin/rankings?${params}`,
      );
      setRankings(result.records);
      setRankingTotal(result.total);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : '랭킹을 불러오지 못했어.',
      );
    }
  }, [page, query, search, sort]);
  const loadWords = useCallback(async () => {
    try {
      setWords(
        (await api<{ words: BannedWord[] }>('/api/admin/banned-words')).words,
      );
    } catch {
      /* Shown by the main dashboard notice. */
    }
  }, []);
  const loadAudit = useCallback(async () => {
    try {
      setAudit(await api<AuditData>('/api/admin/audit'));
    } catch {
      /* Shown by the main dashboard notice. */
    }
  }, []);

  useEffect(() => {
    api<{ authenticated: boolean }>('/api/admin/auth')
      .then((result) => setAuthenticated(result.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);
  useEffect(() => {
    if (authenticated) void loadDashboard();
  }, [authenticated, loadDashboard]);
  useEffect(() => {
    if (authenticated && tab === 'ranking') void loadRankings();
  }, [authenticated, loadRankings, tab]);
  useEffect(() => {
    if (authenticated && tab === 'words') void loadWords();
  }, [authenticated, loadWords, tab]);
  useEffect(() => {
    if (authenticated && tab === 'lab') void loadAudit();
  }, [authenticated, loadAudit, tab]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setNotice('');
    try {
      await api('/api/admin/auth', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setPassword('');
      setAuthenticated(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '암호를 확인해줘.');
    }
  }
  async function logout() {
    await api('/api/admin/auth', { method: 'DELETE' });
    setAuthenticated(false);
    setData(null);
  }
  async function deleteScore() {
    if (!deleteTarget) return;
    try {
      await api('/api/admin/rankings', {
        method: 'DELETE',
        body: JSON.stringify({ id: deleteTarget.id, confirm: '기록 삭제' }),
      });
      setDeleteTarget(null);
      await Promise.all([loadRankings(), loadDashboard()]);
      setNotice('기록을 지웠어.');
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : '기록을 지우지 못했어.',
      );
    }
  }
  async function addWord(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api('/api/admin/banned-words', {
        method: 'POST',
        body: JSON.stringify({ term: newWord }),
      });
      setNewWord('');
      await loadWords();
      setNotice('금지어를 추가했어.');
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : '금지어를 추가하지 못했어.',
      );
    }
  }
  async function deleteWord(id: number) {
    await api('/api/admin/banned-words', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    await loadWords();
  }
  async function clearRankings() {
    try {
      await api('/api/admin/reset', {
        method: 'POST',
        body: JSON.stringify({ confirm: resetText }),
      });
      setResetOpen(false);
      setResetText('');
      setRankings([]);
      setRankingTotal(0);
      await Promise.all([loadRankings(), loadAudit()]);
      setNotice('랭킹을 모두 비웠어. 플레이 통계는 그대로 남아 있어.');
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : '랭킹을 비우지 못했어.',
      );
    }
  }

  if (authenticated === null)
    return (
      <main className="admin-login">
        <div className="admin-login-card">
          <img src="/utang-sticker-messy-v093.png" alt="부시시 우땅이" />
          <p>우땅 연구소 문 여는 중…</p>
        </div>
      </main>
    );
  if (!authenticated)
    return (
      <main className="admin-login">
        <form className="admin-login-card" onSubmit={login}>
          <span className="admin-kicker">SECRET UTANG LAB</span>
          <img src="/utang-sticker-messy-v093.png" alt="부시시 우땅이" />
          <h1>우땅 연구소</h1>
          <p>
            다섯 번이나 찾았네!
            <br />
            관리자 암호를 알려줘.
          </p>
          <label>
            <span>관리자 암호</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {notice && <output className="admin-notice error">{notice}</output>}
          <button type="submit">연구소 들어가기</button>
          <Link href="/">
            <Home size={16} /> 야구장으로 돌아가기
          </Link>
        </form>
      </main>
    );

  const summary = data?.summary ?? {};
  const players = data?.players ?? {};
  const lifetime = data?.lifetime ?? {};
  const completed = number(summary.completed_games);
  const users = number(players.users);
  const totalHits =
    number(summary.infield_hits) +
    number(summary.singles) +
    number(summary.doubles) +
    number(summary.triples) +
    number(summary.home_runs);
  const funnel = FUNNEL_ORDER.map((event) => ({
    event,
    users: number(data?.funnel.find((row) => row.event === event)?.users),
  }));
  const firstFunnel = Math.max(1, funnel[0]?.users ?? 0);
  const outcomeRows = [
    ['MISS', summary.misses],
    ['FOUL', summary.fouls],
    ['내야안타', summary.infield_hits],
    ['안타', summary.singles],
    ['2루타', summary.doubles],
    ['3루타', summary.triples],
    ['홈런', summary.home_runs],
  ].map(([label, value]) => ({ label, value: number(value) }));
  const distanceRows = [
    ['0m', 'd0'],
    ['1–29m', 'd1'],
    ['30–72m', 'd2'],
    ['73–95m', 'd3'],
    ['96–114m', 'd4'],
    ['115m+', 'd5'],
  ].map(([label, key]) => ({ label, value: number(data?.distributions[key]) }));
  const comboRows = [
    ['0', 'c0'],
    ['1–2', 'c1'],
    ['3–5', 'c2'],
    ['6–9', 'c3'],
    ['10', 'c4'],
  ].map(([label, key]) => ({ label, value: number(data?.distributions[key]) }));

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link
          className="admin-brand"
          href="/"
          aria-label="우땅야구 게임으로 이동"
        >
          <img src="/utang-sun-logo.png" alt="" />
          <div>
            <strong>우땅 연구소</strong>
            <small>BASEBALL OPS</small>
          </div>
        </Link>
        <nav>
          {(
            [
              ['dashboard', LayoutDashboard, '한눈에 보기'],
              ['stats', BarChart3, '플레이 통계'],
              ['ranking', Trophy, '랭킹 관리'],
              ['words', Ban, '금지어 관리'],
              ['lab', History, '운영 기록'],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              className={tab === id ? 'active' : ''}
              onClick={() => setTab(id)}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
        <button className="admin-logout" onClick={logout}>
          <LogOut size={18} /> 나가기
        </button>
      </aside>
      <section className="admin-workspace">
        <header className="admin-header">
          <div>
            <span>UTANG OPERATIONS</span>
            <h1>
              {tab === 'dashboard'
                ? '오늘도 우땅이는 열일 중'
                : tab === 'stats'
                  ? '공은 어디까지 날아갔을까?'
                  : tab === 'ranking'
                    ? '오늘의 우땅왕 관리'
                    : tab === 'words'
                      ? '예쁜 닉네임 지킴이'
                      : '관리자 작업 기록'}
            </h1>
          </div>
          <div className="admin-header-actions">
            <Link href="/">
              <Home size={18} />
              <span>게임</span>
            </Link>
            <button
              onClick={() => void loadDashboard()}
              className={loading ? 'spin' : ''}
              aria-label="새로고침"
            >
              <RefreshCcw size={18} />
            </button>
          </div>
        </header>
        {notice && (
          <output className="admin-notice">
            {notice}
            <button onClick={() => setNotice('')}>×</button>
          </output>
        )}
        <div className="period-bar">
          <b>기간</b>
          {(['today', 'yesterday', '7d', '30d'] as Period[]).map((item) => (
            <button
              key={item}
              className={period === item ? 'active' : ''}
              onClick={() => setPeriod(item)}
            >
              {item === 'today'
                ? '오늘'
                : item === 'yesterday'
                  ? '어제'
                  : item === '7d'
                    ? '최근 7일'
                    : '최근 30일'}
            </button>
          ))}
          <button
            className={period === 'custom' ? 'active' : ''}
            onClick={() => setPeriod('custom')}
          >
            직접 선택
          </button>
          {period === 'custom' && (
            <>
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
              />
              <span>–</span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
              />
            </>
          )}
        </div>

        {tab === 'dashboard' && (
          <>
            <section className="metric-grid">
              <Metric
                icon={<Users />}
                label="플레이한 우땅이"
                value={`${pretty(users)}명`}
              />
              <Metric
                icon={<CircleDot />}
                label="완료한 경기"
                value={`${pretty(completed)}판`}
                note={`한 명당 ${number(players.avg_plays).toFixed(1)}판`}
              />
              <Metric
                icon={<Trophy />}
                label="최고 점수"
                value={`${pretty(summary.max_score)}점`}
              />
              <Metric
                icon={<Share2 />}
                label="카카오 공유"
                value={`${pretty(summary.share_clicks)}번`}
                note={`완료 대비 ${completed ? ((number(summary.share_clicks) / completed) * 100).toFixed(1) : '0.0'}%`}
              />
              <Metric
                icon={<Activity />}
                label="홈런"
                value={`${pretty(summary.home_runs)}개`}
              />
            </section>
            <section className="admin-grid two">
              <article className="admin-card">
                <header>
                  <h2>날짜별 플레이</h2>
                  <span>미리 집계된 데이터</span>
                </header>
                <Bars
                  rows={(data?.daily ?? []).map((row) => ({
                    ...row,
                    day: new Intl.DateTimeFormat('ko-KR', {
                      timeZone: 'Asia/Seoul',
                      month: 'numeric',
                      day: 'numeric',
                    }).format(number(row.day)),
                  }))}
                  labelKey="day"
                  valueKey="plays"
                />
              </article>
              <article className="admin-card">
                <header>
                  <h2>최근 경기</h2>
                  <span>최신 8건</span>
                </header>
                <div className="recent-list">
                  {data?.recent.length ? (
                    data.recent.map((row, index) => (
                      <div key={index}>
                        <span>{row.nickname}</span>
                        <strong>{pretty(row.score)}점</strong>
                        <small>{kstDate(number(row.playedAt))}</small>
                      </div>
                    ))
                  ) : (
                    <p className="admin-empty">아직 경기가 없어.</p>
                  )}
                </div>
              </article>
            </section>
            <section className="admin-card lab-summary">
              <header>
                <div>
                  <span className="lab-badge">누적 재미 통계</span>
                  <h2>우땅 연구소 관측 기록</h2>
                </div>
                <img src="/utang-countdown-v071.png" alt="공을 든 우땅이" />
              </header>
              <div>
                <span>
                  전체 플레이 <b>{pretty(lifetime.plays)}판</b>
                </span>
                <span>
                  전체 홈런 <b>{pretty(lifetime.homeRuns)}개</b>
                </span>
                <span>
                  전체 안타 <b>{pretty(lifetime.hits)}개</b>
                </span>
                <span>
                  날아간 거리 <b>{pretty(lifetime.totalDistance)}m</b>
                </span>
                <span>
                  역대 최고 거리 <b>{pretty(lifetime.maxDistance)}m</b>
                </span>
                <span>
                  역대 최고 점수 <b>{pretty(lifetime.maxScore)}점</b>
                </span>
                <span>
                  전체 헛스윙 <b>{pretty(lifetime.misses)}번</b>
                </span>
              </div>
            </section>
          </>
        )}

        {tab === 'stats' && (
          <>
            <section className="admin-grid three">
              <article className="admin-card">
                <header>
                  <h2>타격 결과</h2>
                </header>
                <Bars rows={outcomeRows} labelKey="label" valueKey="value" />
              </article>
              <article className="admin-card">
                <header>
                  <h2>비거리 분포</h2>
                </header>
                <Bars rows={distanceRows} labelKey="label" valueKey="value" />
              </article>
              <article className="admin-card">
                <header>
                  <h2>최고 콤보 분포</h2>
                </header>
                <Bars rows={comboRows} labelKey="label" valueKey="value" />
              </article>
            </section>
            <section className="admin-grid two">
              <article className="admin-card">
                <header>
                  <h2>시간대별 플레이</h2>
                </header>
                <Bars
                  rows={(data?.hourly ?? []).map((row) => ({
                    ...row,
                    hour: `${String(row.hour).padStart(2, '0')}시`,
                  }))}
                  labelKey="hour"
                  valueKey="plays"
                />
              </article>
              <article className="admin-card">
                <header>
                  <h2>다시 찾아온 우땅이</h2>
                </header>
                <div className="ratio-list">
                  <div>
                    <span>1판만 플레이</span>
                    <b>
                      {users
                        ? ((number(players.one_play) / users) * 100).toFixed(1)
                        : 0}
                      %
                    </b>
                  </div>
                  <div>
                    <span>2판 이상</span>
                    <b>
                      {users
                        ? ((number(players.two_plus) / users) * 100).toFixed(1)
                        : 0}
                      %
                    </b>
                  </div>
                  <div>
                    <span>3판 이상</span>
                    <b>
                      {users
                        ? ((number(players.three_plus) / users) * 100).toFixed(
                            1,
                          )
                        : 0}
                      %
                    </b>
                  </div>
                  <div>
                    <span>평균 비거리</span>
                    <b>
                      {totalHits
                        ? Math.round(number(summary.total_distance) / totalHits)
                        : 0}
                      m
                    </b>
                  </div>
                  <div>
                    <span>평균 최고 콤보</span>
                    <b>
                      {completed
                        ? (number(summary.sum_max_combo) / completed).toFixed(1)
                        : '0.0'}
                    </b>
                  </div>
                </div>
              </article>
            </section>
            <article className="admin-card funnel-card">
              <header>
                <h2>플레이 흐름</h2>
                <span>단계별 고유 사용자</span>
              </header>
              <div>
                {funnel.map((row, index) => (
                  <div className="funnel-step" key={row.event}>
                    <b>{index + 1}</b>
                    <span>{FUNNEL_LABELS[row.event]}</span>
                    <i>
                      <em
                        style={{
                          width: `${Math.max(2, (row.users / firstFunnel) * 100)}%`,
                        }}
                      />
                    </i>
                    <strong>{row.users}명</strong>
                    <small>
                      {((row.users / firstFunnel) * 100).toFixed(1)}%
                    </small>
                  </div>
                ))}
              </div>
            </article>
          </>
        )}

        {tab === 'ranking' && (
          <section className="admin-card ranking-admin">
            <header>
              <div>
                <h2>랭킹 기록 {rankingTotal.toLocaleString()}건</h2>
                <span>삭제하면 사용자 랭킹에도 바로 반영돼.</span>
              </div>
              <div className="table-tools">
                <label>
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="닉네임 검색"
                  />
                </label>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="score">점수순</option>
                  <option value="newest">최신순</option>
                  <option value="distance">비거리순</option>
                </select>
                <button
                  className="clear-ranking-button"
                  onClick={() => setResetOpen(true)}
                >
                  <Trash2 size={16} /> 전체 비우기
                </button>
              </div>
            </header>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>닉네임</th>
                    <th>점수</th>
                    <th>비거리</th>
                    <th>홈런</th>
                    <th>콤보</th>
                    <th>신고</th>
                    <th>플레이 시간</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((row, index) => (
                    <tr key={row.id}>
                      <td>{(page - 1) * 30 + index + 1}</td>
                      <td>
                        <b>{row.nickname}</b>
                      </td>
                      <td>{row.score.toLocaleString()}</td>
                      <td>{row.distance}m</td>
                      <td>{row.homeRuns}</td>
                      <td>{row.maxCombo}</td>
                      <td>{row.reportCount}</td>
                      <td>{kstDate(row.playedAt)}</td>
                      <td>
                        <button
                          className="danger-icon"
                          onClick={() => setDeleteTarget(row)}
                          aria-label={`${row.nickname} 기록 삭제`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <button
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                이전
              </button>
              <span>
                {page} / {Math.max(1, Math.ceil(rankingTotal / 30))}
              </span>
              <button
                disabled={page * 30 >= rankingTotal}
                onClick={() => setPage((value) => value + 1)}
              >
                다음
              </button>
            </div>
          </section>
        )}

        {tab === 'words' && (
          <section className="admin-grid two word-layout">
            <article className="admin-card">
              <header>
                <h2>금지어 추가</h2>
                <ShieldCheck size={24} />
              </header>
              <p>
                띄어쓰기·특수문자·일부 숫자 치환과 반복 글자 우회도 함께 확인해.
              </p>
              <form className="word-form" onSubmit={addWord}>
                <input
                  value={newWord}
                  onChange={(event) => setNewWord(event.target.value)}
                  maxLength={30}
                  placeholder="추가할 말"
                />
                <button type="submit">목록에 추가</button>
              </form>
              <div className="friendly-copy">
                “착한 우땅이는 예쁜 닉네임을 써요!”
              </div>
            </article>
            <article className="admin-card">
              <header>
                <h2>등록된 금지어</h2>
                <span>{words.length}개</span>
              </header>
              <div className="word-chips">
                {words.map((word) => (
                  <span key={word.id}>
                    {word.term}
                    <button
                      onClick={() => void deleteWord(word.id)}
                      aria-label={`${word.term} 삭제`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </article>
          </section>
        )}

        {tab === 'lab' && (
          <article className="admin-card">
            <header>
              <h2>관리자 작업 로그</h2>
              <span>최근 100건</span>
            </header>
            <div className="audit-list">
              {audit.logs.map((log) => (
                <div key={log.id}>
                  <b>{ACTION_LABELS[log.action] ?? log.action}</b>
                  <span>{log.details}</span>
                  <small>{kstDate(log.createdAt)}</small>
                </div>
              ))}
            </div>
          </article>
        )}
      </section>
      {deleteTarget && (
        <div className="admin-modal">
          <div>
            <Trash2 />
            <h2>이 기록을 지울까?</h2>
            <p>
              <b>{deleteTarget.nickname}</b> ·{' '}
              {deleteTarget.score.toLocaleString()}점<br />
              사용자 랭킹에서도 바로 사라져.
            </p>
            <footer>
              <button onClick={() => setDeleteTarget(null)}>취소</button>
              <button className="danger" onClick={() => void deleteScore()}>
                기록 삭제
              </button>
            </footer>
          </div>
        </div>
      )}
      {resetOpen && (
        <div className="admin-modal">
          <div className="reset-modal">
            <Trash2 />
            <h2>랭킹을 모두 비울까?</h2>
            <p>
              현재 랭킹 기록만 사라져. 플레이 통계와 게임 기록은 안전하게 남아.
              아래 문구를 똑같이 입력해줘.
            </p>
            <code>오늘의 우땅왕 랭킹 전체 비우기</code>
            <input
              value={resetText}
              onChange={(event) => setResetText(event.target.value)}
              placeholder="확인 문구 입력"
            />
            <footer>
              <button
                onClick={() => {
                  setResetOpen(false);
                  setResetText('');
                }}
              >
                취소
              </button>
              <button
                className="danger"
                disabled={resetText !== '오늘의 우땅왕 랭킹 전체 비우기'}
                onClick={() => void clearRankings()}
              >
                랭킹 비우기
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}
