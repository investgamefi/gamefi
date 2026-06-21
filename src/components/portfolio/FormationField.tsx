'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Portfolio, PortfolioPlayer, Position, Formation, FORMATIONS, POSITION_RISK_MAP, RiskLevel } from '@/types';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';

/* Stadium risk tiers — map directly to position rows on the pitch.
   DEF (sky)  – defenders + GK, low volatility
   MID (whistle) – midfielders, balanced
   ATK (ref-red) – attackers, high volatility */
const RISK_TIER: Record<RiskLevel, { code: 'DEF' | 'MID' | 'ATK' | 'GK'; chip: string; text: string }> = {
  low:    { code: 'DEF', chip: 'oklch(0.75 0.14 230)',  text: 'oklch(0.75 0.14 230)' },
  medium: { code: 'MID', chip: 'oklch(0.83 0.18 90)',   text: 'oklch(0.55 0.18 80)'  },
  high:   { code: 'ATK', chip: 'oklch(0.65 0.22 25)',   text: 'oklch(0.65 0.22 25)'  },
};

interface FormationFieldProps {
  portfolio: Portfolio;
  onPositionClick?: (player: PortfolioPlayer, position: Position) => void;
  isEditable?: boolean;
  compact?: boolean;
  /** Render the chalk/blueprint variant instead of the green stadium pitch. */
  variant?: 'stadium' | 'tactics';
  /** Show the bench grid below the pitch (squad detail page). When omitted
      the field only renders the starting XI on the pitch. */
  showBench?: boolean;
  /** Click handler for bench chips — fired when a bench slot is tapped. */
  onBenchClick?: (player: PortfolioPlayer) => void;
  /** Click handler for empty bench tiles. Receives the synthetic
      positionId so the parent can launch its AssetSelector against
      that exact bench slot. */
  onBenchEmpty?: (benchPositionId: string) => void;
}

const DEFAULT_ALLOCATION = 100 / 11;
const MAX_WEIGHT_OFFSET = 8;

const getPositionCoords = (
  position: Position,
  formation: Formation,
  allocation: number = DEFAULT_ALLOCATION,
): { x: number; y: number } => {
  const positions = FORMATIONS[formation];
  const rowYPositions = [85, 65, 40, 15]; // GK, DEF, MID, ATK
  const sameRowPositions = positions.filter((p) => p.row === position.row);
  const positionIndex = sameRowPositions.findIndex((p) => p.id === position.id);
  const totalInRow = sameRowPositions.length;
  const spacing = 80 / (totalInRow + 1);
  const x = 10 + spacing * (positionIndex + 1);
  const weightDeviation = allocation - DEFAULT_ALLOCATION;
  const normalizedDeviation = weightDeviation / DEFAULT_ALLOCATION;
  const yOffset = -normalizedDeviation * MAX_WEIGHT_OFFSET;
  const clamped = Math.max(-MAX_WEIGHT_OFFSET, Math.min(MAX_WEIGHT_OFFSET, yOffset));
  const y = rowYPositions[position.row] + clamped;
  return { x, y };
};

/* A jersey-style player slot. Stadium variant = white jersey on green field.
   Tactics variant = dark jersey on chalk blueprint. */
