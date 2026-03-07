import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { broadcastSync } from '@/lib/sync-broadcast';

// GET all notices
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const priority = searchParams.get('priority');

    // Check and update expired notices and activate scheduled notices
    const now = new Date();
    
    // Expire notices that have passed their expiry date
    await db.notice.updateMany({
      where: {
        status: 'active',
        expiryDate: { lt: now },
      },
      data: { status: 'expired' },
    });

    // Activate scheduled notices that have reached their start date
    await db.notice.updateMany({
      where: {
        status: 'scheduled',
        startDate: { lte: now },
        expiryDate: { gt: now },
      },
      data: { status: 'active' },
    });

    const where: Record<string, unknown> = {};
    
    if (status !== 'all') {
      where.status = status;
    }
    
    if (category && category !== 'all') {
      where.category = category;
    }
    
    if (priority && priority !== 'all') {
      where.priority = priority;
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Validate sort field
    const validSortFields = ['createdAt', 'startDate', 'expiryDate', 'viewCount', 'title', 'priority'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    // For multiple sort orders (pinned first, then by sort field)
    const notices = await db.notice.findMany({
      where,
      orderBy: [
        { isPinned: 'desc' },
        { [sortField]: orderDirection },
      ],
      include: {
        publishedBy: {
          select: { id: true, userId: true, name: true },
        },
      },
    });

    return NextResponse.json({ notices });
  } catch (error) {
    console.error('Get notices error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new notice
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionUserId = cookieStore.get('session_user')?.value;

    if (!sessionUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { userId: sessionUserId } });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { title, description, category, startDate, expiryDate, isScheduled, priority } = await request.json();

    if (!title || !description || !startDate || !expiryDate) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const start = new Date(startDate);
    const expiry = new Date(expiryDate);
    const now = new Date();

    if (expiry <= start) {
      return NextResponse.json({ error: 'Expiry date must be after start date' }, { status: 400 });
    }

    // Determine initial status
    let status = 'active';
    if (isScheduled || start > now) {
      status = 'scheduled';
    }

    const notice = await db.notice.create({
      data: {
        title,
        description,
        category: category || 'general',
        priority: priority || 'normal',
        startDate: start,
        expiryDate: expiry,
        status,
        publishedById: user.id,
        isEdited: false,
        viewCount: 0,
        helpfulCount: 0,
        likeCount: 0,
        commentCount: 0,
      },
      include: {
        publishedBy: {
          select: { id: true, userId: true, name: true },
        },
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        action: 'create',
        entityType: 'notice',
        entityId: notice.id,
        userId: user.id,
        noticeId: notice.id,
        details: JSON.stringify({ title }),
      },
    });

    broadcastSync({ type: 'notices', action: 'created', entityId: notice.id });

    return NextResponse.json({ success: true, notice });
  } catch (error) {
    console.error('Create notice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
