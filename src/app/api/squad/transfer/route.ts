import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireSessionUserId } from '@/lib/session';
import { getSeasonState, isTransferWindowOpen } from '@/lib/season';
import {
  Asset,
  AllocationStrategy,
  PortfolioPlayer,
  QUARTERLY_TRANSFER_MAX_PER_QUARTER,
  QUARTERLY_TRANSFER_COST_XP,
  SEASON_TOTAL_WEEKS,
} from '@/types';

/* POST /api/squad/transfer
   Body: { userId, portfolioId, outSymbol, inSymbol, inAsset, allocationStrategy }
   - validates transfer window open + cap per quarter
   - replaces outgoing player asset with the new one
   - applies allocation strategy:
       'inherit' → new player keeps the outgoing player's allocation
       'split'   → outgoing allocation redistributed pro-rata across the
                   OTHER 21 players (starters + bench); new player at 0%
   - persists portfolios.players, inserts transfer_log row, deducts XP
*/
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      portfolioId,
      outSymbol,
      inSymbol,
      inAsset,
      allocationStrategy,
    } = body as {
      userId?: string;
      portfolioId?: string;
      outSymbol?: string;
      inSymbol?: string;
      inAsset?: Asset;
      allocationStrategy?: AllocationStrategy;
    };

    if (!portfolioId || !outSymbol || !inSymbol || !inAsset || !allocationStrategy) {
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
    if (allocationStrategy !== 'inherit' && allocationStrategy !== 'split') {
      return NextResponse.json(
        { success: false, error: 'allocationStrategy must be inherit or split' },
        { status: 400 },
      );
    }

    // 1. Season state
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

    if (!isTransferWindowOpen(seasonState.currentGameweek)) {
      return NextResponse.json(
        { success: false, error: 'Transfer window is closed. Opens at GW 1, 14, 27, 40 for 2 weeks each.' },
        { status: 400 },
      );
    }

    // 2. Per-quarter cap
    const { count: tCount } = await supabase
      .from('transfer_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', sessionUserId)
      .eq('portfolio_id', portfolioId)
      .eq('season_number', seasonState.seasonNumber)
      .eq('quarter', seasonState.currentQuarter);

    if ((tCount ?? 0) >= QUARTERLY_TRANSFER_MAX_PER_QUARTER) {
      return NextResponse.json(
        { success: false, error: `Quarterly transfer cap reached (${QUARTERLY_TRANSFER_MAX_PER_QUARTER}/quarter)` },
        { status: 400 },
      );
    }

    // 3. Load portfolio + verify ownership
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

    // Find the outgoing player by symbol (could be starter or bench)
    const outIdx = players.findIndex((p) => p.asset?.symbol === outSymbol);
    if (outIdx === -1) {
      return NextResponse.json(
        { success: false, error: `Player ${outSymbol} not found in squad` },
        { status: 400 },
      );
    }
    const outgoing = players[outIdx];
    const outAlloc = outgoing.allocation ?? 0;

    // Guard against signing a duplicate symbol
    if (players.some((p, i) => i !== outIdx && p.asset?.symbol === inSymbol)) {
      return NextResponse.json(
        { success: false, error: `${inSymbol} is already in the squad` },
        { status: 400 },
      );
    }

    // 4. Build the new players array depending on strategy
    let updatedPlayers: PortfolioPlayer[];
    if (allocationStrategy === 'inherit') {
      // New player takes outgoing's exact slot (same position + allocation + bench flag)
      const replacement: PortfolioPlayer = {
        positionId: outgoing.positionId,
        asset: inAsset,
        allocation: outgoing.isBench ? 0 : outAlloc,
        isBench: outgoing.isBench,
      };
      updatedPlayers = players.map((p, i) => (i === outIdx ? replacement : p));
    } else {
      // 'split' — outgoing allocation redistributed pro-rata across the
      // OTHER starters (bench is 0% so we redistribute only across the
      // other non-bench, non-outgoing players). The new player starts at 0%.
      const others = players
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => i !== outIdx && !p.isBench && p.asset !== null);

      const otherAllocSum = others.reduce((s, { p }) => s + (p.allocation ?? 0), 0);

      updatedPlayers = players.map((p, i) => {
        if (i === outIdx) {
          return {
            positionId: outgoing.positionId,
            asset: inAsset,
            allocation: 0,
            isBench: outgoing.isBench,
          };
        }
        const isOtherStarter = !p.isBench && p.asset !== null;
        if (!isOtherStarter) return p;
        // If outgoing was bench, there's nothing to redistribute (its
        // allocation was 0). Just leave the others alone.
        if (outgoing.isBench || otherAllocSum <= 0) return p;
        const share = (p.allocation ?? 0) / otherAllocSum;
        return { ...p, allocation: (p.allocation ?? 0) + outAlloc * share };
      });
    }

    // 5. XP check + deduct
    const { data: dbUser, error: uErr } = await supabase
      .from('users')
      .select('xp')
      .eq('id', sessionUserId)
      .single();
    if (uErr || !dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (dbUser.xp < QUARTERLY_TRANSFER_COST_XP) {
      return NextResponse.json(
        { success: false, error: `Not enough XP. Need ${QUARTERLY_TRANSFER_COST_XP} XP per signing.` },
        { status: 400 },
      );
    }
    const newXp = dbUser.xp - QUARTERLY_TRANSFER_COST_XP;

    // 6. Persist
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

    const { error: logErr } = await supabase.from('transfer_log').insert({
      user_id: sessionUserId,
      portfolio_id: portfolioId,
      quarter: seasonState.currentQuarter,
      season_number: seasonState.seasonNumber,
      out_symbol: outSymbol,
      in_symbol: inSymbol,
      allocation_strategy: allocationStrategy,
      xp_cost: QUARTERLY_TRANSFER_COST_XP,
    });
    if (logErr) {
      console.error('transfer_log insert failed:', logErr);
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
      transfersUsedThisQuarter: (tCount ?? 0) + 1,
      transfersRemaining: QUARTERLY_TRANSFER_MAX_PER_QUARTER - ((tCount ?? 0) + 1),
    });
  } catch (err) {
    console.error('POST /api/squad/transfer failed:', err);
    return NextResponse.json({ success: false, error: 'Transfer failed' }, { status: 500 });
  }
}
