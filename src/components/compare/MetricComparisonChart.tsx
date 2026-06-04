'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PortfolioPerformance, BenchmarkPerformance } from '@/types';
import { formatPercent } from '@/lib/utils';

interface MetricComparisonChartProps {
  performances: { name: string; performance: PortfolioPerformance }[];
  benchmarks?: BenchmarkPerformance[];
  metricKey: keyof PortfolioPerformance;
  title: string;
  formatValue?: (value: number) => string;
  higherIsBetter?: boolean;
}

const SLOT_COLORS = [
  'oklch(0.72 0.21 145)',  // pitch green
  'oklch(0.75 0.14 230)',  // sky
  'oklch(0.78 0.18 320)',  // pink-purple
  'oklch(0.83 0.18 90)',   // whistle
];

const getBenchmarkValue = (
  benchmark: BenchmarkPerformance,
  metricKey: keyof PortfolioPerformance,
): number | null => {
  switch (metricKey) {
    case 'totalReturnPercent': return benchmark.totalReturnPercent;
    case 'volatility':         return benchmark.volatility;
    case 'sharpeRatio':        return benchmark.sharpeRatio;
    case 'maxDrawdown':        return benchmark.maxDrawdown;
    case 'beta':               return benchmark.beta;
    case 'winRate':            return benchmark.winRate;
    default:                   return null;
  }
};

export const MetricComparisonChart: React.FC<MetricComparisonChartProps> = ({
  performances,
  benchmarks = [],
  metricKey,
  title,
  formatValue = (v) => v.toFixed(2),
  higherIsBetter = true,
}) => {
  const portfolioData = performances.map((p, index) => ({
    name: p.name,
    value: Number(p.performance[metricKey]) || 0,
    color: SLOT_COLORS[index % SLOT_COLORS.length],
    isBenchmark: false,
  }));

  const benchmarkData = benchmarks
    .map((b) => {
      const value = getBenchmarkValue(b, metricKey);
      if (value === null) return null;
      return {
        name: b.name,
        value,
        color: b.color,
        isBenchmark: true,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  const data = [...portfolioData, ...benchmarkData];
  if (data.length === 0) return null;

  const values = data.map((d) => d.value);
  const bestValue = higherIsBetter ? Math.max(...values) : Math.min(...values);

  return (
    <div className="stadium-card" style={{ padding: 14 }}>
      <div className="kicker" style={{ marginBottom: 8 }}>{title.toUpperCase()}</div>
      <div style={{ height: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 4, bottom: 4 }}>
            <XAxis
              type="number"
              tick={{
                fill: 'var(--text-mute)',
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatValue}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{
                fill: 'var(--text-dim)',
                fontSize: 10,
                fontFamily: 'var(--font-display)',
              }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              contentStyle={{
                backgroundColor: 'var(--ink)',
                border: '1px solid var(--line-2)',
                borderRadius: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                padding: '6px 10px',
              }}
              labelStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, letterSpacing: '0.1em' }}
              itemStyle={{ color: '#fff', fontWeight: 700 }}
              formatter={(value: number | undefined) => [formatValue(value ?? 0), title]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.value === bestValue && !entry.isBenchmark ? 'var(--pitch)' : entry.color}
                  opacity={entry.value === bestValue ? 1 : 0.7}
                  strokeDasharray={entry.isBenchmark ? '4 2' : undefined}
                  stroke={entry.isBenchmark ? entry.color : undefined}
                  strokeWidth={entry.isBenchmark ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/* re-export so /compare can use the same helper */
export { formatPercent };
