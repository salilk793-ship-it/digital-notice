import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

// GET all feedback (Admin only)
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

    const feedbacks = await db.feedback.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ feedbacks });
  } catch (error) {
    console.error('Get feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new feedback (Guest/User)
export async function POST(request: NextRequest) {
  try {
    const { name, email, subject, message, type } = await request.json();

    if (!name || !subject || !message) {
      return NextResponse.json({ error: 'Name, subject, and message are required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionUserId = cookieStore.get('session_user')?.value;

    let dbUserId: string | null = null;
    if (sessionUserId) {
      const user = await db.user.findUnique({ where: { userId: sessionUserId } });
      if (user) dbUserId = user.id;
    }

    const feedback = await db.feedback.create({
      data: {
        name,
        email: email || null,
        subject,
        message,
        type: type || 'suggestion',
        userId: dbUserId,
      },
    });

    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    console.error('Create feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
