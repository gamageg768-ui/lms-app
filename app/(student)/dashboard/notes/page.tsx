import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import NotesHubClient from '@/components/NotesHubClient';

export default async function NotesHubPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const userId = (session.user as any).id;

  const notes = await prisma.materialNote.findMany({
    where: { userId },
    include: { material: { select: { id: true, title: true, subject: true, section: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  const serialized = notes.map(n => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
      </div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">📝 My Notes</h1>
        <span className="text-sm text-gray-400">{notes.length} annotation{notes.length !== 1 ? 's' : ''} across all materials</span>
      </div>
      <NotesHubClient notes={serialized} />
    </div>
  );
}
