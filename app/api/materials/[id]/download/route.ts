import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { readFile } from 'fs/promises';
import path from 'path';
import { getUploadsDir } from '@/lib/utils';

// GET /api/materials/[id]/download - Download PDF (requires permission)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const material = await prisma.material.findUnique({ where: { id: params.id } });
  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Admin can always download; students need permission and are subject to download limit
  if (user.role !== 'ADMIN') {
    const permission = await prisma.downloadPermission.findUnique({
      where: { userId_materialId: { userId: user.id, materialId: params.id } },
    });
    if (!permission) {
      return NextResponse.json({ error: 'Download permission not granted' }, { status: 403 });
    }
    // Feature 8: enforce download limit
    if (permission.downloadCount >= permission.downloadLimit) {
      return NextResponse.json({ error: 'Download limit reached', code: 'LIMIT_REACHED' }, { status: 403 });
    }
    // Increment count before serving
    await prisma.downloadPermission.update({
      where: { userId_materialId: { userId: user.id, materialId: params.id } },
      data: { downloadCount: { increment: 1 } },
    });
  }

  // Feature 4: access audit log (fire-and-forget)
  prisma.accessLog.create({
    data: {
      userId: user.id,
      materialId: params.id,
      action: 'DOWNLOAD',
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined,
    },
  }).catch(() => {});

  try {
    const filePath = path.join(getUploadsDir(), material.filePath);
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(material.filename)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }
}
