'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/stadium/Icon';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /* Renders an eye button inside the field that flips the input
     between type="password" and type="text". Opt-in so ordinary
     inputs are unaffected. */
  showPasswordToggle?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  showPasswordToggle,
  className,
  style,
  type,
  ...props
}) => {
  const [revealed, setRevealed] = useState(false);
  const inputType = showPasswordToggle && revealed ? 'text' : type;

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label
          className="kicker"
          style={{
            display: 'block',
            marginBottom: 6,
            color: 'var(--text-dim)',
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {leftIcon && (
          <div
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-mute)',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            {leftIcon}
          </div>
        )}
        <input
          /* `stadium-input` class lets the global CSS bump font-size to
             16px on <sm so iOS Safari skips its zoom-on-focus
             behaviour without enlarging the desktop UI. */
          className={['stadium-input', className].filter(Boolean).join(' ')}
          type={inputType}
          style={{
            width: '100%',
            padding: '10px 14px',
            paddingLeft: leftIcon ? 32 : 14,
            paddingRight: showPasswordToggle ? 40 : rightIcon ? 32 : 14,
            background: 'var(--surface-2)',
            border: '1px solid ' + (error ? 'var(--ref-red)' : 'var(--line)'),
            borderRadius: 8,
            color: 'var(--text)',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            transition: 'border-color .15s ease, background .15s ease',
            outline: 'none',
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? 'var(--ref-red)' : 'var(--pitch)';
            e.currentTarget.style.background = 'var(--surface)';
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? 'var(--ref-red)' : 'var(--line)';
            e.currentTarget.style.background = 'var(--surface-2)';
            props.onBlur?.(e);
          }}
          {...props}
        />
        {showPasswordToggle ? (
          <button
            type="button"
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            onClick={() => setRevealed((v) => !v)}
            style={{
              position: 'absolute',
              right: 2,
              top: '50%',
              transform: 'translateY(-50%)',
              /* Big transparent hit area (~40px) for touch; the input
                 itself is only ~40px tall so this fills the field. */
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: 'var(--text-mute)',
              cursor: 'pointer',
              transition: 'color .15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-mute)';
            }}
          >
            {revealed ? <Icon.EyeOff size={16} /> : <Icon.Eye size={16} />}
          </button>
        ) : (
          rightIcon && (
            <div
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-mute)',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              {rightIcon}
            </div>
          )
        )}
      </div>
      {error && (
        <p
          className="mono"
          style={{
            marginTop: 6,
            fontSize: 11,
            color: 'var(--ref-red)',
            letterSpacing: '0.02em',
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
};
