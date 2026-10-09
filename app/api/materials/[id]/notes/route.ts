import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/materials/[id]/notes — list current user's notes for this material
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const notes = await prisma.materialNote.findMany({
    where: { materialId: params.id, userId: user.id },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(notes);
}

// POST /api/materials/[id]/notes — create a note
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { content, page } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 });

  const note = await prisma.materialNote.create({
    data: { userId: user.id, materialId: params.id, content: content.trim(), page: page ?? 1 },
  });
  return NextResponse.json(note, { status: 201 });
}
