import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// DELETE /api/materials/[id]/comments/[commentId] — own or admin
export async function DELETE(req: NextRequest, { params }: { params: { id: string; commentId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const comment = await prisma.materialComment.findUnique({ where: { id: params.commentId } });
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (comment.userId !== user.id && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.materialComment.delete({ where: { id: params.commentId } });
  return NextResponse.json({ success: true });
}
