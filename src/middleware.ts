/* Next middleware — runs on every request, decodes the session cookie
   (if present), and injects the resolved userId into the request
   headers so API routes can read req.headers.get('x-session-user-id')
   without doing the jose verify themselves.

   Why a header pass-through instead of a request-scoped context? Edge
   middleware can mutate request headers but can't share JS-level
   objects with downstream handlers; the header is the cleanest hand-off.

   We do NOT block unauth'd requests here. The migration is gradual:
   API routes still accept body-supplied userId for now and only
   prefer the header when present. A future sprint can flip the
   default to "header required, body ignored" once we've audited
   every route.
*/

import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/session';

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySession(token);

  /* Build the next request with the session header injected. If no
     valid session, leave the header off (don't inject an empty value
     — downstream code reads headers.has() to distinguish). */
  const requestHeaders = new Headers(req.headers);
  if (session) {
    requestHeaders.set('x-session-user-id', session.userId);
  } else {
    requestHeaders.delete('x-session-user-id');
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

/* Match every route except static assets + the public auth endpoints
   (we still run on /api/auth to set headers for routes like /me, but
   those don't depend on existing session). */
export const config = {
  matcher: [
    /* Skip Next internals and static files. Everything else runs the
       middleware so the header gets injected for both API routes and
       pages (pages don't use it but the cost is a no-op). */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)',
  ],
};
