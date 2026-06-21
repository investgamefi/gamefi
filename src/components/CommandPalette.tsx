'use client';

/* CommandPalette (item 18, Marcus's wishlist) — global cmd+k / ctrl+k
   palette mounted from AppLayout. Routes via Next router for nav,
   dispatches actions via the store for one-shot operations.

   Behaviour:
   - cmd+k (mac) / ctrl+k (windows/linux) toggles the palette
   - typed query filters by label, subtitle, and keywords (case-insensitive)
   - ↑/↓ moves selection, Enter confirms, Esc closes
   - the selected index follows the filtered list so arrow keys stay
     intuitive even after typing

   Auth gating: AppLayout already redirects unauthenticated users
   off the page, so the palette only renders in an authed context.
   No additional guard needed here. */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Icon, IconName } from '@/components/stadium/Icon';
import { useStore } from '@/store/useStore';

interface Command {
  id: string;
  label: string;
  subtitle?: string;
  group: 'Navigation' | 'Actions';
  icon: IconName;
  /* Extra search terms — labels are obvious, this adds aliases
     ("home" → Matchday, "logout" → Log out). */
  keywords?: string[];
  onSelect: () => void;
}

export const CommandPalette: React.FC = () => {
  const router = useRouter();
  const { portfolios, logout, currentUser } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  /* Item refs for scrollIntoView on arrow nav so the active row
     stays visible without manual scrolling. */
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /* The first portfolio is used as a fallback target for "Sign empty
     positions" — Marcus's wishlist doesn't ask for a picker here, so
     we jump to the first one the user owns. */
  const firstPortfolioId = portfolios[0]?.id;

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const runAndClose = useCallback(
    (fn: () => void) => {
      fn();
      close();
    },
    [close],
  );

  /* Build the command list. useMemo so identity-stable closures don't
     thrash re-renders downstream. The list mirrors the Sidebar NAV
     entries plus a handful of one-shot Actions. */
  const commands = useMemo<Command[]>(() => {
    const navItems: Array<{ label: string; path: string; icon: IconName; keywords?: string[] }> = [
      { label: 'Matchday', path: '/dashboard', icon: 'Matchday', keywords: ['home', 'dashboard'] },
      { label: 'Squads', path: '/portfolio', icon: 'Pitch', keywords: ['portfolio', 'team'] },
      { label: 'Lineups', path: '/templates', icon: 'Lineup', keywords: ['templates', 'preset'] },
      { label: 'Fixtures', path: '/challenges', icon: 'Fixture', keywords: ['challenges', 'matches'] },
      { label: 'League', path: '/leaderboard', icon: 'Table', keywords: ['leaderboard', 'ranking'] },
      { label: 'Transfer', path: '/market', icon: 'Transfer', keywords: ['market', 'buy', 'browse'] },
      { label: 'Scout', path: '/explore', icon: 'Scout', keywords: ['explore', 'discover'] },
      { label: 'Training', path: '/training', icon: 'Coach', keywords: ['lessons', 'learn'] },
      { label: 'Compare', path: '/compare', icon: 'Compare', keywords: ['compare', 'benchmark'] },
      { label: 'Playbook', path: '/guide', icon: 'Whistle', keywords: ['guide', 'docs', 'help'] },
      { label: 'Settings', path: '/settings', icon: 'Settings', keywords: ['preferences', 'config'] },
      { label: 'Profile', path: '/profile', icon: 'Coach', keywords: ['account', 'me'] },
    ];

    const nav: Command[] = navItems.map((n) => ({
      id: `nav:${n.path}`,
      label: n.label,
      subtitle: n.path,
      group: 'Navigation',
      icon: n.icon,
      keywords: n.keywords,
      onSelect: () => runAndClose(() => router.push(n.path)),
    }));

    const actions: Command[] = [
      {
        id: 'act:new-squad',
        label: 'Create new squad',
        subtitle: 'Opens the new-squad form',
        group: 'Actions',
        icon: 'Plus',
        keywords: ['new', 'create', 'add', 'team', 'portfolio'],
        onSelect: () => runAndClose(() => router.push('/portfolio/new')),
      },
      ...(firstPortfolioId
        ? [
            {
              id: 'act:sign-empty',
              label: 'Sign empty positions',
              subtitle: `Bulk-sign on ${portfolios[0].name}`,
              group: 'Actions' as const,
              icon: 'Pitch' as const,
              keywords: ['fill', 'positions', 'bulk', 'sign'],
              onSelect: () =>
                runAndClose(() => router.push(`/portfolio/${firstPortfolioId}/sign`)),
            },
          ]
        : []),
      {
        id: 'act:daily-reward',
        label: 'Open daily reward',
        subtitle: 'Claim today\'s streak bonus',
        group: 'Actions',
        icon: 'Flame',
        keywords: ['streak', 'reward', 'xp', 'claim'],
        onSelect: () =>
          runAndClose(() => {
            /* DailyReward self-mounts in AppLayout and gates by API +
               session flag — clearing the dismiss flag triggers it on
               the next render. */
            if (typeof window !== 'undefined' && currentUser) {
              try {
                sessionStorage.removeItem(`daily_reward_${currentUser.id}`);
              } catch {
                /* Safari private mode etc — fail silently. */
              }
              /* Reload so the DailyReward effect re-fires its check. */
              window.location.reload();
            }
          }),
      },
      {
        id: 'act:onboarding',
        label: 'Open onboarding',
        subtitle: 'Replay the welcome tour',
        group: 'Actions',
        icon: 'Whistle',
        keywords: ['tour', 'welcome', 'tutorial'],
        onSelect: () =>
          runAndClose(() => {
            if (typeof window !== 'undefined' && currentUser) {
              try {
                localStorage.removeItem(`onboarding_${currentUser.id}`);
              } catch {
                /* fail silently */
              }
              window.location.reload();
            }
          }),
      },
      {
        id: 'act:logout',
        label: 'Log out',
        subtitle: 'End your session',
        group: 'Actions',
        icon: 'Close',
        keywords: ['signout', 'logout', 'leave'],
        onSelect: () =>
          runAndClose(() => {
            logout();
            router.push('/');
          }),
      },
    ];

    return [...nav, ...actions];
  }, [router, runAndClose, firstPortfolioId, portfolios, currentUser, logout]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const hay = [c.label, c.subtitle ?? '', ...(c.keywords ?? [])]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query, commands]);

  /* Keep the active index in range when the filtered list shrinks
     (e.g. after typing a more specific query). */
  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(0);
    }
  }, [filtered.length, activeIndex]);

  /* Scroll the active item into view on arrow nav. */
  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  /* Global cmd+k / ctrl+k listener — toggles the palette. Captures
     before browser Find shortcuts pick it up. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle =
        (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey);
      if (isToggle) {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* When opened, autofocus the input. Modal already handles Escape
     via its own listener; we add ArrowUp/Down/Enter here so they only
     fire while the palette is mounted. */
  useEffect(() => {
    if (!isOpen) return;
    /* Defer focus so it lands after Modal mounts the input. */
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) =>
          filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length,
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[activeIndex];
        if (cmd) cmd.onSelect();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, filtered, activeIndex]);

  /* Group the filtered commands by section so the rendered list shows
     headers between Navigation and Actions. */
  const grouped = useMemo(() => {
    const groups: Array<{ name: Command['group']; items: Command[] }> = [];
    for (const c of filtered) {
      const existing = groups.find((g) => g.name === c.group);
      if (existing) existing.items.push(c);
      else groups.push({ name: c.group, items: [c] });
    }
    return groups;
  }, [filtered]);

  /* Flat index → grouped item lookup so we can highlight the right
     row when iterating via arrow keys. */
  let flatIdx = -1;

  return (
    <Modal isOpen={isOpen} onClose={close} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          className="flex items-center"
          style={{
            gap: 10,
            padding: '10px 12px',
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            borderRadius: 8,
          }}
        >
          <Icon.Search size={16} style={{ color: 'var(--text-mute)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Type a command or jump to a page…"
            aria-label="Command palette search"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              letterSpacing: '-0.01em',
            }}
          />
          <kbd
            className="mono"
            style={{
              fontSize: 9,
              padding: '2px 6px',
              border: '1px solid var(--line)',
              borderRadius: 4,
              color: 'var(--text-mute)',
              letterSpacing: '0.08em',
            }}
          >
            ESC
          </kbd>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          {grouped.length === 0 ? (
            <div
              className="mono"
              style={{
                padding: 24,
                textAlign: 'center',
                color: 'var(--text-mute)',
                fontSize: 11,
                letterSpacing: '0.06em',
              }}
            >
              NO COMMANDS MATCH “{query}”
            </div>
          ) : (
            grouped.map((g) => (
              <div key={g.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="kicker" style={{ padding: '0 4px 2px' }}>
                  {g.name.toUpperCase()}
                </div>
                {g.items.map((cmd) => {
                  flatIdx += 1;
                  const active = flatIdx === activeIndex;
                  const Iconed = Icon[cmd.icon];
                  const myIdx = flatIdx;
                  return (
                    <button
                      key={cmd.id}
                      ref={(el) => {
                        itemRefs.current[myIdx] = el;
                      }}
                      type="button"
                      onClick={cmd.onSelect}
                      onMouseEnter={() => setActiveIndex(myIdx)}
                      className="flex items-center"
                      style={{
                        gap: 12,
                        padding: '10px 12px',
                        background: active ? 'var(--surface-2)' : 'transparent',
                        border: '1px solid ' + (active ? 'var(--line-2)' : 'transparent'),
                        borderLeft:
                          '3px solid ' + (active ? 'var(--pitch)' : 'transparent'),
                        borderRadius: 6,
                        textAlign: 'left',
                        cursor: 'pointer',
                        width: '100%',
                        color: 'var(--text)',
                      }}
                    >
                      <Iconed
                        size={16}
                        style={{
                          color: active ? 'var(--pitch)' : 'var(--text-mute)',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          className="display"
                          style={{
                            fontSize: 13,
                            letterSpacing: '-0.01em',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cmd.label}
                        </div>
                        {cmd.subtitle && (
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
                            {cmd.subtitle}
                          </div>
                        )}
                      </div>
                      {active && (
                        <kbd
                          className="mono"
                          style={{
                            fontSize: 9,
                            padding: '2px 6px',
                            border: '1px solid var(--pitch-deep)',
                            borderRadius: 4,
                            color: 'var(--pitch)',
                            background: 'oklch(0.72 0.21 145 / 0.10)',
                            letterSpacing: '0.08em',
                            flexShrink: 0,
                          }}
                        >
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          className="mono"
          style={{
            paddingTop: 8,
            borderTop: '1px solid var(--line)',
            fontSize: 10,
            color: 'var(--text-mute)',
            letterSpacing: '0.06em',
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span>↑↓ navigate</span>
          <span>· ↵ select</span>
          <span>· esc close</span>
        </div>
      </div>
    </Modal>
  );
};
