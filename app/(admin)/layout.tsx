import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/AdminSidebar';
import ScreenshotGuard from '@/components/ScreenshotGuard';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/dashboard');

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <ScreenshotGuard />
      <AdminSidebar adminName={user.name ?? 'Admin'} adminEmail={user.email ?? ''} />
      <div className="flex-1 min-h-screen overflow-auto">
        {children}
      </div>
    </div>
  );
}
