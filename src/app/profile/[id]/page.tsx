'use client';

/* Manager profile (Sprint 5, item 21, Alex).
   Previously every "view manager" affordance routed nowhere — Follow
   buttons on ScoutCard/PortfolioCard had nothing to click through to.
   This route fills that gap: a public profile keyed by user id.

   - Loads target via /api/users?id=X
   - Header: avatar, names, joined date, level/XP, follower counts.
   - Follow / Following toggle only when viewing OTHER manager.
   - Public squads grid via /api/portfolios?userId=X (filter isPublic).
     Privacy gate is enforced by that route's viewerId param — clicking
     through to a squad shows last-weekend snapshot when not own.
   - W/L from /api/challenges?userId=X completed bucket.
   - Last 5 completed fixtures.

   This intentionally does NOT re-use /profile (own) — that page has an
   edit modal and the trophies cabinet which would muddy a public view.
   Kept separate as the prompt allows. */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components';
import { useStore } from '@/store/useStore';
import { formatDate, calculateLevel, formatPercent } from '@/lib/utils';
import { Icon } from '@/components/stadium/Icon';
import { User, Portfolio, Challenge } from '@/types';

export default function ManagerProfilePage() {
  const params = useParams();
  const targetUserId = params.id as string;
  const { currentUser, followUser, unfollowUser } = useStore();

  const [target, setTarget] = useState<User | null>(null);
  const [publicSquads, setPublicSquads] = useState<Portfolio[]>([]);
  const [completed, setCompleted] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const isOwn = currentUser?.id === targetUserId;
  const isFollowing = currentUser
    ? currentUser.following.includes(targetUserId)
    : false;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const [userRes, portRes, chalRes] = await Promise.all([
          fetch(`/api/users?id=${targetUserId}`),
          fetch(`/api/portfolios?userId=${targetUserId}`),
          fetch(`/api/challenges?userId=${targetUserId}`),
        ]);
        const userData = await userRes.json();
        const portData = await portRes.json();
        const chalData = await chalRes.json();
        if (cancelled) return;

        if (!userData.success || !userData.user) {
          setNotFound(true);
          setTarget(null);
        } else {
          setTarget(userData.user);
        }
        /* Public squads only — portRes returns all of the target's
           squads because we're querying by userId, so filter here. */
        setPublicSquads(
          portData.success
            ? (portData.portfolios as Portfolio[]).filter((p) => p.isPublic)
            : [],
        );
        setCompleted(
          chalData.success ? (chalData.completedChallenges as Challenge[]) : [],
        );
      } catch (error) {
        console.error('Failed to load manager profile:', error);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  const levelInfo = target ? calculateLevel(target.xp) : null;

  /* W/L only counts the target's completed fixtures where a winner
     exists (so draws and bench rows don't skew the rate). */
  const wonChallenges = completed.filter((c) => c.winnerId === targetUserId).length;
  const lostChallenges = completed.filter(
    (c) => c.winnerId && c.winnerId !== targetUserId &&
      (c.challengerId === targetUserId || c.opponentId === targetUserId),
  ).length;
  const winRate =
    wonChallenges + lostChallenges > 0
      ? Math.round((wonChallenges / (wonChallenges + lostChallenges)) * 100)
      : 0;

  const recentCompleted = completed.slice(0, 5);

  const handleFollowToggle = () => {
    if (!currentUser || isOwn) return;
    if (isFollowing) unfollowUser(targetUserId);
    else followUser(targetUserId);
  };

  if (loading) {
    return (
      <AppLayout flush>
        <div style={{ padding: 48, textAlign: 'center' }}>
          <div className="kicker">LOADING MANAGER…</div>
        </div>
      </AppLayout>
    );
  }

  if (notFound || !target) {
    return (
      <AppLayout flush>
        <div
          className="stadium-card"
          style={{ padding: 48, textAlign: 'center', margin: 24 }}
        >
          <Icon.Profile size={36} style={{ color: 'var(--text-mute)', margin: '0 auto 12px' }} />
          <div className="display" style={{ fontSize: 18, marginBottom: 6 }}>
            Manager not found
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)' }}>
            This profile no longer exists or was never public.
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout flush>
      <div
        style={{
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          maxWidth: 1080,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Manager card */}
        <div className="stadium-card" style={{ padding: '20px 24px' }}>
          <div className="flex flex-wrap" style={{ gap: 22, alignItems: 'center' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={target.avatar || '/default-avatar.png'}
                alt={target.displayName || target.username}
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 8,
                  border: '1px solid var(--line-2)',
                  objectFit: 'cover',
                }}
              />
              {levelInfo && (
                <div
                  className="display num"
                  style={{
                    position: 'absolute',
                    bottom: -6,
                    right: -6,
                    width: 32,
                    height: 32,
                    background: 'var(--pitch)',
                    color: 'oklch(0.14 0.05 145)',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    border: '2px solid var(--surface)',
                  }}
                >
                  {levelInfo.level}
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="kicker">MANAGER · LV.{levelInfo?.level || 1}</div>
              <div
                className="display"
                style={{
                  fontSize: 'clamp(22px, 2.6vw, 28px)',
                  letterSpacing: '-0.04em',
                  marginTop: 2,
                }}
              >
                {target.displayName || target.username}
              </div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 2 }}>
                @{target.username} · joined{' '}
                {target.joinedAt ? formatDate(target.joinedAt) : 'recently'}
              </div>
              {target.bio && (
                <div
                  style={{
                    color: 'var(--text-dim)',
                    fontSize: 13,
                    marginTop: 8,
                    lineHeight: 1.55,
                    maxWidth: 600,
                  }}
                >
                  {target.bio}
                </div>
              )}
            </div>

            {!isOwn && currentUser && (
              <button
                type="button"
                onClick={handleFollowToggle}
                aria-pressed={isFollowing}
                className="stadium-btn stadium-btn-ghost"
                style={{
                  padding: '8px 14px',
                  fontSize: 12,
                  color: isFollowing ? 'var(--pitch)' : undefined,
                  borderColor: isFollowing ? 'oklch(0.72 0.21 145 / 0.35)' : undefined,
                  background: isFollowing ? 'oklch(0.72 0.21 145 / 0.08)' : undefined,
                }}
              >
                {isFollowing ? 'Following ✓' : 'Follow'}
              </button>
            )}
          </div>

          {/* XP progress bar */}
          {levelInfo && (
            <div
              style={{
                marginTop: 18,
                paddingTop: 18,
                borderTop: '1px solid var(--line)',
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span className="kicker">SEASON XP</span>
                <span
                  className="mono num"
                  style={{ fontSize: 12, color: 'var(--pitch)', fontWeight: 700 }}
                >
                  {target.xp.toLocaleString()} XP
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 6,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${levelInfo.level >= 5 ? 100 : (levelInfo.currentXp / levelInfo.nextLevelXp) * 100}%`,
                    height: '100%',
                    background: 'var(--pitch)',
                    transition: 'width .4s ease',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Stat tiles */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          <StatTile kicker="PUBLIC SQUADS" value={String(publicSquads.length)} sub="On display" />
          <StatTile
            kicker="WINS"
            value={String(wonChallenges)}
            sub="Fixtures won"
            tone="pos"
          />
          <StatTile
            kicker="WIN %"
            value={`${winRate}%`}
            sub="Career win rate"
            tone={winRate >= 50 ? 'pos' : winRate > 0 ? 'neg' : undefined}
          />
          <StatTile
            kicker="FOLLOWERS"
            value={String(target.followers?.length || 0)}
            sub={`Following ${target.following?.length || 0}`}
          />
        </div>

        {/* Public squads grid */}
        <section className="stadium-card" style={{ padding: 18 }}>
          <div className="kicker" style={{ marginBottom: 12 }}>
            PUBLIC SQUADS · {publicSquads.length}
          </div>
          {publicSquads.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: 'var(--text-dim)',
                fontSize: 13,
              }}
            >
              No public squads yet.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 10,
              }}
            >
              {publicSquads.map((portfolio) => {
                const filled = portfolio.players.filter((p) => p.asset).length;
                return (
                  <Link
                    key={portfolio.id}
                    href={`/portfolio/${portfolio.id}`}
                    className="stadium-card"
                    style={{
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'border-color .15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--pitch)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--line)';
                    }}
                  >
                    <div className="flex items-start justify-between" style={{ gap: 6 }}>
                      <div
                        className="display"
                        style={{
                          fontSize: 14,
                          letterSpacing: '-0.01em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {portfolio.name}
                      </div>
                      <span className="pill pill-pitch" style={{ fontSize: 9 }}>
                        {portfolio.formation}
                      </span>
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
                      {filled}/11 PLAYERS · {portfolio.likes?.length || 0} LIKES
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent fixtures */}
        <section className="stadium-card" style={{ padding: 18 }}>
          <div className="kicker" style={{ marginBottom: 12 }}>
            RECENT FIXTURES · {recentCompleted.length} OF {completed.length}
          </div>
          {recentCompleted.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: 'var(--text-dim)',
                fontSize: 13,
              }}
            >
              No completed fixtures yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentCompleted.map((c) => {
                const targetWon = c.winnerId === targetUserId;
                const draw = c.winnerId === null;
                const targetIsChallenger = c.challengerId === targetUserId;
                const targetReturn = targetIsChallenger
                  ? c.challengerReturnPercent
                  : c.opponentReturnPercent;
                const opponentLabel =
                  c.type === 'sp500'
                    ? 'S&P 500'
                    : c.type === 'etf'
                    ? c.opponentSymbol || 'ETF'
                    : targetIsChallenger
                    ? c.opponentUsername || 'Manager'
                    : c.challengerUsername || 'Manager';
                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                    }}
                  >
                    <span
                      className={
                        targetWon
                          ? 'pill pill-pitch'
                          : draw
                          ? 'pill pill-sky'
                          : 'pill pill-red'
                      }
                      style={{ padding: '2px 8px', fontSize: 10 }}
                    >
                      {targetWon ? 'WIN' : draw ? 'DRAW' : 'LOSS'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="display"
                        style={{
                          fontSize: 13,
                          letterSpacing: '-0.01em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        vs {opponentLabel}
                      </div>
                      <div
                        className="mono"
                        style={{ fontSize: 10, color: 'var(--text-mute)' }}
                      >
                        {c.timeframe} ·{' '}
                        {c.settledAt ? formatDate(c.settledAt) : '—'}
                      </div>
                    </div>
                    {targetReturn !== null && targetReturn !== undefined && (
                      <span
                        className="mono num"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color:
                            targetReturn >= 0
                              ? 'var(--pitch)'
                              : 'var(--ref-red)',
                        }}
                      >
                        {formatPercent(targetReturn)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

const StatTile: React.FC<{
  kicker: string;
  value: string;
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
