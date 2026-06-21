'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BetaBanner } from '../BetaBanner';
import { FeedbackWidget } from '../FeedbackWidget';
import { Onboarding } from '../Onboarding';
import { DailyReward } from '../DailyReward';
import { CommandPalette } from '../CommandPalette';

interface AppLayoutProps {
  children: React.ReactNode;
  /**
   * When true, the page renders inside a flush container (no auto max-width/padding wrapper).
   * The new stadium designs (Matchday, Squads) are pre-padded internally and want this.
   */
  flush?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, flush = false }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, loadData } = useStore();

  // Sidebar state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div
        className="stadium-root min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="stadium-spinner" />
          <span className="kicker">LOADING MATCH DATA…</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="stadium-root min-h-screen"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <BetaBanner />

      <Sidebar
        isCollapsed={isCollapsed}
        onToggle={handleToggle}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <TopBar
        onMenuClick={() => setIsMobileOpen(true)}
        sidebarCollapsed={isCollapsed}
      />

      <main
        className={`min-h-screen pt-16 transition-all duration-200 ${
          isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[220px]'
        }`}
      >
        {flush ? (
          children
        ) : (
          <div className="max-w-7xl mx-auto" style={{ padding: '24px 24px 32px' }}>
            {children}
          </div>
        )}
      </main>

      <FeedbackWidget />

      {/* Retention loops — were built + exported but never mounted.
          Onboarding self-gates on its API + localStorage (first-time
          users only). DailyReward shows once per logged-in session
          and dismisses for the day via its own POST. */}
      <Onboarding />
      <DailyReward />
      {/* Power-user command palette (item 18). Global cmd+k / ctrl+k
          listener inside the component; renders a Modal overlay when
          triggered. Mounted here since AppLayout already redirects
          unauthenticated users away — palette never reaches an
          anonymous viewer. */}
      <CommandPalette />
    </div>
  );
};
