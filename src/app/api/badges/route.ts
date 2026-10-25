import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdminUserId, requireSessionUserId } from '@/lib/session';
import { ACHIEVEMENT_BADGES, AchievementBadge } from '@/types';

// GET - Get user's badges
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }

    // Get user's earned badges
    const { data: userBadges, error } = await supabase
      .from('user_badges')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) {
      console.error('Error fetching badges:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch badges' }, { status: 500 });
    }

    // Map badge IDs to full badge info
    const earnedBadges = userBadges?.map(ub => {
      const badge = ACHIEVEMENT_BADGES.find(b => b.id === ub.badge_id);
      return badge ? { ...badge, earnedAt: ub.earned_at } : null;
    }).filter(Boolean) || [];

    // Get available (not yet earned) badges
    const earnedIds = new Set(userBadges?.map(ub => ub.badge_id) || []);
    const availableBadges = ACHIEVEMENT_BADGES.filter(b => !earnedIds.has(b.id));

    return NextResponse.json({
      success: true,
      earnedBadges,
      availableBadges,
      totalEarned: earnedBadges.length,
      totalAvailable: ACHIEVEMENT_BADGES.length,
    });
  } catch (error) {
    console.error('Badges fetch error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// POST - Award a badge to user.
// Admin-only: it grants arbitrary badges plus their XP to any user id,
// so even a logged-in user calling it for themselves would be an XP
// cheat. Earned badges come from PUT below, which checks real stats.
export async function POST(request: NextRequest) {
  try {
    const admin = requireAdminUserId(request);
    if (admin instanceof NextResponse) return admin;

    const { userId, badgeId } = await request.json();

    if (!userId || !badgeId) {
      return NextResponse.json({ success: false, error: 'User ID and Badge ID required' }, { status: 400 });
    }

    // Verify badge exists
    const badge = ACHIEVEMENT_BADGES.find(b => b.id === badgeId);
    if (!badge) {
      return NextResponse.json({ success: false, error: 'Invalid badge ID' }, { status: 400 });
    }

    // Check if already earned
    const { data: existing } = await supabase
      .from('user_badges')
      .select('id')
      .eq('user_id', userId)
      .eq('badge_id', badgeId)
      .single();

    if (existing) {
      return NextResponse.json({ success: false, error: 'Badge already earned' }, { status: 400 });
    }

    // Award the badge
    const { error: insertError } = await supabase
      .from('user_badges')
      .insert({
        user_id: userId,
        badge_id: badgeId,
      });

    if (insertError) {
      console.error('Error awarding badge:', insertError);
      return NextResponse.json({ success: false, error: 'Failed to award badge' }, { status: 500 });
    }

    // Award XP for the badge
    const { data: user } = await supabase
      .from('users')
      .select('xp')
      .eq('id', userId)
      .single();

    if (user) {
      await supabase
        .from('users')
        .update({ xp: (user.xp || 0) + badge.xpReward })
        .eq('id', userId);
    }

    // Create notification
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'badge_earned',
      message: `You earned the "${badge.name}" badge! +${badge.xpReward} XP`,
      data: { badgeId, xpReward: badge.xpReward },
    });

    return NextResponse.json({
      success: true,
      badge,
      xpAwarded: badge.xpReward,
    });
  } catch (error) {
    console.error('Badge award error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// PUT - Check and award badges based on the signed-in user's stats
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionResult = requireSessionUserId(request, body.userId);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const userId = sessionResult;

    // Get user stats
    const { data: stats } = await supabase
      .from('user_statistics')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Get user's current badges
    const { data: userBadges } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);

    const earnedIds = new Set(userBadges?.map(ub => ub.badge_id) || []);
    const newBadges: AchievementBadge[] = [];

    // Check each badge's requirements
    for (const badge of ACHIEVEMENT_BADGES) {
      if (earnedIds.has(badge.id)) continue;

      let earned = false;
      const { type, value } = badge.requirement;

      switch (type) {
        case 'portfolios_created':
          earned = (stats?.portfolios_created || 0) >= value;
          break;
        case 'challenges_won':
          earned = (stats?.challenges_won || 0) >= value;
          break;
        case 'win_streak':
          earned = (stats?.best_win_streak || 0) >= value;
          break;
        case 'beat_sp500':
          earned = (stats?.sp500_beaten_count || 0) >= value;
          break;
        case 'login_streak':
          // Check from user_streaks table
          const { data: streak } = await supabase
            .from('user_streaks')
            .select('longest_streak')
            .eq('user_id', userId)
            .single();
          earned = (streak?.longest_streak || 0) >= value;
          break;
        case 'referrals':
          earned = (stats?.referrals_completed || 0) >= value;
          break;
        case 'lessons_completed':
          earned = (stats?.lessons_completed || 0) >= value;
          break;
        // Add more cases as needed
      }

      if (earned) {
        // Award the badge
        const { error } = await supabase
          .from('user_badges')
          .insert({ user_id: userId, badge_id: badge.id });

        if (!error) {
          newBadges.push(badge);

          // Award XP
          const { data: user } = await supabase
            .from('users')
            .select('xp')
            .eq('id', userId)
            .single();

          if (user) {
            await supabase
              .from('users')
              .update({ xp: (user.xp || 0) + badge.xpReward })
              .eq('id', userId);
          }

          // Create notification
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'badge_earned',
            message: `You earned the "${badge.name}" badge! +${badge.xpReward} XP`,
            data: { badgeId: badge.id, xpReward: badge.xpReward },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      newBadges,
      totalAwarded: newBadges.length,
    });
  } catch (error) {
    console.error('Badge check error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
