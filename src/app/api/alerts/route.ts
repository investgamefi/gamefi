import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireSessionUserId } from '@/lib/session';
import { MAX_PRICE_ALERTS } from '@/types';

/* Every handler acts on the signed-in user only. A userId in the query
   or body is accepted for backwards compatibility but must match the
   session (requireSessionUserId returns 403 otherwise). */

// GET - Get user's price alerts
export async function GET(request: NextRequest) {
  try {
    const sessionResult = requireSessionUserId(request, request.nextUrl.searchParams.get('userId'));
    if (sessionResult instanceof NextResponse) return sessionResult;
    const userId = sessionResult;

    const { data: alerts, error } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching alerts:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch alerts' }, { status: 500 });
    }

    // Transform to camelCase
    const transformedAlerts = alerts?.map(a => ({
      id: a.id,
      userId: a.user_id,
      symbol: a.symbol,
      assetName: a.asset_name,
      condition: a.condition,
      targetPrice: a.target_price,
      targetPercent: a.target_percent,
      currentPrice: a.current_price,
      isActive: a.is_active,
      isTriggered: a.is_triggered,
      triggeredAt: a.triggered_at,
      createdAt: a.created_at,
    })) || [];

    return NextResponse.json({
      success: true,
      alerts: transformedAlerts,
      count: transformedAlerts.length,
      maxAlerts: MAX_PRICE_ALERTS,
    });
  } catch (error) {
    console.error('Alerts fetch error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// POST - Create a new price alert
export async function POST(request: NextRequest) {
  try {
    const { userId: bodyUserId, symbol, assetName, condition, targetPrice, targetPercent, currentPrice } = await request.json();
    const sessionResult = requireSessionUserId(request, bodyUserId);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const userId = sessionResult;

    if (!symbol || !condition) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Check alert limit
    const { count } = await supabase
      .from('price_alerts')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_active', true);

    if ((count || 0) >= MAX_PRICE_ALERTS) {
      return NextResponse.json({
        success: false,
        error: `Maximum ${MAX_PRICE_ALERTS} active alerts allowed`
      }, { status: 400 });
    }

    // Create the alert
    const { data: alert, error } = await supabase
      .from('price_alerts')
      .insert({
        user_id: userId,
        symbol: symbol.toUpperCase(),
        asset_name: assetName,
        condition,
        target_price: targetPrice,
        target_percent: targetPercent,
        current_price: currentPrice,
        is_active: true,
        is_triggered: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating alert:', error);
      return NextResponse.json({ success: false, error: 'Failed to create alert' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      alert: {
        id: alert.id,
        userId: alert.user_id,
        symbol: alert.symbol,
        assetName: alert.asset_name,
        condition: alert.condition,
        targetPrice: alert.target_price,
        targetPercent: alert.target_percent,
        currentPrice: alert.current_price,
        isActive: alert.is_active,
        isTriggered: alert.is_triggered,
        createdAt: alert.created_at,
      },
    });
  } catch (error) {
    console.error('Alert creation error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// DELETE - Delete a price alert
export async function DELETE(request: NextRequest) {
  try {
    const { alertId, userId: bodyUserId } = await request.json();
    const sessionResult = requireSessionUserId(request, bodyUserId);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const userId = sessionResult;

    if (!alertId) {
      return NextResponse.json({ success: false, error: 'Alert ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('price_alerts')
      .delete()
      .eq('id', alertId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting alert:', error);
      return NextResponse.json({ success: false, error: 'Failed to delete alert' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Alert deletion error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// PUT - Update alert (toggle active status)
export async function PUT(request: NextRequest) {
  try {
    const { alertId, userId: bodyUserId, isActive } = await request.json();
    const sessionResult = requireSessionUserId(request, bodyUserId);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const userId = sessionResult;

    if (!alertId) {
      return NextResponse.json({ success: false, error: 'Alert ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('price_alerts')
      .update({ is_active: isActive })
      .eq('id', alertId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating alert:', error);
      return NextResponse.json({ success: false, error: 'Failed to update alert' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Alert update error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
