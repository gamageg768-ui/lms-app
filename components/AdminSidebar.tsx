'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { SUBJECTS } from '@/types';

interface Props {
  adminName: string;
  adminEmail: string;
  onClose?: () => void;
}

export default function AdminSidebar({ adminName, adminEmail, onClose }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-full min-h-screen">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex flex-col gap-0.5 min-w-0">
          <img src="/velora-logo.svg" alt="Velora Education" className="h-9 brightness-0 invert" />
          <div className="text-xs text-gray-400 tracking-wider uppercase">Admin Panel</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition flex-shrink-0"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <NavItem href="/admin" label="Dashboard" icon="🏠" active={pathname === '/admin'} onClick={onClose} />
        <NavItem href="/admin/users" label="Students" icon="👥" active={pathname.startsWith('/admin/users')} onClick={onClose} />
        <NavItem href="/admin/submissions" label="Submissions" icon="📬" active={pathname.startsWith('/admin/submissions')} onClick={onClose} />
        <NavItem href="/admin/permissions" label="Permissions" icon="🔑" active={pathname.startsWith('/admin/permissions')} onClick={onClose} />
        <NavItem href="/admin/security" label="Security" icon="🔒" active={pathname.startsWith('/admin/security')} onClick={onClose} />
        <NavItem href="/admin/reports" label="Reports" icon="📊" active={pathname.startsWith('/admin/reports')} onClick={onClose} />

        <div className="pt-4 pb-1">
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
              onClick={onClose}
            />
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="px-4 py-4 border-t border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-3">
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
          className="w-full text-sm text-red-400 hover:text-red-300 hover:bg-red-950 px-3 py-2 rounded-lg transition text-left flex items-center gap-2"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  href, label, icon, active, onClick,
}: {
  href: string; label: string; icon: string; active: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
        active ? 'bg-blue-600 text-white font-semibold' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
      }`}
    >
      <span className="text-base leading-none flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
