import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/materials/[id]/serve - Serve PDF for in-browser viewing only
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const material = await prisma.material.findUnique({ where: { id: params.id } });
  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (material.expiresAt && material.expiresAt < new Date() && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'This material is no longer available.', code: 'EXPIRED' }, { status: 410 });
  }

  const blobRes = await fetch(material.filePath);
  if (!blobRes.ok) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const sessionRef = req.nextUrl.searchParams.get('ref') ?? undefined;
  prisma.accessLog.create({
    data: {
      userId: user.id,
      materialId: params.id,
      action: 'VIEW',
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined,
      sessionRef: sessionRef ?? undefined,
    },
  }).catch(() => {});

  return new NextResponse(blobRes.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'",
      'X-Frame-Options': 'SAMEORIGIN',
    },
  });
}
