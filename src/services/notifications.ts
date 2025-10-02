import { NotificationType } from "@prisma/client";
import { db } from "../db";
import { connections } from "../socket/store";

export async function sendAndSaveNotification(params: {
  type: NotificationType;
  message: string;
  title?: string;
  targetUserId?: string;
  createPerUserTracking?: boolean;
}) {
  const { title, message, type, targetUserId, createPerUserTracking } = params;

  try {
    await db.$transaction(async (tx) => {
      const savedNotification = await tx.notification.create({
        data: {
          title,
          message,
          type,
          targetUserId:
            type === NotificationType.USER_BOOKING ? targetUserId : undefined,
        },
      });

      if (type === NotificationType.USER_BOOKING && targetUserId) {
        // Always create for targeted
        await tx.userNotification.create({
          data: {
            notificationId: savedNotification.id,
            userId: targetUserId,
          },
        });
      } else if (
        type === NotificationType.USER_BOOKING &&
        createPerUserTracking
      ) {
        const users = await tx.user.findMany({ select: { id: true } });
        await tx.userNotification.createMany({
          data: users.map((user) => ({
            notificationId: savedNotification.id,
            userId: user.id,
          })),
        });
      }

      const payload = JSON.stringify({
        id: savedNotification.id,
        type: savedNotification.type,
        createdAt: savedNotification.createdAt,
        title: savedNotification.title,
        message: savedNotification.message,
      });

      if (type === NotificationType.BROADCAST) {
        // Broadcast to all connected users
        for (const ws of connections.values()) {
          try {
            const msg = ws.send(payload);
            console.log("ws.send(payload): ", msg);
          } catch (error) {
            console.error("Broadcast send failed:", error);
          }
        }
      } else if (type === NotificationType.USER_BOOKING && targetUserId) {
        // Targeted send
        const targetWs = connections.get(targetUserId);
        if (targetWs) {
          try {
            targetWs.send(payload);
          } catch (error) {
            console.error("Targeted send failed:", error);
          }
        }
      }

      return savedNotification;
    });
  } catch (error) {
    console.error("DB save failed:", error);
    throw error;
  }
}

export async function markNotificationAsRead(params: {
  notificationId: string;
  userId: string;
}) {
  const { notificationId, userId } = params;
  const where = {
    notificationId_userId: {
      notificationId,
      userId,
    },
  };
  try {
    const notif = await db.userNotification.findUnique({ where });
    if (!notif) return new Response("Notification not found", { status: 404 });
    if (notif.isRead)
      return new Response("Notification already marked as read", {
        status: 400,
      });
    await db.userNotification.update({
      where,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to update notification", error);
    throw error;
  }
}
