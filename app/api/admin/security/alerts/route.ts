import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/admin/security/alerts — flagged access patterns (admin only)
export async function GET() {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Group by userId + materialId, count accesses in last 24h
  const grouped = await prisma.accessLog.groupBy({
    by: ['userId', 'materialId'],
    _count: { id: true },
    where: { createdAt: { gte: yesterday } },
    orderBy: { _count: { id: 'desc' } },
    having: { id: { _count: { gt: 20 } } },
  });

  // Enrich with user info
  const userIds = Array.from(new Set(grouped.map(g => g.userId)));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const alerts = grouped.map(g => ({
    userId: g.userId,
    materialId: g.materialId,
    count: g._count.id,
    reason: `${g._count.id} accesses in last 24h`,
    user: userMap[g.userId] ?? null,
  }));

  return NextResponse.json({ alerts });
}
