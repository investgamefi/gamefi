'use client';

import React from 'react';
import { PortfolioPerformance, BenchmarkPerformance } from '@/types';
import { formatCurrency, formatPercent, formatPE, formatEPS, formatPercentMetric, formatRatio } from '@/lib/utils';
import { Icon } from '@/components/stadium/Icon';

interface MetricConfig {
  key: keyof PortfolioPerformance;
  label: string;
  format: (value: number) => string;
  higherIsBetter: boolean;
  benchmarkKey?: keyof BenchmarkPerformance;
}

const METRICS: MetricConfig[] = [
  { key: 'totalValue', label: 'Total Value', format: formatCurrency, higherIsBetter: true, benchmarkKey: 'totalValue' },
  { key: 'totalReturnPercent', label: 'Total Return', format: (v) => formatPercent(v), higherIsBetter: true, benchmarkKey: 'totalReturnPercent' },
  { key: 'alpha', label: 'Alpha (vs SPY)', format: (v) => (v !== null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : 'N/A'), higherIsBetter: true },
  { key: 'dayReturnPercent', label: 'Day Return', format: (v) => formatPercent(v), higherIsBetter: true },
  { key: 'weekReturnPercent', label: 'Week Return', format: (v) => formatPercent(v), higherIsBetter: true },
  { key: 'monthReturnPercent', label: 'Month Return', format: (v) => formatPercent(v), higherIsBetter: true },
  { key: 'sharpeRatio', label: 'Sharpe Ratio', format: (v) => v.toFixed(2), higherIsBetter: true, benchmarkKey: 'sharpeRatio' },
  { key: 'beta', label: 'Beta', format: (v) => v.toFixed(2), higherIsBetter: false, benchmarkKey: 'beta' },
  { key: 'volatility', label: 'Volatility', format: (v) => `${v.toFixed(2)}%`, higherIsBetter: false, benchmarkKey: 'volatility' },
  { key: 'maxDrawdown', label: 'Max Drawdown', format: (v) => `${v.toFixed(2)}%`, higherIsBetter: false, benchmarkKey: 'maxDrawdown' },
  { key: 'winRate', label: 'Win Rate', format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true, benchmarkKey: 'winRate' },
  { key: 'weightedPE', label: 'Avg P/E', format: (v) => (v !== null ? formatPE(v) : 'N/A'), higherIsBetter: false },
  { key: 'weightedEPS', label: 'Avg EPS', format: (v) => (v !== null ? formatEPS(v) : 'N/A'), higherIsBetter: true },
  { key: 'weightedROE', label: 'Avg ROE', format: (v) => (v !== null ? formatPercentMetric(v) : 'N/A'), higherIsBetter: true },
  { key: 'weightedProfitMargin', label: 'Avg Margin', format: (v) => (v !== null ? formatPercentMetric(v) : 'N/A'), higherIsBetter: true },
  { key: 'weightedDebtToEquity', label: 'Avg D/E', format: (v) => (v !== null ? formatRatio(v) : 'N/A'), higherIsBetter: false },
];

interface ComparisonTableProps {
  portfolioNames: string[];
  performances: PortfolioPerformance[];
  benchmarks?: BenchmarkPerformance[];
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({
  portfolioNames,
  performances,
  benchmarks = [],
}) => {
  const findBestIndex = (metric: MetricConfig): number => {
    if (performances.length === 0) return -1;
    const values = performances.map((p) => {
      const v = p[metric.key];
      return v === null || v === undefined ? null : typeof v === 'number' ? v : Number(v);
    });
    const validValues = values.filter((v): v is number => v !== null && !isNaN(v));
    if (validValues.length === 0) return -1;
    const bestValue = metric.higherIsBetter ? Math.max(...validValues) : Math.min(...validValues);
    return values.indexOf(bestValue);
  };

  const getBenchmarkValue = (benchmark: BenchmarkPerformance, metric: MetricConfig): number | null => {
    if (!metric.benchmarkKey) return null;
    const value = benchmark[metric.benchmarkKey];
    return typeof value === 'number' ? value : null;
  };

  return (
    <div className="stadium-card" style={{ overflow: 'hidden' }}>
      <div
        style={{
          padding: '14px 18px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div className="kicker">FULL COMPARISON</div>
        <div className="display" style={{ fontSize: 16, letterSpacing: '-0.02em', marginTop: 2 }}>
          Detailed metrics
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
              <th
                style={{
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--text-mute)',
                }}
              >
                METRIC
              </th>
              {portfolioNames.map((name, index) => (
                <th
                  key={index}
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontFamily: 'var(--font-display)',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    color: 'var(--text)',
                    minWidth: 140,
                  }}
                >
                  <div className="mono" style={{ fontSize: 8, color: SLOT_COLORS[index % SLOT_COLORS.length], letterSpacing: '0.16em', marginBottom: 2 }}>
                    SLOT {String(index + 1).padStart(2, '0')}
                  </div>
                  <div
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 180,
                    }}
                  >
                    {name}
                  </div>
                </th>
              ))}
              {benchmarks.map((benchmark) => (
                <th
                  key={benchmark.symbol}
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: benchmark.color,
                    minWidth: 100,
                  }}
                >
                  <div className="flex items-center" style={{ gap: 6 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: benchmark.color,
                      }}
                    />
                    {benchmark.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric, rowIdx) => {
              const bestIndex = findBestIndex(metric);
              return (
                <tr
                  key={metric.key}
                  style={{
                    borderTop: rowIdx === 0 ? 'none' : '1px solid var(--line)',
                    transition: 'background .12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td
                    style={{
                      padding: '12px 16px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--text-dim)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {metric.label}
                  </td>
                  {performances.map((perf, index) => {
                    const rawValue = perf[metric.key];
                    const value =
                      rawValue === null || rawValue === undefined
                        ? null
                        : typeof rawValue === 'number'
                        ? rawValue
                        : Number(rawValue) || 0;
                    const isBest = index === bestIndex && performances.length > 1 && value !== null;

                    return (
                      <td
                        key={index}
                        style={{
                          padding: '12px 16px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: isBest ? 'var(--pitch)' : 'var(--text)',
                        }}
                      >
                        <div className="flex items-center" style={{ gap: 6 }}>
                          {metric.format(value as number)}
                          {isBest && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                background: 'var(--pitch)',
                                color: 'oklch(0.14 0.05 145)',
                                flexShrink: 0,
                              }}
                              title="Best in this row"
                            >
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  {benchmarks.map((benchmark) => {
                    const value = getBenchmarkValue(benchmark, metric);
                    return (
                      <td
                        key={benchmark.symbol}
                        style={{
                          padding: '12px 16px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          color: value !== null ? benchmark.color : 'var(--text-mute)',
                        }}
                      >
                        {value !== null ? metric.format(value) : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SLOT_COLORS = [
  'var(--pitch)',
  'oklch(0.75 0.14 230)',
  'oklch(0.78 0.18 320)',
  'oklch(0.83 0.18 90)',
];
