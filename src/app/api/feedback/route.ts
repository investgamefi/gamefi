import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUserId, requireAdminUserId } from '@/lib/session';

// POST - Submit feedback. Open to anyone, but the submitter's identity
// comes from the session — a body userId/username could impersonate.
export async function POST(request: NextRequest) {
  try {
    const feedback = await request.json();
    const { userId: sessionUserId } = getSessionUserId(request);

    const { error } = await supabase.from('feedback').insert({
      type: feedback.type,
      message: feedback.message,
      email: feedback.email,
      user_id: sessionUserId,
      username: sessionUserId ? feedback.username : null,
      url: feedback.url,
      user_agent: feedback.userAgent,
      created_at: feedback.timestamp || new Date().toISOString(),
      status: 'new',
    });

    // If table doesn't exist, just log it (we'll create it later)
    if (error) {
      console.log('Feedback received (table may not exist yet):', feedback);
      // Still return success so user gets confirmation
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback submission error:', error);
    return NextResponse.json({ success: false, error: 'Failed to submit feedback' }, { status: 500 });
  }
}

// GET - Get feedback (admin only).
//
// This used to be wide open — anyone could curl the endpoint and
// harvest every submitter's email address. Now requires a valid
// session (middleware-injected header) whose user id appears in the
// ADMIN_USER_IDS env var (comma-separated). With the env var unset,
// everyone is denied; feedback is still readable in the Supabase
// dashboard directly.
export async function GET(request: NextRequest) {
  try {
    const admin = requireAdminUserId(request);
    if (admin instanceof NextResponse) return admin;

    const { data: feedback, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to fetch feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    console.error('Feedback fetch error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
