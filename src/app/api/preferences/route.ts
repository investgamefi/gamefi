import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireSessionUserId } from '@/lib/session';

// GET - Get user preferences
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }

    const { data: prefs, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching preferences:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch preferences' }, { status: 500 });
    }

    // Return defaults if no preferences exist
    const preferences = prefs ? {
      theme: prefs.theme || 'dark',
      notifications: {
        email: prefs.notifications_email ?? true,
        push: prefs.notifications_push ?? true,
        priceAlerts: prefs.notifications_price_alerts ?? true,
        challengeUpdates: prefs.notifications_challenge_updates ?? true,
        socialUpdates: prefs.notifications_social_updates ?? true,
      },
      displayCurrency: prefs.display_currency || 'USD',
    } : {
      theme: 'dark',
      notifications: {
        email: true,
        push: true,
        priceAlerts: true,
        challengeUpdates: true,
        socialUpdates: true,
      },
      displayCurrency: 'USD',
    };

    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    console.error('Preferences fetch error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// PUT - Update user preferences
export async function PUT(request: NextRequest) {
  try {
    const { userId, preferences } = await request.json();

    /* Auth: session is the source of truth. Body userId optional but
       must match session if present. */
    const sessionResult = requireSessionUserId(request, userId);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const sessionUserId = sessionResult;

    const updateData: any = { updated_at: new Date().toISOString() };

    if (preferences.theme !== undefined) {
      updateData.theme = preferences.theme;
    }
    if (preferences.displayCurrency !== undefined) {
      updateData.display_currency = preferences.displayCurrency;
    }
    if (preferences.notifications) {
      if (preferences.notifications.email !== undefined) {
        updateData.notifications_email = preferences.notifications.email;
      }
      if (preferences.notifications.push !== undefined) {
        updateData.notifications_push = preferences.notifications.push;
      }
      if (preferences.notifications.priceAlerts !== undefined) {
        updateData.notifications_price_alerts = preferences.notifications.priceAlerts;
      }
      if (preferences.notifications.challengeUpdates !== undefined) {
        updateData.notifications_challenge_updates = preferences.notifications.challengeUpdates;
      }
      if (preferences.notifications.socialUpdates !== undefined) {
        updateData.notifications_social_updates = preferences.notifications.socialUpdates;
      }
    }

    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: sessionUserId,
        ...updateData,
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Error updating preferences:', error);
      return NextResponse.json({ success: false, error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Preferences update error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
