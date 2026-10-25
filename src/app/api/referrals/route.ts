import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireSessionUserId } from '@/lib/session';
import { REFERRAL_REWARDS } from '@/types';

// GET - Get the signed-in user's referral info
export async function GET(request: NextRequest) {
  try {
    const sessionResult = requireSessionUserId(request, request.nextUrl.searchParams.get('userId'));
    if (sessionResult instanceof NextResponse) return sessionResult;
    const userId = sessionResult;

    // Get user's referral code
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('referral_code')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ success: false, error: 'Failed to fetch user' }, { status: 500 });
    }

    // Generate referral code if doesn't exist
    let referralCode = user?.referral_code;
    if (!referralCode) {
      referralCode = generateReferralCode();
      await supabase
        .from('users')
        .update({ referral_code: referralCode })
        .eq('id', userId);
    }

    // Get referral stats
    const { data: referrals } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', userId);

    const totalReferrals = referrals?.filter(r => r.status === 'completed').length || 0;
    const pendingReferrals = referrals?.filter(r => r.status === 'pending').length || 0;
    const totalXpEarned = referrals?.reduce((sum, r) => sum + (r.xp_awarded || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      referralInfo: {
        referralCode,
        totalReferrals,
        pendingReferrals,
        totalXpEarned,
        referrerReward: REFERRAL_REWARDS.REFERRER_XP,
        referredReward: REFERRAL_REWARDS.REFERRED_XP,
      },
      referrals: referrals?.map(r => ({
        id: r.id,
        referredId: r.referred_id,
        status: r.status,
        xpAwarded: r.xp_awarded,
        createdAt: r.created_at,
        completedAt: r.completed_at,
      })) || [],
    });
  } catch (error) {
    console.error('Referral fetch error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// POST - Use a referral code (for new users)
export async function POST(request: NextRequest) {
  try {
    const { userId: bodyUserId, referralCode } = await request.json();
    const sessionResult = requireSessionUserId(request, bodyUserId);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const userId = sessionResult;

    if (!referralCode) {
      return NextResponse.json({ success: false, error: 'Referral code required' }, { status: 400 });
    }

    // Check if user was already referred
    const { data: user } = await supabase
      .from('users')
      .select('referred_by')
      .eq('id', userId)
      .single();

    if (user?.referred_by) {
      return NextResponse.json({ success: false, error: 'Already used a referral code' }, { status: 400 });
    }

    // Find the referrer
    const { data: referrer } = await supabase
      .from('users')
      .select('id, xp')
      .eq('referral_code', referralCode.toUpperCase())
      .single();

    if (!referrer) {
      return NextResponse.json({ success: false, error: 'Invalid referral code' }, { status: 400 });
    }

    // Can't refer yourself
    if (referrer.id === userId) {
      return NextResponse.json({ success: false, error: 'Cannot use your own referral code' }, { status: 400 });
    }

    // Create the referral record
    const { error: refError } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referred_id: userId,
        referral_code: referralCode.toUpperCase(),
        status: 'completed',
        xp_awarded: REFERRAL_REWARDS.REFERRER_XP,
        completed_at: new Date().toISOString(),
      });

    if (refError) {
      console.error('Error creating referral:', refError);
      return NextResponse.json({ success: false, error: 'Failed to process referral' }, { status: 500 });
    }

    // Update referred user
    const { data: referredUser } = await supabase
      .from('users')
      .select('xp')
      .eq('id', userId)
      .single();

    await supabase
      .from('users')
      .update({
        referred_by: referrer.id,
        xp: (referredUser?.xp || 0) + REFERRAL_REWARDS.REFERRED_XP,
      })
      .eq('id', userId);

    // Award XP to referrer
    await supabase
      .from('users')
      .update({ xp: (referrer.xp || 0) + REFERRAL_REWARDS.REFERRER_XP })
      .eq('id', referrer.id);

    // Update referrer's statistics
    await supabase
      .from('user_statistics')
      .update({ referrals_completed: supabase.rpc('increment', { x: 1 }) })
      .eq('user_id', referrer.id);

    // Create notifications
    await supabase.from('notifications').insert([
      {
        user_id: referrer.id,
        type: 'reward_earned',
        message: `Someone used your referral code! +${REFERRAL_REWARDS.REFERRER_XP} XP`,
        data: { referredId: userId, xpReward: REFERRAL_REWARDS.REFERRER_XP },
      },
      {
        user_id: userId,
        type: 'reward_earned',
        message: `Welcome bonus for using a referral code! +${REFERRAL_REWARDS.REFERRED_XP} XP`,
        data: { referrerId: referrer.id, xpReward: REFERRAL_REWARDS.REFERRED_XP },
      },
    ]);

    return NextResponse.json({
      success: true,
      xpAwarded: REFERRAL_REWARDS.REFERRED_XP,
      message: `Referral applied! You earned ${REFERRAL_REWARDS.REFERRED_XP} XP`,
    });
  } catch (error) {
    console.error('Referral application error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// Helper function to generate referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
