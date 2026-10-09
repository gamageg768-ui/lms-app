import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/materials/[id]/comments — all comments with replies and user names
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const comments = await prisma.materialComment.findMany({
    where: { materialId: params.id, parentId: null },
    include: {
      user: { select: { id: true, name: true, role: true } },
      replies: {
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(comments);
}

// POST /api/materials/[id]/comments — create comment or reply
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id;

  const { body, parentId } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 });

  const comment = await prisma.materialComment.create({
    data: { materialId: params.id, userId, body: body.trim(), parentId: parentId ?? null },
    include: { user: { select: { id: true, name: true, role: true } }, replies: true },
  });
  return NextResponse.json(comment, { status: 201 });
}
