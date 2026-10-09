import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SUBJECTS } from '@/types';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import LeaderboardClient from '@/components/LeaderboardClient';

function subjectKeyFromSlug(slug: string) {
  return slug.toUpperCase().replace(/-/g, '_');
}

export default async function SubjectLeaderboardPage({ params }: { params: { subject: string } }) {
  const session = await auth();
  const currentUser = session?.user as any;

  const subjectKey = subjectKeyFromSlug(params.subject);
  const subjectInfo = SUBJECTS.find(s => s.key === subjectKey);
  if (!subjectInfo) notFound();

  // Aggregate MCQ attempts per user for this subject
  const raw = await prisma.mCQAttempt.groupBy({
    by: ['userId'],
    where: { mcqSet: { subject: subjectKey } },
    _sum: { score: true, total: true },
    _count: { id: true },
    orderBy: { _sum: { score: 'desc' } },
    take: 20,
  });

  // Fetch user initials for the top 20
  const userIds = raw.map(r => r.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

  function initials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  const rows = raw.map((r, i) => {
    const name = userMap[r.userId] ?? '??';
    const totalScore = r._sum.score ?? 0;
    const totalQ = r._sum.total ?? 0;
    const pct = totalQ > 0 ? Math.round((totalScore / totalQ) * 100) : 0;
    return {
      rank: i + 1,
      initials: initials(name),
      isCurrentUser: r.userId === currentUser?.id,
      pct,
      totalScore,
      totalQuestions: totalQ,
      attempts: r._count.id,
    };
  });

  const slug = params.subject;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href={`/subject/${slug}`} className="text-gray-400 hover:text-gray-700 text-sm">← {subjectInfo.label}</Link>
      <div className="flex items-center gap-3 mt-2 mb-8">
        <span className="text-4xl">{subjectInfo.icon}</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{subjectInfo.label}</h1>
          <p className="text-gray-500 text-sm">MCQ Leaderboard — top {rows.length} students by total score</p>
        </div>
      </div>

      <LeaderboardClient rows={rows} />

      <p className="text-xs text-gray-400 mt-4 text-center">
        Rankings based on all MCQ attempts across all sets in this subject. Student names are anonymised.
      </p>
    </div>
  );
}
