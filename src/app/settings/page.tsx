'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { AppLayout, Button, Input, Modal } from '@/components';
import { useTheme } from '@/components/ThemeProvider';
import { copyToClipboard } from '@/lib/utils';
import { ThemeMode } from '@/types';
import { Icon } from '@/components/stadium/Icon';

export default function SettingsPage() {
  const { currentUser, logout } = useStore();
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [priceAlertNotifications, setPriceAlertNotifications] = useState(true);
  const [preferencesSaved, setPreferencesSaved] = useState(false);

  // Referral
  const [referralCode, setReferralCode] = useState('');
  const [copiedReferral, setCopiedReferral] = useState(false);

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  useEffect(() => {
    if (currentUser) {
      setReferralCode(currentUser.id.substring(0, 8).toUpperCase());
    }
  }, [currentUser]);

  const handleCopyReferralCode = async () => {
    const success = await copyToClipboard(referralCode);
    if (success) {
      setCopiedReferral(true);
      setTimeout(() => setCopiedReferral(false), 2000);
    }
  };

  const handleCopyReferralLink = async () => {
    const link = typeof window !== 'undefined' ? `${window.location.origin}/register?ref=${referralCode}` : '';
    const success = await copyToClipboard(link);
    if (success) {
      setCopiedReferral(true);
      setTimeout(() => setCopiedReferral(false), 2000);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) return setPasswordError('Please enter your current password');
    if (!newPassword) return setPasswordError('Please enter a new password');
    if (newPassword.length < 8) return setPasswordError('New password must be at least 8 characters');
    if (newPassword !== confirmPassword) return setPasswordError('Passwords do not match');

    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id, currentPassword, newPassword }),
      });
      const result = await response.json();
      if (result.success) {
        setPasswordSuccess('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(result.error || 'Failed to change password');
      }
    } catch {
      setPasswordError('An error occurred. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          theme,
          notifications: { email: emailNotifications, push: pushNotifications, priceAlerts: priceAlertNotifications },
        }),
      });
      setPreferencesSaved(true);
      setTimeout(() => setPreferencesSaved(false), 2400);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') return;
    try {
      const response = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id }),
      });
      if (response.ok) {
        logout();
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  return (
    <AppLayout flush>
      <div
        style={{
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxWidth: 880,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Header */}
        <div>
          <div className="kicker">DRESSING ROOM · ACCOUNT</div>
          <h1
            className="display"
            style={{ fontSize: 'clamp(24px, 3vw, 32px)', letterSpacing: '-0.04em', margin: '2px 0 0' }}
          >
            Settings
          </h1>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 6 }}>
            Manage your manager profile, preferences, and security.
          </div>
        </div>

        {/* Account info */}
        <SettingsSection kicker="IDENTITY" title="Account Information">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Row label="USERNAME" value={`@${currentUser?.username}`} />
            <Row label="EMAIL" value={currentUser?.email || '—'} />
            <Row label="USER ID" value={currentUser?.id || '—'} mono />
          </div>
        </SettingsSection>

        {/* Password */}
        <SettingsSection kicker="SECURITY" title="Change Password">
          {passwordError && (
            <Banner tone="error">{passwordError}</Banner>
          )}
          {passwordSuccess && (
            <Banner tone="success">{passwordSuccess}</Banner>
          )}

          <form
            onSubmit={handlePasswordChange}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <Input
              type="password"
              label="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              leftIcon={<Icon.Bolt size={14} />}
            />
            <Input
              type="password"
              label="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              leftIcon={<Icon.Bolt size={14} />}
            />
            <Input
              type="password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              leftIcon={<Icon.Bolt size={14} />}
            />
            <div className="flex" style={{ marginTop: 4 }}>
              <Button type="submit" isLoading={isChangingPassword}>
                Change Password
              </Button>
            </div>
          </form>
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection kicker="NOTIFICATIONS" title="Bell">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ToggleRow
              title="Email Notifications"
              sub="Receive match recap emails and digest updates."
              on={emailNotifications}
              onChange={() => setEmailNotifications((v) => !v)}
            />
            <Divider />
            <ToggleRow
              title="Push Notifications"
              sub="In-app alerts for likes, clones, and fixture results."
              on={pushNotifications}
              onChange={() => setPushNotifications((v) => !v)}
            />
            <Divider />
            <ToggleRow
              title="Price Alerts"
              sub="Ping me when one of my players hits a target."
              on={priceAlertNotifications}
              onChange={() => setPriceAlertNotifications((v) => !v)}
            />
            <div className="flex items-center" style={{ gap: 12, marginTop: 6 }}>
              <Button variant="outline" onClick={handleSavePreferences}>
                Save Preferences
              </Button>
              {preferencesSaved && (
                <span className="mono" style={{ fontSize: 11, color: 'var(--pitch)', letterSpacing: '0.12em' }}>
                  SAVED
                </span>
              )}
            </div>
          </div>
        </SettingsSection>

        {/* Referral */}
        <SettingsSection kicker="RECRUITMENT" title="Referral Program">
          <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0, marginBottom: 14, lineHeight: 1.55 }}>
            Invite a friend and earn <strong style={{ color: 'var(--pitch)' }}>+100 XP</strong> for every signup using your code.
          </p>
          <div
            className="stadium-card"
            style={{ padding: 14, background: 'var(--surface-2)', marginBottom: 10 }}
          >
            <div className="kicker" style={{ marginBottom: 6 }}>YOUR REFERRAL CODE</div>
            <div className="flex items-center" style={{ gap: 8 }}>
              <code
                className="mono num"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--pitch)',
                  letterSpacing: '0.1em',
                }}
              >
                {referralCode}
              </code>
              <Button variant="outline" onClick={handleCopyReferralCode}>
                {copiedReferral ? 'Copied!' : 'Copy code'}
              </Button>
            </div>
          </div>
          <Button variant="outline" onClick={handleCopyReferralLink} style={{ width: '100%' }}>
            <Icon.Transfer size={14} /> Copy referral link
          </Button>
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection
          kicker="APPEARANCE"
          title="Theme"
          subtitle={`Currently: ${resolvedTheme}`}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}
          >
            {(
              [
                ['dark', 'Dark', Icon.Moon, 'Deep ink, neon green accent'],
                ['light', 'Light', Icon.Sun, 'Warm chalk paper'],
                ['system', 'System', Icon.Settings, 'Match the OS'],
              ] as const
            ).map(([mode, label, IconCmp, sub]) => {
              const isActive = theme === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTheme(mode as ThemeMode)}
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    background: isActive ? 'var(--pitch-tint)' : 'var(--surface)',
                    border: '1px solid ' + (isActive ? 'var(--pitch)' : 'var(--line)'),
                    color: 'var(--text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--font-display)',
                    transition: 'background .12s, border-color .12s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <IconCmp size={20} style={{ color: isActive ? 'var(--pitch)' : 'var(--text-dim)' }} />
                  <div className="display" style={{ fontSize: 14, letterSpacing: '-0.01em' }}>
                    {label}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.05em' }}>
                    {sub}
                  </div>
                </button>
              );
            })}
          </div>
        </SettingsSection>

        {/* Danger zone */}
        <div
          className="stadium-card"
          style={{
            padding: 18,
            background: 'oklch(0.65 0.22 25 / 0.06)',
            borderColor: 'oklch(0.65 0.22 25 / 0.3)',
          }}
        >
          <div className="flex items-center" style={{ gap: 8, marginBottom: 6 }}>
            <Icon.Close size={16} style={{ color: 'var(--ref-red)' }} />
            <div className="kicker" style={{ color: 'var(--ref-red)' }}>DANGER ZONE</div>
          </div>
          <div className="display" style={{ fontSize: 16, letterSpacing: '-0.02em', marginBottom: 6 }}>
            Disband your manager account
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0, marginBottom: 14, lineHeight: 1.55 }}>
            Once you delete your account, there&apos;s no going back. All squads, fixtures, badges, and XP are wiped.
          </p>
          <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
            Delete account
          </Button>
        </div>
      </div>

      {/* Delete modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Disband manager account?"
        subtitle="DANGER ZONE · IRREVERSIBLE"
        size="sm"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Banner tone="error">
            This action cannot be undone. All squads, fixtures, badges, and XP will be wiped permanently.
          </Banner>
          <div>
            <label className="kicker" style={{ display: 'block', marginBottom: 6, color: 'var(--text-dim)' }}>
              TYPE <span style={{ color: 'var(--ref-red)', fontFamily: 'var(--font-mono)' }}>DELETE</span> TO CONFIRM
            </label>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="DELETE"
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--ref-red)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--line)';
              }}
            />
          </div>
          <div className="flex" style={{ gap: 10, paddingTop: 6 }}>
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation !== 'DELETE'}
              style={{ flex: 1 }}
            >
              Delete account
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}

/* ============================================================
   Building blocks
   ============================================================ */
const SettingsSection: React.FC<{
  kicker: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ kicker, title, subtitle, children }) => (
  <section className="stadium-card" style={{ padding: 18 }}>
    <div style={{ marginBottom: 14 }}>
      <div className="kicker">{kicker}</div>
      <div className="display" style={{ fontSize: 16, letterSpacing: '-0.02em', marginTop: 2 }}>
        {title}
      </div>
      {subtitle && (
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 2 }}>
          {subtitle}
        </div>
      )}
    </div>
    {children}
  </section>
);

