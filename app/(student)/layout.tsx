import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import StudentNavbar from '@/components/StudentNavbar';
import ScreenshotGuard from '@/components/ScreenshotGuard';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const user = session.user as any;
  if (user.role === 'ADMIN') redirect('/admin');

  return (
    <div className="min-h-screen bg-gray-50">
      <ScreenshotGuard />
      <StudentNavbar user={{ name: user.name ?? '', email: user.email ?? '', role: user.role }} />
      <main>{children}</main>
    </div>
  );
}
