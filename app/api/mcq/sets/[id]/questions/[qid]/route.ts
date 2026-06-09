import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// PATCH /api/mcq/sets/[id]/questions/[qid]
export async function PATCH(req: NextRequest, { params }: { params: { id: string; qid: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const data: any = {};
  if (body.question !== undefined) data.question = body.question;
  if (body.optionA !== undefined) data.optionA = body.optionA;
  if (body.optionB !== undefined) data.optionB = body.optionB;
  if (body.optionC !== undefined) data.optionC = body.optionC;
  if (body.optionD !== undefined) data.optionD = body.optionD;
  if (body.optionE !== undefined) data.optionE = body.optionE || null;
  if (body.answer !== undefined) data.answer = body.answer;
  if (body.explanation !== undefined) data.explanation = body.explanation || null;
  if (body.order !== undefined) data.order = body.order;

  const q = await prisma.mCQQuestion.update({ where: { id: params.qid }, data });
  return NextResponse.json(q);
}

// DELETE /api/mcq/sets/[id]/questions/[qid]
export async function DELETE(req: NextRequest, { params }: { params: { id: string; qid: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.mCQQuestion.delete({ where: { id: params.qid } });
  return NextResponse.json({ success: true });
}
