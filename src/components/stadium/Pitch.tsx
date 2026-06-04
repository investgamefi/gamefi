/* Stadium Pitch — soccer-field component with player jerseys.
   Self-contained (no global window deps). Used decoratively on the landing
   and as a thumbnail on squad cards.
   Ported from the design bundle's pitch.jsx. */

import React from 'react';

export type PitchVariant = 'stadium' | 'tactics' | 'abstract';
export type PitchSize = 'sm' | 'md' | 'lg';
export type Risk = 'low' | 'med' | 'high';

export type PitchPosition = {
  id: string;
  short: string;            // e.g. "GK", "RB", "ST"
  risk: Risk;
  x: number;                // 0..100
  y: number;                // 0..100 (0 = top of pitch, 100 = bottom)
};

export type PitchPlayer = {
  sym: string;              // ticker, e.g. "NVDA"
  dayChangePct?: number;    // for jersey-number color + sub-label
  weight?: number;          // allocation % for the badge under jersey
};

export type FormationName = '4-3-3' | '4-4-2' | '3-5-2';

export const FORMATIONS: Record<FormationName, PitchPosition[]> = {
  '4-3-3': [
    { id: 'gk',  short: 'GK',  risk: 'low',  x: 50, y: 92 },
    { id: 'lb',  short: 'LB',  risk: 'low',  x: 18, y: 72 },
    { id: 'lcb', short: 'CB',  risk: 'low',  x: 38, y: 76 },
    { id: 'rcb', short: 'CB',  risk: 'low',  x: 62, y: 76 },
    { id: 'rb',  short: 'RB',  risk: 'low',  x: 82, y: 72 },
    { id: 'cdm', short: 'CDM', risk: 'med',  x: 50, y: 56 },
    { id: 'lcm', short: 'CM',  risk: 'med',  x: 28, y: 46 },
    { id: 'rcm', short: 'CM',  risk: 'med',  x: 72, y: 46 },
    { id: 'lw',  short: 'LW',  risk: 'high', x: 18, y: 22 },
    { id: 'st',  short: 'ST',  risk: 'high', x: 50, y: 16 },
    { id: 'rw',  short: 'RW',  risk: 'high', x: 82, y: 22 },
  ],
  '4-4-2': [
    { id: 'gk',  short: 'GK',  risk: 'low',  x: 50, y: 92 },
    { id: 'lb',  short: 'LB',  risk: 'low',  x: 18, y: 72 },
    { id: 'lcb', short: 'CB',  risk: 'low',  x: 38, y: 76 },
    { id: 'rcb', short: 'CB',  risk: 'low',  x: 62, y: 76 },
    { id: 'rb',  short: 'RB',  risk: 'low',  x: 82, y: 72 },
    { id: 'lm',  short: 'LM',  risk: 'med',  x: 18, y: 48 },
    { id: 'lcm', short: 'CM',  risk: 'med',  x: 38, y: 50 },
    { id: 'rcm', short: 'CM',  risk: 'med',  x: 62, y: 50 },
    { id: 'rm',  short: 'RM',  risk: 'med',  x: 82, y: 48 },
    { id: 'lst', short: 'ST',  risk: 'high', x: 36, y: 20 },
    { id: 'rst', short: 'ST',  risk: 'high', x: 64, y: 20 },
  ],
  '3-5-2': [
    { id: 'gk',  short: 'GK',  risk: 'low',  x: 50, y: 92 },
    { id: 'lcb', short: 'CB',  risk: 'low',  x: 28, y: 76 },
    { id: 'ccb', short: 'CB',  risk: 'low',  x: 50, y: 78 },
    { id: 'rcb', short: 'CB',  risk: 'low',  x: 72, y: 76 },
    { id: 'lwb', short: 'LWB', risk: 'med',  x: 14, y: 54 },
    { id: 'lcm', short: 'CM',  risk: 'med',  x: 34, y: 50 },
    { id: 'ccm', short: 'CM',  risk: 'med',  x: 50, y: 56 },
    { id: 'rcm', short: 'CM',  risk: 'med',  x: 66, y: 50 },
    { id: 'rwb', short: 'RWB', risk: 'med',  x: 86, y: 54 },
    { id: 'lst', short: 'ST',  risk: 'high', x: 38, y: 20 },
    { id: 'rst', short: 'ST',  risk: 'high', x: 62, y: 20 },
  ],
};

