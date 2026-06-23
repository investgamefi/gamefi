'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { AppLayout, Modal, Input } from '@/components';
import { Icon } from '@/components/stadium/Icon';
import { Formation, FORMATIONS, PortfolioPerformance, TEAM_SLOT_UNLOCK_COST, Challenge } from '@/types';
import {
  formatCurrency,
  formatPercent,
  calculateLevel,
  calculatePortfolioPerformance,
  getLeaderboardEntries,
} from '@/lib/utils';
import { fetchMultiplePortfolioPerformances } from '@/hooks/usePortfolioRealPerformance';
import { fetchBenchmarkHistoricalData } from '@/lib/benchmarkData';
import { MOCK_ASSETS } from '@/data/assets';

/* Real SPY benchmark snapshot fetched on mount — used by the Scoreboard
   instead of the hardcoded editorial numbers. */
type SpySnapshot = {
  totalReturnPct: number;          // 1M lifetime return for the YOU-vs-SPY comparison
  todayPct: number;                // day change pct
  latestPrice: number;             // last close
  normalized: { date: string; value: number }[]; // 1M series normalized to 100
};

/* Universe sampled by the Transfer Wire — large-cap names across sectors.
   We fetch live quotes for all of them, then pick the top 6 by |day change|
   so the strip actually surfaces today's biggest movers instead of a
   hardcoded marketing list. */
const MOVER_UNIVERSE: string[] = (() => {
  // 24 large-cap tickers spanning Tech / Healthcare / Financial / Energy /
  // Consumer / Comms. Pulled from MOCK_ASSETS so we stay aligned with the
  // app's coverage list and don't fetch tickers the platform can't trade.
  const symbols = [
    'AAPL', 'MSFT', 'NVDA', 'AMD', 'INTC', 'AVGO', 'CRM', 'ORCL',
    'JPM', 'V', 'BAC', 'GS',
    'UNH', 'JNJ', 'LLY', 'PFE',
    'XOM', 'CVX',
    'AMZN', 'TSLA', 'META', 'GOOGL',
    'WMT', 'COST',
  ];
  // Filter to only symbols that exist in MOCK_ASSETS so the cards link to
  // real assets on the market page.
  const known = new Set(MOCK_ASSETS.map((a) => a.symbol.toUpperCase()));
  return symbols.filter((s) => known.has(s));
})();
const MOVER_DISPLAY_COUNT = 6;

