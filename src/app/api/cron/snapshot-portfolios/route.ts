import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { getSeasonState, SeasonRow, currentWeekendKey } from '@/lib/season';
import { requireCronSecret } from '@/lib/session';

async function getCurrentSeasonState(now: Date) {
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

/**
 * Cron endpoint for taking weekly portfolio snapshots.
 *
 * Runs Friday 21:00 UTC. Iterates every public (is_public = true) portfolio
 * and inserts a snapshot for the current gameweek, skipping any that already
 * have one (idempotent via UNIQUE(portfolio_id, gameweek, season_number)).
 *
 * Auth: set CRON_SECRET env var; request must include `Authorization: Bearer <secret>`.
 * If CRON_SECRET is empty, the endpoint is refused in production and open only in local dev.
 */
export async function GET(request: NextRequest) {
  try {
    const denied = requireCronSecret(request);
    if (denied) return denied;

    const now = new Date();
    const seasonState = await getCurrentSeasonState(now);
    const snapshotDate = currentWeekendKey(now);

    // Fetch all public portfolios
    const { data: portfolios, error: fetchError } = await supabase
      .from('portfolios')
      .select('id, formation, players')
      .eq('is_public', true);

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    if (!portfolios || portfolios.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No public portfolios to snapshot',
        createdCount: 0,
        gameweek: seasonState.currentGameweek,
        seasonNumber: seasonState.seasonNumber,
        timestamp: now.toISOString(),
      });
    }

    // Pre-fetch existing snapshots for this gameweek to avoid one query per portfolio
    const portfolioRows = portfolios as Array<{ id: string; formation: string; players: unknown }>;
    const portfolioIds = portfolioRows.map((p) => p.id);
    const { data: existingRows } = await supabase
      .from('portfolio_snapshots')
      .select('portfolio_id')
      .eq('gameweek', seasonState.currentGameweek)
      .eq('season_number', seasonState.seasonNumber)
      .in('portfolio_id', portfolioIds);

    const alreadySnapshot = new Set(
      ((existingRows || []) as Array<{ portfolio_id: string }>).map((r) => r.portfolio_id)
    );

    const toInsert = portfolioRows
      .filter((p) => !alreadySnapshot.has(p.id))
      .map((p) => ({
        id: uuidv4(),
        portfolio_id: p.id,
        snapshot_date: snapshotDate,
        gameweek: seasonState.currentGameweek,
        season_number: seasonState.seasonNumber,
        players: typeof p.players === 'string' ? p.players : JSON.stringify(p.players || []),
        formation: p.formation,
      }));

    let createdCount = 0;
    const failed: { portfolioId: string; error: string }[] = [];

    if (toInsert.length > 0) {
      // Batch insert; ON CONFLICT (UNIQUE) will surface as an error — fall back
      // to per-row inserts so a single conflicting row doesn't drop the rest.
      const { error: batchError } = await supabase
        .from('portfolio_snapshots')
        .insert(toInsert);

      if (batchError) {
        for (const row of toInsert) {
          const { error: rowError } = await supabase
            .from('portfolio_snapshots')
            .insert(row);
          if (rowError) {
            // Likely a race with another caller — confirm row exists, otherwise record failure.
            const { data: confirm } = await supabase
              .from('portfolio_snapshots')
              .select('id')
              .eq('portfolio_id', row.portfolio_id)
              .eq('gameweek', seasonState.currentGameweek)
              .eq('season_number', seasonState.seasonNumber)
              .maybeSingle();
            if (!confirm) {
              failed.push({ portfolioId: row.portfolio_id, error: rowError.message });
            }
          } else {
            createdCount += 1;
          }
        }
      } else {
        createdCount = toInsert.length;
      }
    }

    return NextResponse.json({
      success: true,
      createdCount,
      skippedCount: portfolios.length - toInsert.length,
      failedCount: failed.length,
      failed: failed.length > 0 ? failed : undefined,
      gameweek: seasonState.currentGameweek,
      seasonNumber: seasonState.seasonNumber,
      snapshotDate,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Cron snapshot portfolios error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to snapshot portfolios' },
      { status: 500 }
    );
  }
}

// Allow POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
