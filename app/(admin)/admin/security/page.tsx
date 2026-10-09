import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import SecuritySettingsClient from '@/components/SecuritySettingsClient';

export default async function SecurityDashboardPage() {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') redirect('/login');

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Top 10 most-viewed materials in last 7 days
  const topViewed = await prisma.accessLog.groupBy({
    by: ['materialId'],
    _count: { id: true },
    where: { createdAt: { gte: sevenDaysAgo }, action: 'VIEW' },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  const materialIds = topViewed.map(v => v.materialId);
  const materials = await prisma.material.findMany({
    where: { id: { in: materialIds } },
    select: { id: true, title: true, subject: true, section: true },
  });
  const matMap = Object.fromEntries(materials.map(m => [m.id, m]));

  // Recent access logs (last 50)
  const recentLogs = await prisma.accessLog.findMany({
    where: { createdAt: { gte: yesterday } },
    include: {
      user: { select: { name: true, email: true } },
      material: { select: { title: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Materials nearing expiry (next 7 days)
  const nearingExpiry = await prisma.material.findMany({
    where: {
      expiresAt: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { expiresAt: 'asc' },
    take: 10,
  });

  // Total access counts
  const totalViews = await prisma.accessLog.count({ where: { action: 'VIEW', createdAt: { gte: sevenDaysAgo } } });
  const totalDownloads = await prisma.accessLog.count({ where: { action: 'DOWNLOAD', createdAt: { gte: sevenDaysAgo } } });
  const totalUsers = await prisma.user.count({ where: { role: 'STUDENT' } });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Security Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Content access monitoring and threat detection</p>
      </div>

      <SecuritySettingsClient />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Views (7d)', value: totalViews, color: 'blue' },
          { label: 'Downloads (7d)', value: totalDownloads, color: 'purple' },
          { label: 'Students', value: totalUsers, color: 'green' },
          { label: 'Expiring Soon', value: nearingExpiry.length, color: nearingExpiry.length > 0 ? 'amber' : 'gray' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 text-${s.color}-600`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top viewed materials */}
        <div className="bg-white rounded-2xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-sm">Top Viewed Materials (7d)</h2>
            <Link href="/admin/security/trace" className="text-xs text-blue-600 hover:underline">Trace watermark →</Link>
          </div>
          {topViewed.length === 0 ? (
            <p className="p-5 text-sm text-gray-400">No view data yet</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {topViewed.map(v => {
                const m = matMap[v.materialId];
                return (
                  <li key={v.materialId} className="px-5 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m?.title ?? v.materialId}</p>
                      <p className="text-xs text-gray-400">{m?.subject} / {m?.section}</p>
                    </div>
                    <span className="ml-3 text-sm font-bold text-blue-600 flex-shrink-0">{v._count.id} views</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Materials nearing expiry */}
        <div className="bg-white rounded-2xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 text-sm">Expiring in Next 7 Days</h2>
          </div>
          {nearingExpiry.length === 0 ? (
            <p className="p-5 text-sm text-gray-400">No materials expiring soon</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {nearingExpiry.map(m => (
                <li key={m.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{m.title}</p>
                    <p className="text-xs text-gray-400">{m.subject} / {m.section}</p>
                  </div>
                  <span className="ml-3 text-xs font-semibold text-amber-600 flex-shrink-0 bg-amber-50 px-2 py-1 rounded-lg">
                    {m.expiresAt ? new Date(m.expiresAt).toLocaleDateString() : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent access log */}
      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-sm">Access Log (Last 24h)</h2>
          <span className="text-xs text-gray-400">{recentLogs.length} entries</span>
        </div>
        {recentLogs.length === 0 ? (
          <p className="p-5 text-sm text-gray-400">No access events in the last 24 hours</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Material</th>
                  <th className="px-4 py-2 text-left">Action</th>
                  <th className="px-4 py-2 text-left">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2">
                      <p className="font-medium text-gray-800">{log.user.name}</p>
                      <p className="text-gray-400">{log.user.email}</p>
                    </td>
                    <td className="px-4 py-2 text-gray-700 max-w-[180px] truncate">{log.material.title}</td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded font-semibold ${
                        log.action === 'VIEW' ? 'bg-blue-100 text-blue-700' :
                        log.action === 'DOWNLOAD' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>{log.action}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-400 font-mono">{log.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
