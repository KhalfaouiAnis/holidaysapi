import { NotificationType } from "@prisma/client";

export type NotificationMessage = {
  type: NotificationType;
  payload: MessagePayload;
};

type MessagePayload = {
  title?: string;
  targetUserId?: string;
  notificationId?: string;
  message: string;
};
