'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { PortfolioPerformance, Portfolio, LeaderboardEntry } from '@/types';
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { fetchMultiplePortfolioPerformances } from '@/hooks/usePortfolioRealPerformance';
import { Icon } from '@/components/stadium/Icon';

export const LeaderboardTable: React.FC = () => {
  const { publicPortfolios, portfolios, currentUser, refreshPortfolios } = useStore();
  const [realPerformances, setRealPerformances] = useState<Map<string, { performance: PortfolioPerformance; isRealData: boolean }>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [usernames, setUsernames] = useState<Map<string, { username: string; avatar: string }>>(new Map());

  // Combine public portfolios with current user's portfolios (avoiding duplicates)
  const allPortfolios = useMemo(() => {
    const portfolioMap = new Map<string, Portfolio>();
    publicPortfolios.forEach((p) => portfolioMap.set(p.id, p));
    portfolios.forEach((p) => {
      if (p.isPublic) portfolioMap.set(p.id, p);
    });
    return Array.from(portfolioMap.values());
  }, [publicPortfolios, portfolios]);

  useEffect(() => {
    refreshPortfolios();
  }, [refreshPortfolios]);

  useEffect(() => {
    if (allPortfolios.length === 0) return;
    const fetchUsernames = async () => {
      const userIds = [...new Set(allPortfolios.map((p) => p.userId))];
      const newUsernames = new Map<string, { username: string; avatar: string }>();
      const idsToFetch: string[] = [];
      for (const userId of userIds) {
        if (currentUser && userId === currentUser.id) {
          newUsernames.set(userId, {
            username: currentUser.username,
            avatar: currentUser.avatar || '/default-avatar.png',
          });
        } else {
          idsToFetch.push(userId);
        }
      }
      if (idsToFetch.length > 0) {
        try {
          const response = await fetch(`/api/users?ids=${idsToFetch.join(',')}`);
          const data = await response.json();
          if (data.success && data.users) {
            for (const id of idsToFetch) {
              const u = data.users[id];
              newUsernames.set(id, {
                username: u?.username || 'Unknown',
                avatar: u?.avatar || '/default-avatar.png',
              });
            }
          }
        } catch (error) {
          console.error('Failed to fetch usernames batch:', error);
          for (const id of idsToFetch) {
            newUsernames.set(id, { username: 'Unknown', avatar: '/default-avatar.png' });
          }
        }
      }
      setUsernames(newUsernames);
    };
    fetchUsernames();
  }, [allPortfolios, currentUser]);

  useEffect(() => {
    if (allPortfolios.length === 0) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const performances = await fetchMultiplePortfolioPerformances(allPortfolios, '1M', true);
        setRealPerformances(performances);
      } catch (error) {
        console.error('Failed to fetch leaderboard performances:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [allPortfolios]);

  const entries = useMemo(() => {
    const leaderboardEntries: LeaderboardEntry[] = allPortfolios.map((portfolio) => {
      const userData = usernames.get(portfolio.userId);
      const realData = realPerformances.get(portfolio.id);
      return {
        rank: 0,
        userId: portfolio.userId,
        username: userData?.username || 'Loading…',
        avatar: userData?.avatar || '/default-avatar.png',
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
        formation: portfolio.formation,
        value: realData?.performance.totalValue || 10000,
        returnPercent: realData?.performance.totalReturnPercent || 0,
        followers: 0,
        createdAt: portfolio.createdAt,
      };
    });
    return leaderboardEntries
      .sort((a, b) => b.returnPercent - a.returnPercent)
      .map((entry, index) => ({ ...entry, rank: index + 1 }))
      .slice(0, 20);
  }, [allPortfolios, usernames, realPerformances]);

  return (
    <div className="stadium-card" style={{ overflow: 'hidden' }}>
      {/* Empty state stays OUTSIDE the scroll wrapper — it's a single
          centred message that should fill the card, not be scrolled. */}
      {entries.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Icon.Trophy size={36} style={{ color: 'var(--text-mute)', margin: '0 auto 12px' }} />
          <div className="display" style={{ fontSize: 16, marginBottom: 4 }}>
            Leaderboard fills up as managers go public.
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)' }}>
            Make your squad public to climb the table.
          </div>
        </div>
      ) : (
        /* Wrap the header + grid rows in a horizontal-scroll region so
           the 720px+ track stays legible on phones (≤375px viewports
           previously chopped 3 columns off the end). Mirrors the
           pattern used on Market and Holdings. */
        <div className="stadium-table-scroll">
          <div style={{ minWidth: 720 }}>
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '54px minmax(180px, 1.6fr) minmax(140px, 1.2fr) 110px 100px 110px',
                gap: 12,
                padding: '12px 18px',
                background: 'var(--surface-2)',
                borderBottom: '1px solid var(--line)',
              }}
            >
              {['POS', 'MANAGER', 'SQUAD', 'STARTED', 'VALUE', 'RETURN'].map((h, i) => (
                <div
                  key={h}
                  className="kicker"
                  style={{ fontSize: 9, textAlign: i >= 4 ? 'right' : 'left' }}
                >
                  {h}
                </div>
              ))}
            </div>

            {entries.map((entry, i) => {
          const isYou = currentUser?.id === entry.userId;
          const podiumColor =
            entry.rank === 1
              ? 'oklch(0.83 0.18 90)'
              : entry.rank === 2
              ? 'oklch(0.78 0.01 250)'
              : entry.rank === 3
              ? 'oklch(0.55 0.14 50)'
              : 'var(--text-dim)';
          return (
            // Row wraps a Link so tapping anywhere on the manager/squad
            // navigates straight to that squad detail page. Hover/active
            // states are preserved via the inline handlers below.
            <Link
              key={`${entry.portfolioId}-${i}`}
              href={`/portfolio/${entry.portfolioId}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '54px minmax(180px, 1.6fr) minmax(140px, 1.2fr) 110px 100px 110px',
                gap: 12,
                padding: '12px 18px',
                alignItems: 'center',
                borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                background: isYou ? 'var(--pitch-tint)' : 'transparent',
                transition: 'background .12s ease',
                color: 'inherit',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isYou) e.currentTarget.style.background = 'var(--surface-2)';
              }}
              onMouseLeave={(e) => {
                if (!isYou) e.currentTarget.style.background = 'transparent';
              }}
              aria-label={`View ${entry.portfolioName} squad by @${entry.username}`}
            >
              {/* Rank */}
              <div
                className="display num"
                style={{
                  fontSize: 22,
                  letterSpacing: '-0.05em',
                  color: podiumColor,
                  lineHeight: 1,
                }}
              >
                {String(entry.rank).padStart(2, '0')}
              </div>

              {/* Manager */}
              <div className="flex items-center" style={{ gap: 10, minWidth: 0 }}>
                <img
                  src={entry.avatar}
                  alt={entry.username}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    border: '1px solid var(--line)',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div className="flex items-center" style={{ gap: 6 }}>
                    <span
                      className="display"
                      style={{
                        fontSize: 13,
                        letterSpacing: '-0.01em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      @{entry.username}
                    </span>
                    {isYou && (
                      <span className="pill pill-pitch" style={{ padding: '1px 5px', fontSize: 9 }}>
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
                    {entry.followers} followers
                  </div>
                </div>
              </div>

              {/* Squad — was its own <Link>, but the whole row now
                  navigates, so a nested anchor is invalid HTML.
                  Plain div with the same visual style. */}
              <div style={{ minWidth: 0 }}>
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
                  {entry.portfolioName}
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
                  {entry.formation}
                </div>
              </div>

              {/* Started */}
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {formatDate(entry.createdAt)}
              </div>

              {/* Value */}
              <div className="mono num" style={{ fontSize: 12, textAlign: 'right' }}>
                {formatCurrency(entry.value)}
              </div>

              {/* Return */}
              <div style={{ textAlign: 'right' }}>
                {isLoading ? (
                  <div
                    style={{
                      width: 60,
                      height: 16,
                      background: 'var(--surface-2)',
                      borderRadius: 2,
                      marginLeft: 'auto',
                    }}
                  />
                ) : (
                  <span
                    className="mono num"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 14,
                      fontWeight: 700,
                      color: entry.returnPercent >= 0 ? 'var(--pitch)' : 'var(--ref-red)',
                    }}
                  >
                    {entry.returnPercent >= 0 ? (
                      <Icon.ArrowUp size={11} />
                    ) : (
                      <Icon.ArrowDown size={11} />
                    )}
                    {formatPercent(entry.returnPercent, false)}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
          </div>
        </div>
      )}
    </div>
  );
};
