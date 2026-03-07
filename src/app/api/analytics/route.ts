import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

// GET analytics data
export async function GET() {
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

    // Get current date info
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Basic stats
    const [
      totalNotices,
      activeNotices,
      expiredNotices,
      scheduledNotices,
      totalViews,
      totalReactions,
      totalRequests,
      pendingRequests,
      totalFeedbacks,
      pendingFeedbacks,
      userCount,
    ] = await Promise.all([
      db.notice.count(),
      db.notice.count({ where: { status: 'active' } }),
      db.notice.count({ where: { status: 'expired' } }),
      db.notice.count({ where: { status: 'scheduled' } }),
      db.notice.aggregate({ _sum: { viewCount: true } }),
      db.reaction.count(),
      db.request.count(),
      db.request.count({ where: { status: 'pending' } }),
      db.feedback.count(),
      db.feedback.count({ where: { status: 'pending' } }),
      db.user.count(),
    ]);

    // Most viewed notices
    const mostViewed = await db.notice.findMany({
      where: { status: { in: ['active', 'expired'] } },
      orderBy: { viewCount: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        viewCount: true,
        category: true,
        createdAt: true,
      },
    });

    // Most reacted notices
    const mostReacted = await db.notice.findMany({
      where: { status: { in: ['active', 'expired'] } },
      orderBy: [
        { likeCount: 'desc' },
        { helpfulCount: 'desc' },
      ],
      take: 5,
      select: {
        id: true,
        title: true,
        likeCount: true,
        helpfulCount: true,
        category: true,
      },
    });

    // Notices by category
    const noticesByCategory = await db.notice.groupBy({
      by: ['category'],
      _count: { id: true },
      where: { status: { in: ['active', 'expired'] } },
    });

    // Notices over time (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentNotices = await db.notice.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        createdAt: true,
      },
    });

    // Group by date
    const noticesByDate: Record<string, number> = {};
    recentNotices.forEach((notice) => {
      const dateKey = notice.createdAt.toISOString().split('T')[0];
      noticesByDate[dateKey] = (noticesByDate[dateKey] || 0) + 1;
    });

    // Views over time (last 30 days)
    const recentViews = await db.viewEvent.findMany({
      where: {
        viewedAt: { gte: thirtyDaysAgo },
      },
      select: {
        viewedAt: true,
      },
    });

    const viewsByDate: Record<string, number> = {};
    recentViews.forEach((view) => {
      const dateKey = view.viewedAt.toISOString().split('T')[0];
      viewsByDate[dateKey] = (viewsByDate[dateKey] || 0) + 1;
    });

    // Activity this week
    const weeklyStats = await Promise.all([
      db.notice.count({ where: { createdAt: { gte: thisWeek } } }),
      db.viewEvent.count({ where: { viewedAt: { gte: thisWeek } } }),
      db.request.count({ where: { createdAt: { gte: thisWeek } } }),
      db.feedback.count({ where: { createdAt: { gte: thisWeek } } }),
    ]);

    // Activity this month
    const monthlyStats = await Promise.all([
      db.notice.count({ where: { createdAt: { gte: thisMonth } } }),
      db.viewEvent.count({ where: { viewedAt: { gte: thisMonth } } }),
      db.request.count({ where: { createdAt: { gte: thisMonth } } }),
    ]);

    // Top publishers
    const topPublishers = await db.notice.groupBy({
      by: ['publishedById'],
      _count: { id: true },
      where: {
        status: { in: ['active', 'expired'] },
        publishedById: { not: null },
      },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    // Get publisher names
    const publisherIds = topPublishers.map((p) => p.publishedById).filter(Boolean);
    const publishers = await db.user.findMany({
      where: { id: { in: publisherIds as string[] } },
      select: { id: true, name: true, userId: true },
    });

    const topPublishersWithNames = topPublishers.map((p) => {
      const pub = publishers.find((pu) => pu.id === p.publishedById);
      return {
        name: pub?.name || pub?.userId || 'Unknown',
        count: p._count.id,
      };
    });

    // Trending notices (high views in last 7 days)
    const trendingNotices = await db.viewEvent.groupBy({
      by: ['noticeId'],
      _count: { id: true },
      where: {
        viewedAt: { gte: thisWeek },
      },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const trendingIds = trendingNotices.map((t) => t.noticeId);
    const trendingDetails = await db.notice.findMany({
      where: { id: { in: trendingIds } },
      select: { id: true, title: true, category: true, viewCount: true },
    });

    const trending = trendingNotices.map((t) => {
      const notice = trendingDetails.find((n) => n.id === t.noticeId);
      return {
        ...notice,
        weeklyViews: t._count.id,
      };
    }).filter(Boolean);

    return NextResponse.json({
      overview: {
        totalNotices,
        activeNotices,
        expiredNotices,
        scheduledNotices,
        totalViews: totalViews._sum.viewCount || 0,
        totalReactions,
        totalRequests,
        pendingRequests,
        totalFeedbacks,
        pendingFeedbacks,
        userCount,
      },
      weekly: {
        newNotices: weeklyStats[0],
        views: weeklyStats[1],
        requests: weeklyStats[2],
        feedbacks: weeklyStats[3],
      },
      monthly: {
        newNotices: monthlyStats[0],
        views: monthlyStats[1],
        requests: monthlyStats[2],
      },
      mostViewed,
      mostReacted,
      noticesByCategory: noticesByCategory.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
      noticesByDate,
      viewsByDate,
      topPublishers: topPublishersWithNames,
      trending,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
