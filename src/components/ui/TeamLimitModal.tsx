'use client';

import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { TEAM_SLOT_UNLOCK_COST } from '@/types';
import { Icon } from '@/components/stadium/Icon';

interface TeamLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTeams: number;
  maxTeams: number;
  userXp: number;
  onUnlockSlot?: () => void;
}

export const TeamLimitModal: React.FC<TeamLimitModalProps> = ({
  isOpen,
  onClose,
  currentTeams,
  maxTeams,
  userXp,
  onUnlockSlot,
}) => {
  const canUnlock = userXp >= TEAM_SLOT_UNLOCK_COST;
  const xpShortage = Math.max(0, TEAM_SLOT_UNLOCK_COST - userXp);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Squad limit reached"
      subtitle="ROSTER · MAX SQUADS"
      size="sm"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        {/* Warning icon */}
        <div
          style={{
            width: 56,
            height: 56,
            margin: '0 auto',
            borderRadius: 10,
            background: 'oklch(0.83 0.18 90 / 0.1)',
            border: '1px solid oklch(0.83 0.18 90 / 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon.Whistle size={26} style={{ color: 'var(--whistle)' }} />
        </div>

        <div>
          <p
            style={{
              color: 'var(--text)',
              fontSize: 14,
              lineHeight: 1.55,
              margin: 0,
              marginBottom: 6,
            }}
          >
            You&apos;ve fielded{' '}
            <strong className="display num" style={{ color: 'var(--pitch)' }}>
              {currentTeams}
            </strong>{' '}
            of{' '}
            <strong className="display num" style={{ color: 'var(--pitch)' }}>
              {maxTeams}
            </strong>{' '}
            squads.
          </p>
          <p
            style={{
              color: 'var(--text-dim)',
              fontSize: 12,
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            Disband an existing squad or unlock a new slot with XP.
          </p>
        </div>

        {/* Unlock option */}
        <div
          className="stadium-card"
          style={{
            padding: 14,
            background: canUnlock ? 'var(--pitch-tint)' : 'var(--surface-2)',
            borderColor: canUnlock ? 'oklch(0.72 0.21 145 / 0.3)' : 'var(--line)',
            textAlign: 'left',
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <div>
              <div className="kicker">UNLOCK NEW SLOT</div>
              <div className="display" style={{ fontSize: 14, letterSpacing: '-0.02em', marginTop: 2 }}>
                Extend your roster
              </div>
            </div>
            <div className="flex items-center" style={{ gap: 4 }}>
              <Icon.Bolt size={14} style={{ color: 'var(--whistle)' }} />
              <span
                className="mono num"
                style={{ fontSize: 13, fontWeight: 700, color: 'var(--whistle)' }}
              >
                {TEAM_SLOT_UNLOCK_COST} XP
              </span>
            </div>
          </div>

          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 12 }}
          >
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
              Your XP
            </span>
            <span
              className="mono num"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: canUnlock ? 'var(--pitch)' : 'var(--ref-red)',
              }}
            >
              {userXp.toLocaleString()} XP
            </span>
          </div>

          {canUnlock ? (
            <Button
              onClick={onUnlockSlot}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Icon.Plus size={14} /> Unlock slot (+1 squad)
            </Button>
          ) : (
            <div
              className="mono"
              style={{
                padding: '10px 12px',
                background: 'var(--surface)',
                border: '1px dashed var(--line)',
                borderRadius: 6,
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--text-mute)',
                letterSpacing: '0.04em',
              }}
            >
              NEED <span style={{ color: 'var(--ref-red)' }}>{xpShortage}</span> MORE XP TO UNLOCK
            </div>
          )}
        </div>

        <Button variant="ghost" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
          Close
        </Button>
      </div>
    </Modal>
  );
};
