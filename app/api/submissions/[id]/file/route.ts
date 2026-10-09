import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/submissions/[id]/file — serve the student's answer PDF
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const submission = await prisma.paperSubmission.findUnique({ where: { id: params.id } });
  if (!submission) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (user.role !== 'ADMIN' && submission.studentId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const blobRes = await fetch(submission.filePath);
  if (!blobRes.ok) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  return new NextResponse(blobRes.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${submission.filename}"`,
      'Cache-Control': 'no-store, private',
    },
  });
}
