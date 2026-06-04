'use client';

import React, { useMemo } from 'react';
import { Portfolio, User } from '@/types';
import { Icon } from '@/components/stadium/Icon';

interface PortfolioSelectorProps {
  portfolios: Portfolio[];
  publicPortfolios: Portfolio[];
  currentUserId: string;
  selectedPortfolioIds: string[];
  onSelect: (portfolioId: string) => void;
  users: Map<string, User>;
  index: number;
}

export const PortfolioSelector: React.FC<PortfolioSelectorProps> = ({
  portfolios,
  publicPortfolios,
  currentUserId,
  selectedPortfolioIds,
  onSelect,
  users,
  index,
}) => {
  const currentSelection = selectedPortfolioIds[index] || '';

  const availablePortfolios = useMemo(() => {
    const otherSelections = selectedPortfolioIds.filter((_, i) => i !== index);
    return portfolios.filter((p) => !otherSelections.includes(p.id));
  }, [portfolios, selectedPortfolioIds, index]);

  const availablePublicPortfolios = useMemo(() => {
    const otherSelections = selectedPortfolioIds.filter((_, i) => i !== index);
    return publicPortfolios.filter(
      (p) => p.userId !== currentUserId && !otherSelections.includes(p.id),
    );
  }, [publicPortfolios, currentUserId, selectedPortfolioIds, index]);

  const getUsername = (userId: string): string => users.get(userId)?.username || 'Unknown';

  return (
    <div style={{ position: 'relative' }}>
      <label
        className="kicker"
        style={{ display: 'block', marginBottom: 6, color: 'var(--text-dim)' }}
      >
        SLOT {String(index + 1).padStart(2, '0')}
      </label>
      <select
        value={currentSelection}
        onChange={(e) => onSelect(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 36px 10px 14px',
          background: 'var(--surface-2)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          color: currentSelection ? 'var(--text)' : 'var(--text-mute)',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          cursor: 'pointer',
          outline: 'none',
          appearance: 'none',
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
      >
        <option value="">Pick a squad…</option>

        {availablePortfolios.length > 0 && (
          <optgroup label="My Squads">
            {availablePortfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.formation})
              </option>
            ))}
          </optgroup>
        )}

        {availablePublicPortfolios.length > 0 && (
          <optgroup label="Public Squads">
            {availablePublicPortfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · @{getUsername(p.userId)} ({p.formation})
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <div
        style={{
          position: 'absolute',
          right: 12,
          top: 'calc(50% + 6px)',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          color: 'var(--text-mute)',
        }}
      >
        <Icon.Chevron size={14} style={{ transform: 'rotate(90deg)' }} />
      </div>
    </div>
  );
};
