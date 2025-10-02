import { connections } from "../socket/store";
import { ElysiaWS } from "elysia/dist/ws";
import { messageHandler } from "./messageHandlers";
import { NotificationMessage } from "../types";

export const onOpen = async (ws: ElysiaWS<any>) => {
  const {
    jwt,
    request: { url },
  } = ws.data;
  try {
    const query = new URLSearchParams(url.split("?")[1] || "");
    const payload = await jwt.verify(query.get("token"));
    if (!payload) {
      ws.close(1008, "Unauthorized");
      return;
    }
    const { user } = payload;
    ws.data.claims.user.id = user.id;
    connections.set(user.id, ws);
  } catch (error) {
    console.log("WS auth error:", error);
    ws.close(1008, "Authentication failed");
  }
};

export const onMessage = (ws: any, message: NotificationMessage) => {
  messageHandler(ws, message);
};

export const onClose = (ws: any) => {
  if (connections.has(ws.data.claims.user.id)) {
    connections.delete(ws.data.claims.user.id);
    console.log(
      "closing websocket connection for userID: ",
      ws.data.claims.user.id
    );
  }

  console.log("connection: ", connections.keys());
};
