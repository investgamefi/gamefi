'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components';
import { LEARNING_SECTIONS, ASSET_TYPE_TOPICS, RISK_LEVEL_COLORS } from '@/data/learning-content';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/stadium/Icon';

export default function LearnPage() {
  const [activeSection, setActiveSection] = useState('asset-types');
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  const currentSection = LEARNING_SECTIONS.find((s) => s.id === activeSection);

  return (
    <AppLayout flush>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Header */}
        <div>
          <div className="kicker">COACHING CURRICULUM · ALL LEVELS</div>
          <h1
            className="display"
            style={{ fontSize: 'clamp(24px, 3vw, 32px)', letterSpacing: '-0.04em', margin: '2px 0 0' }}
          >
            Learning Center
          </h1>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 6 }}>
            Master the fundamentals. Build a winning portfolio using the Gamefi approach.
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {LEARNING_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className="mono"
              style={{
                padding: '8px 14px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: activeSection === section.id ? 'var(--pitch)' : 'var(--surface)',
                color: activeSection === section.id ? 'oklch(0.14 0.05 145)' : 'var(--text-dim)',
                border:
                  '1px solid ' +
                  (activeSection === section.id ? 'var(--pitch-deep)' : 'var(--line)'),
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {section.title}
            </button>
          ))}
        </div>

        {/* Section Content */}
        {currentSection && (
          <motion.div
            key={currentSection.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Section Header */}
            <div>
              <div className="display" style={{ fontSize: 20, letterSpacing: '-0.03em' }}>
                {currentSection.title}
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 2 }}>
                {currentSection.description}
              </div>
            </div>

            {/* Asset Types Grid — stadium-styled */}
            {currentSection.topics && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 14,
                }}
              >
                {currentSection.topics.map((topic) => {
                  const isOpen = expandedTopic === topic.type;
                  const riskPill =
                    topic.risk.includes('Low')
                      ? 'pill-sky'
                      : topic.risk.includes('High')
                      ? 'pill-red'
                      : 'pill-whistle';
                  const positionLabel =
                    topic.risk.includes('Low') ? 'DEF' : topic.risk.includes('High') ? 'ATK' : 'MID';
                  return (
                    <motion.div
                      key={topic.type}
                      layout
                      className="stadium-card"
                      style={{
                        padding: 16,
                        cursor: 'pointer',
                        transition: 'border-color .15s ease',
                        gridColumn: isOpen ? '1 / -1' : undefined,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                      onClick={() => setExpandedTopic(isOpen ? null : topic.type)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--pitch)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--line)';
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="kicker">{topic.type.toUpperCase()}</div>
                          <div
                            className="display"
                            style={{
                              fontSize: 16,
                              letterSpacing: '-0.02em',
                              lineHeight: 1.3,
                              marginTop: 4,
                            }}
                          >
                            {topic.title}
                          </div>
                        </div>
                        <span className={'pill ' + riskPill}>{positionLabel}</span>
                      </div>

                      <div
                        style={{
                          color: 'var(--text-dim)',
                          fontSize: 12,
                          lineHeight: 1.55,
                        }}
                      >
                        {topic.description}
                      </div>

                      {/* Risk / volatility row */}
                      <div
                        className="flex"
                        style={{
                          gap: 16,
                          paddingTop: 10,
                          borderTop: '1px solid var(--line)',
                        }}
                      >
                        <div>
                          <div className="kicker">RISK</div>
                          <div
                            className="mono num"
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              marginTop: 2,
                              color:
                                topic.risk.includes('Low')
                                  ? 'var(--pitch)'
                                  : topic.risk.includes('High')
                                  ? 'var(--ref-red)'
                                  : 'var(--whistle)',
                            }}
                          >
                            {topic.risk.toUpperCase()}
                          </div>
                        </div>
                        <div>
                          <div className="kicker">VOLATILITY</div>
                          <div
                            className="mono num"
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              marginTop: 2,
                              color:
                                topic.volatility === 'Low'
                                  ? 'var(--pitch)'
                                  : topic.volatility === 'High' || topic.volatility === 'Very High'
                                  ? 'var(--ref-red)'
                                  : 'var(--whistle)',
                            }}
                          >
                            {topic.volatility.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          style={{
                            borderTop: '1px solid var(--line)',
                            paddingTop: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                          }}
                        >
                          <div>
                            <div className="kicker">BEST FOR</div>
                            <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 4, lineHeight: 1.5 }}>
                              {topic.bestFor}
                            </div>
                          </div>
                          <div>
                            <div className="kicker" style={{ marginBottom: 6 }}>EXAMPLES</div>
                            <div className="flex flex-wrap" style={{ gap: 6 }}>
                              {topic.examples.map((example) => (
                                <span
                                  key={example}
                                  className="pill"
                                  style={{ padding: '2px 8px', fontSize: 10 }}
                                >
                                  {example}
                                </span>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}

                      <div
                        className="flex items-center justify-end"
                        style={{
                          marginTop: 'auto',
                          color: 'var(--pitch)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          gap: 4,
                        }}
                      >
                        {isOpen ? 'COLLAPSE' : 'EXPAND'}
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
                        >
                          <path d="M6 9 L12 15 L18 9" />
                        </svg>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Markdown Content */}
            {currentSection.content && (
              <div className="stadium-card" style={{ padding: 24 }}>
                <div>
                  {currentSection.content.split('\n').map((line, index) => {
                    if (line.startsWith('## ')) {
                      return (
                        <h2
                          key={index}
                          className="display"
                          style={{
                            fontSize: 18,
                            letterSpacing: '-0.03em',
                            color: 'var(--text)',
                            marginTop: 18,
                            marginBottom: 10,
                          }}
                        >
                          {line.replace('## ', '')}
                        </h2>
                      );
                    }
                    if (line.startsWith('- **')) {
                      const match = line.match(/- \*\*(.+?)\*\*: (.+)/);
                      if (match) {
                        return (
                          <div key={index} className="flex items-start" style={{ gap: 8, marginBottom: 8 }}>
                            <span style={{ color: 'var(--pitch)', marginTop: 4 }}>▸</span>
                            <span style={{ fontSize: 13, lineHeight: 1.55 }}>
                              <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                                {match[1]}
                              </strong>
                              <span style={{ color: 'var(--text-dim)' }}>: {match[2]}</span>
                            </span>
                          </div>
                        );
                      }
                    }
                    if (line.trim() === '') return <div key={index} style={{ height: 8 }} />;
                    return (
                      <p
                        key={index}
                        style={{
                          color: 'var(--text-dim)',
                          marginBottom: 6,
                          fontSize: 13,
                          lineHeight: 1.55,
                        }}
                      >
                        {line}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tips Checklist — stadium-styled */}
            {currentSection.tips && (
              <div className="stadium-card" style={{ padding: 20 }}>
                <div className="flex items-center" style={{ gap: 10, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'var(--pitch-tint)',
                      border: '1px solid oklch(0.72 0.21 145 / 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pitch)" strokeWidth="2.5">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <div className="display" style={{ fontSize: 16, letterSpacing: '-0.02em' }}>
                      Coach's Notes
                    </div>
                    <div className="kicker">CHECKLIST · {currentSection.tips.length} TIPS</div>
                  </div>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 10,
                  }}
                >
                  {currentSection.tips.map((tip, index) => (
                    <div
                      key={index}
                      className="flex items-start"
                      style={{
                        gap: 10,
                        padding: 12,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          background: 'var(--pitch)',
                          color: 'oklch(0.14 0.05 145)',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          fontWeight: 700,
                          marginTop: 1,
                        }}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                        {tip}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Final CTA — stadium aesthetic */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="stadium-card"
          style={{
            padding: '32px 28px',
            textAlign: 'center',
            background: 'var(--pitch-tint)',
            borderColor: 'oklch(0.72 0.21 145 / 0.3)',
            marginTop: 4,
          }}
        >
          <div className="kicker" style={{ color: 'var(--pitch)' }}>READY TO PLAY</div>
          <h3
            className="display"
            style={{ fontSize: 'clamp(20px, 2.4vw, 26px)', letterSpacing: '-0.03em', margin: '8px 0 6px' }}
          >
            Field your first XI.
          </h3>
          <p
            style={{
              color: 'var(--text-dim)',
              fontSize: 13,
              maxWidth: 480,
              margin: '0 auto 18px',
              lineHeight: 1.55,
            }}
          >
            Put what you just learned into practice. Pick a formation, sign eleven tickers, captain your top pick.
          </p>
          <Link href="/portfolio" className="stadium-btn stadium-btn-primary" style={{ textDecoration: 'none' }}>
            <Icon.Pitch size={14} /> Field a new squad
          </Link>
        </motion.div>
      </div>
    </AppLayout>
  );
}
