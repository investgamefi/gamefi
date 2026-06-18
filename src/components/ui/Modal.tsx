'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/stadium/Icon';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Optional small line shown under the title (eg "Pick a formation · 4-3-3"). */
  subtitle?: string;
}

const SIZE_MAX_WIDTH: Record<NonNullable<ModalProps['size']>, number> = {
  sm: 420,
  md: 540,
  lg: 720,
  xl: 920,
  full: 1140,
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
}) => {
  /* Track viewport so the modal can render full-screen on phones
     (≤ sm breakpoint = 640px) and centered card on tablet+desktop. */
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ padding: isMobile ? 0 : 16 }}
        >
          {/* Backdrop — ink with light grain so it reads as the stadium night sky */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
            style={{
              background:
                'oklch(0.13 0.015 250 / 0.78)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          />

          {/* Panel — full-screen on phones, centred card on ≥sm */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="relative w-full stadium-card flex flex-col"
            style={{
              maxWidth: isMobile ? '100%' : SIZE_MAX_WIDTH[size],
              maxHeight: isMobile ? '100vh' : '90vh',
              height: isMobile ? '100vh' : undefined,
              background: 'var(--surface)',
              border: isMobile ? 'none' : '1px solid var(--line)',
              borderRadius: isMobile ? 0 : 12,
              overflow: 'hidden',
              boxShadow: isMobile
                ? 'none'
                : '0 1px 0 rgba(0,0,0,0.04), 0 30px 80px -20px rgba(0,0,0,0.6)',
            }}
          >
            {/* Header */}
            {(title || subtitle) && (
              <div
                className="flex items-start justify-between"
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  {subtitle && (
                    <div className="kicker" style={{ marginBottom: 2 }}>
                      {subtitle}
                    </div>
                  )}
                  {title && (
                    <h2
                      className="display"
                      style={{
                        fontSize: 17,
                        letterSpacing: '-0.02em',
                        margin: 0,
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {title}
                    </h2>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    padding: 6,
                    background: 'transparent',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background .12s ease, color .12s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--surface)';
                    e.currentTarget.style.color = 'var(--text)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-dim)';
                  }}
                >
                  <Icon.Close size={14} />
                </button>
              </div>
            )}

            {/* Content */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 20,
              }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
