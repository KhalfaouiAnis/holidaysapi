import { NotificationMessage } from "../types";
import {
  markNotificationAsRead,
  sendAndSaveNotification,
} from "./notifications";

export const messageHandler = async (ws: any, action: NotificationMessage) => {
  try {
    const { title, message, targetUserId, notificationId } = action.payload;

    switch (action.type) {
      case "NOTIFICATION_READ":
        if (notificationId && targetUserId) {
          await markNotificationAsRead({
            notificationId,
            userId: targetUserId,
          });
        }
        break;
      case "USER_BOOKING":
        await sendAndSaveNotification({
          title,
          type: action.type,
          message,
          targetUserId,
        });
        break;
      case "BROADCAST":
        await sendAndSaveNotification({
          title,
          message,
          type: action.type,
        });
      default:
        break;
    }
  } catch (error) {
    console.log(`Error handling message ${action.type}, error: `, error);
  }
};
