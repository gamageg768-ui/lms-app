import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// DELETE /api/learning-paths/[id]/items/[itemId]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  await prisma.learningPathItem.delete({ where: { id: params.itemId } });
  return NextResponse.json({ success: true });
}
