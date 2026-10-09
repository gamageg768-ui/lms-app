import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { unlink } from 'fs/promises';
import path from 'path';
import { getUploadsDir } from '@/lib/utils';

// DELETE /api/materials/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const material = await prisma.material.findUnique({ where: { id: params.id } });
  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Delete files from disk
  try { await unlink(path.join(getUploadsDir(), material.filePath)); } catch {}
  if (material.markingSchemePath) {
    try { await unlink(path.join(getUploadsDir(), material.markingSchemePath)); } catch {}
  }

  // Delete from DB (cascade deletes permissions and mcq sets)
  await prisma.downloadPermission.deleteMany({ where: { materialId: params.id } });
  await prisma.mCQSet.deleteMany({ where: { materialId: params.id } });
  await prisma.material.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}

// PATCH /api/materials/[id] - update title/description
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const body = await req.json();
  const data: any = {};
  if ('title' in body) data.title = body.title;
  if ('description' in body) data.description = body.description;
  if ('expiresAt' in body) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if ('difficulty' in body) data.difficulty = body.difficulty || null;
  if ('publishAt' in body) data.publishAt = body.publishAt ? new Date(body.publishAt) : null;
  if ('videoUrl' in body) data.videoUrl = body.videoUrl || null;
  const material = await prisma.material.update({ where: { id: params.id }, data });
  return NextResponse.json(material);
}
