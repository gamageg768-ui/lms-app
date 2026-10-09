import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/admin/access-logs?materialId=&userId= (admin only)
export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const materialId = searchParams.get('materialId');
  const userId = searchParams.get('userId');
  const sessionRef = searchParams.get('sessionRef');

  const where: any = {};
  if (materialId) where.materialId = materialId;
  if (userId) where.userId = userId;
  if (sessionRef) where.sessionRef = sessionRef;

  const logs = await prisma.accessLog.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      material: { select: { title: true, subject: true, section: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ logs });
}
