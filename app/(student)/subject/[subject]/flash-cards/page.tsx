import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SUBJECTS } from '@/types';
import { notFound } from 'next/navigation';
import FlashCardPage from '@/components/FlashCardPage';

function subjectKeyFromSlug(slug: string) { return slug.toUpperCase().replace(/-/g, '_'); }

export default async function FlashCardsPage({ params }: { params: { subject: string } }) {
  const subjectKey = subjectKeyFromSlug(params.subject);
  const subjectInfo = SUBJECTS.find((s) => s.key === subjectKey);
  if (!subjectInfo) notFound();

  const cards = await prisma.flashCard.findMany({
    where: { subject: subjectKey },
    orderBy: { order: 'asc' },
  });

  return (
    <FlashCardPage
      cards={cards.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }))}
      subjectLabel={subjectInfo.label}
      backHref={`/subject/${params.subject}`}
      subject={subjectKey}
    />
  );
}
