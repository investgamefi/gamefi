'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components';
import { Icon } from '@/components/stadium/Icon';

type Zone = { code: string; pillClass: string; label: string; body: string };
type Chapter = {
  id: string;
  number: string;
  title: string;
  minutes: number;
  intro: React.ReactNode;
  body: React.ReactNode;
};

/* ============================================================
   Inline helpers used in chapter content
   ============================================================ */
const SubHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="display"
    style={{
      fontSize: 16,
      color: 'var(--text)',
      letterSpacing: '-0.02em',
      marginTop: 22,
      marginBottom: 12,
    }}
  >
    {children}
  </div>
);

const Para: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.65, margin: '0 0 12px' }}>
    {children}
  </p>
);

const Em: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <em style={{ color: 'var(--text)', fontStyle: 'italic' }}>{children}</em>
);

const CoachTip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="stadium-card"
    style={{
      padding: 16,
      marginTop: 18,
      background: 'var(--pitch-tint)',
      borderColor: 'oklch(0.72 0.21 145 / 0.3)',
    }}
  >
    <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
      <Icon.Whistle size={14} style={{ color: 'var(--pitch)' }} />
      <div className="display" style={{ fontSize: 14, color: 'var(--pitch)' }}>
        Coach&apos;s tip
      </div>
    </div>
    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{children}</div>
  </div>
);

