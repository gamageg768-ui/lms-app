import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import StudentNavbar from '@/components/StudentNavbar';
import ScreenshotGuard from '@/components/ScreenshotGuard';
import PomodoroTimer from '@/components/PomodoroTimer';

const DEFAULT_SEC = { screenshotGuard: true, tabBlur: true, screenCaptureBlock: true, printBlock: true };

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const user = session.user as any;
  if (user.role === 'ADMIN') redirect('/admin');

  const sec = await prisma.securityConfig.findUnique({ where: { id: 'global' } }) ?? DEFAULT_SEC;

  return (
    <div className="min-h-screen bg-gray-50">
      {sec.printBlock && (
        <style>{`@media print { body { display: none !important; } }`}</style>
      )}
      <ScreenshotGuard
        screenshotGuard={sec.screenshotGuard}
        tabBlur={sec.tabBlur}
        screenCaptureBlock={sec.screenCaptureBlock}
      />
      <StudentNavbar user={{ name: user.name ?? '', email: user.email ?? '', role: user.role }} />
      <PomodoroTimer />
      <main>{children}</main>
    </div>
  );
}
