import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { put } from '@vercel/blob';

// POST /api/submissions/[id]/review — admin uploads corrected paper + feedback + optional score
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const submission = await prisma.paperSubmission.findUnique({ where: { id: params.id } });
  if (!submission) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const formData = await req.formData();
  const feedback = (formData.get('feedback') as string) || null;
  const scoreRaw = formData.get('score') as string | null;
  const maxScoreRaw = formData.get('maxScore') as string | null;
  const correctedFile = formData.get('correctedFile') as File | null;

  const score = scoreRaw ? parseInt(scoreRaw, 10) : null;
  const maxScore = maxScoreRaw ? parseInt(maxScoreRaw, 10) : null;

  let correctedFilePath = submission.correctedFilePath;
  let correctedFilename = submission.correctedFilename;
  let correctedFileSize = submission.correctedFileSize;

  if (correctedFile && correctedFile.name) {
    if (!correctedFile.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }
    const safeName = `corrected-${Date.now()}-${correctedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const buffer = Buffer.from(await correctedFile.arrayBuffer());
    const { url } = await put(`submissions/${submission.studentId}/${safeName}`, buffer, { access: 'public' });
    correctedFilePath = url;
    correctedFilename = correctedFile.name;
    correctedFileSize = buffer.length;
  }

  const updated = await prisma.paperSubmission.update({
    where: { id: params.id },
    data: {
      status: 'REVIEWED',
      feedback,
      score,
      maxScore,
      correctedFilePath,
      correctedFilename,
      correctedFileSize,
      correctedAt: new Date(),
      reviewedById: user.id,
    },
    include: {
      student: { select: { id: true, name: true, email: true } },
      material: { select: { id: true, title: true, subject: true, section: true } },
      reviewer: { select: { name: true } },
    },
  });

  return NextResponse.json(updated);
}
