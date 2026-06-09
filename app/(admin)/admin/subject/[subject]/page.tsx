import { prisma } from '@/lib/db';
import { SUBJECTS, SECTIONS } from '@/types';
import Link from 'next/link';
import { notFound } from 'next/navigation';

function subjectKeyFromSlug(slug: string) { return slug.toUpperCase().replace(/-/g, '_'); }

export default async function AdminSubjectPage({ params }: { params: { subject: string } }) {
  const subjectKey = subjectKeyFromSlug(params.subject);
  const subjectInfo = SUBJECTS.find((s) => s.key === subjectKey);
  if (!subjectInfo) notFound();

  const counts = await Promise.all(
    SECTIONS.filter(s => s.key !== 'FLASH_CARDS').map(async (sec) => ({
      section: sec.key,
      count: await prisma.material.count({ where: { subject: subjectKey, section: sec.key } }),
    }))
  );
  const flashCount = await prisma.flashCard.count({ where: { subject: subjectKey } });
  const countMap = Object.fromEntries(counts.map((c) => [c.section, c.count]));

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/admin" className="text-gray-400 hover:text-gray-700 text-sm">← Dashboard</Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">{subjectInfo.label}</h1>
        <p className="text-gray-500 mt-1">Manage content for this subject</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.map((sec) => {
          const slug = sec.key.toLowerCase().replace(/_/g, '-');
          const count = sec.key === 'FLASH_CARDS' ? flashCount : (countMap[sec.key] ?? 0);
          return (
            <Link
              key={sec.key}
              href={`/admin/subject/${params.subject}/${slug}`}
              className="bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-300 hover:shadow-md p-5 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="text-2xl">{sec.icon}</div>
                {sec.hasMCQ && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">+ MCQ</span>
                )}
              </div>
              <h3 className="font-bold text-gray-900 mt-3">{sec.label}</h3>
              <p className="text-sm text-gray-400 mt-1">
                {sec.key === 'FLASH_CARDS' ? `${count} cards` : `${count} file${count !== 1 ? 's' : ''}`}
              </p>
              <div className="mt-4 text-sm font-medium text-blue-600 group-hover:text-blue-700">
                Manage →
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
