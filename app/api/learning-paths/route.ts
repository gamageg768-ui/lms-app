import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/learning-paths?subject=
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const subject = new URL(req.url).searchParams.get('subject');
  const paths = await prisma.learningPath.findMany({
    where: subject ? { subject } : undefined,
    include: {
      items: {
        orderBy: { order: 'asc' },
        include: { material: { select: { id: true, title: true, filename: true, publishAt: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(paths);
}

// POST /api/learning-paths (admin only)
export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { title, description, subject } = await req.json();
  if (!title || !subject) return NextResponse.json({ error: 'title and subject required' }, { status: 400 });

  const path = await prisma.learningPath.create({
    data: { title, description: description || null, subject },
    include: { items: true },
  });
  return NextResponse.json(path, { status: 201 });
}
