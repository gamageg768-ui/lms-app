import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

const DEFAULT_CONFIG = {
  screenshotGuard: true,
  tabBlur: true,
  screenCaptureBlock: true,
  printBlock: true,
  pdfWatermark: true,
  pdfPointerOverlay: true,
  concurrentSessionGuard: true,
};

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const config = await prisma.securityConfig.upsert({
    where: { id: 'global' },
    update: {},
    create: { id: 'global', ...DEFAULT_CONFIG },
  });
  return NextResponse.json(config);
}

export async function PATCH(req: Request) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const allowed = ['screenshotGuard', 'tabBlur', 'screenCaptureBlock', 'printBlock', 'pdfWatermark', 'pdfPointerOverlay', 'concurrentSessionGuard'];
  const data: Record<string, boolean> = {};
  for (const key of allowed) {
    if (typeof body[key] === 'boolean') data[key] = body[key];
  }

  const config = await prisma.securityConfig.upsert({
    where: { id: 'global' },
    update: data,
    create: { id: 'global', ...DEFAULT_CONFIG, ...data },
  });
  return NextResponse.json(config);
}
