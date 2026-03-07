import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { broadcastSync } from '@/lib/sync-broadcast';

// GET user's bookmarks
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionUserId = cookieStore.get('session_user')?.value;

    if (!sessionUserId || sessionUserId === 'Guest') {
      return NextResponse.json({ bookmarks: [] });
    }

    const user = await db.user.findUnique({ where: { userId: sessionUserId } });
    if (!user) {
      return NextResponse.json({ bookmarks: [] });
    }

    const { searchParams } = new URL(request.url);
    const noticeId = searchParams.get('noticeId');

    if (noticeId) {
      // Check if specific notice is bookmarked
      const bookmark = await db.bookmark.findUnique({
        where: {
          noticeId_userId: { noticeId, userId: user.id },
        },
      });
      return NextResponse.json({ isBookmarked: !!bookmark });
    }

    const bookmarks = await db.bookmark.findMany({
      where: { userId: user.id },
      include: {
        notice: {
          include: {
            publishedBy: {
              select: { id: true, userId: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ bookmarks });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST toggle bookmark
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionUserId = cookieStore.get('session_user')?.value;

    if (!sessionUserId || sessionUserId === 'Guest') {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { userId: sessionUserId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { noticeId } = await request.json();

    if (!noticeId) {
      return NextResponse.json({ error: 'Notice ID required' }, { status: 400 });
    }

    // Check if already bookmarked
    const existing = await db.bookmark.findUnique({
      where: {
        noticeId_userId: { noticeId, userId: user.id },
      },
    });

    if (existing) {
      // Remove bookmark
      await db.bookmark.delete({
        where: { id: existing.id },
      });
      broadcastSync({ type: 'bookmarks', action: 'deleted' });
      return NextResponse.json({ success: true, isBookmarked: false });
    } else {
      // Add bookmark
      await db.bookmark.create({
        data: {
          noticeId,
          userId: user.id,
        },
      });

      // Log activity
      await db.activityLog.create({
        data: {
          action: 'bookmark',
          entityType: 'notice',
          entityId: noticeId,
          userId: user.id,
          noticeId,
        },
      });

      broadcastSync({ type: 'bookmarks', action: 'created' });
      return NextResponse.json({ success: true, isBookmarked: true });
    }
  } catch (error) {
    console.error('Toggle bookmark error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
