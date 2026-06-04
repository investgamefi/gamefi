'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { Input } from '@/components/ui';
import { Icon } from '@/components/stadium/Icon';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const result = await register(username, email, password);
      if (!result.success) setError(result.error || 'Registration failed');
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
      {/* Faint chalk grid backdrop */}
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
        style={{ position: 'relative', width: '100%', maxWidth: 440 }}
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
          <div className="kicker" style={{ marginBottom: 4 }}>SEASON 1 IS OPEN</div>
          <h1
            className="display"
            style={{
              fontSize: 30,
              letterSpacing: '-0.04em',
              margin: 0,
              color: 'var(--text)',
            }}
          >
            Join the league
          </h1>
          <p
            style={{
              color: 'var(--text-dim)',
              fontSize: 13,
              marginTop: 8,
            }}
          >
            +500 XP welcome bonus when you field your first XI.
          </p>
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
              label="Username"
              placeholder="Choose a manager handle"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              leftIcon={<Icon.Profile size={14} />}
            />

            <Input
              label="Email"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Icon.Bell size={14} />}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Icon.Bolt size={14} />}
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftIcon={<Icon.Bolt size={14} />}
            />

            <button
              type="submit"
              className="stadium-btn stadium-btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '12px 18px',
                fontSize: 14,
                marginTop: 6,
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
                  Creating account…
                </>
              ) : (
                <>
                  <Icon.Pitch size={14} /> Create manager account
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
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
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
                Sign in →
              </button>
            </p>
          </div>
        </div>

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
          Paper trading only · No financial advice · No credit card required
        </p>
      </motion.div>
    </div>
  );
};
