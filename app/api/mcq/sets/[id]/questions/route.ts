import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/mcq/sets/[id]/questions
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const questions = await prisma.mCQQuestion.findMany({
    where: { mcqSetId: params.id },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json(questions);
}

// POST /api/mcq/sets/[id]/questions
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { question, optionA, optionB, optionC, optionD, optionE, answer, explanation, order } = body;

  if (!answer || !['A', 'B', 'C', 'D', 'E'].includes(answer)) {
    return NextResponse.json({ error: 'Answer must be A, B, C, D, or E' }, { status: 400 });
  }

  const q = await prisma.mCQQuestion.create({
    data: {
      mcqSetId: params.id,
      question: question || '',
      optionA: optionA || '',
      optionB: optionB || '',
      optionC: optionC || '',
      optionD: optionD || '',
      optionE: optionE || null,
      answer,
      explanation: explanation || null,
      order: order ?? 0,
    },
  });
  return NextResponse.json(q, { status: 201 });
}
