import { SUBJECTS, SECTIONS } from '@/types';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SectionProgressBadge } from '@/components/SectionProgressBadge';

function subjectKeyFromSlug(slug: string): string {
  return slug.toUpperCase().replace(/-/g, '_');
}

export default async function SubjectPage({ params }: { params: { subject: string } }) {
  const subjectKey = subjectKeyFromSlug(params.subject);
  const subjectInfo = SUBJECTS.find((s) => s.key === subjectKey);
  if (!subjectInfo) notFound();

  // Get material counts per section for progress badges
  const counts = await prisma.material.groupBy({
    by: ['section'],
    where: { subject: subjectKey },
    _count: { id: true },
  });
  const countMap: Record<string, number> = {};
  for (const row of counts) countMap[row.section] = row._count.id;

  const sectionHref = (sectionKey: string) => {
    const sectionSlug = sectionKey.toLowerCase().replace(/_/g, '-');
    return `/subject/${params.subject}/${sectionSlug}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-800 font-semibold">{subjectInfo.label}</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">{subjectInfo.label}</h1>
      <p className="text-gray-500 mb-8">Select a section to access study materials</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SECTIONS.map((section) => (
          <Link
            key={section.key}
            href={sectionHref(section.key)}
            className="flex items-center gap-4 bg-white border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-2xl p-5 transition-all group"
          >
            <div className="flex-shrink-0 w-12 h-12 bg-gray-100 group-hover:bg-blue-100 rounded-xl flex items-center justify-center text-xl transition-colors">
              {section.icon}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900">{section.label}</div>
              {section.hasMCQ && (
                <div className="text-xs text-blue-600 mt-0.5 font-medium">Includes MCQ Practice</div>
              )}
              {(countMap[section.key] ?? 0) > 0 && (
                <SectionProgressBadge section={section.key} total={countMap[section.key]} />
              )}
            </div>
            <div className="ml-auto text-gray-300 group-hover:text-blue-500 transition-colors text-lg flex-shrink-0">→</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
