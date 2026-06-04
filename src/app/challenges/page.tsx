'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { AppLayout } from '@/components';
import { CreateChallengeModal } from '@/components/challenge';
import { MAX_ACTIVE_CHALLENGES, CHALLENGE_XP, Challenge, CHALLENGE_TIMEFRAMES } from '@/types';
import { Icon } from '@/components/stadium/Icon';
import { formatPercent, getRelativeTime } from '@/lib/utils';

export default function ChallengesPage() {
  const {
    currentUser,
    isAuthenticated,
    challenges,
    pendingChallenges,
    activeChallenges,
    completedChallenges,
    challengesLoading,
    loadChallenges,
    loadLiveReturns,
    getActiveChallengesCount,
  } = useStore();

  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) loadChallenges();
  }, [isAuthenticated, loadChallenges]);

  /* Once challenges are loaded, fan out live-return fetches for any
     in-progress fixtures. Re-fires when the active set changes so
     newly-accepted challenges populate immediately. activeChallenges
     is intentionally not in the dep array — using its length avoids
     re-running on every store mutation while still re-firing when
     the set grows/shrinks. */
  useEffect(() => {
    if (isAuthenticated && activeChallenges.length > 0) {
      loadLiveReturns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, activeChallenges.length, loadLiveReturns]);

  const stats = useMemo(() => {
    const wins = completedChallenges.filter((c) => c.winnerId === currentUser?.id).length;
    const losses = completedChallenges.filter(
      (c) => c.winnerId !== null && c.winnerId !== currentUser?.id && c.winnerId !== 'sp500',
    ).length;
    const sp500Wins = completedChallenges.filter(
      (c) => c.type === 'sp500' && c.winnerId === currentUser?.id,
    ).length;
    const sp500Losses = completedChallenges.filter(
      (c) => c.type === 'sp500' && c.winnerId === 'sp500',
    ).length;
    const totalWins = wins + sp500Wins;
    const totalLosses = losses + sp500Losses;
    const winRate =
      challenges.length > 0 ? (totalWins / Math.max(1, totalWins + totalLosses)) * 100 : 0;
    return {
      active: getActiveChallengesCount(),
      pending: pendingChallenges.length,
      wins: totalWins,
      losses: totalLosses,
      winRate: Number.isNaN(winRate) ? 0 : winRate,
    };
  }, [challenges, completedChallenges, pendingChallenges, currentUser, getActiveChallengesCount]);

  // Sort recent results most-recent-first
  const recent = useMemo(() => {
    return [...completedChallenges]
      .sort((a, b) => {
        const aTime = new Date(a.settledAt || a.endDate || a.createdAt).getTime();
        const bTime = new Date(b.settledAt || b.endDate || b.createdAt).getTime();
        return bTime - aTime;
      })
      .slice(0, 10);
  }, [completedChallenges]);

  return (
    <AppLayout flush>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between" style={{ gap: 14 }}>
          <div>
            <div className="kicker">SEASON 1 · {todayLabel()}</div>
            <h1
              className="display"
              style={{ fontSize: 'clamp(24px, 3vw, 32px)', letterSpacing: '-0.04em', margin: '2px 0 0' }}
            >
              Fixtures
            </h1>
            <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 6 }}>
              Compete against the index or other managers · {activeChallenges.length} live ·{' '}
              {pendingChallenges.length} pending · {completedChallenges.length} played
            </div>
          </div>
          <button
            type="button"
            className="stadium-btn stadium-btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Icon.Plus size={14} /> New fixture
          </button>
        </div>

        {/* Stat tiles */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          <StatTile
            kicker="LIVE"
            value={`${stats.active} / ${MAX_ACTIVE_CHALLENGES}`}
            sub="Active fixtures"
            tone={stats.active > 0 ? 'pos' : undefined}
          />
          <StatTile kicker="PENDING" value={`${stats.pending}`} sub="Awaiting kick-off" />
          <StatTile
            kicker="WIN %"
            value={`${stats.winRate.toFixed(0)}%`}
            sub="Career win rate"
            tone={stats.winRate >= 50 ? 'pos' : stats.winRate > 0 ? 'neg' : undefined}
          />
          <StatTile
            kicker="RECORD"
            value={
              <>
                <span style={{ color: 'var(--pitch)' }}>{stats.wins}W</span>
                <span style={{ color: 'var(--text-mute)' }}> · </span>
                <span style={{ color: 'var(--ref-red)' }}>{stats.losses}L</span>
              </>
            }
            sub="Lifetime"
          />
        </div>

        {/* XP stakes strip */}
        <div
          className="stadium-card"
          style={{
            padding: '10px 18px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 24,
            alignItems: 'center',
          }}
        >
          <div className="flex items-center" style={{ gap: 8 }}>
            <Icon.Bolt size={14} style={{ color: 'var(--whistle)' }} />
            <span className="kicker">VS S&P 500</span>
            <span
              className="mono num"
              style={{ fontSize: 12, fontWeight: 700, color: 'var(--whistle)' }}
            >
              +{CHALLENGE_XP.VS_SP500} XP
            </span>
          </div>
          <div style={{ width: 1, height: 16, background: 'var(--line)' }} />
          <div className="flex items-center" style={{ gap: 8 }}>
            <Icon.Profile size={14} style={{ color: 'var(--pitch)' }} />
            <span className="kicker">VS MANAGER</span>
            <span
              className="mono num"
              style={{ fontSize: 12, fontWeight: 700, color: 'var(--pitch)' }}
            >
              +{CHALLENGE_XP.VS_USER} XP
            </span>
          </div>
          <div style={{ width: 1, height: 16, background: 'var(--line)' }} />
          <div className="flex items-center" style={{ gap: 8 }}>
            <span className="kicker">MAX ACTIVE</span>
            <span className="mono num" style={{ fontSize: 12, fontWeight: 700 }}>
              {MAX_ACTIVE_CHALLENGES}
            </span>
          </div>
        </div>

        {/* Live Now */}
        <section>
          <SectionHeader
            title="Live Now"
            sub={`${activeChallenges.length} match${activeChallenges.length === 1 ? '' : 'es'} in progress`}
            right={
              activeChallenges.length > 0 ? (
                <span className="pill pill-red">
                  <span className="live-dot" /> {activeChallenges.length} LIVE
                </span>
              ) : null
            }
          />
          {challengesLoading ? (
            <LoadingCard />
          ) : activeChallenges.length === 0 ? (
            <EmptyState
              icon="Fixture"
              title="No fixtures kicked off yet"
              sub="Set up a match against the index or a rival manager — your XI vs theirs, settled at full-time."
              cta="Set up a fixture"
              onCta={() => setShowCreateModal(true)}
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: 14,
              }}
            >
              {activeChallenges.map((c) => (
                <BigMatchCard key={c.id} challenge={c} myUserId={currentUser?.id} />
              ))}
            </div>
          )}
        </section>

        {/* Upcoming */}
        <section>
          <SectionHeader
            title="Upcoming"
            sub={pendingChallenges.length > 0 ? 'Awaiting kick-off' : 'Nothing pending — set up a new fixture'}
          />
          {challengesLoading ? (
            <LoadingCard />
          ) : pendingChallenges.length === 0 ? (
            <EmptyHint label="No upcoming fixtures. Challenge a rival or a benchmark." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingChallenges.map((c) => (
                <FixtureRow key={c.id} challenge={c} myUserId={currentUser?.id} mode="upcoming" />
              ))}
            </div>
          )}
        </section>

        {/* Recent Results */}
        <section>
          <SectionHeader
            title="Recent Results"
            sub={completedChallenges.length > 0 ? `${completedChallenges.length} played this season` : 'Once a fixture hits full-time it lands here'}
          />
          {challengesLoading ? (
            <LoadingCard />
          ) : recent.length === 0 ? (
            <EmptyHint label="No completed fixtures yet." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent.map((c) => (
                <FixtureRow key={c.id} challenge={c} myUserId={currentUser?.id} mode="result" />
              ))}
            </div>
          )}
        </section>
      </div>

      <CreateChallengeModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </AppLayout>
  );
}

