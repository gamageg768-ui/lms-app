import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// POST /api/mcq/sets/[id]/attempts — student logs a completed attempt
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { score, total, timeTaken } = await req.json();
  if (score == null || total == null) return NextResponse.json({ error: 'score and total required' }, { status: 400 });

  const attempt = await prisma.mCQAttempt.create({
    data: { userId: user.id, mcqSetId: params.id, score, total, timeTaken: timeTaken ?? 0 },
  });
  return NextResponse.json(attempt, { status: 201 });
}

// GET /api/mcq/sets/[id]/attempts — admin: all; student: own only
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const where: any = { mcqSetId: params.id };
  if (user.role !== 'ADMIN') where.userId = user.id;

  const attempts = await prisma.mCQAttempt.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(attempts);
}
