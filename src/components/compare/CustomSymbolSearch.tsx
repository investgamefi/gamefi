'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomComparisonSymbol } from '@/types';
import { Icon } from '@/components/stadium/Icon';

interface CustomSymbolSearchProps {
  customSymbols: CustomComparisonSymbol[];
  onAddSymbol: (symbol: CustomComparisonSymbol) => void;
  onRemoveSymbol: (symbol: string) => void;
  maxSymbols?: number;
}

/* Stadium-palette chart colours for custom comparison tickers — visually
   distinct from the 4 squad-slot colours (green/sky/pink-purple/whistle)
   used in PerformanceLineChart so series never overlap perceptually. */
const CUSTOM_COLORS = [
  'oklch(0.65 0.22 25)',   // ref-red
  'oklch(0.72 0.18 180)',  // teal
  'oklch(0.74 0.18 50)',   // orange
  'oklch(0.68 0.18 295)',  // violet
  'oklch(0.78 0.18 130)',  // lime
  'oklch(0.72 0.14 210)',  // ocean
];

export const CustomSymbolSearch: React.FC<CustomSymbolSearchProps> = ({
  customSymbols,
  onAddSymbol,
  onRemoveSymbol,
  maxSymbols = 5,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!searchInput.trim()) return;
    const symbol = searchInput.trim().toUpperCase();

    if (customSymbols.some((s) => s.symbol === symbol)) {
      setError('Symbol already added');
      return;
    }
    if (customSymbols.length >= maxSymbols) {
      setError(`Maximum ${maxSymbols} custom symbols allowed`);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/yahoo-finance?symbol=${encodeURIComponent(symbol)}`);
      const data = await response.json();

      if (!data.success || !data.asset) {
        setError('Symbol not found');
        setIsLoading(false);
        return;
      }

      const colorIndex = customSymbols.length % CUSTOM_COLORS.length;
      onAddSymbol({
        symbol: data.asset.symbol,
        name: data.asset.name,
        color: CUSTOM_COLORS[colorIndex],
      });
      setSearchInput('');
    } catch {
      setError('Failed to validate symbol');
    } finally {
      setIsLoading(false);
    }
  }, [searchInput, customSymbols, maxSymbols, onAddSymbol]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const isMaxed = customSymbols.length >= maxSymbols;

  return (
    <div className="stadium-card" style={{ padding: 14 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <div>
          <div className="kicker">CUSTOM TICKERS</div>
          <div className="display" style={{ fontSize: 14, letterSpacing: '-0.01em', marginTop: 1 }}>
            Compare against any symbol
          </div>
        </div>
        <span className="mono num" style={{ fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.04em' }}>
          {customSymbols.length} / {maxSymbols}
        </span>
      </div>

      <div className="flex" style={{ gap: 6, marginBottom: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value.toUpperCase());
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter ticker (e.g. AAPL, MSFT)"
            disabled={isLoading || isMaxed}
            style={{
              width: '100%',
              padding: '8px 36px 8px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.04em',
              outline: 'none',
              transition: 'border-color .15s, background .15s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--pitch)';
              e.currentTarget.style.background = 'var(--surface)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--line)';
              e.currentTarget.style.background = 'var(--surface-2)';
            }}
          />
          {isLoading && (
            <div
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 12,
                height: 12,
                border: '2px solid var(--line)',
                borderTopColor: 'var(--pitch)',
                borderRadius: '50%',
                animation: 'stadium-spin 0.9s linear infinite',
              }}
            />
          )}
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={isLoading || !searchInput.trim() || isMaxed}
          className="stadium-btn stadium-btn-primary"
          style={{ padding: '7px 14px', fontSize: 11 }}
        >
          <Icon.Plus size={11} /> Add
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--ref-red)',
              margin: '0 0 8px',
              letterSpacing: '0.02em',
            }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {customSymbols.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: 5 }}>
          {customSymbols.map((symbol) => (
            <motion.div
              key={symbol.symbol}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 8px',
                background: `${symbol.color}18`,
                border: `1px solid ${symbol.color}55`,
                borderRadius: 4,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: symbol.color,
                }}
              />
              <span
                className="mono num"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text)',
                  letterSpacing: '0.04em',
                }}
              >
                {symbol.symbol}
              </span>
              <span
                className="mono hidden sm:inline"
                style={{
                  fontSize: 10,
                  color: 'var(--text-mute)',
                  letterSpacing: '0.04em',
                  maxWidth: 110,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {symbol.name}
              </span>
              <button
                type="button"
                onClick={() => onRemoveSymbol(symbol.symbol)}
                aria-label={`Remove ${symbol.symbol}`}
                style={{
                  marginLeft: 2,
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-mute)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Icon.Close size={11} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <p
        className="mono"
        style={{
          fontSize: 9,
          color: 'var(--text-mute)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          margin: '8px 0 0',
        }}
      >
        Compare your squad against any stock, ETF, or index
      </p>
    </div>
  );
};
