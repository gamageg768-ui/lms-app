import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { put } from '@vercel/blob';

// GET /api/submissions
// Students: own submissions. Admins: all, with optional ?subject= ?status= filters.
export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subject = searchParams.get('subject');
  const status = searchParams.get('status');

  const where: any = {};
  if (user.role !== 'ADMIN') where.studentId = user.id;
  if (subject) where.subject = subject;
  if (status) where.status = status;

  const submissions = await prisma.paperSubmission.findMany({
    where,
    orderBy: { submittedAt: 'desc' },
    include: {
      student: { select: { id: true, name: true, email: true } },
      material: { select: { id: true, title: true, subject: true, section: true } },
      reviewer: { select: { name: true } },
    },
  });

  return NextResponse.json(submissions);
}

// POST /api/submissions — student uploads answer paper PDF
export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const materialId = formData.get('materialId') as string;

  if (!file || !materialId) {
    return NextResponse.json({ error: 'file and materialId are required' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
  }

  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { url: filePath } = await put(`submissions/${user.id}/${safeName}`, buffer, { access: 'public' });

  const submission = await prisma.paperSubmission.create({
    data: {
      studentId: user.id,
      materialId,
      subject: material.subject,
      section: material.section,
      filename: file.name,
      filePath,
      fileSize: buffer.length,
    },
    include: {
      student: { select: { id: true, name: true, email: true } },
      material: { select: { id: true, title: true, subject: true, section: true } },
      reviewer: { select: { name: true } },
    },
  });

  return NextResponse.json(submission, { status: 201 });
}
