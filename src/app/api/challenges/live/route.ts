/* /api/challenges/live?userId=X
   For every active challenge involving this user, compute the current
   return percentages on both sides — challenger portfolio vs opponent
   (S&P, ETF benchmark, or rival portfolio). Reuses the same helpers
   the settle route uses, just passing end_date = today instead of the
   scheduled close.

   Returns { success, live: { [challengeId]: { challengerReturnPercent,
   opponentReturnPercent } } }.

   Notes:
   - Computation per challenge fans out across portfolio holdings, so
     this hits Yahoo Finance N times. Called once per page-mount, not
     in a polling loop — keep that contract on the client side.
   - Failures per-challenge are swallowed and just omitted from the
     response, so one broken ticker doesn't kill the whole batch. */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireSessionUserId } from '@/lib/session';
import { Portfolio, PortfolioPlayer } from '@/types';
import {
  fetchSP500ReturnForPeriod,
  fetchBenchmarkReturnForPeriod,
  calculatePortfolioReturnForPeriod,
  formatDateString,
} from '@/lib/challengePerformance';

interface DbPortfolioRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  formation: string;
  players: string | PortfolioPlayer[];
  is_public: boolean;
  cloned_from: string | null;
  clone_count: number;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

function mapPortfolio(data: DbPortfolioRow): Portfolio {
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    description: data.description,
    formation: data.formation as Portfolio['formation'],
    players: typeof data.players === 'string' ? JSON.parse(data.players) : data.players,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    isPublic: data.is_public,
    likes: [],
    clonedFrom: data.cloned_from,
    cloneCount: data.clone_count,
    tags: data.tags || [],
  };
}

export async function GET(request: NextRequest) {
  try {
    /* Session-bound: each call fans out to Yahoo per holding, so an
       open endpoint was also a free amplifier for anyone's user id. */
    const sessionResult = requireSessionUserId(request, request.nextUrl.searchParams.get('userId'));
    if (sessionResult instanceof NextResponse) return sessionResult;
    const userId = sessionResult;

    /* Pull every active challenge where this user is on either side. */
    const { data: challenges, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('status', 'active')
      .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`);

    if (error) {
      console.error('Fetch active challenges error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    if (!challenges || challenges.length === 0) {
      return NextResponse.json({ success: true, live: {} });
    }

    const todayStr = formatDateString(new Date());
    const live: Record<
      string,
      { challengerReturnPercent: number; opponentReturnPercent: number }
    > = {};

    /* Compute per-challenge in parallel. Each challenge fans out to
       Yahoo Finance for every ticker in the portfolio(s), so this is
       genuinely IO-bound — Promise.all helps throughput. */
    await Promise.all(
      challenges.map(async (challenge) => {
        try {
          const startDate = challenge.start_date?.split('T')[0] || todayStr;

          /* Challenger portfolio return */
          let challengerReturnPercent = 0;
          const { data: challengerPortfolioData } = await supabase
            .from('portfolios')
            .select('*')
            .eq('id', challenge.challenger_portfolio_id)
            .single();

          if (challengerPortfolioData) {
            challengerReturnPercent = await calculatePortfolioReturnForPeriod(
              mapPortfolio(challengerPortfolioData),
              startDate,
              todayStr,
            );
          }

          /* Opponent return — benchmark (S&P / ETF) or rival portfolio */
          let opponentReturnPercent = 0;
          if (challenge.type === 'sp500') {
            opponentReturnPercent = await fetchSP500ReturnForPeriod(
              startDate,
              todayStr,
            );
          } else if (challenge.type === 'etf' && challenge.opponent_symbol) {
            opponentReturnPercent = await fetchBenchmarkReturnForPeriod(
              challenge.opponent_symbol,
              startDate,
              todayStr,
            );
          } else if (challenge.opponent_portfolio_id) {
            const { data: opponentPortfolioData } = await supabase
              .from('portfolios')
              .select('*')
              .eq('id', challenge.opponent_portfolio_id)
              .single();

            if (opponentPortfolioData) {
              opponentReturnPercent = await calculatePortfolioReturnForPeriod(
                mapPortfolio(opponentPortfolioData),
                startDate,
                todayStr,
              );
            }
          }

          live[challenge.id] = {
            challengerReturnPercent,
            opponentReturnPercent,
          };
        } catch (e) {
          console.error(
            `Live computation failed for challenge ${challenge.id}:`,
            e,
          );
          /* Skip this challenge — keep going with the others */
        }
      }),
    );

    return NextResponse.json({ success: true, live });
  } catch (error) {
    console.error('Live returns exception:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to compute live returns' },
      { status: 500 },
    );
  }
}
