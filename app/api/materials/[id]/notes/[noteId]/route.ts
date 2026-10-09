import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// DELETE /api/materials/[id]/notes/[noteId]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; noteId: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const note = await prisma.materialNote.findUnique({ where: { id: params.noteId } });
  if (!note || note.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.materialNote.delete({ where: { id: params.noteId } });
  return NextResponse.json({ success: true });
}

// PATCH /api/materials/[id]/notes/[noteId] — edit content
export async function PATCH(req: NextRequest, { params }: { params: { id: string; noteId: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const note = await prisma.materialNote.findUnique({ where: { id: params.noteId } });
  if (!note || note.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { content } = await req.json();
  const updated = await prisma.materialNote.update({ where: { id: params.noteId }, data: { content } });
  return NextResponse.json(updated);
}
