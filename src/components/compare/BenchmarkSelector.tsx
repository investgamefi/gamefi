'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BenchmarkSymbol, BenchmarkInfo, BENCHMARKS } from '@/types';

interface BenchmarkSelectorProps {
  selectedBenchmarks: BenchmarkSymbol[];
  onToggle: (symbol: BenchmarkSymbol) => void;
  maxSelections?: number;
}

export const BenchmarkSelector: React.FC<BenchmarkSelectorProps> = ({
  selectedBenchmarks,
  onToggle,
  maxSelections = 3,
}) => {
  const isSelected = (symbol: BenchmarkSymbol) => selectedBenchmarks.includes(symbol);
  const canSelect = selectedBenchmarks.length < maxSelections;

  return (
    <div className="stadium-card" style={{ padding: 14 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <div>
          <div className="kicker">BENCHMARKS</div>
          <div className="display" style={{ fontSize: 14, letterSpacing: '-0.01em', marginTop: 1 }}>
            Compare against indices
          </div>
        </div>
        <span className="mono num" style={{ fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.04em' }}>
          {selectedBenchmarks.length} / {maxSelections}
        </span>
      </div>

      <div className="flex flex-wrap" style={{ gap: 6 }}>
        {BENCHMARKS.map((benchmark: BenchmarkInfo) => {
          const selected = isSelected(benchmark.symbol);
          const disabled = !selected && !canSelect;

          return (
            <motion.button
              key={benchmark.symbol}
              type="button"
              onClick={() => !disabled && onToggle(benchmark.symbol)}
              whileTap={!disabled ? { scale: 0.97 } : undefined}
              disabled={disabled}
              title={benchmark.description}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                background: selected
                  ? 'var(--pitch-tint)'
                  : disabled
                  ? 'var(--surface-2)'
                  : 'var(--surface)',
                border:
                  '1px solid ' +
                  (selected
                    ? 'var(--pitch)'
                    : disabled
                    ? 'var(--line)'
                    : 'var(--line)'),
                borderRadius: 6,
                cursor: disabled ? 'not-allowed' : 'pointer',
                color: selected ? 'var(--text)' : disabled ? 'var(--text-mute)' : 'var(--text-dim)',
                opacity: disabled ? 0.5 : 1,
                fontFamily: 'var(--font-display)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.01em',
                transition: 'background .12s, border-color .12s',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: benchmark.color,
                  opacity: selected ? 1 : 0.6,
                }}
              />
              {benchmark.name}
              {selected && (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--pitch)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 13l4 4L19 7" />
                </motion.svg>
              )}
            </motion.button>
          );
        })}
      </div>

      {selectedBenchmarks.length > 0 && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid var(--line)',
          }}
        >
          <div className="kicker" style={{ marginBottom: 6 }}>ACTIVE</div>
          <div className="flex flex-wrap" style={{ gap: 4 }}>
            {selectedBenchmarks.map((symbol) => {
              const benchmark = BENCHMARKS.find((b) => b.symbol === symbol);
              return benchmark ? (
                <span
                  key={symbol}
                  className="mono num"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    background: `${benchmark.color}20`,
                    border: `1px solid ${benchmark.color}50`,
                    color: benchmark.color,
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 3,
                    letterSpacing: '0.04em',
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: benchmark.color,
                    }}
                  />
                  {benchmark.symbol}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
};
