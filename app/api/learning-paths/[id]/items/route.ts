import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// POST /api/learning-paths/[id]/items — add a material to the path
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { materialId } = await req.json();
  if (!materialId) return NextResponse.json({ error: 'materialId required' }, { status: 400 });

  const count = await prisma.learningPathItem.count({ where: { pathId: params.id } });
  const item = await prisma.learningPathItem.upsert({
    where: { pathId_materialId: { pathId: params.id, materialId } },
    update: {},
    create: { pathId: params.id, materialId, order: count },
    include: { material: { select: { id: true, title: true, filename: true } } },
  });
  return NextResponse.json(item, { status: 201 });
}

// PUT /api/learning-paths/[id]/items — reorder items
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { orderedIds } = await req.json() as { orderedIds: string[] };
  if (!Array.isArray(orderedIds)) return NextResponse.json({ error: 'orderedIds array required' }, { status: 400 });

  await Promise.all(orderedIds.map((itemId, idx) =>
    prisma.learningPathItem.update({ where: { id: itemId }, data: { order: idx } })
  ));
  return NextResponse.json({ success: true });
}
