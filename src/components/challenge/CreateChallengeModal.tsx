'use client';

import React, { useState } from 'react';
import {
  ChallengeType,
  ChallengeTimeframe,
  CHALLENGE_XP,
  CHALLENGE_TIMEFRAMES,
  MAX_ACTIVE_CHALLENGES,
} from '@/types';
import { useStore } from '@/store/useStore';
import { Modal } from '@/components/ui';
import { Icon } from '@/components/stadium/Icon';

interface CreateChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateChallengeModal: React.FC<CreateChallengeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentUser,
    portfolios,
    publicPortfolios,
    createChallenge,
    canCreateChallenge,
    getActiveChallengesCount,
  } = useStore();

  const [challengeType, setChallengeType] = useState<ChallengeType>('sp500');
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('');
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChallengeTimeframe>('1W');
  const [opponentPortfolioId, setOpponentPortfolioId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCount = getActiveChallengesCount();
  const xpAtStake = challengeType === 'sp500' ? CHALLENGE_XP.VS_SP500 : CHALLENGE_XP.VS_USER;
  const canCreate = canCreateChallenge(challengeType);

  const opponentPortfolios = publicPortfolios.filter((p) => p.userId !== currentUser?.id);

  const resetForm = () => {
    setChallengeType('sp500');
    setSelectedPortfolioId('');
    setSelectedTimeframe('1W');
    setOpponentPortfolioId('');
    setError(null);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const handleCreate = async () => {
    if (!selectedPortfolioId) {
      setError('Please pick your squad');
      return;
    }
    if (challengeType === 'user' && !opponentPortfolioId) {
      setError('Please pick an opponent squad');
      return;
    }

    setIsLoading(true);
    setError(null);

    const opponentPortfolio = opponentPortfolios.find((p) => p.id === opponentPortfolioId);
    const result = await createChallenge(
      selectedPortfolioId,
      challengeType,
      selectedTimeframe,
      opponentPortfolio?.userId,
      opponentPortfolioId || undefined,
    );

    setIsLoading(false);

    if (result.success) {
      handleClose();
    } else {
      setError(result.error || 'Failed to set up the fixture');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New fixture"
      subtitle={`FIXTURES · ${activeCount} / ${MAX_ACTIVE_CHALLENGES} ACTIVE`}
      size="md"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {error && (
          <Banner tone="error">{error}</Banner>
        )}

        {!canCreate.canCreate && (
          <Banner tone="warn">{canCreate.reason}</Banner>
        )}

        {/* Fixture type */}
        <div>
          <Label>Fixture type</Label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 10,
            }}
          >
            <TypeCard
              icon="Bolt"
              code="BMK"
              pillClass="pill pill-whistle"
              title="vs S&P 500"
              sub="Beat the market index over your chosen timeframe."
              xp={CHALLENGE_XP.VS_SP500}
              active={challengeType === 'sp500'}
              onClick={() => setChallengeType('sp500')}
            />
            <TypeCard
              icon="Profile"
              code="PVP"
              pillClass="pill pill-pitch"
              title="vs Manager"
              sub="Head-to-head with another manager's squad."
              xp={CHALLENGE_XP.VS_USER}
              active={challengeType === 'user'}
              onClick={() => setChallengeType('user')}
            />
          </div>
        </div>

        {/* Your squad */}
        <div>
          <Label>Your squad</Label>
          <SquadSelect
            value={selectedPortfolioId}
            onChange={setSelectedPortfolioId}
            options={portfolios.map((p) => ({
              id: p.id,
              label: p.name,
              formation: p.formation,
            }))}
            placeholder="Pick a squad to field"
          />
        </div>

        {/* Timeframe */}
        <div>
          <Label>Timeframe</Label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
            }}
          >
            {CHALLENGE_TIMEFRAMES.map((tf) => {
              const isActive = selectedTimeframe === tf.value;
              return (
                <button
                  key={tf.value}
                  type="button"
                  onClick={() => setSelectedTimeframe(tf.value)}
                  className="mono"
                  style={{
                    padding: '10px 6px',
                    background: isActive ? 'var(--pitch)' : 'var(--surface-2)',
                    color: isActive ? 'oklch(0.14 0.05 145)' : 'var(--text-dim)',
                    border: '1px solid ' + (isActive ? 'var(--pitch-deep)' : 'var(--line)'),
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    transition: 'background .12s, border-color .12s',
                  }}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Opponent (only for vs user) */}
        {challengeType === 'user' && (
          <div>
            <Label>Opponent squad</Label>
            {opponentPortfolios.length === 0 ? (
              <div
                className="stadium-card"
                style={{
                  padding: '14px 16px',
                  borderStyle: 'dashed',
                  textAlign: 'center',
                }}
              >
                <div className="kicker">NO PUBLIC SQUADS YET TO CHALLENGE</div>
              </div>
            ) : (
              <SquadSelect
                value={opponentPortfolioId}
                onChange={setOpponentPortfolioId}
                options={opponentPortfolios.map((p) => ({
                  id: p.id,
                  label: p.name,
                  formation: p.formation,
                }))}
                placeholder="Pick a rival squad"
              />
            )}
          </div>
        )}

        {/* Summary */}
        <div
          className="stadium-card"
          style={{
            padding: 14,
            background: 'var(--surface-2)',
          }}
        >
          <div className="kicker" style={{ marginBottom: 10 }}>FIXTURE SUMMARY</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SummaryRow
              label="Type"
              value={challengeType === 'sp500' ? 'vs S&P 500' : 'vs Manager'}
            />
            <SummaryRow
              label="Timeframe"
              value={CHALLENGE_TIMEFRAMES.find((t) => t.value === selectedTimeframe)?.label || selectedTimeframe}
            />
            <SummaryRow
              label="XP at stake"
              value={`+${xpAtStake} XP`}
              valueColor="var(--whistle)"
            />
            {currentUser && (
              <SummaryRow
                label="Your XP"
                value={`${currentUser.xp.toLocaleString()} XP`}
                divider
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex" style={{ gap: 10, marginTop: 4 }}>
          <button
            type="button"
            className="stadium-btn stadium-btn-ghost"
            style={{ flex: 1, justifyContent: 'center', padding: '11px 14px' }}
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="stadium-btn stadium-btn-primary"
            style={{ flex: 1.4, justifyContent: 'center', padding: '11px 14px' }}
            onClick={handleCreate}
            disabled={
              isLoading ||
              !canCreate.canCreate ||
              !selectedPortfolioId ||
              (challengeType === 'user' && !opponentPortfolioId)
            }
          >
            {isLoading ? (
              <>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    border: '2px solid currentColor',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'stadium-spin 0.9s linear infinite',
                  }}
                />
                Setting up…
              </>
            ) : (
              <>
                <Icon.Whistle size={14} /> Kick off fixture
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/* ============================================================ */

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label
    className="kicker"
    style={{ display: 'block', marginBottom: 8, color: 'var(--text-dim)' }}
  >
    {children}
  </label>
);

const Banner: React.FC<{ tone: 'error' | 'warn'; children: React.ReactNode }> = ({ tone, children }) => (
  <div
    className="stadium-card"
    style={{
      padding: '10px 12px',
      background:
        tone === 'error' ? 'oklch(0.65 0.22 25 / 0.08)' : 'oklch(0.83 0.18 90 / 0.1)',
      borderColor:
        tone === 'error' ? 'oklch(0.65 0.22 25 / 0.3)' : 'oklch(0.83 0.18 90 / 0.3)',
    }}
  >
    <p
      className="mono"
      style={{
        margin: 0,
        fontSize: 11,
        color: tone === 'error' ? 'var(--ref-red)' : 'var(--whistle)',
        letterSpacing: '0.02em',
        lineHeight: 1.5,
      }}
    >
      {children}
    </p>
  </div>
);

const TypeCard: React.FC<{
  icon: 'Bolt' | 'Profile';
  code: string;
  pillClass: string;
  title: string;
  sub: string;
  xp: number;
  active: boolean;
  onClick: () => void;
}> = ({ icon, code, pillClass, title, sub, xp, active, onClick }) => {
  const IconCmp = Icon[icon];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: 14,
        background: active ? 'var(--pitch-tint)' : 'var(--surface-2)',
        border: '1px solid ' + (active ? 'var(--pitch)' : 'var(--line)'),
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'background .12s, border-color .12s',
      }}
    >
      <div className="flex items-center justify-between">
        <span className={pillClass} style={{ padding: '2px 6px' }}>
          {code}
        </span>
        <IconCmp size={18} style={{ color: active ? 'var(--pitch)' : 'var(--text-dim)' }} />
      </div>
      <div className="display" style={{ fontSize: 15, letterSpacing: '-0.02em' }}>
        {title}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        {sub}
      </div>
      <div
        className="mono num"
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--whistle)',
          marginTop: 2,
        }}
      >
        +{xp} XP
      </div>
    </button>
  );
};

const SquadSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string; formation: string }[];
  placeholder: string;
}> = ({ value, onChange, options, placeholder }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{
      width: '100%',
      padding: '10px 14px',
      background: 'var(--surface-2)',
      border: '1px solid var(--line)',
      borderRadius: 8,
      color: 'var(--text)',
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      cursor: 'pointer',
      outline: 'none',
      appearance: 'none',
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23808890' stroke-width='2'><path d='M6 9 L12 15 L18 9'/></svg>\")",
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 12px center',
      paddingRight: 34,
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
    <option value="">{placeholder}</option>
    {options.map((opt) => (
      <option key={opt.id} value={opt.id}>
        {opt.label} ({opt.formation})
      </option>
    ))}
  </select>
);

const SummaryRow: React.FC<{
  label: string;
  value: string;
  valueColor?: string;
  divider?: boolean;
}> = ({ label, value, valueColor, divider }) => (
  <div
    className="flex justify-between items-center"
    style={{
      paddingTop: divider ? 6 : 0,
      borderTop: divider ? '1px solid var(--line)' : 'none',
      marginTop: divider ? 4 : 0,
    }}
  >
    <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
      {label}
    </span>
    <span
      className="display num"
      style={{
        fontSize: 13,
        color: valueColor || 'var(--text)',
        letterSpacing: '-0.01em',
      }}
    >
      {value}
    </span>
  </div>
);
