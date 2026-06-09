import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { readFile } from 'fs/promises';
import path from 'path';
import { getUploadsDir } from '@/lib/utils';

// GET /api/materials/[id]/serve - Serve PDF for in-browser viewing only
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const material = await prisma.material.findUnique({ where: { id: params.id } });
  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const filePath = path.join(getUploadsDir(), material.filePath);
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        // Inline display only - no attachment/download prompt
        'Content-Disposition': 'inline',
        // Security headers to prevent caching and discourage download
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'self'",
        // Prevent the browser PDF toolbar from showing download button
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }
}
