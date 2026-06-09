import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

interface ImportQuestion {
  question?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  optionE?: string;
  answer: string;
  explanation?: string;
}

// POST /api/mcq/sets/[id]/questions/import - bulk import questions from CSV (admin only)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const set = await prisma.mCQSet.findUnique({ where: { id: params.id }, include: { questions: true } });
  if (!set) return NextResponse.json({ error: 'Set not found' }, { status: 404 });

  const { questions } = await req.json() as { questions: ImportQuestion[] };
  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: 'No questions provided' }, { status: 400 });
  }

  const validAnswers = set.optionCount >= 5 ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];
  const valid = questions.filter(q => validAnswers.includes((q.answer || '').toUpperCase()));

  if (valid.length === 0) return NextResponse.json({ error: 'No valid questions' }, { status: 400 });

  const startOrder = set.questions.length;

  await prisma.mCQQuestion.createMany({
    data: valid.map((q, i) => ({
      mcqSetId: params.id,
      question: q.question || '',
      optionA: q.optionA || '',
      optionB: q.optionB || '',
      optionC: q.optionC || '',
      optionD: q.optionD || '',
      optionE: q.optionE || null,
      answer: q.answer.toUpperCase(),
      explanation: q.explanation || null,
      order: startOrder + i,
    })),
  });

  await prisma.mCQSet.update({
    where: { id: params.id },
    data: { questionCount: startOrder + valid.length },
  });

  const updated = await prisma.mCQSet.findUnique({
    where: { id: params.id },
    include: { questions: { orderBy: { order: 'asc' } } },
  });

  return NextResponse.json({ set: updated, imported: valid.length }, { status: 201 });
}
