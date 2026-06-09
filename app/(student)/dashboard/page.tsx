import { auth } from '@/lib/auth';
import Link from 'next/link';
import { SUBJECTS } from '@/types';

const colorMap: Record<string, { bg: string; border: string; icon: string; hover: string }> = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    icon: 'bg-blue-100 text-blue-700',    hover: 'hover:border-blue-400 hover:bg-blue-100' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  icon: 'bg-indigo-100 text-indigo-700', hover: 'hover:border-indigo-400 hover:bg-indigo-100' },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  icon: 'bg-purple-100 text-purple-700', hover: 'hover:border-purple-400 hover:bg-purple-100' },
  green:   { bg: 'bg-green-50',   border: 'border-green-200',   icon: 'bg-green-100 text-green-700',   hover: 'hover:border-green-400 hover:bg-green-100' },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-200',  icon: 'bg-orange-100 text-orange-700', hover: 'hover:border-orange-400 hover:bg-orange-100' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-700',hover: 'hover:border-emerald-400 hover:bg-emerald-100' },
};

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user as any;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 mt-1">Choose a subject to start studying</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {SUBJECTS.map((subject) => {
          const c = colorMap[subject.color];
          return (
            <Link
              key={subject.key}
              href={`/subject/${subject.key.toLowerCase().replace('_', '-')}`}
              className={`block border-2 ${c.border} ${c.bg} ${c.hover} rounded-2xl p-6 transition-all duration-200 hover:shadow-md group`}
            >
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl ${c.icon} text-2xl mb-4 group-hover:scale-110 transition-transform`}>
                {subject.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900">{subject.label}</h3>
              <div className="mt-3 flex flex-wrap gap-1">
                {['Past Papers', 'Model Papers', 'Short Notes', 'Flash Cards', 'Theory'].map((s) => (
                  <span key={s} className="text-xs bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center text-sm font-medium text-gray-600 group-hover:text-gray-900">
                Start studying →
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
