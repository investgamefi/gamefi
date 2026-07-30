'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useStore } from '@/store/useStore';
import { AppLayout } from '@/components';
import {
  PortfolioSelector,
  MetricComparisonChart,
  ComparisonTable,
  ComparisonCard,
  BenchmarkSelector,
  TimeframeSelector,
  PerformanceLineChart,
  CustomDateRangeSelector,
  CustomSymbolSearch,
} from '@/components/compare';
import {
  Portfolio,
  User,
  PortfolioPerformance,
  BenchmarkSymbol,
  BenchmarkPerformance,
  ComparisonTimeframe,
  CustomDateRange,
  CustomComparisonSymbol,
} from '@/types';
import { calculatePortfolioPerformance, formatPercent } from '@/lib/utils';
import {
  fetchBenchmarkHistoricalData,
  getMultipleBenchmarkPerformances,
  getMultipleCustomSymbolPerformances,
} from '@/lib/benchmarkData';
import { calculatePortfolioHistoricalData, calculateMetricsFromHistoricalData } from '@/lib/portfolioHistoricalData';
import { PortfolioHistoricalPoint } from '@/types';
import { fetchMultipleFundamentals, AssetFundamentals } from '@/lib/yahooFundamentals';
import { fetchQuotesBatch, LiveQuote } from '@/lib/yahooFinance';
import { Icon } from '@/components/stadium/Icon';

const MAX_PORTFOLIOS = 4;
const MIN_PORTFOLIOS = 1;

