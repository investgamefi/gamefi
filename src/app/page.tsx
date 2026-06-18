'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { LoginForm, RegisterForm } from '@/components';
import { Icon } from '@/components/stadium/Icon';
import { Pitch, PHOENIX_XI_LINEUP } from '@/components/stadium/Pitch';

type AuthView = 'login' | 'register' | 'landing';

type Tick = { sym: string; px: number | null; day: number | null };

const TICKER_SYMBOLS = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'META', 'AMZN', 'GOOG', 'JPM', 'COIN', 'AMD'];

const fmtMoney = (n: number) => `$${n.toFixed(2)}`;
const fmtPct1 = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, loadData } = useStore();
  const [authView, setAuthView] = useState<AuthView>('landing');
  const [tickerData, setTickerData] = useState<Tick[]>(
    () => TICKER_SYMBOLS.map((sym) => ({ sym, px: null, day: null })),
  );

  // Fetch real prices for the ticker tape. Each symbol hits the Yahoo Finance
  // proxy in parallel; cells stay blank-but-shaped until their fetch resolves,
  // so the row never jumps. Failures just leave a cell skeleton — they don't
  // block the rest of the tape.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      TICKER_SYMBOLS.map(async (sym): Promise<Tick> => {
        try {
          const res = await fetch(`/api/yahoo-finance?symbol=${sym}`);
          const data = await res.json();
          if (data.success && data.asset) {
            return {
              sym,
              px: data.asset.currentPrice ?? null,
              day: data.asset.dayChangePercent ?? null,
            };
          }
        } catch {
          /* swallow per-symbol failures */
        }
        return { sym, px: null, day: null };
      }),
    ).then((results) => {
      if (!cancelled) setTickerData(results);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div
        className="stadium-root min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="stadium-spinner" />
          <span className="kicker">WARMING UP…</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div
        className="stadium-root min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="stadium-spinner" />
          <span className="kicker">REDIRECTING TO MATCHDAY…</span>
        </div>
      </div>
    );
  }

  if (authView === 'login') {
    return <LoginForm onSwitchToRegister={() => setAuthView('register')} />;
  }

  if (authView === 'register') {
    return <RegisterForm onSwitchToLogin={() => setAuthView('login')} />;
  }

  return (
    <div
      className="stadium-root"
      data-theme="dark"
      style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh', overflow: 'hidden' }}
    >
      {/* ===== Ticker tape ===== */}
      <div
        style={{
          background: 'var(--ink)',
          color: '#fff',
          borderBottom: '1px solid var(--line)',
          padding: '10px 0',
          overflow: 'hidden',
        }}
      >
        <div className="flex" style={{ gap: 40, paddingLeft: 24, whiteSpace: 'nowrap' }}>
          <span
            className="pill pill-red"
            style={{
              background: 'oklch(0.65 0.22 25 / 0.18)',
              borderColor: 'transparent',
              color: '#ff7766',
              flexShrink: 0,
            }}
          >
            <span className="live-dot" /> MARKET OPEN
          </span>
          {tickerData.map((s) => {
            const hasData = s.px != null && s.day != null;
            const up = hasData && (s.day as number) >= 0;
            return (
              <div
                key={s.sym}
                className="flex items-baseline"
                style={{ gap: 8, flexShrink: 0 }}
              >
                <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
                  {s.sym}
                </span>
                {hasData ? (
                  <>
                    <span
                      className="mono num"
                      style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}
                    >
                      {fmtMoney(s.px as number)}
                    </span>
                    <span
                      className="mono num"
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: up ? 'var(--pitch-glow)' : '#ff7766',
                      }}
                    >
                      {fmtPct1(s.day as number)}
                    </span>
                  </>
                ) : (
                  /* Skeleton — keeps the row from jumping while real data loads */
                  <span
                    style={{
                      display: 'inline-block',
                      width: 80,
                      height: 12,
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 2,
                    }}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== Header / nav ===== */}
      <header
        className="flex items-center justify-between"
        style={{
          padding: '16px 48px',
          borderBottom: '1px solid var(--line)',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div className="flex items-center" style={{ gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: 'var(--text)',
              color: 'var(--bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon.Logo size={26} />
          </div>
          <div>
            <div className="display" style={{ fontSize: 18, letterSpacing: '-0.03em' }}>
              GAMEFI
            </div>
            <div className="kicker" style={{ fontSize: 9, marginTop: -2 }}>
              INVEST · LEAGUE
            </div>
          </div>
        </div>

        <nav className="hidden md:flex" style={{ gap: 28 }}>
          {[
            { label: 'How it works', href: '#how-it-works' },
            { label: 'Stories', href: '#stories' },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="display"
              style={{
                fontSize: 13,
                color: 'var(--text-dim)',
                textDecoration: 'none',
                cursor: 'pointer',
                letterSpacing: '0.01em',
                transition: 'color .12s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex" style={{ gap: 10 }}>
          <button
            type="button"
            className="stadium-btn stadium-btn-ghost"
            onClick={() => setAuthView('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className="stadium-btn stadium-btn-primary"
            onClick={() => setAuthView('register')}
          >
            Join the league <Icon.Arrow size={14} />
          </button>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section style={{ padding: '56px 48px 32px', position: 'relative', overflow: 'hidden' }}>
        {/* faint chalk grid backdrop */}
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

        <div
          className="landing-hero-grid"
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 48,
            alignItems: 'center',
          }}
        >
          <div>
            <div className="pill pill-pitch" style={{ marginBottom: 22 }}>
              <span className="live-dot" style={{ background: 'var(--pitch)' }} /> SEASON 1 — NOW OPEN
            </div>
            <h1
              className="display"
              style={{
                fontSize: 'clamp(40px, 5.6vw, 76px)',
                lineHeight: 0.95,
                letterSpacing: '-0.06em',
                margin: 0,
                maxWidth: 680,
              }}
            >
              Invest like
              <br />
              you<span style={{ color: 'var(--pitch)' }}> manage</span>
              <br />
              a football
              <br />
              <span style={{ position: 'relative', display: 'inline-block' }}>
                club.
                <svg
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -16,
                    width: '100%',
                    height: 18,
                  }}
                  viewBox="0 0 240 18"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 14 Q 60 4, 120 10 T 238 8"
                    stroke="var(--pitch)"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p
              style={{
                marginTop: 28,
                color: 'var(--text-dim)',
                fontSize: 16,
                lineHeight: 1.55,
                maxWidth: 520,
              }}
            >
              Pick eleven stocks. Field them in a formation. Captain your top pick.
              Win XP when your XI beats the index — or the manager next door. Paper
              money only. Real lessons.{' '}
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>No credit card.</span>
            </p>

            <div className="flex flex-wrap" style={{ gap: 12, marginTop: 36 }}>
              <button
                type="button"
                className="stadium-btn stadium-btn-primary"
                style={{ padding: '14px 22px', fontSize: 14 }}
                onClick={() => setAuthView('register')}
              >
                <Icon.Pitch size={18} /> Field your first XI
              </button>
              <button
                type="button"
                className="stadium-btn stadium-btn-ghost"
                style={{ padding: '14px 18px', fontSize: 14 }}
                onClick={() => setAuthView('login')}
              >
                <Icon.Whistle size={16} /> I already have an account
              </button>
            </div>
          </div>

          {/* Right column: a tilted Stadium pitch with live-score overlay and captain badge */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                maxWidth: 460,
                marginLeft: 'auto',
                position: 'relative',
                transform: 'rotate(2deg)',
              }}
            >
              <div style={{ filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.4))' }}>
                <Pitch
                  formation="4-3-3"
                  lineup={PHOENIX_XI_LINEUP}
                  variant="stadium"
                  size="md"
                  captain="st"
                />
              </div>
              {/* live score overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: -22,
                  left: -22,
                  background: 'var(--ink)',
                  color: '#fff',
                  padding: '10px 14px',
                  borderRadius: 6,
                  transform: 'rotate(-4deg)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  border: '1px solid var(--line)',
                }}
              >
                <div className="kicker" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  YOU vs S&P 500
                </div>
                <div className="flex" style={{ gap: 12, marginTop: 4 }}>
                  <div
                    className="display num"
                    style={{ fontSize: 26, color: 'var(--pitch-glow)', letterSpacing: '-0.04em' }}
                  >
                    +24.9
                  </div>
                  <div
                    className="display num"
                    style={{
                      fontSize: 26,
                      color: 'rgba(255,255,255,0.6)',
                      letterSpacing: '-0.04em',
                    }}
                  >
                    18.8
                  </div>
                </div>
              </div>
              {/* captain badge */}
              <div
                style={{
                  position: 'absolute',
                  bottom: -16,
                  right: -22,
                  background: 'var(--whistle)',
                  color: 'var(--ink)',
                  padding: '8px 12px',
                  borderRadius: 4,
                  transform: 'rotate(3deg)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                }}
              >
                NVDA · CAPTAIN · ×2 XP
              </div>
            </div>
          </div>
        </div>

        {/* Stat bar */}
        <div
          style={{
            position: 'relative',
            marginTop: 64,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            borderTop: '1px solid var(--line)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          {[
            ['500+', 'TICKERS LIVE'],
            ['11', 'PLAYERS PER XI'],
            ['6', 'FORMATIONS'],
            ['$0', 'TO PLAY · FOREVER'],
          ].map((s, i) => (
            <div
              key={s[1]}
              style={{
                padding: '24px 18px',
                borderLeft: i === 0 ? 'none' : '1px solid var(--line)',
              }}
            >
              <div
                className="display num"
                style={{ fontSize: 'clamp(36px, 4vw, 48px)', letterSpacing: '-0.06em', lineHeight: 1 }}
              >
                {s[0]}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: 'var(--text-mute)',
                  letterSpacing: '0.14em',
                  marginTop: 6,
                }}
              >
                {s[1]}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section
        id="how-it-works"
        style={{
          padding: '60px 48px',
          background: 'var(--bg-2)',
          borderTop: '1px solid var(--line)',
          borderBottom: '1px solid var(--line)',
          scrollMarginTop: 80,
        }}
      >
        <div
          className="flex flex-wrap"
          style={{
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 48,
            gap: 24,
          }}
        >
          <div>
            <div className="kicker">PLAYBOOK · 4 STEPS</div>
            <h2
              className="display"
              style={{ fontSize: 'clamp(28px, 3.6vw, 44px)', letterSpacing: '-0.04em', margin: '6px 0 0' }}
            >
              From kick-off to full-time.
            </h2>
          </div>
          <div
            className="mono"
            style={{ fontSize: 12, color: 'var(--text-mute)', letterSpacing: '0.1em', maxWidth: 280 }}
          >
            Real market prices. Paper trading. Zero financial risk.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            border: '1px solid var(--line)',
            background: 'var(--surface)',
          }}
        >
          {[
            { n: '01', t: 'Pick a formation', d: '4-3-3 for attack. 4-4-2 for balance. 3-5-2 for risk-on.', icon: 'Pitch' as const },
            { n: '02', t: 'Fill the lineup', d: 'Eleven tickers — defensive picks at the back, growth up top.', icon: 'Lineup' as const },
            { n: '03', t: 'Captain & kick-off', d: 'Captain doubles your XP. The market is your match clock.', icon: 'Whistle' as const },
            { n: '04', t: 'Beat the index', d: 'Outperform the S&P, climb the league table, level up.', icon: 'Trophy' as const },
          ].map((step, i) => {
            const I = Icon[step.icon];
            return (
              <div
                key={step.n}
                style={{
                  padding: '24px 20px',
                  borderLeft: i === 0 ? 'none' : '1px solid var(--line)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  position: 'relative',
                  minHeight: 200,
                }}
              >
                <div className="flex items-start justify-between">
                  <div
                    className="display num"
                    style={{ fontSize: 28, color: 'var(--text-mute)', letterSpacing: '-0.05em' }}
                  >
                    {step.n}
                  </div>
                  <I size={20} style={{ color: 'var(--pitch)' }} />
                </div>
                <div
                  className="display"
                  style={{ fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.2 }}
                >
                  {step.t}
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.55 }}>
                  {step.d}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== Manager-of-the-month testimonial ===== */}
      <section id="stories" style={{ padding: '48px 48px 60px', scrollMarginTop: 80 }}>
        <div
          style={{
            background: 'var(--ink)',
            color: '#fff',
            padding: '44px 40px',
            borderRadius: 12,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '6px 6px',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 60,
              alignItems: 'center',
            }}
          >
            <div>
              <div className="kicker" style={{ color: 'rgba(255,255,255,0.5)' }}>
                MANAGER OF THE MONTH
              </div>
              <blockquote
                className="display"
                style={{
                  fontSize: 'clamp(20px, 2.4vw, 30px)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.2,
                  margin: '12px 0 0',
                  maxWidth: 540,
                }}
              >
                “I learned more about how a 60/40 actually behaves in a quarter of fielding XIs than in two years of reading.”
              </blockquote>
              <div className="flex items-center" style={{ marginTop: 24, gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 6,
                    background: 'var(--pitch)',
                    color: 'oklch(0.14 0.05 145)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  LE
                </div>
                <div>
                  <div className="display" style={{ fontSize: 15 }}>leon.eth</div>
                  <div
                    className="mono"
                    style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em' }}
                  >
                    CATALYST XI · #1 LEAGUE · +58.4% S1
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 18,
              }}
            >
              {[
                ['+58.4%', 'SEASON RETURN'],
                ['#01', 'LEAGUE'],
                ['24', 'MATCHES WON'],
                ['12', 'BADGES'],
              ].map((s) => (
                <div
                  key={s[1]}
                  style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 14 }}
                >
                  <div
                    className="display num"
                    style={{ fontSize: 28, color: 'var(--pitch-glow)', letterSpacing: '-0.05em' }}
                  >
                    {s[0]}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.5)',
                      letterSpacing: '0.12em',
                      marginTop: 4,
                    }}
                  >
                    {s[1]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section
        style={{
          padding: '64px 24px',
          borderTop: '1px solid var(--line)',
          background: 'var(--bg-2)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="kicker" style={{ color: 'var(--pitch)' }}>SEASON 1 IS OPEN</div>
        <h2
          className="display"
          style={{
            fontSize: 'clamp(36px, 6vw, 64px)',
            letterSpacing: '-0.06em',
            margin: '10px 0 6px',
            lineHeight: 1,
          }}
        >
          Kick-off in <span style={{ color: 'var(--pitch)' }}>90 seconds.</span>
        </h2>
        <div
          style={{
            color: 'var(--text-dim)',
            fontSize: 15,
            maxWidth: 500,
            margin: '16px auto 0',
          }}
        >
          No credit card. Paper money. +500 XP welcome bonus for fielding your first XI before the next whistle.
        </div>
        <div className="flex flex-wrap" style={{ justifyContent: 'center', gap: 12, marginTop: 36 }}>
          <button
            type="button"
            className="stadium-btn stadium-btn-primary"
            style={{ padding: '16px 28px', fontSize: 15 }}
            onClick={() => setAuthView('register')}
          >
            <Icon.Pitch size={18} /> Create your manager account
          </button>
          <button
            type="button"
            className="stadium-btn stadium-btn-ghost"
            style={{ padding: '16px 22px', fontSize: 15 }}
            onClick={() => setAuthView('login')}
          >
            I already have one
          </button>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer style={{ padding: '36px 32px', borderTop: '1px solid var(--line)' }}>
        <div
          className="flex flex-wrap items-center"
          style={{ justifyContent: 'space-between', gap: 18 }}
        >
          <div className="flex items-center" style={{ gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'var(--text)',
                color: 'var(--bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon.Logo size={18} />
            </div>
            <span className="display" style={{ fontSize: 13, letterSpacing: '-0.02em' }}>
              GAMEFI INVEST
            </span>
          </div>
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--text-mute)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Educational paper-trading platform · Not financial advice · © 2026
          </div>
          <div className="flex" style={{ gap: 18 }}>
            {['Terms', 'Privacy', 'Help'].map((l) => (
              <a
                key={l}
                className="mono"
                style={{
                  fontSize: 10,
                  color: 'var(--text-dim)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                {l}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
