'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { Input } from '@/components/ui';
import { Icon } from '@/components/stadium/Icon';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError('Please enter your username or email');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(identifier, password);
      if (!result.success) setError(result.error || 'Login failed');
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="stadium-root"
      data-theme="dark"
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* Faint chalk grid backdrop (same as landing hero) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          opacity: 0.35,
          maskImage: 'radial-gradient(ellipse at center, #000 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, #000 30%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ position: 'relative', width: '100%', maxWidth: 420 }}
      >
        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                background: 'var(--text)',
                color: 'var(--bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon.Logo size={28} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div className="display" style={{ fontSize: 18, letterSpacing: '-0.03em', color: 'var(--text)' }}>
                GAMEFI
              </div>
              <div className="kicker" style={{ fontSize: 9, marginTop: -2 }}>
                INVEST · LEAGUE
              </div>
            </div>
          </Link>
          <div className="kicker" style={{ marginBottom: 4 }}>WELCOME BACK</div>
          <h1
            className="display"
            style={{
              fontSize: 30,
              letterSpacing: '-0.04em',
              margin: 0,
              color: 'var(--text)',
            }}
          >
            Sign in to the league
          </h1>
        </div>

        {/* Card */}
        <div
          className="stadium-card"
          style={{ padding: 24, background: 'var(--surface)' }}
        >
          {error && (
            <div
              className="stadium-card"
              style={{
                padding: '10px 12px',
                marginBottom: 16,
                background: 'oklch(0.65 0.22 25 / 0.08)',
                borderColor: 'oklch(0.65 0.22 25 / 0.3)',
              }}
            >
              <p
                className="mono"
                style={{
                  fontSize: 11,
                  color: 'var(--ref-red)',
                  margin: 0,
                  letterSpacing: '0.02em',
                }}
              >
                {error}
              </p>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <Input
              label="Username or Email"
              placeholder="presho or you@email.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              leftIcon={<Icon.Profile size={14} />}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Icon.Bolt size={14} />}
            />

            <div className="flex justify-end" style={{ marginTop: -4 }}>
              <Link
                href="/forgot-password"
                className="mono"
                style={{
                  fontSize: 10,
                  color: 'var(--pitch)',
                  textDecoration: 'none',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                FORGOT PASSWORD?
              </Link>
            </div>

            <button
              type="submit"
              className="stadium-btn stadium-btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '12px 18px',
                fontSize: 14,
                marginTop: 4,
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      border: '2px solid currentColor',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'stadium-spin 0.9s linear infinite',
                    }}
                  />
                  Signing in…
                </>
              ) : (
                <>
                  <Icon.Whistle size={14} /> Kick off
                </>
              )}
            </button>
          </form>

          <div
            style={{
              marginTop: 18,
              paddingTop: 18,
              borderTop: '1px solid var(--line)',
              textAlign: 'center',
            }}
          >
            <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: 0 }}>
              Not a manager yet?{' '}
              <button
                type="button"
                onClick={onSwitchToRegister}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--pitch)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Join the league →
              </button>
            </p>
          </div>
        </div>

        {/* Demo note */}
        <p
          className="mono"
          style={{
            textAlign: 'center',
            fontSize: 9,
            color: 'var(--text-mute)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginTop: 16,
          }}
        >
          Educational paper-trading platform · Not financial advice
        </p>
      </motion.div>
    </div>
  );
};
