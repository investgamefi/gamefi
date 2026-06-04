/* Custom monoline icon set — stadium / pitch / sport vocabulary.
   All 24×24, stroke 1.6, currentColor.
   Ported from the design bundle's icons.jsx. */

import React from 'react';

type IconProps = {
  size?: number;
  stroke?: number;
  style?: React.CSSProperties;
  className?: string;
};

const SvgIcon: React.FC<IconProps & { children: React.ReactNode }> = ({
  children,
  size = 20,
  stroke = 1.6,
  style,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, ...style }}
    className={className}
  >
    {children}
  </svg>
);

export const Icon = {
  Logo: (p: IconProps) => (
    <SvgIcon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3 L9.5 9 L3.5 9.5 L8 13.5 L6.5 19.5 L12 16.5 L17.5 19.5 L16 13.5 L20.5 9.5 L14.5 9 Z" />
    </SvgIcon>
  ),
  Matchday: (p: IconProps) => (
    <SvgIcon {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10 H21" />
      <path d="M9 14 H15" />
      <path d="M7 17 H9" />
    </SvgIcon>
  ),
  Pitch: (p: IconProps) => (
    <SvgIcon {...p}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 12 H21" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M3 8 H7 V16 H3" />
      <path d="M17 8 H21 M17 16 H21 M17 8 V16" />
    </SvgIcon>
  ),
  Lineup: (p: IconProps) => (
    <SvgIcon {...p}>
      <circle cx="6" cy="7" r="2" />
      <circle cx="12" cy="7" r="2" />
      <circle cx="18" cy="7" r="2" />
      <circle cx="9" cy="16" r="2" />
      <circle cx="15" cy="16" r="2" />
    </SvgIcon>
  ),
  Fixture: (p: IconProps) => (
    <SvgIcon {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 2 V6 M16 2 V6" />
      <path d="M3 9 H21" />
      <path d="M8 14 L10 16 L13 13" />
    </SvgIcon>
  ),
  Compare: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M7 4 V20" />
      <path d="M17 4 V20" />
      <path d="M7 8 L11 8" />
      <path d="M17 14 L13 14" />
      <path d="M7 14 L9 14" />
      <path d="M17 8 L15 8" />
    </SvgIcon>
  ),
  Scout: (p: IconProps) => (
    <SvgIcon {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16 L20 20" />
      <path d="M11 8 V14 M8 11 H14" />
    </SvgIcon>
  ),
  Table: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M5 20 V12" />
      <path d="M12 20 V6" />
      <path d="M19 20 V15" />
      <path d="M3 20 H21" />
    </SvgIcon>
  ),
  Transfer: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M4 8 H17 L14 5" />
      <path d="M20 16 H7 L10 19" />
    </SvgIcon>
  ),
  Coach: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M4 6 H20" />
      <path d="M4 6 V12 C4 16 8 19 12 19 C16 19 20 16 20 12 V6" />
      <path d="M12 19 V21" />
      <path d="M9 21 H15" />
    </SvgIcon>
  ),
  Guide: (p: IconProps) => (
    <SvgIcon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9 A3 3 0 0 1 15 10 C15 12 12 12 12 14" />
      <circle cx="12" cy="17.5" r="0.6" fill="currentColor" />
    </SvgIcon>
  ),
  Whistle: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M3 12 A6 6 0 0 0 15 12 A6 6 0 0 0 3 12 Z" />
      <path d="M15 10 L21 7 V17 L15 14" />
    </SvgIcon>
  ),
  Trophy: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M7 4 H17 V10 A5 5 0 0 1 7 10 Z" />
      <path d="M7 6 H4 V8 A3 3 0 0 0 7 11" />
      <path d="M17 6 H20 V8 A3 3 0 0 1 17 11" />
      <path d="M9 15 H15 L14 20 H10 Z" />
    </SvgIcon>
  ),
  Bell: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M6 16 H18 L17 13 V10 A5 5 0 0 0 7 10 V13 Z" />
      <path d="M10 19 A2 2 0 0 0 14 19" />
    </SvgIcon>
  ),
  Search: (p: IconProps) => (
    <SvgIcon {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16 L20 20" />
    </SvgIcon>
  ),
  Plus: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M12 5 V19 M5 12 H19" />
    </SvgIcon>
  ),
  Arrow: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M5 12 H19 M14 7 L19 12 L14 17" />
    </SvgIcon>
  ),
  ArrowUp: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M12 19 V5 M7 10 L12 5 L17 10" />
    </SvgIcon>
  ),
  ArrowDown: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M12 5 V19 M7 14 L12 19 L17 14" />
    </SvgIcon>
  ),
  Chevron: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M9 6 L15 12 L9 18" />
    </SvgIcon>
  ),
  Sun: (p: IconProps) => (
    <SvgIcon {...p}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3 V5 M12 19 V21 M3 12 H5 M19 12 H21 M5.6 5.6 L7 7 M17 17 L18.4 18.4 M5.6 18.4 L7 17 M17 7 L18.4 5.6" />
    </SvgIcon>
  ),
  Moon: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M20 14 A8 8 0 1 1 10 4 A6 6 0 0 0 20 14 Z" />
    </SvgIcon>
  ),
  Settings: (p: IconProps) => (
    <SvgIcon {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3 V6 M12 18 V21 M3 12 H6 M18 12 H21 M5.6 5.6 L7.7 7.7 M16.3 16.3 L18.4 18.4 M5.6 18.4 L7.7 16.3 M16.3 7.7 L18.4 5.6" />
    </SvgIcon>
  ),
  Menu: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M4 7 H20 M4 12 H20 M4 17 H20" />
    </SvgIcon>
  ),
  Close: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </SvgIcon>
  ),
  Filter: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M3 5 H21 L14 13 V20 L10 18 V13 Z" />
    </SvgIcon>
  ),
  Flame: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M12 3 C12 7 16 8 16 13 A4 4 0 0 1 8 13 C8 11 9 10 9 8 C10 10 12 9 12 3 Z" />
    </SvgIcon>
  ),
  Bolt: (p: IconProps) => (
    <SvgIcon {...p}>
      <path d="M13 3 L5 14 H12 L11 21 L19 10 H12 Z" />
    </SvgIcon>
  ),
  Target: (p: IconProps) => (
    <SvgIcon {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </SvgIcon>
  ),
  Goal: (p: IconProps) => (
    <SvgIcon {...p}>
      <rect x="3" y="6" width="18" height="12" />
      <path d="M3 10 H21 M3 14 H21 M7 6 V18 M11 6 V18 M15 6 V18 M19 6 V18" />
    </SvgIcon>
  ),
  Ball: (p: IconProps) => (
    <SvgIcon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3 L9.5 9 L3.5 9.5 L8 13.5 L6.5 19.5 L12 16.5 L17.5 19.5 L16 13.5 L20.5 9.5 L14.5 9 Z" />
    </SvgIcon>
  ),
  Profile: (p: IconProps) => (
    <SvgIcon {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20 C4 16 8 14 12 14 C16 14 20 16 20 20" />
    </SvgIcon>
  ),
};

export type IconName = keyof typeof Icon;
