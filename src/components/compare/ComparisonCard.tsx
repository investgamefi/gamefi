'use client';

import React from 'react';
import Link from 'next/link';
import { Portfolio, User, PortfolioPerformance } from '@/types';
import { FormationField } from '@/components/portfolio/FormationField';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Icon } from '@/components/stadium/Icon';

interface ComparisonCardProps {
  portfolio: Portfolio;
  owner: User | null;
  performance: PortfolioPerformance;
  onRemove: () => void;
  colorIndex: number;
}

/* Stadium-friendly colour band per comparison slot — used as the top stripe + accent. */
const SLOT_COLORS = [
  'var(--pitch)',           // green
  'oklch(0.75 0.14 230)',   // sky
  'oklch(0.78 0.18 320)',   // pink-purple
  'oklch(0.83 0.18 90)',    // whistle yellow
];

export const ComparisonCard: React.FC<ComparisonCardProps> = ({
  portfolio,
  owner,
  performance,
  onRemove,
  colorIndex,
}) => {
  const slotColor = SLOT_COLORS[colorIndex % SLOT_COLORS.length];
  const filledPositions = portfolio.players.filter((p) => p.asset !== null).length;
  const positive = performance.totalReturnPercent >= 0;

  return (
    <div
      className="stadium-card"
      style={{
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Coloured top stripe */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: slotColor,
        }}
      />

      {/* Header */}
      <div
        className="flex items-start justify-between"
        style={{
          padding: '14px 14px 10px',
          borderBottom: '1px solid var(--line)',
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            className="mono"
            style={{
              fontSize: 9,
              color: slotColor,
              letterSpacing: '0.16em',
              fontWeight: 700,
            }}
          >
            SLOT {String(colorIndex + 1).padStart(2, '0')}
          </div>
          <Link
            href={`/portfolio/${portfolio.id}`}
            className="display"
            style={{
              fontSize: 15,
              letterSpacing: '-0.02em',
              color: 'var(--text)',
              textDecoration: 'none',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 2,
            }}
          >
            {portfolio.name}
          </Link>
          {owner && (
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: 'var(--text-mute)',
                marginTop: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: '0.04em',
              }}
            >
              @{owner.username}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove squad"
          style={{
            padding: 5,
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 5,
            color: 'var(--text-mute)',
            cursor: 'pointer',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--ref-red)';
            e.currentTarget.style.borderColor = 'oklch(0.65 0.22 25 / 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-mute)';
            e.currentTarget.style.borderColor = 'var(--line)';
          }}
        >
          <Icon.Close size={11} />
        </button>
      </div>

      {/* Mini pitch */}
      <div style={{ padding: 12 }}>
        <div style={{ width: '100%', maxWidth: 140, margin: '0 auto' }}>
          <FormationField portfolio={portfolio} compact variant="tactics" />
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{
          padding: '8px 12px 12px',
          borderTop: '1px solid var(--line)',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 6,
        }}
      >
        <Stat label="VALUE" value={formatCurrency(performance.totalValue)} />
        <Stat
          label="RETURN"
          value={formatPercent(performance.totalReturnPercent)}
          tone={positive ? 'pos' : 'neg'}
        />
        <Stat label="FORMATION" value={portfolio.formation} />
        <Stat label="FILLED" value={`${filledPositions}/11`} />
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; tone?: 'pos' | 'neg' }> = ({
  label,
  value,
  tone,
}) => (
  <div
    style={{
      padding: '6px 8px',
      background: 'var(--surface-2)',
      borderRadius: 5,
      textAlign: 'center',
    }}
  >
    <div className="kicker" style={{ fontSize: 8 }}>{label}</div>
    <div
      className="mono num"
      style={{
        fontSize: 11,
        marginTop: 2,
        fontWeight: 700,
        color: tone === 'pos' ? 'var(--pitch)' : tone === 'neg' ? 'var(--ref-red)' : 'var(--text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </div>
  </div>
);
