'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { AppLayout, Button, Input, Modal } from '@/components';
import { formatDate, calculateLevel } from '@/lib/utils';
import { ACHIEVEMENT_BADGES, BadgeRarity } from '@/types';
import { Icon } from '@/components/stadium/Icon';

/* Map badge rarity → stadium pill colour. */
const BADGE_RARITY_PILL: Record<BadgeRarity, string> = {
  common: 'pill',
  rare: 'pill pill-sky',
  epic: 'pill pill-pitch',
  legendary: 'pill pill-whistle',
};

export default function ProfilePage() {
  const { currentUser, portfolios, updateProfile, completedChallenges } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [isSaving, setIsSaving] = useState(false);

  const levelInfo = currentUser ? calculateLevel(currentUser.xp) : null;

  const totalPortfolios = portfolios.length;
  const challengesWon = completedChallenges?.filter((c) => c.winnerId === currentUser?.id).length || 0;
  const challengesLost = completedChallenges?.filter((c) => c.winnerId && c.winnerId !== currentUser?.id).length || 0;
  const winRate = challengesWon + challengesLost > 0
    ? Math.round((challengesWon / (challengesWon + challengesLost)) * 100)
    : 0;

  const earnedBadgeIds: string[] = [];
  if (totalPortfolios >= 1) earnedBadgeIds.push('first_portfolio');
  if (totalPortfolios >= 5) earnedBadgeIds.push('five_portfolios');
  if (challengesWon >= 1) earnedBadgeIds.push('first_win');
  if (challengesWon >= 10) earnedBadgeIds.push('ten_wins');
  if ((currentUser?.followers?.length || 0) >= 1) earnedBadgeIds.push('first_follower');
  if ((currentUser?.followers?.length || 0) >= 10) earnedBadgeIds.push('ten_followers');
  earnedBadgeIds.push('early_adopter');

  const earnedBadges = ACHIEVEMENT_BADGES.filter((b) => earnedBadgeIds.includes(b.id));
  const lockedBadges = ACHIEVEMENT_BADGES.filter((b) => !earnedBadgeIds.includes(b.id));

  const handleSave = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || currentUser.displayName,
        bio: bio.trim(),
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppLayout flush>
      <div
        style={{
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          maxWidth: 1080,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Manager card */}
        <div className="stadium-card" style={{ padding: '20px 24px' }}>
          <div
            className="flex flex-wrap"
            style={{ gap: 22, alignItems: 'center' }}
          >
            {/* Avatar with jersey number */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={currentUser?.avatar}
                alt={currentUser?.displayName}
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 8,
                  border: '1px solid var(--line-2)',
                  objectFit: 'cover',
                }}
              />
              {levelInfo && (
                <div
                  className="display num"
                  style={{
                    position: 'absolute',
                    bottom: -6,
                    right: -6,
                    width: 32,
                    height: 32,
                    background: 'var(--pitch)',
                    color: 'oklch(0.14 0.05 145)',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    border: '2px solid var(--surface)',
                  }}
                >
                  {levelInfo.level}
                </div>
              )}
            </div>

            {/* Identity */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="kicker">MANAGER · LV.{levelInfo?.level || 1}</div>
              <div
                className="display"
                style={{
                  fontSize: 'clamp(22px, 2.6vw, 28px)',
                  letterSpacing: '-0.04em',
                  marginTop: 2,
                }}
              >
                {currentUser?.displayName}
              </div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 2 }}>
                @{currentUser?.username} · joined{' '}
                {currentUser?.joinedAt ? formatDate(currentUser.joinedAt) : 'recently'}
              </div>
              {currentUser?.bio && (
                <div
                  style={{
                    color: 'var(--text-dim)',
                    fontSize: 13,
                    marginTop: 8,
                    lineHeight: 1.55,
                  }}
                >
                  {currentUser.bio}
                </div>
              )}
            </div>

            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Icon.Settings size={12} /> Edit profile
            </Button>
          </div>

          {/* XP progress bar */}
          {levelInfo && (
            <div
              style={{
                marginTop: 18,
                paddingTop: 18,
                borderTop: '1px solid var(--line)',
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span className="kicker">SEASON XP</span>
                <span
                  className="mono num"
                  style={{ fontSize: 12, color: 'var(--pitch)', fontWeight: 700 }}
                >
                  {currentUser?.xp.toLocaleString()} XP
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 6,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${(levelInfo.currentXp / levelInfo.nextLevelXp) * 100}%`,
                    height: '100%',
                    background: 'var(--pitch)',
                    transition: 'width .4s ease',
                  }}
                />
              </div>
              <div
                className="flex justify-between mono"
                style={{ marginTop: 4, fontSize: 10, color: 'var(--text-mute)' }}
              >
                <span>{levelInfo.currentXp} XP</span>
                <span>{levelInfo.nextLevelXp} XP TO LV.{levelInfo.level + 1}</span>
              </div>
            </div>
          )}
        </div>

        {/* Stat tiles */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          <StatTile kicker="SQUADS" value={String(totalPortfolios)} sub="Lifetime" />
          <StatTile kicker="WINS" value={String(challengesWon)} sub="Fixtures won" tone="pos" />
          <StatTile kicker="WIN %" value={`${winRate}%`} sub="Career win rate" tone={winRate >= 50 ? 'pos' : winRate > 0 ? 'neg' : undefined} />
          <StatTile kicker="FOLLOWERS" value={String(currentUser?.followers?.length || 0)} sub="In the dressing room" />
        </div>

        {/* Badges */}
        <section className="stadium-card" style={{ padding: 18 }}>
          <div className="flex items-baseline justify-between" style={{ marginBottom: 12 }}>
            <div>
              <div className="kicker">TROPHIES · {earnedBadges.length} EARNED</div>
              <div className="display" style={{ fontSize: 16, letterSpacing: '-0.02em', marginTop: 2 }}>
                Cabinet
              </div>
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
              {earnedBadges.length} / {ACHIEVEMENT_BADGES.length}
            </div>
          </div>

          {earnedBadges.length === 0 ? (
            <div
              className="kicker"
              style={{ padding: 24, textAlign: 'center' }}
            >
              NO TROPHIES YET — KEEP PLAYING TO UNLOCK ACHIEVEMENTS
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 10,
              }}
            >
              {earnedBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="stadium-card"
                  style={{
                    padding: 14,
                    textAlign: 'center',
                    background: 'var(--surface-2)',
                    transition: 'border-color .15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--pitch)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--line)';
                  }}
                  title={badge.description}
                >
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{badge.icon}</div>
                  <div
                    className="display"
                    style={{
                      fontSize: 12,
                      letterSpacing: '-0.01em',
                      marginBottom: 6,
                    }}
                  >
                    {badge.name}
                  </div>
                  <span
                    className={BADGE_RARITY_PILL[badge.rarity]}
                    style={{ padding: '1px 6px', fontSize: 9 }}
                  >
                    {badge.rarity}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Locked teaser */}
          {lockedBadges.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
              <div className="kicker" style={{ marginBottom: 8 }}>
                {lockedBadges.length} TROPHIES STILL TO EARN
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                  gap: 6,
                }}
              >
                {lockedBadges.slice(0, 6).map((badge) => (
                  <div
                    key={badge.id}
                    className="stadium-card"
                    style={{
                      padding: 10,
                      textAlign: 'center',
                      opacity: 0.45,
                      background: 'transparent',
                    }}
                    title={badge.description}
                  >
                    <div style={{ fontSize: 18, marginBottom: 4, filter: 'grayscale(1)' }}>
                      {badge.icon}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 9,
                        color: 'var(--text-mute)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {badge.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* My Squads */}
        <section className="stadium-card" style={{ padding: 18 }}>
          <div className="flex items-baseline justify-between" style={{ marginBottom: 12 }}>
            <div>
              <div className="kicker">FIELDED SQUADS</div>
              <div className="display" style={{ fontSize: 16, letterSpacing: '-0.02em', marginTop: 2 }}>
                My Squads
              </div>
            </div>
            <Link
              href="/portfolio"
              className="kicker"
              style={{ textDecoration: 'none', color: 'var(--text-dim)' }}
            >
              ALL SQUADS →
            </Link>
          </div>

          {portfolios.length === 0 ? (
            <div className="kicker" style={{ padding: 24, textAlign: 'center' }}>
              NO SQUADS FIELDED YET
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {portfolios.slice(0, 5).map((portfolio) => {
                const filled = portfolio.players.filter((p) => p.asset).length;
                return (
                  <Link
                    key={portfolio.id}
                    href={`/portfolio/${portfolio.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'background .12s ease, border-color .12s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--pitch)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--line)';
                    }}
                  >
                    <div
                      className="display num"
                      style={{
                        width: 44,
                        height: 36,
                        background: 'var(--pitch-tint)',
                        color: 'var(--pitch)',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        letterSpacing: '-0.02em',
                        flexShrink: 0,
                      }}
                    >
                      {portfolio.formation}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="display"
                        style={{
                          fontSize: 14,
                          letterSpacing: '-0.01em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {portfolio.name}
                      </div>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
                        {filled}/11 PLAYERS · {portfolio.isPublic ? 'PUBLIC' : 'PRIVATE'}
                      </div>
                    </div>
                    <Icon.Arrow size={14} style={{ color: 'var(--text-mute)' }} />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Edit profile modal */}
      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Edit profile" subtitle="MANAGER · DRESSING ROOM">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
          />

          <div>
            <label
              className="kicker"
              style={{ display: 'block', marginBottom: 6, color: 'var(--text-dim)' }}
            >
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the league about yourself…"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                color: 'var(--text)',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                lineHeight: 1.55,
                resize: 'vertical',
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
          </div>

          <div className="flex" style={{ gap: 10, paddingTop: 6 }}>
            <Button variant="ghost" onClick={() => setIsEditing(false)} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button onClick={handleSave} style={{ flex: 1 }} isLoading={isSaving}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}

const StatTile: React.FC<{
  kicker: string;
  value: string;
  sub?: string;
  tone?: 'pos' | 'neg';
}> = ({ kicker, value, sub, tone }) => (
  <div className="stadium-card" style={{ padding: 14 }}>
    <div className="kicker">{kicker}</div>
    <div
      className="display num"
      style={{
        fontSize: 22,
        letterSpacing: '-0.04em',
        marginTop: 4,
        color: tone === 'pos' ? 'var(--pitch)' : tone === 'neg' ? 'var(--ref-red)' : 'var(--text)',
      }}
    >
      {value}
    </div>
    {sub && (
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>
        {sub}
      </div>
    )}
  </div>
);
