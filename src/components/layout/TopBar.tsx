'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/components/ThemeProvider';
import { Icon } from '@/components/stadium/Icon';
import { calculateLevel } from '@/lib/utils';
import { getMarketPillSpec, getMarketStatus, MarketStatus } from '@/lib/marketHours';

interface TopBarProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick, sidebarCollapsed }) => {
  const { currentUser, logout, notifications, seasonState } = useStore();
  const { resolvedTheme, setTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const levelInfo = currentUser ? calculateLevel(currentUser.xp) : null;
  const isDark = resolvedTheme === 'dark';

  /* Live market-hours check. Re-evaluates every 60s while mounted so
     the pill flips at the open/close bell without a page reload.
     Initial value is computed synchronously so SSR matches the first
     client render. */
  const [marketStatus, setMarketStatus] = useState<MarketStatus>(() => getMarketStatus());
  useEffect(() => {
    const tick = () => setMarketStatus(getMarketStatus());
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const pillSpec = getMarketPillSpec(marketStatus);

  return (
    <header
      className={
        'fixed top-0 right-0 z-30 ' +
        /* Desktop only — reserve the sidebar rail. Mobile/iPad portrait
           (<lg) leaves padding-left at 0 so the hamburger and MARKET
           OPEN pill aren't shoved off-screen by the 220px inline pad. */
        (sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[220px]')
      }
      style={{
        height: 64,
        left: 0,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--line)',
        transition: 'padding-left .2s ease',
      }}
    >
      <div
        className="flex items-center justify-between h-full"
        style={{ padding: '0 24px' }}
      >
        {/* Left: mobile menu + market status pill */}
        <div className="flex items-center" style={{ gap: 14, overflow: 'hidden', flex: 1 }}>
          <button
            onClick={onMenuClick}
            className="lg:hidden tap44"
            style={{
              padding: 8,
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 6,
              color: 'var(--text-dim)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Open menu"
          >
            <Icon.Menu size={18} />
          </button>

          {/* Market status pill — driven by real NYSE hours via
              lib/marketHours.ts. Updates every 60s. Three states map
              to ref-red (live), whistle/amber (pre/after-hours),
              text-mute (closed). */}
          <span
            className="pill"
            style={(() => {
              if (pillSpec.role === 'live') {
                return {
                  flexShrink: 0,
                  background: 'oklch(0.65 0.22 25 / 0.14)',
                  color: 'var(--ref-red)',
                  border: '1px solid oklch(0.65 0.22 25 / 0.3)',
                };
              }
              if (pillSpec.role === 'amber') {
                return {
                  flexShrink: 0,
                  background: 'oklch(0.83 0.18 90 / 0.14)',
                  color: 'var(--whistle)',
                  border: '1px solid oklch(0.83 0.18 90 / 0.3)',
                };
              }
              return {
                flexShrink: 0,
                background: 'var(--surface-2)',
                color: 'var(--text-mute)',
                border: '1px solid var(--line)',
              };
            })()}
            title={`NYSE clock · ${pillSpec.label}`}
          >
            {pillSpec.role === 'live' && <span className="live-dot" />}
            {/* Mobile shows the trailing word only ("OPEN", "HOLIDAY",
                "CLOSED") so the pill doesn't crowd the icons; tablet+
                shows the full label. */}
            <span className="sm:hidden">
              {pillSpec.label.split(' ').slice(-1)[0]}
            </span>
            <span className="hidden sm:inline">{pillSpec.label}</span>
          </span>

          {/* Season window pills — only render when seasonState loaded and a
             window is open. Mirror the LIVE/MARKET OPEN pill style so the
             header reads as one row of status badges. */}
          {seasonState?.isTransferWindowOpen && (
            <span
              className="pill pill-pitch !hidden sm:!inline-flex"
              style={{
                flexShrink: 0,
                background: 'oklch(0.72 0.21 145 / 0.16)',
                color: 'var(--pitch)',
                border: '1px solid oklch(0.72 0.21 145 / 0.35)',
              }}
              title="Quarterly transfer window: sign up to 5 new players for 100 XP each"
            >
              <span
                className="live-dot"
                style={{
                  background: 'var(--pitch)',
                  boxShadow: '0 0 0 0 var(--pitch)',
                }}
              />
              TRANSFER · Q{seasonState.currentQuarter}
            </span>
          )}
          {seasonState?.isWeekendWindowOpen && (
            <span
              className="pill pill-whistle !hidden md:!inline-flex"
              style={{ flexShrink: 0 }}
              title="Weekend swap window open: sub up to 4 starters with bench for 25 XP each"
            >
              WEEKEND · 4 SUBS
            </span>
          )}

          <span
            className="kicker hidden lg:inline-flex"
            style={{ alignItems: 'center', gap: 8, color: 'var(--text-mute)' }}
          >
            MATCHDAY · {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
          </span>
        </div>

        {/* Right: actions + avatar */}
        <div className="flex items-center" style={{ gap: 10, flexShrink: 0, marginLeft: 16 }}>
          {/* XP badge */}
          {levelInfo && (
            <div
              className="hidden sm:flex items-center"
              style={{
                gap: 8,
                padding: '6px 10px',
                borderRadius: 6,
                background: 'var(--surface)',
                border: '1px solid var(--line)',
              }}
            >
              <span
                className="display num"
                style={{ fontSize: 13, color: 'var(--pitch)', letterSpacing: '-0.02em' }}
              >
                Lv.{levelInfo.level}
              </span>
              <div
                style={{
                  width: 60,
                  height: 4,
                  borderRadius: 2,
                  background: 'var(--surface-2)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${levelInfo.level >= 5 ? 100 : (levelInfo.currentXp / levelInfo.nextLevelXp) * 100}%`,
                    height: '100%',
                    background: 'var(--pitch)',
                  }}
                />
              </div>
              <span className="mono num" style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {currentUser?.xp.toLocaleString()} XP
              </span>
            </div>
          )}

          {/* Theme toggle */}
          <button
            className="stadium-btn stadium-btn-ghost tap44"
            style={{ padding: '8px 10px' }}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? <Icon.Sun size={16} /> : <Icon.Moon size={16} />}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="stadium-btn stadium-btn-ghost tap44"
              style={{ padding: '8px 10px', position: 'relative' }}
              aria-label={
                unreadCount > 0
                  ? `${unreadCount} unread notifications`
                  : 'Notifications (none unread)'
              }
            >
              <Icon.Bell size={16} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 6,
                    minWidth: 14,
                    height: 14,
                    padding: '0 3px',
                    borderRadius: 999,
                    background: 'var(--ref-red)',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="absolute right-0 z-50"
                    style={{
                      top: 'calc(100% + 6px)',
                      width: 320,
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    <div
                      style={{
                        padding: 14,
                        borderBottom: '1px solid var(--line)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span className="display" style={{ fontSize: 14, color: 'var(--text)' }}>
                        Notifications
                      </span>
                      <span className="kicker">{unreadCount} NEW</span>
                    </div>
                    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div className="kicker" style={{ padding: 24, textAlign: 'center' }}>
                          NO NOTIFICATIONS YET
                        </div>
                      ) : (
                        notifications.slice(0, 6).map((notif) => (
                          <div
                            key={notif.id}
                            style={{
                              padding: 14,
                              borderBottom: '1px solid var(--line)',
                              background: notif.read ? 'transparent' : 'var(--pitch-tint)',
                            }}
                          >
                            <p style={{ margin: 0, color: 'var(--text)', fontSize: 13, lineHeight: 1.45 }}>
                              {notif.message}
                            </p>
                            <p
                              className="mono"
                              style={{ margin: '4px 0 0', color: 'var(--text-mute)', fontSize: 10 }}
                            >
                              {new Date(notif.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* User avatar / menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label="User menu"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 6px 4px 4px',
                background: 'transparent',
                border: '1px solid var(--line)',
                borderRadius: 6,
                cursor: 'pointer',
                color: 'var(--text)',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  background: 'var(--pitch)',
                  color: 'oklch(0.14 0.05 145)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: '-0.02em',
                  overflow: 'hidden',
                }}
              >
                {currentUser?.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.username}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  (currentUser?.displayName?.[0] || currentUser?.username?.[0] || '?').toUpperCase()
                )}
              </div>
              <span
                className="display hidden sm:inline"
                style={{ fontSize: 12, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {currentUser?.displayName}
              </span>
              <Icon.Chevron size={12} style={{ transform: 'rotate(90deg)', color: 'var(--text-mute)' }} />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="absolute right-0 z-50"
                    style={{
                      top: 'calc(100% + 6px)',
                      width: 220,
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    <div style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
                      <div className="display" style={{ fontSize: 14, color: 'var(--text)' }}>
                        {currentUser?.displayName}
                      </div>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 2 }}>
                        @{currentUser?.username}
                      </div>
                    </div>
                    <div style={{ padding: 6 }}>
                      <UserMenuLink href="/profile" icon="Profile" label="Profile" onClick={() => setShowUserMenu(false)} />
                      <UserMenuLink href="/settings" icon="Settings" label="Settings" onClick={() => setShowUserMenu(false)} />
                      <button
                        onClick={() => {
                          logout();
                          setShowUserMenu(false);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--ref-red)',
                          fontFamily: 'var(--font-display)',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          borderRadius: 6,
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'oklch(0.65 0.22 25 / 0.10)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <Icon.Close size={16} />
                        Log out
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};

const UserMenuLink: React.FC<{
  href: string;
  icon: 'Profile' | 'Settings';
  label: string;
  onClick: () => void;
}> = ({ href, icon, label, onClick }) => {
  const IconCmp = Icon[icon];
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-display)',
        fontSize: 13,
        fontWeight: 500,
        borderRadius: 6,
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
        (e.currentTarget as HTMLElement).style.color = 'var(--text)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)';
      }}
    >
      <IconCmp size={16} />
      {label}
    </Link>
  );
};
