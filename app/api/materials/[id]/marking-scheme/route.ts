import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { put, del } from '@vercel/blob';

const SECURITY_HEADERS = {
  'Content-Type': 'application/pdf',
  'Content-Disposition': 'inline',
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'self'",
  'X-Frame-Options': 'SAMEORIGIN',
};

// GET /api/materials/[id]/marking-scheme - serve marking scheme PDF
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const material = await prisma.material.findUnique({ where: { id: params.id } });
  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!material.markingSchemePath) return NextResponse.json({ error: 'No marking scheme' }, { status: 404 });

  const user = session.user as any;
  prisma.accessLog.create({
    data: {
      userId: user.id,
      materialId: params.id,
      action: 'VIEW_SCHEME',
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined,
    },
  }).catch(() => {});

  const blobRes = await fetch(material.markingSchemePath);
  if (!blobRes.ok) return NextResponse.json({ error: 'File not found' }, { status: 404 });
  return new NextResponse(blobRes.body, { headers: SECURITY_HEADERS });
}

// POST /api/materials/[id]/marking-scheme - upload/replace marking scheme (admin only)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const material = await prisma.material.findUnique({ where: { id: params.id } });
  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('markingSchemeFile') as File;
  if (!file || !file.name) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!file.name.toLowerCase().endsWith('.pdf')) return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });

  if (material.markingSchemePath) {
    try { await del(material.markingSchemePath); } catch {}
  }

  const safeFilename = `ms-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { url: markingSchemePath } = await put(
    `materials/${material.subject}/${material.section}/${safeFilename}`,
    buffer,
    { access: 'public' }
  );

  const updated = await prisma.material.update({
    where: { id: params.id },
    data: {
      markingSchemePath,
      markingSchemeFilename: file.name,
      markingSchemeFileSize: buffer.length,
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/materials/[id]/marking-scheme - remove marking scheme (admin only)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const material = await prisma.material.findUnique({ where: { id: params.id } });
  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (material.markingSchemePath) {
    try { await del(material.markingSchemePath); } catch {}
  }

  const updated = await prisma.material.update({
    where: { id: params.id },
    data: { markingSchemePath: null, markingSchemeFilename: null, markingSchemeFileSize: null },
  });

  return NextResponse.json(updated);
}
