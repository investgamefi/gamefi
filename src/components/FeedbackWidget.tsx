'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { Icon } from '@/components/stadium/Icon';

type FeedbackType = 'bug' | 'feature' | 'general';

interface FeedbackWidgetProps {
  position?: 'bottom-right' | 'bottom-left';
}

const TYPE_OPTIONS: { value: FeedbackType; label: string; icon: 'Close' | 'Bolt' | 'Bell' }[] = [
  { value: 'bug', label: 'Bug', icon: 'Close' },
  { value: 'feature', label: 'Feature', icon: 'Bolt' },
  { value: 'general', label: 'General', icon: 'Bell' },
];

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ position = 'bottom-right' }) => {
  const { currentUser } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: feedbackType,
          message,
          email: email || currentUser?.email,
          userId: currentUser?.id,
          username: currentUser?.username,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      });

      setIsSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsSubmitted(false);
        setMessage('');
        setFeedbackType('general');
      }, 2000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const positionStyle: React.CSSProperties =
    position === 'bottom-right' ? { right: 16 } : { left: 16 };

  return (
    <>
      {/* Floating button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => setIsOpen(true)}
        type="button"
        title="Send feedback"
        style={{
          position: 'fixed',
          bottom: 16,
          zIndex: 40,
          width: 48,
          height: 48,
          background: 'var(--pitch)',
          color: 'oklch(0.14 0.05 145)',
          border: '1px solid var(--pitch-deep)',
          borderRadius: 12,
          display: isOpen ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 10px 30px -10px oklch(0.72 0.21 145 / 0.6)',
          ...positionStyle,
        }}
      >
        <Icon.Whistle size={22} />
      </motion.button>

      {/* Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="stadium-card"
            style={{
              position: 'fixed',
              bottom: 16,
              zIndex: 50,
              width: 340,
              maxWidth: 'calc(100vw - 32px)',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow:
                '0 1px 0 rgba(0,0,0,0.04), 0 30px 80px -20px rgba(0,0,0,0.6)',
              ...positionStyle,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between"
              style={{
                padding: '12px 16px',
                background: 'var(--surface-2)',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <div>
                <div className="kicker">FEEDBACK</div>
                <div className="display" style={{ fontSize: 14, letterSpacing: '-0.02em', marginTop: 1 }}>
                  Send feedback
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                style={{
                  padding: 6,
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Icon.Close size={14} />
              </button>
            </div>

            {isSubmitted ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    margin: '0 auto 12px',
                    borderRadius: 10,
                    background: 'var(--pitch-tint)',
                    border: '1px solid oklch(0.72 0.21 145 / 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--pitch)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="display" style={{ fontSize: 14, letterSpacing: '-0.01em' }}>
                  Thank you!
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>
                  Your feedback helps us improve.
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {/* Type */}
                <div className="flex" style={{ gap: 4 }}>
                  {TYPE_OPTIONS.map((opt) => {
                    const IconCmp = Icon[opt.icon];
                    const isActive = feedbackType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFeedbackType(opt.value)}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          background: isActive ? 'var(--pitch-tint)' : 'var(--surface-2)',
                          border: '1px solid ' + (isActive ? 'var(--pitch)' : 'var(--line)'),
                          borderRadius: 6,
                          color: isActive ? 'var(--pitch)' : 'var(--text-dim)',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-display)',
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '0.02em',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                        }}
                      >
                        <IconCmp size={11} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Message */}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    feedbackType === 'bug'
                      ? 'Describe the bug you spotted…'
                      : feedbackType === 'feature'
                      ? 'What feature would you like to see?'
                      : 'Share your thoughts with us…'
                  }
                  rows={4}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    resize: 'vertical',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--pitch)';
                    e.currentTarget.style.background = 'var(--surface)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--line)';
                    e.currentTarget.style.background = 'var(--surface-2)';
                  }}
                />

                {!currentUser && (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email (optional, for follow-up)"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      color: 'var(--text)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      outline: 'none',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--pitch)';
                      e.currentTarget.style.background = 'var(--surface)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--line)';
                      e.currentTarget.style.background = 'var(--surface-2)';
                    }}
                  />
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !message.trim()}
                  className="stadium-btn stadium-btn-primary"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '10px 14px',
                    fontSize: 12,
                  }}
                >
                  {isSubmitting ? (
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
                      Sending…
                    </>
                  ) : (
                    'Send feedback'
                  )}
                </button>

                <p
                  className="mono"
                  style={{
                    textAlign: 'center',
                    fontSize: 9,
                    color: 'var(--text-mute)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    margin: 0,
                  }}
                >
                  We read every piece of feedback
                </p>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
