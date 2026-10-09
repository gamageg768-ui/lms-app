import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import AdminShell from '@/components/AdminShell';
import ScreenshotGuard from '@/components/ScreenshotGuard';

const DEFAULT_SEC = { screenshotGuard: true, tabBlur: true, screenCaptureBlock: true, printBlock: true };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/dashboard');

  const sec = await prisma.securityConfig.findUnique({ where: { id: 'global' } }) ?? DEFAULT_SEC;

  return (
    <>
      {sec.printBlock && (
        <style>{`@media print { body { display: none !important; } }`}</style>
      )}
      <ScreenshotGuard
        screenshotGuard={sec.screenshotGuard}
        tabBlur={sec.tabBlur}
        screenCaptureBlock={sec.screenCaptureBlock}
      />
      <AdminShell adminName={user.name ?? 'Admin'} adminEmail={user.email ?? ''}>
        {children}
      </AdminShell>
    </>
  );
}
