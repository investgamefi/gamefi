/* /api/training/completions
   - GET ?userId=X     → list a user's completed lessons (newest first)
   - POST { userId, lessonId, moduleId }
        → idempotent mark-complete. If a row already exists for this
          (user, lesson) we return the existing row WITHOUT awarding XP
          (prevents farming via uncheck-then-recheck). If new, insert,
          award LESSON_COMPLETION_XP to users.xp, and recompute level
          server-side so the dashboard / sidebar reflect it immediately.
*/

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireSessionUserId } from '@/lib/session';
import { LESSON_COMPLETION_XP } from '@/types';

/* Mirror of src/lib/utils.ts#calculateLevel so the server can persist a
   level value consistent with what the client displays. Keeping both in
   sync is a manual chore — if the thresholds ever change, update both. */
function calculateLevelServer(xp: number): number {
  if (xp < 1000) return 1;
  if (xp < 3000) return 2;
  if (xp < 5000) return 3;
  if (xp < 10000) return 4;
  return 5;
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId required' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('lesson_completions')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false });

    if (error) {
      console.error('Fetch completions error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    const completions = (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      lessonId: row.lesson_id,
      moduleId: row.module_id,
      completedAt: row.completed_at,
      xpAwarded: row.xp_awarded,
    }));

    return NextResponse.json({ success: true, completions });
  } catch (error) {
    console.error('Fetch completions exception:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch completions' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, lessonId, moduleId } = body;

    if (!lessonId || !moduleId) {
      return NextResponse.json(
        { success: false, error: 'lessonId and moduleId required' },
        { status: 400 },
      );
    }

    /* Auth: session is the source of truth. Body userId optional but
       must match session if present. */
    const sessionResult = requireSessionUserId(request, userId);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const sessionUserId = sessionResult;

    /* 1. Check whether this lesson is already complete for this user.
          The UNIQUE constraint would catch a double-insert, but checking
          first lets us return a clean idempotent response without an
          error round-trip. */
    const { data: existing, error: existingError } = await supabase
      .from('lesson_completions')
      .select('*')
      .eq('user_id', sessionUserId)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (existingError) {
      console.error('Check existing completion error:', existingError);
      return NextResponse.json(
        { success: false, error: existingError.message },
        { status: 500 },
      );
    }

    if (existing) {
      /* Already complete — short-circuit, do NOT award XP again. */
      return NextResponse.json({
        success: true,
        awarded: false,
        completion: {
          id: existing.id,
          userId: existing.user_id,
          lessonId: existing.lesson_id,
          moduleId: existing.module_id,
          completedAt: existing.completed_at,
          xpAwarded: existing.xp_awarded,
        },
      });
    }

    /* 2. Insert the completion row. */
    const { data: inserted, error: insertError } = await supabase
      .from('lesson_completions')
      .insert({
        user_id: sessionUserId,
        lesson_id: lessonId,
        module_id: moduleId,
        xp_awarded: LESSON_COMPLETION_XP,
      })
      .select()
      .single();

    if (insertError || !inserted) {
      console.error('Insert completion error:', insertError);
      return NextResponse.json(
        { success: false, error: insertError?.message || 'Insert failed' },
        { status: 500 },
      );
    }

    /* 3. Award XP. Read-then-write — small TOCTOU window is acceptable
          here because the only writer for this user's XP is the same
          user, and the read+write happen in a single request lifecycle. */
    const { data: userRow, error: userFetchError } = await supabase
      .from('users')
      .select('xp, level')
      .eq('id', sessionUserId)
      .single();

    if (userFetchError || !userRow) {
      /* Completion row exists, XP failed — flag in response so the
         client can show a warning rather than silently dropping XP. */
      console.error('Fetch user for XP award failed:', userFetchError);
      return NextResponse.json({
        success: true,
        awarded: false,
        xpError: 'Could not award XP (user fetch failed)',
        completion: {
          id: inserted.id,
          userId: inserted.user_id,
          lessonId: inserted.lesson_id,
          moduleId: inserted.module_id,
          completedAt: inserted.completed_at,
          xpAwarded: inserted.xp_awarded,
        },
      });
    }

    const newXp = (userRow.xp || 0) + LESSON_COMPLETION_XP;
    const newLevel = calculateLevelServer(newXp);

    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        xp: newXp,
        level: newLevel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionUserId);

    if (userUpdateError) {
      console.error('Update user XP error:', userUpdateError);
      return NextResponse.json({
        success: true,
        awarded: false,
        xpError: 'Could not award XP (user update failed)',
        completion: {
          id: inserted.id,
          userId: inserted.user_id,
          lessonId: inserted.lesson_id,
          moduleId: inserted.module_id,
          completedAt: inserted.completed_at,
          xpAwarded: inserted.xp_awarded,
        },
      });
    }

    return NextResponse.json({
      success: true,
      awarded: true,
      xpAwarded: LESSON_COMPLETION_XP,
      newXp,
      newLevel,
      leveledUp: newLevel > (userRow.level || 1),
      completion: {
        id: inserted.id,
        userId: inserted.user_id,
        lessonId: inserted.lesson_id,
        moduleId: inserted.module_id,
        completedAt: inserted.completed_at,
        xpAwarded: inserted.xp_awarded,
      },
    });
  } catch (error) {
    console.error('Mark complete exception:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mark complete' },
      { status: 500 },
    );
  }
}
