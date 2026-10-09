'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { SUBJECTS } from '@/types';

interface Props {
  adminName: string;
  adminEmail: string;
}

export default function AdminSidebar({ adminName, adminEmail }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col min-h-screen flex-shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-700">
        <div className="flex flex-col gap-1">
          <img src="/velora-logo.svg" alt="Velora Education" className="h-10 brightness-0 invert" />
          <div className="text-xs text-gray-400 tracking-wider uppercase">Admin Panel</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NavItem href="/admin" label="Dashboard" icon="🏠" active={pathname === '/admin'} />
        <NavItem href="/admin/users" label="Students" icon="👥" active={pathname.startsWith('/admin/users')} />
        <NavItem href="/admin/submissions" label="Submissions" icon="📬" active={pathname.startsWith('/admin/submissions')} />
        <NavItem href="/admin/permissions" label="Permissions" icon="🔑" active={pathname.startsWith('/admin/permissions')} />
        <NavItem href="/admin/security" label="Security" icon="🔒" active={pathname.startsWith('/admin/security')} />
        <NavItem href="/admin/reports" label="Reports" icon="📊" active={pathname.startsWith('/admin/reports')} />

        <div className="pt-3 pb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-3">Subjects</p>
        </div>

        {SUBJECTS.map((sub) => {
          const slug = sub.key.toLowerCase().replace(/_/g, '-');
          return (
            <NavItem
              key={sub.key}
              href={`/admin/subject/${slug}`}
              label={sub.label}
              icon={sub.icon}
              active={pathname.startsWith(`/admin/subject/${slug}`)}
            />
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="px-4 py-4 border-t border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            {adminName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{adminName}</p>
            <p className="text-xs text-gray-400 truncate">{adminEmail}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full text-sm text-red-400 hover:text-red-300 hover:bg-red-950 px-3 py-2 rounded-lg transition text-left"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

function NavItem({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors ${
        active ? 'bg-blue-600 text-white font-semibold' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
      }`}
    >
      <span>{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
