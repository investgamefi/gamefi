import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { requireSessionUserId } from '@/lib/session';
import { Formation, PortfolioPlayer, PortfolioSnapshot } from '@/types';
import { getSeasonState, SeasonRow, currentWeekendKey } from '@/lib/season';

// Resolve current season state. Reads the `seasons` table if it exists,
// otherwise falls back to the helper's default.
async function getCurrentSeasonState(now: Date = new Date()) {
  /* Read the `season_state` singleton (id=1) seeded by the
     supabase-season-features.sql migration. Falls back to a sensible
     default if the row isn't there yet so the snapshot endpoints don't
     crash before the schema is applied. */
  let row: SeasonRow = {
    seasonNumber: 1,
    startDate: new Date().toISOString().split('T')[0],
    totalWeeks: 52,
  };
  try {
    const { data } = await supabase
      .from('season_state')
      .select('season_number, start_date, total_weeks')
      .eq('id', 1)
      .maybeSingle();

    if (data) {
      row = {
        seasonNumber: data.season_number,
        startDate: data.start_date,
        totalWeeks: data.total_weeks,
      };
    }
  } catch {
    // ignore — use default row
  }
  return getSeasonState(row, now);
}

function formatSnapshot(row: any): PortfolioSnapshot {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    snapshotDate: row.snapshot_date,
    gameweek: row.gameweek,
    seasonNumber: row.season_number,
    formation: row.formation as Formation,
    players: typeof row.players === 'string' ? JSON.parse(row.players) : (row.players || []),
  };
}

// GET ?portfolioId=X — return snapshots newest first
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const portfolioId = searchParams.get('portfolioId');

    if (!portfolioId) {
      return NextResponse.json(
        { success: false, error: 'portfolioId is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('gameweek', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const snapshots: PortfolioSnapshot[] = (data || []).map(formatSnapshot);
    return NextResponse.json({ success: true, snapshots });
  } catch (error) {
    console.error('Fetch snapshots error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}

// POST { portfolioId } — idempotent: returns existing snapshot for current
// gameweek if one exists, otherwise creates a new one from the portfolio's
// live players + formation. Relies on the UNIQUE(portfolio_id, gameweek,
// season_number) constraint to prevent duplicates under races.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { portfolioId } = body || {};

    if (!portfolioId) {
      return NextResponse.json(
        { success: false, error: 'portfolioId is required' },
        { status: 400 }
      );
    }

    /* Auth: only the portfolio owner may create snapshots. Reject if
       no session, or if the session user doesn't own this portfolio. */
    const sessionResult = requireSessionUserId(request);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const sessionUserId = sessionResult;

    // Fetch the live portfolio
    const { data: portfolio, error: portfolioError } = await supabase
      .from('portfolios')
      .select('*')
      .eq('id', portfolioId)
      .single();

    if (portfolioError || !portfolio) {
      return NextResponse.json(
        { success: false, error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    if (portfolio.user_id !== sessionUserId) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to snapshot this portfolio' },
        { status: 403 },
      );
    }

    const now = new Date();
    const seasonState = await getCurrentSeasonState(now);

    // Check for existing snapshot this gameweek (idempotency fast path)
    const { data: existing } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .eq('gameweek', seasonState.currentGameweek)
      .eq('season_number', seasonState.seasonNumber)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        snapshot: formatSnapshot(existing),
        created: false,
      });
    }

    const players: PortfolioPlayer[] = typeof portfolio.players === 'string'
      ? JSON.parse(portfolio.players)
      : (portfolio.players || []);

    const snapshotRow = {
      id: uuidv4(),
      portfolio_id: portfolioId,
      snapshot_date: currentWeekendKey(now),
      gameweek: seasonState.currentGameweek,
      season_number: seasonState.seasonNumber,
      players: JSON.stringify(players),
      formation: portfolio.formation,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('portfolio_snapshots')
      .insert(snapshotRow)
      .select()
      .single();

    if (insertError) {
      // If a concurrent write hit the UNIQUE constraint, re-fetch and return that row.
      const { data: race } = await supabase
        .from('portfolio_snapshots')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .eq('gameweek', seasonState.currentGameweek)
        .eq('season_number', seasonState.seasonNumber)
        .maybeSingle();

      if (race) {
        return NextResponse.json({
          success: true,
          snapshot: formatSnapshot(race),
          created: false,
        });
      }

      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      snapshot: formatSnapshot(inserted),
      created: true,
    });
  } catch (error) {
    console.error('Create snapshot error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create snapshot' },
      { status: 500 }
    );
  }
}

