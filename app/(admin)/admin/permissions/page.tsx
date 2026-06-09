import { prisma } from '@/lib/db';
import Link from 'next/link';
import { SUBJECTS, SECTIONS } from '@/types';

export default async function AdminPermissionsPage() {
  const permissions = await prisma.downloadPermission.findMany({
    orderBy: { grantedAt: 'desc' },
    include: {
      user: { select: { name: true, email: true } },
      material: { select: { title: true, subject: true, section: true } },
    },
    take: 100,
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/admin" className="text-gray-400 hover:text-gray-700 text-sm">← Dashboard</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Download Permissions</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          All granted permissions — manage from each subject/section page
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        {permissions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🔑</div>
            <p className="text-gray-500">No permissions granted yet</p>
            <p className="text-sm text-gray-400 mt-1">Go to a subject section to grant download permissions</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left">Student</th>
                <th className="px-6 py-3 text-left">Material</th>
                <th className="px-6 py-3 text-left">Subject / Section</th>
                <th className="px-6 py-3 text-left">Granted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {permissions.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <p className="font-medium text-gray-800">{p.user.name}</p>
                    <p className="text-xs text-gray-400">{p.user.email}</p>
                  </td>
                  <td className="px-6 py-3 font-medium text-gray-700">{p.material.title}</td>
                  <td className="px-6 py-3">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {SUBJECTS.find(s => s.key === p.material.subject)?.label ?? p.material.subject}
                    </span>
                    <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {SECTIONS.find(s => s.key === p.material.section)?.label ?? p.material.section}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-400 text-xs">
                    {new Date(p.grantedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
