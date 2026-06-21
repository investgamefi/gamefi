'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from 'recharts';
import { useStore } from '@/store/useStore';
import { AppLayout, FormationField, AssetSelector, Modal, DateRangePicker } from '@/components';
import {
  Position,
  PortfolioPlayer,
  Portfolio,
  AllocationStrategy,
  SeasonState,
  FORMATIONS,
  WEEKEND_SUB_MAX_PER_WEEKEND,
  WEEKEND_SUB_COST_XP,
  QUARTERLY_TRANSFER_COST_XP,
  QUARTERLY_TRANSFER_MAX_PER_QUARTER,
} from '@/types';
import {
  formatCurrency,
  formatPercent,
  formatDate,
  calculatePortfolioPerformance,
  calculatePortfolioPerformanceForDateRange,
  exportPortfolioToCSV,
  getShareUrl,
  copyToClipboard,
  formatPE,
  formatEPS,
  formatPercentMetric,
  formatRatio,
} from '@/lib/utils';
import { usePortfolioFundamentals } from '@/hooks/usePortfolioFundamentals';
import { Icon } from '@/components/stadium/Icon';

const SECTOR_HUES: Record<string, number> = {
  Technology: 145,
  Finance: 230,
  Healthcare: 200,
  Health: 200,
  Retail: 90,
  Energy: 30,
  Auto: 60,
  Crypto: 295,
  Media: 320,
  'Consumer Staples': 50,
  'Consumer Discretionary': 50,
  Industrial: 280,
  'Real Estate': 20,
  Utilities: 210,
};

