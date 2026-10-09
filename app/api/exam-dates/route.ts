import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/exam-dates — list future exam dates (any auth)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const dates = await prisma.examDate.findMany({
    where: { examAt: { gte: now } },
    orderBy: { examAt: 'asc' },
  });
  return NextResponse.json(dates);
}

// POST /api/exam-dates — create (admin only)
export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (user?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { subject, label, examAt } = await req.json();
  if (!subject || !label || !examAt) return NextResponse.json({ error: 'subject, label and examAt required' }, { status: 400 });

  const date = await prisma.examDate.create({ data: { subject, label, examAt: new Date(examAt) } });
  return NextResponse.json(date, { status: 201 });
}

// DELETE /api/exam-dates?id= — remove (admin only)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (user?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await prisma.examDate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
