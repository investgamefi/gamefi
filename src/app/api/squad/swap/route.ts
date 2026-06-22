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

/* POST /api/squad/swap
   Body: { userId, portfolioId, starterSymbol, benchSymbol,
           allocationStrategy?: 'inherit' | 'split' }
   - validates weekend window + ownership + per-weekend cap
   - allocation strategy (defaults to 'inherit'):
       'inherit' → bench player coming on takes the starter's % directly.
                   The starting XI's per-player weights stay the same,
                   only the names rotate.
       'split'   → the outgoing starter's % is redistributed pro-rata
                   across the OTHER 10 starters; the bench player comes
                   on at 0%. Useful when you want to deemphasize the
                   slot without redistributing manually later.
     Either way the on-field total stays at 100% — bench is always 0%.
   - persists portfolios.players, inserts weekend_swaps row, deducts XP
*/
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      portfolioId,
      starterSymbol,
      benchSymbol,
      allocationStrategy = 'inherit',
    } = body as {
      userId?: string;
      portfolioId?: string;
      starterSymbol?: string;
      benchSymbol?: string;
      allocationStrategy?: AllocationStrategy;
    };

    if (!portfolioId || !starterSymbol || !benchSymbol) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 },
      );
    }
    /* Auth: session is the source of truth. Body userId is optional
       but if present must match the session — otherwise reject. */
    const sessionResult = requireSessionUserId(req, userId);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const sessionUserId = sessionResult;
    if (allocationStrategy !== 'inherit' && allocationStrategy !== 'split') {
      return NextResponse.json(
        { success: false, error: 'allocationStrategy must be "inherit" or "split"' },
        { status: 400 },
      );
    }

    if (starterSymbol === benchSymbol) {
      return NextResponse.json(
        { success: false, error: 'Cannot swap a player with itself' },
        { status: 400 },
      );
    }

    // 1. Load season state (canonical clock)
    const { data: seasonRow } = await supabase
      .from('season_state')
      .select('season_number, start_date, total_weeks')
      .eq('id', 1)
      .single();

    const now = new Date();
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

    if (!isWeekendWindowOpen(now)) {
      return NextResponse.json(
        { success: false, error: 'Weekend swap window is closed. Try again Fri 21:00 UTC – Mon 05:00 UTC.' },
        { status: 400 },
      );
    }

    // 2. Load portfolio and verify ownership
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

    const players: PortfolioPlayer[] = typeof portfolio.players === 'string'
      ? JSON.parse(portfolio.players)
      : portfolio.players;

    // 3. Per-weekend cap — count swaps in this gameweek + season
    const { count: swapCount } = await supabase
      .from('weekend_swaps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', sessionUserId)
      .eq('portfolio_id', portfolioId)
      .eq('season_number', seasonState.seasonNumber)
      .eq('gameweek', seasonState.currentGameweek);

    if ((swapCount ?? 0) >= WEEKEND_SUB_MAX_PER_WEEKEND) {
      return NextResponse.json(
        { success: false, error: `Weekend swap cap reached (${WEEKEND_SUB_MAX_PER_WEEKEND}/weekend)` },
        { status: 400 },
      );
    }

    // 4. Locate starter and bench players in the JSON
    const starterIdx = players.findIndex(
      (p) => p.asset?.symbol === starterSymbol && !p.isBench,
    );
    const benchIdx = players.findIndex(
      (p) => p.asset?.symbol === benchSymbol && p.isBench,
    );

    if (starterIdx === -1) {
      return NextResponse.json(
        { success: false, error: `Starter ${starterSymbol} not found on starting XI` },
        { status: 400 },
      );
    }
    if (benchIdx === -1) {
      return NextResponse.json(
        { success: false, error: `Bench player ${benchSymbol} not found on bench` },
        { status: 400 },
      );
    }

    const starter = players[starterIdx];
    const bench = players[benchIdx];
    const outgoingAllocation = starter.allocation || 0;

    /* 5. Allocation math.
       - 'inherit' (default): bench takes starter's %.
       - 'split': bench comes on at 0%, starter's % is redistributed
         pro-rata across the OTHER starters. We compute the new
         weights here so the JSON write is atomic with the swap. */
    const updatedPlayers = [...players];
    if (allocationStrategy === 'inherit') {
      updatedPlayers[starterIdx] = {
        ...bench,
        positionId: starter.positionId,
        allocation: outgoingAllocation,
        isBench: false,
      };
      updatedPlayers[benchIdx] = {
        ...starter,
        positionId: bench.positionId,
        allocation: 0,
        isBench: true,
      };
    } else {
      // 'split' — distribute outgoingAllocation across other starters
      const otherStarterIdxs = players
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => i !== starterIdx && !p.isBench)
        .map(({ i }) => i);
      const otherStartersWeightTotal = otherStarterIdxs.reduce(
        (sum, i) => sum + (players[i].allocation || 0),
        0,
      );
      // Guard against /0 when all other starters are at 0% — fall
      // back to even spread.
      if (otherStartersWeightTotal === 0 && otherStarterIdxs.length > 0) {
        const each = outgoingAllocation / otherStarterIdxs.length;
        for (const i of otherStarterIdxs) {
          updatedPlayers[i] = {
            ...players[i],
            allocation: (players[i].allocation || 0) + each,
          };
        }
      } else {
        for (const i of otherStarterIdxs) {
          const w = players[i].allocation || 0;
          updatedPlayers[i] = {
            ...players[i],
            allocation: w + outgoingAllocation * (w / otherStartersWeightTotal),
          };
        }
      }
      updatedPlayers[starterIdx] = {
        ...bench,
        positionId: starter.positionId,
        allocation: 0,
        isBench: false,
      };
      updatedPlayers[benchIdx] = {
        ...starter,
        positionId: bench.positionId,
        allocation: 0,
        isBench: true,
      };
    }

    // 6. Load current XP for the user
    const { data: dbUser, error: uErr } = await supabase
      .from('users')
      .select('xp')
      .eq('id', sessionUserId)
      .single();
    if (uErr || !dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (dbUser.xp < WEEKEND_SUB_COST_XP) {
      return NextResponse.json(
        { success: false, error: `Not enough XP. Need ${WEEKEND_SUB_COST_XP} XP per sub.` },
        { status: 400 },
      );
    }
    const newXp = dbUser.xp - WEEKEND_SUB_COST_XP;

    // 7. Persist all three writes. Not transactional — if a later
    //    write fails we leave a partial state, same as the existing
    //    challenges flow.
    const { error: writePErr } = await supabase
      .from('portfolios')
      .update({
        players: JSON.stringify(updatedPlayers),
        updated_at: new Date().toISOString(),
      })
      .eq('id', portfolioId);
    if (writePErr) {
      return NextResponse.json({ success: false, error: writePErr.message }, { status: 500 });
    }

    const { error: logErr } = await supabase.from('weekend_swaps').insert({
      user_id: sessionUserId,
      portfolio_id: portfolioId,
      gameweek: seasonState.currentGameweek,
      season_number: seasonState.seasonNumber,
      starter_symbol: starterSymbol,
      bench_symbol: benchSymbol,
      xp_cost: WEEKEND_SUB_COST_XP,
    });
    if (logErr) {
      console.error('weekend_swaps insert failed:', logErr);
    }

    const { error: xpErr } = await supabase
      .from('users')
      .update({ xp: newXp, updated_at: new Date().toISOString() })
      .eq('id', sessionUserId);
    if (xpErr) {
      console.error('xp deduct failed:', xpErr);
    }

    return NextResponse.json({
      success: true,
      players: updatedPlayers,
      xp: newXp,
      swapsUsedThisWeekend: (swapCount ?? 0) + 1,
      swapsRemaining: WEEKEND_SUB_MAX_PER_WEEKEND - ((swapCount ?? 0) + 1),
    });
  } catch (err) {
    console.error('POST /api/squad/swap failed:', err);
    return NextResponse.json({ success: false, error: 'Swap failed' }, { status: 500 });
  }
}