const sectorColor = (sector: string) => {
  const hue = SECTOR_HUES[sector] ?? Math.abs(sector.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;
  return `oklch(0.68 0.18 ${hue})`;
};

const EMPTY_PORTFOLIO: Portfolio = {
  id: '', userId: '', name: '', description: '', formation: '4-3-3',
  players: [], createdAt: '', updatedAt: '', isPublic: false,
  likes: [], cloneCount: 0, clonedFrom: null, tags: []
};

type Tab = 'lineup' | 'transfers' | 'performance' | 'tactics';

export default function PortfolioDetailPage() {
  const router = useRouter();
  const params = useParams();
  const portfolioId = params.id as string;

  const {
    currentUser,
    isAuthenticated,
    loadData,
    assignAssetToPosition,
    updatePlayerWeights,
    likePortfolio,
    clonePortfolio,
    deletePortfolio,
    seasonState,
    weekendSwap,
    quarterlyTransfer,
  } = useStore();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  /* selectedPosition.position can be null for bench slots (synthetic
     positionId, no formation position). AssetSelector handles null
     position by skipping its risk-tier suggestions. */
  const [selectedPosition, setSelectedPosition] = useState<{ player: PortfolioPlayer; position: Position | null } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showWeightsModal, setShowWeightsModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState<Date | null>(null);
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | null>(null);
  const [editingWeights, setEditingWeights] = useState<{ [positionId: string]: number }>({});
  const [activeTab, setActiveTab] = useState<Tab>('lineup');
  const [pitchVariant, setPitchVariant] = useState<'stadium' | 'tactics'>('stadium');
  // Owner info kept here so the title strip can show "@username"
  const [owner, setOwner] = useState<{ username: string; avatar: string } | null>(null);

  /* Squad sub-tab: Starting XI vs Bench. Local to the page so it
     doesn't interfere with the main Lineup/Performance/Holdings/Tactics
     tabs above. */
  const [squadView, setSquadView] = useState<'starting' | 'bench'>('starting');

  /* Sub modal: pick a bench player to swap in for the highlighted
     starter. Open when subStarter is set; closed when null. */
  const [subStarter, setSubStarter] = useState<PortfolioPlayer | null>(null);
  const [subError, setSubError] = useState<string | null>(null);
  const [subBusy, setSubBusy] = useState(false);

  /* Which allocation strategy the user picked for the next sub.
     Persists across re-opens of the sub modal within the same view. */
  const [subStrategy, setSubStrategy] = useState<'inherit' | 'split'>('inherit');

  /* Transfer (quarterly) flow: when set, AssetSelector opens in signingMode
     so the user picks a replacement for the outgoing player and chooses
     inherit/split. Separate from the regular position-click flow. */
  const [transferOut, setTransferOut] = useState<PortfolioPlayer | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        /* Pass viewerId so the API can apply the F7 privacy gate:
           non-owner viewers receive the last weekend's snapshot rather
           than the owner's in-progress squad. */
        const viewerQs = currentUser?.id ? `&viewerId=${currentUser.id}` : '';
        const res = await fetch(`/api/portfolios?id=${portfolioId}${viewerQs}`);
        const data = await res.json();
        if (data.success && data.portfolios?.length > 0) {
          setPortfolio(data.portfolios[0]);
        }
      } catch (error) {
        console.error('Failed to fetch portfolio:', error);
      }
    };
    fetchPortfolio();
  }, [portfolioId, currentUser?.id]);

  useEffect(() => {
    const fetchOwner = async () => {
      if (!portfolio) return;
      try {
        const res = await fetch(`/api/users?id=${portfolio.userId}`);
        const data = await res.json();
        if (data.success) setOwner({ username: data.user.username, avatar: data.user.avatar || '/default-avatar.png' });
      } catch (error) {
        console.error('Failed to fetch owner:', error);
      }
    };
    fetchOwner();
  }, [portfolio]);

  const isOwner = currentUser?.id === portfolio?.userId;
  const hasLiked = currentUser && portfolio ? portfolio.likes.includes(currentUser.id) : false;

  const performance = useMemo(() => {
    if (!portfolio) return null;
    if (dateRangeStart && dateRangeEnd) {
      return calculatePortfolioPerformanceForDateRange(portfolio, dateRangeStart, dateRangeEnd);
    }
    return calculatePortfolioPerformance(portfolio);
  }, [portfolio, dateRangeStart, dateRangeEnd]);

  const { aggregateMetrics, alpha, isLoading: fundamentalsLoading } = usePortfolioFundamentals(
    portfolio || EMPTY_PORTFOLIO,
    performance?.totalReturnPercent || 0,
    performance?.beta || 1,
    { enabled: !!portfolio && portfolio.players.some(p => p.asset) },
  );

  const portfolioMinDate = useMemo(() => {
    if (!portfolio) return new Date();
    return new Date(portfolio.createdAt);
  }, [portfolio]);

  const handleDateRangeChange = (start: Date | null, end: Date | null) => {
    setDateRangeStart(start);
    setDateRangeEnd(end);
  };

  // Sector allocation by weight (the design's signature horizontal bar)
  const sectorBreakdown = useMemo(() => {
    if (!portfolio) return [] as { sector: string; weight: number }[];
    const totals: Record<string, number> = {};
    let totalAlloc = 0;
    portfolio.players.forEach((p) => {
      if (p.asset) {
        const w = p.allocation || (100 / 11);
        totals[p.asset.sector] = (totals[p.asset.sector] || 0) + w;
        totalAlloc += w;
      }
    });
    return Object.entries(totals)
      .map(([sector, weight]) => ({ sector, weight: Math.round(weight * 10) / 10 }))
      .sort((a, b) => b.weight - a.weight);
  }, [portfolio]);
  const totalSectorWeight = sectorBreakdown.reduce((s, x) => s + x.weight, 0);

  const handlePositionClick = (player: PortfolioPlayer, position: Position) => {
    if (!isOwner) return;
    setSelectedPosition({ player, position });
  };

  const handleAssetSelect = async (asset: any) => {
    if (!selectedPosition || !portfolio) return;
    /* One-ticker-per-squad rule: reject if this symbol is already on
       any other slot in the squad. */
    if (asset?.symbol) {
      const dup = portfolio.players.some(
        (p) =>
          p.positionId !== selectedPosition.player.positionId &&
          p.asset?.symbol?.toUpperCase() === asset.symbol.toUpperCase(),
      );
      if (dup) {
        alert(
          `${asset.symbol} is already in this squad. Each ticker can only be signed once — release the existing slot first.`,
        );
        setSelectedPosition(null);
        return;
      }
    }
    /* Build the new players array directly and PUT it. We can't rely
       on assignAssetToPosition here because the detail page keeps
       `portfolio` in local React state and never pushes it into the
       Zustand store — assignAssetToPosition would silently no-op when
       its store lookup misses. */
    const targetPositionId = selectedPosition.player.positionId;
    const hasEntry = portfolio.players.some((p) => p.positionId === targetPositionId);
    const isBenchSlot = targetPositionId.startsWith('bench-');
    const nextPlayers = hasEntry
      ? portfolio.players.map((p) =>
          p.positionId === targetPositionId ? { ...p, asset } : p,
        )
      : [
          ...portfolio.players,
          {
            positionId: targetPositionId,
            asset,
            allocation: isBenchSlot ? 0 : 100 / 11,
            ...(isBenchSlot ? { isBench: true as const } : {}),
          },
        ];
    try {
      const putRes = await fetch('/api/portfolios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: portfolio.id, players: nextPlayers }),
      });
      const putData = await putRes.json();
      if (!putData.success) {
        alert(putData.error || 'Failed to assign player.');
        setSelectedPosition(null);
        return;
      }
    } catch (e) {
      console.error('Position-assign PUT failed:', e);
      alert('Network error — try again.');
      setSelectedPosition(null);
      return;
    }
    const res = await fetch(`/api/portfolios?id=${portfolio.id}`);
    const data = await res.json();
    if (data.success && data.portfolios?.length > 0) {
      setPortfolio(data.portfolios[0]);
    }
    setSelectedPosition(null);
  };

  const handleLike = async () => {
    if (!portfolio) return;
    likePortfolio(portfolio.id);
    const hasLikedNow = portfolio.likes.includes(currentUser?.id || '');
    setPortfolio({
      ...portfolio,
      likes: hasLikedNow
        ? portfolio.likes.filter((id) => id !== currentUser?.id)
        : [...portfolio.likes, currentUser?.id || ''],
    });
  };

  const handleClone = async () => {
    if (!portfolio) return;
    const cloned = await clonePortfolio(portfolio.id);
    if (cloned) router.push(`/portfolio/${cloned.id}`);
  };

  const handleDelete = async () => {
    if (!portfolio) return;
    await deletePortfolio(portfolio.id);
    router.push('/dashboard');
  };

  const handleExport = () => {
    if (!portfolio || !performance) return;
    exportPortfolioToCSV(portfolio, performance);
  };

  const handleCopyLink = async () => {
    const url = window.location.href;
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!portfolio) {
    return (
      <AppLayout flush>
        <div style={{ padding: 60, textAlign: 'center' }}>
          <Icon.Pitch size={48} style={{ color: 'var(--text-mute)', margin: '0 auto 12px' }} />
          <div className="display" style={{ fontSize: 22, marginBottom: 6 }}>Squad not found</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 20 }}>
            This squad doesn&apos;t exist or has been disbanded.
          </div>
          <Link href="/dashboard" className="stadium-btn stadium-btn-primary" style={{ textDecoration: 'none' }}>
            <Icon.Arrow size={14} style={{ transform: 'rotate(180deg)' }} /> Back to Matchday
          </Link>
        </div>
      </AppLayout>
    );
  }

  /* Starter slots are what the pitch + footer hint reference. Bench
     slots are counted separately for the bench grid header. */
  const starterPlayers = portfolio.players.filter((p) => !p.isBench);
  const filledPositions = starterPlayers.filter((p) => p.asset !== null).length;

  // Top scorers — sorted by day change for now (the design uses YTD, we don't have it cheaply)
  const topScorers = portfolio.players
    .filter((p) => p.asset)
    .map((p) => ({
      player: p,
      score: p.asset!.dayChangePercent,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return (
    <AppLayout flush>
      <div style={{ padding: '20px 24px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* ===== Header strip ===== */}
        <div
          className="stadium-card"
          style={{
            padding: '16px 20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 18,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div className="flex items-center" style={{ gap: 14, minWidth: 0 }}>
            <button
              type="button"
              onClick={() => router.back()}
              className="stadium-btn stadium-btn-ghost"
              style={{ padding: '6px 10px', flexShrink: 0 }}
              aria-label="Back"
            >
              <Icon.Arrow size={14} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <div style={{ minWidth: 0 }}>
              <div className="kicker">
                SQUAD · FOUNDED {formatDate(portfolio.createdAt).toUpperCase()}
              </div>
              <div className="flex items-center" style={{ gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                <h1
                  className="display"
                  style={{
                    fontSize: 'clamp(22px, 2.8vw, 30px)',
                    letterSpacing: '-0.04em',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 380,
                  }}
                >
                  {portfolio.name}
                </h1>
                <span className="pill pill-pitch">{portfolio.formation}</span>
                {portfolio.isPublic ? (
                  <span className="pill pill-pitch">PUBLIC</span>
                ) : (
                  <span className="pill">PRIVATE</span>
                )}
              </div>
              {(portfolio.description || owner) && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {owner && (
                    <span className="flex items-center" style={{ gap: 6 }}>
                      <img
                        src={owner.avatar}
                        alt=""
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 2,
                          border: '1px solid var(--line)',
                          objectFit: 'cover',
                        }}
                      />
                      @{owner.username}
                    </span>
                  )}
                  {portfolio.description && <span>· {portfolio.description}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Quick stats */}
          {performance && (
            <div className="flex items-center" style={{ gap: 14, flexWrap: 'wrap' }}>
              <QuickStat label="EQUITY" value={formatCurrency(performance.totalValue)} />
              <Divider />
              <QuickStat
                label="TOTAL"
                value={formatPercent(performance.totalReturnPercent)}
                color={performance.totalReturnPercent >= 0 ? 'var(--pitch)' : 'var(--ref-red)'}
                big
              />
              <Divider />
              <QuickStat
                label="TODAY"
                value={formatPercent(performance.dayReturnPercent)}
                color={performance.dayReturnPercent >= 0 ? 'var(--pitch)' : 'var(--ref-red)'}
              />
              <Divider />
              <QuickStat
                label="FILLED"
                value={`${filledPositions}/11`}
                color="var(--text)"
              />

              <div className="flex" style={{ gap: 6, marginLeft: 4 }}>
                <button
                  type="button"
                  onClick={handleLike}
                  className="stadium-btn stadium-btn-ghost"
                  style={{
                    padding: '6px 10px',
                    fontSize: 11,
                    color: hasLiked ? 'var(--ref-red)' : undefined,
                    background: hasLiked ? 'oklch(0.65 0.22 25 / 0.08)' : undefined,
                  }}
                  title={hasLiked ? 'Unlike' : 'Like'}
                >
                  {hasLiked ? '♥' : '♡'} {portfolio.likes.length}
                </button>
                {!isOwner && (
                  <button
                    type="button"
                    onClick={handleClone}
                    className="stadium-btn stadium-btn-ghost"
                    style={{ padding: '6px 10px', fontSize: 11 }}
                  >
                    <Icon.Lineup size={12} /> Clone
                  </button>
                )}
                {isOwner && filledPositions > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const weights: { [positionId: string]: number } = {};
                      portfolio.players.forEach((p) => {
                        weights[p.positionId] = p.allocation || 100 / 11;
                      });
                      setEditingWeights(weights);
                      setShowWeightsModal(true);
                    }}
                    className="stadium-btn stadium-btn-ghost"
                    style={{ padding: '6px 10px', fontSize: 11 }}
                  >
                    <Icon.Filter size={12} /> Weights
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="stadium-btn stadium-btn-ghost"
                  style={{ padding: '6px 10px', fontSize: 11 }}
                >
                  <Icon.Transfer size={12} /> Share
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="stadium-btn stadium-btn-ghost"
                  style={{ padding: '6px 10px', fontSize: 11 }}
                >
                  <Icon.ArrowDown size={12} /> CSV
                </button>
                {isOwner && portfolio.players.some((p) => !p.asset) && (
                  <Link
                    href={`/portfolio/${portfolio.id}/sign`}
                    className="stadium-btn stadium-btn-primary"
                    style={{
                      padding: '6px 12px',
                      fontSize: 11,
                      textDecoration: 'none',
                    }}
                    title="Open the bulk-sign view to fill empty positions"
                  >
                    <Icon.Plus size={12} /> Sign empty
                  </Link>
                )}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="stadium-btn stadium-btn-ghost"
                    style={{
                      padding: '6px 10px',
                      fontSize: 11,
                      color: 'var(--ref-red)',
                      borderColor: 'oklch(0.65 0.22 25 / 0.3)',
                    }}
                  >
                    <Icon.Close size={12} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ===== Snapshot privacy banner ===== */}
        {portfolio.isSnapshot && (
          <div
            className="stadium-card"
            style={{
              padding: '10px 14px',
              background: 'oklch(0.83 0.18 90 / 0.12)',
              borderColor: 'oklch(0.83 0.18 90 / 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span
              className="pill"
              style={{
                background: 'oklch(0.83 0.18 90 / 0.2)',
                color: 'oklch(0.55 0.18 80)',
                border: '1px solid oklch(0.83 0.18 90 / 0.5)',
                fontSize: 9,
                flexShrink: 0,
              }}
            >
              SNAPSHOT
            </span>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', flex: 1 }}>
              VIEWING LAST WEEKEND&apos;S LINEUP · GW {portfolio.snapshotGameweek ?? '?'} — owner&apos;s
              in-progress moves are hidden until next Friday 4pm ET.
            </div>
          </div>
        )}
        {portfolio.noSnapshotAvailable && (
          <div
            className="stadium-card"
            style={{
              padding: '10px 14px',
              background: 'var(--surface-2)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Icon.Whistle size={14} style={{ color: 'var(--text-mute)', flexShrink: 0 }} />
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              This manager&apos;s first snapshot is pending — full lineup visible after next
              Friday 4pm ET close.
            </div>
          </div>
        )}

        {/* ===== Tabs ===== */}
        <div
          className="flex"
          style={{ gap: 0, borderBottom: '1px solid var(--line)' }}
        >
          {(
            [
              ['lineup', 'Lineup'],
              ['performance', 'Performance'],
              ['transfers', 'Holdings'],
              ['tactics', 'Tactics'],
            ] as const
          ).map(([key, label]) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                style={{
                  padding: '10px 18px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--pitch)' : '2px solid transparent',
                  color: isActive ? 'var(--text)' : 'var(--text-mute)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.14em',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ===== LINEUP TAB (default) ===== */}
        {activeTab === 'lineup' && (
          <>
            <div
              className="squad-detail-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 380px)',
                gap: 16,
              }}
            >
              {/* Pitch card */}
              <div className="stadium-card" style={{ padding: 18 }}>
                <div className="flex flex-wrap items-center justify-between" style={{ marginBottom: 12, gap: 8 }}>
                  <div className="kicker">STARTING XI · {portfolio.formation}</div>
                  <div className="flex" style={{ gap: 6 }}>
                    {(['stadium', 'tactics'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setPitchVariant(v)}
                        className="mono"
                        style={{
                          padding: '5px 10px',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          background: pitchVariant === v ? 'var(--text)' : 'transparent',
                          color: pitchVariant === v ? 'var(--bg)' : 'var(--text-dim)',
                          border: '1px solid ' + (pitchVariant === v ? 'var(--text)' : 'var(--line)'),
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ maxWidth: 520, margin: '0 auto' }}>
                  <FormationField
                    portfolio={portfolio}
                    onPositionClick={handlePositionClick}
                    isEditable={isOwner}
                    variant={pitchVariant}
                    /* Always show the bench grid for owners so they can
                       see and fill empty reserve slots from the pitch
                       view, not only via /sign. */
                    showBench={isOwner}
                    onBenchClick={(player) => {
                      /* Bench click — switch sub view so the table view
                         below scrolls to the bench list and the user can
                         tap Sub On there. Avoids two competing modals. */
                      setSquadView('bench');
                    }}
                    onBenchEmpty={(benchPositionId) => {
                      /* Clicking an empty bench tile opens AssetSelector
                         for that synthetic positionId — same flow as
                         clicking an empty starter position, just with
                         a null position (no risk-tier suggestions). */
                      setSelectedPosition({
                        player: {
                          positionId: benchPositionId,
                          asset: null,
                          allocation: 0,
                          isBench: true,
                        },
                        position: null,
                      });
                    }}
                  />
                </div>

                {/* Legend */}
                <div
                  className="flex justify-center"
                  style={{ gap: 18, marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', flexWrap: 'wrap' }}
                >
                  <LegendDot color="var(--pitch)" label="POSITIVE TODAY" />
                  <LegendDot color="var(--ref-red)" label="NEGATIVE TODAY" />
                  <LegendDot color="oklch(0.75 0.14 230)" label="DEF" />
                  <LegendDot color="oklch(0.83 0.18 90)" label="MID" />
                  <LegendDot color="oklch(0.65 0.22 25)" label="ATK" />
                </div>

                {isOwner && (
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', textAlign: 'center', marginTop: 14, letterSpacing: '0.1em' }}>
                    {filledPositions === 0
                      ? 'CLICK A POSITION TO SIGN A PLAYER'
                      : `${11 - filledPositions} SLOT${11 - filledPositions === 1 ? '' : 'S'} OPEN · CLICK TO FILL`}
                  </div>
                )}
              </div>

              {/* Side panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Sector allocation */}
                {sectorBreakdown.length > 0 && (
                  <div className="stadium-card" style={{ padding: 16 }}>
                    <div className="flex items-baseline justify-between">
                      <div className="display" style={{ fontSize: 15, letterSpacing: '-0.02em' }}>
                        Sector Allocation
                      </div>
                      <div className="kicker">{Math.round(totalSectorWeight)}% TOTAL</div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        height: 10,
                        borderRadius: 3,
                        overflow: 'hidden',
                        marginTop: 12,
                        border: '1px solid var(--line)',
                      }}
                    >
                      {sectorBreakdown.map((s) => (
                        <div
                          key={s.sector}
                          title={`${s.sector} ${s.weight}%`}
                          style={{
                            width: `${(s.weight / Math.max(1, totalSectorWeight)) * 100}%`,
                            background: sectorColor(s.sector),
                          }}
                        />
                      ))}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        marginTop: 12,
                      }}
                    >
                      {sectorBreakdown.map((s) => (
                        <div
                          key={s.sector}
                          className="flex items-center"
                          style={{ gap: 8 }}
                        >
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 2,
                              background: sectorColor(s.sector),
                              flexShrink: 0,
                            }}
                          />
                          <div
                            className="display"
                            style={{
                              fontSize: 12,
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {s.sector}
                          </div>
                          <div className="mono num" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                            {s.weight.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Goal Scorers */}
                {topScorers.length > 0 && (
                  <div className="stadium-card" style={{ padding: 16 }}>
                    <div className="display" style={{ fontSize: 15, letterSpacing: '-0.02em', marginBottom: 10 }}>
                      Goal Scorers
                    </div>
                    {topScorers.map((scorer, i) => {
                      const p = scorer.player;
                      const positive = scorer.score >= 0;
                      return (
                        <div
                          key={p.positionId}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '28px 1fr auto',
                            gap: 10,
                            alignItems: 'center',
                            padding: '8px 0',
                            borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                          }}
                        >
                          <div className="display num" style={{ fontSize: 14, color: 'var(--text-dim)' }}>
                            {String(i + 1).padStart(2, '0')}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              className="display num"
                              style={{
                                fontSize: 13,
                                letterSpacing: '-0.02em',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {p.asset!.symbol}
                            </div>
                            <div className="mono" style={{ fontSize: 9, color: 'var(--text-mute)', textTransform: 'uppercase' }}>
                              {p.asset!.name}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div
                              className="mono num"
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: positive ? 'var(--pitch)' : 'var(--ref-red)',
                              }}
                            >
                              {formatPercent(scorer.score)}
                            </div>
                            <div className="mono" style={{ fontSize: 9, color: 'var(--text-mute)' }}>
                              WGT {(p.allocation || 100 / 11).toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Coach's Notes */}
                {sectorBreakdown.length > 0 && performance && (
                  <CoachsNotes
                    sectors={sectorBreakdown}
                    beta={performance.beta}
                    filled={filledPositions}
                  />
                )}
              </div>
            </div>

            {/* Squad Roster — Starting XI / Bench tabs with sub & transfer
                actions. Only shown for the owner (read-only viewers get
                the pitch + holdings table elsewhere). */}
            {isOwner && (
              <>
                {transferError && (
                  <div
                    className="stadium-card"
                    style={{
                      padding: '10px 12px',
                      background: 'oklch(0.65 0.22 25 / 0.08)',
                      borderColor: 'oklch(0.65 0.22 25 / 0.3)',
                    }}
                  >
                    <p className="mono" style={{ margin: 0, fontSize: 11, color: 'var(--ref-red)' }}>
                      {transferError}
                    </p>
                  </div>
                )}
                <SquadRoster
                  portfolio={portfolio}
                  squadView={squadView}
                  onChangeView={setSquadView}
                  seasonState={seasonState}
                  onSubOff={(starter) => {
                    setSubError(null);
                    setSubStarter(starter);
                  }}
                  onSubOn={() => {
                    /* When the user taps "Sub on" from the bench, redirect
                       them back to Starting XI: the sub flow always starts
                       by picking the outgoing starter. */
                    setSquadView('starting');
                  }}
                  onTransferOut={(player) => {
                    setTransferError(null);
                    setTransferOut(player);
                  }}
                />
              </>
            )}

            {/* Fundamental metrics row at the bottom of the Lineup tab */}
            {performance && (
              <div>
                <div
                  className="flex items-end justify-between"
                  style={{ marginBottom: 10 }}
                >
                  <div>
                    <div className="display" style={{ fontSize: 16, letterSpacing: '-0.02em' }}>
                      Fundamentals
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 2 }}>
                      Weighted averages across the active roster
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: 10,
                  }}
                >
                  <Fundamental
                    label="ALPHA"
                    value={alpha !== null ? `${alpha >= 0 ? '+' : ''}${alpha.toFixed(2)}%` : 'N/A'}
                    tone={alpha !== null && alpha >= 0 ? 'pos' : 'neg'}
                    sub="vs SPY"
                    loading={fundamentalsLoading}
                  />
                  <Fundamental
                    label="BETA"
                    value={performance.beta.toFixed(2)}
                    sub={performance.beta > 1.2 ? 'aggressive' : performance.beta < 0.8 ? 'defensive' : 'balanced'}
                  />
                  <Fundamental label="AVG P/E" value={formatPE(aggregateMetrics.weightedPE)} loading={fundamentalsLoading} />
                  <Fundamental label="AVG EPS" value={formatEPS(aggregateMetrics.weightedEPS)} loading={fundamentalsLoading} />
                  <Fundamental label="AVG PEG" value={formatRatio(aggregateMetrics.weightedPEG)} loading={fundamentalsLoading} />
                  <Fundamental
                    label="AVG ROE"
                    value={formatPercentMetric(aggregateMetrics.weightedROE)}
                    tone={aggregateMetrics.weightedROE != null && aggregateMetrics.weightedROE > 0 ? 'pos' : undefined}
                    loading={fundamentalsLoading}
                  />
                  <Fundamental
                    label="AVG MARGIN"
                    value={formatPercentMetric(aggregateMetrics.weightedProfitMargin)}
                    tone={aggregateMetrics.weightedProfitMargin != null && aggregateMetrics.weightedProfitMargin > 0 ? 'pos' : undefined}
                    loading={fundamentalsLoading}
                  />
                  <Fundamental
                    label="AVG D/E"
                    value={formatRatio(aggregateMetrics.weightedDebtToEquity)}
                    tone={aggregateMetrics.weightedDebtToEquity != null && aggregateMetrics.weightedDebtToEquity > 1.5 ? 'neg' : undefined}
                    loading={fundamentalsLoading}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== PERFORMANCE TAB ===== */}
        {activeTab === 'performance' && performance && (
          <>
            <div className="stadium-card" style={{ padding: 18 }}>
              <div className="flex flex-wrap items-center justify-between" style={{ gap: 12, marginBottom: 12 }}>
                <div>
                  <div className="kicker">EQUITY CURVE</div>
                  <div className="display" style={{ fontSize: 18, letterSpacing: '-0.02em', marginTop: 2 }}>
                    Performance History
                  </div>
                </div>
                <DateRangePicker
                  portfolioCreatedDate={portfolioMinDate}
                  startDate={dateRangeStart}
                  endDate={dateRangeEnd}
                  onChange={handleDateRangeChange}
                />
              </div>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performance.historicalData.slice(-60)}>
                    <defs>
                      <linearGradient id="pitch-gradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.72 0.21 145)" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="oklch(0.72 0.21 145)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'var(--text-mute)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text-mute)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                      tickFormatter={(v) => `$${v.toFixed(0)}`}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--ink)',
                        border: '1px solid var(--line-2)',
                        borderRadius: 8,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                      }}
                      labelStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, letterSpacing: '0.12em' }}
                      itemStyle={{ color: 'var(--pitch-glow)' }}
                      formatter={(value: number | undefined) => [formatCurrency(value ?? 0), 'Value']}
                      labelFormatter={(date: string) => formatDate(date)}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="oklch(0.72 0.21 145)"
                      strokeWidth={2.5}
                      fill="url(#pitch-gradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sector pie + breakdown */}
            {sectorBreakdown.length > 0 && (
              <div className="stadium-card" style={{ padding: 18 }}>
                <div className="display" style={{ fontSize: 16, letterSpacing: '-0.02em', marginBottom: 12 }}>
                  Sector Breakdown
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: 24,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ width: 180, height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sectorBreakdown}
                          dataKey="weight"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          stroke="var(--bg)"
                          strokeWidth={2}
                        >
                          {sectorBreakdown.map((s) => (
                            <Cell key={s.sector} fill={sectorColor(s.sector)} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--ink)',
                            border: '1px solid var(--line-2)',
                            borderRadius: 8,
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                          }}
                          formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)}%`, '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {sectorBreakdown.map((s) => (
                      <div key={s.sector} className="flex items-center" style={{ gap: 10 }}>
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            background: sectorColor(s.sector),
                          }}
                        />
                        <div className="display" style={{ fontSize: 13, flex: 1 }}>
                          {s.sector}
                        </div>
                        <div className="mono num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                          {s.weight.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== HOLDINGS TAB ===== */}
        {activeTab === 'transfers' && (
          <div className="stadium-card" style={{ overflow: 'hidden' }}>
            <div className="stadium-table-scroll">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '50px 60px minmax(0, 1.6fr) 110px 90px 100px 100px',
                padding: '10px 16px',
                background: 'var(--surface-2)',
                borderBottom: '1px solid var(--line)',
                gap: 12,
                minWidth: 720,
              }}
            >
              {['#', 'POS', 'TICKER · NAME', 'SECTOR', 'WEIGHT', 'PRICE', 'TODAY'].map((h, i) => (
                <div
                  key={h}
                  className="kicker"
                  style={{ fontSize: 9, textAlign: i >= 4 ? 'right' : 'left' }}
                >
                  {h}
                </div>
              ))}
            </div>
            {portfolio.players.filter((p) => p.asset).length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <Icon.Lineup size={36} style={{ color: 'var(--text-mute)', margin: '0 auto 10px' }} />
                <div className="display" style={{ fontSize: 16 }}>
                  No players signed yet
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>
                  Switch to the Lineup tab and click a slot to sign your first player.
                </div>
              </div>
            ) : (
              portfolio.players
                .filter((p) => p.asset)
                .map((player, i) => {
                  const pos = (player as any);
                  const asset = player.asset!;
                  const positive = asset.dayChangePercent >= 0;
                  return (
                    <div
                      key={player.positionId}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '50px 60px minmax(0, 1.6fr) 110px 90px 100px 100px',
                        padding: '12px 16px',
                        alignItems: 'center',
                        gap: 12,
                        borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                        minWidth: 720,
                      }}
                    >
                      <div className="display num" style={{ fontSize: 14, color: 'var(--text-dim)' }}>
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div>
                        <span className="pill" style={{ padding: '2px 6px' }}>{player.positionId.toUpperCase()}</span>
                      </div>
                      <div className="flex items-baseline" style={{ gap: 8, minWidth: 0 }}>
                        <span className="display num" style={{ fontSize: 13 }}>{asset.symbol}</span>
                        <span
                          className="mono"
                          style={{
                            fontSize: 11,
                            color: 'var(--text-mute)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {asset.name}
                        </span>
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        {asset.sector.toUpperCase()}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="mono num" style={{ fontSize: 12, fontWeight: 700 }}>
                          {(player.allocation || 100 / 11).toFixed(1)}%
                        </div>
                        <div
                          style={{
                            width: 70,
                            height: 3,
                            background: 'var(--surface-2)',
                            marginTop: 4,
                            marginLeft: 'auto',
                            borderRadius: 2,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, (player.allocation || 100 / 11) * 6)}%`,
                              height: '100%',
                              background: 'var(--pitch)',
                            }}
                          />
                        </div>
                      </div>
                      <div className="mono num" style={{ fontSize: 12, textAlign: 'right' }}>
                        {formatCurrency(asset.currentPrice)}
                      </div>
                      <div
                        className="mono num"
                        style={{
                          fontSize: 12,
                          textAlign: 'right',
                          fontWeight: 700,
                          color: positive ? 'var(--pitch)' : 'var(--ref-red)',
                        }}
                      >
                        {formatPercent(asset.dayChangePercent)}
                      </div>
                    </div>
                  );
                })
            )}
            </div>
          </div>
        )}

        {/* ===== TACTICS TAB ===== */}
        {activeTab === 'tactics' && (
          <div
            className="squad-detail-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 380px)',
              gap: 16,
            }}
          >
            <div className="stadium-card" style={{ padding: 18 }}>
              <div className="kicker" style={{ marginBottom: 10 }}>TACTICS BOARD · {portfolio.formation}</div>
              <div style={{ maxWidth: 520, margin: '0 auto' }}>
                <FormationField
                  portfolio={portfolio}
                  onPositionClick={handlePositionClick}
                  isEditable={isOwner}
                  variant="tactics"
                />
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', textAlign: 'center', marginTop: 14, letterSpacing: '0.1em' }}>
                BLUEPRINT VIEW · LIVE PRICES OFF
              </div>
            </div>

            {sectorBreakdown.length > 0 && performance && (
              <CoachsNotes
                sectors={sectorBreakdown}
                beta={performance.beta}
                filled={filledPositions}
              />
            )}
          </div>
        )}
      </div>

      {/* ===== Modals ===== */}
      <AssetSelector
        isOpen={!!selectedPosition}
        onClose={() => setSelectedPosition(null)}
        onSelect={handleAssetSelect}
        position={selectedPosition?.position || null}
        currentAsset={selectedPosition?.player.asset || null}
      />

      {/* Quarterly transfer: AssetSelector in signingMode for an outgoing
          player. Closes itself; success/error are reported via toast-like
          inline error on the SquadRoster card. */}
      <AssetSelector
        isOpen={!!transferOut}
        onClose={() => setTransferOut(null)}
        signingMode
        outgoingAllocation={transferOut?.allocation}
        position={
          /* Re-derive the Position object so the modal's risk pill /
             title block can render. */
          transferOut
            ? FORMATIONS_FOR_PORTFOLIO(portfolio).find(
                (pos) => pos.id === transferOut.positionId,
              ) ?? null
            : null
        }
        currentAsset={transferOut?.asset ?? null}
        onSelect={async (asset) => {
          if (!asset || !transferOut || !transferOut.asset) {
            setTransferOut(null);
            return;
          }
          /* Transfer always inherits: the new player takes the slot
             and weight of the outgoing player. Weight rebalancing
             lives on Sub off, not here. */
          const result = await quarterlyTransfer(
            portfolio.id,
            transferOut.asset.symbol,
            asset.symbol,
            'inherit' as AllocationStrategy,
            asset,
          );
          if (!result.success) {
            setTransferError(result.error || 'Transfer failed');
          } else {
            setTransferError(null);
            /* Refresh portfolio after server mutation. */
            const viewerQs = currentUser?.id ? `&viewerId=${currentUser.id}` : '';
            const res = await fetch(`/api/portfolios?id=${portfolioId}${viewerQs}`);
            const data = await res.json();
            if (data.success && data.portfolios?.length > 0) {
              setPortfolio(data.portfolios[0]);
            }
          }
          setTransferOut(null);
        }}
      />

      {/* Weekend sub modal */}
      <Modal
        isOpen={!!subStarter}
        onClose={() => setSubStarter(null)}
        title={
          subStarter?.asset
            ? `Sub off ${subStarter.asset.symbol}`
            : 'Sub off'
        }
        subtitle="WEEKEND WINDOW · PICK BENCH PLAYER"
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {subError && (
            <div
              className="stadium-card"
              style={{
                padding: '10px 12px',
                background: 'oklch(0.65 0.22 25 / 0.08)',
                borderColor: 'oklch(0.65 0.22 25 / 0.3)',
              }}
            >
              <p className="mono" style={{ margin: 0, fontSize: 11, color: 'var(--ref-red)' }}>
                {subError}
              </p>
            </div>
          )}
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            Pick a reserve to come on. The starting XI always totals 100% —
            choose how the outgoing player&apos;s {subStarter?.allocation?.toFixed(1) ?? '?'}% redistributes. Costs {WEEKEND_SUB_COST_XP} XP.
          </div>

          {/* Allocation-strategy radio — applies to this sub. */}
          <div
            className="stadium-card"
            style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <div className="kicker">ALLOCATION</div>
            <label
              className="flex items-start"
              style={{ gap: 8, cursor: 'pointer' }}
            >
              <input
                type="radio"
                name="sub-strategy"
                checked={subStrategy === 'inherit'}
                onChange={() => setSubStrategy('inherit')}
                style={{ marginTop: 3 }}
              />
              <span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600 }}>
                  Inherit
                </span>
                <span className="mono" style={{ display: 'block', fontSize: 10, color: 'var(--text-mute)', marginTop: 2 }}>
                  Bench player takes the {subStarter?.allocation?.toFixed(1) ?? '?'}% directly. Same names rotate, weights unchanged.
                </span>
              </span>
            </label>
            <label
              className="flex items-start"
              style={{ gap: 8, cursor: 'pointer' }}
            >
              <input
                type="radio"
                name="sub-strategy"
                checked={subStrategy === 'split'}
                onChange={() => setSubStrategy('split')}
                style={{ marginTop: 3 }}
              />
              <span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600 }}>
                  Split
                </span>
                <span className="mono" style={{ display: 'block', fontSize: 10, color: 'var(--text-mute)', marginTop: 2 }}>
                  Redistribute the {subStarter?.allocation?.toFixed(1) ?? '?'}% across the other 10 starters pro-rata. Incoming player starts at 0%.
                </span>
              </span>
            </label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {portfolio.players
              .filter((p) => p.isBench && p.asset)
              .map((b) => (
                <button
                  key={b.positionId}
                  type="button"
                  disabled={subBusy}
                  onClick={async () => {
                    if (!subStarter?.asset || !b.asset) return;
                    setSubBusy(true);
                    setSubError(null);
                    const result = await weekendSwap(
                      portfolio.id,
                      subStarter.asset.symbol,
                      b.asset.symbol,
                      subStrategy,
                    );
                    setSubBusy(false);
                    if (!result.success) {
                      setSubError(result.error || 'Swap failed');
                    } else {
                      const viewerQs = currentUser?.id ? `&viewerId=${currentUser.id}` : '';
                      const res = await fetch(`/api/portfolios?id=${portfolioId}${viewerQs}`);
                      const data = await res.json();
                      if (data.success && data.portfolios?.length > 0) {
                        setPortfolio(data.portfolios[0]);
                      }
                      setSubStarter(null);
                    }
                  }}
                  className="stadium-card"
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: subBusy ? 'wait' : 'pointer',
                    background: 'var(--surface)',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <span className="display num" style={{ fontSize: 14, color: 'var(--pitch)' }}>
                    {b.asset!.symbol}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: 'var(--text-mute)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {b.asset!.name}
                  </span>
                  <span
                    className="mono num"
                    style={{
                      fontSize: 10,
                      color: b.asset!.dayChangePercent >= 0 ? 'var(--pitch)' : 'var(--ref-red)',
                      fontWeight: 700,
                    }}
                  >
                    {formatPercent(b.asset!.dayChangePercent)}
                  </span>
                </button>
              ))}
            {portfolio.players.filter((p) => p.isBench && p.asset).length === 0 && (
              <div
                className="stadium-card"
                style={{ padding: 16, textAlign: 'center', borderStyle: 'dashed' }}
              >
                <div className="kicker">BENCH IS EMPTY</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>
                  Sign reserves during the transfer window first.
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Share */}
      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share Squad" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="flex" style={{ gap: 8 }}>
            <a
              href={getShareUrl(portfolio.id, 'twitter')}
              target="_blank"
              rel="noopener noreferrer"
              className="stadium-btn stadium-btn-ghost"
              style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}
            >
              X · Twitter
            </a>
            <a
              href={getShareUrl(portfolio.id, 'facebook')}
              target="_blank"
              rel="noopener noreferrer"
              className="stadium-btn stadium-btn-ghost"
              style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}
            >
              Facebook
            </a>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={typeof window !== 'undefined' ? window.location.href : ''}
              readOnly
              style={{
                width: '100%',
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 6,
                padding: '10px 80px 10px 12px',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
              }}
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="stadium-btn stadium-btn-primary"
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '5px 12px',
                fontSize: 11,
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Disband squad?" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0, lineHeight: 1.55 }}>
            Are you sure you want to disband <strong style={{ color: 'var(--text)' }}>{portfolio.name}</strong>?
            This action can&apos;t be undone — all players are released and the history is gone.
          </p>
          <div className="flex" style={{ gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="stadium-btn stadium-btn-ghost"
              style={{ flex: 1, justifyContent: 'center', padding: '10px 16px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="stadium-btn"
              style={{
                flex: 1,
                justifyContent: 'center',
                padding: '10px 16px',
                background: 'var(--ref-red)',
                color: '#fff',
                border: '1px solid var(--ref-red)',
              }}
            >
              Disband
            </button>
          </div>
        </div>
      </Modal>

      {/* Weights */}
      <Modal isOpen={showWeightsModal} onClose={() => setShowWeightsModal(false)} title="Adjust player weights" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: 0, lineHeight: 1.55 }}>
            Higher weights push players higher on the pitch view. Total must equal 100%.
          </p>

          {/* Total indicator */}
          {(() => {
            const total = Object.values(editingWeights).reduce((sum, w) => sum + w, 0);
            const balanced = Math.abs(total - 100) < 0.1;
            return (
              <div
                className="stadium-card"
                style={{
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: balanced ? 'var(--pitch-tint)' : 'oklch(0.65 0.22 25 / 0.08)',
                  borderColor: balanced ? 'oklch(0.72 0.21 145 / 0.3)' : 'oklch(0.65 0.22 25 / 0.3)',
                }}
              >
                <span className="kicker">TOTAL WEIGHT</span>
                <span
                  className="display num"
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: balanced ? 'var(--pitch)' : 'var(--ref-red)',
                  }}
                >
                  {total.toFixed(1)}%
                </span>
              </div>
            );
          })()}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
            {portfolio.players
              .filter((p) => p.asset)
              .map((player) => (
                <div
                  key={player.positionId}
                  className="stadium-card"
                  style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center" style={{ gap: 8 }}>
                      <span className="pill" style={{ padding: '1px 5px', fontSize: 9 }}>
                        {player.positionId.toUpperCase()}
                      </span>
                      <span className="display num" style={{ fontSize: 13 }}>
                        {player.asset!.symbol}
                      </span>
                    </div>
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
                      {player.asset!.name}
                    </div>
                  </div>
                  <div className="flex items-center" style={{ gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingWeights((prev) => ({
                          ...prev,
                          [player.positionId]: Math.round(Math.max(0, (prev[player.positionId] || 0) - 1) * 10) / 10,
                        }));
                      }}
                      className="stadium-btn stadium-btn-ghost"
                      style={{ padding: '4px 10px', fontSize: 14 }}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={Math.round((editingWeights[player.positionId] ?? 0) * 10) / 10}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditingWeights((prev) => ({
                          ...prev,
                          [player.positionId]:
                            v === '' ? 0 : Math.round(Math.max(0, Math.min(100, parseFloat(v) || 0)) * 10) / 10,
                        }));
                      }}
                      style={{
                        width: 64,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--line)',
                        borderRadius: 4,
                        padding: '4px 6px',
                        textAlign: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--text)',
                      }}
                    />
                    <span className="kicker">%</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingWeights((prev) => ({
                          ...prev,
                          [player.positionId]: Math.round(Math.min(100, (prev[player.positionId] || 0) + 1) * 10) / 10,
                        }));
                      }}
                      className="stadium-btn stadium-btn-ghost"
                      style={{ padding: '4px 10px', fontSize: 14 }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
          </div>

          <button
            type="button"
            onClick={() => {
              const filledPlayers = portfolio.players.filter((p) => p.asset);
              const equalWeight = Math.round((100 / filledPlayers.length) * 10) / 10;
              const next: { [positionId: string]: number } = {};
              filledPlayers.forEach((p, idx) => {
                if (idx === filledPlayers.length - 1) {
                  const sum = Object.values(next).reduce((s, w) => s + w, 0);
                  next[p.positionId] = Math.round((100 - sum) * 10) / 10;
                } else {
                  next[p.positionId] = equalWeight;
                }
              });
              portfolio.players.filter((p) => !p.asset).forEach((p) => (next[p.positionId] = 0));
              setEditingWeights(next);
            }}
            className="stadium-btn stadium-btn-ghost"
            style={{ width: '100%', justifyContent: 'center', padding: '10px 14px' }}
          >
            <Icon.Filter size={12} /> Auto-balance (equal weights)
          </button>

          <div className="flex" style={{ gap: 10, paddingTop: 6 }}>
            <button
              type="button"
              onClick={() => setShowWeightsModal(false)}
              className="stadium-btn stadium-btn-ghost"
              style={{ flex: 1, justifyContent: 'center', padding: '10px 16px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                const total = Object.values(editingWeights).reduce((sum, w) => sum + w, 0);
                if (Math.abs(total - 100) > 0.1) {
                  alert('Total weight must equal 100%');
                  return;
                }
                const weights = Object.entries(editingWeights).map(([positionId, allocation]) => ({
                  positionId,
                  allocation,
                }));
                await updatePlayerWeights(portfolio.id, weights);
                const res = await fetch(`/api/portfolios?id=${portfolioId}`);
                const data = await res.json();
                if (data.success && data.portfolios?.length > 0) {
                  setPortfolio(data.portfolios[0]);
                }
                setShowWeightsModal(false);
              }}
              className="stadium-btn stadium-btn-primary"
              style={{ flex: 1, justifyContent: 'center', padding: '10px 16px' }}
              disabled={Math.abs(Object.values(editingWeights).reduce((sum, w) => sum + w, 0) - 100) > 0.1}
            >
              Save weights
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}

