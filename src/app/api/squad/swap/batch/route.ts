import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireSessionUserId } from '@/lib/session';
import { getSeasonState, isWeekendWindowOpen } from '@/lib/season';
import {
  AllocationStrategy,
  PortfolioPlayer,
  WEEKEND_SUB_MAX_PER_WEEKEND,
  WEEKEND_SUB_COST_XP,
  SEASON_TOTAL_WEEKS,
} from '@/types';

/* POST /api/squad/swap/batch
   Body: {
     userId, portfolioId,
     swaps: Array<{ starterSymbol, benchSymbol, allocationStrategy }>
   }
   Applies a list of weekend subs in sequence in one round-trip.
   - Validates the window once at the top (same gate as /swap).
   - Enforces the per-weekend cap server-side: if the user requests N
     swaps but only has K < N remaining, accept the first K and tag
     the rejected ones with cap_exceeded.
   - For each accepted swap: rebuilds the players JSON in-memory,
     applies inherit/split allocation math, charges XP. The final
     persisted players JSON, XP balance, and per-swap result list are
     returned together. Not transactional — same posture as the rest
     of the codebase — but writes are batched so a single late failure
     leaves at most one partial row.

   Item 17 (Marcus's wishlist): users plan a multi-sub weekend in
   one tray and confirm all at once instead of one-by-one. The
   single-swap /api/squad/swap endpoint stays as-is for back-compat
   with the existing modal and external integrations. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      portfolioId,
      swaps,
    } = body as {
      userId?: string;
      portfolioId?: string;
      swaps?: Array<{
        starterSymbol: string;
        benchSymbol: string;
        allocationStrategy?: AllocationStrategy;
      }>;
    };

    if (!portfolioId || !Array.isArray(swaps) || swaps.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 },
      );
    }
    /* Auth: session is the source of truth. Body userId is optional
       but if present must match the session. */
    const sessionResult = requireSessionUserId(req, userId);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const sessionUserId = sessionResult;
    /* Defensive cap on the request size so a runaway client can't
       loop us. The per-weekend cap will catch most cases anyway. */
    if (swaps.length > WEEKEND_SUB_MAX_PER_WEEKEND) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many swaps in one request — max ${WEEKEND_SUB_MAX_PER_WEEKEND} per weekend`,
        },
        { status: 400 },
      );
    }

    const now = new Date();
    if (!isWeekendWindowOpen(now)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Weekend swap window is closed. Try again Fri 21:00 UTC – Mon 05:00 UTC.',
        },
        { status: 400 },
      );
    }

    // 1. Season clock (canonical) — same as /swap.
    const { data: seasonRow } = await supabase
      .from('season_state')
      .select('season_number, start_date, total_weeks')
      .eq('id', 1)
      .single();

    const seasonState = seasonRow
      ? getSeasonState(
          {
            seasonNumber: seasonRow.season_number,
            startDate: seasonRow.start_date,
            totalWeeks: seasonRow.total_weeks,
          },
          now,
        )
      : getSeasonState(
          {
            seasonNumber: 1,
            startDate: now.toISOString().slice(0, 10),
            totalWeeks: SEASON_TOTAL_WEEKS,
          },
          now,
        );

    // 2. Portfolio + ownership.
    const { data: portfolio, error: pErr } = await supabase
      .from('portfolios')
      .select('user_id, players')
      .eq('id', portfolioId)
      .single();

    if (pErr || !portfolio) {
      return NextResponse.json({ success: false, error: 'Portfolio not found' }, { status: 404 });
    }
    if (portfolio.user_id !== sessionUserId) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    // 3. Per-weekend cap — count what's already been used this GW.
    const { count: swapCountSoFar } = await supabase
      .from('weekend_swaps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', sessionUserId)
      .eq('portfolio_id', portfolioId)
      .eq('season_number', seasonState.seasonNumber)
      .eq('gameweek', seasonState.currentGameweek);

    const alreadyUsed = swapCountSoFar ?? 0;
    const remainingBudget = Math.max(0, WEEKEND_SUB_MAX_PER_WEEKEND - alreadyUsed);

    // 4. Load current XP once.
    const { data: dbUser, error: uErr } = await supabase
      .from('users')
      .select('xp')
      .eq('id', sessionUserId)
      .single();
    if (uErr || !dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    /* 5. Walk swaps in order, applying as many as the cap + XP budget
       allow. Each accepted swap rebuilds `players` in-memory so the
       next swap sees the updated lineup. */
    let players: PortfolioPlayer[] = typeof portfolio.players === 'string'
      ? JSON.parse(portfolio.players)
      : portfolio.players;
    let xp = dbUser.xp;
    let appliedCount = 0;

    type SwapResult = {
      index: number;
      starterSymbol: string;
      benchSymbol: string;
      success: boolean;
      error?: string;
    };
    const results: SwapResult[] = [];
    const accepted: Array<{
      starterSymbol: string;
      benchSymbol: string;
    }> = [];

    for (let i = 0; i < swaps.length; i++) {
      const {
        starterSymbol,
        benchSymbol,
        allocationStrategy = 'inherit',
      } = swaps[i];

      if (!starterSymbol || !benchSymbol) {
        results.push({
          index: i,
          starterSymbol: starterSymbol ?? '',
          benchSymbol: benchSymbol ?? '',
          success: false,
          error: 'Missing starterSymbol or benchSymbol',
        });
        continue;
      }
      if (allocationStrategy !== 'inherit' && allocationStrategy !== 'split') {
        results.push({
          index: i,
          starterSymbol,
          benchSymbol,
          success: false,
          error: 'allocationStrategy must be "inherit" or "split"',
        });
        continue;
      }
      if (starterSymbol === benchSymbol) {
        results.push({
          index: i,
          starterSymbol,
          benchSymbol,
          success: false,
          error: 'Cannot swap a player with itself',
        });
        continue;
      }

      /* Cap check — once we've hit the budget, every remaining swap
         is rejected with cap_exceeded so the client knows which one
         broke the chain. */
      if (appliedCount >= remainingBudget) {
        results.push({
          index: i,
          starterSymbol,
          benchSymbol,
          success: false,
          error: `Weekend swap cap reached (${WEEKEND_SUB_MAX_PER_WEEKEND}/weekend)`,
        });
        continue;
      }

      if (xp < WEEKEND_SUB_COST_XP) {
        results.push({
          index: i,
          starterSymbol,
          benchSymbol,
          success: false,
          error: `Not enough XP. Need ${WEEKEND_SUB_COST_XP} XP per sub.`,
        });
        continue;
      }

      const starterIdx = players.findIndex(
        (p) => p.asset?.symbol === starterSymbol && !p.isBench,
      );
      const benchIdx = players.findIndex(
        (p) => p.asset?.symbol === benchSymbol && p.isBench,
      );
      if (starterIdx === -1) {
        results.push({
          index: i,
          starterSymbol,
          benchSymbol,
          success: false,
          error: `Starter ${starterSymbol} not found on starting XI`,
        });
        continue;
      }
      if (benchIdx === -1) {
        results.push({
          index: i,
          starterSymbol,
          benchSymbol,
          success: false,
          error: `Bench player ${benchSymbol} not found on bench`,
        });
        continue;
      }

      // Apply the swap to the in-memory players array.
      const starter = players[starterIdx];
      const bench = players[benchIdx];
      const outgoingAllocation = starter.allocation || 0;
      const next = [...players];

      if (allocationStrategy === 'inherit') {
        next[starterIdx] = {
          ...bench,
          positionId: starter.positionId,
          allocation: outgoingAllocation,
          isBench: false,
        };
        next[benchIdx] = {
          ...starter,
          positionId: bench.positionId,
          allocation: 0,
          isBench: true,
        };
      } else {
        const otherStarterIdxs = players
          .map((p, idx) => ({ p, idx }))
          .filter(({ p, idx }) => idx !== starterIdx && !p.isBench)
          .map(({ idx }) => idx);
        const otherStartersWeightTotal = otherStarterIdxs.reduce(
          (sum, idx) => sum + (players[idx].allocation || 0),
          0,
        );
        if (otherStartersWeightTotal === 0 && otherStarterIdxs.length > 0) {
          const each = outgoingAllocation / otherStarterIdxs.length;
          for (const idx of otherStarterIdxs) {
            next[idx] = {
              ...players[idx],
              allocation: (players[idx].allocation || 0) + each,
            };
          }
        } else {
          for (const idx of otherStarterIdxs) {
            const w = players[idx].allocation || 0;
            next[idx] = {
              ...players[idx],
              allocation: w + outgoingAllocation * (w / otherStartersWeightTotal),
            };
          }
        }
        next[starterIdx] = {
          ...bench,
          positionId: starter.positionId,
          allocation: 0,
          isBench: false,
        };
        next[benchIdx] = {
          ...starter,
          positionId: bench.positionId,
          allocation: 0,
          isBench: true,
        };
      }

      players = next;
      xp -= WEEKEND_SUB_COST_XP;
      appliedCount += 1;
      accepted.push({ starterSymbol, benchSymbol });
      results.push({
        index: i,
        starterSymbol,
        benchSymbol,
        success: true,
      });
    }

    /* 6. Persist — only if at least one swap landed. Writes are
       sequential (portfolio JSON, weekend_swaps inserts, xp deduct)
       so a late failure leaves the same partial-write window as the
       single-swap endpoint. */
    if (appliedCount === 0) {
      return NextResponse.json({
        success: false,
        error: results.find((r) => !r.success)?.error || 'No swaps applied',
        results,
        xp,
        swapsRemaining: remainingBudget,
      });
    }

    const { error: writePErr } = await supabase
      .from('portfolios')
      .update({
        players: JSON.stringify(players),
        updated_at: new Date().toISOString(),
      })
      .eq('id', portfolioId);
    if (writePErr) {
      return NextResponse.json({ success: false, error: writePErr.message }, { status: 500 });
    }

    /* Batched insert for the log rows — one row per accepted swap. */
    const logRows = accepted.map((s) => ({
      user_id: sessionUserId,
      portfolio_id: portfolioId,
      gameweek: seasonState.currentGameweek,
      season_number: seasonState.seasonNumber,
      starter_symbol: s.starterSymbol,
      bench_symbol: s.benchSymbol,
      xp_cost: WEEKEND_SUB_COST_XP,
    }));
    const { error: logErr } = await supabase.from('weekend_swaps').insert(logRows);
    if (logErr) {
      console.error('weekend_swaps batch insert failed:', logErr);
    }

    const { error: xpErr } = await supabase
      .from('users')
      .update({ xp, updated_at: new Date().toISOString() })
      .eq('id', sessionUserId);
    if (xpErr) {
      console.error('xp deduct failed:', xpErr);
    }

    return NextResponse.json({
      success: true,
      players,
      xp,
      appliedCount,
      results,
      swapsUsedThisWeekend: alreadyUsed + appliedCount,
      swapsRemaining: WEEKEND_SUB_MAX_PER_WEEKEND - (alreadyUsed + appliedCount),
    });
  } catch (err) {
    console.error('POST /api/squad/swap/batch failed:', err);
    return NextResponse.json({ success: false, error: 'Batch swap failed' }, { status: 500 });
  }
}