const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div>
    <div className="kicker" style={{ marginBottom: 2 }}>{label}</div>
    <div
      className={mono ? 'mono' : 'display'}
      style={{
        fontSize: mono ? 11 : 14,
        color: 'var(--text)',
        letterSpacing: mono ? '0.05em' : '-0.01em',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {value}
    </div>
  </div>
);

const Divider: React.FC = () => (
  <div style={{ height: 1, background: 'var(--line)' }} />
);

const ToggleRow: React.FC<{
  title: string;
  sub: string;
  on: boolean;
  onChange: () => void;
}> = ({ title, sub, on, onChange }) => (
  <div className="flex items-center justify-between" style={{ gap: 16 }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="display" style={{ fontSize: 14, letterSpacing: '-0.01em' }}>
        {title}
      </div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 2, lineHeight: 1.4 }}>
        {sub}
      </div>
    </div>
    <button
      type="button"
      onClick={onChange}
      style={{
        position: 'relative',
        width: 42,
        height: 22,
        borderRadius: 999,
        background: on ? 'var(--pitch)' : 'var(--surface-2)',
        border: '1px solid ' + (on ? 'var(--pitch-deep)' : 'var(--line)'),
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background .15s, border-color .15s',
      }}
      aria-pressed={on}
      aria-label={title}
    >
      <span
        style={{
          position: 'absolute',
          top: 1,
          left: on ? 21 : 1,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: on ? 'oklch(0.14 0.05 145)' : 'var(--text-mute)',
          transition: 'left .15s ease',
        }}
      />
    </button>
  </div>
);

const Banner: React.FC<{ tone: 'success' | 'error'; children: React.ReactNode }> = ({ tone, children }) => (
  <div
    className="stadium-card"
    style={{
      padding: '10px 12px',
      marginBottom: 12,
      background: tone === 'success' ? 'var(--pitch-tint)' : 'oklch(0.65 0.22 25 / 0.08)',
      borderColor:
        tone === 'success' ? 'oklch(0.72 0.21 145 / 0.3)' : 'oklch(0.65 0.22 25 / 0.3)',
    }}
  >
    <p
      className="mono"
      style={{
        margin: 0,
        fontSize: 11,
        color: tone === 'success' ? 'var(--pitch)' : 'var(--ref-red)',
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </p>
  </div>
);
