import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/mcq/sets/[id]/leaderboard — anonymized top scores + requester rank
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Best score per user (highest score, then fastest time)
  const allAttempts = await prisma.mCQAttempt.findMany({
    where: { mcqSetId: params.id },
    orderBy: [{ score: 'desc' }, { timeTaken: 'asc' }],
  });

  // Keep only best attempt per user
  const bestByUser = new Map<string, typeof allAttempts[0]>();
  for (const a of allAttempts) {
    if (!bestByUser.has(a.userId)) bestByUser.set(a.userId, a);
  }

  const ranked = Array.from(bestByUser.values()).sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.timeTaken - b.timeTaken
  );

  const totalStudents = ranked.length;
  const myRank = ranked.findIndex(a => a.userId === user.id) + 1;

  // Anonymize top 5
  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const top5 = ranked.slice(0, 5).map((a, i) => ({
    rank: i + 1,
    label: `Student ${labels[i]}`,
    score: a.score,
    total: a.total,
    pct: a.total > 0 ? Math.round((a.score / a.total) * 100) : 0,
    isMe: a.userId === user.id,
  }));

  return NextResponse.json({ top5, myRank, totalStudents });
}
