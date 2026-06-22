import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { requireSessionUserId } from '@/lib/session';
import {
  Challenge,
  ChallengeType,
  ChallengeStatus,
  ChallengeTimeframe,
  NotificationType,
  CHALLENGE_XP,
  MAX_ACTIVE_CHALLENGES,
  CHALLENGE_TIMEFRAMES,
} from '@/types';
import { fetchYahooHistorical } from '@/lib/yahooHistorical';

// Helper to create notification
async function createNotification(
  userId: string,
  type: NotificationType,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      id: uuidv4(),
      user_id: userId,
      type,
      message,
      is_read: false,
      created_at: new Date().toISOString(),
      data: data || {},
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

// Helper to convert DB record to Challenge
function dbToChallenge(db: Record<string, unknown>): Challenge {
  return {
    id: db.id as string,
    type: db.type as ChallengeType,
    status: db.status as ChallengeStatus,
    challengerId: db.challenger_id as string,
    challengerPortfolioId: db.challenger_portfolio_id as string,
    opponentId: db.opponent_id as string | null,
    opponentPortfolioId: db.opponent_portfolio_id as string | null,
    opponentSymbol: (db.opponent_symbol as string | null) ?? null,
    timeframe: db.timeframe as ChallengeTimeframe,
    startDate: db.start_date as string | null,
    endDate: db.end_date as string | null,
    challengerStartValue: db.challenger_start_value as number | null,
    challengerEndValue: db.challenger_end_value as number | null,
    opponentStartValue: db.opponent_start_value as number | null,
    opponentEndValue: db.opponent_end_value as number | null,
    challengerReturnPercent: db.challenger_return_percent as number | null,
    opponentReturnPercent: db.opponent_return_percent as number | null,
    winnerId: db.winner_id as string | null,
    xpAwarded: db.xp_awarded as number | null,
    createdAt: db.created_at as string,
    settledAt: db.settled_at as string | null,
  };
}

// GET - Fetch challenges for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }

    // Fetch challenges where user is either challenger or opponent
    let query = supabase
      .from('challenges')
      .select('*')
      .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data: challenges, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Fetch user and portfolio details for each challenge
    const formattedChallenges: Challenge[] = [];

    for (const c of challenges || []) {
      const challenge = dbToChallenge(c);

      // Get challenger details
      const { data: challenger } = await supabase
        .from('users')
        .select('username, avatar')
        .eq('id', challenge.challengerId)
        .single();

      const { data: challengerPortfolio } = await supabase
        .from('portfolios')
        .select('name')
        .eq('id', challenge.challengerPortfolioId)
        .single();

      challenge.challengerUsername = challenger?.username;
      challenge.challengerAvatar = challenger?.avatar;
      challenge.challengerPortfolioName = challengerPortfolio?.name;

      // Get opponent details if user challenge
      if (challenge.opponentId) {
        const { data: opponent } = await supabase
          .from('users')
          .select('username, avatar')
          .eq('id', challenge.opponentId)
          .single();

        challenge.opponentUsername = opponent?.username;
        challenge.opponentAvatar = opponent?.avatar;

        if (challenge.opponentPortfolioId) {
          const { data: opponentPortfolio } = await supabase
            .from('portfolios')
            .select('name')
            .eq('id', challenge.opponentPortfolioId)
            .single();
          challenge.opponentPortfolioName = opponentPortfolio?.name;
        }
      } else if (challenge.type === 'sp500') {
        challenge.opponentUsername = 'S&P 500';
        challenge.opponentAvatar = '/sp500-logo.png';
        challenge.opponentPortfolioName = 'SPY Index';
      } else if (challenge.type === 'etf' && challenge.opponentSymbol) {
        /* ETF challenges: surface the ticker as the opponent label so
           cards/lists render "QQQ" / "VTI" instead of an empty slot. */
        challenge.opponentUsername = challenge.opponentSymbol;
        challenge.opponentAvatar = '/sp500-logo.png';
        challenge.opponentPortfolioName = `${challenge.opponentSymbol} Index`;
      }

      formattedChallenges.push(challenge);
    }

    // Separate pending challenges (where user is either challenger or opponent and status is pending)
    const pendingInvites = formattedChallenges.filter(
      (c) => c.status === 'pending' && (c.opponentId === userId || c.challengerId === userId)
    );

    const activeChallenges = formattedChallenges.filter(
      (c) => c.status === 'active'
    );

    const completedChallenges = formattedChallenges.filter(
      (c) => c.status === 'completed'
    );

    return NextResponse.json({
      success: true,
      challenges: formattedChallenges,
      pendingInvites,
      activeChallenges,
      completedChallenges,
    });
  } catch (error) {
    console.error('Fetch challenges error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch challenges' },
      { status: 500 }
    );
  }
}

