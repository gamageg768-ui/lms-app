import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { put } from '@vercel/blob';

// GET /api/materials?subject=&section=
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subject = searchParams.get('subject');
  const section = searchParams.get('section');

  const isAdmin = (session?.user as any)?.role === 'ADMIN';
  const where: any = {};
  if (subject) where.subject = subject;
  if (section) where.section = section;
  if (!isAdmin) {
    where.OR = [{ publishAt: null }, { publishAt: { lte: new Date() } }];
  }

  const materials = await prisma.material.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, description: true,
      subject: true, section: true, filename: true,
      fileSize: true, uploadedById: true,
      createdAt: true, updatedAt: true,
      markingSchemePath: true, markingSchemeFilename: true, markingSchemeFileSize: true,
      videoUrl: true, publishAt: true, expiresAt: true, difficulty: true,
    },
  });
  return NextResponse.json(materials);
}

// POST /api/materials - Admin upload
export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const subject = formData.get('subject') as string;
  const section = formData.get('section') as string;

  if (!file || !title || !subject || !section) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
  }

  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { url: filePath } = await put(`materials/${subject}/${section}/${safeName}`, buffer, { access: 'public' });

  let msPath: string | null = null, msFilename: string | null = null, msSize: number | null = null;
  const msFile = formData.get('markingSchemeFile') as File | null;
  if (msFile && msFile.name && msFile.name.toLowerCase().endsWith('.pdf')) {
    const msSafeName = `ms-${Date.now()}-${msFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const msBuffer = Buffer.from(await msFile.arrayBuffer());
    const { url } = await put(`materials/${subject}/${section}/${msSafeName}`, msBuffer, { access: 'public' });
    msPath = url;
    msFilename = msFile.name;
    msSize = msBuffer.length;
  }

  const material = await prisma.material.create({
    data: {
      title,
      description: description || null,
      subject,
      section,
      filename: file.name,
      filePath,
      fileSize: buffer.length,
      uploadedById: user.id,
      markingSchemePath: msPath,
      markingSchemeFilename: msFilename,
      markingSchemeFileSize: msSize,
    },
  });

  return NextResponse.json(material, { status: 201 });
}
