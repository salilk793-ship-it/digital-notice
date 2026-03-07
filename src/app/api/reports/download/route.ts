import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionUserId = cookieStore.get('session_user')?.value;
    if (!sessionUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { userId: sessionUserId } });
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');
    if (!file) return NextResponse.json({ error: 'File name required' }, { status: 400 });

    // Sanitize: only allow filenames, no path traversal
    const safeName = path.basename(file);
    if (!safeName.endsWith('.docx')) return NextResponse.json({ error: 'Invalid file' }, { status: 400 });

    const filePath = path.join(process.cwd(), 'download', safeName);
    if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    const buffer = fs.readFileSync(filePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    console.error('Download report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
