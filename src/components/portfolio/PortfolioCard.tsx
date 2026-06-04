'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Portfolio } from '@/types';
import { useStore } from '@/store/useStore';
import { userStorage } from '@/lib/storage';
import { formatCurrency, formatPercent, getRelativeTime } from '@/lib/utils';
import { FormationField } from './FormationField';
import { TeamLimitModal } from '@/components/ui';
import { usePortfolioRealPerformance } from '@/hooks/usePortfolioRealPerformance';
import { Icon } from '@/components/stadium/Icon';

interface PortfolioCardProps {
  portfolio: Portfolio;
  showUser?: boolean;
  showActions?: boolean;
}

export const PortfolioCard: React.FC<PortfolioCardProps> = ({
  portfolio,
  showUser = true,
  showActions = true,
}) => {
  const { currentUser, likePortfolio, clonePortfolio, canCreateTeam, getTeamSlotInfo, unlockTeamSlot } = useStore();
  const owner = userStorage.getUserById(portfolio.userId);
  const [showLimitModal, setShowLimitModal] = useState(false);

  const { performance, isLoading, isRealData } = usePortfolioRealPerformance(portfolio);

  const isOwner = currentUser?.id === portfolio.userId;
  const hasLiked = currentUser ? portfolio.likes.includes(currentUser.id) : false;
  const filledPositions = portfolio.players.filter((p) => p.asset !== null).length;
  const positive = performance.totalReturnPercent >= 0;

  const teamSlotInfo = getTeamSlotInfo();

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentUser) likePortfolio(portfolio.id);
  };

  const handleClone = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentUser && !isOwner) {
      if (!canCreateTeam()) {
        setShowLimitModal(true);
        return;
      }
      clonePortfolio(portfolio.id);
    }
  };

  const handleUnlockSlot = async () => {
    const success = await unlockTeamSlot();
    if (success) {
      setShowLimitModal(false);
      clonePortfolio(portfolio.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      className="stadium-card"
      style={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color .15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--pitch)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--line)';
      }}
    >
      <Link
        href={`/portfolio/${portfolio.id}`}
        style={{
          textDecoration: 'none',
          color: 'inherit',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 14,
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div className="flex items-start justify-between" style={{ gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                className="display"
                style={{
                  fontSize: 16,
                  letterSpacing: '-0.02em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {portfolio.name}
              </div>
              {portfolio.description && (
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: 'var(--text-mute)',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {portfolio.description}
                </div>
              )}
            </div>
            <span className="pill pill-pitch" style={{ flexShrink: 0 }}>
              {portfolio.formation}
            </span>
          </div>

          {showUser && owner && (
            <div className="flex items-center" style={{ gap: 8, marginTop: 8 }}>
              <img
                src={owner.avatar}
                alt={owner.username}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 3,
                  border: '1px solid var(--line)',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
                @{owner.username} · {getRelativeTime(portfolio.createdAt).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Pitch preview */}
        <div style={{ padding: 14 }}>
          <div style={{ width: '100%', maxWidth: 200, margin: '0 auto' }}>
            <FormationField portfolio={portfolio} compact variant="tactics" />
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            padding: '10px 14px 14px',
            borderTop: '1px solid var(--line)',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
          }}
        >
          <StatMini label="VALUE" value={formatCurrency(performance.totalValue)} />
          <StatMini
            label="RETURN"
            value={
              isLoading
                ? '—'
                : formatPercent(performance.totalReturnPercent)
            }
            tone={isLoading ? undefined : positive ? 'pos' : 'neg'}
            realData={isRealData}
          />
          <StatMini label="FILLED" value={`${filledPositions}/11`} />
          <StatMini label="LIKES" value={String(portfolio.likes.length)} />
        </div>
      </Link>

      {/* Actions */}
      {showActions && (
        <div
          style={{
            padding: 10,
            borderTop: '1px solid var(--line)',
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            background: 'var(--surface-2)',
          }}
        >
          <button
            type="button"
            onClick={handleLike}
            className="stadium-btn stadium-btn-ghost"
            style={{
              padding: '5px 10px',
              fontSize: 11,
              gap: 4,
              color: hasLiked ? 'var(--ref-red)' : undefined,
              background: hasLiked ? 'oklch(0.65 0.22 25 / 0.08)' : undefined,
              borderColor: hasLiked ? 'oklch(0.65 0.22 25 / 0.3)' : undefined,
            }}
          >
            {hasLiked ? '♥' : '♡'} {portfolio.likes.length}
          </button>

          {!isOwner && (
            <button
              type="button"
              onClick={handleClone}
              className="stadium-btn stadium-btn-ghost"
              style={{ padding: '5px 10px', fontSize: 11, gap: 4 }}
            >
              <Icon.Lineup size={11} /> {portfolio.cloneCount}
            </button>
          )}

          <span
            className="mono"
            style={{
              marginLeft: 'auto',
              fontSize: 9,
              color: 'var(--text-mute)',
              fontWeight: 700,
              letterSpacing: '0.12em',
            }}
          >
            {portfolio.isPublic ? 'PUBLIC' : 'PRIVATE'}
          </span>
        </div>
      )}

      {/* Team limit modal */}
      <TeamLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        currentTeams={teamSlotInfo.current}
        maxTeams={teamSlotInfo.max}
        userXp={currentUser?.xp || 0}
        onUnlockSlot={handleUnlockSlot}
      />
    </motion.div>
  );
};

const StatMini: React.FC<{
  label: string;
  value: string;
  tone?: 'pos' | 'neg';
  realData?: boolean;
}> = ({ label, value, tone, realData }) => (
  <div style={{ textAlign: 'center', minWidth: 0 }}>
    <div className="kicker" style={{ fontSize: 8 }}>
      {label}
      {realData && (
        <span style={{ color: 'var(--pitch)', marginLeft: 3 }}>•</span>
      )}
    </div>
    <div
      className="mono num"
      style={{
        fontSize: 12,
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
