'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ComparisonTimeframe, COMPARISON_TIMEFRAMES } from '@/types';

interface TimeframeSelectorProps {
  selectedTimeframe: ComparisonTimeframe;
  onSelect: (timeframe: ComparisonTimeframe) => void;
  disabled?: boolean;
}

export const TimeframeSelector: React.FC<TimeframeSelectorProps> = ({
  selectedTimeframe,
  onSelect,
  disabled = false,
}) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 3,
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 8,
      }}
    >
      {COMPARISON_TIMEFRAMES.map(({ value, label }) => {
        const isSelected = selectedTimeframe === value;
        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onSelect(value)}
            className="mono"
            style={{
              position: 'relative',
              padding: '6px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 5,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: isSelected ? 'oklch(0.14 0.05 145)' : 'var(--text-dim)',
              minWidth: 38,
              textAlign: 'center',
              transition: 'color .15s ease',
              zIndex: 1,
            }}
          >
            {isSelected && (
              <motion.span
                layoutId="timeframe-indicator"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'var(--pitch)',
                  borderRadius: 5,
                  zIndex: -1,
                }}
              />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
};
