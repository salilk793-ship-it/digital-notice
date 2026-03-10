import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { broadcastSync } from '@/lib/sync-broadcast';
import { detectConflict } from '@/lib/sync-types';

// GET single notice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const notice = await db.notice.findUnique({
      where: { id },
      include: {
        publishedBy: {
          select: { id: true, userId: true, name: true },
        },
      },
    });

    if (!notice) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      notice,
      sync: {
        version: Date.now(),
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Get notice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT update notice (with ownership check, edit tracking, and conflict resolution)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const sessionUserId = cookieStore.get('session_user')?.value;

    if (!sessionUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { userId: sessionUserId } });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get the existing notice
    const existingNotice = await db.notice.findUnique({
      where: { id },
      include: { publishedBy: true },
    });

    if (!existingNotice) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    const body = await request.json();
    const { 
      title, 
      description, 
      category, 
      startDate, 
      expiryDate, 
      status, 
      priority, 
      isPinned,
      image,
      attachment,
      attachmentName,
      contact,
      // Conflict resolution
      lastVersion,
      lastModified,
      deviceId,
    } = body;

    // Check if this is just a pin toggle (only isPinned provided)
    const isPinToggle = Object.keys(body).length === 1 && 'isPinned' in body;

    // Conflict detection: check if the notice was modified since the client last saw it
    if (lastVersion && lastModified) {
      const existingUpdatedAt = existingNotice.updatedAt.getTime()
      const clientModified = new Date(lastModified).getTime()
      
      const conflict = detectConflict(
        clientModified,
        existingUpdatedAt,
        lastModified,
        existingNotice.updatedAt.toISOString()
      )
      
      if (conflict.hasConflict && conflict.strategy === 'reject') {
        // The notice was modified on another device - return conflict info
        const conflictResponse = {
          error: 'Conflict detected',
          code: 'CONFLICT',
          conflict: {
            localVersion: clientModified,
            remoteVersion: existingUpdatedAt,
            localData: { title, description, category, startDate, expiryDate, status, priority, isPinned },
            remoteData: {
              title: existingNotice.title,
              description: existingNotice.description,
              category: existingNotice.category,
              startDate: existingNotice.startDate,
              expiryDate: existingNotice.expiryDate,
              status: existingNotice.status,
              priority: existingNotice.priority,
              isPinned: existingNotice.isPinned,
            },
          },
        }
        return NextResponse.json(conflictResponse, { status: 409 })
      }
    }

    // OWNERSHIP CHECK: Only the creator can edit their own notices (unless it's just pin toggle)
    if (!isPinToggle && existingNotice.publishedById !== user.id) {
      return NextResponse.json({ 
        error: 'You can only edit notices that you created',
        creator: existingNotice.publishedBy?.name || existingNotice.publishedBy?.userId,
      }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (expiryDate !== undefined) updateData.expiryDate = new Date(expiryDate);
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (isPinned !== undefined) updateData.isPinned = isPinned;
    if (image !== undefined) updateData.image = image;
    if (attachment !== undefined) updateData.attachment = attachment;
    if (attachmentName !== undefined) updateData.attachmentName = attachmentName;
    if (contact !== undefined) updateData.contact = contact;

    if (startDate && expiryDate && new Date(expiryDate) <= new Date(startDate)) {
      return NextResponse.json({ error: 'Expiry date must be after start date' }, { status: 400 });
    }

    // Mark as edited if content changed (not just pin toggle)
    if (!isPinToggle) {
      updateData.isEdited = true;
      updateData.editedAt = new Date();
      updateData.editedById = user.id;
    }

    const notice = await db.notice.update({
      where: { id },
      data: updateData,
      include: {
        publishedBy: {
          select: { id: true, userId: true, name: true },
        },
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        action: isPinToggle ? (isPinned ? 'pin' : 'unpin') : 'update',
        entityType: 'notice',
        entityId: notice.id,
        userId: user.id,
        noticeId: notice.id,
        details: JSON.stringify({ title: notice.title }),
      },
    });

    // Broadcast sync event with conflict resolution metadata
    broadcastSync({ 
      type: 'notices', 
      action: 'updated', 
      entityId: id 
    }, {
      deviceId,
      versionVector: deviceId ? { [deviceId]: Date.now() } : undefined,
    });

    return NextResponse.json({ 
      success: true, 
      notice,
      sync: {
        version: Date.now(),
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Update notice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE notice (move to trash - with ownership check)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const sessionUserId = cookieStore.get('session_user')?.value;

    if (!sessionUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { userId: sessionUserId } });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get the existing notice
    const existingNotice = await db.notice.findUnique({
      where: { id },
      include: { publishedBy: true },
    });

    if (!existingNotice) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    // OWNERSHIP CHECK: Only the creator can delete their own notices
    if (existingNotice.publishedById !== user.id) {
      return NextResponse.json({ 
        error: 'You can only delete notices that you created',
        creator: existingNotice.publishedBy?.name || existingNotice.publishedBy?.userId,
      }, { status: 403 });
    }

    // Get device ID from request headers for sync
    const deviceId = request.headers.get('x-device-id')

    await db.notice.update({
      where: { id },
      data: { status: 'deleted' },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        action: 'delete',
        entityType: 'notice',
        entityId: id,
        userId: user.id,
        noticeId: id,
        details: JSON.stringify({ title: existingNotice.title }),
      },
    });

    // Broadcast sync event
    broadcastSync({ 
      type: 'notices', 
      action: 'deleted', 
      entityId: id 
    }, {
      deviceId: deviceId || undefined,
    });

    return NextResponse.json({ 
      success: true,
      sync: {
        version: Date.now(),
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Delete notice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
