import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user as any;

  // Public routes
  if (pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/register')) {
    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL(user.role === 'ADMIN' ? '/admin' : '/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // All other routes require auth
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Admin routes require ADMIN role
  if (pathname.startsWith('/admin') && user.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Student routes block admins
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/subject')) {
    if (user.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|icons|favicon.ico|manifest.json|sw.js).*)'],
};
