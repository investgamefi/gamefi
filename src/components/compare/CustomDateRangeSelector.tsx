'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomDateRange } from '@/types';
import { Icon } from '@/components/stadium/Icon';

interface CustomDateRangeSelectorProps {
  dateRange: CustomDateRange | null;
  onDateRangeChange: (range: CustomDateRange | null) => void;
  disabled?: boolean;
}

export const CustomDateRangeSelector: React.FC<CustomDateRangeSelectorProps> = ({
  dateRange,
  onDateRangeChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState(dateRange?.startDate || '');
  const [endDate, setEndDate] = useState(dateRange?.endDate || '');

  const handleApply = () => {
    if (startDate && endDate) {
      onDateRangeChange({ startDate, endDate });
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setStartDate('');
    setEndDate('');
    onDateRangeChange(null);
    setIsOpen(false);
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isActive = !!dateRange;

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="mono"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 11px',
          background: isActive ? 'var(--pitch-tint)' : 'var(--surface-2)',
          border: '1px solid ' + (isActive ? 'var(--pitch)' : 'var(--line)'),
          color: isActive ? 'var(--pitch)' : 'var(--text-dim)',
          borderRadius: 6,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Icon.Fixture size={12} />
        {dateRange ? `${formatDisplayDate(dateRange.startDate)} → ${formatDisplayDate(dateRange.endDate)}` : 'Custom range'}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="stadium-card"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              zIndex: 50,
              padding: 14,
              minWidth: 260,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              boxShadow: '0 30px 80px -20px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="kicker" style={{ display: 'block', marginBottom: 4 }}>
                  START DATE
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate || undefined}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    outline: 'none',
                    colorScheme: 'dark',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--pitch)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                />
              </div>
              <div>
                <label className="kicker" style={{ display: 'block', marginBottom: 4 }}>
                  END DATE
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  max={new Date().toISOString().split('T')[0]}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    outline: 'none',
                    colorScheme: 'dark',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--pitch)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                />
              </div>
              <div className="flex" style={{ gap: 6, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={handleClear}
                  className="stadium-btn stadium-btn-ghost"
                  style={{ flex: 1, justifyContent: 'center', padding: '7px 10px', fontSize: 11 }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!startDate || !endDate}
                  className="stadium-btn stadium-btn-primary"
                  style={{ flex: 1, justifyContent: 'center', padding: '7px 10px', fontSize: 11 }}
                >
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
