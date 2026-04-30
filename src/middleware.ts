import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * NextAuth v4 with database sessions does not issue JWTs, so withAuth()
 * cannot be used at the edge. Instead we check for the session cookie
 * (presence only — validity is enforced by getServerSession in each layout).
 */
export function middleware(req: NextRequest) {
  const sessionToken =
    req.cookies.get('__Secure-next-auth.session-token') ??
    req.cookies.get('next-auth.session-token')

  if (!sessionToken) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
