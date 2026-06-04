'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, IconName } from '@/components/stadium/Icon';
import { useStore } from '@/store/useStore';
import { calculateLevel } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

// Routes map 1:1 to the existing app routes — only labels and icons changed.
const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',   label: 'Matchday',  icon: 'Matchday' },
  { href: '/portfolio',   label: 'Squads',    icon: 'Pitch'    },
  { href: '/templates',   label: 'Lineups',   icon: 'Lineup'   },
  { href: '/challenges',  label: 'Fixtures',  icon: 'Fixture'  },
  { href: '/leaderboard', label: 'League',    icon: 'Table'    },
  { href: '/market',      label: 'Transfer',  icon: 'Transfer' },
  { href: '/explore',     label: 'Scout',     icon: 'Scout'    },
  { href: '/training',    label: 'Training',  icon: 'Coach'    },
  { href: '/compare',     label: 'Compare',   icon: 'Compare'  },
  { href: '/guide',       label: 'Playbook',  icon: 'Whistle'  },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggle,
  isMobileOpen,
  onMobileClose,
}) => {
  const pathname = usePathname();
  const { currentUser } = useStore();
  const levelInfo = currentUser ? calculateLevel(currentUser.xp) : null;

  const sidebarContent = (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-2)' }}>
      {/* Logo block */}
      <div
        className="flex items-center gap-3"
        style={{
          padding: isCollapsed ? '20px 16px' : '20px 18px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'var(--text)',
            color: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon.Logo size={22} />
        </div>
        {!isCollapsed && (
          <div>
            <div className="display" style={{ fontSize: 16, letterSpacing: '-0.03em', color: 'var(--text)' }}>
              GAMEFI
            </div>
            <div className="kicker" style={{ fontSize: 9, marginTop: -2 }}>
              INVEST · LEAGUE
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto"
        style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {NAV_ITEMS.map((item) => {
          const IconCmp = Icon[item.icon];
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              title={isCollapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: isCollapsed ? '10px 16px' : '10px 12px',
                background: isActive ? 'var(--surface)' : 'transparent',
                border: isActive ? '1px solid var(--line-2)' : '1px solid transparent',
                borderLeft: isActive ? '3px solid var(--pitch)' : '3px solid transparent',
                color: isActive ? 'var(--text)' : 'var(--text-dim)',
                textAlign: 'left',
                borderRadius: 6,
                fontFamily: 'var(--font-display)',
                fontWeight: isActive ? 600 : 500,
                fontSize: 13,
                letterSpacing: '0.01em',
                transition: 'background .12s, color .12s',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              <IconCmp size={18} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Rank footer */}
      {!isCollapsed && levelInfo && currentUser && (
        <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
          <div className="kicker" style={{ fontSize: 9, marginBottom: 6 }}>YOUR RANK</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div className="display num" style={{ fontSize: 26, letterSpacing: '-0.05em', color: 'var(--text)' }}>
              Lv.{levelInfo.level}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--pitch)' }}>
              {currentUser.xp.toLocaleString()} XP
            </div>
          </div>
          <div
            style={{
              marginTop: 6,
              height: 4,
              background: 'var(--surface)',
              borderRadius: 2,
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
          <div className="mono" style={{ fontSize: 9, color: 'var(--text-mute)', marginTop: 4 }}>
            {levelInfo.level >= 5
              ? 'MAX LEVEL'
              : `${levelInfo.currentXp} / ${levelInfo.nextLevelXp} XP TO LV.${levelInfo.level + 1}`}
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="hidden lg:block" style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
        <button
          onClick={onToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '8px 10px',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 6,
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
          }}
        >
          <Icon.Chevron size={14} style={{ transform: isCollapsed ? 'none' : 'rotate(180deg)' }} />
          {!isCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 top-0 h-screen z-40"
        style={{
          width: isCollapsed ? 72 : 220,
          background: 'var(--bg-2)',
          borderRight: '1px solid var(--line)',
          transition: 'width .2s ease',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="lg:hidden fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed left-0 top-0 h-screen z-50"
              style={{
                width: 260,
                background: 'var(--bg-2)',
                borderRight: '1px solid var(--line)',
              }}
            >
              <button
                onClick={onMobileClose}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  padding: 8,
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  zIndex: 1,
                }}
              >
                <Icon.Close size={16} />
              </button>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
