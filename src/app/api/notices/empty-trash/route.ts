import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { broadcastSync } from '@/lib/sync-broadcast';

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('session_user')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { userId } });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await db.notice.deleteMany({
      where: { status: 'deleted' },
    });

    broadcastSync({ type: 'notices', action: 'refresh' });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Empty trash error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
