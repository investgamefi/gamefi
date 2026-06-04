'use client';

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  className,
  style,
  ...props
}) => {
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
          className={className}
          style={{
            width: '100%',
            padding: '10px 14px',
            paddingLeft: leftIcon ? 32 : 14,
            paddingRight: rightIcon ? 32 : 14,
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
        {rightIcon && (
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
