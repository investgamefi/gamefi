'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { ONBOARDING_STEPS } from '@/types';
import { Icon } from '@/components/stadium/Icon';

interface OnboardingProps {
  onComplete?: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { currentUser } = useStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (currentUser && !hasChecked) {
      checkOnboardingStatus();
    }
  }, [currentUser, hasChecked]);

  const checkOnboardingStatus = async () => {
    if (!currentUser) return;
    setHasChecked(true);

    try {
      const completed = localStorage.getItem(`onboarding_${currentUser.id}`);
      if (completed) return;

      const res = await fetch(`/api/onboarding?userId=${currentUser.id}`);
      const data = await res.json();
      if (data.success && !data.hasCompleted) {
        setCurrentStep(data.currentStep || 0);
        setIsVisible(true);
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
    }
  };

  const completeStep = async () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await finishOnboarding();
    }
  };

  const skipOnboarding = async () => {
    await finishOnboarding(true);
  };

  const finishOnboarding = async (skipped = false) => {
    if (!currentUser) return;
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          completed: !skipped,
          skipped,
        }),
      });
      localStorage.setItem(`onboarding_${currentUser.id}`, 'true');
    } catch (error) {
      console.error('Failed to save onboarding status:', error);
    }
    setIsVisible(false);
    onComplete?.();
  };

  if (!isVisible) return null;

  const step = ONBOARDING_STEPS[currentStep];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0"
          style={{
            background: 'oklch(0.13 0.015 250 / 0.78)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        />

        {/* Spotlight effect on the targeted element */}
        {step.target && (
          <style jsx global>{`
            [data-tour="${step.target.replace('[data-tour="', '').replace('"]', '')}"] {
              position: relative;
              z-index: 51;
              box-shadow: 0 0 0 3px oklch(0.72 0.21 145 / 0.5);
              border-radius: 8px;
            }
          `}</style>
        )}

        {/* Tooltip */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          className="stadium-card"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            maxWidth: 440,
            padding: 24,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            boxShadow:
              '0 1px 0 rgba(0,0,0,0.04), 0 30px 80px -20px rgba(0,0,0,0.6)',
          }}
        >
          {/* Progress strip */}
          <div className="flex" style={{ gap: 4, marginBottom: 18 }}>
            {ONBOARDING_STEPS.map((_, index) => (
              <div
                key={index}
                style={{
                  height: 3,
                  flex: 1,
                  borderRadius: 2,
                  background: index <= currentStep ? 'var(--pitch)' : 'var(--surface-2)',
                  transition: 'background .3s ease',
                }}
              />
            ))}
          </div>

          {/* Welcome icon on first step */}
          {currentStep === 0 && (
            <div
              style={{
                width: 64,
                height: 64,
                margin: '0 auto 14px',
                borderRadius: 12,
                background: 'var(--pitch-tint)',
                border: '1px solid oklch(0.72 0.21 145 / 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon.Pitch size={32} style={{ color: 'var(--pitch)' }} />
            </div>
          )}

          <div className="kicker" style={{ textAlign: 'center' }}>
            STEP {String(currentStep + 1).padStart(2, '0')} / {String(ONBOARDING_STEPS.length).padStart(2, '0')}
          </div>
          <h3
            className="display"
            style={{
              fontSize: 'clamp(20px, 2.4vw, 26px)',
              letterSpacing: '-0.03em',
              textAlign: 'center',
              margin: '4px 0 8px',
            }}
          >
            {step.title}
          </h3>
          <p
            style={{
              color: 'var(--text-dim)',
              fontSize: 13,
              lineHeight: 1.55,
              textAlign: 'center',
              margin: '0 0 22px',
            }}
          >
            {step.description}
          </p>

          {/* Navigation */}
          <div className="flex" style={{ gap: 10 }}>
            <button
              type="button"
              onClick={skipOnboarding}
              className="stadium-btn stadium-btn-ghost"
              style={{
                flex: 1,
                justifyContent: 'center',
                padding: '10px 14px',
                fontSize: 12,
              }}
            >
              Skip tour
            </button>
            <button
              type="button"
              onClick={completeStep}
              className="stadium-btn stadium-btn-primary"
              style={{
                flex: 1.4,
                justifyContent: 'center',
                padding: '10px 14px',
                fontSize: 12,
              }}
            >
              {currentStep < ONBOARDING_STEPS.length - 1 ? (
                <>
                  Next <Icon.Arrow size={12} />
                </>
              ) : (
                <>
                  <Icon.Whistle size={12} /> Kick off
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// API route stub kept for compatibility
export const onboardingApiHandler = {
  GET: async (_userId: string) => {
    /* implemented in /api/onboarding */
  },
  POST: async (_data: { userId: string; completed: boolean; skipped: boolean }) => {
    /* implemented in /api/onboarding */
  },
};
