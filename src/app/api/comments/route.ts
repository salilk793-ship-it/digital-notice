import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { broadcastSync } from '@/lib/sync-broadcast';

// GET comments for a notice
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const noticeId = searchParams.get('noticeId');

    if (!noticeId) {
      return NextResponse.json({ error: 'Notice ID required' }, { status: 400 });
    }

    const comments = await db.comment.findMany({
      where: { noticeId, parentId: null },
      include: {
        user: {
          select: { id: true, userId: true, name: true },
        },
        replies: {
          include: {
            user: {
              select: { id: true, userId: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create a comment
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionUserId = cookieStore.get('session_user')?.value;

    const { noticeId, content, parentId } = await request.json();

    if (!noticeId || !content) {
      return NextResponse.json({ error: 'Notice ID and content required' }, { status: 400 });
    }

    let dbUserId: string | null = null;
    if (sessionUserId && sessionUserId !== 'Guest') {
      const user = await db.user.findUnique({ where: { userId: sessionUserId } });
      if (user) dbUserId = user.id;
    }

    const comment = await db.comment.create({
      data: {
        noticeId,
        content,
        parentId: parentId || null,
        userId: dbUserId,
      },
      include: {
        user: {
          select: { id: true, userId: true, name: true },
        },
      },
    });

    // Update comment count
    await db.notice.update({
      where: { id: noticeId },
      data: { commentCount: { increment: 1 } },
    });

    // Log activity
    if (dbUserId) {
      await db.activityLog.create({
        data: {
          action: 'comment',
          entityType: 'notice',
          entityId: noticeId,
          userId: dbUserId,
          noticeId,
          details: JSON.stringify({ content: content.substring(0, 100) }),
        },
      });
    }

    broadcastSync({ type: 'comments', action: 'created' });
    return NextResponse.json({ success: true, comment });
  } catch (error) {
    console.error('Create comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE a comment
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Comment ID required' }, { status: 400 });
    }

    const comment = await db.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    await db.comment.delete({ where: { id } });

    // Update comment count
    await db.notice.update({
      where: { id: comment.noticeId },
      data: { commentCount: { decrement: 1 } },
    });

    broadcastSync({ type: 'comments', action: 'deleted' });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
