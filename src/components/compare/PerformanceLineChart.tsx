'use client';

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { BenchmarkPerformance, PortfolioPerformance } from '@/types';

interface PortfolioData {
  name: string;
  color: string;
  performance: PortfolioPerformance;
  createdAt?: string;
  realHistoricalData?: { date: string; value: number; return: number }[];
}

interface PerformanceLineChartProps {
  portfolios: PortfolioData[];
  benchmarks: BenchmarkPerformance[];
}

const SLOT_COLORS = [
  'oklch(0.72 0.21 145)',  // pitch green
  'oklch(0.75 0.14 230)',  // sky
  'oklch(0.78 0.18 320)',  // pink-purple
  'oklch(0.83 0.18 90)',   // whistle
];

export const PerformanceLineChart: React.FC<PerformanceLineChartProps> = ({
  portfolios,
  benchmarks,
}) => {
  const portfolioCreationDates = useMemo(
    () => portfolios.map((p) => (p.createdAt ? p.createdAt.split('T')[0] : null)),
    [portfolios],
  );

  const chartData = useMemo(() => {
    const allDates = new Set<string>();
    benchmarks.forEach((b) => b.normalizedData.forEach((d) => allDates.add(d.date)));
    portfolios.forEach((p) => {
      const historicalData = p.realHistoricalData || p.performance.historicalData;
      historicalData?.forEach((d) => allDates.add(d.date));
    });

    const sortedDates = Array.from(allDates).sort();
    if (sortedDates.length === 0) return [];

    return sortedDates.map((date) => {
      const point: Record<string, string | number | undefined> = { date };

      benchmarks.forEach((b) => {
        const dataPoint = b.normalizedData.find((d) => d.date === date);
        if (dataPoint) point[b.symbol] = dataPoint.value;
      });

      portfolios.forEach((p, index) => {
        const historicalData = p.realHistoricalData || p.performance.historicalData;
        if (historicalData && historicalData.length > 0) {
          const dataPoint = historicalData.find((d) => d.date === date);
          const firstValue = historicalData[0].value;
          if (dataPoint && firstValue > 0) {
            const normalizedValue = (dataPoint.value / firstValue) * 100;
            const creationDate = portfolioCreationDates[index];

            if (creationDate && date < creationDate) {
              point[`portfolio_${index}_simulated`] = normalizedValue;
            } else {
              point[`portfolio_${index}_actual`] = normalizedValue;
            }
            if (creationDate && date === creationDate) {
              point[`portfolio_${index}_simulated`] = normalizedValue;
            }
          }
        }
      });

      return point;
    });
  }, [portfolios, benchmarks, portfolioCreationDates]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
    label?: string;
  }) => {
    if (!active || !payload || !payload.length) return null;

    const groupedPayload: Array<{ name: string; value: number; color: string; isSimulated: boolean }> = [];
    const processedPortfolios = new Set<string>();

    payload.forEach((entry) => {
      const portfolioMatch = entry.dataKey.match(/^portfolio_(\d+)_(actual|simulated)$/);
      if (portfolioMatch) {
        const portfolioIndex = portfolioMatch[1];
        if (!processedPortfolios.has(portfolioIndex)) {
          processedPortfolios.add(portfolioIndex);
          const isSimulated = portfolioMatch[2] === 'simulated';
          groupedPayload.push({
            name: entry.name.replace(' (Projected)', '').replace(' (Actual)', ''),
            value: entry.value,
            color: entry.color,
            isSimulated,
          });
        }
      } else {
        groupedPayload.push({ name: entry.name, value: entry.value, color: entry.color, isSimulated: false });
      }
    });

    return (
      <div
        className="stadium-card"
        style={{
          padding: '8px 12px',
          background: 'var(--ink)',
          border: '1px solid var(--line-2)',
          borderRadius: 6,
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.5)',
            marginBottom: 6,
            letterSpacing: '0.1em',
          }}
        >
          {label ? formatDate(label).toUpperCase() : ''}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {groupedPayload.map((entry, index) => (
            <div key={index} className="flex items-center" style={{ gap: 6, fontSize: 11 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: entry.color,
                }}
              />
              <span
                className="display"
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 11,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 180,
                }}
              >
                {entry.name}
                {entry.isSimulated && (
                  <span
                    className="mono"
                    style={{ marginLeft: 4, fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}
                  >
                    (PROJECTED)
                  </span>
                )}
              </span>
              <span
                className="mono num"
                style={{
                  color:
                    entry.value > 100
                      ? 'var(--pitch-glow)'
                      : entry.value < 100
                      ? '#ff7766'
                      : '#fff',
                  fontWeight: 700,
                }}
              >
                {(entry.value - 100).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const hasSimulatedData = portfolioCreationDates.some((date) => date !== null);

  if (chartData.length === 0) {
    return (
      <div className="stadium-card" style={{ padding: 18 }}>
        <div className="kicker">EQUITY CURVES</div>
        <div className="display" style={{ fontSize: 16, letterSpacing: '-0.02em', marginTop: 2, marginBottom: 12 }}>
          Performance over time
        </div>
        <div
          className="kicker"
          style={{
            height: 240,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-mute)',
          }}
        >
          SELECT SQUADS OR BENCHMARKS TO VIEW PERFORMANCE
        </div>
      </div>
    );
  }

  return (
    <div className="stadium-card" style={{ padding: 18 }}>
      <div className="kicker">EQUITY CURVES</div>
      <div className="display" style={{ fontSize: 16, letterSpacing: '-0.02em', marginTop: 2, marginBottom: 12 }}>
        Performance over time
      </div>
      <div style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <XAxis
              dataKey="date"
              tick={{
                fill: 'var(--text-mute)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
              }}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={false}
              tickFormatter={formatDate}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{
                fill: 'var(--text-mute)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
              }}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(value) => `${(value - 100).toFixed(0)}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '14px' }}
              formatter={(value: string) => {
                const cleanValue = value.replace(' (Projected)', '').replace(' (Actual)', '');
                return (
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 12,
                      color: 'var(--text-dim)',
                    }}
                  >
                    {cleanValue}
                  </span>
                );
              }}
            />
            <ReferenceLine y={100} stroke="var(--line-2)" strokeDasharray="3 3" />

            {portfolios.map((p, index) => {
              const creationDate = portfolioCreationDates[index];
              if (!creationDate) return null;
              return (
                <Line
                  key={`portfolio_${index}_simulated`}
                  type="monotone"
                  dataKey={`portfolio_${index}_simulated`}
                  name={`${p.name} (Projected)`}
                  stroke={p.color || SLOT_COLORS[index % SLOT_COLORS.length]}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  dot={false}
                  connectNulls
                  legendType="none"
                />
              );
            })}

            {portfolios.map((p, index) => (
              <Line
                key={`portfolio_${index}_actual`}
                type="monotone"
                dataKey={`portfolio_${index}_actual`}
                name={portfolioCreationDates[index] ? `${p.name} (Actual)` : p.name}
                stroke={p.color || SLOT_COLORS[index % SLOT_COLORS.length]}
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
            ))}

            {benchmarks.map((b) => (
              <Line
                key={b.symbol}
                type="monotone"
                dataKey={b.symbol}
                name={b.name}
                stroke={b.color}
                strokeWidth={2}
                strokeDasharray="8 4"
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        className="flex flex-wrap items-center justify-center mono"
        style={{
          gap: 14,
          marginTop: 10,
          fontSize: 9,
          color: 'var(--text-mute)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        <span>Normalized to 100 at start</span>
        {hasSimulatedData && (
          <span className="flex items-center" style={{ gap: 5 }}>
            <span
              style={{
                width: 22,
                height: 0,
                borderTop: '2px dashed var(--text-mute)',
              }}
            />
            Dotted = projected before squad creation
          </span>
        )}
        <span className="flex items-center" style={{ gap: 5 }}>
          <svg width="22" height="2">
            <line x1="0" y1="1" x2="22" y2="1" stroke="var(--text-mute)" strokeWidth="2" strokeDasharray="8 4" />
          </svg>
          Long dash = benchmarks
        </span>
      </div>
    </div>
  );
};
