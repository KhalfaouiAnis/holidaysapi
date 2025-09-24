import { NotificationType } from "@prisma/client";
import { db } from "../db";
import { connections } from "../socket/store";

export async function sendAndSaveNotification(params: {
  title?: string;
  message: string;
  targetUserId?: string;
  type: NotificationType;
  createPerUserTracking?: boolean;
}) {
  const { title, message, type, targetUserId } = params;

  // Step 1: Send via WebSocket
  const payload = JSON.stringify({ title, message, type, id: Date.now() });

  if (type === NotificationType.NEW_PLACE) {
    // Broadcast to all connected users
    for (const ws of connections.values()) {
      try {
        ws.send(payload);
      } catch (error) {
        console.error("Broadcast send failed:", error);
      }
    }
  } else if (type === NotificationType.BOOKING && targetUserId) {
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

  // Step 2: Save to DB
  try {
    await db.$transaction(async (tx) => {
      // Step 1: Save main
      const savedNotification = await tx.notification.create({
        data: {
          title,
          message,
          type,
          targetUserId:
            type === NotificationType.BOOKING ? targetUserId : undefined,
        },
      });

      // Step 3: Optional per-user entries
      if (type === NotificationType.BOOKING && targetUserId) {
        // Always create for targeted
        await db.userNotification.create({
          data: {
            notificationId: savedNotification.id,
            userId: targetUserId,
          },
        });
      }
      //  else if (type === NotificationType.NEW_PLACE && createPerUserTracking) {
      //   const users = await db.user.findMany({ select: { id: true } });
      //   await db.userNotification.createMany({
      //     data: users.map((user) => ({
      //       notificationId: savedNotification.id,
      //       userId: user.id,
      //     })),
      //   });
      // }
      return savedNotification;
    });
  } catch (error) {
    console.error("DB save failed:", error);
    throw error;
  }
}
