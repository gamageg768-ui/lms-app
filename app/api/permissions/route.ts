import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/permissions?userId=&materialId=
export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const materialId = searchParams.get('materialId');

  const where: any = {};
  if (userId) where.userId = userId;
  if (materialId) where.materialId = materialId;

  const permissions = await prisma.downloadPermission.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      material: { select: { id: true, title: true, subject: true, section: true } },
    },
    orderBy: { grantedAt: 'desc' },
  });
  return NextResponse.json(permissions);
}

// POST /api/permissions - Grant download permission
export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { userId, materialId, downloadLimit } = await req.json();
  if (!userId || !materialId) {
    return NextResponse.json({ error: 'userId and materialId required' }, { status: 400 });
  }

  const permission = await prisma.downloadPermission.upsert({
    where: { userId_materialId: { userId, materialId } },
    update: downloadLimit != null ? { downloadLimit: Number(downloadLimit) } : {},
    create: { userId, materialId, ...(downloadLimit != null ? { downloadLimit: Number(downloadLimit) } : {}) },
    include: {
      user: { select: { name: true, email: true } },
      material: { select: { title: true } },
    },
  });
  return NextResponse.json(permission, { status: 201 });
}

// DELETE /api/permissions?userId=&materialId=
export async function DELETE(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const materialId = searchParams.get('materialId');

  if (!userId || !materialId) {
    return NextResponse.json({ error: 'userId and materialId required' }, { status: 400 });
  }

  await prisma.downloadPermission.deleteMany({
    where: { userId, materialId },
  });
  return NextResponse.json({ success: true });
}
