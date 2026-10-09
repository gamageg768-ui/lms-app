import { prisma } from '@/lib/db';
import Link from 'next/link';
import { SUBJECTS, SECTIONS } from '@/types';
import AdminExamDates from '@/components/AdminExamDates';

export default async function AdminDashboard() {
  const [userCount, materialCount, flashCount, mcqCount] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.material.count(),
    prisma.flashCard.count(),
    prisma.mCQQuestion.count(),
  ]);

  const [recentMaterials, allExamDates] = await Promise.all([
    prisma.material.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, subject: true, section: true, createdAt: true },
    }),
    prisma.examDate.findMany({ orderBy: { examAt: 'asc' } }),
  ]);
  const serializedExamDates = allExamDates.map(d => ({
    ...d,
    examAt: d.examAt.toISOString(),
    createdAt: d.createdAt.toISOString(),
  }));

  const stats = [
    { label: 'Students', value: userCount, icon: '👥', color: 'bg-blue-50 text-blue-700 border-blue-100' },
    { label: 'Materials', value: materialCount, icon: '📄', color: 'bg-green-50 text-green-700 border-green-100' },
    { label: 'Flash Cards', value: flashCount, icon: '🃏', color: 'bg-purple-50 text-purple-700 border-purple-100' },
    { label: 'MCQ Questions', value: mcqCount, icon: '❓', color: 'bg-orange-50 text-orange-700 border-orange-100' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">Manage all LMS content from here</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-2xl border p-4 sm:p-5 ${stat.color}`}>
            <div className="text-xl sm:text-2xl mb-1.5">{stat.icon}</div>
            <div className="text-2xl sm:text-3xl font-bold">{stat.value}</div>
            <div className="text-xs sm:text-sm mt-1 opacity-80">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Exam Dates */}
      <div className="mb-5 sm:mb-6">
        <AdminExamDates initial={serializedExamDates} />
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Quick access */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Quick Access — Subjects</h2>
          <div className="grid grid-cols-2 gap-2">
            {SUBJECTS.map((sub) => {
              const slug = sub.key.toLowerCase().replace(/_/g, '-');
              return (
                <Link
                  key={sub.key}
                  href={`/admin/subject/${slug}`}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-sm font-medium text-gray-700 transition active:bg-blue-100"
                >
                  <span>{sub.icon}</span>
                  <span className="truncate text-xs sm:text-sm">{sub.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent uploads */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Recent Uploads</h2>
          {recentMaterials.length === 0 ? (
            <p className="text-sm text-gray-400">No materials uploaded yet</p>
          ) : (
            <ul className="space-y-2.5">
              {recentMaterials.map((m) => (
                <li key={m.id} className="flex items-center gap-3 text-sm">
                  <span className="text-lg flex-shrink-0">📄</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800 truncate text-sm">{m.title}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {SUBJECTS.find(s => s.key === m.subject)?.label} · {SECTIONS.find(s => s.key === m.section)?.label}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/users" className="inline-block mt-4 text-sm text-blue-600 hover:underline font-medium">
            Manage students →
          </Link>
        </div>
      </div>
    </div>
  );
}
