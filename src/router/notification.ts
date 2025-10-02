import { Elysia, t } from "elysia";
import { db } from "../db";
import { authPlugin } from "../middleware/auth";
import { sendAndSaveNotification } from "../services/notifications";
import { NotificationType } from "@prisma/client";

const NotificationInput = t.Object({
  title: t.Optional(t.String()),
  message: t.String(),
});

export const NotificationRoute = new Elysia({ prefix: "/notifications" })
  .use(authPlugin)
  .post(
    "/broadcast/place",
    async ({ body }) => {
      const { title, message } = body as { title?: string; message: string };
      await sendAndSaveNotification({
        title,
        message,
        type: NotificationType.BROADCAST,
      });
      return { success: true };
    },
    {
      body: NotificationInput,
    }
  )
  .post("/booking", async ({ body }) => {
    const { title, message, userId } = body as {
      title?: string;
      message: string;
      userId: string;
    };
    await sendAndSaveNotification({
      title,
      message,
      type: NotificationType.BROADCAST,
      targetUserId: userId,
    });
    return { success: true };
  })
  .get(
    "/:userId",
    async ({ query, params: { userId } }) => {
      const page = Number(query?.page || 1);
      const pageSize = Number(query?.pageSize || 10);
      const skip = (page - 1) * pageSize;

      const [notifications, totalCount] = await Promise.all([
        db.userNotification.findMany({
          where: { userId },
          select: {
            notification: {
              select: { title: true, message: true, type: true, createdAt: true },
            },
            id: true,
            userId: true,
            readAt: true,
            isRead: true,
          },
          orderBy: {
            isRead: "asc",
          },
        }),
        db.userNotification.count({
          where: { userId },
        }),
      ]);
      return {
        data: notifications,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/",
    async ({ query }) => {
      const page = Number(query?.page || 1);
      const pageSize = Number(query?.pageSize || 10);
      const skip = (page - 1) * pageSize;

      const [notifications, totalCount] = await Promise.all([
        db.notification.findMany({
          take: pageSize,
          skip,
          orderBy: {
            createdAt: "desc",
          },
        }),
        db.notification.count(),
      ]);

      return {
        data: notifications,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
    }
  );
