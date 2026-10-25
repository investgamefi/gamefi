import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  CHALLENGE_XP,
  CHALLENGE_TIMEFRAME_XP_MULT,
  ChallengeTimeframe,
  Portfolio,
} from '@/types';
import {
  fetchSP500ReturnForPeriod,
  fetchBenchmarkReturnForPeriod,
  calculatePortfolioReturnForPeriod,
  formatDateString,
} from '@/lib/challengePerformance';
import { requireCronSecret } from '@/lib/session';

/* Still needed for the autoSettle path below, which fans out by POSTing
   back to /api/challenges/settle once per challenge. The settle math
   itself no longer uses baseUrl — that round-trip went away when we
   stopped proxying Yahoo through our own API. */
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

/* Resolve the base XP at stake by challenge type. */
function baseXpForType(type: string): number {
  if (type === 'sp500') return CHALLENGE_XP.VS_SP500;
  if (type === 'etf') return CHALLENGE_XP.VS_ETF;
  return CHALLENGE_XP.VS_USER;
}

/* Apply the timeframe multiplier — longer fixtures pay more. Rounded
   to integer XP so the user-facing total never has fractional dust. */
function xpWithMultiplier(base: number, timeframe: ChallengeTimeframe): number {
  const mult = CHALLENGE_TIMEFRAME_XP_MULT[timeframe] ?? 1.0;
  return Math.round(base * mult);
}

