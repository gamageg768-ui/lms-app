import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { heartbeat } from '@/lib/activeSessions';

// POST /api/materials/[id]/heartbeat — keeps concurrent-session detection alive
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionKey } = await req.json();
  if (!sessionKey) return NextResponse.json({ error: 'sessionKey required' }, { status: 400 });

  const conflict = heartbeat(user.id, params.id, sessionKey);
  return NextResponse.json({ conflict });
}
