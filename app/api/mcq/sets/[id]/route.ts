import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/mcq/sets/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const set = await prisma.mCQSet.findUnique({
    where: { id: params.id },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(set);
}

// PATCH /api/mcq/sets/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const data: any = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.questionCount !== undefined) data.questionCount = body.questionCount;
  if (body.optionCount !== undefined) data.optionCount = body.optionCount === 5 ? 5 : 4;

  const set = await prisma.mCQSet.update({
    where: { id: params.id },
    data,
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  return NextResponse.json(set);
}

// DELETE /api/mcq/sets/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.mCQQuestion.deleteMany({ where: { mcqSetId: params.id } });
  await prisma.mCQSet.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
