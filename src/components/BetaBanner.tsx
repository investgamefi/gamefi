'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/stadium/Icon';

export const BetaBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('beta_banner_dismissed');
    if (dismissed) {
      setIsDismissed(true);
      setIsVisible(false);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('beta_banner_dismissed', 'true');
    setTimeout(() => setIsDismissed(true), 300);
  };

  if (isDismissed) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          style={{
            background: 'oklch(0.83 0.18 90 / 0.08)',
            borderBottom: '1px solid oklch(0.83 0.18 90 / 0.3)',
          }}
        >
          <div
            className="max-w-7xl mx-auto flex items-center justify-between"
            style={{ padding: '8px 24px', gap: 12 }}
          >
            <div
              className="flex items-center"
              style={{ gap: 10, minWidth: 0, flex: 1 }}
            >
              <span
                className="mono"
                style={{
                  padding: '2px 8px',
                  background: 'var(--whistle)',
                  color: 'var(--ink)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  borderRadius: 3,
                  flexShrink: 0,
                }}
              >
                BETA
              </span>
              <p
                style={{
                  color: 'oklch(0.55 0.18 80)',
                  fontSize: 12,
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                Welcome to Gamefi Invest beta — we&apos;re still building.
                <span className="hidden sm:inline" style={{ color: 'var(--text-mute)', marginLeft: 6 }}>
                  Your feedback helps us improve.
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss banner"
              style={{
                background: 'transparent',
                border: 'none',
                padding: 4,
                color: 'oklch(0.55 0.18 80)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <Icon.Close size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
