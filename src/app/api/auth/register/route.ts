import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword, validatePassword, validateEmail, validateUsername } from '@/lib/auth';
import { AuthResponse, DEFAULT_MAX_TEAMS } from '@/types';
import { supabase } from '@/lib/supabase';
import { signSession, sessionCookieOptions } from '@/lib/session';

interface RegisterRequestBody {
  username: string;
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('Registration attempt started');

    const body: RegisterRequestBody = await request.json();
    const { username, email, password } = body;

    console.log('Registering user:', username, email);

    // Validate inputs
    const usernameError = validateUsername(username);
    if (usernameError) {
      console.log('Username validation failed:', usernameError);
      return NextResponse.json<AuthResponse>(
        { success: false, error: usernameError },
        { status: 400 }
      );
    }

    const emailError = validateEmail(email);
    if (emailError) {
      console.log('Email validation failed:', emailError);
      return NextResponse.json<AuthResponse>(
        { success: false, error: emailError },
        { status: 400 }
      );
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      console.log('Password validation failed:', passwordError);
      return NextResponse.json<AuthResponse>(
        { success: false, error: passwordError },
        { status: 400 }
      );
    }

    // Check if username already exists
    console.log('Checking if username exists:', username.toLowerCase());
    const { data: existingUsername, error: usernameCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle();

    if (usernameCheckError) {
      console.error('Username check error:', usernameCheckError);
      return NextResponse.json<AuthResponse>(
        { success: false, error: 'Database error checking username: ' + usernameCheckError.message },
        { status: 500 }
      );
    }

    if (existingUsername) {
      console.log('Username already exists');
      return NextResponse.json<AuthResponse>(
        { success: false, error: 'Username already exists' },
        { status: 400 }
      );
    }

    // Check if email already exists
    console.log('Checking if email exists:', email.toLowerCase());
    const { data: existingEmail, error: emailCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (emailCheckError) {
      console.error('Email check error:', emailCheckError);
      return NextResponse.json<AuthResponse>(
        { success: false, error: 'Database error checking email: ' + emailCheckError.message },
        { status: 500 }
      );
    }

    if (existingEmail) {
      console.log('Email already exists');
      return NextResponse.json<AuthResponse>(
        { success: false, error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    console.log('Hashing password');
    const { hash, salt } = await hashPassword(password);

    // Generate user ID
    const userId = uuidv4();
    const now = new Date().toISOString();

    console.log('Inserting user with ID:', userId);

    // Insert user into database
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        id: userId,
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        display_name: username,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        bio: 'New investor on Gamefi Invest!',
        joined_at: now,
        total_rewards: 0,
        level: 1,
        xp: 500,
        max_teams: DEFAULT_MAX_TEAMS,
      })
      .select()
      .single();

    if (userError) {
      console.error('User insert error:', userError);
      return NextResponse.json<AuthResponse>(
        { success: false, error: 'Failed to create user: ' + userError.message },
        { status: 500 }
      );
    }

    console.log('User created successfully, inserting credentials');

    // Insert credentials
    const { error: credError } = await supabase
      .from('user_credentials')
      .insert({
        id: uuidv4(),
        user_id: userId,
        password_hash: hash,
        salt: salt,
      });

    if (credError) {
      console.error('Credentials insert error:', credError);
      // Rollback user creation
      await supabase.from('users').delete().eq('id', userId);
      return NextResponse.json<AuthResponse>(
        { success: false, error: 'Failed to create user credentials: ' + credError.message },
        { status: 500 }
      );
    }

    console.log('Registration successful for user:', userId);

    // Convert database user to app user format
    const user = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      displayName: newUser.display_name,
      avatar: newUser.avatar,
      bio: newUser.bio,
      joinedAt: newUser.joined_at,
      followers: [],
      following: [],
      portfolios: [],
      totalRewards: newUser.total_rewards,
      badges: [],
      level: newUser.level,
      xp: newUser.xp,
      maxTeams: newUser.max_teams,
    };

    /* Auto-login on register: drop the session cookie so the user
       lands on /dashboard already authenticated. */
    const res = NextResponse.json({ success: true, user });
    const token = await signSession(newUser.id);
    res.cookies.set({ ...sessionCookieOptions(), value: token });
    return res;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json<AuthResponse>(
      { success: false, error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}