const JERSEY_NUMBER: Record<string, number> = {
  gk: 1, rb: 2, lb: 3, lcb: 4, rcb: 5, cdm: 6,
  rcm: 8, lcm: 10, rw: 7, st: 9, lw: 11,
  rm: 7, lm: 11, rst: 9, lst: 10, rwb: 2, lwb: 3,
  ccb: 4, ccm: 8,
};

const SIZE_DIMS: Record<PitchSize, { w: number; h: number; num: number }> = {
  sm: { w: 38, h: 38, num: 11 },
  md: { w: 64, h: 64, num: 16 },
  lg: { w: 84, h: 84, num: 20 },
};

const PitchLines: React.FC<{ variant: PitchVariant }> = ({ variant }) => {
  const stroke =
    variant === 'tactics' ? 'oklch(0.72 0.21 145 / 0.5)' : 'rgba(255,255,255,0.5)';
  const strokeW = variant === 'tactics' ? 1.2 : 1.5;
  return (
    <svg
      viewBox="0 0 100 140"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {/* outer */}
      <rect x="4" y="4" width="92" height="132" fill="none" stroke={stroke} strokeWidth={strokeW} />
      {/* midline + center circle */}
      <line x1="4" y1="70" x2="96" y2="70" stroke={stroke} strokeWidth={strokeW} />
      <circle cx="50" cy="70" r="10" fill="none" stroke={stroke} strokeWidth={strokeW} />
      <circle cx="50" cy="70" r="0.8" fill={stroke} />
      {/* penalty areas */}
      <rect x="22" y="4" width="56" height="18" fill="none" stroke={stroke} strokeWidth={strokeW} />
      <rect x="22" y="118" width="56" height="18" fill="none" stroke={stroke} strokeWidth={strokeW} />
      {/* goal areas */}
      <rect x="36" y="4" width="28" height="8" fill="none" stroke={stroke} strokeWidth={strokeW} />
      <rect x="36" y="128" width="28" height="8" fill="none" stroke={stroke} strokeWidth={strokeW} />
      {/* goals */}
      <rect x="42" y="2" width="16" height="2" fill="none" stroke={stroke} strokeWidth={strokeW} />
      <rect x="42" y="136" width="16" height="2" fill="none" stroke={stroke} strokeWidth={strokeW} />
      {/* penalty spots */}
      <circle cx="50" cy="14" r="0.6" fill={stroke} />
      <circle cx="50" cy="126" r="0.6" fill={stroke} />
    </svg>
  );
};

const PlayerJersey: React.FC<{
  pos: PitchPosition;
  player?: PitchPlayer;
  variant: PitchVariant;
  captain?: boolean;
  size: PitchSize;
  onClick?: () => void;
}> = ({ pos, player, variant, captain, size, onClick }) => {
  const dims = SIZE_DIMS[size];
  const hasPlayer = !!player;
  const positive = hasPlayer && (player?.dayChangePct ?? 0) >= 0;
  const jerseyNum = JERSEY_NUMBER[pos.id] ?? 0;

  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: 'translate(-50%, -50%)',
        width: dims.w,
        height: dims.h,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background: hasPlayer
            ? variant === 'tactics'
              ? 'oklch(0.18 0.018 250)'
              : 'oklch(0.99 0.005 90)'
            : 'transparent',
          border: hasPlayer
            ? `2px solid ${variant === 'tactics' ? 'var(--pitch)' : 'var(--ink)'}`
            : '2px dashed var(--chalk)',
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: hasPlayer
            ? variant === 'tactics'
              ? 'var(--text)'
              : 'var(--ink)'
            : 'var(--chalk)',
          boxShadow: hasPlayer ? '0 6px 18px -8px rgba(0,0,0,0.45)' : 'none',
        }}
      >
        {hasPlayer && (
          <div
            className="num"
            style={{
              position: 'absolute',
              top: -8,
              left: -8,
              width: 20,
              height: 20,
              background: positive ? 'var(--pitch)' : 'var(--ref-red)',
              color: positive ? 'oklch(0.14 0.05 145)' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 3,
            }}
          >
            {jerseyNum}
          </div>
        )}
        {captain && (
          <div
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'var(--whistle)',
              color: 'var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            C
          </div>
        )}

        {hasPlayer ? (
          <>
            <div
              className="display num"
              style={{ fontSize: dims.num, lineHeight: 1, letterSpacing: '-0.04em' }}
            >
              {player.sym}
            </div>
            {size !== 'sm' && player.dayChangePct != null && (
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  marginTop: 2,
                  color: positive ? 'var(--pitch-deep)' : 'var(--ref-red)',
                  fontWeight: 600,
                }}
              >
                {positive ? '+' : ''}
                {player.dayChangePct.toFixed(2)}%
              </div>
            )}
          </>
        ) : (
          <div className="kicker" style={{ color: 'var(--chalk)', fontSize: 8 }}>
            {pos.short}
          </div>
        )}
      </div>
    </div>
  );
};