/* ============================================================
   Small page-local primitives
   ============================================================ */

const Divider: React.FC = () => (
  <div style={{ width: 1, height: 28, background: 'var(--line)' }} />
);

const QuickStat: React.FC<{
  label: string;
  value: string;
  color?: string;
  big?: boolean;
}> = ({ label, value, color, big }) => (
  <div>
    <div className="kicker">{label}</div>
    <div
      className="display num"
      style={{
        fontSize: big ? 24 : 18,
        color: color || 'var(--text)',
        letterSpacing: '-0.03em',
        marginTop: 2,
      }}
    >
      {value}
    </div>
  </div>
);

const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center" style={{ gap: 6 }}>
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
    <span style={{ letterSpacing: '0.1em' }}>{label}</span>
  </div>
);

const Fundamental: React.FC<{
  label: string;
  value: string;
  sub?: string;
  tone?: 'pos' | 'neg';
  loading?: boolean;
}> = ({ label, value, sub, tone, loading }) => (
  <div className="stadium-card" style={{ padding: 12 }}>
    <div className="kicker">{label}</div>
    {loading ? (
      <div
        style={{
          width: 50,
          height: 20,
          background: 'var(--surface-2)',
          borderRadius: 2,
          marginTop: 4,
        }}
      />
    ) : (
      <div
        className="display num"
        style={{
          fontSize: 16,
          letterSpacing: '-0.03em',
          marginTop: 3,
          color: tone === 'pos' ? 'var(--pitch)' : tone === 'neg' ? 'var(--ref-red)' : 'var(--text)',
        }}
      >
        {value}
      </div>
    )}
    {sub && (
      <div className="mono" style={{ fontSize: 9, color: 'var(--text-mute)', marginTop: 2 }}>
        {sub}
      </div>
    )}
  </div>
);

