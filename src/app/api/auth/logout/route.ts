/* POST /api/auth/logout — clears the session cookie. Client calls
   this from the store's logout action so the user really is logged
   out server-side too (not just localStorage cleared). */

import { NextResponse } from 'next/server';
import { sessionCookieOptions } from '@/lib/session';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set({
    ...sessionCookieOptions({ expire: true }),
    value: '',
  });
  return res;
}
