import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import AdminSidebar from '@/components/AdminSidebar';
import ScreenshotGuard from '@/components/ScreenshotGuard';

const DEFAULT_SEC = { screenshotGuard: true, tabBlur: true, screenCaptureBlock: true, printBlock: true };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/dashboard');

  const sec = await prisma.securityConfig.findUnique({ where: { id: 'global' } }) ?? DEFAULT_SEC;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sec.printBlock && (
        <style>{`@media print { body { display: none !important; } }`}</style>
      )}
      <ScreenshotGuard
        screenshotGuard={sec.screenshotGuard}
        tabBlur={sec.tabBlur}
        screenCaptureBlock={sec.screenCaptureBlock}
      />
      <AdminSidebar adminName={user.name ?? 'Admin'} adminEmail={user.email ?? ''} />
      <div className="flex-1 min-h-screen overflow-auto">
        {children}
      </div>
    </div>
  );
}
