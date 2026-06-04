'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button, Input } from '@/components/ui';
import { Icon } from '@/components/stadium/Icon';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid reset link. Please request a new password reset.');
      return;
    }
    if (!password) return setError('Please enter a new password');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const result = await response.json();
      if (result.success) {
        setSuccess(true);
        setTimeout(() => router.push('/'), 3000);
      } else {
        setError(result.error || 'Failed to reset password');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 14px',
            borderRadius: 10,
            background: 'oklch(0.65 0.22 25 / 0.08)',
            border: '1px solid oklch(0.65 0.22 25 / 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon.Close size={26} style={{ color: 'var(--ref-red)' }} />
        </div>
        <div className="display" style={{ fontSize: 18, letterSpacing: '-0.02em', marginBottom: 6 }}>
          Invalid reset link
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 18, lineHeight: 1.55 }}>
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <Link href="/forgot-password" style={{ textDecoration: 'none' }}>
          <Button style={{ width: '100%', justifyContent: 'center' }}>
            <Icon.Bell size={14} /> Request a new link
          </Button>
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 14px',
            borderRadius: 10,
            background: 'var(--pitch-tint)',
            border: '1px solid oklch(0.72 0.21 145 / 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--pitch)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="display" style={{ fontSize: 18, letterSpacing: '-0.02em', marginBottom: 6 }}>
          Password reset
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 18, lineHeight: 1.55 }}>
          Your password has been reset successfully. Redirecting you to sign in…
        </p>
        <div className="stadium-spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div className="kicker" style={{ marginBottom: 2 }}>SECURE A NEW KEY</div>
        <div className="display" style={{ fontSize: 18, letterSpacing: '-0.02em' }}>
          Set new password
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: 0, marginTop: 4, lineHeight: 1.5 }}>
          Your new password must be at least 6 characters long.
        </p>
      </div>

      {error && (
        <div
          className="stadium-card"
          style={{
            padding: '10px 12px',
            marginBottom: 14,
            background: 'oklch(0.65 0.22 25 / 0.08)',
            borderColor: 'oklch(0.65 0.22 25 / 0.3)',
          }}
        >
          <p
            className="mono"
            style={{ fontSize: 11, color: 'var(--ref-red)', margin: 0, letterSpacing: '0.02em' }}
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
          label="New Password"
          type="password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Icon.Bolt size={14} />}
        />
        <Input
          label="Confirm Password"
          type="password"
          placeholder="Confirm your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          leftIcon={<Icon.Bolt size={14} />}
        />
        <Button type="submit" isLoading={isLoading} style={{ width: '100%', justifyContent: 'center' }}>
          {isLoading ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>

      <div style={{ marginTop: 18, textAlign: 'center' }}>
        <Link
          href="/"
          className="mono"
          style={{
            color: 'var(--text-dim)',
            fontSize: 11,
            textDecoration: 'none',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon.Arrow size={12} style={{ transform: 'rotate(180deg)' }} /> BACK TO LOGIN
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
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
          <div className="kicker" style={{ marginBottom: 4 }}>NEW SET OF KEYS</div>
          <h1
            className="display"
            style={{
              fontSize: 28,
              letterSpacing: '-0.04em',
              margin: 0,
              color: 'var(--text)',
            }}
          >
            Reset password
          </h1>
        </div>

        <div className="stadium-card" style={{ padding: 24, background: 'var(--surface)' }}>
          <Suspense
            fallback={
              <div className="kicker" style={{ textAlign: 'center', padding: 24 }}>
                LOADING…
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </div>
      </motion.div>
    </div>
  );
}
