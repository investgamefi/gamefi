import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireSessionUserId } from '@/lib/session';
import { TEAM_SLOT_UNLOCK_COST } from '@/types';

// GET - Fetch user(s) by id
//
// Two modes:
//  - ?id=X         → full single-user record (with followers, portfolios,
//                    badges — heavier, used by /profile/[id])
//  - ?ids=A,B,C    → batched LIGHT user objects (id, username, displayName,
//                    avatar). Used by leaderboard + LeaderboardTable to
//                    populate owner names without N round-trips.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');
    const batchIds = searchParams.get('ids');

    /* Batched-light path. One Supabase query, no joins. Returns a
       `users` object keyed by id so the client can lookup with O(1).
       The leaderboard page was waiting 1-2 seconds on N serial fetches
       — this collapses to a single ~150ms round-trip. */
    if (batchIds) {
      const ids = batchIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ success: true, users: {} });
      }
      if (ids.length > 200) {
        return NextResponse.json(
          { success: false, error: 'Too many ids (max 200 per request)' },
          { status: 400 },
        );
      }
      const { data: rows, error } = await supabase
        .from('users')
        .select('id, username, display_name, avatar')
        .in('id', ids);
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      const users: Record<string, { id: string; username: string; displayName: string; avatar: string }> = {};
      for (const r of rows || []) {
        users[r.id] = {
          id: r.id,
          username: r.username,
          displayName: r.display_name,
          avatar: r.avatar,
        };
      }
      return NextResponse.json({ success: true, users });
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID or ids required' }, { status: 400 });
    }

    const { data: dbUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Get followers, following, portfolios, badges
    const [followers, following, portfolios, badges] = await Promise.all([
      supabase.from('followers').select('follower_id').eq('following_id', userId),
      supabase.from('followers').select('following_id').eq('follower_id', userId),
      supabase.from('portfolios').select('id').eq('user_id', userId),
      supabase.from('badges').select('*').eq('user_id', userId),
    ]);

    const user = {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      displayName: dbUser.display_name,
      avatar: dbUser.avatar,
      bio: dbUser.bio,
      joinedAt: dbUser.joined_at,
      followers: followers.data?.map(f => f.follower_id) || [],
      following: following.data?.map(f => f.following_id) || [],
      portfolios: portfolios.data?.map(p => p.id) || [],
      totalRewards: dbUser.total_rewards,
      badges: badges.data?.map(b => ({
        id: b.id,
        name: b.name,
        description: b.description,
        icon: b.icon,
        earnedAt: b.earned_at,
      })) || [],
      level: dbUser.level,
      xp: dbUser.xp,
      maxTeams: dbUser.max_teams,
    };

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Fetch user error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch user' }, { status: 500 });
  }
}

// PUT - Update user
//
// Security: this route used to accept xp/level/max_teams/total_rewards
// from the body — anyone with a userId could grant themselves any XP
// they wanted. Those fields are now server-only; they're mutated
// internally by /api/training/completions, /api/squad/swap,
// /api/squad/transfer, /api/users (POST unlockTeamSlot), and
// /api/challenges/settle. This route is for profile fields only.
// requesterId must match the target id (band-aid for "no session
// layer yet" — proper signed cookies in a later sprint).
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, requesterId: bodyRequester, displayName, bio, avatar } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }

    /* Reject any attempt to mutate the gameplay-bearing columns via
       this route — they belong to the server. */
    const forbiddenKeys = ['xp', 'level', 'maxTeams', 'totalRewards', 'max_teams', 'total_rewards'];
    for (const k of forbiddenKeys) {
      if (body[k] !== undefined) {
        return NextResponse.json(
          { success: false, error: `Field "${k}" cannot be updated via this route.` },
          { status: 400 },
        );
      }
    }

    /* Identity check. Session header (signed cookie via middleware)
       wins over body-supplied requesterId. Both must agree if both
       are present. */
    const sessionUserId = request.headers.get('x-session-user-id');
    const effectiveRequester = sessionUserId || bodyRequester || id;
    if (sessionUserId && bodyRequester && sessionUserId !== bodyRequester) {
      return NextResponse.json(
        { success: false, error: 'Session userId does not match request requesterId.' },
        { status: 403 },
      );
    }
    if (effectiveRequester !== id) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to update this user.' },
        { status: 403 },
      );
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (displayName !== undefined) updateData.display_name = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatar = avatar;

    const { data: updated, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}

// POST - Unlock team slot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, action } = body;

    /* Auth: session is the source of truth. Body userId optional but
       must match session if present. */
    const sessionResult = requireSessionUserId(request, userId);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const sessionUserId = sessionResult;

    /* Accept both new name 'unlockSquadSlot' and legacy 'unlockTeamSlot'
       so older callers (cached JS, mobile) keep working through the
       vocab rename. */
    if (action === 'unlockSquadSlot' || action === 'unlockTeamSlot') {
      // Get current user
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('xp, max_teams')
        .eq('id', sessionUserId)
        .single();

      if (fetchError || !user) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      }

      if (user.xp < TEAM_SLOT_UNLOCK_COST) {
        return NextResponse.json(
          { success: false, error: 'Not enough XP to unlock team slot' },
          { status: 400 }
        );
      }

      // Update user
      const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({
          xp: user.xp - TEAM_SLOT_UNLOCK_COST,
          max_teams: (user.max_teams || 3) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionUserId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        xp: updated.xp,
        maxTeams: updated.max_teams,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('User action error:', error);
    return NextResponse.json({ success: false, error: 'Action failed' }, { status: 500 });
  }
}
