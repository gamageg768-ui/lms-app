import { prisma } from '@/lib/db';
import Link from 'next/link';
import { SUBJECTS, SECTIONS } from '@/types';

export default async function AdminDashboard() {
  const [userCount, materialCount, flashCount, mcqCount] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.material.count(),
    prisma.flashCard.count(),
    prisma.mCQQuestion.count(),
  ]);

  const recentMaterials = await prisma.material.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, subject: true, section: true, createdAt: true },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage all LMS content from here</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Students', value: userCount, icon: '👥', color: 'blue' },
          { label: 'Materials', value: materialCount, icon: '📄', color: 'green' },
          { label: 'Flash Cards', value: flashCount, icon: '🃏', color: 'purple' },
          { label: 'MCQ Questions', value: mcqCount, icon: '❓', color: 'orange' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick access */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4">Quick Access — Subjects</h2>
          <div className="grid grid-cols-2 gap-2">
            {SUBJECTS.map((sub) => {
              const slug = sub.key.toLowerCase().replace(/_/g, '-');
              return (
                <Link key={sub.key} href={`/admin/subject/${slug}`}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-sm font-medium text-gray-700 transition">
                  <span>{sub.icon}</span>
                  <span className="truncate text-xs">{sub.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent uploads */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4">Recent Uploads</h2>
          {recentMaterials.length === 0 ? (
            <p className="text-sm text-gray-400">No materials uploaded yet</p>
          ) : (
            <ul className="space-y-2">
              {recentMaterials.map((m) => (
                <li key={m.id} className="flex items-center gap-3 text-sm">
                  <span className="text-lg">📄</span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{m.title}</p>
                    <p className="text-xs text-gray-400">
                      {SUBJECTS.find(s => s.key === m.subject)?.label} · {SECTIONS.find(s => s.key === m.section)?.label}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 ml-auto flex-shrink-0">
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
