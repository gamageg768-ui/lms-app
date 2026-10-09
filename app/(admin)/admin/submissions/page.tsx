import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import ExaminerPanelClient from '@/components/ExaminerPanelClient';
import { PaperSubmission, SubmissionStatus } from '@/types';

export default async function AdminSubmissionsPage() {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') redirect('/login');

  const rows = await prisma.paperSubmission.findMany({
    orderBy: { submittedAt: 'desc' },
    include: {
      student: { select: { id: true, name: true, email: true } },
      material: { select: { id: true, title: true, subject: true, section: true } },
      reviewer: { select: { name: true } },
    },
  });

  const submissions: PaperSubmission[] = rows.map(r => ({
    ...r,
    status: r.status as SubmissionStatus,
    score: r.score ?? null,
    maxScore: r.maxScore ?? null,
    feedback: r.feedback ?? null,
    correctedFilename: r.correctedFilename ?? null,
    correctedFileSize: r.correctedFileSize ?? null,
    correctedAt: r.correctedAt ? r.correctedAt.toISOString() : null,
    reviewedById: r.reviewedById ?? null,
    submittedAt: r.submittedAt.toISOString(),
    student: r.student,
    material: r.material,
    reviewer: r.reviewer ?? null,
  }));

  const pending = submissions.filter(s => s.status === 'PENDING').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Paper Submissions</h1>
        <p className="text-gray-500 text-sm">
          {submissions.length} total submission{submissions.length !== 1 ? 's' : ''}
          {pending > 0 && <span className="ml-2 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">{pending} pending</span>}
        </p>
      </div>
      <ExaminerPanelClient initial={submissions} />
    </div>
  );
}
