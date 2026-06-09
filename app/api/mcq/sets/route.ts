import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/mcq/sets - list all MCQ sets
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subject = searchParams.get('subject');
  const section = searchParams.get('section');

  const where: any = {};
  if (subject) where.subject = subject;
  if (section) where.section = section;

  const sets = await prisma.mCQSet.findMany({
    where,
    include: { questions: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(sets);
}

// POST /api/mcq/sets
export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { title, subject, section, materialId, questionCount } = await req.json();
  if (!title || !subject || !section) {
    return NextResponse.json({ error: 'title, subject, section required' }, { status: 400 });
  }

  const set = await prisma.mCQSet.create({
    data: {
      title, subject, section,
      materialId: materialId || null,
      questionCount: questionCount || 0,
    },
    include: { questions: true },
  });
  return NextResponse.json(set, { status: 201 });
}
