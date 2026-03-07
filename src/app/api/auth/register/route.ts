import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { userId, password, name, role } = await request.json();

    if (!userId || !password) {
      return NextResponse.json({ error: 'User ID and password are required' }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }

    const existingUser = await db.user.findUnique({
      where: { userId },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User ID already exists' }, { status: 400 });
    }

    const user = await db.user.create({
      data: {
        userId,
        password,
        name: name || userId,
        role: role || 'member',
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        userId: user.userId,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
