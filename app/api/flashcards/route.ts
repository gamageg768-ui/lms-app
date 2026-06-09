import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/flashcards?subject=
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subject = searchParams.get('subject');
  const cards = await prisma.flashCard.findMany({
    where: subject ? { subject } : {},
    orderBy: { order: 'asc' },
  });
  return NextResponse.json(cards);
}

// POST /api/flashcards - Admin create
export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { subject, question, answer, order } = await req.json();
  if (!subject || !question || !answer) {
    return NextResponse.json({ error: 'subject, question, answer required' }, { status: 400 });
  }
  const card = await prisma.flashCard.create({
    data: { subject, question, answer, order: order ?? 0 },
  });
  return NextResponse.json(card, { status: 201 });
}
