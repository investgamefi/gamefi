'use client';

/* Training — merged page combining the former /coaching (Drills) and
   /learn (Reference) routes. Drills is the default tab; old /learn URLs
   pass ?tab=reference via redirect so bookmarks still land in the right
   spot. */

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components';
import { Icon } from '@/components/stadium/Icon';
import { DrillsView } from './DrillsView';
import { ReferenceView } from './ReferenceView';

type TrainingTab = 'drills' | 'reference';

function TrainingInner() {
  const searchParams = useSearchParams();
  const initialTab: TrainingTab = searchParams.get('tab') === 'reference' ? 'reference' : 'drills';
  const [tab, setTab] = useState<TrainingTab>(initialTab);

  /* Keep the active tab in sync if the user navigates with ?tab= changes
     (e.g. clicks a Drills link while already on Reference). */
  useEffect(() => {
    const t = searchParams.get('tab');
    setTab(t === 'reference' ? 'reference' : 'drills');
  }, [searchParams]);

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Unified page header */}
      <div>
        <div className="kicker">YOUR LICENSE · TRAINING GROUND</div>
        <h1
          className="display"
          style={{ fontSize: 'clamp(24px, 3vw, 32px)', letterSpacing: '-0.04em', margin: '2px 0 0' }}
        >
          Training
        </h1>
      </div>

      {/* Tab switcher — segmented control */}
      <div
        className="flex"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: 4,
          gap: 4,
          width: 'fit-content',
        }}
      >
        <TabButton
          active={tab === 'drills'}
          onClick={() => setTab('drills')}
          icon={<Icon.Coach size={14} />}
          label="Drills"
          sub="Curriculum"
        />
        <TabButton
          active={tab === 'reference'}
          onClick={() => setTab('reference')}
          icon={<Icon.Guide size={14} />}
          label="Reference"
          sub="Library"
        />
      </div>

      {/* Active view */}
      {tab === 'drills' ? (
        <DrillsView onSwitchToReference={() => setTab('reference')} />
      ) : (
        <ReferenceView />
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
}

function TabButton({ active, onClick, icon, label, sub }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center"
      style={{
        gap: 10,
        padding: '8px 16px',
        background: active ? 'var(--pitch)' : 'transparent',
        color: active ? 'oklch(0.14 0.05 145)' : 'var(--text-dim)',
        border: '1px solid ' + (active ? 'var(--pitch-deep)' : 'transparent'),
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'background .12s, color .12s, border-color .12s',
        fontFamily: 'var(--font-display)',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.color = 'var(--text)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.color = 'var(--text-dim)';
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>{label}</span>
        <span
          className="mono"
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: active ? 0.7 : 0.6,
            marginTop: 1,
          }}
        >
          {sub}
        </span>
      </span>
    </button>
  );
}

export default function TrainingPage() {
  return (
    <AppLayout flush>
      <Suspense fallback={null}>
        <TrainingInner />
      </Suspense>
    </AppLayout>
  );
}
