'use client';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';

interface Props {
  user: { name: string; email: string; role: string };
}

export default function StudentNavbar({ user }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      <Link href="/dashboard">
        <img src="/velora-logo.svg" alt="Velora Education" className="h-9 sm:h-10" />
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/dashboard"
          className="hidden sm:inline text-sm text-gray-500 hover:text-gray-900 font-medium transition px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          Dashboard
        </Link>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-full pl-1.5 pr-3 py-1.5 text-sm font-medium text-gray-700 transition"
          >
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span className="hidden sm:inline max-w-[120px] truncate">{user.name}</span>
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <div className="py-1">
                <Link href="/dashboard" onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition sm:hidden">
                  🏠 Dashboard
                </Link>
                <Link href="/dashboard/notes" onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                  📝 My Notes
                </Link>
                <Link href="/dashboard/submissions" onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                  📬 My Submissions
                </Link>
              </div>
              <div className="border-t border-gray-100">
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
      )}
    </nav>
  );
}
