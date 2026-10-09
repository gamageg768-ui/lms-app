import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SUBJECTS } from '@/types';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import MaterialViewerClient from '@/components/MaterialViewerClient';

function subjectKeyFromSlug(slug: string) {
  return slug.toUpperCase().replace(/-/g, '_');
}

export default async function PastPapersPage({ params }: { params: { subject: string } }) {
  const session = await auth();
  const user = session?.user as any;

  const subjectKey = subjectKeyFromSlug(params.subject);
  const subjectInfo = SUBJECTS.find((s) => s.key === subjectKey);
  if (!subjectInfo) notFound();

  const now = new Date();
  const [materials, permissions, mcqSets, learningPaths, secConfig] = await Promise.all([
    prisma.material.findMany({ where: { subject: subjectKey, section: 'PAST_PAPERS' }, orderBy: { createdAt: 'desc' } }),
    prisma.downloadPermission.findMany({ where: { userId: user.id } }),
    prisma.mCQSet.findMany({ where: { subject: subjectKey, section: 'PAST_PAPERS' }, include: { questions: { orderBy: { order: 'asc' } } } }),
    prisma.learningPath.findMany({ where: { subject: subjectKey }, include: { items: { orderBy: { order: 'asc' }, include: { material: { select: { id: true, title: true, filename: true } } } } } }),
    prisma.securityConfig.findUnique({ where: { id: 'global' } }),
  ]);
  const permSet = new Set(permissions.map((p) => p.materialId));
  const securityConfig = secConfig ?? { pdfWatermark: true, pdfPointerOverlay: true, concurrentSessionGuard: true };

  return (
    <MaterialViewerClient
      materials={materials.map((m) => ({
        ...m, fileSize: m.fileSize ?? 0,
        description: m.description ?? null,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        hasDownloadPermission: permSet.has(m.id),
        difficulty: m.difficulty ?? null,
        publishAt: m.publishAt ? m.publishAt.toISOString() : null,
        expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
        comingSoon: !!(m.publishAt && m.publishAt > now),
      }))}
      learningPaths={learningPaths.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        items: p.items.map(i => ({ ...i, material: i.material })),
      }))}
      mcqSets={mcqSets.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        questions: s.questions.map((q) => ({
          ...q,
          explanation: q.explanation ?? null,
          createdAt: q.createdAt.toISOString(),
        })),
      }))}
      subject={subjectKey}
      section="PAST_PAPERS"
      sectionLabel="Past Papers"
      userEmail={user.email}
      subjectLabel={subjectInfo.label}
      backHref={`/subject/${params.subject}`}
      securityConfig={securityConfig}
    />
  );
}