const PlayerSlot: React.FC<{
  player: PortfolioPlayer;
  position: Position;
  formation: Formation;
  onClick?: () => void;
  isEditable?: boolean;
  compact?: boolean;
  variant?: 'stadium' | 'tactics';
}> = ({ player, position, formation, onClick, isEditable, compact, variant = 'stadium' }) => {
  const allocation = player.allocation || DEFAULT_ALLOCATION;
  const { x, y } = getPositionCoords(position, formation, allocation);
  const hasAsset = player.asset !== null;
  const riskLevel = POSITION_RISK_MAP[position.row];
  const tier = RISK_TIER[riskLevel];
  const isHighWeight = allocation > DEFAULT_ALLOCATION + 2;
  const isLowWeight = allocation < DEFAULT_ALLOCATION - 2;
  const positive = hasAsset && player.asset!.dayChangePercent >= 0;
  const dims = compact ? { w: 44, fontSize: 11 } : { w: 60, fontSize: 13 };

  // Deterministic jersey number derived from position id (matches design's logic)
  const JERSEY_MAP: Record<string, number> = {
    gk: 1, rb: 2, lb: 3, lcb: 4, rcb: 5, cdm: 6, rcm: 8, lcm: 10,
    rw: 7, st: 9, lw: 11, rm: 7, lm: 11, rst: 9, lst: 10, rwb: 2, lwb: 3,
    ccb: 4, ccm: 8, sw: 5, cam: 10, cf: 9, sub: 12,
  };
  const jerseyNum = JERSEY_MAP[position.id.toLowerCase()] || (position.row + 1);

  const jerseyBg = hasAsset
    ? variant === 'tactics'
      ? 'oklch(0.18 0.018 250)'
      : 'oklch(0.99 0.005 90)'
    : 'transparent';
  const jerseyBorder = hasAsset
    ? `2px solid ${variant === 'tactics' ? 'var(--pitch)' : 'var(--ink)'}`
    : '2px dashed rgba(255,255,255,0.4)';
  const jerseyText = hasAsset
    ? variant === 'tactics'
      ? 'var(--text)'
      : 'var(--ink)'
    : variant === 'tactics'
    ? 'var(--text-dim)'
    : 'rgba(255,255,255,0.55)';

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', duration: 0.5, delay: Math.random() * 0.3 }}
      onClick={onClick}
      disabled={!isEditable}
      className={cn('absolute group', isEditable && 'cursor-pointer')}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        background: 'transparent',
        border: 'none',
        padding: 0,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: dims.w,
          height: dims.w,
          background: jerseyBg,
          border: jerseyBorder,
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: jerseyText,
          boxShadow: hasAsset ? '0 6px 18px -8px rgba(0,0,0,0.45)' : 'none',
          transition: 'transform .15s ease',
        }}
      >
        {/* Jersey number badge top-left */}
        {hasAsset && (
          <div
            className="num"
            style={{
              position: 'absolute',
              top: -8,
              left: -8,
              width: 18,
              height: 18,
              background: positive ? 'var(--pitch)' : 'var(--ref-red)',
              color: positive ? 'oklch(0.14 0.05 145)' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 700,
              borderRadius: 3,
            }}
          >
            {jerseyNum}
          </div>
        )}

        {/* Position risk pill bottom-center (only on empty slots) */}
        {!hasAsset && !compact && (
          <div
            className="kicker"
            style={{
              position: 'absolute',
              bottom: -16,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '1px 6px',
              background: tier.chip,
              color: variant === 'tactics' ? 'var(--bg)' : 'oklch(0.14 0.05 145)',
              fontSize: 8,
              borderRadius: 2,
              letterSpacing: '0.14em',
            }}
          >
            {tier.code}
          </div>
        )}

        {hasAsset ? (
          <>
            <div
              className="display num"
              style={{
                fontSize: dims.fontSize,
                lineHeight: 1,
                letterSpacing: '-0.04em',
              }}
            >
              {player.asset!.symbol}
            </div>
            {!compact && (
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  marginTop: 2,
                  color: positive ? 'var(--pitch-deep)' : 'var(--ref-red)',
                  fontWeight: 600,
                }}
              >
                {formatPercent(player.asset!.dayChangePercent)}
              </div>
            )}
          </>
        ) : (
          <div className="kicker" style={{ fontSize: 8, color: 'inherit' }}>
            {position.shortName}
          </div>
        )}

        {/* "+" hover affordance on empty editable slots */}
        {!hasAsset && isEditable && (
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'oklch(0.72 0.21 145 / 0.85)',
              borderRadius: 2,
              transition: 'opacity .15s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="oklch(0.14 0.05 145)" strokeWidth="3" strokeLinecap="round">
              <path d="M12 5 V19 M5 12 H19" />
            </svg>
          </div>
        )}
      </div>

      {/* Weight badge under jersey */}
      {hasAsset && !compact && (
        <div
          className="mono num"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -20,
            transform: 'translateX(-50%)',
            fontSize: 9,
            fontWeight: 600,
            color:
              isHighWeight
                ? 'var(--pitch)'
                : isLowWeight
                ? 'var(--text-mute)'
                : variant === 'tactics'
                ? 'var(--text-dim)'
                : 'rgba(255,255,255,0.85)',
            background:
              variant === 'tactics' ? 'transparent' : 'rgba(0,0,0,0.55)',
            padding: '1px 5px',
            borderRadius: 3,
            letterSpacing: '0.05em',
          }}
        >
          {allocation.toFixed(1)}%
        </div>
      )}

      {/* Hover card */}
      {hasAsset && !compact && (
        <div
          className="absolute opacity-0 group-hover:opacity-100"
          style={{
            bottom: 'calc(100% + 14px)',
            left: '50%',
            transform: 'translateX(-50%)',
            transition: 'opacity .2s',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div
            className="stadium-card"
            style={{
              padding: 10,
              background: 'var(--ink)',
              border: '1px solid var(--line-2)',
              color: '#fff',
              minWidth: 160,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            <div className="display" style={{ fontSize: 13, letterSpacing: '-0.01em' }}>
              {player.asset!.name}
            </div>
            <div className="mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {player.asset!.sector.toUpperCase()}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', marginTop: 8 }}>
              <span className="kicker" style={{ color: 'rgba(255,255,255,0.4)' }}>WEIGHT</span>
              <span className="mono num" style={{ fontSize: 11, textAlign: 'right' }}>
                {allocation.toFixed(1)}%
              </span>
              <span className="kicker" style={{ color: 'rgba(255,255,255,0.4)' }}>PRICE</span>
              <span className="mono num" style={{ fontSize: 11, textAlign: 'right' }}>
                {formatCurrency(player.asset!.currentPrice)}
              </span>
              <span className="kicker" style={{ color: 'rgba(255,255,255,0.4)' }}>DAY</span>
              <span
                className="mono num"
                style={{
                  fontSize: 11,
                  textAlign: 'right',
                  color: positive ? 'var(--pitch-glow)' : '#ff7766',
                }}
              >
                {formatPercent(player.asset!.dayChangePercent)}
              </span>
              <span className="kicker" style={{ color: 'rgba(255,255,255,0.4)' }}>RISK</span>
              <span
                className="mono num"
                style={{
                  fontSize: 11,
                  textAlign: 'right',
                  color: tier.text,
                }}
              >
                {tier.code}
              </span>
            </div>
          </div>
        </div>
      )}
    </motion.button>
  );
};

export const FormationField: React.FC<FormationFieldProps> = ({
  portfolio,
  onPositionClick,
  isEditable = false,
  compact = false,
  variant = 'stadium',
  showBench = false,
  onBenchClick,
  onBenchEmpty,
}) => {
  const positions = FORMATIONS[portfolio.formation];
  /* Split players into starters and bench. The bench flag is opt-in: any
     row missing isBench is treated as a starter, which keeps legacy
     11-player portfolios rendering correctly on the pitch. */
  const starters = portfolio.players.filter((p) => !p.isBench);
  const benchPlayers = portfolio.players.filter((p) => p.isBench);

  const fieldBg =
    variant === 'tactics' ? (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--surface)',
          backgroundImage:
            'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
    ) : (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(0deg, oklch(0.42 0.16 145) 0 7.14%, oklch(0.36 0.16 145) 7.14% 14.28%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)',
          }}
        />
      </div>
    );

  const lineStroke = variant === 'tactics' ? 'oklch(0.72 0.21 145 / 0.5)' : 'rgba(255,255,255,0.5)';

  const pitchEl = (
    <div
      className={cn(
        'relative overflow-hidden',
        compact ? 'aspect-[4/5]' : 'aspect-[4/5] sm:aspect-[3/4]',
      )}
      style={{
        borderRadius: 12,
        border:
          variant === 'tactics' ? '1px solid var(--line-2)' : '1px solid rgba(0,0,0,0.25)',
      }}
    >
      {fieldBg}

      {/* Chalk lines */}
      <svg
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 140"
      >
        <rect x="4" y="4" width="92" height="132" fill="none" stroke={lineStroke} strokeWidth="1.5" />
        <line x1="4" y1="70" x2="96" y2="70" stroke={lineStroke} strokeWidth="1.5" />
        <circle cx="50" cy="70" r="10" fill="none" stroke={lineStroke} strokeWidth="1.5" />
        <circle cx="50" cy="70" r="0.8" fill={lineStroke} />
        <rect x="22" y="4" width="56" height="18" fill="none" stroke={lineStroke} strokeWidth="1.5" />
        <rect x="22" y="118" width="56" height="18" fill="none" stroke={lineStroke} strokeWidth="1.5" />
        <rect x="36" y="4" width="28" height="8" fill="none" stroke={lineStroke} strokeWidth="1.5" />
        <rect x="36" y="128" width="28" height="8" fill="none" stroke={lineStroke} strokeWidth="1.5" />
        <rect x="42" y="2" width="16" height="2" fill="none" stroke={lineStroke} strokeWidth="1.5" />
        <rect x="42" y="136" width="16" height="2" fill="none" stroke={lineStroke} strokeWidth="1.5" />
        <circle cx="50" cy="14" r="0.6" fill={lineStroke} />
        <circle cx="50" cy="126" r="0.6" fill={lineStroke} />
      </svg>

      {/* Zone labels along the left edge */}
      {!compact && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 8,
            width: 28,
            pointerEvents: 'none',
          }}
        >
          {[
            { y: 18, label: 'ATK', sub: 'HIGH' },
            { y: 50, label: 'MID', sub: 'MED' },
            { y: 76, label: 'DEF', sub: 'LOW' },
            { y: 92, label: 'GK', sub: 'LOW' },
          ].map((z) => (
            <div
              key={z.label}
              style={{
                position: 'absolute',
                top: `${z.y}%`,
                left: 0,
                transform: 'translateY(-50%)',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                lineHeight: 1.3,
                color: variant === 'tactics' ? 'var(--text-dim)' : 'rgba(255,255,255,0.65)',
                letterSpacing: '0.16em',
              }}
            >
              <div style={{ fontWeight: 700 }}>{z.label}</div>
              <div style={{ opacity: 0.6 }}>{z.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Formation label */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 10,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.18em',
          color: variant === 'tactics' ? 'var(--pitch)' : 'rgba(255,255,255,0.85)',
          background: variant === 'tactics' ? 'transparent' : 'rgba(0,0,0,0.35)',
          padding: '2px 6px',
          borderRadius: 3,
        }}
      >
        {portfolio.formation}
      </div>

      {/* Player jerseys — STARTERS only. Bench is rendered separately
          below the pitch when showBench is true. */}
      {starters.map((player) => {
        const position = positions.find((p) => p.id === player.positionId);
        if (!position) return null;
        return (
          <PlayerSlot
            key={player.positionId}
            player={player}
            position={position}
            formation={portfolio.formation}
            onClick={() => onPositionClick?.(player, position)}
            isEditable={isEditable}
            compact={compact}
            variant={variant}
          />
        );
      })}
    </div>
  );

  if (!showBench) return pitchEl;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {pitchEl}
      <BenchGrid
        bench={benchPlayers}
        onBenchClick={onBenchClick}
        onBenchEmpty={onBenchEmpty}
        isEditable={isEditable}
      />
    </div>
  );
};