const ZoneGrid: React.FC<{ zones: Zone[] }> = ({ zones }) => (
  <div
    className="stadium-card"
    style={{
      padding: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    {zones.map((z, i) => (
      <div
        key={z.code}
        style={{
          display: 'grid',
          gridTemplateColumns: '60px 110px 1fr',
          gap: 14,
          padding: '14px 16px',
          alignItems: 'center',
          borderTop: i === 0 ? 'none' : '1px solid var(--line)',
        }}
      >
        <span className={z.pillClass} style={{ padding: '3px 8px', justifySelf: 'start' }}>
          {z.code}
        </span>
        <div className="display" style={{ fontSize: 14, letterSpacing: '-0.01em' }}>
          {z.label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>{z.body}</div>
      </div>
    ))}
  </div>
);

const Numbered: React.FC<{ items: { title: string; body: React.ReactNode }[] }> = ({ items }) => (
  <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
    {items.map((it, i) => (
      <li key={i} className="flex items-start" style={{ gap: 12 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            background: 'var(--pitch)',
            color: 'oklch(0.14 0.05 145)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 700,
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          {String(i + 1).padStart(2, '0')}
        </div>
        <div>
          <div className="display" style={{ fontSize: 14, letterSpacing: '-0.01em', marginBottom: 2 }}>
            {it.title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>{it.body}</div>
        </div>
      </li>
    ))}
  </ol>
);

/* ============================================================
   Chapter content — 8 chapters mirroring the design
   ============================================================ */
const CHAPTERS: Chapter[] = [
  {
    id: 'metaphor',
    number: '01',
    title: 'The metaphor in 60 seconds',
    minutes: 1,
    intro:
      'Every stock is a player. Every portfolio is a squad. The position you put a ticker in tells the system how risky that pick is. The market is your match clock.',
    body: (
      <>
        <SubHead>Three things to remember</SubHead>
        <Numbered
          items={[
            {
              title: 'Pitch = portfolio',
              body: 'Eleven slots, four risk zones, one allocation. The chalk lines are real risk boundaries, not just decoration.',
            },
            {
              title: 'Position = risk',
              body: <>GK and Defenders are <Em>defensive</Em>. Midfielders are balanced. Attackers carry the volatility.</>,
            },
            {
              title: 'Market = clock',
              body: 'Fixtures kick off at the open and settle at the close (or whenever the timeframe ends). No overtime.',
            },
          ]}
        />
        <CoachTip>
          You don&apos;t need to know finance jargon to play. If you&apos;ve managed a fantasy soccer team, you already know 80% of this — the rest is just learning what each <Em>position</Em> represents.
        </CoachTip>
      </>
    ),
  },
  {
    id: 'formation',
    number: '02',
    title: 'Pick a formation',
    minutes: 3,
    intro:
      'A formation is just your strategic shape. It determines how many defenders, midfielders, and attackers you field — which in turn shapes your overall risk profile.',
    body: (
      <>
        <SubHead>The three starting formations</SubHead>
        <ZoneGrid
          zones={[
            {
              code: '4-3-3',
              pillClass: 'pill pill-pitch',
              label: 'Attack',
              body: '4 DEF · 3 MID · 3 ATK. Three attackers means more growth exposure — your portfolio will swing harder.',
            },
            {
              code: '4-4-2',
              pillClass: 'pill',
              label: 'Balance',
              body: '4 DEF · 4 MID · 2 ATK. The classic balanced shape. Lowest variance, steadiest climbs.',
            },
            {
              code: '3-5-2',
              pillClass: 'pill pill-whistle',
              label: 'Risk-on',
              body: '3 DEF · 5 MID · 2 ATK. Lean defence, heavy midfield. Best when you have conviction on broad-market exposure.',
            },
          ]}
        />
        <SubHead>How to choose</SubHead>
        <Para>
          If you don&apos;t know which formation fits your view of the market, default to <Em>4-3-3</Em> — it&apos;s the most common starter and the easiest to rebalance later.
        </Para>
        <CoachTip>
          You can change formations at any time, but doing so resets a few position assignments. Pick the shape that fits your conviction <Em>before</Em> you sign your XI.
        </CoachTip>
      </>
    ),
  },
  {
    id: 'lineup',
    number: '03',
    title: 'Fill the lineup',
    minutes: 4,
    intro: (
      <>
        Your lineup is eleven tickers, arranged from goalkeeper to striker. The position you put a ticker in <Em>tells the system how aggressive that pick is</Em>.
      </>
    ),
    body: (
      <>
        <SubHead>The four zones</SubHead>
        <ZoneGrid
          zones={[
            {
              code: 'GK',
              pillClass: 'pill pill-sky',
              label: 'GOAL',
              body: 'Lowest volatility. Defensive utilities, consumer staples.',
            },
            {
              code: 'DEF',
              pillClass: 'pill pill-sky',
              label: 'DEFENSE',
              body: 'Low volatility. Dividend payers, blue chips.',
            },
            {
              code: 'MID',
              pillClass: 'pill pill-whistle',
              label: 'MIDFIELD',
              body: 'Medium volatility. Established growth, balanced funds.',
            },
            {
              code: 'ATK',
              pillClass: 'pill pill-red',
              label: 'ATTACK',
              body: 'High volatility. Mega-cap growth, momentum, crypto.',
            },
          ]}
        />
        <SubHead>Weight matters as much as position</SubHead>
        <Para>
          Default weight is <Em>9.1%</Em> per player (100% ÷ 11). The pitch view shows over-weighted players slightly higher on the field; under-weighted players sit lower. This is just visual — the actual allocation is in the roster table.
        </Para>
        <CoachTip>
          If you&apos;re new, try the <Em>&ldquo;Counter Press&rdquo;</Em> template. It&apos;s a sensible 4-3-3 with diversified midfield — a soft landing while you learn the rest of the playbook.
        </CoachTip>
      </>
    ),
  },
  {
    id: 'captain',
    number: '04',
    title: 'Captain & half-time',
    minutes: 3,
    intro:
      'Your captain wears the armband and earns 2× XP for the fixture. Half-time is the only window where you can swap who wears it without restarting the fixture.',
    body: (
      <>
        <SubHead>Who to captain</SubHead>
        <Numbered
          items={[
            { title: 'Highest conviction', body: 'Pick your most aggressive ticker. Captain rewards conviction, not safety.' },
            { title: 'Liquidity matters', body: 'Captain a thinly-traded micro-cap and any volatility shock will erase your match score.' },
            { title: 'Avoid the bench', body: 'You can&apos;t captain a position you haven&apos;t filled. Sign the player before you hand them the armband.' },
          ]}
        />
        <SubHead>Half-time tactics</SubHead>
        <Para>
          During a long-form fixture (1M or 3M), you get one half-time window — at the midpoint of the timeframe. Use it to swap the captain or rebalance one position. No more than that.
        </Para>
        <CoachTip>
          Captaining a defender feels safe but caps your upside. Stadium veterans almost always captain their striker.
        </CoachTip>
      </>
    ),
  },
  {
    id: 'league-table',
    number: '05',
    title: 'Reading the league table',
    minutes: 5,
    intro: (
      <>
        The league table ranks every public squad by return — but the columns next to the percentage tell a deeper story. Reading them properly is half the battle.
      </>
    ),
    body: (
      <>
        <SubHead>What each column actually means</SubHead>
        <Numbered
          items={[
            { title: 'POS — position', body: 'Where you sit on the table. Top 3 get podium colours (gold, silver, bronze).' },
            { title: 'STARTED — squad age', body: 'A long-established squad with +12% beats a 2-day-old squad with +18%. Time compounds.' },
            { title: 'VALUE — equity', body: 'The current paper value. Compare across managers with similar starting capital only.' },
            { title: 'RETURN — % since kick-off', body: 'Your headline number. Up arrow = green, down arrow = red.' },
          ]}
        />
        <SubHead>Form &amp; promotion</SubHead>
        <Para>
          Each manager carries a 5-fixture form line (W·W·L·W·D). Three wins in five and you climb. Three losses and you slide. Top three at season&apos;s end get permanent badges and an armband icon next to their handle.
        </Para>
        <CoachTip>
          Don&apos;t chase the leaderboard week-to-week — chase consistent form. Volatility wins headlines; consistency wins seasons.
        </CoachTip>
      </>
    ),
  },
  {
    id: 'training',
    number: '06',
    title: 'Drills & the coaching license',
    minutes: 4,
    intro:
      'Drills are 10-minute training modules covering one investing concept each — Sharpe ratio, beta, balance sheets, hedging. Pass enough and you unlock the coaching license, which compounds your captain bonus.',
    body: (
      <>
        <SubHead>License tiers</SubHead>
        <ZoneGrid
          zones={[
            { code: 'C', pillClass: 'pill pill-sky', label: 'License C', body: 'Pass 4 drills. +5% captain bonus.' },
            { code: 'B', pillClass: 'pill pill-whistle', label: 'License B', body: 'Pass 10 drills. +12% captain bonus + tactics view unlock.' },
            { code: 'A', pillClass: 'pill pill-red', label: 'License A', body: 'Pass all 20 drills. +25% captain bonus + portfolio sharing.' },
          ]}
        />
        <SubHead>How drills work</SubHead>
        <Para>
          Each drill is one short lesson + one quick quiz. Pass the quiz to mark the drill complete. Fail and you can retry — there&apos;s no penalty for grinding through one a day.
        </Para>
        <CoachTip>
          The <Em>&ldquo;Diversification by formation&rdquo;</Em> drill is the fastest XP per minute in the curriculum. Take it first if you&apos;re grinding for the License B unlock.
        </CoachTip>
      </>
    ),
  },
  {
    id: 'fixtures',
    number: '07',
    title: 'Fixtures, stakes & promotion',
    minutes: 6,
    intro:
      'A fixture is a head-to-head match between you and either the S&P 500 (benchmark mode) or another manager (PvP). You stake XP, the market plays the clock, and the winner takes the pot.',
    body: (
      <>
        <SubHead>Fixture types</SubHead>
        <ZoneGrid
          zones={[
            { code: 'BMK', pillClass: 'pill pill-whistle', label: 'vs S&P 500', body: 'Stake 100 XP. Beat the index over your chosen timeframe — win double, lose your stake.' },
            { code: 'PVP', pillClass: 'pill pill-pitch', label: 'vs Manager', body: 'Stake 200 XP. Higher reward, higher risk. Both sides commit a squad and the higher return wins.' },
          ]}
        />
        <SubHead>Timeframes</SubHead>
        <Para>
          Choose 1W, 2W, 1M, or 3M. Shorter timeframes amplify variance; longer ones reward consistency. There&apos;s no &ldquo;best&rdquo; — match the timeframe to your conviction.
        </Para>
        <SubHead>Etiquette</SubHead>
        <Numbered
          items={[
            { title: 'Don&apos;t cancel mid-fixture', body: 'Cancelling forfeits your stake to the opponent. Once you&apos;ve kicked off, finish the match.' },
            { title: 'Accept invites within 48 hours', body: 'Stale invites auto-expire after 48 hours. Be respectful of the inviter&apos;s window.' },
          ]}
        />
        <CoachTip>
          New managers should start with a 1W vs S&P 500 fixture. It&apos;s the cheapest way to feel the rhythm of kick-off → full-time without committing a long stake.
        </CoachTip>
      </>
    ),
  },
  {
    id: 'risk',
    number: '08',
    title: 'Risk, hedging & the bench',
    minutes: 5,
    intro:
      'Every squad carries hidden risk you can&apos;t see from the return alone — sector concentration, beta drift, drawdown sensitivity. The bench is where you keep ideas you&apos;ve researched but haven&apos;t fielded.',
    body: (
      <>
        <SubHead>Spotting concentration</SubHead>
        <Para>
          Open your squad&apos;s sector allocation widget. Anything over <Em>40%</Em> in a single sector is a red flag — even if returns are great, a sector-wide dip wipes out your lead in one session.
        </Para>
        <SubHead>Hedging basics</SubHead>
        <ZoneGrid
          zones={[
            { code: 'DEF', pillClass: 'pill pill-sky', label: 'Defensive rotation', body: 'Move one ATK slot to a low-beta dividend payer when you sense overheating.' },
            { code: 'CASH', pillClass: 'pill', label: 'Cash on the bench', body: 'A SHV or BIL slot in defence reads as &ldquo;parked cash&rdquo; — useful at market peaks.' },
            { code: 'INV', pillClass: 'pill pill-red', label: 'Inverse exposure', body: 'Advanced: a small SH or SQQQ slot dampens drawdowns. Use sparingly.' },
          ]}
        />
        <SubHead>Using the bench</SubHead>
        <Para>
          The bench (visible in your portfolio detail) holds tickers you&apos;ve added but haven&apos;t fielded. Treat it like a scout&apos;s notebook — promising names you might rotate in when one of your starters underperforms.
        </Para>
        <CoachTip>
          Don&apos;t carry too many bench players. Five or six max — beyond that you&apos;re just hoarding research and not making decisions.
        </CoachTip>
      </>
    ),
  },
];

const STORAGE_KEY = 'gamefi-guide-progress';

export default function GuidePage() {
  const [activeId, setActiveId] = useState<string>(CHAPTERS[2].id); // "Fill the lineup" matches the screenshot default
  const [visited, setVisited] = useState<Set<string>>(new Set());

  // Hydrate visited set from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        setVisited(new Set(arr));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Mark active chapter as visited
  useEffect(() => {
    if (!activeId) return;
    setVisited((prev) => {
      if (prev.has(activeId)) return prev;
      const next = new Set(prev);
      next.add(activeId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [activeId]);

  const active = CHAPTERS.find((c) => c.id === activeId) || CHAPTERS[0];
  const completedCount = visited.size;
  const totalCount = CHAPTERS.length;
  const progressPct = (completedCount / totalCount) * 100;

  return (
    <AppLayout flush>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between" style={{ gap: 14 }}>
          <div>
            <div className="kicker">PLAYBOOK · {totalCount} CHAPTERS</div>
            <h1
              className="display"
              style={{ fontSize: 'clamp(24px, 3vw, 32px)', letterSpacing: '-0.04em', margin: '2px 0 0' }}
            >
              Guide
            </h1>
          </div>
          <div className="flex items-center" style={{ gap: 12 }}>
            <div
              className="mono num"
              style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}
            >
              {completedCount} / {totalCount}
            </div>
            <div
              style={{
                width: 140,
                height: 6,
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  background: 'var(--pitch)',
                  transition: 'width .3s ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* Two-column layout: chapter rail + content panel */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 280px) minmax(0, 1fr)',
            gap: 16,
            alignItems: 'start',
          }}
        >
          {/* Chapter rail */}
          <nav
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              position: 'sticky',
              top: 80,
            }}
          >
            {CHAPTERS.map((ch) => {
              const isActive = ch.id === activeId;
              const isDone = visited.has(ch.id) && !isActive;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setActiveId(ch.id)}
                  className="stadium-card"
                  style={{
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    background: isActive ? 'var(--pitch-tint)' : 'var(--surface)',
                    borderColor: isActive
                      ? 'oklch(0.72 0.21 145 / 0.4)'
                      : 'var(--line)',
                    textAlign: 'left',
                    color: 'inherit',
                    transition: 'background .12s, border-color .12s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.borderColor = 'var(--line-2)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.borderColor = 'var(--line)';
                  }}
                >
                  <ChapterMarker number={ch.number} isActive={isActive} isDone={isDone} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      className="display"
                      style={{
                        fontSize: 13,
                        letterSpacing: '-0.01em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ch.title}
                    </div>
                    <div className="kicker" style={{ fontSize: 9, marginTop: 2 }}>
                      {ch.minutes} MIN READ
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Content panel */}
          <div
            className="stadium-card"
            style={{
              padding: '24px 28px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div className="flex items-start justify-between" style={{ gap: 14, marginBottom: 10 }}>
              <div>
                <div className="kicker">
                  CHAPTER {active.number} · {active.minutes} MIN READ
                </div>
                <h2
                  className="display"
                  style={{
                    fontSize: 'clamp(22px, 2.6vw, 30px)',
                    letterSpacing: '-0.04em',
                    margin: '4px 0 0',
                  }}
                >
                  {active.title}
                </h2>
              </div>
              <span
                className="pill pill-whistle"
                style={{ flexShrink: 0, padding: '4px 10px' }}
              >
                IN PROGRESS
              </span>
            </div>

            <div
              style={{
                fontSize: 15,
                color: 'var(--text-dim)',
                lineHeight: 1.65,
                marginBottom: 8,
              }}
            >
              {active.intro}
            </div>

            <div>{active.body}</div>

            {/* Footer nav */}
            <div
              className="flex items-center justify-between"
              style={{
                marginTop: 28,
                paddingTop: 18,
                borderTop: '1px solid var(--line)',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <PrevNextLink chapter={prevChapter(activeId)} direction="prev" onClick={setActiveId} />
              <Link
                href="/portfolio"
                className="stadium-btn stadium-btn-ghost"
                style={{ textDecoration: 'none', padding: '8px 14px', fontSize: 12 }}
              >
                <Icon.Pitch size={14} /> Apply on the pitch
              </Link>
              <PrevNextLink chapter={nextChapter(activeId)} direction="next" onClick={setActiveId} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function prevChapter(currentId: string): Chapter | null {
  const idx = CHAPTERS.findIndex((c) => c.id === currentId);
  return idx > 0 ? CHAPTERS[idx - 1] : null;
}

function nextChapter(currentId: string): Chapter | null {
  const idx = CHAPTERS.findIndex((c) => c.id === currentId);
  return idx < CHAPTERS.length - 1 ? CHAPTERS[idx + 1] : null;
}

const ChapterMarker: React.FC<{
  number: string;
  isActive: boolean;
  isDone: boolean;
}> = ({ number, isActive, isDone }) => {
  if (isDone) {
    return (
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          background: 'var(--pitch)',
          color: 'oklch(0.14 0.05 145)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  return (
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: 6,
        background: isActive ? 'var(--whistle)' : 'var(--surface-2)',
        color: isActive ? 'var(--ink)' : 'var(--text-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 700,
        border: isActive ? '1px solid var(--whistle)' : '1px solid var(--line)',
      }}
    >
      {number}
    </div>
  );
};

const PrevNextLink: React.FC<{
  chapter: Chapter | null;
  direction: 'prev' | 'next';
  onClick: (id: string) => void;
}> = ({ chapter, direction, onClick }) => {
  if (!chapter) {
    return <div style={{ width: 120 }} aria-hidden />;
  }
  const isPrev = direction === 'prev';
  return (
    <button
      type="button"
      onClick={() => onClick(chapter.id)}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: 'inherit',
        textAlign: isPrev ? 'left' : 'right',
        maxWidth: 200,
      }}
    >
      <div className="kicker" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: isPrev ? 'flex-start' : 'flex-end' }}>
        {isPrev && <Icon.Arrow size={12} style={{ transform: 'rotate(180deg)' }} />}
        {isPrev ? 'PREVIOUS' : 'NEXT'}
        {!isPrev && <Icon.Arrow size={12} />}
      </div>
      <div
        className="display"
        style={{
          fontSize: 13,
          letterSpacing: '-0.01em',
          color: 'var(--text)',
          marginTop: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {chapter.title}
      </div>
    </button>
  );
};
