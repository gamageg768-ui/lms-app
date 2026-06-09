import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SUBJECTS } from '@/types';
import { notFound } from 'next/navigation';
import MaterialViewerClient from '@/components/MaterialViewerClient';

function subjectKeyFromSlug(slug: string) { return slug.toUpperCase().replace(/-/g, '_'); }

export default async function TheoryPage({ params }: { params: { subject: string } }) {
  const session = await auth();
  const user = session?.user as any;
  const subjectKey = subjectKeyFromSlug(params.subject);
  const subjectInfo = SUBJECTS.find((s) => s.key === subjectKey);
  if (!subjectInfo) notFound();

  const materials = await prisma.material.findMany({
    where: { subject: subjectKey, section: 'THEORY' },
    orderBy: { createdAt: 'desc' },
  });
  const permissions = await prisma.downloadPermission.findMany({
    where: { userId: user.id, materialId: { in: materials.map((m) => m.id) } },
  });
  const permSet = new Set(permissions.map((p) => p.materialId));

  return (
    <MaterialViewerClient
      materials={materials.map((m) => ({
        ...m, fileSize: m.fileSize ?? 0, description: m.description ?? null,
        createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString(),
        hasDownloadPermission: permSet.has(m.id),
      }))}
      mcqSets={[]}
      subject={subjectKey} section="THEORY" sectionLabel="Theory"
      userEmail={user.email} subjectLabel={subjectInfo.label} backHref={`/subject/${params.subject}`}
    />
  );
}