export default function ComparePage() {
  const { currentUser, loadData, portfolios, publicPortfolios } = useStore();
  const [selectedIds, setSelectedIds] = useState<string[]>(['']);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<BenchmarkSymbol[]>([]);
  const [timeframe, setTimeframe] = useState<ComparisonTimeframe>('1M');
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange | null>(null);
  const [customSymbols, setCustomSymbols] = useState<CustomComparisonSymbol[]>([]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Helper to get portfolio by ID from store
  const getPortfolioById = useCallback((id: string): Portfolio | null => {
    return portfolios.find(p => p.id === id) || publicPortfolios.find(p => p.id === id) || null;
  }, [portfolios, publicPortfolios]);

  /* --------------------------------------------------------------
     SWR-backed fetches (item 20). Each useSWR call gives us:
     - per-key cache + dedupe (re-mounting / switching back to the
       page reuses the cached payload)
     - automatic stale-while-revalidate handling — we never paint
       a response that's older than the current key
     - built-in cancellation on key change so old responses can't
       clobber newer state (Marcus's stale-response complaint)

     Keys are arrays so SWR's default hash distinguishes
     selection/timeframe permutations cleanly.
     -------------------------------------------------------------- */

  // SPY benchmark for alpha — always fetched, keyed on timeframe + range.
  const { data: spyBenchmarkReturn = null } = useSWR<number | null>(
    ['compare:spy-alpha', timeframe, customDateRange],
    async () => {
      const spyData = await fetchBenchmarkHistoricalData('SPY', timeframe, customDateRange);
      if (spyData.length <= 1) return null;
      const firstValue = spyData[0].close;
      const lastValue = spyData[spyData.length - 1].close;
      return ((lastValue - firstValue) / firstValue) * 100;
    },
    {
      /* Alpha is informational — don't churn the chart on focus.
         The data changes when the user picks a new timeframe, not
         on tab switches. */
      revalidateOnFocus: false,
    },
  );

  // Portfolio owners — keyed on the joined id list so adding/removing
  // a portfolio invalidates cleanly.
  const ownerIdsKey = useMemo(() => {
    const allPortfolios = [...portfolios, ...publicPortfolios];
    const ids = Array.from(new Set(allPortfolios.map((p) => p.userId))).sort();
    return ids.length > 0 ? ids : null;
  }, [portfolios, publicPortfolios]);

  const { data: users = new Map<string, User>() } = useSWR<Map<string, User>>(
    ownerIdsKey ? ['compare:users', ownerIdsKey] : null,
    async ([, ids]) => {
      const userMap = new Map<string, User>();
      await Promise.all(
        (ids as string[]).map(async (userId) => {
          try {
            const res = await fetch(`/api/users?id=${userId}`);
            const data = await res.json();
            if (data.success && data.user) {
              userMap.set(userId, data.user);
            }
          } catch (error) {
            console.error(`Failed to fetch user ${userId}:`, error);
          }
        }),
      );
      return userMap;
    },
    { revalidateOnFocus: false },
  );

  // Benchmark performances — combines predefined + custom symbols.
  // Empty selection → null key so SWR skips the fetch entirely.
  const benchmarkKey = selectedBenchmarks.length > 0
    ? ['compare:benchmarks', selectedBenchmarks, timeframe, customDateRange] as const
    : null;
  const {
    data: benchmarkPerformances = [] as BenchmarkPerformance[],
    isLoading: loadingPredefinedBenchmarks,
  } = useSWR<BenchmarkPerformance[]>(
    benchmarkKey,
    async ([, syms, tf, range]) =>
      getMultipleBenchmarkPerformances(
        syms as BenchmarkSymbol[],
        tf as ComparisonTimeframe,
        range as CustomDateRange | null,
      ),
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const customKey = customSymbols.length > 0
    ? ['compare:custom-symbols', customSymbols, timeframe, customDateRange] as const
    : null;
  const {
    data: customSymbolPerformances = [] as BenchmarkPerformance[],
    isLoading: loadingCustomSymbols,
  } = useSWR<BenchmarkPerformance[]>(
    customKey,
    async ([, syms, tf, range]) =>
      getMultipleCustomSymbolPerformances(
        syms as CustomComparisonSymbol[],
        tf as ComparisonTimeframe,
        range as CustomDateRange | null,
      ),
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const loadingBenchmarks = loadingPredefinedBenchmarks || loadingCustomSymbols;

  // Portfolio historical data — one Map per selection. Key on the
  // sorted, filtered id list so reordering selectedIds doesn't
  // invalidate; key on timeframe/range so swapping refetches.
  const selectedPortfolioIds = useMemo(
    () => selectedIds.filter((id) => id !== '').sort(),
    [selectedIds],
  );

  const portfolioHistoricalKey = selectedPortfolioIds.length > 0
    ? ['compare:portfolio-historical', selectedPortfolioIds, timeframe, customDateRange] as const
    : null;

  const {
    data: portfolioHistoricalData = new Map<string, PortfolioHistoricalPoint[]>(),
    isLoading: loadingPortfolioData,
  } = useSWR<Map<string, PortfolioHistoricalPoint[]>>(
    portfolioHistoricalKey,
    async ([, ids, tf, range]) => {
      const newDataMap = new Map<string, PortfolioHistoricalPoint[]>();
      await Promise.all(
        (ids as string[]).map(async (id) => {
          const portfolio = getPortfolioById(id);
          if (portfolio) {
            const historicalData = await calculatePortfolioHistoricalData(
              portfolio,
              tf as ComparisonTimeframe,
              range as CustomDateRange | null,
            );
            newDataMap.set(id, historicalData);
          }
        }),
      );
      return newDataMap;
    },
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  // Fundamentals — keyed on the sorted unique symbol set across all
  // selected portfolios. Independent of timeframe (fundamentals are
  // a snapshot, not a window).
  const fundamentalsKey = useMemo(() => {
    if (selectedPortfolioIds.length === 0) return null;
    const allSymbols = new Set<string>();
    selectedPortfolioIds.forEach((id) => {
      const portfolio = getPortfolioById(id);
      if (portfolio) {
        portfolio.players.forEach((player) => {
          if (player.asset?.symbol) {
            allSymbols.add(player.asset.symbol.toUpperCase());
          }
        });
      }
    });
    if (allSymbols.size === 0) return null;
    return ['compare:fundamentals', Array.from(allSymbols).sort()] as const;
  }, [selectedPortfolioIds, getPortfolioById]);

  const { data: fundamentalsMap = new Map<string, AssetFundamentals>() } = useSWR<
    Map<string, AssetFundamentals>
  >(
    fundamentalsKey,
    async ([, syms]) => fetchMultipleFundamentals(syms as string[]),
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  /* Live batch quotes for the same symbol set — powers the REAL "Day
     Return" row (allocation-weighted intraday change). The mock walk
     used to supply this number and it had nothing to do with the
     actual holdings. Shares fundamentalsKey's symbol list, 5-min
     client cache inside fetchQuotesBatch. */
  const { data: liveQuotesMap = new Map<string, LiveQuote>() } = useSWR<Map<string, LiveQuote>>(
    fundamentalsKey ? ['compare:live-quotes', fundamentalsKey[1]] as const : null,
    async ([, syms]) => fetchQuotesBatch(syms as string[]),
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  // Get selected portfolios with their performances
  const selectedPortfolios = useMemo(() => {
    return selectedIds
      .filter((id) => id !== '')
      .map((id) => {
        const portfolio = getPortfolioById(id);
        if (!portfolio) return null;
        const performance = calculatePortfolioPerformance(portfolio);
        const owner = users.get(portfolio.userId) || null;
        return { portfolio, performance, owner };
      })
      .filter((item): item is { portfolio: Portfolio; performance: PortfolioPerformance; owner: User | null } => item !== null);
  }, [selectedIds, getPortfolioById, users]);

  // Combine all benchmark performances for display (moved here for dependency ordering)
  const allBenchmarkPerformances = useMemo(() => {
    return [...benchmarkPerformances, ...customSymbolPerformances];
  }, [benchmarkPerformances, customSymbolPerformances]);

  // Calculate weighted fundamental metrics from portfolio assets using fetched fundamentals
  const calculateWeightedFundamentals = useCallback((portfolio: Portfolio) => {
    const playersWithAssets = portfolio.players.filter((p) => p.asset);
    const totalAllocation = playersWithAssets.reduce((sum, p) => sum + p.allocation, 0);

    if (totalAllocation === 0) {
      return {
        weightedPE: null,
        weightedEPS: null,
        weightedROE: null,
        weightedProfitMargin: null,
        weightedDebtToEquity: null,
      };
    }

    let weightedPE = 0;
    let weightedEPS = 0;
    let weightedROE = 0;
    let weightedProfitMargin = 0;
    let weightedDebtToEquity = 0;
    let peCount = 0;
    let epsCount = 0;
    let roeCount = 0;
    let marginCount = 0;
    let debtCount = 0;

    playersWithAssets.forEach((player) => {
      const asset = player.asset!;
      const symbol = asset.symbol.toUpperCase();
      const fundamentals = fundamentalsMap.get(symbol);
      const weight = player.allocation / totalAllocation;

      // Use fundamentals from API if available, otherwise fall back to asset data
      const peRatio = fundamentals?.peRatio ?? asset.peRatio;
      const eps = fundamentals?.eps ?? asset.eps;
      const returnOnEquity = fundamentals?.returnOnEquity ?? asset.returnOnEquity;
      const profitMargin = fundamentals?.profitMargin ?? asset.profitMargin;
      const debtToEquity = fundamentals?.debtToEquity ?? asset.debtToEquity;

      if (peRatio !== null && peRatio !== undefined) {
        weightedPE += peRatio * weight;
        peCount++;
      }
      if (eps !== null && eps !== undefined) {
        weightedEPS += eps * weight;
        epsCount++;
      }
      if (returnOnEquity !== null && returnOnEquity !== undefined) {
        weightedROE += returnOnEquity * weight;
        roeCount++;
      }
      if (profitMargin !== null && profitMargin !== undefined) {
        weightedProfitMargin += profitMargin * weight;
        marginCount++;
      }
      if (debtToEquity !== null && debtToEquity !== undefined) {
        weightedDebtToEquity += debtToEquity * weight;
        debtCount++;
      }
    });

    return {
      weightedPE: peCount > 0 ? weightedPE : null,
      weightedEPS: epsCount > 0 ? weightedEPS : null,
      weightedROE: roeCount > 0 ? weightedROE : null,
      weightedProfitMargin: marginCount > 0 ? weightedProfitMargin : null,
      weightedDebtToEquity: debtCount > 0 ? weightedDebtToEquity : null,
    };
  }, [fundamentalsMap]);

  // Enhance portfolios with real metrics from historical data
  const selectedPortfoliosWithRealMetrics = useMemo(() => {
    const initialInvestment = 10000;

    // Use the dedicated SPY benchmark return for alpha calculation
    const benchmarkReturn = spyBenchmarkReturn;

    /* Allocation-weighted intraday change from live quotes — the real
       "Day Return". Renormalizes over the weights we have quotes for,
       so one unresolvable ticker doesn't drag the number toward 0.
       Returns null when no quotes resolved (falls back to series). */
    const liveDayReturnFor = (portfolio: Portfolio): number | null => {
      const players = portfolio.players.filter((p) => p.asset);
      const totalAlloc = players.reduce((s, p) => s + p.allocation, 0);
      if (totalAlloc === 0) return null;
      let weighted = 0;
      let coveredWeight = 0;
      players.forEach((p) => {
        const quote = liveQuotesMap.get(p.asset!.symbol.toUpperCase());
        if (quote) {
          const w = p.allocation / totalAlloc;
          weighted += w * quote.dayChangePercent;
          coveredWeight += w;
        }
      });
      return coveredWeight > 0 ? weighted / coveredWeight : null;
    };

    return selectedPortfolios.map((item) => {
      const historicalData = portfolioHistoricalData.get(item.portfolio.id);

      // Calculate weighted fundamental metrics
      const fundamentals = calculateWeightedFundamentals(item.portfolio);

      /* Return over the last N TRADING days of the fetched series.
         Clamps to the series start when the selected window is shorter
         than the offset (1W timeframe → "month return" degrades to the
         full-window return instead of inventing a number). */
      const seriesReturnFrom = (offset: number): number | null => {
        if (!historicalData || historicalData.length < 2) return null;
        const last = historicalData[historicalData.length - 1].value;
        const idx = Math.max(0, historicalData.length - 1 - offset);
        const base = historicalData[idx].value;
        return base > 0 ? ((last - base) / base) * 100 : null;
      };

      const liveDayReturn = liveDayReturnFor(item.portfolio);

      if (historicalData && historicalData.length > 1) {
        // Calculate real metrics from Yahoo Finance data
        const realMetrics = calculateMetricsFromHistoricalData(historicalData);

        // Calculate real value from historical data (normalized to 100)
        const lastNormalizedValue = historicalData[historicalData.length - 1].value;
        const realValue = initialInvestment * (lastNormalizedValue / 100);
        const realTotalReturn = realValue - initialInvestment;

        // Calculate win rate from daily returns
        let winDays = 0;
        for (let i = 1; i < historicalData.length; i++) {
          if (historicalData[i].value > historicalData[i - 1].value) {
            winDays++;
          }
        }
        const winRate = historicalData.length > 1
          ? (winDays / (historicalData.length - 1)) * 100
          : item.performance.winRate;

        // Calculate alpha: Portfolio Return - (Beta * Benchmark Return)
        const alpha = benchmarkReturn !== null
          ? realMetrics.totalReturnPercent - (item.performance.beta * benchmarkReturn)
          : null;

        const dayReturnPercent =
          liveDayReturn ?? seriesReturnFrom(1) ?? item.performance.dayReturnPercent;

        return {
          ...item,
          performance: {
            ...item.performance,
            totalValue: realValue,
            totalReturn: realTotalReturn,
            totalReturnPercent: realMetrics.totalReturnPercent,
            /* Day from live quotes, week/month from the real series —
               these three used to leak through from the mock walk. */
            dayReturnPercent,
            dayReturn: realValue * (dayReturnPercent / 100),
            weekReturnPercent: seriesReturnFrom(5) ?? item.performance.weekReturnPercent,
            monthReturnPercent: seriesReturnFrom(21) ?? item.performance.monthReturnPercent,
            volatility: realMetrics.volatility,
            sharpeRatio: realMetrics.sharpeRatio,
            maxDrawdown: realMetrics.maxDrawdown,
            winRate,
            alpha,
            ...fundamentals,
          },
        };
      }

      // Even without historical data, still overlay live day return + fundamentals
      return {
        ...item,
        performance: {
          ...item.performance,
          ...(liveDayReturn !== null ? { dayReturnPercent: liveDayReturn } : {}),
          ...fundamentals,
        },
      };
    });
  }, [selectedPortfolios, portfolioHistoricalData, spyBenchmarkReturn, calculateWeightedFundamentals, liveQuotesMap]);

  const handleSelectPortfolio = (index: number, portfolioId: string) => {
    const newIds = [...selectedIds];
    newIds[index] = portfolioId;
    setSelectedIds(newIds);
  };

  const handleRemovePortfolio = (index: number) => {
    const newIds = [...selectedIds];
    newIds[index] = '';
    // Remove empty slots from the end, but keep at least MIN_PORTFOLIOS slots
    while (newIds.length > MIN_PORTFOLIOS && newIds[newIds.length - 1] === '') {
      newIds.pop();
    }
    setSelectedIds(newIds);
  };

  const handleAddSlot = () => {
    if (selectedIds.length < MAX_PORTFOLIOS) {
      setSelectedIds([...selectedIds, '']);
    }
  };

  const handleToggleBenchmark = useCallback((symbol: BenchmarkSymbol) => {
    setSelectedBenchmarks((prev) => {
      if (prev.includes(symbol)) {
        return prev.filter((s) => s !== symbol);
      }
      return [...prev, symbol];
    });
  }, []);

  const handleAddCustomSymbol = useCallback((symbol: CustomComparisonSymbol) => {
    setCustomSymbols((prev) => [...prev, symbol]);
  }, []);

  const handleRemoveCustomSymbol = useCallback((symbol: string) => {
    setCustomSymbols((prev) => prev.filter((s) => s.symbol !== symbol));
  }, []);

  const canCompare = selectedPortfolios.length >= MIN_PORTFOLIOS;

  return (
    <AppLayout flush>
      <div style={{ padding: '20px 24px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Header */}
        <div>
          <div className="kicker">TACTICS BOARD · UP TO {MAX_PORTFOLIOS} SQUADS</div>
          <h1
            className="display"
            style={{
              fontSize: 'clamp(24px, 3vw, 32px)',
              letterSpacing: '-0.04em',
              margin: '2px 0 0',
            }}
          >
            Compare
          </h1>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 6 }}>
            Pit up to {MAX_PORTFOLIOS} squads side-by-side against the index and any custom ticker.
          </div>
        </div>

        {/* Portfolio Selectors */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          {selectedIds.map((_, index) => (
            <PortfolioSelector
              key={index}
              portfolios={portfolios}
              publicPortfolios={publicPortfolios}
              currentUserId={currentUser?.id || ''}
              selectedPortfolioIds={selectedIds}
              onSelect={(id) => handleSelectPortfolio(index, id)}
              users={users}
              index={index}
            />
          ))}

          {selectedIds.length < MAX_PORTFOLIOS && (
            <button
              type="button"
              onClick={handleAddSlot}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '36px 14px',
                background: 'transparent',
                border: '1px dashed var(--line-2)',
                borderRadius: 8,
                color: 'var(--text-dim)',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.02em',
                transition: 'background .12s, border-color .12s, color .12s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--pitch)';
                e.currentTarget.style.color = 'var(--pitch)';
                e.currentTarget.style.background = 'var(--pitch-tint)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--line-2)';
                e.currentTarget.style.color = 'var(--text-dim)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Icon.Plus size={14} /> Add another squad
            </button>
          )}
        </div>

        {/* Selected portfolio cards */}
        {selectedPortfolios.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {selectedPortfoliosWithRealMetrics.map((item, index) => (
              <ComparisonCard
                key={item.portfolio.id}
                portfolio={item.portfolio}
                owner={item.owner}
                performance={item.performance}
                onRemove={() => handleRemovePortfolio(selectedIds.indexOf(item.portfolio.id))}
                colorIndex={index}
              />
            ))}
          </div>
        )}

        {/* Benchmark + Timeframe. Stacks on phones — the MATCH CLOCK
            card has minWidth:220 which would crush the benchmark
            selector on a 390px viewport. */}
        <div className="grid items-stretch gap-3 [grid-template-columns:1fr] sm:[grid-template-columns:minmax(0,1fr)_auto]">

          <BenchmarkSelector
            selectedBenchmarks={selectedBenchmarks}
            onToggle={handleToggleBenchmark}
            maxSelections={3}
          />
          <div className="stadium-card" style={{ padding: 14, minWidth: 220 }}>
            <div className="kicker">MATCH CLOCK</div>
            <div className="display" style={{ fontSize: 14, letterSpacing: '-0.01em', marginTop: 1, marginBottom: 10 }}>
              Timeframe
            </div>
            <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
              <TimeframeSelector
                selectedTimeframe={timeframe}
                onSelect={(tf) => {
                  setTimeframe(tf);
                  setCustomDateRange(null);
                }}
                disabled={loadingBenchmarks || customDateRange !== null}
              />
              <CustomDateRangeSelector
                dateRange={customDateRange}
                onDateRangeChange={setCustomDateRange}
                disabled={loadingBenchmarks}
              />
            </div>
          </div>
        </div>

        {/* Custom symbol search */}
        <CustomSymbolSearch
          customSymbols={customSymbols}
          onAddSymbol={handleAddCustomSymbol}
          onRemoveSymbol={handleRemoveCustomSymbol}
          maxSymbols={5}
        />

        {/* Content */}
        {canCompare ? (
          <>
            {(selectedPortfoliosWithRealMetrics.length > 0 || allBenchmarkPerformances.length > 0) && (
              <>
                <PerformanceLineChart
                  portfolios={selectedPortfoliosWithRealMetrics.map((p, index) => ({
                    name: p.portfolio.name,
                    color: [
                      'oklch(0.72 0.21 145)',
                      'oklch(0.75 0.14 230)',
                      'oklch(0.78 0.18 320)',
                      'oklch(0.83 0.18 90)',
                    ][index % 4],
                    performance: p.performance,
                    createdAt: p.portfolio.createdAt,
                    realHistoricalData: portfolioHistoricalData.get(p.portfolio.id),
                  }))}
                  benchmarks={allBenchmarkPerformances}
                />
                {(loadingBenchmarks || loadingPortfolioData) && (
                  <div
                    className="kicker"
                    style={{ textAlign: 'center', color: 'var(--text-mute)', marginTop: -8 }}
                  >
                    LOADING {loadingPortfolioData ? 'SQUAD' : 'BENCHMARK'} DATA…
                  </div>
                )}
              </>
            )}

            {/* Metric chart grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 12,
              }}
            >
              <MetricComparisonChart
                performances={selectedPortfoliosWithRealMetrics.map((p) => ({
                  name: p.portfolio.name.slice(0, 15),
                  performance: p.performance,
                }))}
                benchmarks={allBenchmarkPerformances}
                metricKey="totalReturnPercent"
                title="Total Return"
                formatValue={(v) => formatPercent(v, true)}
                higherIsBetter={true}
              />
              <MetricComparisonChart
                performances={selectedPortfoliosWithRealMetrics.map((p) => ({
                  name: p.portfolio.name.slice(0, 15),
                  performance: p.performance,
                }))}
                benchmarks={allBenchmarkPerformances}
                metricKey="sharpeRatio"
                title="Sharpe Ratio"
                formatValue={(v) => v.toFixed(2)}
                higherIsBetter={true}
              />
              <MetricComparisonChart
                performances={selectedPortfoliosWithRealMetrics.map((p) => ({
                  name: p.portfolio.name.slice(0, 15),
                  performance: p.performance,
                }))}
                benchmarks={allBenchmarkPerformances}
                metricKey="beta"
                title="Beta"
                formatValue={(v) => v.toFixed(2)}
                higherIsBetter={false}
              />
              <MetricComparisonChart
                performances={selectedPortfoliosWithRealMetrics.map((p) => ({
                  name: p.portfolio.name.slice(0, 15),
                  performance: p.performance,
                }))}
                benchmarks={allBenchmarkPerformances}
                metricKey="volatility"
                title="Volatility"
                formatValue={(v) => `${v.toFixed(1)}%`}
                higherIsBetter={false}
              />
              <MetricComparisonChart
                performances={selectedPortfoliosWithRealMetrics.map((p) => ({
                  name: p.portfolio.name.slice(0, 15),
                  performance: p.performance,
                }))}
                benchmarks={allBenchmarkPerformances}
                metricKey="maxDrawdown"
                title="Max Drawdown"
                formatValue={(v) => `${v.toFixed(1)}%`}
                higherIsBetter={false}
              />
              <MetricComparisonChart
                performances={selectedPortfoliosWithRealMetrics.map((p) => ({
                  name: p.portfolio.name.slice(0, 15),
                  performance: p.performance,
                }))}
                benchmarks={allBenchmarkPerformances}
                metricKey="winRate"
                title="Win Rate"
                formatValue={(v) => `${v.toFixed(1)}%`}
                higherIsBetter={true}
              />
            </div>

            {/* Comparison Table */}
            <ComparisonTable
              portfolioNames={selectedPortfoliosWithRealMetrics.map((p) => p.portfolio.name)}
              performances={selectedPortfoliosWithRealMetrics.map((p) => p.performance)}
              benchmarks={allBenchmarkPerformances}
            />
          </>
        ) : (
          <div
            className="stadium-card"
            style={{ padding: 48, textAlign: 'center', borderStyle: 'dashed' }}
          >
            <Icon.Compare size={40} style={{ color: 'var(--text-mute)', margin: '0 auto 12px' }} />
            <div className="display" style={{ fontSize: 18, marginBottom: 6 }}>
              Pick squads to compare
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 13, maxWidth: 480, margin: '0 auto' }}>
              Choose at least {MIN_PORTFOLIOS} squad from the dropdowns above to start comparing — add benchmarks
              and custom tickers to set the bar.
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
