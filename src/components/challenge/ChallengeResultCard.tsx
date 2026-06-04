'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Challenge, CHALLENGE_TIMEFRAMES } from '@/types';
import { useStore } from '@/store/useStore';
import { formatPercent, formatDate } from '@/lib/utils';
import { Icon } from '@/components/stadium/Icon';

interface ChallengeResultCardProps {
  challenge: Challenge;
}

export const ChallengeResultCard: React.FC<ChallengeResultCardProps> = ({ challenge }) => {
  const { currentUser } = useStore();

  const isChallenger = currentUser?.id === challenge.challengerId;
  const isOpponent = currentUser?.id === challenge.opponentId;
  const isWinner = challenge.winnerId === currentUser?.id;
  const isDraw = challenge.winnerId === null && challenge.status === 'completed';
  const userWonVsSp500 = challenge.type === 'sp500' && challenge.winnerId === challenge.challengerId;

  const timeframeLabel =
    CHALLENGE_TIMEFRAMES.find((t) => t.value === challenge.timeframe)?.label || challenge.timeframe;

  const won = isWinner || userWonVsSp500;
  const resultLabel = won ? 'WIN' : isDraw ? 'DRAW' : 'LOSS';
  const resultPill = won ? 'pill pill-pitch' : isDraw ? 'pill pill-sky' : 'pill pill-red';
  const resultStripe = won ? 'var(--pitch)' : isDraw ? 'oklch(0.75 0.14 230)' : 'var(--ref-red)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="stadium-card"
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      {/* Result stripe at the top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: resultStripe,
        }}
      />

      {/* Header */}
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
            <Icon.Trophy size={14} style={{ color: 'var(--pitch)' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="display" style={{ fontSize: 13, letterSpacing: '-0.01em' }}>
              {challenge.type === 'sp500' ? 'vs S&P 500' : 'vs Manager'}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
              {timeframeLabel} · {challenge.settledAt && formatDate(challenge.settledAt)}
            </div>
          </div>
        </div>
        <span className={resultPill} style={{ padding: '2px 8px' }}>
          {resultLabel}
        </span>
      </div>

      {/* Result line */}
      <div
        style={{
          padding: '10px 16px',
          background: won
            ? 'var(--pitch-tint)'
            : isDraw
            ? 'oklch(0.75 0.14 230 / 0.08)'
            : 'oklch(0.65 0.22 25 / 0.06)',
          borderBottom: '1px solid var(--line)',
          textAlign: 'center',
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: won ? 'var(--pitch)' : isDraw ? 'oklch(0.75 0.14 230)' : 'var(--ref-red)',
            letterSpacing: '0.12em',
          }}
        >
          {won
            ? `+${challenge.xpAwarded || 0} XP EARNED`
            : isDraw
            ? 'NO XP CHANGE'
            : `−${challenge.xpAwarded || 0} XP LOST`}
        </div>
      </div>

      {/* Final scores */}
      <div style={{ padding: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: 14,
            alignItems: 'center',
          }}
        >
          {/* Challenger */}
          <div style={{ textAlign: 'center' }}>
            <img
              src={challenge.challengerAvatar || '/default-avatar.png'}
              alt={challenge.challengerUsername}
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                border:
                  '1px solid ' +
                  (challenge.winnerId === challenge.challengerId
                    ? 'var(--pitch)'
                    : 'var(--line-2)'),
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
            <div
              className="display num"
              style={{
                fontSize: 20,
                marginTop: 4,
                color: (challenge.challengerReturnPercent || 0) >= 0 ? 'var(--pitch)' : 'var(--ref-red)',
                letterSpacing: '-0.03em',
              }}
            >
              {formatPercent(challenge.challengerReturnPercent || 0)}
            </div>
            {challenge.winnerId === challenge.challengerId && (
              <div className="mono" style={{ fontSize: 9, color: 'var(--pitch)', marginTop: 2, letterSpacing: '0.12em' }}>
                WINNER
              </div>
            )}
          </div>

          {/* Center divider */}
          <div style={{ textAlign: 'center' }}>
            <div
              className="display"
              style={{ fontSize: 12, color: 'var(--text-mute)', letterSpacing: '0.2em' }}
            >
              VS
            </div>
            <div
              className="mono"
              style={{
                fontSize: 9,
                color: 'var(--text-mute)',
                marginTop: 4,
                letterSpacing: '0.08em',
              }}
            >
              {challenge.startDate && formatDate(challenge.startDate).toUpperCase()}
              <br />→ {challenge.endDate && formatDate(challenge.endDate).toUpperCase()}
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
                  border: '1px solid ' + (challenge.winnerId === 'sp500' ? 'var(--pitch)' : 'transparent'),
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
                  border:
                    '1px solid ' +
                    (challenge.winnerId === challenge.opponentId
                      ? 'var(--pitch)'
                      : 'var(--line-2)'),
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
              {challenge.type === 'sp500'
                ? 'S&P 500'
                : isOpponent
                ? 'You'
                : challenge.opponentUsername}
            </div>
            <div
              className="display num"
              style={{
                fontSize: 20,
                marginTop: 4,
                color: (challenge.opponentReturnPercent || 0) >= 0 ? 'var(--pitch)' : 'var(--ref-red)',
                letterSpacing: '-0.03em',
              }}
            >
              {formatPercent(challenge.opponentReturnPercent || 0)}
            </div>
            {(challenge.winnerId === challenge.opponentId || challenge.winnerId === 'sp500') && (
              <div
                className="mono"
                style={{ fontSize: 9, color: 'var(--pitch)', marginTop: 2, letterSpacing: '0.12em' }}
              >
                WINNER
              </div>
            )}
          </div>
        </div>

        {/* Performance diff */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid var(--line)',
            textAlign: 'center',
          }}
        >
          <div className="kicker">PERFORMANCE DIFFERENCE</div>
          <div
            className="display num"
            style={{
              fontSize: 18,
              marginTop: 4,
              color:
                (challenge.challengerReturnPercent || 0) - (challenge.opponentReturnPercent || 0) >= 0
                  ? 'var(--pitch)'
                  : 'var(--ref-red)',
              letterSpacing: '-0.03em',
            }}
          >
            {formatPercent(
              (challenge.challengerReturnPercent || 0) - (challenge.opponentReturnPercent || 0),
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
