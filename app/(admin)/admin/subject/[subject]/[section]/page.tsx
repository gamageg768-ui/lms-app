import { prisma } from '@/lib/db';
import { SUBJECTS, SECTIONS } from '@/types';
import { notFound } from 'next/navigation';
import AdminSectionClient from '@/components/AdminSectionClient';

function subjectKeyFromSlug(slug: string) { return slug.toUpperCase().replace(/-/g, '_'); }
function sectionKeyFromSlug(slug: string) { return slug.toUpperCase().replace(/-/g, '_'); }

export default async function AdminSectionPage({ params }: { params: { subject: string; section: string } }) {
  const subjectKey = subjectKeyFromSlug(params.subject);
  const sectionKey = sectionKeyFromSlug(params.section);

  const subjectInfo = SUBJECTS.find((s) => s.key === subjectKey);
  const sectionInfo = SECTIONS.find((s) => s.key === sectionKey);
  if (!subjectInfo || !sectionInfo) notFound();

  if (sectionKey === 'FLASH_CARDS') {
    const cards = await prisma.flashCard.findMany({
      where: { subject: subjectKey },
      orderBy: { order: 'asc' },
    });
    return (
      <AdminSectionClient
        subjectKey={subjectKey} sectionKey={sectionKey}
        subjectLabel={subjectInfo.label} sectionLabel={sectionInfo.label}
        materials={[]} mcqSets={[]}
        flashCards={cards.map(c => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() }))}
        backHref={`/admin/subject/${params.subject}`}
      />
    );
  }

  const materials = await prisma.material.findMany({
    where: { subject: subjectKey, section: sectionKey },
    orderBy: { createdAt: 'desc' },
  });

  const mcqSets = sectionInfo.hasMCQ
    ? await prisma.mCQSet.findMany({
        where: { subject: subjectKey, section: sectionKey },
        include: { questions: { orderBy: { order: 'asc' } } },
      })
    : [];

  const users = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, name: true, email: true },
  });

  const permissions = await prisma.downloadPermission.findMany({
    where: { materialId: { in: materials.map((m) => m.id) } },
  });

  return (
    <AdminSectionClient
      subjectKey={subjectKey} sectionKey={sectionKey}
      subjectLabel={subjectInfo.label} sectionLabel={sectionInfo.label}
      hasMCQ={sectionInfo.hasMCQ}
      materials={materials.map(m => ({
        ...m, description: m.description ?? null,
        createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString(),
      }))}
      mcqSets={mcqSets.map(s => ({
        ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
        questions: s.questions.map(q => ({ ...q, explanation: q.explanation ?? null, createdAt: q.createdAt.toISOString() })),
      }))}
      flashCards={[]}
      users={users}
      permissions={permissions.map(p => ({ ...p, grantedAt: p.grantedAt.toISOString() }))}
      backHref={`/admin/subject/${params.subject}`}
    />
  );
}
