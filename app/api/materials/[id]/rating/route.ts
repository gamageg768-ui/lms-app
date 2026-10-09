import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/materials/[id]/rating — avg rating + user's own
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id;

  const [agg, userRating] = await Promise.all([
    prisma.materialRating.aggregate({ where: { materialId: params.id }, _avg: { rating: true }, _count: true }),
    prisma.materialRating.findUnique({ where: { userId_materialId: { userId, materialId: params.id } } }),
  ]);

  return NextResponse.json({
    avg: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    count: agg._count,
    userRating: userRating?.rating ?? null,
  });
}

// POST /api/materials/[id]/rating — upsert rating { rating: 1-5 }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id;

  const { rating } = await req.json();
  if (!rating || rating < 1 || rating > 5) return NextResponse.json({ error: 'rating must be 1–5' }, { status: 400 });

  await prisma.materialRating.upsert({
    where: { userId_materialId: { userId, materialId: params.id } },
    create: { userId, materialId: params.id, rating },
    update: { rating },
  });

  const agg = await prisma.materialRating.aggregate({
    where: { materialId: params.id },
    _avg: { rating: true },
    _count: true,
  });

  return NextResponse.json({
    avg: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    count: agg._count,
    userRating: rating,
  });
}