// POST - Settle completed challenges.
// Server-to-server only (no client caller; the daily cron in
// /api/cron/settle-challenges does the real settling). Locked behind
// the cron secret so the public can't trigger XP payouts or race the
// cron into double-settling.
export async function POST(request: NextRequest) {
  try {
    const denied = requireCronSecret(request);
    if (denied) return denied;

    const body = await request.json();
    const { challengeId } = body as { challengeId?: string };

    // Build query for challenges that need settling
    let query = supabase
      .from('challenges')
      .select('*')
      .eq('status', 'active')
      .lte('end_date', new Date().toISOString());

    // If specific challenge ID provided, only settle that one
    if (challengeId) {
      query = query.eq('id', challengeId);
    }

    const { data: challenges, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    if (!challenges || challenges.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No challenges to settle',
        settledCount: 0,
      });
    }

    const settledChallenges = [];
    const errors: string[] = [];

    for (const challenge of challenges) {
      try {
        const startDate = challenge.start_date?.split('T')[0] || formatDateString(new Date());
        const endDate = challenge.end_date?.split('T')[0] || formatDateString(new Date());

        // Fetch challenger portfolio
        const { data: challengerPortfolioData } = await supabase
          .from('portfolios')
          .select('*')
          .eq('id', challenge.challenger_portfolio_id)
          .single();

        let challengerReturnPercent = 0;

        if (challengerPortfolioData) {
          const challengerPortfolio: Portfolio = {
            id: challengerPortfolioData.id,
            userId: challengerPortfolioData.user_id,
            name: challengerPortfolioData.name,
            description: challengerPortfolioData.description,
            formation: challengerPortfolioData.formation,
            players: typeof challengerPortfolioData.players === 'string'
              ? JSON.parse(challengerPortfolioData.players)
              : challengerPortfolioData.players,
            createdAt: challengerPortfolioData.created_at,
            updatedAt: challengerPortfolioData.updated_at,
            isPublic: challengerPortfolioData.is_public,
            likes: [],
            clonedFrom: challengerPortfolioData.cloned_from,
            cloneCount: challengerPortfolioData.clone_count,
            tags: challengerPortfolioData.tags || [],
          };

          // Calculate real portfolio return
          challengerReturnPercent = await calculatePortfolioReturnForPeriod(
            challengerPortfolio,
            startDate,
            endDate
          );
        }

        // Calculate opponent return
        let opponentReturnPercent = 0;

        if (challenge.type === 'sp500') {
          // Fetch real S&P 500 return
          opponentReturnPercent = await fetchSP500ReturnForPeriod(startDate, endDate);
        } else if (challenge.type === 'etf' && challenge.opponent_symbol) {
          opponentReturnPercent = await fetchBenchmarkReturnForPeriod(
            challenge.opponent_symbol,
            startDate,
            endDate,
          );
        } else if (challenge.opponent_portfolio_id) {
          // Fetch opponent portfolio and calculate return
          const { data: opponentPortfolioData } = await supabase
            .from('portfolios')
            .select('*')
            .eq('id', challenge.opponent_portfolio_id)
            .single();

          if (opponentPortfolioData) {
            const opponentPortfolio: Portfolio = {
              id: opponentPortfolioData.id,
              userId: opponentPortfolioData.user_id,
              name: opponentPortfolioData.name,
              description: opponentPortfolioData.description,
              formation: opponentPortfolioData.formation,
              players: typeof opponentPortfolioData.players === 'string'
                ? JSON.parse(opponentPortfolioData.players)
                : opponentPortfolioData.players,
              createdAt: opponentPortfolioData.created_at,
              updatedAt: opponentPortfolioData.updated_at,
              isPublic: opponentPortfolioData.is_public,
              likes: [],
              clonedFrom: opponentPortfolioData.cloned_from,
              cloneCount: opponentPortfolioData.clone_count,
              tags: opponentPortfolioData.tags || [],
            };

            opponentReturnPercent = await calculatePortfolioReturnForPeriod(
              opponentPortfolio,
              startDate,
              endDate
            );
          }
        }

        // Determine winner
        let winnerId: string | null = null;
        let xpAwarded = 0;
        const baseXp = baseXpForType(challenge.type);
        const totalXp = xpWithMultiplier(baseXp, challenge.timeframe as ChallengeTimeframe);
        const isBenchmark = challenge.type === 'sp500' || challenge.type === 'etf';
        /* Sentinel string used for benchmark winners. 'sp500' kept for
           backwards-compat with rows already in the DB; etf challenges
           use the actual ticker (e.g. 'QQQ') so leaderboard/reporting
           can distinguish which benchmark beat the user. */
        const benchmarkSentinel =
          challenge.type === 'sp500'
            ? 'sp500'
            : challenge.opponent_symbol || 'etf';

        if (challengerReturnPercent > opponentReturnPercent) {
          winnerId = challenge.challenger_id;
          xpAwarded = totalXp;
        } else if (opponentReturnPercent > challengerReturnPercent) {
          winnerId = isBenchmark ? benchmarkSentinel : challenge.opponent_id;
          xpAwarded = totalXp;
        }
        // If equal, it's a draw - no XP awarded

        // Calculate end values based on returns
        const challengerEndValue = (challenge.challenger_start_value || 10000) * (1 + challengerReturnPercent / 100);
        const opponentEndValue = (challenge.opponent_start_value || 10000) * (1 + opponentReturnPercent / 100);

        // Update challenge with results
        const { data: updated, error: updateError } = await supabase
          .from('challenges')
          .update({
            status: 'completed',
            challenger_end_value: challengerEndValue,
            opponent_end_value: opponentEndValue,
            challenger_return_percent: challengerReturnPercent,
            opponent_return_percent: opponentReturnPercent,
            winner_id: winnerId,
            xp_awarded: xpAwarded,
            settled_at: new Date().toISOString(),
          })
          .eq('id', challenge.id)
          .select()
          .single();

        if (updateError) {
          errors.push(`Failed to settle challenge ${challenge.id}: ${updateError.message}`);
          continue;
        }

        // Award/deduct XP and create notifications
        if (xpAwarded > 0) {
          if (isBenchmark) {
            /* Benchmark (S&P or ETF): only the challenger has XP at
               stake. Winner gets +xp, loser gets -xp. */
            const xpChange = winnerId === challenge.challenger_id ? xpAwarded : -xpAwarded;
            await updateUserXP(challenge.challenger_id, xpChange);

            const opponentLabel =
              challenge.type === 'sp500'
                ? 'S&P 500'
                : challenge.opponent_symbol || 'the benchmark';

            await createChallengeNotification(
              challenge.challenger_id,
              winnerId === challenge.challenger_id ? 'challenge_won' : 'challenge_lost',
              challenge.id,
              Math.abs(xpChange),
              opponentLabel,
            );
          } else if (winnerId) {
            // VS User: winner gets XP, loser loses XP
            await updateUserXP(
              challenge.challenger_id,
              winnerId === challenge.challenger_id ? xpAwarded : -xpAwarded
            );
            await updateUserXP(
              challenge.opponent_id,
              winnerId === challenge.opponent_id ? xpAwarded : -xpAwarded
            );

            // Create notifications for both users
            const { data: winnerData } = await supabase
              .from('users')
              .select('username')
              .eq('id', winnerId)
              .single();

            await createChallengeNotification(
              challenge.challenger_id,
              winnerId === challenge.challenger_id ? 'challenge_won' : 'challenge_lost',
              challenge.id,
              xpAwarded,
              winnerData?.username || 'opponent'
            );

            await createChallengeNotification(
              challenge.opponent_id,
              winnerId === challenge.opponent_id ? 'challenge_won' : 'challenge_lost',
              challenge.id,
              xpAwarded,
              winnerData?.username || 'opponent'
            );
          }
        } else {
          // Draw - notify both users
          const drawOpponentLabel =
            challenge.type === 'sp500'
              ? 'S&P 500'
              : challenge.type === 'etf'
              ? challenge.opponent_symbol || 'the benchmark'
              : 'opponent';

          await createChallengeNotification(
            challenge.challenger_id,
            'challenge_draw',
            challenge.id,
            0,
            drawOpponentLabel,
          );

          if (challenge.opponent_id) {
            await createChallengeNotification(
              challenge.opponent_id,
              'challenge_draw',
              challenge.id,
              0,
              'opponent'
            );
          }
        }

        settledChallenges.push(updated);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Error settling challenge ${challenge.id}: ${errorMessage}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Settled ${settledChallenges.length} challenge(s)`,
      settledCount: settledChallenges.length,
      settledChallenges,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Settle challenges error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to settle challenges' },
      { status: 500 }
    );
  }
}

// Helper function to update user XP
async function updateUserXP(userId: string, xpChange: number): Promise<void> {
  const { data: user } = await supabase
    .from('users')
    .select('xp')
    .eq('id', userId)
    .single();

  if (user) {
    const newXp = Math.max(0, (user.xp || 0) + xpChange);
    await supabase
      .from('users')
      .update({ xp: newXp, updated_at: new Date().toISOString() })
      .eq('id', userId);
  }
}

// Helper function to create challenge notification
async function createChallengeNotification(
  userId: string,
  type: 'challenge_won' | 'challenge_lost' | 'challenge_draw' | 'challenge_received' | 'challenge_accepted',
  challengeId: string,
  xpAmount: number,
  opponentName: string
): Promise<void> {
  let message = '';

  switch (type) {
    case 'challenge_won':
      message = `You won your challenge against ${opponentName}! +${xpAmount} XP`;
      break;
    case 'challenge_lost':
      message = `You lost your challenge against ${opponentName}. -${xpAmount} XP`;
      break;
    case 'challenge_draw':
      message = `Your challenge against ${opponentName} ended in a draw!`;
      break;
    case 'challenge_received':
      message = `${opponentName} has challenged you to a portfolio battle!`;
      break;
    case 'challenge_accepted':
      message = `${opponentName} accepted your challenge! The competition begins now.`;
      break;
  }

  await supabase.from('notifications').insert({
    user_id: userId,
    type: type,
    message,
    is_read: false,
    created_at: new Date().toISOString(),
    data: { challengeId, xpAmount },
  });
}

// GET - Check for challenges that need settling (can be called by cron job)
export async function GET(request: NextRequest) {
  try {
    const denied = requireCronSecret(request);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const autoSettle = searchParams.get('autoSettle') === 'true';

    const { data: challengesToSettle, error } = await supabase
      .from('challenges')
      .select('id, type, challenger_id, end_date')
      .eq('status', 'active')
      .lte('end_date', new Date().toISOString());

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // If autoSettle is true, automatically settle all pending challenges
    if (autoSettle && challengesToSettle && challengesToSettle.length > 0) {
      /* WARNING: This self-POSTs back to /api/challenges/settle for
         every pending challenge. On Vercel preview deployments behind
         SSO this hits a 401 wall because the server-to-server fetch
         has no auth cookie, same trap that the live-returns and Yahoo
         calls used to fall into. No production callers right now, so
         leaving as-is. Real fix is to factor the per-challenge logic
         out of POST into a function the autoSettle path can call
         directly. */
      const baseUrl = getBaseUrl(request);

      const settleResults = await Promise.all(
        challengesToSettle.map(async (challenge) => {
          try {
            const response = await fetch(`${baseUrl}/api/challenges/settle`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                /* Forward the caller's cron bearer so the self-POST
                   passes the same guard this GET just passed. */
                Authorization: request.headers.get('authorization') || '',
              },
              body: JSON.stringify({ challengeId: challenge.id }),
            });
            return { id: challenge.id, success: response.ok };
          } catch {
            return { id: challenge.id, success: false };
          }
        })
      );

      return NextResponse.json({
        success: true,
        pendingSettlement: 0,
        settled: settleResults.filter((r) => r.success).length,
        failed: settleResults.filter((r) => !r.success).length,
      });
    }

    return NextResponse.json({
      success: true,
      pendingSettlement: challengesToSettle?.length || 0,
      challenges: challengesToSettle,
    });
  } catch (error) {
    console.error('Check challenges error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check challenges' },
      { status: 500 }
    );
  }
}
