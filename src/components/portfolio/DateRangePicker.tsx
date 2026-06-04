'use client';

import React, { useState, useEffect } from 'react';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';

interface DateRangePickerProps {
  portfolioCreatedDate: Date;
  maxDate?: Date;
  startDate: Date | null;
  endDate: Date | null;
  onChange: (startDate: Date | null, endDate: Date | null) => void;
}

type PresetKey = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
  { key: 'ALL', label: 'All' },
];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  portfolioCreatedDate,
  maxDate = new Date(),
  startDate,
  endDate,
  onChange,
}) => {
  const [activePreset, setActivePreset] = useState<PresetKey | null>('ALL');
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const absoluteMinDate = subYears(portfolioCreatedDate, 2);

  useEffect(() => {
    if (startDate) setCustomStart(format(startDate, 'yyyy-MM-dd'));
    if (endDate) setCustomEnd(format(endDate, 'yyyy-MM-dd'));
  }, [startDate, endDate]);

  const handlePresetClick = (preset: PresetKey) => {
    setActivePreset(preset);
    setShowCustom(false);
    const today = endOfDay(maxDate);
    let start: Date;

    switch (preset) {
      case '1W': start = startOfDay(subDays(today, 7)); break;
      case '1M': start = startOfDay(subMonths(today, 1)); break;
      case '3M': start = startOfDay(subMonths(today, 3)); break;
      case '6M': start = startOfDay(subMonths(today, 6)); break;
      case '1Y': start = startOfDay(subYears(today, 1)); break;
      case 'ALL':
      default:    start = startOfDay(portfolioCreatedDate); break;
    }

    onChange(start, today);
  };

  const handleCustomStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomStart(value);
    setActivePreset(null);
    if (value) {
      const newStart = startOfDay(new Date(value));
      if (newStart <= maxDate) onChange(newStart, endDate || maxDate);
    }
  };

  const handleCustomEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomEnd(value);
    setActivePreset(null);
    if (value) {
      const newEnd = endOfDay(new Date(value));
      if (newEnd <= maxDate) onChange(startDate || portfolioCreatedDate, newEnd);
    }
  };

  const handleReset = () => {
    setActivePreset('ALL');
    setShowCustom(false);
    onChange(startOfDay(portfolioCreatedDate), endOfDay(maxDate));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Preset chips */}
      <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
        <span className="kicker" style={{ marginRight: 4 }}>PERIOD</span>
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => handlePresetClick(preset.key)}
              className="mono"
              style={{
                padding: '6px 10px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: isActive ? 'var(--pitch)' : 'var(--surface-2)',
                color: isActive ? 'oklch(0.14 0.05 145)' : 'var(--text-dim)',
                border: '1px solid ' + (isActive ? 'var(--pitch-deep)' : 'var(--line)'),
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'background .12s, border-color .12s',
              }}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className="mono"
          style={{
            padding: '6px 10px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            background:
              showCustom || activePreset === null ? 'var(--text)' : 'var(--surface-2)',
            color:
              showCustom || activePreset === null ? 'var(--bg)' : 'var(--text-dim)',
            border:
              '1px solid ' +
              (showCustom || activePreset === null ? 'var(--text)' : 'var(--line)'),
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Custom
        </button>
      </div>

      {/* Custom range */}
      {showCustom && (
        <div className="flex flex-wrap items-center" style={{ gap: 10 }}>
          <div className="flex items-center" style={{ gap: 6 }}>
            <label className="kicker">FROM</label>
            <input
              type="date"
              value={customStart}
              min={format(absoluteMinDate, 'yyyy-MM-dd')}
              max={format(maxDate, 'yyyy-MM-dd')}
              onChange={handleCustomStartChange}
              style={{
                padding: '6px 10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text)',
                outline: 'none',
                colorScheme: 'dark',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--pitch)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--line)';
              }}
            />
          </div>
          <div className="flex items-center" style={{ gap: 6 }}>
            <label className="kicker">TO</label>
            <input
              type="date"
              value={customEnd}
              min={format(absoluteMinDate, 'yyyy-MM-dd')}
              max={format(maxDate, 'yyyy-MM-dd')}
              onChange={handleCustomEndChange}
              style={{
                padding: '6px 10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text)',
                outline: 'none',
                colorScheme: 'dark',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--pitch)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--line)';
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="mono"
            style={{
              padding: '6px 10px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-mute)',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      )}

      {/* Current range */}
      {startDate && endDate && (
        <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.06em' }}>
          SHOWING: {format(startDate, 'MMM dd, yyyy').toUpperCase()} → {format(endDate, 'MMM dd, yyyy').toUpperCase()}
        </div>
      )}
    </div>
  );
};
