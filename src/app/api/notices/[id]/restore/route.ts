import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { broadcastSync } from '@/lib/sync-broadcast';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const sessionUserId = cookieStore.get('session_user')?.value;

    if (!sessionUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { userId: sessionUserId } });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const notice = await db.notice.findUnique({ where: { id } });
    if (!notice) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    // OWNERSHIP CHECK
    if (notice.publishedById !== user.id) {
      return NextResponse.json({ 
        error: 'You can only restore notices that you created' 
      }, { status: 403 });
    }

    const now = new Date();
    const isExpired = notice.expiryDate < now;
    const isScheduled = notice.startDate > now;

    let status = 'active';
    if (isExpired) status = 'expired';
    else if (isScheduled) status = 'scheduled';

    await db.notice.update({
      where: { id },
      data: { status },
    });

    broadcastSync({ type: 'notices', action: 'updated', entityId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Restore notice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