function todayLabel() {
  return new Date()
    .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();
}

const SectionHeader: React.FC<{
  title: string;
  sub?: string;
  right?: React.ReactNode;
}> = ({ title, sub, right }) => (
  <div
    className="flex flex-wrap items-end justify-between"
    style={{ marginBottom: 10, gap: 8 }}
  >
    <div>
      <div className="display" style={{ fontSize: 18, letterSpacing: '-0.03em' }}>
        {title}
      </div>
      {sub && (
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
    {right}
  </div>
);

const StatTile: React.FC<{
  kicker: string;
  value: React.ReactNode;
  sub?: string;
  tone?: 'pos' | 'neg';
}> = ({ kicker, value, sub, tone }) => (
  <div className="stadium-card" style={{ padding: 14 }}>
    <div className="kicker">{kicker}</div>
    <div
      className="display num"
      style={{
        fontSize: 22,
        letterSpacing: '-0.04em',
        marginTop: 4,
        color: tone === 'pos' ? 'var(--pitch)' : tone === 'neg' ? 'var(--ref-red)' : 'var(--text)',
      }}
    >
      {value}
    </div>
    {sub && (
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>
        {sub}
      </div>
    )}
  </div>
);

const LoadingCard: React.FC = () => (
  <div
    className="stadium-card"
    style={{
      padding: 36,
      display: 'flex',
      justifyContent: 'center',
    }}
  >
    <div className="stadium-spinner" style={{ width: 32, height: 32 }} />
  </div>
);

const EmptyHint: React.FC<{ label: string }> = ({ label }) => (
  <div
    className="stadium-card"
    style={{
      padding: 24,
      textAlign: 'center',
      borderStyle: 'dashed',
    }}
  >
    <div className="kicker">{label}</div>
  </div>
);

const EmptyState: React.FC<{
  icon: keyof typeof Icon;
  title: string;
  sub: string;
  cta?: string;
  onCta?: () => void;
}> = ({ icon, title, sub, cta, onCta }) => {
  const I = Icon[icon] as React.FC<{ size?: number; style?: React.CSSProperties }>;
  return (
    <div
      className="stadium-card"
      style={{
        padding: 36,
        textAlign: 'center',
        borderStyle: 'dashed',
      }}
    >
      <I size={36} style={{ color: 'var(--text-mute)', margin: '0 auto 10px' }} />
      <div className="display" style={{ fontSize: 16, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ color: 'var(--text-dim)', fontSize: 12, maxWidth: 440, margin: '0 auto 14px' }}>
        {sub}
      </div>
      {cta && (
        <button type="button" className="stadium-btn stadium-btn-primary" onClick={onCta}>
          <Icon.Plus size={14} /> {cta}
        </button>
      )}
    </div>
  );
};

/* ============================================================
   BigMatchCard — used for live fixtures
   ============================================================ */
const BigMatchCard: React.FC<{ challenge: Challenge; myUserId?: string }> = ({ challenge, myUserId }) => {
  const amChallenger = challenge.challengerId === myUserId;
  const myReturn = amChallenger ? challenge.challengerReturnPercent : challenge.opponentReturnPercent;
  const theirReturn = amChallenger ? challenge.opponentReturnPercent : challenge.challengerReturnPercent;
  const opponentName =
    challenge.type === 'sp500'
      ? 'S&P 500'
      : amChallenger
      ? challenge.opponentUsername || 'TBD'
      : challenge.challengerUsername || 'Challenger';
  const mySquad = amChallenger
    ? challenge.challengerPortfolioName
    : challenge.opponentPortfolioName;

  const leading = (myReturn ?? 0) > (theirReturn ?? 0);
  const fmt = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}`);

  // Match clock — progress through the timeframe
  const { progress, endsIn } = useMemo(() => {
    if (!challenge.startDate || !challenge.endDate) return { progress: 0, endsIn: '—' };
    const startMs = new Date(challenge.startDate).getTime();
    const endMs = new Date(challenge.endDate).getTime();
    const now = Date.now();
    const total = endMs - startMs;
    const elapsed = Math.max(0, Math.min(total, now - startMs));
    const pct = total > 0 ? (elapsed / total) * 100 : 0;

    const remaining = endMs - now;
    let endStr = '—';
    if (remaining <= 0) endStr = 'Closing';
    else {
      const days = Math.floor(remaining / 86400000);
      const hours = Math.floor((remaining % 86400000) / 3600000);
      endStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
    }
    return { progress: pct, endsIn: endStr };
  }, [challenge.startDate, challenge.endDate]);

  const timeframeLabel = CHALLENGE_TIMEFRAMES.find((t) => t.value === challenge.timeframe)?.label || challenge.timeframe;
  const xpStake = challenge.type === 'sp500' ? CHALLENGE_XP.VS_SP500 : CHALLENGE_XP.VS_USER;

  return (
    <div
      className="stadium-card"
      style={{
        padding: 18,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Leading stripe at top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: leading ? 'var(--pitch)' : 'var(--ref-red)',
        }}
      />

      <div
        className="flex justify-between items-center"
        style={{ marginBottom: 14, gap: 6 }}
      >
        <span className="pill pill-red">
          <span className="live-dot" /> LIVE
        </span>
        <span className="kicker">
          {challenge.type === 'sp500' ? 'BENCHMARK' : 'HEAD-TO-HEAD'} · {timeframeLabel} · {endsIn} LEFT
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: 14,
          alignItems: 'center',
        }}
      >
        <div>
          <div className="kicker">YOU</div>
          <div
            className="display num"
            style={{
              fontSize: 30,
              color: leading ? 'var(--pitch)' : 'var(--text)',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            {fmt(myReturn)}
            <span style={{ fontSize: 16, opacity: 0.65 }}>%</span>
          </div>
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--text-mute)',
              marginTop: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {mySquad}
          </div>
        </div>

        <div
          className="display"
          style={{ fontSize: 13, color: 'var(--text-mute)', letterSpacing: '0.2em' }}
        >
          VS
        </div>

        <div style={{ textAlign: 'right' }}>
          <div className="kicker">{opponentName.toUpperCase()}</div>
          <div
            className="display num"
            style={{
              fontSize: 30,
              color: !leading && theirReturn != null ? 'var(--ref-red)' : 'var(--text)',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            {fmt(theirReturn)}
            <span style={{ fontSize: 16, opacity: 0.65 }}>%</span>
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 4 }}>
            {challenge.type === 'sp500' ? 'Market Index' : 'Rival Manager'}
          </div>
        </div>
      </div>

      {/* Match progress bar */}
      <div style={{ marginTop: 16 }}>
        <div
          className="mono"
          style={{
            fontSize: 9,
            color: 'var(--text-mute)',
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 6,
            letterSpacing: '0.12em',
          }}
        >
          <span>KICK-OFF</span>
          <span>FULL-TIME</span>
        </div>
        <div
          style={{
            height: 4,
            background: 'var(--surface-2)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              height: '100%',
              background: leading ? 'var(--pitch)' : 'var(--ref-red)',
              transition: 'width .3s ease',
            }}
          />
        </div>
      </div>

      <div
        className="flex justify-between items-center"
        style={{ marginTop: 12 }}
      >
        <div className="flex items-center" style={{ gap: 6 }}>
          <Icon.Trophy size={14} style={{ color: 'var(--whistle)' }} />
          <span
            className="mono num"
            style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}
          >
            {xpStake} XP STAKED
          </span>
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.1em' }}>
          {leading ? 'YOU LEAD' : myReturn != null && theirReturn != null ? 'BEHIND' : 'WAITING ON DATA'}
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   FixtureRow — used for upcoming + completed fixtures
   ============================================================ */
const FixtureRow: React.FC<{
  challenge: Challenge;
  myUserId?: string;
  mode: 'upcoming' | 'result';
}> = ({ challenge, myUserId, mode }) => {
  const { acceptChallenge, declineChallenge, cancelChallenge, portfolios } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('');

  const amChallenger = challenge.challengerId === myUserId;
  const amOpponent = challenge.opponentId === myUserId;
  const myReturn = amChallenger ? challenge.challengerReturnPercent : challenge.opponentReturnPercent;
  const theirReturn = amChallenger ? challenge.opponentReturnPercent : challenge.challengerReturnPercent;
  const opponentName =
    challenge.type === 'sp500'
      ? 'S&P 500'
      : amChallenger
      ? challenge.opponentUsername || 'TBD'
      : challenge.challengerUsername || 'Challenger';

  const fmt = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}`);
  const timeframeLabel = CHALLENGE_TIMEFRAMES.find((t) => t.value === challenge.timeframe)?.label || challenge.timeframe;
  const isWin = challenge.winnerId === myUserId;
  const isDraw = challenge.winnerId == null && challenge.status === 'completed';

  const handleAccept = async () => {
    if (!selectedPortfolioId) return;
    setIsLoading(true);
    try { await acceptChallenge(challenge.id, selectedPortfolioId); } finally { setIsLoading(false); }
  };
  const handleDecline = async () => {
    setIsLoading(true);
    try { await declineChallenge(challenge.id); } finally { setIsLoading(false); }
  };
  const handleCancel = async () => {
    setIsLoading(true);
    try { await cancelChallenge(challenge.id); } finally { setIsLoading(false); }
  };

  return (
    <div
      className="stadium-card"
      style={{
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: amOpponent && mode === 'upcoming' ? 10 : 0,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '70px 1fr auto',
          gap: 12,
          alignItems: 'center',
        }}
      >
        {/* Status column */}
        <div>
          {mode === 'upcoming' && (
            <span className="pill pill-whistle" style={{ padding: '2px 6px' }}>
              PENDING
            </span>
          )}
          {mode === 'result' && (
            <span className={'pill ' + (isWin ? 'pill-pitch' : isDraw ? 'pill-sky' : 'pill-red')} style={{ padding: '2px 6px' }}>
              {isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}
            </span>
          )}
        </div>

        {/* Match line */}
        <div style={{ minWidth: 0 }}>
          <div className="kicker">
            {challenge.type === 'sp500' ? 'VS S&P 500' : 'VS MANAGER'} · {timeframeLabel}
          </div>
          <div className="flex items-baseline" style={{ gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
            <span className="display" style={{ fontSize: 14, letterSpacing: '-0.01em' }}>
              You
            </span>
            {mode === 'result' && (
              <span
                className="mono num"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: (myReturn ?? 0) >= 0 ? 'var(--pitch)' : 'var(--ref-red)',
                }}
              >
                {fmt(myReturn)}
              </span>
            )}
            <span className="kicker" style={{ opacity: 0.6 }}>VS</span>
            <span
              className="display"
              style={{
                fontSize: 14,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 160,
              }}
            >
              {opponentName}
            </span>
            {mode === 'result' && (
              <span
                className="mono num"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: (theirReturn ?? 0) >= 0 ? 'var(--pitch)' : 'var(--ref-red)',
                }}
              >
                {fmt(theirReturn)}
              </span>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ textAlign: 'right' }}>
          {mode === 'upcoming' && (
            <>
              <div className="kicker">CREATED</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {getRelativeTime(challenge.createdAt)}
              </div>
            </>
          )}
          {mode === 'result' && (
            <>
              <div className="kicker">SETTLED</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {challenge.settledAt
                  ? new Date(challenge.settledAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—'}
              </div>
              {challenge.xpAwarded != null && (
                <div
                  className="mono num"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: isWin ? 'var(--pitch)' : 'var(--text-mute)',
                    marginTop: 2,
                  }}
                >
                  {isWin ? '+' : ''}{challenge.xpAwarded} XP
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Inline actions for the opponent of a pending invite */}
      {mode === 'upcoming' && amOpponent && challenge.type === 'user' && (
        <div
          className="flex flex-wrap"
          style={{
            gap: 8,
            paddingTop: 10,
            borderTop: '1px solid var(--line)',
            alignItems: 'center',
          }}
        >
          <select
            value={selectedPortfolioId}
            onChange={(e) => setSelectedPortfolioId(e.target.value)}
            style={{
              flex: 1,
              minWidth: 200,
              padding: '6px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--line)',
              borderRadius: 6,
            }}
          >
            <option value="">Pick your squad…</option>
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="stadium-btn stadium-btn-primary"
            style={{ padding: '6px 14px', fontSize: 11 }}
            onClick={handleAccept}
            disabled={isLoading || !selectedPortfolioId}
          >
            Accept
          </button>
          <button
            type="button"
            className="stadium-btn stadium-btn-ghost"
            style={{ padding: '6px 14px', fontSize: 11 }}
            onClick={handleDecline}
            disabled={isLoading}
          >
            Decline
          </button>
        </div>
      )}

      {/* Cancel button for the challenger of a pending fixture */}
      {mode === 'upcoming' && amChallenger && (
        <div
          className="flex justify-end"
          style={{
            paddingTop: 10,
            borderTop: '1px solid var(--line)',
            marginTop: 4,
          }}
        >
          <button
            type="button"
            className="stadium-btn stadium-btn-ghost"
            style={{ padding: '6px 12px', fontSize: 11 }}
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel fixture
          </button>
        </div>
      )}
    </div>
  );
};
