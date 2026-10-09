import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/learning-paths/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const path = await prisma.learningPath.findUnique({
    where: { id: params.id },
    include: {
      items: {
        orderBy: { order: 'asc' },
        include: { material: { select: { id: true, title: true, filename: true, publishAt: true } } },
      },
    },
  });
  if (!path) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(path);
}

// PATCH /api/learning-paths/[id] (admin only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { title, description } = await req.json();
  const path = await prisma.learningPath.update({
    where: { id: params.id },
    data: { title, description },
    include: { items: { orderBy: { order: 'asc' }, include: { material: { select: { id: true, title: true, filename: true } } } } },
  });
  return NextResponse.json(path);
}

// DELETE /api/learning-paths/[id] (admin only)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  await prisma.learningPath.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