type Mover = {
  sym: string;
  sector: string;
  px: number | null;
  change: number | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const {
    currentUser,
    portfolios,
    createPortfolio,
    canCreateSquad,
    getSquadSlotInfo,
    unlockSquadSlot,
    activeChallenges,
    pendingChallenges,
    loadChallenges,
  } = useStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioDesc, setNewPortfolioDesc] = useState('');
  const [selectedFormation, setSelectedFormation] = useState<Formation>('4-3-3');

  const [realPerformances, setRealPerformances] = useState<
    Map<string, { performance: PortfolioPerformance; isRealData: boolean }>
  >(new Map());
  const [loadingStats, setLoadingStats] = useState(false);

  const [topPerformersData, setTopPerformersData] = useState<
    Map<string, { performance: PortfolioPerformance; isRealData: boolean }>
  >(new Map());
  const [loadingTopPerformers, setLoadingTopPerformers] = useState(false);

  // Real SPY benchmark snapshot for the Scoreboard + Sparkline
  const [spy, setSpy] = useState<SpySnapshot | null>(null);

  // Real top movers for the Transfer Wire. Starts as N skeleton cards while
  // we fetch quotes across MOVER_UNIVERSE; once results land we rank by
  // |dayChangePercent| and keep the top MOVER_DISPLAY_COUNT.
  const [movers, setMovers] = useState<Mover[]>(
    () =>
      Array.from({ length: MOVER_DISPLAY_COUNT }, (_, i) => ({
        sym: '',
        sector: '',
        px: null,
        change: null,
        // Stable React key for placeholder rows so we don't reuse skeleton DOM
        // nodes when the real movers swap in.
        _placeholder: `placeholder-${i}`,
      })) as unknown as Mover[],
  );

  // Fetch SPY 1M historical + latest quote on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hist, quoteRes] = await Promise.all([
          fetchBenchmarkHistoricalData('SPY', '1M'),
          fetch('/api/yahoo-finance?symbol=SPY').then((r) => r.json()),
        ]);
        if (cancelled) return;
        if (hist.length < 2 || !quoteRes?.success) return;
        const first = hist[0].close;
        const last = hist[hist.length - 1].close;
        const normalized = hist.map((d) => ({
          date: d.date,
          value: (d.close / first) * 100,
        }));
        setSpy({
          totalReturnPct: ((last - first) / first) * 100,
          todayPct: quoteRes.asset.dayChangePercent ?? 0,
          latestPrice: quoteRes.asset.currentPrice ?? last,
          normalized,
        });
      } catch (e) {
        console.error('Failed to fetch SPY benchmark:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch real quotes across MOVER_UNIVERSE in parallel, then rank by
  // absolute day-change % and keep the top N. This is the actual "hot
  // tickers this session" — not a hardcoded list.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      MOVER_UNIVERSE.map(async (sym): Promise<Mover | null> => {
        try {
          const res = await fetch(`/api/yahoo-finance?symbol=${sym}`);
          const data = await res.json();
          if (data.success && data.asset) {
            return {
              sym,
              sector: data.asset.sector || '',
              px: data.asset.currentPrice ?? null,
              change: data.asset.dayChangePercent ?? null,
            };
          }
        } catch {
          /* swallow per-symbol failure — we'll just have fewer candidates */
        }
        return null;
      }),
    ).then((results) => {
      if (cancelled) return;
      const ranked = results
        .filter((r): r is Mover => r != null && r.change != null)
        .sort((a, b) => Math.abs(b.change as number) - Math.abs(a.change as number))
        .slice(0, MOVER_DISPLAY_COUNT);
      // If everything failed, leave the skeletons up rather than blanking
      // the section.
      if (ranked.length > 0) setMovers(ranked);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Real perf for own portfolios
  useEffect(() => {
    if (portfolios.length === 0) return;
    const run = async () => {
      setLoadingStats(true);
      try {
        const performances = await fetchMultiplePortfolioPerformances(portfolios, '1M');
        setRealPerformances(performances);
      } catch (error) {
        console.error('Failed to fetch portfolio performances:', error);
      } finally {
        setLoadingStats(false);
      }
    };
    run();
  }, [portfolios]);

  /* loadChallenges chains loadLiveReturns internally once it sees an
     active fixture, so the Live Fixtures cards on the Dashboard pick
     up real %s without an extra effect here. */
  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  // Real perf for top performers (public portfolios)
  useEffect(() => {
    const baseEntries = getLeaderboardEntries('all', 5);
    if (baseEntries.length === 0) return;
    const run = async () => {
      setLoadingTopPerformers(true);
      try {
        const { portfolioStorage } = await import('@/lib/storage');
        const publicPortfolios = portfolioStorage.getPublic();
        const topPortfolios = publicPortfolios.filter((p) =>
          baseEntries.some((e) => e.portfolioId === p.id),
        );
        if (topPortfolios.length > 0) {
          const performances = await fetchMultiplePortfolioPerformances(topPortfolios, '1M');
          setTopPerformersData(performances);
        }
      } catch (error) {
        console.error('Failed to fetch top performers:', error);
      } finally {
        setLoadingTopPerformers(false);
      }
    };
    run();
  }, []);

  const portfolioStats = useMemo(() => {
    if (portfolios.length === 0) return null;
    const performances = portfolios.map((p) => {
      const realData = realPerformances.get(p.id);
      return realData?.performance || calculatePortfolioPerformance(p);
    });
    const totalValue = performances.reduce((sum, p) => sum + p.totalValue, 0);
    const totalReturn = performances.reduce((sum, p) => sum + p.totalReturn, 0);
    const avgReturnPercent =
      performances.reduce((sum, p) => sum + p.totalReturnPercent, 0) / performances.length;
    const dayReturnPercent =
      performances.reduce((sum, p) => sum + p.dayReturnPercent, 0) / performances.length;
    return {
      totalValue,
      totalReturn,
      avgReturnPercent,
      dayReturnPercent,
      count: portfolios.length,
      isLoading: loadingStats,
    };
  }, [portfolios, realPerformances, loadingStats]);

  const topPerformers = useMemo(() => {
    const baseEntries = getLeaderboardEntries('all', 5);
    return baseEntries
      .map((entry) => {
        const realData = topPerformersData.get(entry.portfolioId);
        if (realData?.isRealData) {
          return {
            ...entry,
            value: realData.performance.totalValue,
            returnPercent: realData.performance.totalReturnPercent,
          };
        }
        return entry;
      })
      .sort((a, b) => b.returnPercent - a.returnPercent)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [topPerformersData]);

  const levelInfo = currentUser ? calculateLevel(currentUser.xp) : null;
  const slotInfo = getSquadSlotInfo();

  const handleCreatePortfolio = async () => {
    if (!newPortfolioName.trim()) return;
    if (!canCreateSquad()) return;
    try {
      const portfolio = await createPortfolio(newPortfolioName, newPortfolioDesc, selectedFormation);
      setShowCreateModal(false);
      setNewPortfolioName('');
      setNewPortfolioDesc('');
      /* Land on the bulk-sign page so the user fills all 22 slots in one
         screen instead of clicking each position individually. */
      router.push(`/portfolio/${portfolio.id}/sign`);
    } catch (error) {
      console.error('Failed to create portfolio:', error);
    }
  };

  // Use real SPY 1M return when loaded, fall back to a neutral 0 so the math
  // works while data is still in flight.
  const benchmarkReturn = spy?.totalReturnPct ?? 0;
  const yourReturn = portfolioStats?.avgReturnPercent ?? 0;
  const lead = yourReturn - benchmarkReturn;

  // Combined user equity curve normalized to 100 for the sparkline overlay
  const youCurve = useMemo(() => {
    if (portfolios.length === 0) return [];
    // Aggregate per-portfolio historicalData by date
    const totals = new Map<string, number>();
    portfolios.forEach((p) => {
      const real = realPerformances.get(p.id);
      const hist = real?.performance.historicalData;
      if (!hist || hist.length === 0) return;
      hist.forEach((d) => totals.set(d.date, (totals.get(d.date) || 0) + d.value));
    });
    if (totals.size < 2) return [];
    const sorted = Array.from(totals.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
    const first = sorted[0][1];
    if (first <= 0) return [];
    return sorted.map(([date, value]) => ({ date, value: (value / first) * 100 }));
  }, [portfolios, realPerformances]);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <AppLayout flush>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Hero — Welcome + Scoreboard */}
        <div>
          <div className="flex flex-wrap items-baseline justify-between" style={{ marginBottom: 14, gap: 12 }}>
            <div>
              <div className="kicker">MATCHDAY · {today.toUpperCase()}</div>
              <div
                className="display"
                style={{ fontSize: 26, letterSpacing: '-0.04em', marginTop: 2 }}
              >
                Welcome back, {currentUser?.displayName}.
              </div>
            </div>
            <div className="flex" style={{ gap: 10 }}>
              <Link
                href="/challenges"
                className="stadium-btn stadium-btn-ghost"
                style={{ textDecoration: 'none' }}
              >
                <Icon.Fixture size={16} /> Fixtures
              </Link>
              <button
                type="button"
                className="stadium-btn stadium-btn-primary"
                onClick={() => setShowCreateModal(true)}
                disabled={!canCreateSquad()}
                style={{ opacity: canCreateSquad() ? 1 : 0.5, cursor: canCreateSquad() ? 'pointer' : 'not-allowed' }}
              >
                <Icon.Plus size={16} /> Build a new squad
              </button>
            </div>
          </div>

          <Scoreboard
            yourReturn={yourReturn}
            yourValue={portfolioStats?.totalValue ?? 0}
            todayPct={portfolioStats?.dayReturnPercent ?? 0}
            benchmarkReturn={benchmarkReturn}
            benchmarkTodayPct={spy?.todayPct ?? null}
            benchmarkPrice={spy?.latestPrice ?? null}
            lead={lead}
            isLoading={!!portfolioStats?.isLoading}
            youCurve={youCurve}
            benchmarkCurve={spy?.normalized ?? []}
          />
        </div>

        {/* Stats grid */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <StatTile
            kicker="EQUITY"
            value={portfolioStats ? formatCurrency(portfolioStats.totalValue) : '$0.00'}
            sub={portfolioStats ? `${formatPercent(portfolioStats.avgReturnPercent)} avg return` : null}
            tone={
              !portfolioStats
                ? undefined
                : portfolioStats.avgReturnPercent >= 0
                ? 'pos'
                : 'neg'
            }
            loading={portfolioStats?.isLoading}
          />
          <StatTile
            kicker="SQUADS"
            value={`${portfolios.length}`}
            sub={`${slotInfo.current} / ${slotInfo.max} slots used`}
          />
          <StatTile
            kicker="LEVEL"
            value={levelInfo ? `Lv.${levelInfo.level}` : 'Lv.1'}
            sub={levelInfo ? `${currentUser?.xp.toLocaleString()} XP` : null}
            tone="pos"
          />
          <StatTile
            kicker="LEAGUE"
            value={`${currentUser?.followers?.length ?? 0}`}
            sub="Followers"
          />
        </section>

        {/* Body grid: My Squads + sidebar — stacks on phones, splits at ≥ md */}
        <div
          className="dash-body-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 18,
          }}
        >
          {/* My Squads */}
          <section>
            <SectionHeader
              title="Your Squads"
              sub={`${slotInfo.current} of ${slotInfo.max} slots used`}
              right={
                <div className="flex items-center" style={{ gap: 8 }}>
                  {!canCreateSquad() && (
                    <button
                      type="button"
                      className="stadium-btn stadium-btn-ghost"
                      style={{ padding: '6px 12px', fontSize: 11 }}
                      onClick={async () => {
                        await unlockSquadSlot();
                      }}
                      disabled={!slotInfo.canUnlock}
                      title={
                        slotInfo.canUnlock
                          ? `Spend ${TEAM_SLOT_UNLOCK_COST} XP to unlock`
                          : `Need ${TEAM_SLOT_UNLOCK_COST} XP to unlock`
                      }
                    >
                      Unlock slot ({TEAM_SLOT_UNLOCK_COST} XP)
                    </button>
                  )}
                  <Link href="/portfolio" className="kicker" style={{ textDecoration: 'none' }}>
                    ALL SQUADS →
                  </Link>
                </div>
              }
            />

            {portfolios.length === 0 ? (
              <div
                className="stadium-card"
                style={{
                  padding: 'clamp(28px, 8vw, 60px)',
                  textAlign: 'center',
                  borderStyle: 'dashed',
                }}
              >
                <Icon.Pitch size={40} style={{ color: 'var(--text-mute)', margin: '0 auto 14px' }} />
                <div className="display" style={{ fontSize: 18, marginBottom: 6 }}>
                  No squads yet
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 18 }}>
                  Pick eleven tickers, set a formation, captain your top pick.
                </div>
                <button
                  type="button"
                  className="stadium-btn stadium-btn-primary"
                  onClick={() => setShowCreateModal(true)}
                  disabled={!canCreateSquad()}
                >
                  <Icon.Plus size={14} /> Field your first XI
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {portfolios.map((p) => {
                  const perf = realPerformances.get(p.id)?.performance || calculatePortfolioPerformance(p);
                  return (
                    <SquadRow
                      key={p.id}
                      id={p.id}
                      name={p.name}
                      formation={p.formation}
                      value={perf.totalValue}
                      returnPct={perf.totalReturnPercent}
                      dayPct={perf.dayReturnPercent}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* Sidebar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Live Fixtures */}
            <section>
              <SectionHeader
                title="Live Fixtures"
                right={
                  <Link href="/challenges" className="kicker" style={{ textDecoration: 'none' }}>
                    ALL
                  </Link>
                }
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(() => {
                  const myId = currentUser?.id;
                  // store already separates by status — no need to re-filter
                  const live = activeChallenges.slice(0, 2);
                  const upcoming = pendingChallenges.slice(0, 2 - live.length);
                  const shown = [...live, ...upcoming];
                  if (shown.length === 0) {
                    return (
                      <div
                        className="stadium-card"
                        style={{
                          padding: 20,
                          textAlign: 'center',
                          borderStyle: 'dashed',
                        }}
                      >
                        <div className="kicker" style={{ marginBottom: 6 }}>
                          NO FIXTURES SCHEDULED
                        </div>
                        <Link
                          href="/challenges"
                          className="stadium-btn stadium-btn-ghost"
                          style={{ textDecoration: 'none', padding: '8px 14px', fontSize: 12 }}
                        >
                          <Icon.Fixture size={14} /> Set up a fixture
                        </Link>
                      </div>
                    );
                  }
                  return shown.map((c) => (
                    <FixtureRow key={c.id} fixture={c} myUserId={myId} />
                  ));
                })()}
              </div>
            </section>

            <section>
              <SectionHeader
                title="League Table"
                right={
                  <Link href="/leaderboard" className="kicker" style={{ textDecoration: 'none' }}>
                    FULL
                  </Link>
                }
              />
              <div className="stadium-card" style={{ overflow: 'hidden' }}>
                {topPerformers.length === 0 ? (
                  <div
                    style={{
                      padding: 24,
                      textAlign: 'center',
                      color: 'var(--text-dim)',
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    Leaderboard fills up as managers go public.
                  </div>
                ) : (
                  topPerformers.map((entry, i) => (
                    <div
                      key={entry.portfolioId}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '32px 1fr auto',
                        gap: 10,
                        padding: '10px 14px',
                        borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        className="display num"
                        style={{
                          fontSize: 18,
                          color: entry.rank <= 3 ? 'var(--pitch)' : 'var(--text-dim)',
                        }}
                      >
                        {String(entry.rank).padStart(2, '0')}
                      </div>
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
                          @{entry.username}
                        </div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 10,
                            color: 'var(--text-mute)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {entry.portfolioName}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {loadingTopPerformers ? (
                          <div
                            style={{
                              width: 48,
                              height: 12,
                              background: 'var(--surface-2)',
                              borderRadius: 2,
                              animation: 'stadium-spin 1s linear infinite',
                            }}
                          />
                        ) : (
                          <div
                            className="mono num"
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: entry.returnPercent >= 0 ? 'var(--pitch)' : 'var(--ref-red)',
                            }}
                          >
                            {formatPercent(entry.returnPercent)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <SectionHeader title="Quick Actions" />
              <div className="stadium-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <QuickAction href="/explore" icon="Scout" label="Scout other managers" />
                <QuickAction href="/market" icon="Transfer" label="Open Transfer Market" />
                <QuickAction href="/leaderboard" icon="Trophy" label="Climb the League Table" />
                <QuickAction href="/challenges" icon="Fixture" label="Set up a Fixture" />
              </div>
            </section>
          </aside>
        </div>

        {/* Transfer Wire — real top movers selected from MOVER_UNIVERSE,
            ranked by |day change %|. While quotes are still loading we render
            MOVER_DISPLAY_COUNT skeleton cards so the strip never collapses. */}
        <section>
          <SectionHeader
            title="Transfer Wire"
            sub="Today's biggest movers"
            right={
              <Link
                href="/market"
                className="stadium-btn stadium-btn-ghost"
                style={{ textDecoration: 'none' }}
              >
                Open market <Icon.Arrow size={14} />
              </Link>
            }
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10,
            }}
          >
            {movers.map((m, i) => (
              // Use index for placeholder rows (sym === ''), real symbol otherwise
              <MoverCard key={m.sym || `mover-skeleton-${i}`} mover={m} />
            ))}
          </div>
        </section>
      </div>

      {/* Create Portfolio Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Build a new squad" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Input
            label="Squad Name"
            placeholder="e.g., Phoenix XI"
            value={newPortfolioName}
            onChange={(e) => setNewPortfolioName(e.target.value)}
          />

          <Input
            label="Description (Optional)"
            placeholder="Your tactical approach…"
            value={newPortfolioDesc}
            onChange={(e) => setNewPortfolioDesc(e.target.value)}
          />

          <div>
            <label
              style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                marginBottom: 10,
              }}
            >
              Pick a formation
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {(Object.keys(FORMATIONS) as Formation[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelectedFormation(f)}
                  style={{
                    padding: '14px 10px',
                    background: selectedFormation === f ? 'var(--pitch-tint)' : 'var(--surface)',
                    border: '1px solid ' + (selectedFormation === f ? 'var(--pitch)' : 'var(--line)'),
                    color: selectedFormation === f ? 'var(--pitch)' : 'var(--text)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex" style={{ gap: 10, paddingTop: 8 }}>
            <button
              type="button"
              className="stadium-btn stadium-btn-ghost"
              style={{ flex: 1, justifyContent: 'center', padding: '12px 20px' }}
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="stadium-btn stadium-btn-primary"
              style={{ flex: 1, justifyContent: 'center', padding: '12px 20px' }}
              onClick={handleCreatePortfolio}
              disabled={!newPortfolioName.trim() || !canCreateSquad()}
            >
              Field the XI
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}

const Scoreboard: React.FC<{
  yourReturn: number;
  yourValue: number;
  todayPct: number;
  benchmarkReturn: number;
  /** Today's % change for the benchmark (null while loading) */
  benchmarkTodayPct: number | null;
  /** Latest benchmark price (null while loading) */
  benchmarkPrice: number | null;
  lead: number;
  isLoading?: boolean;
  /** User's combined equity curve normalized to 100 */
  youCurve: { date: string; value: number }[];
  /** Benchmark series normalized to 100 */
  benchmarkCurve: { date: string; value: number }[];
}> = ({
  yourReturn,
  yourValue,
  todayPct,
  benchmarkReturn,
  benchmarkTodayPct,
  benchmarkPrice,
  lead,
  isLoading,
  youCurve,
  benchmarkCurve,
}) => {
  const yourSign = yourReturn >= 0 ? '+' : '';
  const benchSign = benchmarkReturn >= 0 ? '+' : '';
  const fmtIndex = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtTodayPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  return (
    <div
      style={{
        background: 'var(--ink)',
        color: '#fff',
        borderRadius: 12,
        padding: '20px 24px',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid var(--ink)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '6px 6px',
          pointerEvents: 'none',
        }}
      />

      <div
        className="flex items-center justify-between"
        style={{ position: 'relative', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}
      >
        <div className="flex items-center" style={{ gap: 12 }}>
          <span
            className="pill pill-red"
            style={{
              background: 'oklch(0.65 0.22 25 / 0.18)',
              borderColor: 'transparent',
              color: '#ff7766',
            }}
          >
            <span className="live-dot" /> LIVE
          </span>
          <span className="kicker" style={{ color: 'rgba(255,255,255,0.5)' }}>
            VS S&P 500 BENCHMARK
          </span>
        </div>
      </div>

      {/* Scoreboard: stacks vertically on phones so the centered LEAD
          column doesn't get visually overlapped by the big YOU/S&P
          numbers. Reverts to 3-col on >=640px. */}
      <div className="relative grid items-center gap-4 sm:gap-6 [grid-template-columns:1fr] sm:[grid-template-columns:minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div>
          <div className="kicker" style={{ color: 'rgba(255,255,255,0.5)' }}>YOU</div>
          <div
            className="display num scoreboard-num"
            style={{ fontSize: 'clamp(32px, 4.8vw, 60px)', marginTop: 2 }}
          >
            {isLoading ? '—' : `${yourSign}${yourReturn.toFixed(2)}`}
            <span className="display" style={{ fontSize: 24, opacity: 0.65 }}>%</span>
          </div>
          <div className="flex flex-wrap" style={{ gap: 16, marginTop: 8 }}>
            <ScoreboardStat label="EQUITY" value={formatCurrency(yourValue)} />
            <ScoreboardStat
              label="TODAY"
              value={`${todayPct >= 0 ? '+' : ''}${todayPct.toFixed(2)}%`}
              tone="pos"
            />
          </div>
        </div>

        <div className="flex flex-col items-center" style={{ gap: 4 }}>
          <div className="kicker" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {lead >= 0 ? 'YOUR LEAD' : 'BENCHMARK LEAD'}
          </div>
          <div
            className="display num"
            style={{
              fontSize: 'clamp(22px, 3vw, 36px)',
              color: lead >= 0 ? 'var(--pitch-glow)' : '#ff7766',
              letterSpacing: '-0.05em',
            }}
          >
            {lead >= 0 ? '+' : ''}
            {lead.toFixed(1)}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
            POINTS
          </div>
        </div>

        <div className="text-left sm:text-right">
          <div className="kicker" style={{ color: 'rgba(255,255,255,0.5)' }}>
            S&P 500
          </div>
          <div
            className="display num scoreboard-num"
            style={{ fontSize: 'clamp(32px, 4.8vw, 60px)', marginTop: 2 }}
          >
            {benchmarkPrice == null ? '—' : `${benchSign}${benchmarkReturn.toFixed(2)}`}
            <span className="display" style={{ fontSize: 24, opacity: 0.65 }}>%</span>
          </div>
          <div
            className="flex flex-wrap justify-start sm:justify-end"
            style={{ gap: 16, marginTop: 8 }}
          >
            <ScoreboardStat
              label="INDEX"
              value={benchmarkPrice != null ? fmtIndex(benchmarkPrice) : '—'}
              align="right"
            />
            <ScoreboardStat
              label="TODAY"
              value={benchmarkTodayPct != null ? fmtTodayPct(benchmarkTodayPct) : '—'}
              align="right"
              tone={
                benchmarkTodayPct == null
                  ? undefined
                  : benchmarkTodayPct >= 0
                  ? 'pos'
                  : 'neg'
              }
            />
          </div>
        </div>
      </div>

      {/* Sparkline — real you-vs-SPY equity curves when loaded, blank line when not */}
      <div style={{ position: 'relative', marginTop: 16, height: 44 }}>
        <Sparkline youCurve={youCurve} benchmarkCurve={benchmarkCurve} />
      </div>
    </div>
  );
};

/* Dual sparkline plotted from real normalized equity curves.
   - youCurve / benchmarkCurve are both normalized to 100 at the start of the period
   - When either series is missing, we just don't render that line
   - When BOTH are missing, render a faint baseline so the strip doesn't look broken */
const Sparkline: React.FC<{
  youCurve: { date: string; value: number }[];
  benchmarkCurve: { date: string; value: number }[];
}> = ({ youCurve, benchmarkCurve }) => {
  const W = 1000;
  const H = 56;

  // Build path from a series. Empty series → null.
  const path = (series: { value: number }[], min: number, max: number) => {
    if (series.length < 2) return null;
    const range = max - min || 1;
    return series
      .map((d, i) => {
        const x = (i / (series.length - 1)) * W;
        const y = H - 6 - ((d.value - min) / range) * (H - 12);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  const allValues = [...youCurve.map((d) => d.value), ...benchmarkCurve.map((d) => d.value)];
  const noData = allValues.length === 0;
  const min = noData ? 0 : Math.min(...allValues);
  const max = noData ? 100 : Math.max(...allValues);

  const youPath = path(youCurve, min, max);
  const benchPath = path(benchmarkCurve, min, max);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        <linearGradient id="sparkline-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--pitch-glow)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--pitch-glow)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Baseline when no data yet — keeps the strip from looking broken */}
      {noData && (
        <line
          x1="0"
          y1={H / 2}
          x2={W}
          y2={H / 2}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      )}

      {/* Benchmark line (dashed, dim) */}
      {benchPath && (
        <path
          d={benchPath}
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="2"
          fill="none"
          strokeDasharray="4 4"
        />
      )}

      {/* You line with green fill underneath */}
      {youPath && (
        <>
          <path d={`${youPath} L ${W} ${H} L 0 ${H} Z`} fill="url(#sparkline-fill)" opacity="0.3" />
          <path d={youPath} stroke="var(--pitch-glow)" strokeWidth="2.5" fill="none" />
        </>
      )}
    </svg>
  );
};

const ScoreboardStat: React.FC<{
  label: string;
  value: string;
  tone?: 'pos' | 'neg';
  align?: 'left' | 'right';
}> = ({ label, value, tone, align = 'left' }) => (
  <div style={{ textAlign: align }}>
    <div className="kicker" style={{ color: 'rgba(255,255,255,0.4)' }}>
      {label}
    </div>
    <div
      className="mono num"
      style={{
        fontSize: 14,
        color: tone === 'pos' ? 'var(--pitch-glow)' : tone === 'neg' ? '#ff7766' : '#fff',
      }}
    >
      {value}
    </div>
  </div>
);

const StatTile: React.FC<{
  kicker: string;
  value: string;
  sub?: string | null;
  tone?: 'pos' | 'neg';
  loading?: boolean;
}> = ({ kicker, value, sub, tone, loading }) => (
  <div className="stadium-card" style={{ padding: 14 }}>
    <div className="kicker">{kicker}</div>
    <div
      className="display num"
      style={{
        fontSize: 22,
        letterSpacing: '-0.04em',
        marginTop: 4,
        color: 'var(--text)',
      }}
    >
      {value}
    </div>
    {loading ? (
      <div
        style={{
          marginTop: 6,
          width: 80,
          height: 10,
          background: 'var(--surface-2)',
          borderRadius: 2,
        }}
      />
    ) : sub ? (
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: tone === 'pos' ? 'var(--pitch)' : tone === 'neg' ? 'var(--ref-red)' : 'var(--text-mute)',
          marginTop: 4,
        }}
      >
        {sub}
      </div>
    ) : null}
  </div>
);

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
      <div className="display" style={{ fontSize: 16, letterSpacing: '-0.03em' }}>
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

const SquadRow: React.FC<{
  id: string;
  name: string;
  formation: string;
  value: number;
  returnPct: number;
  dayPct: number;
}> = ({ id, name, formation, value, returnPct, dayPct }) => {
  const positive = returnPct >= 0;
  return (
    <Link
      href={`/portfolio/${id}`}
      className="stadium-card"
      style={{
        padding: 14,
        display: 'flex',
        gap: 14,
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
      <div
        style={{
          width: 72,
          flexShrink: 0,
          aspectRatio: '5 / 7',
          background: 'var(--surface-2)',
          backgroundImage:
            'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
          backgroundSize: '12px 12px',
          borderRadius: 6,
          border: '1px solid var(--line)',
          position: 'relative',
        }}
      >
        <div
          className="mono"
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--pitch)',
            letterSpacing: '0.16em',
          }}
        >
          {formation}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center justify-between" style={{ gap: 8 }}>
          <div
            className="display"
            style={{
              fontSize: 15,
              letterSpacing: '-0.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </div>
          <span className="pill">{formation}</span>
        </div>
        <div className="flex items-baseline" style={{ gap: 10, marginTop: 4 }}>
          <div
            className="display num"
            style={{
              fontSize: 22,
              color: positive ? 'var(--pitch)' : 'var(--ref-red)',
              letterSpacing: '-0.04em',
            }}
          >
            {formatPercent(returnPct)}
          </div>
          <div className="mono num" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {formatCurrency(value)}
          </div>
        </div>
        <div className="flex" style={{ gap: 18, marginTop: 8 }}>
          <div>
            <div className="kicker">TODAY</div>
            <div
              className="mono num"
              style={{
                fontSize: 12,
                color: dayPct >= 0 ? 'var(--pitch)' : 'var(--ref-red)',
                fontWeight: 600,
              }}
            >
              {formatPercent(dayPct)}
            </div>
          </div>
          <div>
            <div className="kicker">FORMATION</div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, letterSpacing: '0.1em' }}>
              {formation}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

const QuickAction: React.FC<{ href: string; icon: keyof typeof Icon; label: string }> = ({
  href,
  icon,
  label,
}) => {
  const IconCmp = Icon[icon] as React.FC<{ size?: number; style?: React.CSSProperties }>;
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 6,
        color: 'var(--text-dim)',
        textDecoration: 'none',
        fontFamily: 'var(--font-display)',
        fontSize: 13,
        fontWeight: 500,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
        (e.currentTarget as HTMLElement).style.color = 'var(--text)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)';
      }}
    >
      <IconCmp size={16} style={{ color: 'var(--pitch)' }} />
      {label}
    </Link>
  );
};

/* Live Fixtures row — renders a Challenge from the store as a stadium fixture card. */
const FixtureRow: React.FC<{ fixture: Challenge; myUserId?: string }> = ({ fixture, myUserId }) => {
  const isLive = fixture.status === 'active';
  const isPending = fixture.status === 'pending';
  const amChallenger = fixture.challengerId === myUserId;

  const myReturn = amChallenger ? fixture.challengerReturnPercent : fixture.opponentReturnPercent;
  const theirReturn = amChallenger ? fixture.opponentReturnPercent : fixture.challengerReturnPercent;
  const opponentName =
    fixture.type === 'sp500'
      ? 'S&P 500'
      : amChallenger
      ? fixture.opponentUsername || 'TBD'
      : fixture.challengerUsername || 'Challenger';

  const myStr = myReturn != null ? `${myReturn >= 0 ? '+' : ''}${myReturn.toFixed(2)}` : '—';
  const theirStr = theirReturn != null ? `${theirReturn >= 0 ? '+' : ''}${theirReturn.toFixed(2)}` : '—';
  const leading = myReturn != null && theirReturn != null && myReturn > theirReturn;

  // Calculate "ends in" for live, "kickoff" for pending
  const endStr = (() => {
    if (!fixture.endDate) return null;
    const ms = new Date(fixture.endDate).getTime() - Date.now();
    if (ms <= 0) return 'Closing';
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  })();
  const kickoffStr = fixture.startDate
    ? new Date(fixture.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '—';

  return (
    <Link
      href="/challenges"
      className="stadium-card"
      style={{
        padding: '14px 16px',
        display: 'grid',
        gridTemplateColumns: '60px 1fr auto',
        gap: 14,
        alignItems: 'center',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div>
        {isLive && (
          <div className="flex items-center" style={{ gap: 6 }}>
            <span className="live-dot" />
            <span
              className="mono"
              style={{ fontSize: 10, fontWeight: 700, color: 'var(--ref-red)' }}
            >
              LIVE
            </span>
          </div>
        )}
        {isPending && (
          <div
            className="mono"
            style={{ fontSize: 10, color: 'var(--text-mute)', fontWeight: 700, letterSpacing: '0.1em' }}
          >
            PENDING
          </div>
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <div className="kicker">
          {fixture.type === 'sp500' ? 'VS S&P 500' : 'VS MANAGER'} · {fixture.timeframe}
        </div>
        <div className="flex items-baseline" style={{ gap: 10, marginTop: 2 }}>
          <span className="display" style={{ fontSize: 14, letterSpacing: '-0.01em' }}>
            You
          </span>
          <span
            className="mono num"
            style={{
              fontSize: 12,
              color: leading ? 'var(--pitch)' : 'var(--text-dim)',
              fontWeight: 600,
            }}
          >
            {myStr}
          </span>
          <span className="kicker" style={{ opacity: 0.6 }}>
            VS
          </span>
          <span
            className="display"
            style={{
              fontSize: 14,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 100,
            }}
          >
            {opponentName}
          </span>
          <span
            className="mono num"
            style={{
              fontSize: 12,
              color: !leading && myReturn != null ? 'var(--ref-red)' : 'var(--text-dim)',
              fontWeight: 600,
            }}
          >
            {theirStr}
          </span>
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        {isLive && endStr && (
          <>
            <div className="kicker">ENDS IN</div>
            <div className="mono num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
              {endStr}
            </div>
          </>
        )}
        {isPending && (
          <>
            <div className="kicker">KICK-OFF</div>
            <div
              className="mono"
              style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)' }}
            >
              {kickoffStr}
            </div>
          </>
        )}
      </div>
    </Link>
  );
};

/* Transfer Wire card — renders a single ranked top mover. While the
   fetch is in flight we get placeholder rows with empty `sym` and null
   prices, which collapse to a skeleton view. */
const MoverCard: React.FC<{ mover: Mover }> = ({ mover }) => {
  const hasData = mover.px != null && mover.change != null;
  const up = hasData && (mover.change as number) >= 0;
  return (
    <Link
      href="/market"
      className="stadium-card"
      style={{
        padding: 12,
        textDecoration: 'none',
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        transition: 'border-color .15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--pitch)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--line)';
      }}
    >
      <div className="flex items-start justify-between">
        <div className="display num" style={{ fontSize: 16, letterSpacing: '-0.03em' }}>
          {mover.sym || (
            <span
              style={{
                display: 'inline-block',
                width: 48,
                height: 14,
                background: 'var(--surface-2)',
                borderRadius: 2,
              }}
              aria-hidden="true"
            />
          )}
        </div>
        {hasData ? (
          <div
            className={up ? 'pill pill-pitch' : 'pill pill-red'}
            style={{ padding: '2px 6px' }}
          >
            {up ? <Icon.ArrowUp size={10} /> : <Icon.ArrowDown size={10} />}
          </div>
        ) : (
          <span
            style={{
              width: 18,
              height: 12,
              background: 'var(--surface-2)',
              borderRadius: 2,
              display: 'inline-block',
            }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
        {mover.sector || '—'}
      </div>
      {hasData ? (
        <>
          <div
            className="mono num"
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: up ? 'var(--pitch)' : 'var(--ref-red)',
              marginTop: 4,
            }}
          >
            {up ? '+' : ''}
            {(mover.change as number).toFixed(2)}%
          </div>
          <div className="mono num" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            ${(mover.px as number).toFixed(2)}
          </div>
        </>
      ) : (
        <>
          {/* Skeleton — keeps the card height stable while real data loads */}
          <div
            style={{
              width: 64,
              height: 16,
              background: 'var(--surface-2)',
              borderRadius: 2,
              marginTop: 4,
            }}
          />
          <div
            style={{
              width: 48,
              height: 12,
              background: 'var(--surface-2)',
              borderRadius: 2,
              marginTop: 4,
            }}
          />
        </>
      )}
    </Link>
  );
};
