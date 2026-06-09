import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// DELETE /api/users/[id] - Admin delete student
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target.role === 'ADMIN') {
    return NextResponse.json({ error: 'Cannot delete admin' }, { status: 400 });
  }
  await prisma.downloadPermission.deleteMany({ where: { userId: params.id } });
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}

// GET /api/users/[id] - Get user details
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, email: true, role: true, createdAt: true,
      downloadPermissions: {
        include: { material: { select: { title: true, subject: true, section: true } } },
      },
    },
  });
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(target);
}