/* Coach's Notes — runs a few simple checks on the squad and surfaces tactical advice
   the way the design's coach panel does. */
const CoachsNotes: React.FC<{
  sectors: { sector: string; weight: number }[];
  beta: number;
  filled: number;
}> = ({ sectors, beta, filled }) => {
  const advice: { tone: 'warn' | 'info' | 'good'; text: string }[] = [];

  // Concentration check
  const top = sectors[0];
  if (top && top.weight > 40) {
    advice.push({
      tone: 'warn',
      text: `Your squad is overweight ${top.sector} (${top.weight.toFixed(0)}%). A sector-wide dip will dent your lead — consider rotating one ATK slot into Healthcare or Consumer Staples.`,
    });
  }

  // Beta check
  if (beta > 1.4) {
    advice.push({
      tone: 'warn',
      text: `Beta is ${beta.toFixed(2)} — your squad swings ~${((beta - 1) * 100).toFixed(0)}% harder than the market. Great in rallies, brutal in sell-offs.`,
    });
  } else if (beta < 0.7) {
    advice.push({
      tone: 'info',
      text: `Beta is ${beta.toFixed(2)} — you&apos;re running defensive. Solid in chop, but you&apos;ll trail the index in strong up-moves.`,
    });
  } else {
    advice.push({
      tone: 'good',
      text: `Beta is ${beta.toFixed(2)} — well-balanced exposure. The midfield is doing its job.`,
    });
  }

  // Lineup completeness
  if (filled < 11) {
    advice.push({
      tone: 'info',
      text: `Roster is ${filled}/11 — empty slots dilute your effective allocation. Sign the remaining ${11 - filled} players before kick-off.`,
    });
  }

  return (
    <div
      className="stadium-card"
      style={{
        padding: 16,
        background: 'var(--pitch-tint)',
        borderColor: 'oklch(0.72 0.21 145 / 0.3)',
      }}
    >
      <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
        <Icon.Whistle size={16} style={{ color: 'var(--pitch)' }} />
        <div className="kicker" style={{ color: 'var(--pitch)' }}>
          COACH&apos;S NOTES
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {advice.map((a, i) => (
          <div key={i} className="flex items-start" style={{ gap: 8 }}>
            <span
              style={{
                color:
                  a.tone === 'warn' ? 'var(--whistle)' : a.tone === 'good' ? 'var(--pitch)' : 'var(--text-dim)',
                marginTop: 4,
                flexShrink: 0,
              }}
            >
              ▸
            </span>
            <div className="display" style={{ fontSize: 13, letterSpacing: '-0.01em', lineHeight: 1.45 }}>
              {a.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* Helper: get the canonical positions for a portfolio's formation. */
function FORMATIONS_FOR_PORTFOLIO(p: Portfolio): Position[] {
  return FORMATIONS[p.formation] || [];
}

/* ============================================================
   SquadRoster — Starting XI / Bench sub-tabs with sub & transfer
   actions. Renders only for the squad owner.
   ============================================================ */
const SquadRoster: React.FC<{
  portfolio: Portfolio;
  squadView: 'starting' | 'bench';
  onChangeView: (v: 'starting' | 'bench') => void;
  seasonState: SeasonState | null;
  onSubOff: (player: PortfolioPlayer) => void;
  onSubOn: (player: PortfolioPlayer) => void;
  onTransferOut: (player: PortfolioPlayer) => void;
}> = ({ portfolio, squadView, onChangeView, seasonState, onSubOff, onTransferOut }) => {
  const starters = portfolio.players.filter((p) => !p.isBench && p.asset);
  const bench = portfolio.players.filter((p) => p.isBench && p.asset);

  const weekendOpen = !!seasonState?.isWeekendWindowOpen;
  const transferOpen = !!seasonState?.isTransferWindowOpen;

  const subDisabledReason = !weekendOpen
    ? 'Subs open Fri 4pm ET through Mon 1am ET'
    : undefined;
  const transferDisabledReason = !transferOpen
    ? `Transfer window opens GW 1, 14, 27, 40 (current GW${seasonState?.currentGameweek ?? '?'})`
    : undefined;

  const benchCount = portfolio.players.filter((p) => p.isBench).length;

  return (
    <div className="stadium-card" style={{ padding: 16 }}>
      <div className="flex flex-wrap items-center justify-between" style={{ marginBottom: 12, gap: 10 }}>
        <div>
          <div className="kicker">SQUAD ROSTER</div>
          <div
            className="display"
            style={{ fontSize: 16, letterSpacing: '-0.02em', marginTop: 2 }}
          >
            Manage Lineup
          </div>
        </div>
        {/* Sub-tabs */}
        <div className="flex" style={{ gap: 4 }}>
          {(
            [
              ['starting', `Starting XI (${starters.length})`],
              ['bench', `Bench (${benchCount})`],
            ] as const
          ).map(([key, label]) => {
            const active = squadView === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChangeView(key)}
                className="mono"
                style={{
                  padding: '6px 12px',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  background: active ? 'var(--pitch)' : 'transparent',
                  color: active ? 'oklch(0.14 0.05 145)' : 'var(--text-dim)',
                  border: '1px solid ' + (active ? 'var(--pitch-deep)' : 'var(--line)'),
                  borderRadius: 4,
                  cursor: 'pointer',
                  minHeight: 32,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Window status strip */}
      <div
        className="flex items-center"
        style={{
          gap: 10,
          padding: '8px 12px',
          marginBottom: 12,
          background: 'var(--surface-2)',
          borderRadius: 6,
          border: '1px solid var(--line)',
          flexWrap: 'wrap',
        }}
      >
        <span
          className="pill"
          style={
            weekendOpen
              ? {
                  background: 'oklch(0.72 0.21 145 / 0.16)',
                  color: 'var(--pitch)',
                  border: '1px solid oklch(0.72 0.21 145 / 0.35)',
                  fontSize: 9,
                }
              : { fontSize: 9 }
          }
        >
          WEEKEND {weekendOpen ? 'OPEN' : 'LOCKED'}
        </span>
        <span
          className="pill"
          style={
            transferOpen
              ? {
                  background: 'oklch(0.72 0.21 145 / 0.16)',
                  color: 'var(--pitch)',
                  border: '1px solid oklch(0.72 0.21 145 / 0.35)',
                  fontSize: 9,
                }
              : { fontSize: 9 }
          }
        >
          TRANSFERS {transferOpen ? `OPEN · Q${seasonState?.currentQuarter}` : 'LOCKED'}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--text-mute)',
            marginLeft: 'auto',
            letterSpacing: '0.06em',
          }}
        >
          SUB {WEEKEND_SUB_COST_XP} XP · TRANSFER {QUARTERLY_TRANSFER_COST_XP} XP · CAP{' '}
          {WEEKEND_SUB_MAX_PER_WEEKEND}/wkd · {QUARTERLY_TRANSFER_MAX_PER_QUARTER}/qtr
        </span>
      </div>

      {/* Roster list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(squadView === 'starting' ? starters : bench).map((player) => (
          <RosterRow
            key={player.positionId}
            player={player}
            squadView={squadView}
            onSubOff={() => onSubOff(player)}
            onTransferOut={() => onTransferOut(player)}
            subDisabledReason={subDisabledReason}
            transferDisabledReason={transferDisabledReason}
          />
        ))}
        {(squadView === 'starting' ? starters : bench).length === 0 && (
          <div
            className="stadium-card"
            style={{ padding: 16, textAlign: 'center', borderStyle: 'dashed' }}
          >
            <div className="kicker">
              {squadView === 'starting' ? 'NO STARTERS YET' : 'NO BENCH PLAYERS YET'}
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>
              {squadView === 'starting'
                ? 'Sign players to the starting XI from the pitch above.'
                : 'Bench players are added during quarterly transfer windows.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const RosterRow: React.FC<{
  player: PortfolioPlayer;
  squadView: 'starting' | 'bench';
  onSubOff: () => void;
  onTransferOut: () => void;
  subDisabledReason?: string;
  transferDisabledReason?: string;
}> = ({ player, squadView, onSubOff, onTransferOut, subDisabledReason, transferDisabledReason }) => {
  if (!player.asset) return null;
  const positive = player.asset.dayChangePercent >= 0;
  const subDisabled = !!subDisabledReason;
  const transferDisabled = !!transferDisabledReason;

  return (
    <div
      className="stadium-card"
      style={{
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--surface)',
        flexWrap: 'wrap',
      }}
    >
      <span className="pill" style={{ padding: '2px 6px', fontSize: 9, flexShrink: 0 }}>
        {player.positionId.toUpperCase()}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <span className="display num" style={{ fontSize: 14, letterSpacing: '-0.02em' }}>
            {player.asset.symbol}
          </span>
          <span
            className="mono num"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: positive ? 'var(--pitch)' : 'var(--ref-red)',
            }}
          >
            {(player.asset.dayChangePercent >= 0 ? '+' : '') +
              player.asset.dayChangePercent.toFixed(2)}
            %
          </span>
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--text-mute)',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '0.04em',
          }}
        >
          {player.asset.name.toUpperCase()} · WGT {(player.allocation || 100 / 11).toFixed(1)}%
        </div>
      </div>
      <div className="flex" style={{ gap: 6, flexShrink: 0 }}>
        {squadView === 'starting' && (
          <button
            type="button"
            onClick={onSubOff}
            disabled={subDisabled}
            title={subDisabledReason || `Sub off ${player.asset.symbol} (25 XP)`}
            className="stadium-btn stadium-btn-ghost"
            style={{
              padding: '6px 10px',
              fontSize: 11,
              opacity: subDisabled ? 0.45 : 1,
              cursor: subDisabled ? 'not-allowed' : 'pointer',
              minHeight: 32,
            }}
          >
            Sub off →
          </button>
        )}
        {squadView === 'bench' && (
          <span
            className="mono"
            style={{
              padding: '6px 10px',
              fontSize: 10,
              color: 'var(--text-mute)',
              letterSpacing: '0.06em',
            }}
            title="To sub this player on, open Starting XI and tap 'Sub off' on the player you want to bench."
          >
            ↑ ON BENCH
          </span>
        )}
        {/* Transfer-out is bench-only. Starters must be subbed off first
            so their allocation can be reassigned before the symbol leaves
            the squad. */}
        {squadView === 'bench' ? (
          <button
            type="button"
            onClick={onTransferOut}
            disabled={transferDisabled}
            title={
              transferDisabledReason ||
              `Transfer out ${player.asset.symbol} (${QUARTERLY_TRANSFER_COST_XP} XP)`
            }
            className="stadium-btn stadium-btn-ghost"
            style={{
              padding: '6px 10px',
              fontSize: 11,
              opacity: transferDisabled ? 0.45 : 1,
              cursor: transferDisabled ? 'not-allowed' : 'pointer',
              minHeight: 32,
              color: transferDisabled ? undefined : 'var(--whistle)',
              borderColor: transferDisabled ? undefined : 'oklch(0.83 0.18 90 / 0.4)',
            }}
          >
            Transfer out
          </button>
        ) : (
          <span
            className="mono"
            style={{
              padding: '6px 8px',
              fontSize: 9,
              color: 'var(--text-mute)',
              letterSpacing: '0.06em',
              alignSelf: 'center',
            }}
            title="Starters can't be transferred out directly — sub them to the bench first, then transfer out from there."
          >
            sub off to transfer
          </span>
        )}
      </div>
    </div>
  );
};
