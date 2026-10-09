import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import StudentSubmissionsClient from '@/components/StudentSubmissionsClient';
import { PaperSubmission, SubmissionStatus } from '@/types';

export default async function StudentSubmissionsPage() {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'STUDENT') redirect('/login');

  const rows = await prisma.paperSubmission.findMany({
    where: { studentId: user.id },
    orderBy: { submittedAt: 'desc' },
    include: {
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
    material: r.material,
    reviewer: r.reviewer ?? null,
  }));

  const reviewed = submissions.filter(s => s.status === 'REVIEWED').length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">My Submissions</h1>
        <p className="text-sm text-gray-500">
          {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
          {reviewed > 0 && <span className="ml-2 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">{reviewed} reviewed</span>}
        </p>
      </div>
      <StudentSubmissionsClient initial={submissions} />
    </div>
  );
}