// POST - Create a new challenge
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      challengerId,
      challengerPortfolioId,
      type,
      timeframe,
      opponentId,
      opponentPortfolioId,
      opponentSymbol,
    } = body as {
      challengerId: string;
      challengerPortfolioId: string;
      type: ChallengeType;
      timeframe: ChallengeTimeframe;
      opponentId?: string;
      opponentPortfolioId?: string;
      opponentSymbol?: string;
    };

    // Validate required fields
    if (!challengerPortfolioId || !type || !timeframe) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    /* Auth: challengerId is whatever the session says it is. Body
       challengerId is optional but if present must match. */
    const sessionResult = requireSessionUserId(request, challengerId);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const sessionChallengerId = sessionResult;

    // Validate type
    if (type !== 'sp500' && type !== 'user' && type !== 'etf') {
      return NextResponse.json(
        { success: false, error: 'Invalid challenge type' },
        { status: 400 }
      );
    }

    // User challenges require opponent
    if (type === 'user' && (!opponentId || !opponentPortfolioId)) {
      return NextResponse.json(
        { success: false, error: 'User challenges require an opponent' },
        { status: 400 }
      );
    }

    /* ETF challenges require a ticker symbol. We validate it against
       Yahoo Finance live — bogus tickers (e.g. ZZZZZZ) come back ok=false
       and we reject the request before persisting. Costs one Yahoo
       round-trip per ETF challenge creation, which is acceptable. */
    let normalizedEtfSymbol: string | null = null;
    if (type === 'etf') {
      if (!opponentSymbol || typeof opponentSymbol !== 'string') {
        return NextResponse.json(
          { success: false, error: 'ETF challenges require a ticker symbol' },
          { status: 400 }
        );
      }

      const candidate = opponentSymbol.trim().toUpperCase();
      /* Pull ~1mo of data to confirm the ticker exists. We don't use
         the data here — the settle/live routes refetch for the actual
         period. Cheap enough; Yahoo returns 404 on unknown tickers. */
      const probe = await fetchYahooHistorical({
        symbol: candidate,
        timeframe: '1M',
      });

      if (!probe.ok || probe.data.length === 0) {
        return NextResponse.json(
          { success: false, error: `Symbol "${candidate}" not found on Yahoo Finance` },
          { status: 400 }
        );
      }

      normalizedEtfSymbol = candidate;
    }

    /* Verify the challenger actually owns challengerPortfolioId.
       Without this check, anyone with a session could create a fixture
       wagering somebody else's squad. */
    {
      const { data: ownedPortfolio } = await supabase
        .from('portfolios')
        .select('user_id')
        .eq('id', challengerPortfolioId)
        .single();
      if (!ownedPortfolio || ownedPortfolio.user_id !== sessionChallengerId) {
        return NextResponse.json(
          { success: false, error: 'Not authorized to challenge with that squad' },
          { status: 403 },
        );
      }
    }

    // Get user's current XP and active challenge count
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('xp')
      .eq('id', sessionChallengerId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Count active challenges (pending + active)
    const { count, error: countError } = await supabase
      .from('challenges')
      .select('id', { count: 'exact', head: true })
      .or(`challenger_id.eq.${sessionChallengerId},opponent_id.eq.${sessionChallengerId}`)
      .in('status', ['pending', 'active']);

    if (countError) {
      return NextResponse.json(
        { success: false, error: 'Failed to check active challenges' },
        { status: 500 }
      );
    }

    if ((count || 0) >= MAX_ACTIVE_CHALLENGES) {
      return NextResponse.json(
        {
          success: false,
          error: `Maximum ${MAX_ACTIVE_CHALLENGES} active challenges allowed`,
        },
        { status: 400 }
      );
    }

    // Check XP requirement — base XP only; multiplier applies at settle
    const requiredXp =
      type === 'sp500'
        ? CHALLENGE_XP.VS_SP500
        : type === 'etf'
        ? CHALLENGE_XP.VS_ETF
        : CHALLENGE_XP.VS_USER;
    if (user.xp < requiredXp) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient XP. Need ${requiredXp} XP to cover potential loss.`,
        },
        { status: 400 }
      );
    }

    // Calculate dates
    const now = new Date();
    const timeframeDays = CHALLENGE_TIMEFRAMES.find((t) => t.value === timeframe)?.days || 7;
    const endDate = new Date(now.getTime() + timeframeDays * 24 * 60 * 60 * 1000);

    /* sp500 + etf challenges start immediately (no opponent to wait on);
       user challenges go pending until the opponent accepts. */
    const startsImmediately = type === 'sp500' || type === 'etf';
    const status: ChallengeStatus = startsImmediately ? 'active' : 'pending';
    const startDate = startsImmediately ? now.toISOString() : null;
    const calculatedEndDate = startsImmediately ? endDate.toISOString() : null;

    // Create challenge
    const challengeId = uuidv4();
    const { data: newChallenge, error: insertError } = await supabase
      .from('challenges')
      .insert({
        id: challengeId,
        type,
        status,
        challenger_id: sessionChallengerId,
        challenger_portfolio_id: challengerPortfolioId,
        opponent_id: type === 'user' ? opponentId : null,
        opponent_portfolio_id: type === 'user' ? opponentPortfolioId : null,
        opponent_symbol: normalizedEtfSymbol,
        timeframe,
        start_date: startDate,
        end_date: calculatedEndDate,
        challenger_start_value: startsImmediately ? 10000 : null, // Will be calculated from portfolio
        opponent_start_value: startsImmediately ? 10000 : null,
        created_at: now.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    const challenge = dbToChallenge(newChallenge);

    // Send notification to opponent for user challenges
    if (type === 'user' && opponentId) {
      const { data: challenger } = await supabase
        .from('users')
        .select('username')
        .eq('id', sessionChallengerId)
        .single();

      await createNotification(
        opponentId,
        'challenge_received',
        `${challenger?.username || 'Someone'} has challenged you to a portfolio battle!`,
        { challengeId: challenge.id, challengerId: sessionChallengerId }
      );
    }

    return NextResponse.json({
      success: true,
      challenge,
      message:
        type === 'sp500'
          ? 'Challenge started! Track your performance against the S&P 500.'
          : type === 'etf'
          ? `Challenge started! Track your performance against ${normalizedEtfSymbol}.`
          : 'Challenge sent! Waiting for opponent to accept.',
    });
  } catch (error) {
    console.error('Create challenge error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create challenge' },
      { status: 500 }
    );
  }
}

// PUT - Accept, decline, or cancel a challenge
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { challengeId, action, userId, portfolioId } = body as {
      challengeId: string;
      action: 'accept' | 'decline' | 'cancel';
      userId: string;
      portfolioId?: string;
    };

    if (!challengeId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    /* Auth: session owns the action. Body userId, if present, must
       match the session. */
    const sessionResult = requireSessionUserId(request, userId);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const sessionUserId = sessionResult;

    // Get the challenge
    const { data: challenge, error: fetchError } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (fetchError || !challenge) {
      return NextResponse.json(
        { success: false, error: 'Challenge not found' },
        { status: 404 }
      );
    }

    // Validate action based on user role (session id, not body)
    const isChallenger = challenge.challenger_id === sessionUserId;
    const isOpponent = challenge.opponent_id === sessionUserId;

    if (!isChallenger && !isOpponent) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to modify this challenge' },
        { status: 403 }
      );
    }

    if (action === 'accept') {
      // Only opponent can accept
      if (!isOpponent) {
        return NextResponse.json(
          { success: false, error: 'Only the opponent can accept a challenge' },
          { status: 403 }
        );
      }

      if (challenge.status !== 'pending') {
        return NextResponse.json(
          { success: false, error: 'Challenge is not pending' },
          { status: 400 }
        );
      }

      /* Ownership of the opponent's portfolioId. The accepter passes
         which of THEIR squads to field; reject if they don't own it.
         Without this check, anyone accepting could wager another
         user's squad. */
      if (portfolioId) {
        const { data: ownedPortfolio } = await supabase
          .from('portfolios')
          .select('user_id')
          .eq('id', portfolioId)
          .single();
        if (!ownedPortfolio || ownedPortfolio.user_id !== sessionUserId) {
          return NextResponse.json(
            { success: false, error: 'Not authorized to accept with that squad' },
            { status: 403 },
          );
        }
      }

      // Check opponent's XP
      const { data: opponent } = await supabase
        .from('users')
        .select('xp')
        .eq('id', sessionUserId)
        .single();

      if (!opponent || opponent.xp < CHALLENGE_XP.VS_USER) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient XP. Need ${CHALLENGE_XP.VS_USER} XP to accept.`,
          },
          { status: 400 }
        );
      }

      // Check opponent's active challenge count
      const { count } = await supabase
        .from('challenges')
        .select('id', { count: 'exact', head: true })
        .or(`challenger_id.eq.${sessionUserId},opponent_id.eq.${sessionUserId}`)
        .in('status', ['pending', 'active']);

      if ((count || 0) >= MAX_ACTIVE_CHALLENGES) {
        return NextResponse.json(
          {
            success: false,
            error: `Maximum ${MAX_ACTIVE_CHALLENGES} active challenges allowed`,
          },
          { status: 400 }
        );
      }

      // Calculate start and end dates
      const now = new Date();
      const timeframeDays =
        CHALLENGE_TIMEFRAMES.find((t) => t.value === challenge.timeframe)?.days || 7;
      const endDate = new Date(now.getTime() + timeframeDays * 24 * 60 * 60 * 1000);

      // Update challenge to active
      const { data: updated, error: updateError } = await supabase
        .from('challenges')
        .update({
          status: 'active',
          opponent_portfolio_id: portfolioId || challenge.opponent_portfolio_id,
          start_date: now.toISOString(),
          end_date: endDate.toISOString(),
          challenger_start_value: 10000,
          opponent_start_value: 10000,
        })
        .eq('id', challengeId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 500 }
        );
      }

      // Notify challenger that challenge was accepted
      const { data: accepter } = await supabase
        .from('users')
        .select('username')
        .eq('id', sessionUserId)
        .single();

      await createNotification(
        challenge.challenger_id,
        'challenge_accepted',
        `${accepter?.username || 'Your opponent'} accepted your challenge! The competition begins now.`,
        { challengeId: challenge.id }
      );

      return NextResponse.json({
        success: true,
        challenge: dbToChallenge(updated),
        message: 'Challenge accepted! The competition has begun.',
      });
    }

    if (action === 'decline') {
      // Only opponent can decline
      if (!isOpponent) {
        return NextResponse.json(
          { success: false, error: 'Only the opponent can decline a challenge' },
          { status: 403 }
        );
      }

      if (challenge.status !== 'pending') {
        return NextResponse.json(
          { success: false, error: 'Challenge is not pending' },
          { status: 400 }
        );
      }

      const { data: updated, error: updateError } = await supabase
        .from('challenges')
        .update({ status: 'declined' })
        .eq('id', challengeId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 500 }
        );
      }

      // Notify challenger that challenge was declined
      const { data: decliner } = await supabase
        .from('users')
        .select('username')
        .eq('id', sessionUserId)
        .single();

      await createNotification(
        challenge.challenger_id,
        'challenge_declined',
        `${decliner?.username || 'Your opponent'} declined your challenge.`,
        { challengeId: challenge.id }
      );

      return NextResponse.json({
        success: true,
        challenge: dbToChallenge(updated),
        message: 'Challenge declined.',
      });
    }

    if (action === 'cancel') {
      // Only challenger can cancel, and only if pending
      if (!isChallenger) {
        return NextResponse.json(
          { success: false, error: 'Only the challenger can cancel' },
          { status: 403 }
        );
      }

      if (challenge.status !== 'pending') {
        return NextResponse.json(
          { success: false, error: 'Can only cancel pending challenges' },
          { status: 400 }
        );
      }

      const { data: updated, error: updateError } = await supabase
        .from('challenges')
        .update({ status: 'cancelled' })
        .eq('id', challengeId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        challenge: dbToChallenge(updated),
        message: 'Challenge cancelled.',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Update challenge error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update challenge' },
      { status: 500 }
    );
  }
}
