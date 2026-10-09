import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SUBJECTS } from '@/types';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export default async function ReportsPage() {
  const session = await auth();
  const user = session?.user as any;
  if (user?.role !== 'ADMIN') notFound();

  // Feature 13: Never-opened materials (no AccessLog VIEW entry)
  const allMaterials = await prisma.material.findMany({
    select: { id: true, title: true, subject: true, section: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const viewedMaterialIds = await prisma.accessLog.findMany({
    where: { action: 'VIEW' },
    select: { materialId: true },
    distinct: ['materialId'],
  });
  const viewedSet = new Set(viewedMaterialIds.map(v => v.materialId));
  const neverOpened = allMaterials.filter(m => !viewedSet.has(m.id));

  // Top-viewed materials (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const topViewed = await prisma.accessLog.groupBy({
    by: ['materialId'],
    where: { action: 'VIEW', createdAt: { gte: thirtyDaysAgo } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });
  const topViewedMaterials = await Promise.all(
    topViewed.map(async (entry) => {
      const mat = await prisma.material.findUnique({
        where: { id: entry.materialId },
        select: { title: true, subject: true },
      });
      return { ...entry, material: mat };
    })
  );

  // Per-subject view totals
  const subjectViewTotals = await prisma.accessLog.groupBy({
    by: ['materialId'],
    where: { action: 'VIEW' },
    _count: { id: true },
  });

  const subjectMap: Record<string, number> = {};
  for (const entry of subjectViewTotals) {
    const mat = allMaterials.find(m => m.id === entry.materialId);
    if (mat) subjectMap[mat.subject] = (subjectMap[mat.subject] ?? 0) + entry._count.id;
  }

  // Least-engaged students (fewest views in last 30 days)
  const studentViews = await prisma.accessLog.groupBy({
    by: ['userId'],
    where: { action: 'VIEW', createdAt: { gte: thirtyDaysAgo } },
    _count: { id: true },
    orderBy: { _count: { id: 'asc' } },
    take: 10,
  });
  const studentDetails = await Promise.all(
    studentViews.map(async entry => {
      const u = await prisma.user.findUnique({ where: { id: entry.userId }, select: { name: true, email: true } });
      return { ...entry, user: u };
    })
  );

  // Total stats
  const totalViews = await prisma.accessLog.count({ where: { action: 'VIEW' } });
  const totalDownloads = await prisma.accessLog.count({ where: { action: 'DOWNLOAD' } });
  const totalStudents = await prisma.user.count({ where: { role: 'STUDENT' } });

  return (
    <div className="p-6 max-w-5xl space-y-8">
      <div>
        <Link href="/admin" className="text-gray-400 hover:text-gray-700 text-sm">← Dashboard</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">📊 Content Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Engagement and access analytics for all materials</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Views', value: totalViews, color: 'text-blue-600' },
          { label: 'Total Downloads', value: totalDownloads, color: 'text-green-600' },
          { label: 'Registered Students', value: totalStudents, color: 'text-purple-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Never-opened materials */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Never-Opened Materials</h2>
            <p className="text-sm text-gray-500 mt-0.5">{neverOpened.length} materials have never been viewed</p>
          </div>
          <span className="text-xs bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-full">{neverOpened.length}</span>
        </div>
        {neverOpened.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">All materials have been opened at least once.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Title</th>
                  <th className="px-6 py-3 text-left">Subject</th>
                  <th className="px-6 py-3 text-left">Section</th>
                  <th className="px-6 py-3 text-left">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {neverOpened.map(m => {
                  const sub = SUBJECTS.find(s => s.key === m.subject);
                  const slug = m.subject.toLowerCase().replace(/_/g, '-');
                  const secSlug = m.section.toLowerCase().replace(/_/g, '-');
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-800">
                        <Link href={`/admin/subject/${slug}/${secSlug}`} className="hover:text-blue-600 hover:underline">
                          {m.title}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-gray-500">{sub?.icon} {sub?.label ?? m.subject}</td>
                      <td className="px-6 py-3 text-gray-500">{m.section.replace(/_/g, ' ')}</td>
                      <td className="px-6 py-3 text-gray-400">{timeAgo(m.createdAt.toISOString())}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top viewed materials */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Top Viewed Materials (Last 30 Days)</h2>
        </div>
        {topViewedMaterials.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No view data yet.</div>
        ) : (
          <ol className="divide-y divide-gray-100">
            {topViewedMaterials.map((entry, i) => {
              const sub = SUBJECTS.find(s => s.key === entry.material?.subject);
              return (
                <li key={entry.materialId} className="flex items-center gap-4 px-6 py-3">
                  <span className="text-sm font-bold text-gray-400 w-6 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{entry.material?.title ?? 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{sub?.icon} {sub?.label}</p>
                  </div>
                  <span className="flex-shrink-0 text-sm font-bold text-blue-600">{entry._count.id} views</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Per-subject view totals */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Views by Subject</h2>
        </div>
        <div className="p-4 space-y-2">
          {SUBJECTS.map(sub => {
            const views = subjectMap[sub.key] ?? 0;
            const maxViews = Math.max(...SUBJECTS.map(s => subjectMap[s.key] ?? 0), 1);
            return (
              <div key={sub.key} className="flex items-center gap-3">
                <span className="text-sm w-36 flex-shrink-0 flex items-center gap-1.5">
                  <span>{sub.icon}</span>
                  <span className="truncate text-gray-700">{sub.label}</span>
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(views / maxViews) * 100}%` }} />
                </div>
                <span className="text-sm font-bold text-gray-600 w-16 text-right flex-shrink-0">{views}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Least-engaged students */}
      {studentDetails.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Least-Engaged Students (Last 30 Days)</h2>
            <p className="text-sm text-gray-500 mt-0.5">Students with fewest material views</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Student</th>
                <th className="px-6 py-3 text-right">Views (30d)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {studentDetails.map(entry => (
                <tr key={entry.userId} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <p className="font-medium text-gray-800">{entry.user?.name ?? 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{entry.user?.email}</p>
                  </td>
                  <td className="px-6 py-3 text-right font-bold text-gray-600">{entry._count.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
