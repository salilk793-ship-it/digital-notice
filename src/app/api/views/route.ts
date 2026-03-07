import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

// POST - Record a view
export async function POST(request: NextRequest) {
  try {
    const { noticeId } = await request.json();

    if (!noticeId) {
      return NextResponse.json({ error: 'Notice ID required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionUserId = cookieStore.get('session_user')?.value;

    let dbUserId: string | null = null;
    if (sessionUserId) {
      const user = await db.user.findUnique({ where: { userId: sessionUserId } });
      if (user) dbUserId = user.id;
    }

    // Create view event
    await db.viewEvent.create({
      data: {
        noticeId,
        userId: dbUserId,
      },
    });

    // Increment view count on notice
    await db.notice.update({
      where: { id: noticeId },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('View tracking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
