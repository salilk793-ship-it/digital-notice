import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { broadcastSync } from '@/lib/sync-broadcast';

// GET all requests
export async function GET() {
  try {
    const requests = await db.request.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: {
          select: { userId: true, name: true },
        },
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Get requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new request
export async function POST(request: NextRequest) {
  try {
    const { title, description, category, requestedBy } = await request.json();

    if (!title || !description || !requestedBy) {
      return NextResponse.json({ error: 'Title, description, and name are required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userId = cookieStore.get('session_user')?.value;

    let requesterId: string | null = null;
    if (userId) {
      const user = await db.user.findUnique({ where: { userId } });
      if (user) requesterId = user.id;
    }

    const newRequest = await db.request.create({
      data: {
        title,
        description,
        category: category || 'general',
        requestedBy,
        requesterId,
        status: 'pending',
      },
    });

    broadcastSync({ type: 'requests', action: 'created' });
    return NextResponse.json({ success: true, request: newRequest });
  } catch (error) {
    console.error('Create request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
