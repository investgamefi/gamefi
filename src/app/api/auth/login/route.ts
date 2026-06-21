import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth';
import { AuthResponse } from '@/types';
import { supabase } from '@/lib/supabase';
import { signSession, sessionCookieOptions } from '@/lib/session';

interface LoginRequestBody {
  identifier: string; // username or email
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequestBody = await request.json();
    const { identifier, password } = body;

    // Validate inputs
    if (!identifier || !identifier.trim()) {
      return NextResponse.json<AuthResponse>(
        { success: false, error: 'Username or email is required' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json<AuthResponse>(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    const normalizedIdentifier = identifier.toLowerCase().trim();

    // Find user by username first
    let { data: dbUser, error: usernameError } = await supabase
      .from('users')
      .select('*')
      .eq('username', normalizedIdentifier)
      .maybeSingle();

    // If not found by username, try email
    if (!dbUser) {
      const { data: userByEmail, error: emailError } = await supabase
        .from('users')
        .select('*')
        .eq('email', normalizedIdentifier)
        .maybeSingle();
      dbUser = userByEmail;

      if (emailError) {
        console.error('Email lookup error:', emailError);
      }
    }

    if (usernameError) {
      console.error('Username lookup error:', usernameError);
    }

    if (!dbUser) {
      console.log('User not found for identifier:', normalizedIdentifier);
      return NextResponse.json<AuthResponse>(
        { success: false, error: 'Invalid username/email or password' },
        { status: 401 }
      );
    }

    console.log('User found:', dbUser.id, dbUser.username);

    // Get credentials
    const { data: credentials, error: credError } = await supabase
      .from('user_credentials')
      .select('*')
      .eq('user_id', dbUser.id)
      .maybeSingle();

    if (credError) {
      console.error('Credentials lookup error:', credError);
    }

    if (!credentials) {
      console.log('No credentials found for user:', dbUser.id);
      return NextResponse.json<AuthResponse>(
        { success: false, error: 'Invalid username/email or password' },
        { status: 401 }
      );
    }

    console.log('Credentials found for user:', dbUser.id);

    // Verify password
    console.log('Verifying password for user:', dbUser.id);
    const isValidPassword = await verifyPassword(
      password,
      credentials.password_hash,
      credentials.salt
    );

    if (!isValidPassword) {
      console.log('Password verification failed for user:', dbUser.id);
      return NextResponse.json<AuthResponse>(
        { success: false, error: 'Invalid username/email or password' },
        { status: 401 }
      );
    }

    console.log('Password verified successfully for user:', dbUser.id);

    // Get user's followers
    const { data: followers } = await supabase
      .from('followers')
      .select('follower_id')
      .eq('following_id', dbUser.id);

    // Get user's following
    const { data: following } = await supabase
      .from('followers')
      .select('following_id')
      .eq('follower_id', dbUser.id);

    // Get user's portfolios
    const { data: portfolios } = await supabase
      .from('portfolios')
      .select('id')
      .eq('user_id', dbUser.id);

    // Get user's badges
    const { data: badges } = await supabase
      .from('badges')
      .select('*')
      .eq('user_id', dbUser.id);

    // Convert database user to app user format
    const user = {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      displayName: dbUser.display_name,
      avatar: dbUser.avatar,
      bio: dbUser.bio,
      joinedAt: dbUser.joined_at,
      followers: followers?.map(f => f.follower_id) || [],
      following: following?.map(f => f.following_id) || [],
      portfolios: portfolios?.map(p => p.id) || [],
      totalRewards: dbUser.total_rewards,
      badges: badges?.map(b => ({
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

    /* Mint a signed session token and drop it into an httpOnly
       cookie. Middleware will decode it on subsequent requests and
       inject x-session-user-id so API routes don't have to trust
       body-supplied userIds. */
    const res = NextResponse.json<AuthResponse>({ success: true, user });
    const token = await signSession(dbUser.id);
    res.cookies.set({ ...sessionCookieOptions(), value: token });
    return res;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json<AuthResponse>(
      { success: false, error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
