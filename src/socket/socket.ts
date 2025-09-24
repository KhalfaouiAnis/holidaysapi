import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { onClose, onMessage, onOpen } from "../services/socket-handlers";

export const socket = new Elysia().use(
  jwt({
    secret: Bun.env.JWT_TOKEN_SECRET as string,
  })
);

socket.decorate("claims", { user: {} as { id: string } });

socket.ws("/ws", {
  open: (ws) => onOpen(ws),
  message: (ws, message) => onMessage(ws, message),
  close: (ws) => onClose(ws),
});
