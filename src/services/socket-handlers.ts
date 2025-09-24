import { User } from "@prisma/client";
import { connections } from "../socket/store";

export const onOpen = async (ws: any) => {
  const {
    jwt,
    request: { headers },
  } = ws.data;
  try {
    const payload = await jwt.verify(headers.get("authorization"));

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

export const onMessage = (ws: any, message: any) => {
  console.log(connections.keys())
  for (const socket of connections.values()){
    socket.send("New message coming")
  }
  ws.publish(
    "event",
    `Received message <${message}> from user: ${ws.data.claims.user.id}`
  );
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
