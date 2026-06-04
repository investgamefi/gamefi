'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Challenge, CHALLENGE_XP, CHALLENGE_TIMEFRAMES } from '@/types';
import { useStore } from '@/store/useStore';
import { formatPercent, getRelativeTime } from '@/lib/utils';
import { Icon } from '@/components/stadium/Icon';

interface ChallengeCardProps {
  challenge: Challenge;
  showActions?: boolean;
}

const STATUS_PILL: Record<Challenge['status'], { label: string; cls: string }> = {
  pending: { label: 'PENDING', cls: 'pill pill-whistle' },
  active: { label: 'LIVE', cls: 'pill pill-red' },
  completed: { label: 'FT', cls: 'pill pill-pitch' },
  declined: { label: 'DECLINED', cls: 'pill' },
  cancelled: { label: 'CANCELLED', cls: 'pill' },
};

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  showActions = true,
}) => {
  const { currentUser, acceptChallenge, declineChallenge, cancelChallenge, portfolios } = useStore();
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = React.useState<string>('');

  const isChallenger = currentUser?.id === challenge.challengerId;
  const isOpponent = currentUser?.id === challenge.opponentId;
  const isPending = challenge.status === 'pending';
  const isActive = challenge.status === 'active';
  const xpAtStake = challenge.type === 'sp500' ? CHALLENGE_XP.VS_SP500 : CHALLENGE_XP.VS_USER;
  const timeframeLabel =
    CHALLENGE_TIMEFRAMES.find((t) => t.value === challenge.timeframe)?.label || challenge.timeframe;
  const statusInfo = STATUS_PILL[challenge.status];

  const getTimeRemaining = () => {
    if (!challenge.endDate) return null;
    const ms = new Date(challenge.endDate).getTime() - Date.now();
    if (ms <= 0) return 'Closing';
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  };

  const handleAccept = async () => {
    if (!selectedPortfolioId) return;
    setIsLoading(true);
    try {
      await acceptChallenge(challenge.id, selectedPortfolioId);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    setIsLoading(true);
    try {
      await declineChallenge(challenge.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      await cancelChallenge(challenge.id);
    } finally {
      setIsLoading(false);
    }
  };

  const myReturn = isChallenger ? challenge.challengerReturnPercent : challenge.opponentReturnPercent;
  const theirReturn = isChallenger ? challenge.opponentReturnPercent : challenge.challengerReturnPercent;
  const leading = (myReturn ?? 0) > (theirReturn ?? 0);
  const fmt = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`);
  const opponentName =
    challenge.type === 'sp500'
      ? 'S&P 500'
      : isChallenger
      ? challenge.opponentUsername || 'TBD'
      : challenge.challengerUsername || 'Challenger';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="stadium-card"
      style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header strip */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '12px 16px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--line)',
          gap: 8,
        }}
      >
        <div className="flex items-center" style={{ gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              background: 'var(--pitch-tint)',
              border: '1px solid oklch(0.72 0.21 145 / 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {challenge.type === 'sp500' ? (
              <Icon.Bolt size={14} style={{ color: 'var(--pitch)' }} />
            ) : (
              <Icon.Profile size={14} style={{ color: 'var(--pitch)' }} />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              className="display"
              style={{ fontSize: 13, letterSpacing: '-0.01em' }}
            >
              {challenge.type === 'sp500' ? 'vs S&P 500' : 'vs Manager'}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
              {timeframeLabel}
            </div>
          </div>
        </div>
        <span className={statusInfo.cls} style={{ padding: '2px 6px', flexShrink: 0 }}>
          {isActive && <span className="live-dot" />}
          {statusInfo.label}
        </span>
      </div>

      {/* Score / matchup */}
      <div style={{ padding: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: 14,
            alignItems: 'center',
          }}
        >
          {/* You */}
          <div style={{ textAlign: 'center' }}>
            <img
              src={challenge.challengerAvatar || '/default-avatar.png'}
              alt={challenge.challengerUsername}
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                border: '1px solid var(--line-2)',
                objectFit: 'cover',
                margin: '0 auto 6px',
              }}
            />
            <div
              className="display"
              style={{
                fontSize: 11,
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {isChallenger ? 'You' : challenge.challengerUsername}
            </div>
            <div className="mono" style={{ fontSize: 9, color: 'var(--text-mute)', marginTop: 2 }}>
              {challenge.challengerPortfolioName}
            </div>
            {isActive && challenge.challengerReturnPercent !== null && (
              <div
                className="display num"
                style={{
                  fontSize: 18,
                  marginTop: 4,
                  color: challenge.challengerReturnPercent >= 0 ? 'var(--pitch)' : 'var(--ref-red)',
                  letterSpacing: '-0.03em',
                }}
              >
                {fmt(challenge.challengerReturnPercent)}
              </div>
            )}
          </div>

          {/* VS */}
          <div style={{ textAlign: 'center' }}>
            <div
              className="display"
              style={{
                fontSize: 12,
                color: 'var(--text-mute)',
                letterSpacing: '0.2em',
              }}
            >
              VS
            </div>
            <div className="kicker" style={{ marginTop: 4 }}>
              +{xpAtStake} XP
            </div>
          </div>

          {/* Opponent */}
          <div style={{ textAlign: 'center' }}>
            {challenge.type === 'sp500' ? (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 4,
                  background: 'var(--whistle)',
                  color: 'var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 6px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 10,
                }}
              >
                SPY
              </div>
            ) : (
              <img
                src={challenge.opponentAvatar || '/default-avatar.png'}
                alt={challenge.opponentUsername}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 4,
                  border: '1px solid var(--line-2)',
                  objectFit: 'cover',
                  margin: '0 auto 6px',
                }}
              />
            )}
            <div
              className="display"
              style={{
                fontSize: 11,
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {opponentName}
            </div>
            <div className="mono" style={{ fontSize: 9, color: 'var(--text-mute)', marginTop: 2 }}>
              {challenge.type === 'sp500' ? 'Market Index' : challenge.opponentPortfolioName || 'Rival'}
            </div>
            {isActive && challenge.opponentReturnPercent !== null && (
              <div
                className="display num"
                style={{
                  fontSize: 18,
                  marginTop: 4,
                  color: challenge.opponentReturnPercent >= 0 ? 'var(--pitch)' : 'var(--ref-red)',
                  letterSpacing: '-0.03em',
                }}
              >
                {fmt(challenge.opponentReturnPercent)}
              </div>
            )}
          </div>
        </div>

        {/* Meta line */}
        <div
          className="flex items-center justify-between"
          style={{
            paddingTop: 12,
            marginTop: 12,
            borderTop: '1px solid var(--line)',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
            {isActive
              ? `${getTimeRemaining()} LEFT`
              : `CREATED ${getRelativeTime(challenge.createdAt).toUpperCase()}`}
          </span>
          {isActive && (
            <span
              className="mono num"
              style={{
                fontSize: 10,
                color: leading ? 'var(--pitch)' : (myReturn != null && theirReturn != null ? 'var(--ref-red)' : 'var(--text-mute)'),
                fontWeight: 700,
                letterSpacing: '0.1em',
              }}
            >
              {leading ? 'LEADING' : myReturn != null && theirReturn != null ? 'BEHIND' : 'WAITING'}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <>
          {isPending && isOpponent && challenge.type === 'user' && (
            <div
              style={{
                padding: 14,
                borderTop: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <select
                value={selectedPortfolioId}
                onChange={(e) => setSelectedPortfolioId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="">Pick your squad…</option>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="flex" style={{ gap: 6 }}>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={isLoading || !selectedPortfolioId}
                  className="stadium-btn stadium-btn-primary"
                  style={{ flex: 1, justifyContent: 'center', padding: '6px 10px', fontSize: 11 }}
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={handleDecline}
                  disabled={isLoading}
                  className="stadium-btn stadium-btn-ghost"
                  style={{ flex: 1, justifyContent: 'center', padding: '6px 10px', fontSize: 11 }}
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {isPending && isChallenger && (
            <div
              style={{
                padding: '10px 14px',
                borderTop: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                className="stadium-btn stadium-btn-ghost"
                style={{ padding: '6px 12px', fontSize: 11 }}
              >
                Cancel fixture
              </button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};
