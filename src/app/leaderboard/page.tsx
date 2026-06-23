'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppLayout, LeaderboardTable } from '@/components';
import { Icon } from '@/components/stadium/Icon';
import { useStore } from '@/store/useStore';
import { formatPercent, calculatePortfolioPerformance } from '@/lib/utils';
import { fetchMultiplePortfolioPerformances } from '@/hooks/usePortfolioRealPerformance';
import { Portfolio, PortfolioPerformance } from '@/types';

type Rank = 1 | 2 | 3;

type PodiumEntry = {
  rank: Rank;
  portfolioId: string;
  portfolioName: string;
  username: string;
  avatar: string;
  formation: string;
  returnPercent: number;
};

export default function LeaderboardPage() {
  const { publicPortfolios, portfolios, currentUser, refreshPortfolios } = useStore();
  const [realPerformances, setRealPerformances] = useState<
    Map<string, { performance: PortfolioPerformance; isRealData: boolean }>
  >(new Map());
  const [usernames, setUsernames] = useState<Map<string, { username: string; avatar: string }>>(new Map());

  useEffect(() => {
    refreshPortfolios();
  }, [refreshPortfolios]);

  // Combine public portfolios with the user's own public ones (mirrors LeaderboardTable)
  const allPortfolios = useMemo<Portfolio[]>(() => {
    const map = new Map<string, Portfolio>();
    publicPortfolios.forEach((p) => map.set(p.id, p));
    portfolios.forEach((p) => {
      if (p.isPublic) map.set(p.id, p);
    });
    return Array.from(map.values());
  }, [publicPortfolios, portfolios]);

  // Fetch real per-portfolio performance
  useEffect(() => {
    if (allPortfolios.length === 0) return;
    const run = async () => {
      try {
        const performances = await fetchMultiplePortfolioPerformances(allPortfolios, '1M', true);
        setRealPerformances(performances);
      } catch (err) {
        console.error('Failed to fetch podium performances:', err);
      }
    };
    run();
  }, [allPortfolios]);

  // Fetch usernames for each portfolio owner in a single batched request
  // so the podium doesn't show @… placeholders for 1-2 seconds while N
  // serial fetches resolve one at a time.
  useEffect(() => {
    if (allPortfolios.length === 0) return;
    const fetchUsernames = async () => {
      const userIds = [...new Set(allPortfolios.map((p) => p.userId))];
      const next = new Map<string, { username: string; avatar: string }>();
      const idsToFetch: string[] = [];
      for (const userId of userIds) {
        if (currentUser && userId === currentUser.id) {
          next.set(userId, {
            username: currentUser.username,
            avatar: currentUser.avatar || '/default-avatar.png',
          });
        } else {
          idsToFetch.push(userId);
        }
      }
      if (idsToFetch.length > 0) {
        try {
          const res = await fetch(`/api/users?ids=${idsToFetch.join(',')}`);
          const data = await res.json();
          if (data.success && data.users) {
            for (const id of idsToFetch) {
              const u = data.users[id];
              next.set(id, {
                username: u?.username || 'Unknown',
                avatar: u?.avatar || '/default-avatar.png',
              });
            }
          }
        } catch {
          for (const id of idsToFetch) {
            next.set(id, { username: 'Unknown', avatar: '/default-avatar.png' });
          }
        }
      }
      setUsernames(next);
    };
    fetchUsernames();
  }, [allPortfolios, currentUser]);

  const podium = useMemo<PodiumEntry[]>(() => {
    if (allPortfolios.length === 0) return [];
    return allPortfolios
      .map((p) => {
        const user = usernames.get(p.userId);
        const real = realPerformances.get(p.id);
        const perf = real?.performance || calculatePortfolioPerformance(p);
        return {
          portfolioId: p.id,
          portfolioName: p.name,
          formation: p.formation,
          username: user?.username || '…',
          avatar: user?.avatar || '/default-avatar.png',
          returnPercent: perf.totalReturnPercent,
        };
      })
      .sort((a, b) => b.returnPercent - a.returnPercent)
      .slice(0, 3)
      .map((e, i) => ({ ...e, rank: (i + 1) as Rank }));
  }, [allPortfolios, usernames, realPerformances]);

  return (
    <AppLayout flush>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between" style={{ gap: 14 }}>
          <div>
            <div className="kicker">SEASON 1 · ALL DIVISIONS</div>
            <h1
              className="display"
              style={{ fontSize: 'clamp(24px, 3vw, 32px)', letterSpacing: '-0.04em', margin: '2px 0 0' }}
            >
              League Table
            </h1>
            <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 6 }}>
              Top performers earn badges, an armband, and bragging rights all season.
            </div>
          </div>
        </div>

        {/* Podium. Mobile stacks champion → runner-up → 3rd. Desktop
            re-orders to the 2-1-3 staggered podium via CSS order
            classes on each card (set in PodiumCard / Placeholder). */}
        {podium.length > 0 && (
          <div className="grid gap-3 sm:items-end [grid-template-columns:1fr] sm:[grid-template-columns:repeat(3,1fr)]">
            {[
              podium.find((t) => t.rank === 2),
              podium.find((t) => t.rank === 1),
              podium.find((t) => t.rank === 3),
            ].map((entry, idx) =>
              entry ? (
                <PodiumCard key={entry.portfolioId} entry={entry} />
              ) : (
                <PodiumPlaceholder key={`empty-${idx}`} rank={(idx === 0 ? 2 : idx === 1 ? 1 : 3) as Rank} />
              ),
            )}
          </div>
        )}

        {/* Full table (now stadium-styled) */}
        <LeaderboardTable />
      </div>
    </AppLayout>
  );
}

