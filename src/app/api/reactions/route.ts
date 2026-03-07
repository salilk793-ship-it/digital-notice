import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { broadcastSync } from '@/lib/sync-broadcast';

// GET reactions for a notice
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const noticeId = searchParams.get('noticeId');

    if (!noticeId) {
      return NextResponse.json({ error: 'Notice ID required' }, { status: 400 });
    }

    const reactions = await db.reaction.groupBy({
      by: ['type'],
      _count: { id: true },
      where: { noticeId },
    });

    const cookieStore = await cookies();
    const sessionUserId = cookieStore.get('session_user')?.value;

    let userReactions: string[] = [];
    if (sessionUserId) {
      const user = await db.user.findUnique({ where: { userId: sessionUserId } });
      if (user) {
        const userReactionRecords = await db.reaction.findMany({
          where: { noticeId, userId: user.id },
          select: { type: true },
        });
        userReactions = userReactionRecords.map((r) => r.type);
      }
    }

    return NextResponse.json({
      reactions: reactions.reduce((acc, r) => {
        acc[r.type] = r._count.id;
        return acc;
      }, {} as Record<string, number>),
      userReactions,
    });
  } catch (error) {
    console.error('Get reactions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add a reaction
export async function POST(request: NextRequest) {
  try {
    const { noticeId, type } = await request.json();

    if (!noticeId || !type) {
      return NextResponse.json({ error: 'Notice ID and type required' }, { status: 400 });
    }

    if (!['helpful', 'like'].includes(type)) {
      return NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionUserId = cookieStore.get('session_user')?.value;

    let userId: string | null = null;
    if (sessionUserId) {
      const user = await db.user.findUnique({ where: { userId: sessionUserId } });
      if (user) userId = user.id;
    }

    // For guests, use a unique identifier (we'll use a timestamp-based ID)
    if (!userId) {
      userId = `guest_${Date.now()}`;
    }

    // Check if reaction exists
    const existing = await db.reaction.findUnique({
      where: {
        noticeId_userId_type: {
          noticeId,
          userId,
          type,
        },
      },
    });

    if (existing) {
      // Remove reaction
      await db.reaction.delete({
        where: { id: existing.id },
      });

      // Decrement count
      if (type === 'helpful') {
        await db.notice.update({
          where: { id: noticeId },
          data: { helpfulCount: { decrement: 1 } },
        });
      } else if (type === 'like') {
        await db.notice.update({
          where: { id: noticeId },
          data: { likeCount: { decrement: 1 } },
        });
      }

      broadcastSync({ type: 'reactions', action: 'deleted' });
      return NextResponse.json({ success: true, action: 'removed' });
    } else {
      // Add reaction
      await db.reaction.create({
        data: {
          noticeId,
          userId,
          type,
        },
      });

      // Increment count
      if (type === 'helpful') {
        await db.notice.update({
          where: { id: noticeId },
          data: { helpfulCount: { increment: 1 } },
        });
      } else if (type === 'like') {
        await db.notice.update({
          where: { id: noticeId },
          data: { likeCount: { increment: 1 } },
        });
      }

      broadcastSync({ type: 'reactions', action: 'created' });
      return NextResponse.json({ success: true, action: 'added' });
    }
  } catch (error) {
    console.error('Reaction error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
