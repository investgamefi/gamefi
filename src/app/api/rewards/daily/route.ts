import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireSessionUserId } from '@/lib/session';
import { DAILY_LOGIN_REWARDS } from '@/types';

// GET - Check if user can claim daily reward and get streak info
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }

    // Get user's streak info
    const { data: streak, error: streakError } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (streakError && streakError.code !== 'PGRST116') {
      console.error('Error fetching streak:', streakError);
      return NextResponse.json({ success: false, error: 'Failed to fetch streak info' }, { status: 500 });
    }

    // Check if user has already claimed today
    const today = new Date().toISOString().split('T')[0];
    const lastClaimDate = streak?.last_claim_date;
    const canClaim = !lastClaimDate || lastClaimDate < today;

    // Calculate streak continuation
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const isStreakActive = lastClaimDate === yesterdayStr;
    const currentStreak = streak?.current_streak || 0;
    const nextStreakDay = canClaim ? (isStreakActive ? currentStreak + 1 : 1) : currentStreak;

    // Calculate potential reward
    const streakDayMod = ((nextStreakDay - 1) % 7) + 1;
    const baseXp = DAILY_LOGIN_REWARDS.BASE_XP;
    const streakBonus = streakDayMod === 7 ? DAILY_LOGIN_REWARDS.STREAK_7_BONUS : 0;
    const potentialReward = baseXp + streakBonus;

    return NextResponse.json({
      success: true,
      canClaim,
      streak: {
        currentStreak: streak?.current_streak || 0,
        longestStreak: streak?.longest_streak || 0,
        lastClaimDate: streak?.last_claim_date,
        totalDaysClaimed: streak?.total_days_claimed || 0,
      },
      nextReward: {
        streakDay: streakDayMod,
        baseXp,
        streakBonus,
        totalXp: potentialReward,
      },
    });
  } catch (error) {
    console.error('Daily reward check error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// POST - Claim daily reward
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    /* Auth: session is the source of truth. Body userId optional but
       must match session if present. */
    const sessionResult = requireSessionUserId(request, userId);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const sessionUserId = sessionResult;

    // Get current streak info
    const { data: streak } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', sessionUserId)
      .single();

    const today = new Date().toISOString().split('T')[0];
    const lastClaimDate = streak?.last_claim_date;

    // Check if already claimed today
    if (lastClaimDate === today) {
      return NextResponse.json({ success: false, error: 'Already claimed today' }, { status: 400 });
    }

    // Calculate new streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const isStreakContinued = lastClaimDate === yesterdayStr;
    const newStreak = isStreakContinued ? (streak?.current_streak || 0) + 1 : 1;
    const longestStreak = Math.max(newStreak, streak?.longest_streak || 0);

    // Calculate XP reward
    const streakDayMod = ((newStreak - 1) % 7) + 1;
    const baseXp = DAILY_LOGIN_REWARDS.BASE_XP;
    const streakBonus = streakDayMod === 7 ? DAILY_LOGIN_REWARDS.STREAK_7_BONUS : 0;
    const totalXp = baseXp + streakBonus;

    // Update or create streak record
    const { error: upsertError } = await supabase
      .from('user_streaks')
      .upsert({
        user_id: sessionUserId,
        current_streak: newStreak,
        longest_streak: longestStreak,
        last_claim_date: today,
        total_days_claimed: (streak?.total_days_claimed || 0) + 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Error updating streak:', upsertError);
      return NextResponse.json({ success: false, error: 'Failed to update streak' }, { status: 500 });
    }

    // Record the daily reward
    const { error: rewardError } = await supabase
      .from('daily_rewards')
      .insert({
        user_id: sessionUserId,
        xp_awarded: totalXp,
        streak_day: streakDayMod,
        streak_bonus: streakBonus,
      });

    if (rewardError) {
      console.error('Error recording reward:', rewardError);
    }

    // Update user's XP
    const { error: xpError } = await supabase.rpc('increment_user_xp', {
      p_user_id: sessionUserId,
      p_xp_amount: totalXp,
    });

    // Fallback if RPC doesn't exist
    if (xpError) {
      await supabase
        .from('users')
        .update({ xp: supabase.rpc('', {}) })
        .eq('id', sessionUserId);

      // Direct update as fallback
      const { data: user } = await supabase
        .from('users')
        .select('xp')
        .eq('id', sessionUserId)
        .single();

      if (user) {
        await supabase
          .from('users')
          .update({ xp: (user.xp || 0) + totalXp })
          .eq('id', sessionUserId);
      }
    }

    return NextResponse.json({
      success: true,
      reward: {
        xpAwarded: totalXp,
        streakDay: streakDayMod,
        baseXp,
        streakBonus,
      },
      streak: {
        currentStreak: newStreak,
        longestStreak,
        totalDaysClaimed: (streak?.total_days_claimed || 0) + 1,
      },
    });
  } catch (error) {
    console.error('Daily reward claim error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
