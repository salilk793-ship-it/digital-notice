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

    const { startDate, expiryDate } = await request.json();

    if (!startDate || !expiryDate) {
      return NextResponse.json({ error: 'Start date and expiry date are required' }, { status: 400 });
    }

    if (new Date(expiryDate) <= new Date(startDate)) {
      return NextResponse.json({ error: 'Expiry date must be after start date' }, { status: 400 });
    }

    const req = await db.request.findUnique({ where: { id } });
    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Create notice from request
    const notice = await db.notice.create({
      data: {
        title: req.title,
        description: req.description,
        category: req.category,
        startDate: new Date(startDate),
        expiryDate: new Date(expiryDate),
        status: 'active',
        publishedById: user.id,
      },
    });

    // Update request status
    await db.request.update({
      where: { id },
      data: { status: 'approved' },
    });

    broadcastSync({ type: 'requests', action: 'updated' });
    broadcastSync({ type: 'notices', action: 'created' });
    return NextResponse.json({ success: true, notice });
  } catch (error) {
    console.error('Approve request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
