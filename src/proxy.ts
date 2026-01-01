import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function proxy() {
    // Auth disabled in dev
    if (process.env.AUTH_DISABLED === 'true') {
      return NextResponse.next();
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        if (process.env.AUTH_DISABLED === 'true') return true;
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/((?!api/auth|auth/signin|auth/error|_next/static|_next/image|favicon.ico).*)',
  ],
};
