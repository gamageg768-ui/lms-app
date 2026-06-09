import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// POST /api/mcq/sets/[id]/questions/bulk
// Body: { count: number, optionCount: number, answers?: string[] }
// Creates `count` question stubs and updates set's optionCount
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const count: number = Math.min(Math.max(1, Number(body.count) || 10), 200);
  const optionCount: number = body.optionCount === 5 ? 5 : 4;
  const answers: string[] = Array.isArray(body.answers) ? body.answers : [];

  const set = await prisma.mCQSet.findUnique({ where: { id: params.id } });
  if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const existingCount = await prisma.mCQQuestion.count({ where: { mcqSetId: params.id } });

  const data = Array.from({ length: count }, (_, i) => ({
    mcqSetId: params.id,
    question: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    optionE: optionCount >= 5 ? '' : null,
    answer: answers[i] ?? 'A',
    order: existingCount + i,
  }));

  await prisma.mCQQuestion.createMany({ data });
  await prisma.mCQSet.update({ where: { id: params.id }, data: { optionCount } });

  const updated = await prisma.mCQSet.findUnique({
    where: { id: params.id },
    include: { questions: { orderBy: { order: 'asc' } } },
  });

  return NextResponse.json({ set: updated, created: count });
}

// PATCH /api/mcq/sets/[id]/questions/bulk
// Body: { updates: { id: string, answer: string }[] }
// Batch update answers for multiple questions
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const updates: { id: string; answer: string }[] = Array.isArray(body.updates) ? body.updates : [];

  if (updates.length === 0) return NextResponse.json({ updated: 0 });

  await Promise.all(
    updates.map(({ id, answer }) =>
      prisma.mCQQuestion.update({ where: { id }, data: { answer } })
    )
  );

  return NextResponse.json({ updated: updates.length });
}
