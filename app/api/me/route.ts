import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const user = session.user as any;
  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
