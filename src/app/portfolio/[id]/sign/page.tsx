'use client';

/* /portfolio/[id]/sign — Bulk-sign page shown after a new squad is
   created (and reachable from a "Sign empty positions" button on the
   squad detail). Lists all 22 slots (11 starters + 11 bench) so the
   user can fill them in one screen instead of clicking each position
   individually. Initial bench fill bypasses the transfer-window gate;
   later bench changes still go through weekend subs / quarterly
   transfers per the season rules. */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AppLayout, AssetSelector } from '@/components';
import { Icon } from '@/components/stadium/Icon';
import { useStore } from '@/store/useStore';
import {
  Portfolio,
  PortfolioPlayer,
  Position,
  FORMATIONS,
  Asset,
  SQUAD_BENCH_COUNT,
} from '@/types';

interface SlotEditState {
  positionId: string;
  position: Position | null;        // null for bench slots
  currentAsset: Asset | null;
}

export default function SignSquadPage() {
  const params = useParams();
  const router = useRouter();
  const portfolioId = params?.id as string;
  const { currentUser, assignAssetToPosition } = useStore();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [pending, setPending] = useState<Map<string, Asset | null>>(new Map());
  const [editingSlot, setEditingSlot] = useState<SlotEditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Load portfolio. Live fetch (not snapshot) because we're the owner. */
  useEffect(() => {
    if (!portfolioId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/portfolios?id=${portfolioId}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.portfolios?.length > 0) {
          setPortfolio(data.portfolios[0]);
        }
      } catch (e) {
        console.error('Load portfolio failed:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portfolioId]);

  if (!currentUser) {
    return (
      <AppLayout flush>
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <p className="display" style={{ fontSize: 16 }}>Sign in to manage your squad.</p>
        </div>
      </AppLayout>
    );
  }

  if (!portfolio) {
    return (
      <AppLayout flush>
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-mute)' }}>Loading squad…</p>
        </div>
      </AppLayout>
    );
  }

  if (portfolio.userId !== currentUser.id) {
    return (
      <AppLayout flush>
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <p className="display" style={{ fontSize: 16 }}>
            This is not your squad — you can&apos;t edit it.
          </p>
          <Link href={`/portfolio/${portfolioId}`} className="stadium-btn stadium-btn-ghost" style={{ marginTop: 14 }}>
            View squad
          </Link>
        </div>
      </AppLayout>
    );
  }

  const formationPositions = FORMATIONS[portfolio.formation];

  /* Resolve effective asset for a slot: pending change wins over the
     server-side value. Returns null if user explicitly cleared. */
  const effectiveAsset = (positionId: string, original: Asset | null): Asset | null => {
    if (pending.has(positionId)) return pending.get(positionId) ?? null;
    return original;
  };

  const starterPlayers = portfolio.players.filter((p) => !p.isBench);
  const existingBench = portfolio.players.filter((p) => p.isBench);
  /* Top up the bench section to 11 slots even when the portfolio was
     created before bench support landed. Phantom entries don't exist
     on the server yet; assignAssetToPosition will insert them on save. */
  const benchPlayers: PortfolioPlayer[] = [
    ...existingBench,
    ...Array.from(
      { length: Math.max(0, SQUAD_BENCH_COUNT - existingBench.length) },
      (_, i) => ({
        positionId: `bench-${existingBench.length + i + 1}`,
        asset: null,
        allocation: 0,
        isBench: true as const,
      }),
    ),
  ];

  const filledCount = portfolio.players.reduce((n, p) => {
    const asset = effectiveAsset(p.positionId, p.asset);
    return asset ? n + 1 : n;
  }, 0);
  const totalSlots = portfolio.players.length;

  const pendingCount = pending.size;

  /* Open the AssetSelector for a specific slot. For starters we look
     up the Position object so the modal can show risk/title context.
     Bench slots pass null position (modal handles it gracefully). */
  const openSlot = (player: PortfolioPlayer) => {
    setError(null);
    const position = player.isBench
      ? null
      : formationPositions.find((pos) => pos.id === player.positionId) || null;
    setEditingSlot({
      positionId: player.positionId,
      position,
      currentAsset: effectiveAsset(player.positionId, player.asset),
    });
  };

  const handleAssetSelected = (asset: Asset | null) => {
    if (!editingSlot) return;
    setPending((prev) => {
      const next = new Map(prev);
      next.set(editingSlot.positionId, asset);
      return next;
    });
    setEditingSlot(null);
  };

  const clearSlot = (positionId: string) => {
    setPending((prev) => {
      const next = new Map(prev);
      next.set(positionId, null);
      return next;
    });
  };

  const cancelSlotChange = (positionId: string) => {
    setPending((prev) => {
      const next = new Map(prev);
      next.delete(positionId);
      return next;
    });
  };

  const saveAll = async () => {
    if (pending.size === 0) {
      router.push(`/portfolio/${portfolioId}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      for (const [positionId, asset] of pending.entries()) {
        await assignAssetToPosition(portfolioId, positionId, asset);
      }
      router.push(`/portfolio/${portfolioId}`);
    } catch (e) {
      console.error('Bulk save failed:', e);
      setError('Some assignments failed. Try again or skip for now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout flush>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Page header */}
        <div className="flex flex-wrap items-end justify-between" style={{ gap: 14 }}>
          <div>
            <div className="kicker">FIRST KICK-OFF · BUILD YOUR SQUAD</div>
            <h1
              className="display"
              style={{
                fontSize: 'clamp(22px, 3vw, 30px)',
                letterSpacing: '-0.04em',
                margin: '4px 0 0',
              }}
            >
              Sign {portfolio.name}
            </h1>
            <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 6 }}>
              Pick 11 starters and 11 reserves. Save once and you&apos;re ready for kick-off.
            </div>
          </div>
          <div
            className="stadium-card flex items-center"
            style={{ padding: '10px 14px', gap: 12 }}
          >
            <div>
              <div className="kicker">SIGNED</div>
              <div
                className="mono num"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: filledCount === totalSlots ? 'var(--pitch)' : 'var(--text)',
                  letterSpacing: '-0.02em',
                  marginTop: 2,
                }}
              >
                {filledCount} / {totalSlots}
              </div>
            </div>
            <div style={{ width: 1, height: 30, background: 'var(--line)' }} />
            <button
              type="button"
              onClick={() => router.push(`/portfolio/${portfolioId}`)}
              className="stadium-btn stadium-btn-ghost"
              style={{ padding: '8px 12px', fontSize: 11 }}
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={saving}
              className="stadium-btn stadium-btn-primary"
              style={{ padding: '8px 16px', fontSize: 12, minWidth: 140 }}
            >
              {saving ? 'Saving…' : pending.size > 0 ? `Save ${pending.size} change${pending.size === 1 ? '' : 's'}` : 'Go to squad →'}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="stadium-card"
            style={{
              padding: '10px 14px',
              background: 'oklch(0.65 0.22 25 / 0.08)',
              borderColor: 'oklch(0.65 0.22 25 / 0.4)',
              color: 'var(--ref-red)',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* Two-column layout: Starting XI | Bench */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 18,
          }}
        >
          <SlotColumn
            title="STARTING XI"
            subtitle="The 11 players whose returns count toward your score"
            players={starterPlayers}
            formationPositions={formationPositions}
            effectiveAsset={effectiveAsset}
            pending={pending}
            onEdit={openSlot}
            onClear={clearSlot}
            onCancel={cancelSlotChange}
          />
          <SlotColumn
            title="BENCH (11)"
            subtitle="Reserves you can sub on during weekend windows for 25 XP each"
            players={benchPlayers}
            formationPositions={formationPositions}
            effectiveAsset={effectiveAsset}
            pending={pending}
            onEdit={openSlot}
            onClear={clearSlot}
            onCancel={cancelSlotChange}
          />
        </div>
      </div>

      {/* AssetSelector — opens for whichever slot is being edited */}
      <AssetSelector
        isOpen={!!editingSlot}
        onClose={() => setEditingSlot(null)}
        onSelect={handleAssetSelected}
        position={editingSlot?.position || null}
        currentAsset={editingSlot?.currentAsset || null}
      />
    </AppLayout>
  );
}

/* ============================================================
   SlotColumn — renders a list of slot cards for one section
   (Starting XI or Bench)
   ============================================================ */
const SlotColumn: React.FC<{
  title: string;
  subtitle: string;
  players: PortfolioPlayer[];
  formationPositions: Position[];
  effectiveAsset: (positionId: string, original: Asset | null) => Asset | null;
  pending: Map<string, Asset | null>;
  onEdit: (player: PortfolioPlayer) => void;
  onClear: (positionId: string) => void;
  onCancel: (positionId: string) => void;
}> = ({ title, subtitle, players, formationPositions, effectiveAsset, pending, onEdit, onClear, onCancel }) => (
  <div className="stadium-card" style={{ padding: 16 }}>
    <div style={{ marginBottom: 12 }}>
      <div className="kicker">{title}</div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 2 }}>
        {subtitle}
      </div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {players.map((player, idx) => {
        const asset = effectiveAsset(player.positionId, player.asset);
        const isPending = pending.has(player.positionId);
        const pos = formationPositions.find((p) => p.id === player.positionId);
        const slotLabel = player.isBench
          ? `Bench ${idx + 1}`
          : pos?.name || player.positionId.toUpperCase();
        const shortLabel = player.isBench ? 'BEN' : pos?.shortName || '—';
        return (
          <motion.div
            key={player.positionId}
            layout
            className="flex items-center"
            style={{
              gap: 12,
              padding: '10px 12px',
              background: asset ? 'var(--surface)' : 'var(--surface-2)',
              border: '1px solid ' + (isPending ? 'var(--pitch)' : 'var(--line)'),
              borderRadius: 8,
            }}
          >
            <div
              className="display"
              style={{
                width: 38,
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-mute)',
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}
              title={slotLabel}
            >
              {shortLabel}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {asset ? (
                <>
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
                    {asset.symbol}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: 'var(--text-mute)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {asset.name}
                  </div>
                </>
              ) : (
                <div
                  className="mono"
                  style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.04em' }}
                >
                  empty slot
                </div>
              )}
            </div>
            <div className="flex items-center" style={{ gap: 4, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => onEdit(player)}
                className="stadium-btn stadium-btn-ghost"
                style={{ padding: '6px 10px', fontSize: 11, minHeight: 32 }}
              >
                {asset ? 'Change' : 'Choose'}
              </button>
              {isPending && (
                <button
                  type="button"
                  onClick={() => onCancel(player.positionId)}
                  title="Discard pending change for this slot"
                  className="stadium-btn stadium-btn-ghost"
                  style={{
                    padding: '6px 8px',
                    fontSize: 10,
                    minHeight: 32,
                    color: 'var(--text-mute)',
                  }}
                >
                  Undo
                </button>
              )}
              {asset && !isPending && (
                <button
                  type="button"
                  onClick={() => onClear(player.positionId)}
                  title="Remove this player from the slot"
                  className="stadium-btn stadium-btn-ghost"
                  style={{
                    padding: '6px',
                    minHeight: 32,
                    color: 'var(--text-mute)',
                  }}
                >
                  <Icon.Close size={12} />
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  </div>
);
