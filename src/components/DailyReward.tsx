'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { DAILY_LOGIN_REWARDS } from '@/types';
import { Icon } from '@/components/stadium/Icon';
import { Modal } from '@/components/ui/Modal';

interface DailyRewardProps {
  onClose?: () => void;
}

/* Once-per-session-per-day session marker so the modal doesn't pop
   every time the user changes routes. Cleared when the date changes
   so the modal can fire again the next day. */
const todayYmd = (): string => new Date().toISOString().slice(0, 10);
const SESSION_KEY = 'gamefi:daily-reward-dismissed';
const wasDismissedToday = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SESSION_KEY) === todayYmd();
  } catch {
    return false;
  }
};
const markDismissedToday = () => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_KEY, todayYmd());
  } catch {
    /* sessionStorage disabled — modal will re-fire on next route nav */
  }
};

export const DailyReward: React.FC<DailyRewardProps> = ({ onClose }) => {
  const { currentUser, loadData } = useStore();
  /* visible = whether the Modal is open. Was previously implicit (the
     component always rendered its panel inline), which meant mounting
     it bare in AppLayout dropped a stray panel onto every page. */
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [canClaim, setCanClaim] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [streakInfo, setStreakInfo] = useState({
    currentStreak: 0,
    longestStreak: 0,
    totalDaysClaimed: 0,
  });
  const [nextReward, setNextReward] = useState({
    streakDay: 1,
    baseXp: DAILY_LOGIN_REWARDS.BASE_XP,
    streakBonus: 0,
    totalXp: DAILY_LOGIN_REWARDS.BASE_XP,
  });
  const [claimedReward, setClaimedReward] = useState<number | null>(null);

  useEffect(() => {
    if (currentUser) checkDailyReward();
  }, [currentUser]);

  const checkDailyReward = async () => {
    if (!currentUser) return;
    /* Don't reopen the modal during the same session if the user
       already dismissed it today. Check before the fetch so we don't
       even hit the network. */
    if (wasDismissedToday()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/rewards/daily?userId=${currentUser.id}`);
      const data = await res.json();
      if (data.success) {
        setCanClaim(data.canClaim);
        setStreakInfo(data.streak);
        setNextReward(data.nextReward);
        /* Only auto-open if there's actually a reward to claim. */
        if (data.canClaim) {
          setVisible(true);
        } else {
          markDismissedToday();
        }
      }
    } catch (error) {
      console.error('Failed to check daily reward:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setVisible(false);
    markDismissedToday();
    onClose?.();
  };

  const claimReward = async () => {
    if (!currentUser || claiming || !canClaim) return;
    setClaiming(true);
    try {
      const res = await fetch('/api/rewards/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (data.success) {
        setClaimedReward(data.reward.xpAwarded);
        setClaimed(true);
        setCanClaim(false);
        setStreakInfo(data.streak);
        loadData();
      }
    } catch (error) {
      console.error('Failed to claim daily reward:', error);
    } finally {
      setClaiming(false);
    }
  };

  const streakDays = Array.from({ length: 7 }, (_, i) => i + 1);

  /* Don't render anything until we've fetched AND there's a reward to
     show (or we're mid-claim). Previously the component returned a
     visible spinner panel on every page load. */
  if (!visible) return null;

  return (
    <Modal isOpen={visible} onClose={handleClose} title="Daily reward" size="sm">
    <div style={{ padding: loading ? 32 : 22 }}>
    {loading ? (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="stadium-spinner" style={{ width: 28, height: 28 }} />
      </div>
    ) : (
    <div>
      <AnimatePresence mode="wait">
        {claimed ? (
          <motion.div
            key="claimed"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ textAlign: 'center' }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.15 }}
              style={{
                width: 72,
                height: 72,
                margin: '0 auto 14px',
                borderRadius: 12,
                background: 'var(--pitch-tint)',
                border: '1px solid oklch(0.72 0.21 145 / 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--pitch)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
            <div className="kicker">CLAIMED · MATCHDAY BONUS</div>
            <div
              className="display"
              style={{
                fontSize: 22,
                letterSpacing: '-0.03em',
                margin: '4px 0 12px',
              }}
            >
              Reward claimed
            </div>
            <div
              className="display num"
              style={{
                fontSize: 48,
                color: 'var(--pitch)',
                letterSpacing: '-0.06em',
                lineHeight: 1,
                marginBottom: 10,
              }}
            >
              +{claimedReward} XP
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.1em', marginBottom: 22 }}>
              CURRENT STREAK · {streakInfo.currentStreak} DAY{streakInfo.currentStreak !== 1 ? 'S' : ''}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="stadium-btn stadium-btn-primary"
              style={{ padding: '10px 22px' }}
            >
              <Icon.Whistle size={14} /> Back to the match
            </button>
          </motion.div>
        ) : (
          <motion.div key="unclaimed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div className="kicker">DAILY LOGIN</div>
              <div className="display" style={{ fontSize: 20, letterSpacing: '-0.03em', margin: '4px 0 6px' }}>
                Matchday bonus
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                {canClaim
                  ? 'Claim your daily reward to keep the streak alive.'
                  : 'Come back tomorrow for your next reward.'}
              </p>
            </div>

            {/* Streak row */}
            <div
              className="flex justify-center"
              style={{ gap: 6, marginBottom: 18 }}
            >
              {streakDays.map((day) => {
                const isCurrentDay = (streakInfo.currentStreak % 7 || 7) === day && canClaim;
                const isCompleted = !canClaim
                  ? day <= (streakInfo.currentStreak % 7 || 7)
                  : day < (streakInfo.currentStreak % 7) + 1;
                const isBonus = day === 7;

                return (
                  <div
                    key={day}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      fontWeight: 700,
                      background: isCompleted
                        ? 'var(--pitch)'
                        : isCurrentDay
                        ? 'var(--pitch-tint)'
                        : 'var(--surface-2)',
                      color: isCompleted
                        ? 'oklch(0.14 0.05 145)'
                        : isCurrentDay
                        ? 'var(--pitch)'
                        : 'var(--text-mute)',
                      border:
                        '1px solid ' +
                        (isCompleted
                          ? 'var(--pitch-deep)'
                          : isCurrentDay
                          ? 'var(--pitch)'
                          : isBonus
                          ? 'oklch(0.83 0.18 90 / 0.4)'
                          : 'var(--line)'),
                      animation: isCurrentDay ? 'live-pulse 1.4s ease-out infinite' : undefined,
                    }}
                  >
                    {isCompleted ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isBonus && !isCurrentDay ? (
                      <span style={{ color: 'var(--whistle)' }}>★</span>
                    ) : (
                      day
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reward summary */}
            <div
              className="stadium-card"
              style={{
                padding: 14,
                marginBottom: 18,
                background: 'var(--surface-2)',
              }}
            >
              <div
                className="flex items-center justify-between"
                style={{ paddingBottom: 8, borderBottom: '1px dashed var(--line)', marginBottom: 8 }}
              >
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
                  Base reward
                </span>
                <span className="mono num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  +{nextReward.baseXp} XP
                </span>
              </div>
              {nextReward.streakBonus > 0 && (
                <div
                  className="flex items-center justify-between"
                  style={{ paddingBottom: 8, borderBottom: '1px dashed var(--line)', marginBottom: 8 }}
                >
                  <span className="mono" style={{ fontSize: 11, color: 'var(--whistle)', letterSpacing: '0.04em' }}>
                    7-day streak bonus
                  </span>
                  <span className="mono num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--whistle)' }}>
                    +{nextReward.streakBonus} XP
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="display" style={{ fontSize: 13, letterSpacing: '-0.01em' }}>
                  Total
                </span>
                <span className="display num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--pitch)', letterSpacing: '-0.04em' }}>
                  +{nextReward.totalXp} XP
                </span>
              </div>
            </div>

            {/* Stats */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                marginBottom: 18,
              }}
            >
              <Stat label="CURRENT" value={String(streakInfo.currentStreak)} />
              <Stat label="BEST" value={String(streakInfo.longestStreak)} />
              <Stat label="TOTAL" value={String(streakInfo.totalDaysClaimed)} />
            </div>

            {/* Claim button */}
            <button
              type="button"
              onClick={claimReward}
              disabled={!canClaim || claiming}
              className={canClaim ? 'stadium-btn stadium-btn-primary' : 'stadium-btn stadium-btn-ghost'}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '12px 18px',
                fontSize: 13,
              }}
            >
              {claiming ? (
                <>
                  <span
                    style={{
                      width: 13,
                      height: 13,
                      border: '2px solid currentColor',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'stadium-spin 0.9s linear infinite',
                    }}
                  />
                  Claiming…
                </>
              ) : canClaim ? (
                <>
                  <Icon.Bolt size={14} /> Claim reward
                </>
              ) : (
                'Already claimed today'
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    )}
    </div>
    </Modal>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    style={{
      textAlign: 'center',
      padding: '8px 6px',
      background: 'var(--surface-2)',
      borderRadius: 6,
      border: '1px solid var(--line)',
    }}
  >
    <div
      className="display num"
      style={{ fontSize: 22, color: 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1 }}
    >
      {value}
    </div>
    <div className="kicker" style={{ fontSize: 8, marginTop: 4 }}>{label}</div>
  </div>
);
