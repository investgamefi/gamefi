'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button, Input } from '@/components/ui';
import { Icon } from '@/components/stadium/Icon';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [demoToken, setDemoToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDemoToken(null);

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = await response.json();
      if (result.success) {
        setSuccess(true);
        if (result.demo_token) setDemoToken(result.demo_token);
      } else {
        setError(result.error || 'Failed to send reset email');
      }
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
          <div className="kicker" style={{ marginBottom: 4 }}>LOST YOUR KEYS?</div>
          <h1
            className="display"
            style={{
              fontSize: 28,
              letterSpacing: '-0.04em',
              margin: 0,
              color: 'var(--text)',
            }}
          >
            Forgot password
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 8 }}>
            No worries — we&apos;ll send reset instructions to the email on file.
          </p>
        </div>

        {/* Card */}
        <div
          className="stadium-card"
          style={{ padding: 24, background: 'var(--surface)' }}
        >
          {success ? (
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
                <Icon.Bell size={26} style={{ color: 'var(--pitch)' }} />
              </div>
              <div className="display" style={{ fontSize: 18, letterSpacing: '-0.02em', marginBottom: 6 }}>
                Check your email
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.55, margin: 0 }}>
                If an account exists for that email, we&apos;ve sent reset instructions.
              </p>

              {demoToken && (
                <div
                  className="stadium-card"
                  style={{
                    padding: 14,
                    marginTop: 18,
                    background: 'oklch(0.83 0.18 90 / 0.08)',
                    borderColor: 'oklch(0.83 0.18 90 / 0.4)',
                    textAlign: 'left',
                  }}
                >
                  <div className="kicker" style={{ color: 'var(--whistle)', marginBottom: 6 }}>
                    DEMO MODE
                  </div>
                  <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: 0, marginBottom: 10, lineHeight: 1.55 }}>
                    In production the link would land in your inbox. For this demo:
                  </p>
                  <Link
                    href={`/reset-password?token=${demoToken}`}
                    className="mono"
                    style={{
                      color: 'var(--pitch)',
                      fontSize: 11,
                      textDecoration: 'underline',
                      wordBreak: 'break-all',
                      letterSpacing: '0.02em',
                    }}
                  >
                    Click here to reset your password →
                  </Link>
                </div>
              )}

              <div style={{ marginTop: 22 }}>
                <Link
                  href="/"
                  className="mono"
                  style={{
                    color: 'var(--pitch)',
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
            </div>
          ) : (
            <>
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
                  type="email"
                  label="Email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Icon.Bell size={14} />}
                />
                <Button type="submit" isLoading={isLoading} style={{ width: '100%', justifyContent: 'center' }}>
                  {isLoading ? 'Sending…' : 'Send reset link'}
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
          )}
        </div>
      </motion.div>
    </div>
  );
}
