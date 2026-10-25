import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, verifyPassword, validatePassword } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { requireSessionUserId } from '@/lib/session';

interface ChangePasswordRequest {
  userId?: string;
  currentPassword: string;
  newPassword: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChangePasswordRequest = await request.json();
    const { currentPassword, newPassword } = body;

    /* The account comes from the session, never the body — otherwise
       anyone could brute-force the current password of any user id. */
    const sessionResult = requireSessionUserId(request, body.userId);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const userId = sessionResult;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate new password
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return NextResponse.json(
        { success: false, error: passwordError },
        { status: 400 }
      );
    }

    // Get current credentials
    const { data: credentials, error: credError } = await supabase
      .from('user_credentials')
      .select('password_hash, salt')
      .eq('user_id', userId)
      .single();

    if (credError || !credentials) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify current password
    const isValid = await verifyPassword(
      currentPassword,
      credentials.password_hash,
      credentials.salt
    );

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Hash new password
    const { hash, salt } = await hashPassword(newPassword);

    // Update credentials
    const { error: updateError } = await supabase
      .from('user_credentials')
      .update({
        password_hash: hash,
        salt: salt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update password' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