/* Bench strip — 11 slots in a 4-col / 6-col grid below the pitch.
   Uses the same risk-tier colour vocabulary as the pitch chips but
   slightly desaturated to read as reserves. */
const BenchGrid: React.FC<{
  bench: PortfolioPlayer[];
  onBenchClick?: (player: PortfolioPlayer) => void;
  /* Click handler for EMPTY bench tiles. Receives the synthetic
     positionId (e.g. "bench-7") so the parent can spin up an
     AssetSelector for that exact slot. */
  onBenchEmpty?: (benchPositionId: string) => void;
  isEditable?: boolean;
}> = ({ bench, onBenchClick, onBenchEmpty, isEditable }) => {
  /* Pad bench up to 11 slots so the grid always reads as a full
     reserves row even when the user hasn't filled every spot yet.
     Each padding entry carries the synthetic positionId the rest of
     the system already uses for bench slots ("bench-N"). */
  const slots: { player: PortfolioPlayer | null; benchPositionId: string }[] = bench.map(
    (p) => ({ player: p, benchPositionId: p.positionId }),
  );
  while (slots.length < 11) {
    slots.push({ player: null, benchPositionId: `bench-${slots.length + 1}` });
  }

  return (
    <div
      className="stadium-card"
      style={{
        padding: 12,
        background: 'var(--surface-2)',
        borderColor: 'var(--line)',
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <div className="kicker">BENCH · {bench.filter((b) => b.asset).length}/11 RESERVES</div>
        <div className="mono" style={{ fontSize: 9, color: 'var(--text-mute)', letterSpacing: '0.12em' }}>
          SUB ON WEEKEND
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(56px, 1fr))',
          gap: 8,
        }}
      >
        {slots.map(({ player, benchPositionId }, i) => {
          const isFilled = !!player?.asset;
          const isClickable =
            isEditable && (isFilled ? !!onBenchClick : !!onBenchEmpty);
          return (
            <button
              key={benchPositionId ?? `bench-empty-${i}`}
              type="button"
              onClick={() => {
                if (!isEditable) return;
                if (player && isFilled) onBenchClick?.(player);
                else onBenchEmpty?.(benchPositionId);
              }}
              disabled={!isClickable}
              title={
                isFilled
                  ? `View ${player?.asset?.symbol} on the bench`
                  : isEditable
                  ? 'Sign a player into this reserve slot'
                  : undefined
              }
              style={{
                minHeight: 56,
                padding: 6,
                background: isFilled ? 'var(--surface)' : 'transparent',
                border: '1px dashed ' + (isFilled ? 'var(--line-2)' : 'var(--line)'),
                borderRadius: 6,
                cursor: isClickable ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                opacity: isFilled ? 0.85 : isClickable ? 0.7 : 0.45,
                transition: 'opacity .15s, border-color .15s',
              }}
              onMouseEnter={(e) => {
                if (isClickable) {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.borderColor = 'var(--pitch)';
                }
              }}
              onMouseLeave={(e) => {
                if (isClickable) {
                  e.currentTarget.style.opacity = isFilled ? '0.85' : '0.7';
                  e.currentTarget.style.borderColor = isFilled ? 'var(--line-2)' : 'var(--line)';
                }
              }}
            >
              {isFilled && player?.asset ? (
                <>
                  <div className="display num" style={{ fontSize: 12, letterSpacing: '-0.03em' }}>
                    {player.asset.symbol}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 9,
                      color: player.asset.dayChangePercent >= 0 ? 'var(--pitch)' : 'var(--ref-red)',
                      fontWeight: 600,
                    }}
                  >
                    {player.asset.dayChangePercent >= 0 ? '+' : ''}
                    {player.asset.dayChangePercent.toFixed(1)}%
                  </div>
                </>
              ) : (
                <>
                  <div className="kicker" style={{ fontSize: 8 }}>EMPTY</div>
                  {isEditable && onBenchEmpty && (
                    <div className="mono" style={{ fontSize: 8, color: 'var(--text-mute)', letterSpacing: '0.08em', marginTop: 1 }}>
                      + SIGN
                    </div>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
