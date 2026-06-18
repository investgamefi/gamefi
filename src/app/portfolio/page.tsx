'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { AppLayout, Modal, Input } from '@/components';
import { Icon } from '@/components/stadium/Icon';
import { Formation, FORMATIONS, PortfolioPerformance, TEAM_SLOT_UNLOCK_COST } from '@/types';
import {
  formatCurrency,
  formatPercent,
  calculatePortfolioPerformance,
} from '@/lib/utils';
import { fetchMultiplePortfolioPerformances } from '@/hooks/usePortfolioRealPerformance';

export default function PortfolioListPage() {
  const router = useRouter();
  const {
    portfolios,
    createPortfolio,
    canCreateTeam,
    getTeamSlotInfo,
    unlockTeamSlot,
    seasonState,
  } = useStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioDesc, setNewPortfolioDesc] = useState('');
  const [selectedFormation, setSelectedFormation] = useState<Formation>('4-3-3');

  const [perfMap, setPerfMap] = useState<
    Map<string, { performance: PortfolioPerformance; isRealData: boolean }>
  >(new Map());
  const [loadingPerf, setLoadingPerf] = useState(false);

  useEffect(() => {
    if (portfolios.length === 0) return;
    const run = async () => {
      setLoadingPerf(true);
      try {
        const performances = await fetchMultiplePortfolioPerformances(portfolios, '1M');
        setPerfMap(performances);
      } catch (err) {
        console.error('Failed to fetch squad performances:', err);
      } finally {
        setLoadingPerf(false);
      }
    };
    run();
  }, [portfolios]);

  const totals = useMemo(() => {
    if (portfolios.length === 0) return null;
    const performances = portfolios.map(
      (p) => perfMap.get(p.id)?.performance || calculatePortfolioPerformance(p),
    );
    const totalValue = performances.reduce((sum, p) => sum + p.totalValue, 0);
    const avgReturn = performances.reduce((sum, p) => sum + p.totalReturnPercent, 0) / performances.length;
    return { totalValue, avgReturn };
  }, [portfolios, perfMap]);

  const slotInfo = getTeamSlotInfo();

  const handleCreatePortfolio = async () => {
    if (!newPortfolioName.trim() || !canCreateTeam()) return;
    try {
      const portfolio = await createPortfolio(newPortfolioName, newPortfolioDesc, selectedFormation);
      setShowCreateModal(false);
      setNewPortfolioName('');
      setNewPortfolioDesc('');
      router.push(`/portfolio/${portfolio.id}`);
    } catch (err) {
      console.error('Failed to create portfolio:', err);
    }
  };

  return (
    <AppLayout flush>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between" style={{ gap: 14 }}>
          <div>
            <div className="kicker">YOUR XI · LINEUPS</div>
            <h1
              className="display"
              style={{ fontSize: 'clamp(24px, 3vw, 32px)', letterSpacing: '-0.04em', margin: '2px 0 0' }}
            >
              Squads
            </h1>
            <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 6 }}>
              {slotInfo.current} of {slotInfo.max} slots used · Manage your investment teams.
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 10, flexWrap: 'wrap' }}>
            {!canCreateTeam() && (
              <button
                type="button"
                className="stadium-btn stadium-btn-ghost"
                onClick={async () => {
                  await unlockTeamSlot();
                }}
                disabled={!slotInfo.canUnlock}
                title={
                  slotInfo.canUnlock
                    ? `Spend ${TEAM_SLOT_UNLOCK_COST} XP to unlock`
                    : `Need ${TEAM_SLOT_UNLOCK_COST} XP to unlock`
                }
              >
                Unlock slot ({TEAM_SLOT_UNLOCK_COST} XP)
              </button>
            )}
            <button
              type="button"
              className="stadium-btn stadium-btn-primary"
              onClick={() => setShowCreateModal(true)}
              disabled={!canCreateTeam()}
              style={{ opacity: canCreateTeam() ? 1 : 0.5 }}
            >
              <Icon.Plus size={14} /> Field a new XI
            </button>
          </div>
        </div>

        {/* Transfer window banner — only when a quarterly window is
            actually open. Mirrors the contextual banner pattern the
            Matchday page uses for season events. */}
        {seasonState?.isTransferWindowOpen && (
          <div
            className="stadium-card"
            style={{
              padding: '14px 18px',
              background: 'var(--pitch-tint)',
              borderColor: 'oklch(0.72 0.21 145 / 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span
              className="live-dot"
              style={{
                background: 'var(--pitch)',
                boxShadow: '0 0 0 0 var(--pitch)',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="kicker" style={{ color: 'var(--pitch)' }}>
                TRANSFER WINDOW OPEN · Q{seasonState.currentQuarter}
              </div>
              <div
                className="display"
                style={{ fontSize: 14, letterSpacing: '-0.01em', marginTop: 4 }}
              >
                Sign up to 5 new players for 100 XP each. Tap any squad to manage transfers.
              </div>
            </div>
            <span className="mono num" style={{ fontSize: 11, color: 'var(--text-mute)' }}>
              GW{seasonState.currentGameweek}/52
            </span>
          </div>
        )}

        {/* Aggregate strip */}
        {totals && (
          <div
            className="stadium-card"
            style={{
              padding: '14px 18px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 8,
            }}
          >
            <div>
              <div className="kicker">TOTAL EQUITY</div>
              <div
                className="display num"
                style={{ fontSize: 20, letterSpacing: '-0.04em', marginTop: 4 }}
              >
                {formatCurrency(totals.totalValue)}
              </div>
            </div>
            <div>
              <div className="kicker">AVG RETURN</div>
              <div
                className="display num"
                style={{
                  fontSize: 20,
                  letterSpacing: '-0.04em',
                  marginTop: 4,
                  color: totals.avgReturn >= 0 ? 'var(--pitch)' : 'var(--ref-red)',
                }}
              >
                {formatPercent(totals.avgReturn)}
              </div>
            </div>
            <div>
              <div className="kicker">SQUADS FIELDED</div>
              <div
                className="display num"
                style={{ fontSize: 20, letterSpacing: '-0.04em', marginTop: 4 }}
              >
                {portfolios.length}
              </div>
            </div>
            <div>
              <div className="kicker">SLOTS AVAILABLE</div>
              <div
                className="display num"
                style={{ fontSize: 20, letterSpacing: '-0.04em', marginTop: 4 }}
              >
                {slotInfo.max - slotInfo.current}
              </div>
            </div>
          </div>
        )}

        {/* Squads grid / empty */}
        {portfolios.length === 0 ? (
          <div
            className="stadium-card"
            style={{
              padding: 60,
              textAlign: 'center',
              borderStyle: 'dashed',
            }}
          >
            <Icon.Pitch size={48} style={{ color: 'var(--text-mute)', margin: '0 auto 16px' }} />
            <div className="display" style={{ fontSize: 22, marginBottom: 8 }}>
              No squads yet
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 14, maxWidth: 480, margin: '0 auto 22px' }}>
              Pick a formation. Fill the lineup with eleven tickers. Captain your top pick. The market is your match clock.
            </div>
            <button
              type="button"
              className="stadium-btn stadium-btn-primary"
              style={{ padding: '12px 20px', fontSize: 14 }}
              onClick={() => setShowCreateModal(true)}
              disabled={!canCreateTeam()}
            >
              <Icon.Plus size={16} /> Field your first XI
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 14,
            }}
          >
            {portfolios.map((p) => {
              const perf = perfMap.get(p.id)?.performance || calculatePortfolioPerformance(p);
              return (
                <SquadCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  description={p.description}
                  formation={p.formation}
                  isPublic={p.isPublic}
                  value={perf.totalValue}
                  returnPct={perf.totalReturnPercent}
                  dayPct={perf.dayReturnPercent}
                  loadingPerf={loadingPerf && !perfMap.has(p.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Create Portfolio Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Field a new XI"
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Input
            label="Squad Name"
            placeholder="e.g., Phoenix XI"
            value={newPortfolioName}
            onChange={(e) => setNewPortfolioName(e.target.value)}
          />
          <Input
            label="Description (Optional)"
            placeholder="Your tactical approach…"
            value={newPortfolioDesc}
            onChange={(e) => setNewPortfolioDesc(e.target.value)}
          />
          <div>
            <label
              style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                marginBottom: 10,
              }}
            >
              Pick a formation
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {(Object.keys(FORMATIONS) as Formation[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelectedFormation(f)}
                  style={{
                    padding: '14px 10px',
                    background: selectedFormation === f ? 'var(--pitch-tint)' : 'var(--surface)',
                    border: '1px solid ' + (selectedFormation === f ? 'var(--pitch)' : 'var(--line)'),
                    color: selectedFormation === f ? 'var(--pitch)' : 'var(--text)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex" style={{ gap: 10, paddingTop: 8 }}>
            <button
              type="button"
              className="stadium-btn stadium-btn-ghost"
              style={{ flex: 1, justifyContent: 'center', padding: '12px 20px' }}
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="stadium-btn stadium-btn-primary"
              style={{ flex: 1, justifyContent: 'center', padding: '12px 20px' }}
              onClick={handleCreatePortfolio}
              disabled={!newPortfolioName.trim() || !canCreateTeam()}
            >
              Field the XI
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}

const SquadCard: React.FC<{
  id: string;
  name: string;
  description: string;
  formation: string;
  isPublic: boolean;
  value: number;
  returnPct: number;
  dayPct: number;
  loadingPerf: boolean;
}> = ({ id, name, description, formation, isPublic, value, returnPct, dayPct, loadingPerf }) => {
  const positive = returnPct >= 0;
  return (
    <Link
      href={`/portfolio/${id}`}
      className="stadium-card"
      style={{
        padding: 14,
        textDecoration: 'none',
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'border-color .15s ease, transform .15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--pitch)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--line)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div className="flex items-start justify-between" style={{ gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div
            className="display"
            style={{
              fontSize: 17,
              letterSpacing: '-0.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </div>
          {description && (
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--text-mute)',
                marginTop: 4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {description}
            </div>
          )}
        </div>
        <span className="pill pill-pitch">{formation}</span>
      </div>

      {/* Mini chalk pitch */}
      <div
        style={{
          aspectRatio: '5 / 7',
          maxHeight: 160,
          background: 'var(--surface-2)',
          backgroundImage:
            'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
          borderRadius: 6,
          border: '1px solid var(--line)',
          position: 'relative',
        }}
      >
        <div className="kicker" style={{ position: 'absolute', top: 6, left: 8, fontSize: 9 }}>
          PITCH
        </div>
        <div
          className="mono"
          style={{
            position: 'absolute',
            top: 6,
            right: 8,
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--pitch)',
            letterSpacing: '0.16em',
          }}
        >
          {formation}
        </div>
      </div>

      <div className="flex items-baseline" style={{ gap: 12 }}>
        {loadingPerf ? (
          <div
            style={{
              width: 80,
              height: 24,
              background: 'var(--surface-2)',
              borderRadius: 2,
            }}
          />
        ) : (
          <div
            className="display num"
            style={{
              fontSize: 22,
              color: positive ? 'var(--pitch)' : 'var(--ref-red)',
              letterSpacing: '-0.04em',
            }}
          >
            {formatPercent(returnPct)}
          </div>
        )}
        <div className="mono num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          {formatCurrency(value)}
        </div>
      </div>

      <div
        className="flex"
        style={{
          gap: 16,
          paddingTop: 12,
          borderTop: '1px solid var(--line)',
        }}
      >
        <div>
          <div className="kicker">TODAY</div>
          <div
            className="mono num"
            style={{
              fontSize: 12,
              color: dayPct >= 0 ? 'var(--pitch)' : 'var(--ref-red)',
              fontWeight: 600,
            }}
          >
            {formatPercent(dayPct)}
          </div>
        </div>
        <div>
          <div className="kicker">STATUS</div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: isPublic ? 'var(--pitch)' : 'var(--text-dim)',
              letterSpacing: '0.12em',
            }}
          >
            {isPublic ? 'PUBLIC' : 'PRIVATE'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-mute)' }}>
          <span className="mono" style={{ fontSize: 10, letterSpacing: '0.14em' }}>
            OPEN
          </span>
          <Icon.Arrow size={14} />
        </div>
      </div>
    </Link>
  );
};
