import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

interface ForgotPasswordRequest {
  email: string;
}

/* Resend HTTP API endpoint. We call this directly via fetch instead of
   pulling in the `resend` npm package — keeps the dependency footprint
   smaller and avoids a package install just for one endpoint. */
const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Gamefi Invest <noreply@gamefi.invest>';

/* Build the base URL for the reset link.
   Prefer NEXT_PUBLIC_APP_URL when set (production), otherwise reconstruct
   from the incoming request headers so dev/preview deployments work too. */
function getBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

/* Send the reset email via Resend. Returns true on success, false on any
   failure — we never throw out of here, the caller still returns success
   to avoid leaking whether the account exists. */
async function sendResetEmail(
  to: string,
  username: string,
  resetUrl: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Dev environments without Resend configured — surface a single visible
    // log line so it's obvious why no email went out, then carry on.
    console.warn(
      'Reset email skipped: RESEND_API_KEY unset. Reset URL (for manual testing):',
      resetUrl,
    );
    return false;
  }

  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  const subject = 'Reset your Gamefi Invest password';
  const text = `Hi ${username},

We received a request to reset your Gamefi Invest password. Click the link below to choose a new one:

${resetUrl}

This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email — your password won't change.

— Gamefi Invest`;

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2 style="margin: 0 0 12px;">Reset your Gamefi Invest password</h2>
  <p>Hi ${escapeHtml(username)},</p>
  <p>We received a request to reset your password. Click the button below to choose a new one:</p>
  <p style="margin: 24px 0;">
    <a href="${escapeHtml(resetUrl)}" style="background: #0d7c3f; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 600;">Reset password</a>
  </p>
  <p style="font-size: 13px; color: #555;">Or copy this link: <br><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>
  <p style="font-size: 13px; color: #555;">This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email — your password won't change.</p>
  <p style="font-size: 12px; color: #888; margin-top: 24px;">— Gamefi Invest</p>
</body></html>`;

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('Resend API error:', res.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Resend network error:', err);
    return false;
  }
}

/* Minimal HTML escaper for the values we drop into the email template.
   Username + resetUrl are the only interpolated values, but both are
   user-influenced so we sanitize them. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: NextRequest) {
  try {
    const body: ForgotPasswordRequest = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, username')
      .eq('email', email.toLowerCase())
      .single();

    // Always return success to prevent email enumeration
    // Even if user doesn't exist, we don't want to reveal that
    if (userError || !user) {
      console.log('Password reset requested for non-existent email:', email);
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Generate reset token
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store reset token
    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        id: uuidv4(),
        user_id: user.id,
        token: resetToken,
        expires_at: expiresAt.toISOString(),
        used: false,
      });

    const baseUrl = getBaseUrl(request);
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    /* The reset token must only ever reach the account owner's inbox.
       Returning it in the response (the old "demo" fallback) let anyone
       take over any account by typing its email, whenever email sending
       wasn't configured — which was the case in production. Local dev
       still gets the token back so the flow is testable without Resend. */
    const exposeTokenForDev = process.env.NODE_ENV !== 'production';
    const genericSuccess = {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    };

    if (insertError) {
      console.error('Password reset token storage failed (table may not exist):', insertError);
      return NextResponse.json(genericSuccess);
    }

    // sendResetEmail returns false (without throwing) when RESEND_API_KEY
    // is unset or Resend rejects the send.
    const sent = await sendResetEmail(user.email, user.username, resetUrl);
    if (!sent && exposeTokenForDev) {
      return NextResponse.json({
        ...genericSuccess,
        demo_token: resetToken,
        demo_note: 'Email send unavailable in this environment. Use this URL: /reset-password?token=' + resetToken,
      });
    }
    if (!sent) {
      console.error('Password reset email was not sent; set RESEND_API_KEY to enable password resets.');
    }

    return NextResponse.json(genericSuccess);
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
