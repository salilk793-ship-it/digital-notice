import { broadcastSync } from '@/lib/sync-broadcast';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('session_user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { userId } });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await db.request.update({
      where: { id },
      data: { status: 'rejected' },
    });

    broadcastSync({ type: 'requests', action: 'updated' });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reject request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
