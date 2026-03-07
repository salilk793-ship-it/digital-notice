import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Update expired notices first
    const now = new Date();
    await db.notice.updateMany({
      where: {
        status: 'active',
        expiryDate: { lt: now },
      },
      data: { status: 'expired' },
    });

    const [total, active, expired, deleted, pendingRequests] = await Promise.all([
      db.notice.count(),
      db.notice.count({ where: { status: 'active' } }),
      db.notice.count({ where: { status: 'expired' } }),
      db.notice.count({ where: { status: 'deleted' } }),
      db.request.count({ where: { status: 'pending' } }),
    ]);

    return NextResponse.json({
      total,
      active,
      expired,
      deleted,
      pendingRequests,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
