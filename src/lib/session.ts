/* Session token signing & verification. Lives outside any specific
   route so middleware (Edge runtime) and API routes (Node runtime)
   share the same logic without dragging Supabase or other server-only
   modules into the middleware bundle.

   - Uses jose (web-crypto, Edge-compatible) — no jsonwebtoken/Buffer
     gymnastics.
   - Cookie name: gamefi_session. HttpOnly + Secure (when not local
     dev) + SameSite=Lax.
   - Token shape: { sub: userId, iat, exp } signed with HS256.
   - Secret comes from process.env.SESSION_SECRET. If unset in dev we
     fall back to a dev-only constant so login still works on a fresh
     clone — production deploys must set the env var or the warning
     will fire on every request.
*/

import { jwtVerify, SignJWT } from 'jose';
import { NextResponse } from 'next/server';

const COOKIE_NAME = 'gamefi_session';
const DEV_FALLBACK_SECRET = 'dev-only-do-not-use-in-production-please-set-SESSION_SECRET';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

let warnedAboutMissingSecret = false;

function getSecretKey(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw && !warnedAboutMissingSecret) {
    console.warn(
      '[session] SESSION_SECRET env var is unset — using insecure dev fallback. SET THIS IN PRODUCTION.',
    );
    warnedAboutMissingSecret = true;
  }
  return new TextEncoder().encode(raw || DEV_FALLBACK_SECRET);
}

export interface SessionPayload {
  userId: string;
}

/* Sign a session token for a userId. Returns the encoded JWT string
   the caller drops into an httpOnly cookie. */
export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

/* Verify a token string. Returns null on any failure (expired,
   tampered, malformed) — callers should treat null as "no session". */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ['HS256'] });
    if (!payload.sub || typeof payload.sub !== 'string') return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

/* Standard cookie spec used by login/register/logout. Centralised so
   one spot owns the security flags. */
export function sessionCookieOptions(opts?: { expire?: boolean }) {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: opts?.expire ? 0 : SESSION_TTL_SECONDS,
  };
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

/* Helper for API routes: reads the session userId from the
   x-session-user-id request header that middleware injects. The
   migration-window body fallback is gone — routes either get a
   session header or they fail closed. */
export function getSessionUserId(req: Request): { userId: string | null; source: 'session' | 'none' } {
  const headerId = req.headers.get('x-session-user-id');
  if (headerId) return { userId: headerId, source: 'session' };
  return { userId: null, source: 'none' };
}

/* Stricter sibling of getSessionUserId for mutation routes (Sprint 5,
   item 24). Returns either the session userId (success) or a 401
   NextResponse the route can return directly. Use:

     const session = requireSessionUserId(req);
     if (session instanceof NextResponse) return session;
     const userId = session;

   Optionally pass `bodyUserId` to also enforce the body↔session
   match — returns a 403 if the two disagree, so attackers can't pass
   another user's id in the body alongside their own cookie. */
export function requireSessionUserId(
  req: Request,
  bodyUserId?: string | null | undefined,
): string | NextResponse {
  const headerId = req.headers.get('x-session-user-id');
  if (!headerId) {
    return NextResponse.json(
      { success: false, error: 'Unauthenticated — session required.' },
      { status: 401 },
    );
  }
  if (bodyUserId && bodyUserId !== headerId) {
    return NextResponse.json(
      { success: false, error: 'Session userId does not match request userId.' },
      { status: 403 },
    );
  }
  return headerId;
}
