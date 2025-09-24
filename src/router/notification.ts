import { Elysia } from "elysia";
import { db } from "../db";
import { authPlugin } from "../middleware/auth";
import { sendAndSaveNotification } from "../services/notifications";
import { NotificationType } from "@prisma/client";

export const NotificationRoute = new Elysia({ prefix: "/notifications" })
  .use(authPlugin)
  .post("/broadcast/place", async ({ body }) => {
    const { title, message } = body as { title?: string; message: string };
    await sendAndSaveNotification({
      title,
      message,
      type: NotificationType.NEW_PLACE,
    });
    return { success: true };
  })
  .post("/booking", async ({ body }) => {
    const { title, message, userId } = body as {
      title?: string;
      message: string;
      userId: string;
    };
    await sendAndSaveNotification({
      title,
      message,
      type: NotificationType.BOOKING,
      targetUserId: userId,
    });
    return { success: true };
  })
  .get("/notifications/:userId", async ({ params: { userId } }) => {
    const notifications = await db.userNotification.findMany({
      where: { userId },
      include: { notification: true },
      orderBy: {
        isRead: "asc",
      },
    });
    return notifications;
  });
