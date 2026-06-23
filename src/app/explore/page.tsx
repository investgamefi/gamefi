'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { AppLayout, Input } from '@/components';
import { Formation, FORMATIONS, Portfolio, PortfolioPerformance } from '@/types';
import { Icon } from '@/components/stadium/Icon';
import { Pitch, FORMATIONS as PITCH_FORMATIONS, type FormationName, type PitchPlayer } from '@/components/stadium/Pitch';
import { fetchMultiplePortfolioPerformances } from '@/hooks/usePortfolioRealPerformance';
import { formatPercent, calculatePortfolioPerformance, getRelativeTime } from '@/lib/utils';

type SortKey = 'recent' | 'popular' | 'cloned';

export default function ExplorePage() {
  const { publicPortfolios, refreshPortfolios, currentUser } = useStore();
  const [search, setSearch] = useState('');
  const [selectedFormation, setSelectedFormation] = useState<Formation | 'All'>('All');
  const [sortBy, setSortBy] = useState<SortKey>('popular');
  const [perfMap, setPerfMap] = useState<
    Map<string, { performance: PortfolioPerformance; isRealData: boolean }>
  >(new Map());

  useEffect(() => {
    refreshPortfolios();
  }, [refreshPortfolios]);

  const filteredPortfolios = useMemo(() => {
    let portfolios = publicPortfolios.filter((p) => p.userId !== currentUser?.id);

    if (search) {
      const q = search.toLowerCase();
      portfolios = portfolios.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q),
      );
    }

    if (selectedFormation !== 'All') {
      portfolios = portfolios.filter((p) => p.formation === selectedFormation);
    }

    switch (sortBy) {
      case 'recent':
        portfolios.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'popular':
        portfolios.sort((a, b) => b.likes.length - a.likes.length);
        break;
      case 'cloned':
        portfolios.sort((a, b) => b.cloneCount - a.cloneCount);
        break;
    }

    return portfolios;
  }, [publicPortfolios, currentUser?.id, search, selectedFormation, sortBy]);

  // Fetch real perf data for visible portfolios
  useEffect(() => {
    if (filteredPortfolios.length === 0) return;
    const run = async () => {
      try {
        const performances = await fetchMultiplePortfolioPerformances(
          filteredPortfolios.slice(0, 30),
          '1M',
        );
        setPerfMap(performances);
      } catch (err) {
        console.error('Failed to fetch explore performances:', err);
      }
    };
    run();
  }, [filteredPortfolios]);

  return (
    <AppLayout flush>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Header */}
        <div>
          <div className="kicker">SCOUTING REPORT · WEEK 12</div>
          <h1
            className="display"
            style={{ fontSize: 'clamp(24px, 3vw, 32px)', letterSpacing: '-0.04em', margin: '2px 0 0' }}
          >
            Scout
          </h1>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 6 }}>
            Discover top squads, clone formations that beat the index, recruit ideas from rivals.
          </div>
        </div>

        {/* Hero blurb */}
        <div
          className="stadium-card"
          style={{ padding: '20px 24px', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Icon.Scout size={48} style={{ color: 'var(--pitch)', flexShrink: 0 }} />
          <div style={{ minWidth: 240, flex: 1 }}>
            <div className="display" style={{ fontSize: 18, letterSpacing: '-0.02em' }}>
              {filteredPortfolios.length} public squad{filteredPortfolios.length === 1 ? '' : 's'} in the league
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4, lineHeight: 1.5 }}>
              Browse other managers&apos; lineups. Like a portfolio to save it. Clone a formation straight into a new squad of your own.
            </div>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap" style={{ gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Input
              placeholder="Search squads or managers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Icon.Search size={14} />}
            />
          </div>

          <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="kicker" style={{ alignSelf: 'center', marginRight: 4 }}>FORMATION</span>
            {(['All', ...(Object.keys(FORMATIONS) as Formation[])] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSelectedFormation(f as Formation | 'All')}
                className="mono"
                style={{
                  padding: '6px 10px',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  background: selectedFormation === f ? 'var(--text)' : 'var(--surface)',
                  color: selectedFormation === f ? 'var(--bg)' : 'var(--text-dim)',
                  border: '1px solid ' + (selectedFormation === f ? 'var(--text)' : 'var(--line)'),
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex" style={{ gap: 6 }}>
            <span className="kicker" style={{ alignSelf: 'center', marginRight: 4 }}>SORT</span>
            {(
              [
                ['popular', 'Popular'],
                ['recent', 'Recent'],
                ['cloned', 'Most cloned'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortBy(key)}
                className="mono"
                style={{
                  padding: '6px 10px',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  background: sortBy === key ? 'var(--pitch)' : 'transparent',
                  color: sortBy === key ? 'oklch(0.14 0.05 145)' : 'var(--text-dim)',
                  border: '1px solid ' + (sortBy === key ? 'var(--pitch-deep)' : 'var(--line)'),
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Trending squads */}
        {filteredPortfolios.length > 0 && (
          <div
            className="flex items-end justify-between"
            style={{ marginTop: 4, marginBottom: 4 }}
          >
            <div className="display" style={{ fontSize: 18, letterSpacing: '-0.03em' }}>
              Trending Squads
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.1em' }}>
              {filteredPortfolios.length} RESULTS
            </div>
          </div>
        )}

        {/* Results */}
        {filteredPortfolios.length === 0 ? (
          <div
            className="stadium-card"
            style={{ padding: 'clamp(24px, 6vw, 48px)', textAlign: 'center', borderStyle: 'dashed' }}
          >
            <Icon.Scout size={40} style={{ color: 'var(--text-mute)', margin: '0 auto 12px' }} />
            <div className="display" style={{ fontSize: 18, marginBottom: 6 }}>
              No squads to scout
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 13, maxWidth: 480, margin: '0 auto' }}>
              {publicPortfolios.length === 0
                ? 'Be the first to make a squad public — your XI will show up here for everyone.'
                : 'No squads match this filter. Try a different formation or sort.'}
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            {filteredPortfolios.map((portfolio) => (
              <ScoutCard
                key={portfolio.id}
                portfolio={portfolio}
                performance={perfMap.get(portfolio.id)?.performance}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

/* Build a Pitch lineup from a real portfolio. Maps portfolio position ids → ticker symbols. */
function portfolioToLineup(portfolio: Portfolio): Record<string, PitchPlayer> {
  const lineup: Record<string, PitchPlayer> = {};
  portfolio.players.forEach((p) => {
    if (p.asset) {
      lineup[p.positionId.toLowerCase()] = {
        sym: p.asset.symbol,
        dayChangePct: p.asset.dayChangePercent,
        weight: p.allocation,
      };
    }
  });
  return lineup;
}

/* Coerce the portfolio formation to one of the formations the Pitch component supports.
   The Portfolio type allows 6 formations but only 3 are visualised — fall back gracefully. */
function safeFormation(f: Formation): FormationName {
  if (f in PITCH_FORMATIONS) return f as FormationName;
  return '4-3-3';
}

const ScoutCard: React.FC<{ portfolio: Portfolio; performance?: PortfolioPerformance }> = ({
  portfolio,
  performance,
}) => {
  const router = useRouter();
  const { currentUser, likePortfolio, clonePortfolio, followUser, unfollowUser } = useStore();
  const [isCloning, setIsCloning] = useState(false);
  /* Owner's username for the "View profile" click-through. ScoutCard
     doesn't get the username via props, so fetch by id once. Cached
     in component state is fine — Scout grid mounts at most ~50 cards
     in one viewport. */
  const [ownerUsername, setOwnerUsername] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (currentUser?.id === portfolio.userId) {
      setOwnerUsername(currentUser.username);
      return;
    }
    fetch(`/api/users?id=${portfolio.userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.success && data.user?.username) {
          setOwnerUsername(data.user.username);
        }
      })
      .catch(() => {/* leave null — fall back to "View manager" label */});
    return () => { cancelled = true; };
  }, [portfolio.userId, currentUser]);
  const hasLiked = currentUser ? portfolio.likes.includes(currentUser.id) : false;
  const isOwnSquad = currentUser?.id === portfolio.userId;
  const isFollowing = currentUser
    ? currentUser.following.includes(portfolio.userId)
    : false;
  const perf = performance || calculatePortfolioPerformance(portfolio);
  const positive = perf.totalReturnPercent >= 0;

  const lineup = useMemo(() => portfolioToLineup(portfolio), [portfolio]);
  const formationForPitch = safeFormation(portfolio.formation);

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentUser) likePortfolio(portfolio.id);
  };

  const handleClone = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser || isCloning) return;
    setIsCloning(true);
    try {
      const cloned = await clonePortfolio(portfolio.id);
      if (cloned) router.push(`/portfolio/${cloned.id}`);
    } finally {
      setIsCloning(false);
    }
  };

  const handleFollowToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser || isOwnSquad) return;
    if (isFollowing) unfollowUser(portfolio.userId);
    else followUser(portfolio.userId);
  };

  return (
    <Link
      href={`/portfolio/${portfolio.id}`}
      className="stadium-card"
      style={{
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
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
      {/* Header row: name + return */}
      <div className="flex items-start justify-between" style={{ gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div
            className="display"
            style={{
              fontSize: 16,
              letterSpacing: '-0.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {portfolio.name}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
            {portfolio.formation} · {getRelativeTime(portfolio.createdAt)}
          </div>
          {/* @username click-through to the manager's profile.
              Nested anchors are invalid (outer card is a Link), so use
              a button + router.push and stop propagation. */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push(`/profile/${portfolio.userId}`);
            }}
            aria-label={
              ownerUsername
                ? `View manager @${ownerUsername}`
                : 'View manager profile'
            }
            className="mono"
            style={{
              marginTop: 4,
              padding: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 10,
              color: 'var(--pitch)',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textAlign: 'left',
            }}
          >
            @{ownerUsername || '…'}
          </button>
        </div>
        <div
          className="display num"
          style={{
            fontSize: 22,
            color: positive ? 'var(--pitch)' : 'var(--ref-red)',
            letterSpacing: '-0.04em',
            flexShrink: 0,
          }}
        >
          {formatPercent(perf.totalReturnPercent)}
        </div>
      </div>

      {/* Mini tactics-pitch preview — the signature design element */}
      <div style={{ maxWidth: 160, margin: '0 auto', width: '100%' }}>
        <Pitch
          formation={formationForPitch}
          lineup={lineup}
          variant="tactics"
          size="sm"
          showFormationLabel={false}
        />
      </div>

      {/* Stats row */}
      <div
        className="flex justify-between"
        style={{
          fontSize: 10,
          color: 'var(--text-mute)',
          paddingTop: 10,
          borderTop: '1px solid var(--line)',
        }}
      >
        <Stat label="LIKES" value={portfolio.likes.length} />
        <Stat label="CLONES" value={portfolio.cloneCount} />
        <Stat label="FILLED" value={`${portfolio.players.filter((p) => p.asset).length}/11`} />
      </div>

      {/* Actions */}
      <div className="flex" style={{ gap: 6 }}>
        {!isOwnSquad && currentUser && (
          <button
            type="button"
            onClick={handleFollowToggle}
            className="stadium-btn stadium-btn-ghost"
            title={isFollowing ? 'Stop following this manager' : 'Follow this manager'}
            style={{
              flex: 1,
              justifyContent: 'center',
              padding: '6px 10px',
              fontSize: 11,
              color: isFollowing ? 'var(--pitch)' : undefined,
              borderColor: isFollowing ? 'oklch(0.72 0.21 145 / 0.35)' : undefined,
              background: isFollowing ? 'oklch(0.72 0.21 145 / 0.08)' : undefined,
            }}
          >
            {isFollowing ? 'Following ✓' : 'Follow'}
          </button>
        )}
        <button
          type="button"
          onClick={handleLike}
          className="stadium-btn stadium-btn-ghost"
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: '6px 10px',
            fontSize: 11,
            color: hasLiked ? 'var(--ref-red)' : undefined,
            borderColor: hasLiked ? 'oklch(0.65 0.22 25 / 0.3)' : undefined,
            background: hasLiked ? 'oklch(0.65 0.22 25 / 0.08)' : undefined,
          }}
        >
          {hasLiked ? '♥' : '♡'} {portfolio.likes.length}
        </button>
        <button
          type="button"
          onClick={handleClone}
          disabled={isCloning}
          className="stadium-btn stadium-btn-primary"
          style={{
            flex: 1.4,
            justifyContent: 'center',
            padding: '6px 10px',
            fontSize: 11,
          }}
        >
          <Icon.Lineup size={12} /> {isCloning ? 'Cloning…' : 'Clone formation'}
        </button>
      </div>
    </Link>
  );
};

const Stat: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div style={{ textAlign: 'center' }}>
    <div className="kicker" style={{ fontSize: 8 }}>{label}</div>
    <div className="mono num" style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700, marginTop: 2 }}>
      {value}
    </div>
  </div>
);