export interface PitchProps {
  formation?: FormationName;
  /** Map of position id to player. Missing entries render as empty slots. */
  lineup?: Partial<Record<string, PitchPlayer>>;
  variant?: PitchVariant;
  size?: PitchSize;
  /** Position id of the captain (gets the yellow C badge). */
  captain?: string;
  onSlotClick?: (pos: PitchPosition) => void;
  /** Show the formation label in the corner. */
  showFormationLabel?: boolean;
}

export const Pitch: React.FC<PitchProps> = ({
  formation = '4-3-3',
  lineup = {},
  variant = 'stadium',
  size = 'md',
  captain,
  onSlotClick,
  showFormationLabel = true,
}) => {
  const positions = FORMATIONS[formation] || FORMATIONS['4-3-3'];

  const pitchBg =
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
    ) : variant === 'abstract' ? (
      <div style={{ position: 'absolute', inset: 0, background: 'var(--surface-2)' }} />
    ) : (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(90deg, oklch(0.42 0.16 145) 0 7.14%, oklch(0.36 0.16 145) 7.14% 14.28%)',
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

  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '5 / 7',
        borderRadius: 8,
        overflow: 'hidden',
        border:
          variant === 'tactics'
            ? '1px solid var(--line-2)'
            : '1px solid rgba(0,0,0,0.2)',
      }}
    >
      {pitchBg}
      {variant !== 'abstract' && <PitchLines variant={variant} />}

      {/* Formation label */}
      {showFormationLabel && size !== 'sm' && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: variant === 'tactics' ? 'var(--pitch)' : 'rgba(255,255,255,0.75)',
            zIndex: 2,
          }}
        >
          {formation}
        </div>
      )}

      {positions.map((pos) => (
        <PlayerJersey
          key={pos.id}
          pos={pos}
          player={lineup[pos.id]}
          variant={variant}
          captain={captain === pos.id}
          size={size}
          onClick={onSlotClick ? () => onSlotClick(pos) : undefined}
        />
      ))}
    </div>
  );
};

/** Phoenix XI — sample lineup used on the landing page hero */
export const PHOENIX_XI_LINEUP: Record<string, PitchPlayer> = {
  gk:  { sym: 'JNJ',  dayChangePct: 0.32, weight: 6 },
  lb:  { sym: 'KO',   dayChangePct: 0.18, weight: 7 },
  lcb: { sym: 'BRK',  dayChangePct: -0.22, weight: 8 },
  rcb: { sym: 'WMT',  dayChangePct: 0.55, weight: 8 },
  rb:  { sym: 'JPM',  dayChangePct: -0.32, weight: 7 },
  cdm: { sym: 'MSFT', dayChangePct: 1.13, weight: 10 },
  lcm: { sym: 'GOOG', dayChangePct: 0.55, weight: 10 },
  rcm: { sym: 'AMZN', dayChangePct: 0.74, weight: 10 },
  lw:  { sym: 'COIN', dayChangePct: 4.81, weight: 8 },
  st:  { sym: 'NVDA', dayChangePct: 2.41, weight: 14 },
  rw:  { sym: 'META', dayChangePct: 1.62, weight: 12 },
};
