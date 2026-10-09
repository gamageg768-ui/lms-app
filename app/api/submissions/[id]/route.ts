import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/submissions/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const submission = await prisma.paperSubmission.findUnique({
    where: { id: params.id },
    include: {
      student: { select: { id: true, name: true, email: true } },
      material: { select: { id: true, title: true, subject: true, section: true } },
      reviewer: { select: { name: true } },
    },
  });

  if (!submission) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (user.role !== 'ADMIN' && submission.studentId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(submission);
}