const RANK_COLORS: Record<Rank, { color: string; height: number; label: string }> = {
  1: { color: 'oklch(0.83 0.18 90)',  height: 200, label: 'CHAMPION'    },
  2: { color: 'oklch(0.78 0.01 250)', height: 170, label: 'RUNNER-UP'   },
  3: { color: 'oklch(0.55 0.14 50)',  height: 150, label: '3RD PLACE'   },
};

/* Mobile order puts CHAMPION on top (rank 1 first, then 2, then 3).
   Desktop reverts to the 2-1-3 staggered podium effect. */
const orderClassFor = (rank: Rank): string =>
  rank === 1
    ? 'order-1 sm:order-2'
    : rank === 2
    ? 'order-2 sm:order-1'
    : 'order-3 sm:order-3';

const heightClassFor = (rank: Rank): string =>
  rank === 1
    ? 'h-auto sm:h-[200px]'
    : rank === 2
    ? 'h-auto sm:h-[170px]'
    : 'h-auto sm:h-[150px]';

const PodiumCard: React.FC<{ entry: PodiumEntry }> = ({ entry }) => {
  const cfg = RANK_COLORS[entry.rank];
  return (
    <Link
      href={`/portfolio/${entry.portfolioId}`}
      className={`${orderClassFor(entry.rank)} ${heightClassFor(entry.rank)} relative block no-underline`}
      style={{ color: 'inherit' }}
      aria-label={`View ${entry.portfolioName} squad by @${entry.username}`}
    >
      <div
        className="stadium-card"
        style={{
          height: '100%',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderTop: `4px solid ${cfg.color}`,
          cursor: 'pointer',
        }}
      >
        <div className="flex justify-between" style={{ alignItems: 'flex-start' }}>
          <div
            className="display num"
            style={{ fontSize: 40, color: cfg.color, letterSpacing: '-0.06em', lineHeight: 0.9 }}
          >
            {String(entry.rank).padStart(2, '0')}
          </div>
          <Icon.Trophy size={24} style={{ color: cfg.color }} />
        </div>
        <div>
          <div className="kicker" style={{ color: cfg.color }}>
            {cfg.label}
          </div>
          <div
            className="display"
            style={{
              fontSize: 15,
              letterSpacing: '-0.02em',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.portfolioName}
          </div>
          <div className="flex items-center" style={{ gap: 6, marginTop: 4 }}>
            <img
              src={entry.avatar}
              alt={entry.username}
              style={{
                width: 18,
                height: 18,
                borderRadius: 3,
                border: '1px solid var(--line)',
                objectFit: 'cover',
              }}
            />
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
              @{entry.username} · {entry.formation}
            </span>
          </div>
          <div
            className="display num"
            style={{
              fontSize: 22,
              color: entry.returnPercent >= 0 ? 'var(--pitch)' : 'var(--ref-red)',
              marginTop: 6,
              letterSpacing: '-0.04em',
            }}
          >
            {formatPercent(entry.returnPercent)}
          </div>
        </div>
      </div>
    </Link>
  );
};

const PodiumPlaceholder: React.FC<{ rank: Rank }> = ({ rank }) => {
  const cfg = RANK_COLORS[rank];
  return (
    <div className={`${orderClassFor(rank)} ${heightClassFor(rank)} relative`}>
      <div
        className="stadium-card"
        style={{
          height: '100%',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderTop: `4px solid ${cfg.color}`,
          borderStyle: 'dashed',
          opacity: 0.5,
        }}
      >
        <div
          className="display num"
          style={{ fontSize: 40, color: cfg.color, letterSpacing: '-0.06em', lineHeight: 0.9, opacity: 0.5 }}
        >
          {String(rank).padStart(2, '0')}
        </div>
        <div>
          <div className="kicker" style={{ color: cfg.color, opacity: 0.6 }}>
            {cfg.label}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 4 }}>
            Vacant — make your squad public to claim
          </div>
        </div>
      </div>
    </div>
  );
};
