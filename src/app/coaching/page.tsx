'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components';
import { COACHING_MODULES, CoachingModule, CoachingLesson } from '@/data/coaching-content';
import { Icon } from '@/components/stadium/Icon';

export default function CoachingArenaPage() {
  const [selectedModule, setSelectedModule] = useState<CoachingModule | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<CoachingLesson | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [showQuizResults, setShowQuizResults] = useState<Record<string, boolean>>({});

  const handleBackToModules = () => {
    setSelectedModule(null);
    setSelectedLesson(null);
    setQuizAnswers({});
    setShowQuizResults({});
  };

  const handleBackToLessons = () => {
    setSelectedLesson(null);
    setQuizAnswers({});
    setShowQuizResults({});
  };

  const handleQuizAnswer = (questionIndex: number, answerIndex: number) => {
    setQuizAnswers((prev) => ({ ...prev, [questionIndex]: answerIndex }));
  };

  const handleCheckAnswer = (questionIndex: number) => {
    setShowQuizResults((prev) => ({ ...prev, [questionIndex]: true }));
  };

  const renderContent = (content: string) => {
    return content.split('\n').map((line, index) => {
      if (line.startsWith('## ')) {
        return (
          <h2
            key={index}
            className="display"
            style={{
              fontSize: 18,
              letterSpacing: '-0.03em',
              color: 'var(--text)',
              marginTop: 22,
              marginBottom: 12,
            }}
          >
            {line.replace('## ', '')}
          </h2>
        );
      }
      if (line.startsWith('### ')) {
        return (
          <h3
            key={index}
            className="display"
            style={{
              fontSize: 15,
              letterSpacing: '-0.02em',
              color: 'var(--text)',
              marginTop: 14,
              marginBottom: 8,
            }}
          >
            {line.replace('### ', '')}
          </h3>
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
      if (line.startsWith('- ')) {
        return (
          <div key={index} className="flex items-start" style={{ gap: 8, marginBottom: 6 }}>
            <span style={{ color: 'var(--pitch)', marginTop: 4 }}>▸</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.55 }}>
              {line.replace('- ', '')}
            </span>
          </div>
        );
      }
      if (line.startsWith('| ')) {
        const cells = line.split('|').filter((cell) => cell.trim());
        if (line.includes('---')) return null;

        return (
          <div key={index} className="flex" style={{ gap: 0, marginBottom: 1 }}>
            {cells.map((cell, cellIndex) => (
              <div
                key={cellIndex}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: cellIndex === 0 ? 'var(--surface-2)' : 'var(--surface)',
                  borderTopLeftRadius: cellIndex === 0 ? 4 : 0,
                  borderBottomLeftRadius: cellIndex === 0 ? 4 : 0,
                  borderTopRightRadius: cellIndex === cells.length - 1 ? 4 : 0,
                  borderBottomRightRadius: cellIndex === cells.length - 1 ? 4 : 0,
                  borderBottom: '1px solid var(--line)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: cellIndex === 0 ? 600 : 400,
                }}
              >
                {cell.trim()}
              </div>
            ))}
          </div>
        );
      }
      if (line.trim() === '') return <div key={index} style={{ height: 8 }} />;
      return (
        <p
          key={index}
          style={{
            color: 'var(--text-dim)',
            marginBottom: 8,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {line}
        </p>
      );
    });
  };

  const totalLessons = COACHING_MODULES.reduce((acc, m) => acc + m.lessons.length, 0);

  return (
    <AppLayout flush>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Page header — only shown on the module list view */}
        {!selectedModule && (
          <div className="flex flex-wrap items-end justify-between" style={{ gap: 14 }}>
            <div>
              <div className="kicker">YOUR LICENSE · TRAINING GROUND</div>
              <h1
                className="display"
                style={{ fontSize: 'clamp(24px, 3vw, 32px)', letterSpacing: '-0.04em', margin: '2px 0 0' }}
              >
                Training
              </h1>
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 6 }}>
                {COACHING_MODULES.length} modules · {totalLessons} drills · Pass enough to unlock your coaching license.
              </div>
            </div>
            <div className="stadium-card flex items-center" style={{ padding: '10px 14px', gap: 14 }}>
              <Icon.Coach size={20} style={{ color: 'var(--pitch)' }} />
              <div>
                <div className="kicker">LICENSE PROGRESS</div>
                <div className="mono num" style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                  0 / {totalLessons} DRILLS
                </div>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Module Selection View */}
          {!selectedModule && (
            <motion.div
              key="modules"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
            >
              {/* Featured drill — the design's signature 2-column card */}
              {COACHING_MODULES.length > 0 && (() => {
                const featured = COACHING_MODULES[0];
                const featuredLessons = featured.lessons.length;
                return (
                  <div
                    className="stadium-card"
                    onClick={() => setSelectedModule(featured)}
                    style={{
                      padding: 0,
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      minHeight: 200,
                      transition: 'border-color .15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--pitch)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; }}
                  >
                    <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div className="kicker">UP NEXT · DRILL 01</div>
                      <div
                        className="display"
                        style={{ fontSize: 22, letterSpacing: '-0.03em', lineHeight: 1.2 }}
                      >
                        {featured.title}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--text-dim)',
                          lineHeight: 1.55,
                          maxWidth: 480,
                        }}
                      >
                        {featured.description}
                      </div>
                      <div className="flex items-center" style={{ gap: 14, marginTop: 8 }}>
                        <button
                          type="button"
                          className="stadium-btn stadium-btn-primary"
                          onClick={(e) => { e.stopPropagation(); setSelectedModule(featured); }}
                        >
                          <Icon.Bolt size={14} /> Start drill · {featuredLessons} lesson{featuredLessons === 1 ? '' : 's'}
                        </button>
                        <div className="kicker" style={{ color: 'var(--whistle)' }}>
                          +{featuredLessons * 100} XP
                        </div>
                      </div>
                    </div>
                    {/* Mini tactics illustration — chalk grid with dot players */}
                    <div
                      style={{
                        position: 'relative',
                        background: 'var(--ink)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 200,
                      }}
                    >
                      <div style={{ position: 'absolute', inset: 16 }}>
                        <div
                          style={{
                            height: '100%',
                            borderRadius: 6,
                            position: 'relative',
                            overflow: 'hidden',
                            background:
                              'repeating-linear-gradient(90deg, oklch(0.42 0.16 145) 0 7.14%, oklch(0.36 0.16 145) 7.14% 14.28%)',
                          }}
                        >
                          {/* chalk lines */}
                          <svg
                            viewBox="0 0 100 140"
                            preserveAspectRatio="none"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                          >
                            <rect x="4" y="4" width="92" height="132" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                            <line x1="4" y1="70" x2="96" y2="70" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                            <circle cx="50" cy="70" r="10" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                            <rect x="22" y="4" width="56" height="18" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                            <rect x="22" y="118" width="56" height="18" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                          </svg>
                          {/* yellow chalkboard markers */}
                          {[
                            [50, 84],
                            [20, 68],
                            [40, 72],
                            [60, 72],
                            [80, 68],
                            [30, 48],
                            [70, 48],
                            [50, 52],
                            [20, 24],
                            [80, 24],
                            [50, 18],
                          ].map(([x, y], i) => (
                            <div
                              key={i}
                              style={{
                                position: 'absolute',
                                left: `${x}%`,
                                top: `${y}%`,
                                transform: 'translate(-50%, -50%)',
                                width: 12,
                                height: 12,
                                background: 'var(--whistle)',
                                borderRadius: 3,
                                border: '1px solid #fff',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* All drills section header */}
              <div
                className="flex items-end justify-between"
                style={{ marginBottom: -4 }}
              >
                <div>
                  <div className="display" style={{ fontSize: 18, letterSpacing: '-0.03em' }}>
                    All Drills
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 2 }}>
                    Coaching curriculum · Season 1
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 14,
                }}
              >
                {COACHING_MODULES.map((module, index) => {
                  const diff = module.difficulty;
                  const pill =
                    diff === 'beginner'
                      ? 'pill-sky'
                      : diff === 'intermediate'
                      ? 'pill-whistle'
                      : 'pill-red';
                  // Progress is 0 by default — coaching content doesn't yet track completion in store
                  const progressPct = 0;
                  const status: 'locked' | 'in-progress' | 'done' =
                    progressPct === 0 ? 'locked' : progressPct === 100 ? 'done' : 'in-progress';
                  return (
                    <div
                      key={module.id}
                      onClick={() => setSelectedModule(module)}
                      className="stadium-card"
                      style={{
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        cursor: 'pointer',
                        transition: 'border-color .15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--pitch)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--line)';
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="kicker">DRILL · {String(index + 1).padStart(2, '0')}</div>
                        <span className={'pill ' + pill}>{diff}</span>
                      </div>
                      <div
                        className="display"
                        style={{ fontSize: 16, letterSpacing: '-0.02em', lineHeight: 1.3 }}
                      >
                        {module.title}
                      </div>
                      <div
                        style={{
                          color: 'var(--text-dim)',
                          fontSize: 12,
                          lineHeight: 1.5,
                        }}
                      >
                        {module.description}
                      </div>
                      {/* Progress bar — the design's signature drill-card footer */}
                      <div
                        style={{
                          height: 4,
                          background: 'var(--surface-2)',
                          borderRadius: 2,
                          overflow: 'hidden',
                          marginTop: 4,
                        }}
                      >
                        <div
                          style={{
                            width: `${progressPct}%`,
                            height: '100%',
                            background:
                              status === 'done'
                                ? 'var(--pitch)'
                                : status === 'in-progress'
                                ? 'var(--whistle)'
                                : 'transparent',
                            transition: 'width .3s ease',
                          }}
                        />
                      </div>
                      <div
                        className="flex items-center justify-between"
                        style={{
                          paddingTop: 10,
                          borderTop: '1px solid var(--line)',
                          marginTop: 'auto',
                        }}
                      >
                        <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.1em' }}>
                          {module.lessons.length} LESSONS
                        </div>
                        <Icon.Arrow size={14} style={{ color: 'var(--pitch)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress Overview */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="stadium-card"
                style={{
                  marginTop: 12,
                  padding: '24px 28px',
                  background: 'var(--pitch-tint)',
                  borderColor: 'oklch(0.72 0.21 145 / 0.3)',
                }}
              >
                <div
                  className="flex flex-wrap items-center justify-between"
                  style={{ gap: 18 }}
                >
                  <div style={{ minWidth: 240, flex: 1 }}>
                    <div className="kicker" style={{ color: 'var(--pitch)' }}>READY TO PASS</div>
                    <div
                      className="display"
                      style={{
                        fontSize: 'clamp(20px, 2.4vw, 26px)',
                        letterSpacing: '-0.03em',
                        margin: '4px 0 6px',
                      }}
                    >
                      Start your coaching license
                    </div>
                    <div
                      style={{
                        color: 'var(--text-dim)',
                        fontSize: 13,
                        lineHeight: 1.55,
                      }}
                    >
                      Begin with the first module if you&apos;re new, or jump to any drill that catches your eye.
                    </div>
                  </div>
                  <div className="flex items-center" style={{ gap: 18 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div
                        className="display num"
                        style={{
                          fontSize: 36,
                          color: 'var(--pitch)',
                          letterSpacing: '-0.05em',
                          lineHeight: 1,
                        }}
                      >
                        {COACHING_MODULES.length}
                      </div>
                      <div className="kicker" style={{ marginTop: 4 }}>MODULES</div>
                    </div>
                    <div style={{ width: 1, height: 40, background: 'var(--line)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <div
                        className="display num"
                        style={{
                          fontSize: 36,
                          color: 'var(--whistle)',
                          letterSpacing: '-0.05em',
                          lineHeight: 1,
                        }}
                      >
                        {COACHING_MODULES.reduce((acc, m) => acc + m.lessons.length, 0)}
                      </div>
                      <div className="kicker" style={{ marginTop: 4 }}>LESSONS</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Lesson Selection View */}
          {selectedModule && !selectedLesson && (
            <motion.div
              key="lessons"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              {/* Back link */}
              <button
                type="button"
                onClick={handleBackToModules}
                className="mono flex items-center"
                style={{
                  gap: 6,
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  width: 'fit-content',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--pitch)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
              >
                <Icon.Arrow size={12} style={{ transform: 'rotate(180deg)' }} /> BACK TO DRILLS
              </button>

              {/* Module header */}
              <div className="stadium-card" style={{ padding: 20 }}>
                <div className="flex items-start" style={{ gap: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      background: 'var(--pitch-tint)',
                      border: '1px solid oklch(0.72 0.21 145 / 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--pitch)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={selectedModule.icon} />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="kicker">DRILL · {selectedModule.difficulty.toUpperCase()}</div>
                    <div className="flex items-center flex-wrap" style={{ gap: 8, marginTop: 4 }}>
                      <div
                        className="display"
                        style={{ fontSize: 'clamp(20px, 2.4vw, 26px)', letterSpacing: '-0.03em' }}
                      >
                        {selectedModule.title}
                      </div>
                      <span
                        className={
                          'pill ' +
                          (selectedModule.difficulty === 'beginner'
                            ? 'pill-sky'
                            : selectedModule.difficulty === 'intermediate'
                            ? 'pill-whistle'
                            : 'pill-red')
                        }
                      >
                        {selectedModule.difficulty}
                      </span>
                    </div>
                    <p
                      style={{
                        color: 'var(--text-dim)',
                        fontSize: 13,
                        marginTop: 6,
                        lineHeight: 1.55,
                      }}
                    >
                      {selectedModule.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Lessons list */}
              <div>
                <div className="flex items-baseline justify-between" style={{ marginBottom: 10 }}>
                  <div>
                    <div className="kicker">LESSONS IN THIS DRILL</div>
                    <div className="display" style={{ fontSize: 16, letterSpacing: '-0.02em', marginTop: 2 }}>
                      Curriculum
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.1em' }}>
                    {selectedModule.lessons.length} LESSONS
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedModule.lessons.map((lesson, index) => (
                    <motion.button
                      key={lesson.id}
                      type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedLesson(lesson)}
                      className="stadium-card"
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: 'inherit',
                        transition: 'border-color .15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--pitch)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--line)';
                      }}
                    >
                      <div
                        className="display num"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          background: 'var(--surface-2)',
                          border: '1px solid var(--line)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          letterSpacing: '-0.02em',
                          color: 'var(--text-dim)',
                          flexShrink: 0,
                        }}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          className="display"
                          style={{
                            fontSize: 14,
                            letterSpacing: '-0.01em',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {lesson.title}
                        </div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 2, letterSpacing: '0.04em' }}>
                          {lesson.keyPoints?.length || 0} KEY POINTS
                          {lesson.quiz && ` · ${lesson.quiz.length} QUIZ Q${lesson.quiz.length > 1 ? 'S' : ''}`}
                        </div>
                      </div>
                      <Icon.Arrow size={14} style={{ color: 'var(--pitch)', flexShrink: 0 }} />
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Lesson Content View */}
          {selectedModule && selectedLesson && (
            <motion.div
              key="lesson-content"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              {/* Back link */}
              <button
                type="button"
                onClick={handleBackToLessons}
                className="mono flex items-center"
                style={{
                  gap: 6,
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  width: 'fit-content',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--pitch)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
              >
                <Icon.Arrow size={12} style={{ transform: 'rotate(180deg)' }} /> BACK TO {selectedModule.title.toUpperCase()}
              </button>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
                  gap: 16,
                  alignItems: 'start',
                }}
              >
                {/* Main content column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Lesson body */}
                  <div className="stadium-card" style={{ padding: 24 }}>
                    <div className="kicker">LESSON</div>
                    <h1
                      className="display"
                      style={{
                        fontSize: 'clamp(20px, 2.4vw, 26px)',
                        letterSpacing: '-0.03em',
                        margin: '4px 0 18px',
                      }}
                    >
                      {selectedLesson.title}
                    </h1>
                    <div>{renderContent(selectedLesson.content)}</div>
                  </div>

                  {/* Quiz */}
                  {selectedLesson.quiz && selectedLesson.quiz.length > 0 && (
                    <div className="stadium-card" style={{ padding: 24 }}>
                      <div className="flex items-center" style={{ gap: 10, marginBottom: 18 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: 'var(--pitch-tint)',
                            border: '1px solid oklch(0.72 0.21 145 / 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon.Target size={16} style={{ color: 'var(--pitch)' }} />
                        </div>
                        <div>
                          <div className="kicker">QUIZ · {selectedLesson.quiz.length} QUESTION{selectedLesson.quiz.length > 1 ? 'S' : ''}</div>
                          <div className="display" style={{ fontSize: 16, letterSpacing: '-0.02em', marginTop: 1 }}>
                            Test your knowledge
                          </div>
                        </div>
                      </div>

                      {selectedLesson.quiz.map((question, qIndex) => (
                        <div
                          key={qIndex}
                          style={{
                            marginBottom: qIndex === selectedLesson.quiz!.length - 1 ? 0 : 22,
                            paddingBottom: qIndex === selectedLesson.quiz!.length - 1 ? 0 : 22,
                            borderBottom: qIndex === selectedLesson.quiz!.length - 1 ? 'none' : '1px solid var(--line)',
                          }}
                        >
                          <div className="kicker" style={{ marginBottom: 6 }}>QUESTION {qIndex + 1}</div>
                          <p
                            className="display"
                            style={{
                              fontSize: 15,
                              letterSpacing: '-0.01em',
                              margin: '0 0 14px',
                              lineHeight: 1.4,
                            }}
                          >
                            {question.question}
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                            {question.options.map((option, oIndex) => {
                              const isSelected = quizAnswers[qIndex] === oIndex;
                              const showResult = showQuizResults[qIndex];
                              const isCorrect = oIndex === question.correctIndex;

                              let bg = 'var(--surface-2)';
                              let border = 'var(--line)';
                              let opacity = 1;
                              let dotBg = 'transparent';
                              let dotBorder = 'var(--line-2)';
                              let dotIcon: 'check' | 'close' | null = null;
                              let textColor = 'var(--text)';

                              if (!showResult && isSelected) {
                                bg = 'var(--pitch-tint)';
                                border = 'var(--pitch)';
                                dotBg = 'var(--pitch)';
                                dotBorder = 'var(--pitch-deep)';
                              } else if (showResult && isCorrect) {
                                bg = 'var(--pitch-tint)';
                                border = 'oklch(0.72 0.21 145 / 0.4)';
                                dotBg = 'var(--pitch)';
                                dotBorder = 'var(--pitch-deep)';
                                dotIcon = 'check';
                                textColor = 'var(--pitch)';
                              } else if (showResult && isSelected && !isCorrect) {
                                bg = 'oklch(0.65 0.22 25 / 0.08)';
                                border = 'oklch(0.65 0.22 25 / 0.4)';
                                dotBg = 'var(--ref-red)';
                                dotBorder = 'var(--ref-red)';
                                dotIcon = 'close';
                                textColor = 'var(--ref-red)';
                              } else if (showResult && !isCorrect) {
                                opacity = 0.5;
                              }

                              return (
                                <button
                                  key={oIndex}
                                  type="button"
                                  onClick={() => !showResult && handleQuizAnswer(qIndex, oIndex)}
                                  disabled={showResult}
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '12px 14px',
                                    background: bg,
                                    border: '1px solid ' + border,
                                    borderRadius: 8,
                                    opacity,
                                    cursor: showResult ? 'default' : 'pointer',
                                    transition: 'background .12s, border-color .12s',
                                    color: 'inherit',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!showResult && !isSelected) {
                                      e.currentTarget.style.borderColor = 'var(--line-2)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!showResult && !isSelected) {
                                      e.currentTarget.style.borderColor = 'var(--line)';
                                    }
                                  }}
                                >
                                  <div className="flex items-center" style={{ gap: 12 }}>
                                    <div
                                      style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: '50%',
                                        background: dotBg,
                                        border: '2px solid ' + dotBorder,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                      }}
                                    >
                                      {dotIcon === 'check' && (
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="oklch(0.14 0.05 145)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                      {dotIcon === 'close' && (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M6 6 L18 18 M18 6 L6 18" />
                                        </svg>
                                      )}
                                    </div>
                                    <span
                                      style={{
                                        color: textColor,
                                        fontSize: 13,
                                        lineHeight: 1.45,
                                      }}
                                    >
                                      {option}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {!showQuizResults[qIndex] && quizAnswers[qIndex] !== undefined && (
                            <button
                              type="button"
                              onClick={() => handleCheckAnswer(qIndex)}
                              className="stadium-btn stadium-btn-primary"
                              style={{ padding: '8px 16px', fontSize: 12 }}
                            >
                              <Icon.Whistle size={12} /> Check answer
                            </button>
                          )}

                          {showQuizResults[qIndex] && (() => {
                            const correct = quizAnswers[qIndex] === question.correctIndex;
                            return (
                              <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="stadium-card"
                                style={{
                                  padding: 14,
                                  background: correct
                                    ? 'var(--pitch-tint)'
                                    : 'oklch(0.83 0.18 90 / 0.1)',
                                  borderColor: correct
                                    ? 'oklch(0.72 0.21 145 / 0.3)'
                                    : 'oklch(0.83 0.18 90 / 0.4)',
                                }}
                              >
                                <div
                                  className="display"
                                  style={{
                                    fontSize: 13,
                                    letterSpacing: '-0.01em',
                                    color: correct ? 'var(--pitch)' : 'var(--whistle)',
                                    marginBottom: 4,
                                  }}
                                >
                                  {correct ? '✓ Correct!' : '⚠ Not quite'}
                                </div>
                                <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: 0, lineHeight: 1.55 }}>
                                  {question.explanation}
                                </p>
                              </motion.div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Side rail */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 80 }}>
                  {/* Key takeaways */}
                  {selectedLesson.keyPoints && selectedLesson.keyPoints.length > 0 && (
                    <div
                      className="stadium-card"
                      style={{
                        padding: 18,
                        background: 'var(--pitch-tint)',
                        borderColor: 'oklch(0.72 0.21 145 / 0.3)',
                      }}
                    >
                      <div className="flex items-center" style={{ gap: 8, marginBottom: 12 }}>
                        <Icon.Whistle size={14} style={{ color: 'var(--pitch)' }} />
                        <div className="kicker" style={{ color: 'var(--pitch)' }}>
                          COACH&apos;S TAKEAWAYS
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {selectedLesson.keyPoints.map((point, index) => (
                          <div key={index} className="flex items-start" style={{ gap: 8 }}>
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 4,
                                background: 'var(--pitch)',
                                color: 'oklch(0.14 0.05 145)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                fontFamily: 'var(--font-mono)',
                                fontSize: 9,
                                fontWeight: 700,
                                marginTop: 1,
                              }}
                            >
                              {String(index + 1).padStart(2, '0')}
                            </div>
                            <span style={{ color: 'var(--text)', fontSize: 12, lineHeight: 1.5 }}>
                              {point}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lesson nav */}
                  <div className="stadium-card" style={{ padding: 14 }}>
                    <div className="kicker" style={{ marginBottom: 8 }}>IN THIS DRILL</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {selectedModule.lessons.map((lesson, index) => {
                        const isActive = selectedLesson.id === lesson.id;
                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={() => {
                              setSelectedLesson(lesson);
                              setQuizAnswers({});
                              setShowQuizResults({});
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 10px',
                              borderRadius: 6,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              background: isActive ? 'var(--pitch-tint)' : 'transparent',
                              border: '1px solid ' + (isActive ? 'oklch(0.72 0.21 145 / 0.3)' : 'transparent'),
                              color: isActive ? 'var(--text)' : 'var(--text-dim)',
                              fontFamily: 'var(--font-display)',
                              fontSize: 12,
                              fontWeight: isActive ? 600 : 500,
                              cursor: 'pointer',
                              transition: 'background .12s, color .12s',
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.background = 'var(--surface-2)';
                                e.currentTarget.style.color = 'var(--text)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-dim)';
                              }
                            }}
                          >
                            <span
                              className="mono num"
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 3,
                                background: isActive ? 'var(--pitch)' : 'var(--surface-2)',
                                color: isActive ? 'oklch(0.14 0.05 145)' : 'var(--text-dim)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 9,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {index + 1}
                            </span>
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {lesson.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA Section */}
        {!selectedModule && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="stadium-card"
            style={{
              marginTop: 4,
              padding: 24,
              textAlign: 'center',
            }}
          >
            <div className="kicker">READY FOR MORE</div>
            <h3
              className="display"
              style={{
                fontSize: 'clamp(18px, 2.2vw, 22px)',
                letterSpacing: '-0.03em',
                margin: '6px 0 6px',
              }}
            >
              Know the basics already?
            </h3>
            <p
              style={{
                color: 'var(--text-dim)',
                fontSize: 13,
                margin: '0 auto 18px',
                maxWidth: 520,
                lineHeight: 1.55,
              }}
            >
              Head to the Academy for more advanced content, or jump straight onto the pitch and field a squad.
            </p>
            <div className="flex flex-wrap items-center justify-center" style={{ gap: 10 }}>
              <Link
                href="/learn"
                className="stadium-btn stadium-btn-ghost"
                style={{ textDecoration: 'none' }}
              >
                <Icon.Guide size={14} /> Academy
              </Link>
              <Link
                href="/portfolio"
                className="stadium-btn stadium-btn-primary"
                style={{ textDecoration: 'none' }}
              >
                <Icon.Pitch size={14} /> Field a squad
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
