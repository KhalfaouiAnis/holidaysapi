import { Expo, type ExpoPushMessage } from "expo-server-sdk";

// Create a new Expo SDK client
// optionally providing an access token if you have enabled push security
const expo = new Expo({
  accessToken: process.env.EXPO_TOKEN_SUPERSIMPLENOTES,
});

/**
 * Send push notifications using the official Expo SDK
 *
 * @param messages Array of Expo push messages
 * @returns Array of Expo push tickets
 */
export async function sendPushNotifications(messages: ExpoPushMessage[]) {
  // Filter out any invalid Expo push tokens
  const validMessages = messages.filter((message) => {
    const pushToken = Array.isArray(message.to) ? message.to[0] : message.to;
    return Expo.isExpoPushToken(pushToken);
  });

  // Chunk the notifications to reduce the number of requests
  const chunks = expo.chunkPushNotifications(validMessages);
  const tickets = [];

  // Send the chunks to the Expo push notification service
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);

      // Log any errors in the tickets
      ticketChunk.forEach((ticket, index) => {
        if (ticket.status === "error") {
          console.error("Error sending notification:", ticket.details);
          console.error("Original message:", chunk[index]);
        }
      });
    } catch (error) {
      console.error("Error sending push notification chunk:", error);
    }
  }

  return tickets;
}

/**
 * Check the receipts of sent notifications
 *
 * @param receiptIds Array of receipt IDs from previously sent notifications
 */
export async function checkPushNotificationReceipts(receiptIds: string[]) {
  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

  // biome-ignore lint/style/useConst: <explanation>
  for (let chunk of receiptIdChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      // Process each receipt
      for (const [receiptId, receipt] of Object.entries(receipts)) {
        if (receipt.status === "ok") {
          // Notification was delivered successfully
          continue;
        }
        if (receipt.status === "error") {
          console.error(`Error with receipt ${receiptId}:`, receipt.message);

          // Handle specific error codes
          if (receipt.details?.error) {
            // The error codes are listed in the Expo documentation
            console.error(`Error code: ${receipt.details.error}`);

            // Handle device not registered errors by removing the token from your database
            if (
              receipt.details.error === "DeviceNotRegistered" ||
              receipt.details.error === "InvalidCredentials"
            ) {
              // You might want to remove this token from your database
              // await removeExpoPushToken(receiptId);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error checking push notification receipts:", error);
    }
  }
}

/**
 * Process the push notification tickets and schedule receipt checking
 *
 * @param tickets The tickets returned from sendPushNotifications
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export async function processPushNotificationTickets(tickets: any[]) {
  // Filter out tickets that have IDs (meaning they were successfully sent)
  const receiptIds = tickets
    .filter((ticket) => ticket.status === "ok")
    .map((ticket) => ticket.id);

  // If there are any receipt IDs, check them after a delay
  if (receiptIds.length > 0) {
    // Wait 15 seconds before checking (normally you would do this with a job queue in production)
    setTimeout(() => {
      checkPushNotificationReceipts(receiptIds).catch(console.error);
    }, 15000);
  }

  return receiptIds;
}
