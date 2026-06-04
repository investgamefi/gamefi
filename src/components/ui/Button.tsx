'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/* Map legacy variants onto the stadium button system.
   - primary  → solid pitch-green
   - secondary→ ink (high-contrast text on bg, inverse)
   - outline  → ghost with a heavier border
   - ghost    → transparent / line-bordered
   - danger   → ref-red solid */
const SIZE_PADDING: Record<NonNullable<ButtonProps['size']>, { padding: string; fontSize: number; gap: number }> = {
  sm: { padding: '6px 10px', fontSize: 11, gap: 6 },
  md: { padding: '9px 14px', fontSize: 13, gap: 8 },
  lg: { padding: '12px 18px', fontSize: 14, gap: 10 },
};

const variantStyle = (variant: NonNullable<ButtonProps['variant']>): React.CSSProperties => {
  switch (variant) {
    case 'primary':
      return {
        background: 'var(--pitch)',
        color: 'oklch(0.14 0.05 145)',
        border: '1px solid var(--pitch-deep)',
      };
    case 'secondary':
      return {
        background: 'var(--text)',
        color: 'var(--bg)',
        border: '1px solid var(--text)',
      };
    case 'outline':
      return {
        background: 'transparent',
        color: 'var(--text)',
        border: '1px solid var(--line-2)',
      };
    case 'ghost':
      return {
        background: 'transparent',
        color: 'var(--text)',
        border: '1px solid var(--line)',
      };
    case 'danger':
      return {
        background: 'var(--ref-red)',
        color: '#fff',
        border: '1px solid var(--ref-red)',
      };
  }
};

const variantHover = (variant: NonNullable<ButtonProps['variant']>): React.CSSProperties => {
  switch (variant) {
    case 'primary':
      return { background: 'var(--pitch-glow)' };
    case 'secondary':
      return { background: 'var(--text-dim)' };
    case 'outline':
    case 'ghost':
      return { background: 'var(--surface-2)', borderColor: 'var(--line-2)' };
    case 'danger':
      return { background: 'oklch(0.55 0.22 25)' };
  }
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  style,
  disabled,
  ...props
}) => {
  const sizing = SIZE_PADDING[size];
  const vStyle = variantStyle(variant);
  const hover = variantHover(variant);
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sizing.gap,
    padding: sizing.padding,
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: sizing.fontSize,
    letterSpacing: '0.02em',
    borderRadius: 8,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.55 : 1,
    transition: 'background .15s ease, border-color .15s ease, transform .12s ease',
    whiteSpace: 'nowrap',
    ...vStyle,
    ...style,
  };

  return (
    <button
      className={className}
      style={baseStyle}
      disabled={disabled || isLoading}
      onMouseEnter={(e) => {
        if (disabled || isLoading) return;
        Object.assign(e.currentTarget.style, hover);
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (disabled || isLoading) return;
        Object.assign(e.currentTarget.style, vStyle);
        props.onMouseLeave?.(e);
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'translateY(1px)';
        props.onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        props.onMouseUp?.(e);
      }}
      {...props}
    >
      {isLoading ? (
        <span
          style={{
            width: sizing.fontSize,
            height: sizing.fontSize,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'stadium-spin 0.9s linear infinite',
            display: 'inline-block',
          }}
        />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};
